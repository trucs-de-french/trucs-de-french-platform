"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  Play,
  Pause,
  Rewind,
  FastForward,
  Repeat,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Captions,
  Turtle,
  X,
} from "lucide-react";
import { parseWebVtt, type WebVttCue } from "@/lib/webvtt";
import { useFullscreenWrapper } from "@/hooks/use-fullscreen-wrapper";
import { FullscreenExitButton } from "@/components/fullscreen-exit-button";
import { Z_MODAL } from "@/lib/z-layers";
import { firstVocabVariant, type VideoVocabItem, type VocabItem } from "@/lib/vocab";
import { matchVocabInText, matchTranslatedFormInText, buildVariantMap, normalizeWordForMatch } from "@/lib/vocab-match";
import { PART_OF_SPEECH_LABELS_FR, PART_OF_SPEECH_COLORS, normalizePartOfSpeech } from "@/lib/vocab-categories";
import { extractAlignedContext } from "@/lib/cabinet/saved-words";
import { useT } from "@/lib/i18n/context";
import { SaveWordButton } from "@/components/dictionary/save-word-button";
import { useSavedWords, type SaveWordSnapshot } from "@/components/dictionary/saved-words-provider";
import { tokenizePlainText, PlainWordPanel } from "@/components/dictionary/plain-word-panel";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const OVERLAY_HIDE_DELAY_MS = 2500;
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#14132b]";

export type VideoSubtitleTrack = { lang: "fr" | "uk"; url: string };
type SubtitlesMode = "fr_uk" | "fr" | "uk" | "off";

// Той самий принцип автопаузи, що audio-player.tsx (модульна змінна "хто
// грає", не React-стан) — лише між екземплярами VideoPlayer, та сама межа,
// що й у AudioPlayer (лише між екземплярами AudioPlayer).
let currentlyPlaying: HTMLVideoElement | null = null;

// Єдина точка входу для .pause() — аудит "stop spontaneous pauses": усі
// три місця в цьому файлі, що ставлять відео на паузу програмно
// (openWordCard/togglePlay/stopOthersAndRegister), проходять через цю
// функцію, щороку викликається з коротким рядком-причиною (reason) у
// коментарі виклику нижче. Під час самого аудиту тут стояв
// console.trace(reason), яким перевірялось, яка причина спрацьовує без
// жодної дії студента — сам лог прибрано перед комітом (reason тут більше
// не трапляється в рантаймі, лише орієнтир для читача коду), pauseSafely
// лишена як єдина точка, де РЕАЛЬНО викликається video.pause() у цьому
// файлі.
function pauseSafely(video: HTMLVideoElement) {
  video.pause();
}

function stopOthersAndRegister(el: HTMLVideoElement) {
  // reason: "stopOthersAndRegister" — інший екземпляр VideoPlayer щойно
  // почав грати.
  if (currentlyPlaying && currentlyPlaying !== el) pauseSafely(currentlyPlaying);
  currentlyPlaying = el;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Клавіатурні скорочення плеєра (Пробіл/←/→ — handleWrapperKeyDown нижче)
// не мають спрацьовувати, поки студент друкує — задача-виправлення
// "ignore player shortcuts while typing in word panel". INPUT/TEXTAREA/
// SELECT/contenteditable/role=textbox — звичайні текстові поля будь-де в
// плеєрі (сьогодні єдине таке поле — "Мій переклад" у PlainWordPanel, але
// перевірка загальна, не прив'язана до конкретного компонента).
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((target as HTMLElement).isContentEditable) return true;
  if (target.getAttribute("role") === "textbox") return true;
  return false;
}

function readStoredSpeed(): number {
  try {
    const raw = localStorage.getItem("videoPlayer:speed");
    const n = raw ? Number(raw) : NaN;
    return SPEEDS.includes(n) ? n : 1;
  } catch {
    return 1;
  }
}

function readStoredSubtitlesMode(): SubtitlesMode | null {
  try {
    const raw = localStorage.getItem("videoPlayer:subtitlesMode");
    return raw === "fr_uk" || raw === "fr" || raw === "uk" || raw === "off" ? raw : null;
  } catch {
    return null;
  }
}

function readStoredPauseOnWordOpen(): boolean | null {
  try {
    const raw = localStorage.getItem("videoPlayer:pauseOnWordOpen");
    return raw === "true" ? true : raw === "false" ? false : null;
  } catch {
    return null;
  }
}

// Підказка "слова в субтитрах можна тапнути" (pause-чип/play-чип нижче) —
// власний localStorage-ключ, ОКРЕМИЙ від tdf.dictHint.v1 (одноразова
// підказка над скриптом, dict-hint.tsx — лишається без змін). seen —
// скільки разів показано pause-чип (до 8, після — більше не показуємо);
// saved — чи студент уже зберіг слово САМЕ з цього відео (після цього
// pause-чип теж більше не показуємо, навіть якщо seen<8). Відсутність
// самого ключа в localStorage ("null" від readVideoWordHintState) — ознака
// "студент ще взагалі не бачив жодної підказки відео", за якою вирішує,
// чи показати один раз play-чип при першому відтворенні.
type VideoWordHintState = { seen: number; saved: boolean };
const VIDEO_WORD_HINT_KEY = "tdf.videoWordHint.v1";
const VIDEO_WORD_HINT_MAX_SEEN = 8;

function readVideoWordHintState(): VideoWordHintState | null {
  try {
    const raw = localStorage.getItem(VIDEO_WORD_HINT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<VideoWordHintState>;
    return { seen: Number(parsed.seen) || 0, saved: Boolean(parsed.saved) };
  } catch {
    return null;
  }
}

function writeVideoWordHintState(state: VideoWordHintState) {
  try {
    localStorage.setItem(VIDEO_WORD_HINT_KEY, JSON.stringify(state));
  } catch {
    // localStorage недоступний (приватний режим тощо) — підказка просто
    // показуватиметься знову наступного разу, не критично.
  }
}

// FR-репліка: vocab[].word, зіставлений через matchVocabInText (vocab-match.ts,
// Крок 2 глосарію), рендериться клікабельною кнопкою (data-vocab-trigger —
// за цим атрибутом "клік поза карткою" нижче впізнає сам тригер і не закриває
// щойно відкриту картку). Решта тексту — звичайний текст, навіть пробіли
// (обгортка в span безпечна — inline, без візуального ефекту).
//
// Компонент (не плоска функція) — onWordClick (handleWordClick у VideoPlayer)
// читає wrapperRef.current/videoRef.current; react-hooks/refs забороняє
// передавати такий колбек у звичайну функцію, викликану прямо в тілі
// рендеру (не може статично довести, що викликається пізніше, в event-
// хендлері) — як проп дочірнього КОМПОНЕНТА те саме дозволено (той самий
// принцип, що вже onWordClick у DialogueLine, dialogue-line.tsx).
// Звичайні (не підсвічені вчителькою) слова в тексті репліки — та сама
// токенізація, що панель звичайного слова скрипту (tokenizePlainText,
// plain-word-panel.tsx), щоб word_key/дедуп лишались ідентичними між обома
// поверхнями. БЕЗ підкреслення/фону в будь-якому стані (вимога задачі,
// навмисно відрізняється від .video-word-fr — учительське слово лишається
// підкресленим завжди) — лише легкий hover/focus-visible, керується CSS.
// Клікабельні лише на паузі: pointer-events на .video-plain-word
// перемикається CSS-класом на обгортці (.video-player--playing), не тут —
// SubtitleFrLine сама не знає стан playing.
function SubtitleFrLine({
  text,
  vocab,
  playing,
  onWordClick,
  onPlainWordClick,
}: {
  text: string;
  vocab: VideoVocabItem[];
  // Задача-виправлення "stop spontaneous pauses": tabIndex={-1}, поки
  // відео грає — кнопка звичайного слова НЕ має лишатись у Tab-порядку
  // (і тим паче ЗБЕРІГАТИ вже отриманий раніше фокус) під час
  // відтворення. pointer-events:none (CSS, .video-player--playing) сам НЕ
  // знімає фокус із кнопки, яка його отримала РАНІШЕ (ще на паузі) —
  // tabIndex=-1 разом із примусовим blur() (ефект у VideoPlayer, нижче)
  // закривають саме цю прогалину.
  playing: boolean;
  onWordClick: (item: VideoVocabItem, e: ReactMouseEvent<HTMLButtonElement>) => void;
  onPlainWordClick: (word: string, offsetInCue: number, e: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const parts = matchVocabInText(text.replace(/\n+/g, " "), vocab);
  // Офсети кожної частини рахуються ОКРЕМИМ проходом ПЕРЕД .map(), що
  // рендерить JSX (не мутацією змінної всередині самого цього .map() —
  // React Compiler забороняє переприв'язку такої змінної після рендеру,
  // той самий принцип, що partOffsets у dialogue-line.tsx).
  const partOffsets: number[] = [];
  {
    let acc = 0;
    for (const part of parts) {
      partOffsets.push(acc);
      acc += part.text.length;
    }
  }
  return (
    <>
      {parts.map((part, i) => {
        const partOffset = partOffsets[i];

        if (part.type === "match") {
          return (
            <button
              key={i}
              type="button"
              data-vocab-trigger
              onClick={(e) => onWordClick(part.item, e)}
              className="video-word-fr"
            >
              {part.text}
            </button>
          );
        }

        const tokens = tokenizePlainText(part.text);
        return (
          <span key={i}>
            {tokens.map((token, j) =>
              token.type === "literal" || !token.clickable ? (
                <span key={j}>{token.text}</span>
              ) : (
                <button
                  key={j}
                  type="button"
                  data-plain-word-trigger
                  tabIndex={playing ? -1 : 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPlainWordClick(token.text, partOffset + token.start, e);
                  }}
                  className="video-plain-word"
                >
                  {token.text}
                </button>
              )
            )}
          </span>
        );
      })}
    </>
  );
}

// UA-репліка: той самий принцип, що TranslatedText (dialogue-line.tsx) —
// підсвітка за translatedForm, БЕЗ клікабельності (переклад слова вже
// показаний у FR-рядку вище/у картці).
function renderUkSubtitleLine(text: string, vocab: VideoVocabItem[]) {
  const parts = matchTranslatedFormInText(text.replace(/\n+/g, " "), vocab);
  return parts.map((part, i) =>
    part.type === "match" ? (
      <span key={i} className="video-word-uk">
        {part.text}
      </span>
    ) : (
      <span key={i}>{part.text}</span>
    )
  );
}

// Підсвітка слова в прикладі репліки ВСЕРЕДИНІ самої картки — лише
// візуальна (не кнопка): вкладати ще одну клікабельну кнопку в dialog, що й
// сама відкрита з такого ж кліку, було б зайвим і заплутаним.
function renderHighlightedExample(text: string, item: VideoVocabItem) {
  const parts = matchVocabInText(text.replace(/\n+/g, " "), [item]);
  return parts.map((part, i) =>
    part.type === "match" ? (
      <span key={i} className="video-word-fr-static">
        {part.text}
      </span>
    ) : (
      <span key={i}>{part.text}</span>
    )
  );
}

function findActiveCue(cues: WebVttCue[], time: number): WebVttCue | null {
  for (const cue of cues) {
    if (time >= cue.start && time < cue.end) return cue;
  }
  return null;
}

export function VideoPlayer({
  src,
  subtitles,
  vocab,
  dialogue = [],
  title,
  poster,
  className = "",
}: {
  src: string;
  subtitles?: VideoSubtitleTrack[];
  // Клікабельний глосарій у субтитрах (Крок 2) — vocab[] зі скрипту сцени/
  // content-блоку/групи, вже агрегований collectVideoVocab (vocab.ts) на
  // сервері, разом із прикладом репліки для кожного слова. Відсутній —
  // субтитри рендеряться як звичайний текст (жодних клікабельних слів).
  vocab?: VideoVocabItem[];
  // Повний dialogue сцени/блоку (ті самі рядки, що передали в
  // collectVideoVocab вище) — потрібен лише для ЗВИЧАЙНИХ (не
  // підсвічених) слів: щоб extractAlignedContext узяв РЕЧЕННЯ з повної
  // репліки скрипту, а не лише з фрагмента .vtt-кью (кью може розбивати
  // репліку на кілька рядків субтитрів, не по межі речення). Відсутній —
  // контекст звичайного слова рахується прямо з тексту кью (гірша, але
  // робоча апроксимація).
  dialogue?: { text: string; translationUk?: string | null }[];
  title?: string;
  poster?: string;
  className?: string;
}) {
  const { t } = useT();
  // Лише для "студент уже зберіг слово з ЦЬОГО відео" (підказка-чип
  // нижче) — null без SavedWordsProvider/незалогіненого студента, тоді
  // підказка про збереження просто ніколи не вимикається самостійно
  // (seen-лічильник усе одно зупинить її після VIDEO_WORD_HINT_MAX_SEEN).
  const saved = useSavedWords();
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const speedWrapRef = useRef<HTMLDivElement>(null);
  const speedButtonRef = useRef<HTMLButtonElement>(null);
  const subsWrapRef = useRef<HTMLDivElement>(null);
  const subsButtonRef = useRef<HTMLButtonElement>(null);
  const hideOverlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const wordCardRef = useRef<HTMLDivElement>(null);
  const plainPanelWrapRef = useRef<HTMLDivElement>(null);
  // Сама плашка субтитрів (FR+UA разом) — потрібна лише для розрахунку
  // bottomPx картки/панелі слова (computeAnchor нижче): від ВЕРХУ ВСІЄЇ
  // плашки, не лише рядка клікнутого слова, інакше картка перекривала
  // другий рядок (UA), коли ввімкнено "FR+UA" (аудит "save any word from
  // video subtitles", п.1 — причина видимого "clipping" картки в
  // landscape-fullscreen).
  const subtitlePlateRef = useRef<HTMLDivElement>(null);
  // Та сама плашка, але вимірювана висота (ResizeObserver, не константа —
  // плашка то з 1, то з 2 рядків, то відсутня взагалі) — потрібна лише для
  // позиціонування pause/play-чипа (підказка "слова можна тапнути") ТОЧНО
  // над плашкою, без власного layout shift: чип завжди position:absolute,
  // а не живий сиблінг у flex-колонці субтитрів, тож поява/зникнення
  // плашки саму по собі не зсуває чип і навпаки. callback-ref (не просто
  // useEffect від subtitlePlateRef.current — ref.current не є залежністю,
  // що тригерить React) приєднує/відключає ResizeObserver щоразу, коли
  // сам DOM-вузол плашки з'являється/зникає (умовний рендер — showFr/
  // showUk/activeFrCue/activeUkCue).
  const [plateHeight, setPlateHeight] = useState(0);
  const plateObserverRef = useRef<ResizeObserver | null>(null);
  const attachSubtitlePlateRef = useCallback((node: HTMLDivElement | null) => {
    subtitlePlateRef.current = node;
    plateObserverRef.current?.disconnect();
    plateObserverRef.current = null;
    if (!node) {
      setPlateHeight(0);
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.target.getBoundingClientRect().height;
      if (height !== undefined) setPlateHeight(height);
    });
    observer.observe(node);
    plateObserverRef.current = observer;
  }, []);
  // Пам'ятає, чи відео грало ДО відкриття картки слова (лише коли "Пауза
  // при відкритті слова" увімкнена) — щоб закриття картки відновлювало
  // відтворення ЛИШЕ якщо воно й справді йшло, а не завжди.
  const wasPlayingBeforeCardRef = useRef<boolean | null>(null);
  const {
    wrapperRef,
    isFullscreen,
    isPseudoFullscreen,
    isAnyFullscreen,
    toggle: toggleFullscreen,
    exitAnyFullscreen,
  } = useFullscreenWrapper();

  const [playing, setPlaying] = useState(false);
  // Задача-виправлення "stop spontaneous pauses" — щойно відео РЕАЛЬНО
  // почало грати, знімаємо фокус із будь-якого звичайного слова
  // (.video-plain-word), якщо воно досі в фокусі (отриманому РАНІШЕ, на
  // паузі, коли тулиться tabIndex=0): CSS pointer-events:none сам НЕ
  // знімає фокус, тож ТАКА кнопка лишалась би активованою Enter/Space,
  // відкриваючи картку (і ставлячи відео на паузу) без жодного кліку —
  // саме цей розрив закривають tabIndex={-1} (SubtitleFrLine вище) і
  // явний blur() тут.
  useEffect(() => {
    if (!playing) return;
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.classList.contains("video-plain-word")) {
      active.blur();
    }
  }, [playing]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  // Реальна висота оверлея керування (не константа — ряди переносяться на
  // вузьких екранах, висота плаває) — субтитри піднімаються рівно на цю
  // висоту + 8px, щоб ніколи не перекриватись кнопками.
  const [overlayHeight, setOverlayHeight] = useState(0);
  // Висота самого контейнера плеєра — потрібна лише для обмеження max-height
  // меню, що розкриваються вгору (щоб не вилазили за верхній край контейнера
  // з overflow-hidden). Вимірюється так само через ResizeObserver, а не
  // читанням wrapperRef.current напряму в тілі рендеру (react-hooks/refs
  // забороняє доступ до .current під час рендеру).
  const [containerHeight, setContainerHeight] = useState(0);
  // Ширина контейнера — для горизонтального "затискання" картки слова
  // (desktop-анкор біля слова, не вилазить за межі відео), той самий
  // ResizeObserver, що вже вимірює containerHeight.
  const [containerWidth, setContainerWidth] = useState(0);
  // Завжди фіксований дефолт на першому рендері (сервер і клієнт мають
  // збігатись) — збережену швидкість із localStorage застосовуємо лише
  // ПІСЛЯ монтування, в ефекті нижче. Раніше лазі-ініціалізатор читав
  // localStorage напряму тут — на клієнті першим рендером міг вийти інший
  // speed, ніж на сервері (SSR завжди бачив дефолт), і React лаявся на
  // hydration mismatch (aria-pressed кнопки "Повільно" true/false).
  const [speed, setSpeed] = useState<number>(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [subsOpen, setSubsOpen] = useState(false);
  const [loopLine, setLoopLine] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Фіксований дефолт на першому рендері (ON), той самий принцип, що speed/
  // mode вище — збережене значення з localStorage застосовується лише після
  // монтування, в ефекті нижче.
  const [pauseOnWordOpen, setPauseOnWordOpen] = useState(true);
  // Відкрита картка/панель слова — лише ОДНА одночасно (openCard=null —
  // нічого не відкрито), "vocab" (підсвічене вчителькою, VideoWordCard) чи
  // "plain" (звичайне слово субтитрів, PlainWordPanel, Крок "save any word
  // from video subtitles"). anchorLeftPx — горизонтальний центр клікнутого
  // слова (пікселі від краю wrapperRef) — знімок на момент кліку, слово
  // більше не рухається, доки картка відкрита. Вертикальний якір
  // (bottomPx/top/max-height/compact) навмисно НЕ зберігається тут —
  // рахується реактивно нижче (bottomAnchorPx/cardAnchorTop/cardMaxHeight)
  // з живих ResizeObserver-станів (containerHeight/overlayHeight/
  // plateHeight), а не як одноразовий знімок getBoundingClientRect() на
  // момент кліку: знімок міг зафіксувати застаріле/перехідне значення
  // (задача-виправлення "place panel above subtitles and keep it open
  // while seeking", п.A — "панель лишається приклеєною до верху").
  type OpenCard =
    | { kind: "vocab"; item: VideoVocabItem; anchorLeftPx: number | null }
    | {
        kind: "plain";
        word: string;
        contextFr: string;
        contextUk: string | null;
        teacherItem: VocabItem | null;
        anchorLeftPx: number | null;
      };
  const [openCard, setOpenCard] = useState<OpenCard | null>(null);
  // Чи зараз PlainWordPanel рендерить компактний "уже збережено" рядок —
  // саме слово цього не знає ззовні, тож компонент сам повідомляє через
  // onLayoutChange (plain-word-panel.tsx). false за замовчуванням — та
  // сама "форма" ширина/висота, доки панель(новий виклик openWordCard)
  // ще не встигла сповістити свій реальний стан (задача-виправлення
  // "compact panel in saved state").
  const [isPanelCompactSaved, setIsPanelCompactSaved] = useState(false);
  // Той самий принцип, що isPanelCompactSaved вище, але для VideoWordCard
  // (вчительське слово) — задача-виправлення "compact teacher card in
  // saved state".
  const [isTeacherCardCompactSaved, setIsTeacherCardCompactSaved] = useState(false);

  // Підказка "слова в субтитрах можна тапнути" — pause-чип (кожна пауза,
  // поки не збережено слово з відео й не показано VIDEO_WORD_HINT_MAX_SEEN
  // разів) або play-чип (лише ОДИН раз у житті, при першому відтворенні
  // цього чи будь-якого відео на сайті — ключ tdf.videoWordHint.v1
  // спільний для всіх відео). chipKind===null — чип не рендериться
  // взагалі; chipVisible — окремий прапорець для CSS fade (150мс), щоб
  // DOM-вузол лишався змонтованим ще trохи ПІСЛЯ початку fade-out
  // (інакше opacity-перехід не встигав би відпрацювати).
  const [chipKind, setChipKind] = useState<"pause" | "play" | null>(null);
  const [chipVisible, setChipVisible] = useState(false);
  const hintStateRef = useRef<VideoWordHintState | null>(null);
  const hintStateLoadedRef = useRef(false);
  const hasStartedOnceRef = useRef(false);
  const chipHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipUnmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevHasSavedAnyRef = useRef(false);

  function clearChipTimers() {
    if (chipHideTimerRef.current) clearTimeout(chipHideTimerRef.current);
    if (chipUnmountTimerRef.current) clearTimeout(chipUnmountTimerRef.current);
  }

  // queueMicrotask навколо setState — обидві функції викликаються з ефектів
  // нижче (не з event-хендлерів), react-hooks/set-state-in-effect забороняє
  // синхронний setState прямо в тілі ефекту; той самий прийом, що вже в
  // ефекті відновлення speed/mode вище.
  function hideChipNow() {
    clearChipTimers();
    queueMicrotask(() => setChipVisible(false));
    // 200мс — трохи більше за сам перехід (150мс, globals.css), щоб
    // opacity встигла дійти до 0 ДО того, як вузол зникне з DOM.
    chipUnmountTimerRef.current = setTimeout(() => setChipKind(null), 200);
  }

  function showChip(kind: "pause" | "play", durationMs: number) {
    clearChipTimers();
    queueMicrotask(() => {
      setChipKind(kind);
      setChipVisible(true);
    });
    chipHideTimerRef.current = setTimeout(() => {
      setChipVisible(false);
      chipUnmountTimerRef.current = setTimeout(() => setChipKind(null), 200);
    }, durationMs);
  }

  // SSR-safe завантаження стану підказки — лише після монтування (не в
  // ініціалізаторі useState), той самий принцип, що відновлення speed/
  // mode/pauseOnWordOpen вище. Ref (не state) — читання/запис миттєві, без
  // чекання на ререндер між швидкими play/pause.
  useEffect(() => {
    hintStateRef.current = readVideoWordHintState();
    hintStateLoadedRef.current = true;
  }, []);

  // Чип ховається одразу, щойно відкрилась картка/панель слова — студент
  // уже побачив, що слово можна тапнути, підказка стає зайвою.
  useEffect(() => {
    if (openCard) hideChipNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCard]);

  // Основна логіка показу — реагує на кожну зміну playing. hasStartedOnceRef
  // відсікає "спрацювання" цього ефекту на самому монтуванні (playing
  // стартує з false, але відео ще взагалі не починало грати — показувати
  // pause-чип тут не треба).
  useEffect(() => {
    if (!hintStateLoadedRef.current) return;
    if (playing) {
      hideChipNow();
      if (!hasStartedOnceRef.current) {
        hasStartedOnceRef.current = true;
        // hintStateRef.current === null — ключа в localStorage ще не було
        // взагалі (студент НІКОЛИ не бачив жодної підказки відео) — лише
        // тоді показуємо play-чип, і лише один раз: записуємо стан одразу,
        // щоб наступний запуск (це чи інше відео на сайті) уже бачив ключ.
        if (hintStateRef.current === null) {
          const initial: VideoWordHintState = { seen: 0, saved: false };
          hintStateRef.current = initial;
          writeVideoWordHintState(initial);
          showChip("play", 4000);
        }
      }
      return;
    }
    // Пауза. Не на самому монтуванні (ще не починало грати) і не коли
    // пауза — наслідок відкриття картки/панелі слова (openCard).
    if (!hasStartedOnceRef.current || openCard) return;
    const state = hintStateRef.current ?? { seen: 0, saved: false };
    if (state.saved || state.seen >= VIDEO_WORD_HINT_MAX_SEEN) return;
    const next: VideoWordHintState = { ...state, seen: state.seen + 1 };
    hintStateRef.current = next;
    writeVideoWordHintState(next);
    showChip("pause", state.seen === 0 ? 5000 : 3000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Збереження слова, поки відкрита картка/панель відео (openCard!==null —
  // проактивна перевірка: сама подія hasSavedAny глобальна на всю сторінку
  // (та сама SavedWordsProvider, що й скрипт), тож дивимось на неї лише в
  // момент, коли студент ТОЧНО взаємодіє з карткою САМЕ відео) — позначає
  // "з відео вже збережено" назавжди, pause-чип більше не показується,
  // незалежно від лічильника seen.
  useEffect(() => {
    const now = saved?.hasSavedAny ?? false;
    if (now && !prevHasSavedAnyRef.current && openCard && hintStateLoadedRef.current) {
      const state = hintStateRef.current ?? { seen: 0, saved: false };
      if (!state.saved) {
        const next: VideoWordHintState = { ...state, saved: true };
        hintStateRef.current = next;
        writeVideoWordHintState(next);
      }
    }
    prevHasSavedAnyRef.current = now;
  }, [saved?.hasSavedAny, openCard]);

  // chipBottomPx — завжди над УСІМ, що зараз показано знизу (панель
  // керування + плашка субтитрів, якщо є): overlayHeight уже рахує панель
  // керування, plateHeight (ResizeObserver, 0 коли плашки немає) додає
  // точну висоту плашки замість фіксованого запасу, тож чип ніколи не
  // перекриває ні панель, ні плашку, якою б довгою вона не була (1 чи 2
  // рядки). +8px — проміжок між чипом і тим, що під ним. Та сама величина
  // тепер і для bottom картки/панелі слова (roomAbovePlate/cardAnchorTop/
  // cardMaxHeight нижче) — "bottom edge = верх плашки − 8px" (задача-
  // виправлення "place panel above subtitles and keep it open while
  // seeking", п.1), повністю реактивна, без одноразового знімка на момент
  // кліку.
  const chipBottomPx = overlayHeight + (plateHeight > 0 ? plateHeight + 8 : 0) + 8;

  const frUrl = subtitles?.find((s) => s.lang === "fr")?.url ?? null;
  const ukUrl = subtitles?.find((s) => s.lang === "uk")?.url ?? null;
  const [frCues, setFrCues] = useState<WebVttCue[] | null>(null);
  const [ukCues, setUkCues] = useState<WebVttCue[] | null>(null);
  const [subtitlesLoadError, setSubtitlesLoadError] = useState(false);
  const hasFr = Boolean(frUrl);
  const hasUk = Boolean(ukUrl);
  // Той самий принцип, що speed вище: початковий режим рахується лише з
  // subtitles-пропса (той самий і на сервері, і на клієнті) — без читання
  // localStorage тут, щоб перший клієнтський рендер збігався з SSR.
  // Збережений режим застосовується після монтування в ефекті нижче.
  const [mode, setMode] = useState<SubtitlesMode>(() =>
    hasFr && hasUk ? "fr_uk" : hasFr ? "fr" : hasUk ? "uk" : "off"
  );

  const lockedCueRef = useRef<WebVttCue | null>(null);
  const lastCueRef = useRef<WebVttCue | null>(null);

  // playbackRate/preservesPitch — ЛИШЕ імперативні DOM-властивості елемента
  // <video> (жодного setState тут), виставляються щоразу, коли сам елемент
  // змонтувався чи швидкість змінилась через меню.
  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.playbackRate = speed;
    (videoRef.current as HTMLVideoElement & { preservesPitch?: boolean }).preservesPitch = true;
  }, [speed]);

  // Відновлення збережених speed/mode з localStorage — ЛИШЕ після
  // монтування (не в ініціалізаторі useState вище), щоб перший рендер на
  // клієнті збігався з SSR. setSpeed тут лише оновлює state — застосування
  // до самого <video> (playbackRate/preservesPitch) бере на себе ефект
  // вище, що й так реагує на зміну speed.
  useEffect(() => {
    // queueMicrotask — той самий прийом, що вже в save-form.tsx: без нього
    // react-hooks/set-state-in-effect проєкту забороняє прямий синхронний
    // setState() у тілі ефекту (навіть одноразового, deps: []).
    queueMicrotask(() => {
      const storedSpeed = readStoredSpeed();
      setSpeed((current) => (storedSpeed !== current ? storedSpeed : current));

      const storedMode = readStoredSubtitlesMode();
      setMode((current) => {
        if (storedMode === "fr_uk" && hasFr && hasUk) return "fr_uk";
        if (storedMode === "fr" && hasFr) return "fr";
        if (storedMode === "uk" && hasUk) return "uk";
        if (storedMode === "off") return "off";
        return current;
      });

      const storedPauseOnWordOpen = readStoredPauseOnWordOpen();
      if (storedPauseOnWordOpen !== null) {
        setPauseOnWordOpen((current) => (storedPauseOnWordOpen !== current ? storedPauseOnWordOpen : current));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    return () => {
      if (video && currentlyPlaying === video) currentlyPlaying = null;
    };
  }, []);

  // Реальна висота оверлея (ResizeObserver, не константа) — рядок кнопок
  // переноситься на вузьких екранах, фіксоване число розійшлося б із
  // фактичною висотою й або лишало зазор, або субтитри перекривались би.
  // getBoundingClientRect().height (border-box, з падінгами), НЕ
  // entries[0].contentRect.height (content-box, БЕЗ падінгів елемента) —
  // цей самий елемент має власний pt-[34px]/pb-3 падінг; contentRect
  // недораховував рівно на цю величину (~46px), "підлога" під субтитрами
  // (floor-wrapper нижче) виставляла собі на ~46px меншу висоту, ніж
  // реальний рендер панелі, і після прибирання overflow-hidden з
  // floor-wrapper (fix(video): unclip menus, 5440da0) цей "хвіст" уже не
  // ховався локально, а виступав під нижній край floor-wrapper — рівно під
  // нижній край контейнера плеєра, де його обрізав зовнішній
  // overflow-hidden рамки, ховаючи рядок кнопок.
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.target.getBoundingClientRect().height;
      if (height !== undefined) setOverlayHeight(height);
    });
    observer.observe(overlay);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.target.getBoundingClientRect();
      if (!rect) return;
      setContainerHeight(rect.height);
      setContainerWidth(rect.width);
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [wrapperRef]);

  // Завантаження й парсинг .vtt — лише коли є URL; окремо для FR/UA, провал
  // одного файлу не ламає інший чи саме відео (subtitlesLoadError — лише
  // позначка в кутку). Без гілки "URL відсутній -> setFrCues(null)" —
  // початкове значення вже null (useState вище), а subtitles-пропс
  // практично незмінний протягом життя одного відео.
  useEffect(() => {
    if (!frUrl) return;
    let cancelled = false;
    fetch(frUrl)
      .then((res) => {
        if (!res.ok) throw new Error("fr vtt");
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setFrCues(parseWebVtt(text));
      })
      .catch(() => {
        if (!cancelled) setSubtitlesLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [frUrl]);

  useEffect(() => {
    if (!ukUrl) return;
    let cancelled = false;
    fetch(ukUrl)
      .then((res) => {
        if (!res.ok) throw new Error("uk vtt");
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setUkCues(parseWebVtt(text));
      })
      .catch(() => {
        if (!cancelled) setSubtitlesLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [ukUrl]);

  function changeMode(next: SubtitlesMode) {
    setMode(next);
    setSubsOpen(false);
    try {
      localStorage.setItem("videoPlayer:subtitlesMode", next);
    } catch {
      // localStorage недоступний (приватний режим тощо) — просто без збереження.
    }
  }

  function togglePauseOnWordOpen() {
    setPauseOnWordOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem("videoPlayer:pauseOnWordOpen", String(next));
      } catch {
        // без збереження, якщо localStorage недоступний.
      }
      return next;
    });
  }

  // openCard === null у перевірці нижче — "був уже грав" запам'ятовується
  // ЛИШЕ на першому відкритті картки/панелі, не на кожному перемиканні між
  // словами (інакше друге слово побачило би відео вже на паузі від
  // першого й хибно запам'ятало б "не грало"). wakeOverlay() тут — щоб
  // панель керування лишалась видимою одночасно з карткою/панеллю слова
  // (раніше відкриття картки саме по собі не "будило" оверлей).
  function openWordCard(card: OpenCard) {
    if (pauseOnWordOpen && openCard === null) {
      const video = videoRef.current;
      if (video && !video.paused) {
        wasPlayingBeforeCardRef.current = true;
        // reason: "openWordCard" — картка/панель слова відкрилась (явний
        // клік на вчительське слово, завжди, або на звичайне слово — лише
        // коли відео реально на паузі, перевірка в handlePlainWordClick).
        pauseSafely(video);
      } else {
        wasPlayingBeforeCardRef.current = false;
      }
    }
    setOpenCard(card);
    wakeOverlay();
  }

  function closeWordCard() {
    setOpenCard(null);
    if (pauseOnWordOpen && wasPlayingBeforeCardRef.current) {
      const video = videoRef.current;
      if (video) {
        stopOthersAndRegister(video);
        void video.play();
      }
    }
    wasPlayingBeforeCardRef.current = null;
  }

  // Горизонтальний центр клікнутого слова (пікселі від лівого краю
  // wrapperRef) — одноразовий знімок на момент кліку (саме слово в тексті
  // субтитра не рухається, доки картка відкрита). Вертикальний якір більше
  // не рахується тут — bottomAnchorPx/cardAnchorTop/cardMaxHeight нижче.
  function computeAnchorLeft(wordEl: HTMLElement): number | null {
    const wrapper = wrapperRef.current;
    if (!wrapper) return null;
    const wordRect = wordEl.getBoundingClientRect();
    const wrapperRect = wrapper.getBoundingClientRect();
    return wordRect.left + wordRect.width / 2 - wrapperRect.left;
  }

  function handleWordClick(item: VideoVocabItem, e: ReactMouseEvent<HTMLButtonElement>) {
    // Найкраще припущення ДО монтування VideoWordCard (те саме, що
    // isPanelCompactSaved у handlePlainWordClick) — уникає миттєвого
    // блимання повною карткою для вже збереженого слова.
    setIsTeacherCardCompactSaved(saved?.isSaved(firstVocabVariant(item.word)) ?? false);
    openWordCard({ kind: "vocab", item, anchorLeftPx: computeAnchorLeft(e.currentTarget) });
  }

  // Той самий словник сцени/блоку, що вже в collectVideoVocab (унікальна
  // лексика по normalizeWordForMatch) — пріоритет "вчительських" даних для
  // звичайного слова: якщо студент тапнув слово, яке вчителька деінде в
  // сцені позначила як vocab, панель показує її переклад, а не форму
  // ручного вводу (той самий принцип, що teacherVariantMap у
  // dialogue-line.tsx).
  const teacherVariantMap = useMemo(() => buildVariantMap(vocab ?? []), [vocab]);

  // Репліка скрипту, що відповідає активній FR-кью — потрібна лише для
  // ТОЧНІШОГО контексту звичайного слова (ціле речення з повної репліки,
  // не з фрагмента .vtt-кью, яка може розбивати репліку не по межі
  // речення). .includes — апроксимація (кью не завжди буквально підрядок
  // репліки, якщо .vtt переносив рядки інакше); не знайдено — викликач
  // падає на текст самої кью.
  function findDialogueLineForCue(normalizedCueText: string): { text: string; translationUk?: string | null } | null {
    if (!normalizedCueText) return null;
    return dialogue.find((line) => line.text.includes(normalizedCueText)) ?? null;
  }

  function handlePlainWordClick(word: string, offsetInCue: number, e: ReactMouseEvent<HTMLButtonElement>) {
    // Задача-виправлення "stop spontaneous pauses": звичайне слово
    // ІГНОРУЄТЬСЯ, якщо відео РЕАЛЬНО (videoRef.current.paused, не React-
    // стан playing, який оновлюється на рендер пізніше за сам DOM) грає —
    // друга лінія оборони ОКРІМ CSS pointer-events:none/tabIndex=-1
    // вище: навіть якщо клік усе ж дійшов до кнопки (CSS не встигла
    // застосуватись, ghost-клік після скролу/трекпада, активація з уже
    // отриманого раніше фокусу тощо), сам хендлер відмовляється відкривати
    // картку й ставити на паузу відео, яке насправді грає без жодної
    // участі студента.
    if (videoRef.current && !videoRef.current.paused) return;
    const normalizedCue = (activeFrCue?.text ?? "").replace(/\n+/g, " ");
    const line = findDialogueLineForCue(normalizedCue);
    let contextFr: string;
    let contextUk: string | null;
    if (line) {
      const idx = line.text.indexOf(normalizedCue);
      const absoluteOffset = idx >= 0 ? idx + offsetInCue : offsetInCue;
      const result = extractAlignedContext(line.text, absoluteOffset, line.translationUk ?? null, word);
      contextFr = result.contextFr;
      contextUk = result.contextUk;
    } else {
      const result = extractAlignedContext(normalizedCue, offsetInCue, activeUkCue?.text ?? null, word);
      contextFr = result.contextFr;
      contextUk = result.contextUk;
    }
    const teacherItem = teacherVariantMap.get(normalizeWordForMatch(word)) ?? null;
    // Найкраще припущення ДО того, як сама PlainWordPanel встигне
    // змонтуватись і сповістити реальний стан через onLayoutChange —
    // уникає миттєвого "блимання" повною формою для вже збереженого
    // слова (teacherItem має пріоритет над "уже збережено" всередині
    // самого компонента, тож це лише здогад, не остаточне джерело
    // правди).
    setIsPanelCompactSaved(saved?.isSaved(word) ?? false);
    openWordCard({ kind: "plain", word, contextFr, contextUk, teacherItem, anchorLeftPx: computeAnchorLeft(e.currentTarget) });
  }

  // Закриття картки/панелі слова кліком поза нею й по Escape — той самий
  // рецепт, що вже в ефекті меню швидкості/субтитрів нижче, окремий ефект
  // (інша умова відкриття). data-vocab-trigger/data-plain-word-trigger —
  // клік на ІНШЕ слово (перемикання відкритої картки/панелі) не має
  // спершу закрити поточну цим слухачем: відкриття нового слова й так
  // замінює openCard, без проміжного null. plainPanelWrapRef — той самий
  // принцип, що wordCardRef, для плаваючої обгортки PlainWordPanel
  // (сам компонент МАЄ й власний такий слухач — для використання в
  // script-section.tsx — цей тут лише дублює для контейнера-обгортки,
  // якого PlainWordPanel не знає). overlayRef/trackRef — жодна кнопка
  // панелі керування (play/±10с/повтор/повільно/швидкість/субтитри/звук/
  // fullscreen) чи сама смуга прогресу НЕ закриває картку/панель (задача-
  // виправлення "place panel above subtitles and keep it open while
  // seeking", п.2) — студент може керувати відтворенням, не втрачаючи
  // відкрите слово.
  useEffect(() => {
    if (!openCard) return;
    function handlePointerDown(e: globalThis.PointerEvent) {
      const target = e.target as Element | null;
      if (wordCardRef.current?.contains(target)) return;
      if (plainPanelWrapRef.current?.contains(target)) return;
      if (overlayRef.current?.contains(target)) return;
      if (trackRef.current?.contains(target)) return;
      if (target?.closest?.("[data-vocab-trigger], [data-plain-word-trigger]")) return;
      closeWordCard();
    }
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") closeWordCard();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openCard]);

  const activeFrCue = frCues ? findActiveCue(frCues, currentTime) : null;
  const activeUkCue = ukCues ? findActiveCue(ukCues, currentTime) : null;
  const showFr = (mode === "fr_uk" || mode === "fr") && activeFrCue;
  const showUk = (mode === "fr_uk" || mode === "uk") && activeUkCue;

  // Репліка для "Повтор репліки" — FR за пріоритетом (якщо є), інакше UA;
  // lastCueRef запам'ятовує ОСТАННЮ активну репліку, щоб toggle увімкнений
  // між репліками (currentTime у проміжку без жодної активної) все одно
  // зафіксував щось сенсовне ("остання відтворена").
  const primaryCues = frCues ?? ukCues;
  const currentPrimaryCue = primaryCues ? findActiveCue(primaryCues, currentTime) : null;
  useEffect(() => {
    if (currentPrimaryCue) lastCueRef.current = currentPrimaryCue;
  }, [currentPrimaryCue]);

  // Картка/панель слова лишається відкритою ЛИШЕ доти, доки показана кью,
  // з якої вона відкрита, не змінилась, поки відео грає — трапляється лише
  // якщо студент вимкнув "Пауза при відкритті слова" (pauseOnWordOpen):
  // відео продовжує йти з відкритою карткою, контекст слова застаріває на
  // наступній репліці. Коли pauseOnWordOpen увімкнена (дефолт) — відео й
  // так на паузі, кью не може змінитись, цей ефект практично не
  // спрацьовує. closeWordCard читає ref'и (videoRef/wasPlayingBeforeCardRef)
  // — не можна викликати прямо в тілі рендеру (react-hooks/refs), тож тут
  // звичайний ефект; queueMicrotask — той самий прийом, що вже в ефекті
  // відновлення speed/mode вище, щоб react-hooks/set-state-in-effect не
  // забороняв синхронний setState у тілі ефекту.
  useEffect(() => {
    if (!openCard || !playing) return;
    queueMicrotask(() => closeWordCard());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPrimaryCue]);

  function toggleLoopLine() {
    setLoopLine((v) => {
      const next = !v;
      lockedCueRef.current = next ? currentPrimaryCue ?? lastCueRef.current : null;
      return next;
    });
  }

  const metadataLoaded = duration !== null && Number.isFinite(duration);

  function scheduleOverlayHide() {
    if (hideOverlayTimerRef.current) clearTimeout(hideOverlayTimerRef.current);
    hideOverlayTimerRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setOverlayVisible(false);
    }, OVERLAY_HIDE_DELAY_MS);
  }

  function wakeOverlay() {
    setOverlayVisible(true);
    scheduleOverlayHide();
  }

  // Коригування стану під час рендеру (React-рекомендований патерн — НЕ
  // useEffect, щоб уникнути react-hooks/set-state-in-effect, той самий
  // підхід, що вже в fill-blank.tsx/true-false.tsx): щойно playing стає
  // false (пауза/кінець відео), оверлей одразу показується знову, без
  // зайвого кадру очікування на ефект.
  const [prevPlaying, setPrevPlaying] = useState(playing);
  if (prevPlaying !== playing) {
    setPrevPlaying(playing);
    if (!playing) setOverlayVisible(true);
  }

  // Сам таймер прибирання оверлею — лише DOM-побічний ефект (setTimeout/
  // clearTimeout), без прямого setState у тілі ефекту (callback всередині
  // setTimeout — асинхронний, не "синхронно в тілі ефекту").
  useEffect(() => {
    if (!playing) {
      if (hideOverlayTimerRef.current) clearTimeout(hideOverlayTimerRef.current);
      return;
    }
    scheduleOverlayHide();
    return () => {
      if (hideOverlayTimerRef.current) clearTimeout(hideOverlayTimerRef.current);
    };
  }, [playing]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      stopOthersAndRegister(video);
      void video.play();
    } else {
      // reason: "togglePlay" — клік на відео/кнопку play-pause або
      // Пробіл (handleWrapperKeyDown) — завжди пряма дія студента.
      pauseSafely(video);
    }
  }

  function skip(deltaSeconds: number) {
    const video = videoRef.current;
    if (!video || !metadataLoaded) return;
    video.currentTime = Math.min(Math.max(0, video.currentTime + deltaSeconds), duration!);
    setCurrentTime(video.currentTime);
  }

  function seekToClientX(clientX: number) {
    const video = videoRef.current;
    const track = trackRef.current;
    if (!video || !track || !metadataLoaded) return;
    const rect = track.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    video.currentTime = pct * duration!;
    setCurrentTime(video.currentTime);
  }

  function handleTrackPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!metadataLoaded) return;
    // Скрабінг смуги прогресу НЕ закриває відкриту картку/панель слова —
    // слово й контекст уже зафіксовані в openCard-стані, збереження
    // лишається коректним і після перемотування (задача-виправлення
    // "place panel above subtitles and keep it open while seeking", п.2 —
    // раніше тут був closeWordCard(), прибрано навмисно).
    seekToClientX(e.clientX);
    trackRef.current?.setPointerCapture(e.pointerId);
    wakeOverlay();
  }

  function handleTrackPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!metadataLoaded || e.buttons !== 1) return;
    seekToClientX(e.clientX);
  }

  function setRate(rate: number) {
    setSpeed(rate);
    setSpeedOpen(false);
    if (videoRef.current) videoRef.current.playbackRate = rate;
    try {
      localStorage.setItem("videoPlayer:speed", String(rate));
    } catch {
      // без збереження, якщо localStorage недоступний.
    }
  }

  // Той самий ярлик, що toggleSlow у audio-pill.tsx — без
  // окремого стану, активність виводиться напряму з speed.
  function toggleSlow() {
    setRate(speed === 0.75 ? 1 : 0.75);
  }

  // Orientation lock — лише локально тут, НЕ в самому useFullscreenWrapper:
  // хук свідомо без нього (коментар у use-fullscreen-wrapper.ts — форсований
  // поворот одразу після fullscreenchange ламав iframe-плеєри Drive на
  // Android), але власний <video> цієй проблеми не має, тож пробуємо тут,
  // ігноруючи відмову (iOS Safari й десктоп її не підтримують).
  async function handleFullscreenToggle() {
    const wasFullscreen = isFullscreen || isPseudoFullscreen;
    await toggleFullscreen();
    if (!wasFullscreen) {
      try {
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })?.lock?.(
          "landscape"
        );
      } catch {
        // більшість браузерів/ОС відмовляють — ігноруємо.
      }
    }
  }

  // Закриття меню швидкості/субтитрів кліком поза ним і по Escape — той
  // самий рецепт, що вже в audio-player.tsx.
  useEffect(() => {
    if (!speedOpen && !subsOpen) return;
    function handlePointerDown(e: globalThis.PointerEvent) {
      if (speedOpen && speedWrapRef.current && !speedWrapRef.current.contains(e.target as Node)) {
        setSpeedOpen(false);
      }
      if (subsOpen && subsWrapRef.current && !subsWrapRef.current.contains(e.target as Node)) {
        setSubsOpen(false);
      }
    }
    function handleKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") {
        if (speedOpen) {
          setSpeedOpen(false);
          speedButtonRef.current?.focus();
        }
        if (subsOpen) {
          setSubsOpen(false);
          subsButtonRef.current?.focus();
        }
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [speedOpen, subsOpen]);

  // Пробіл (play/pause) і ←/→ (±5с) — слухач на всій обгортці, спрацьовує
  // незалежно від того, який саме дочірній елемент (смуга, кнопка) у
  // фокусі. isTypingTarget/data-vocab-trigger-ish closest — НЕ діємо,
  // поки фокус у текстовому полі (PlainWordPanel/VideoWordCard) чи десь
  // усередині самої картки/панелі слова (POS-чипи, кнопки Зберегти/
  // Скасувати/Прибрати/Закрити — Пробіл на фокусованій КНОПЦІ має лише
  // натиснути її, не перемикати відтворення) — задача-виправлення
  // "ignore player shortcuts while typing in word panel". isComposing —
  // IME-композиція (ще не завершений ввід) теж не чіпаємо. PlainWordPanel/
  // VideoWordCard самі ДОДАТКОВО зупиняють bubbling (stopPropagation) —
  // ця перевірка тут лише "друга лінія оборони".
  function handleWrapperKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.nativeEvent.isComposing) return;
    const target = e.target as Element | null;
    if (isTypingTarget(target)) return;
    if (target?.closest?.(".video-plain-word-panel-wrap, .video-word-card")) return;
    if (e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      togglePlay();
      wakeOverlay();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      skip(5);
      wakeOverlay();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      skip(-5);
      wakeOverlay();
    }
  }

  const progress = metadataLoaded && duration! > 0 ? currentTime / duration! : 0;
  const hasAnySubtitles = hasFr || hasUk;
  const subsLabel = mode === "fr_uk" ? "FR+UA" : mode === "fr" ? "FR" : mode === "uk" ? "UA" : t("videoPlayer.subtitlesOff");
  // Скільки вертикального місця меню (розкривається вгору) реально має
  // всередині контейнера плеєра над панеллю — контейнер плеєра (rounded,
  // overflow-hidden) інакше обрізав би довге меню зверху.
  const menuMaxHeight = containerHeight ? Math.max(120, containerHeight - overlayHeight - 16) : undefined;

  // Горизонтальне "затискання" картки/панелі слова (desktop-анкор): лишає
  // мінімум 12px (8px для компактного "уже збережено" рядка, обидва
  // kind — задача-виправлення "compact panel in saved state"/"compact
  // teacher card in saved state", п.2) до кожного краю відео, навіть коли
  // слово клікнуте біля самого краю рядка субтитрів. На мобільному
  // (<640px) CSS сам ігнорує left/transform — картка/панель стає
  // сторінкою знизу на всю ширину, тож clampedCardLeft там без ефекту.
  // Ширина: VideoWordCard (не збережене) — фіксованих 300px
  // (WORD_CARD_WIDTH), форма звичайного слова — clamp(280px, 100%-16px,
  // 420px) у CSS (.video-plain-word-panel-wrap), а БУДЬ-ЯКИЙ компактний
  // "уже збережено" рядок (обидва kind) — clamp(0, 100%-16px, 360px) (.--
  // compact-saved) — plainPanelWidth/compactSavedWidth рахують ті САМІ
  // результати у JS, інакше затискання малювалось би проти чужої ширини.
  const WORD_CARD_WIDTH = 300;
  const plainPanelWidth = Math.min(420, Math.max(280, containerWidth - 16));
  const compactSavedWidth = Math.min(360, Math.max(0, containerWidth - 16));
  const isPlainCard = openCard?.kind === "plain";
  const isCompactSavedCard = (isPlainCard && isPanelCompactSaved) || (!isPlainCard && isTeacherCardCompactSaved && Boolean(openCard));
  const cardWidth = isCompactSavedCard ? compactSavedWidth : isPlainCard ? plainPanelWidth : WORD_CARD_WIDTH;
  const cardEdgeMargin = isCompactSavedCard ? 8 : 12;
  const clampedCardLeft =
    openCard?.anchorLeftPx != null && containerWidth > 0
      ? Math.min(
          Math.max(openCard.anchorLeftPx, cardWidth / 2 + cardEdgeMargin),
          Math.max(cardWidth / 2 + cardEdgeMargin, containerWidth - cardWidth / 2 - cardEdgeMargin)
        )
      : null;
  // Вертикальний якір картки/панелі — ПОВНІСТЮ реактивний (не знімок на
  // момент кліку): bottomAnchorPx — та сама формула, що chipBottomPx вище
  // (відстань від низу контейнера до ВЕРХУ плашки субтитрів, +8px — висота
  // панелі керування вже входить в overlayHeight), рахується з живих
  // ResizeObserver-станів (containerHeight/overlayHeight/plateHeight), тож
  // реагує сама на resize/fullscreen/зміну режиму субтитрів (FR/FR+UA/
  // вимкнено — plateHeight стає 0 чи змінюється, щойно плашка зникає/
  // з'являється/міняє висоту, через attachSubtitlePlateRef). Виправляє
  // "панель лишається приклеєною до верху" (задача-виправлення "place
  // panel above subtitles and keep it open while seeking", п.A) —
  // попередній варіант брав getBoundingClientRect() ОДНОРАЗОВО в момент
  // кліку й міг зафіксувати перехідне/застаріле значення.
  const roomAbovePlate = containerHeight > 0 ? Math.max(0, containerHeight - chipBottomPx - 8) : 0;
  // Замало місця НАД плашкою (<180px — "крихітний плеєр", задача-
  // виправлення "bounded scroll area and sticky actions in word panels",
  // п.4) — якір перемикається на верх контейнера, max-height = вся висота
  // контейнера −16px. "Перевернути під плашку" (у зону контролів) свідомо
  // не рахуємо: клікабельні слова з'являються лише на паузі, а пауза
  // завжди показує повну панель керування (prevPlaying-ефект вище), тож
  // там ніколи немає вільного місця для картки — ця гілка була б мертвим
  // кодом. Коли місця ВИСТАЧАЄ — максимум 480px (та сама висота ще й
  // захищає від картки, вищої за реально потрібно, на величезному
  // 1920×1080 fullscreen).
  const cardAnchorTop = containerHeight > 0 && roomAbovePlate < 180;
  const cardMaxHeight = openCard
    ? cardAnchorTop
      ? Math.max(100, containerHeight - 16)
      : Math.min(roomAbovePlate, 480)
    : undefined;
  // Компактні відступи/розміри форми ручного перекладу (plain-word-
  // panel.tsx, проп compact) — ОДНА колонка завжди (задача-виправлення
  // "single-column plain-word panel with vertical scroll only" —
  // двоколонковий грід прибрано остаточно, compact більше НЕ перемикає
  // розкладку, лише стискає падінги/розміри полів для малого вільного
  // місця). PANEL_HEIGHT_ESTIMATE — стала оцінка природної висоти панелі
  // (слово+приклад+лейбл+інпут+чипи+кнопки), НЕ жива ResizeObserver-висота
  // самої панелі: порівнювати поточну ВИМІРЕНУ висоту з доступним місцем і
  // перемикати compact за цим результатом створило б коливання (compact
  // зменшує висоту -> знову "влізає" -> вимикає compact -> знову завелика
  // -> знову compact...). roomAbovePlate (знаменник) лишається повністю
  // реактивним — лише чисельник (форма) узятий фіксованим, бо її вміст
  // завжди один і той самий набір полів, без значної варіації висоти.
  // cardAnchorTop (матчив раніше окремий matchMedia-хук isCompactLandscape,
  // прибраний — те саме "мало місця" вже рахує roomAbovePlate) теж
  // лишається всередині того самого chip-якоря нижче.
  const PANEL_HEIGHT_ESTIMATE = 340;
  const isCompact = !cardAnchorTop && roomAbovePlate < PANEL_HEIGHT_ESTIMATE;

  if (loadError) {
    return (
      <div className={`w-full ${className}`}>
        <div
          className="flex aspect-video w-full items-center justify-center rounded-[14px] p-4 text-center"
          style={{ background: "linear-gradient(135deg, #14132b, #2b2a52)" }}
        >
          <p className="text-sm text-[#d6d3ff]">{t("videoPlayer.loadError")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex w-full flex-col gap-2 ${className}`}>
      <div
        ref={wrapperRef}
        tabIndex={-1}
        aria-label={title}
        onKeyDown={handleWrapperKeyDown}
        onPointerMove={wakeOverlay}
        onFocus={wakeOverlay}
        className={`video-player relative aspect-video w-full overflow-hidden rounded-[14px] ${
          isPseudoFullscreen ? `video-player--pseudo-fullscreen ${Z_MODAL}` : ""
        } ${playing ? "video-player--playing" : ""}`}
        style={{ background: "linear-gradient(135deg, #14132b, #2b2a52)" }}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          playsInline
          preload="metadata"
          muted={muted}
          disablePictureInPicture
          disableRemotePlayback
          className="absolute inset-0 h-full w-full object-contain"
          onClick={() => {
            togglePlay();
            wakeOverlay();
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => {
            const time = e.currentTarget.currentTime;
            setCurrentTime(time);
            if (loopLine && lockedCueRef.current && time >= lockedCueRef.current.end) {
              e.currentTarget.currentTime = lockedCueRef.current.start;
            }
          }}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onError={() => setLoadError(true)}
        />

        {/* rAF-оновлення поточного часу під час відтворення — timeupdate у
            браузерах зазвичай спрацьовує рідше (кожні ~250мс), субтитри й
            "повтор репліки" (точне "до кінця репліки") потребують точнішого
            кроку. */}
        <PlaybackTicker videoRef={videoRef} playing={playing} onTick={setCurrentTime} />

        {subtitlesLoadError && (
          <span className="font-heading absolute right-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white/90">
            {t("videoPlayer.subtitlesUnavailable")}
          </span>
        )}

        {/* Чип-підказка "слова можна тапнути" (pause/play-чип) —
            position:absolute, НЕ сиблінг у flex-колонці субтитрів нижче:
            її появу/зникнення не має зсувати ні плашку субтитрів, ні
            панель керування (вимога задачі — без layout shift).
            chipBottomPx (overlayHeight + plateHeight, обидва вимірені
            ResizeObserver) тримає її завжди НАД усім, що зараз показано
            знизу. pointer-events:none — сама підказка ніколи не блокує тап
            по слову під нею. */}
        {chipKind && (
          <div
            className={`video-word-hint-chip ${chipVisible ? "video-word-hint-chip--visible" : ""} ${
              cardAnchorTop ? "video-word-hint-chip--top" : ""
            }`}
            style={!cardAnchorTop ? { bottom: `${chipBottomPx}px` } : undefined}
            role="status"
            aria-live="polite"
          >
            {t(chipKind === "pause" ? "videoPlayer.pauseHint" : "videoPlayer.playHint")}
          </div>
        )}

        {/* Єдиний нижній стек: субтитри йдуть у потоці ПЕРЕД панеллю
            керування (document order), тож перекриття кнопками структурно
            неможливе — немає абсолютного bottom, яким субтитри могли б
            залізти під градієнт чи на кнопки. pointer-events:none на стеку
            (субтитри не мають бути клікабельні), auto — лише на самій
            панелі нижче. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex flex-col items-center">
          {Boolean(showFr && activeFrCue) || Boolean(showUk && activeUkCue) ? (
            <div
              ref={attachSubtitlePlateRef}
              className={`video-subtitle-plate mb-2 flex flex-col items-center text-center ${
                isFullscreen || isPseudoFullscreen ? "video-subtitle-plate--fullscreen" : ""
              }`}
            >
              {showFr && activeFrCue && (
                <p className="font-heading video-subtitle-fr">
                  <SubtitleFrLine
                    text={activeFrCue.text}
                    vocab={vocab ?? []}
                    playing={playing}
                    onWordClick={handleWordClick}
                    onPlainWordClick={handlePlainWordClick}
                  />
                </p>
              )}
              {showUk && activeUkCue && (
                <p className="font-heading video-subtitle-uk">{renderUkSubtitleLine(activeUkCue.text, vocab ?? [])}</p>
              )}
            </div>
          ) : null}

          {/* "Підлога" під субтитрами: висота плавно переходить між
              природною висотою панелі (вимірена ResizeObserver на самому
              вмісті нижче, не константа) і clamp(36px, 8% контейнера,
              72px), коли панель схована. "Схований" стан — лише opacity:0 +
              pointer-events:none на вмісті нижче; БЕЗ overflow-hidden тут —
              інакше меню швидкості/субтитрів (розкриваються вгору,
              position:absolute bottom-full всередині вмісту) обрізалися б
              цією ж обгорткою. */}
          <div
            className="pointer-events-auto w-full transition-[height] duration-150 ease-in-out"
            style={{
              height: overlayVisible ? (overlayHeight ? `${overlayHeight}px` : "auto") : "clamp(36px, 8%, 72px)",
            }}
          >
            <div
              ref={overlayRef}
              className="flex flex-col gap-2 pb-3 pl-[14px] pr-[14px] pt-[34px] transition-opacity duration-150 ease-in-out max-[420px]:gap-1 max-[420px]:pb-2 max-[420px]:pl-[10px] max-[420px]:pr-[10px] max-[420px]:pt-[18px]"
              style={{
                background: "linear-gradient(to top, rgba(10,9,30,0.85), transparent)",
                opacity: overlayVisible ? 1 : 0,
                pointerEvents: overlayVisible ? "auto" : "none",
              }}
            >
              {/* Рядок 1: час + смуга */}
              <div className="flex items-center gap-2">
                <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-white/90">
                  {metadataLoaded ? formatTime(currentTime) : "0:00"}
                </span>
                <div
                  ref={trackRef}
                  role="slider"
                  tabIndex={0}
                  aria-label={t("videoPlayer.seekSlider")}
                  aria-valuemin={0}
                  aria-valuemax={metadataLoaded ? Math.round(duration!) : 0}
                  aria-valuenow={Math.round(currentTime)}
                  aria-disabled={!metadataLoaded}
                  onPointerDown={handleTrackPointerDown}
                  onPointerMove={handleTrackPointerMove}
                  className={`relative h-1 flex-1 touch-none rounded-full max-[420px]:h-[3px] ${FOCUS_RING} ${
                    metadataLoaded ? "cursor-pointer" : "cursor-default opacity-60"
                  }`}
                  style={{ background: "rgba(255,255,255,0.3)" }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-white"
                    style={{ width: `${progress * 100}%` }}
                  />
                  <span
                    className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
                    style={{ left: `${progress * 100}%` }}
                  />
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-white/90">
                  {metadataLoaded ? formatTime(duration!) : "0:00"}
                </span>
              </div>

              {/* Рядок 2: зліва play/±10с/повтор, справа повільно/швидкість/
                  субтитри/mute/fullscreen. На <560px кнопки лівого кластера
                  зменшені до 32px (gap 6px), праворуч дозволений перенос у
                  другий рядок (flex-wrap), замість приховування функцій. */}
              {/* justify-between замінено на ml-auto на правому кластері:
                  коли права група не вміщається поруч із лівою й
                  переноситься на окремий рядок (flex-wrap на цьому
                  контейнері), з justify-between вона лягла б по лівому
                  краю (єдиний елемент на рядку) — ml-auto тримає її
                  праворуч завжди, і на спільному рядку, і на власному. */}
              <div className="flex flex-wrap items-center gap-2 max-[420px]:gap-1.5">
                <div className="flex items-center gap-1.5 min-[560px]:gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      togglePlay();
                      wakeOverlay();
                    }}
                    aria-label={playing ? t("videoPlayer.pause") : t("videoPlayer.play")}
                    aria-pressed={playing}
                    className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white text-[var(--play-icon)] ${FOCUS_RING}`}
                  >
                    {playing ? (
                      <Pause size={18} fill="currentColor" />
                    ) : (
                      <span className="play-icon-offset">
                        <Play size={18} fill="currentColor" />
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      skip(-10);
                      wakeOverlay();
                    }}
                    aria-label={t("videoPlayer.back10")}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white min-[560px]:h-[34px] min-[560px]:w-[34px] ${FOCUS_RING}`}
                    style={{ background: "rgba(255,255,255,0.16)" }}
                  >
                    <Rewind size={16} />
                  </button>
                  {/* Прибирається, поки відкрита картка/панель слова —
                      задача-виправлення "bounded scroll area and sticky
                      actions in word panels", п.5: округла кнопка-"скіп"
                      (⏭/+10с) не потрібна, доки студент читає/зберігає
                      слово, і не тулиться до краю картки/панелі.
                      Задача-виправлення "relocate top-centre skip button":
                      аудит показав, що це ЄДИНА така кнопка в компоненті
                      (git log -p 81f1162^..HEAD — жоден коміт не додавав
                      другої/дубльованої), і {"{!openCard}"} логічно коректна
                      (card/панель і ця кнопка читають один і той самий стан
                      в одному рендері, не можуть розійтися). Клас
                      video-control-skip-forward нижче — ЧИСТО CSS-рівень
                      "belt and braces" ПОВЕРХ цієї JS-умови (globals.css,
                      :has()): якщо скріншот показав кнопку видимою поруч
                      із відкритою карткою, це або інший екземпляр
                      VideoPlayer на тій самій сторінці (своя власна
                      openCard — коректно, не баг), або майбутній
                      регрес/гонка цього самого стану — CSS-правило
                      гарантує, що кнопка ніколи не намалюється НАД жодною
                      з двох карток САМЕ ЦЬОГО екземпляра, незалежно від
                      причини. */}
                  {!openCard && (
                    <button
                      type="button"
                      onClick={() => {
                        skip(10);
                        wakeOverlay();
                      }}
                      aria-label={t("videoPlayer.forward10")}
                      className={`video-control-skip-forward flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white min-[560px]:h-[34px] min-[560px]:w-[34px] ${FOCUS_RING}`}
                      style={{ background: "rgba(255,255,255,0.16)" }}
                    >
                      <FastForward size={16} />
                    </button>
                  )}
                  {hasAnySubtitles && (
                    <button
                      type="button"
                      onClick={() => {
                        toggleLoopLine();
                        wakeOverlay();
                      }}
                      aria-label={t("videoPlayer.repeatLine")}
                      aria-pressed={loopLine}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors min-[560px]:h-[34px] min-[560px]:w-[34px] ${FOCUS_RING} ${
                        loopLine ? "bg-white text-[#4f46e5]" : "text-white"
                      }`}
                      style={!loopLine ? { background: "rgba(255,255,255,0.16)" } : undefined}
                    >
                      <Repeat size={16} />
                    </button>
                  )}
                </div>

                <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5 min-[560px]:gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      toggleSlow();
                      wakeOverlay();
                    }}
                    aria-label={t("videoPlayer.slow")}
                    aria-pressed={speed === 0.75}
                    className={`flex h-8 shrink-0 items-center gap-1 rounded-full border border-white/40 px-2.5 text-xs font-semibold min-[560px]:h-auto min-[560px]:py-1 ${FOCUS_RING} ${
                      speed === 0.75 ? "bg-white text-[#4f46e5]" : "bg-transparent text-white"
                    }`}
                  >
                    <Turtle size={14} />
                    <span className="hidden min-[560px]:inline">{t("videoPlayer.slow")}</span>
                  </button>

                  <div ref={speedWrapRef} className="relative shrink-0">
                    <button
                      ref={speedButtonRef}
                      type="button"
                      onClick={() => {
                        setSpeedOpen((v) => !v);
                        setSubsOpen(false);
                        wakeOverlay();
                      }}
                      aria-label={t("videoPlayer.playbackSpeed", { speed })}
                      aria-haspopup="menu"
                      aria-expanded={speedOpen}
                      className={`flex h-8 items-center rounded-full border border-white/35 bg-white/10 px-2.5 text-xs font-semibold text-white min-[560px]:h-auto min-[560px]:py-1 ${FOCUS_RING}`}
                    >
                      {speed}× ▾
                    </button>
                    {speedOpen && (
                      <div
                        role="menu"
                        className="absolute bottom-full right-0 z-10 mb-1 flex flex-col overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-md dark:border-neutral-700 dark:bg-neutral-800"
                        style={{ maxHeight: menuMaxHeight }}
                      >
                        {SPEEDS.map((s) => (
                          <button
                            key={s}
                            type="button"
                            role="menuitemradio"
                            aria-checked={s === speed}
                            onClick={() => setRate(s)}
                            className={`flex min-h-10 min-w-24 items-center whitespace-nowrap px-3 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 ${
                              s === speed ? "font-semibold text-brand" : "text-neutral-600 dark:text-neutral-300"
                            }`}
                          >
                            {s}×
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {hasAnySubtitles && (
                    <div ref={subsWrapRef} className="relative shrink-0">
                      <button
                        ref={subsButtonRef}
                        type="button"
                        onClick={() => {
                          setSubsOpen((v) => !v);
                          setSpeedOpen(false);
                          wakeOverlay();
                        }}
                        aria-label={t("videoPlayer.subtitlesAria", { label: subsLabel })}
                        aria-haspopup="menu"
                        aria-expanded={subsOpen}
                        className={`flex h-8 items-center gap-1 rounded-full border border-white/35 bg-white/10 px-2.5 text-xs font-semibold text-white min-[560px]:h-auto min-[560px]:py-1 ${FOCUS_RING}`}
                      >
                        <Captions size={14} />
                        <span className="hidden min-[560px]:inline">{subsLabel}</span>
                      </button>
                      {subsOpen && (
                        <div
                          role="menu"
                          className="absolute bottom-full right-0 z-10 mb-1 flex flex-col overflow-y-auto rounded-md border border-gray-200 bg-white py-1 shadow-md dark:border-neutral-700 dark:bg-neutral-800"
                          style={{ maxHeight: menuMaxHeight }}
                        >
                          {hasFr && hasUk && (
                            <SubsMenuItem label="FR+UA" active={mode === "fr_uk"} onClick={() => changeMode("fr_uk")} />
                          )}
                          {hasFr && <SubsMenuItem label="FR" active={mode === "fr"} onClick={() => changeMode("fr")} />}
                          {hasUk && <SubsMenuItem label="UA" active={mode === "uk"} onClick={() => changeMode("uk")} />}
                          <SubsMenuItem label={t("videoPlayer.subtitlesOff")} active={mode === "off"} onClick={() => changeMode("off")} />
                          <div className="my-1 border-t border-gray-200 dark:border-neutral-700" />
                          <button
                            type="button"
                            role="menuitemcheckbox"
                            aria-checked={pauseOnWordOpen}
                            onClick={togglePauseOnWordOpen}
                            className="flex min-h-10 items-center justify-between gap-3 whitespace-nowrap px-3 text-left text-xs text-neutral-600 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-700"
                          >
                            <span>{t("videoPlayer.pauseOnWordOpen")}</span>
                            <span
                              aria-hidden
                              className={`inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                                pauseOnWordOpen ? "bg-brand" : "bg-gray-300 dark:bg-neutral-600"
                              }`}
                            >
                              <span
                                className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                                  pauseOnWordOpen ? "translate-x-4" : "translate-x-0.5"
                                }`}
                              />
                            </span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Звук регулюється апаратними кнопками на дотикових
                      пристроях — ховається там через CSS (pointer: coarse),
                      а не за шириною екрана, тож лишається доступним на
                      вузькому, але мишачому вікні. */}
                  <button
                    type="button"
                    onClick={() => {
                      setMuted((v) => !v);
                      wakeOverlay();
                    }}
                    aria-label={muted ? t("videoPlayer.unmute") : t("videoPlayer.mute")}
                    aria-pressed={muted}
                    className={`video-mute-btn flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white min-[560px]:h-[34px] min-[560px]:w-[34px] ${FOCUS_RING}`}
                    style={{ background: "rgba(255,255,255,0.16)" }}
                  >
                    {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void handleFullscreenToggle();
                      wakeOverlay();
                    }}
                    aria-label={isFullscreen || isPseudoFullscreen ? t("videoPlayer.exitFullscreen") : t("videoPlayer.fullscreen")}
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white min-[560px]:h-[34px] min-[560px]:w-[34px] ${FOCUS_RING}`}
                    style={{ background: "rgba(255,255,255,0.16)" }}
                  >
                    {isFullscreen || isPseudoFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Завжди видима кнопка-хрестик виходу (задача "always-visible
            top-left X exit button") — ВСЕРЕДИНІ wrapperRef (той самий
            елемент, що йде в :fullscreen), а не лише в панелі керування
            нижче: та панель ховається через scheduleOverlayHide під час
            відтворення (OVERLAY_HIDE_DELAY_MS), і на Android-телефоні, де
            жест "смикнути зверху" не працював, студент лишався без способу
            вийти з fullscreen. */}
        {isAnyFullscreen && (
          <FullscreenExitButton onClick={() => void exitAnyFullscreen()} label={t("videoPlayer.closeFullscreen")} />
        )}

        {/* Картка/панель слова — ВСЕРЕДИНІ wrapperRef (не portal у body),
            щоб працювала і в справжньому fullscreen, і в iOS pseudo-
            fullscreen (wrapperRef сам стає fullscreen-елементом в обох
            випадках). "vocab" (підсвічене вчителькою) — VideoWordCard, як і
            раніше; "plain" (звичайне слово субтитрів) — та сама
            PlainWordPanel, що панель звичайного слова скрипту
            (dialogue-line.tsx), лише в плаваючій позиційній обгортці
            (.video-plain-word-panel-wrap) ТА з surface="dark" — задача-
            виправлення "unify plain-word panel with teacher card on dark
            glass": обидві картки слова над відео тепер те саме темне скло
            (.video-word-card/.plain-word-panel--video, globals.css), а не
            дві різні поверхні. Скрипт (dialogue-line.tsx) не передає
            surface — лишається світлим/лавандовим, як і раніше. */}
        {openCard?.kind === "vocab" && (
          <VideoWordCard
            key={openCard.item.word}
            cardRef={wordCardRef}
            item={openCard.item}
            leftPx={clampedCardLeft}
            bottomPx={chipBottomPx}
            anchorTop={cardAnchorTop}
            maxHeight={cardMaxHeight ?? 240}
            onClose={closeWordCard}
            onCompactChange={setIsTeacherCardCompactSaved}
          />
        )}
        {openCard?.kind === "plain" && (
          <div
            ref={plainPanelWrapRef}
            className={`video-plain-word-panel-wrap${isPanelCompactSaved ? " video-plain-word-panel-wrap--compact-saved" : ""}`}
            style={{
              bottom: cardAnchorTop ? undefined : `${chipBottomPx}px`,
              top: cardAnchorTop ? "8px" : undefined,
              left: clampedCardLeft != null ? `${clampedCardLeft}px` : undefined,
              maxHeight: `${cardMaxHeight ?? 240}px`,
            }}
          >
            <PlainWordPanel
              key={openCard.word}
              word={openCard.word}
              contextFr={openCard.contextFr}
              contextUk={openCard.contextUk}
              teacherItem={openCard.teacherItem}
              inputId="video-plain-word-translation"
              onClose={closeWordCard}
              compact={isCompact}
              surface="dark"
              onLayoutChange={(mode) => setIsPanelCompactSaved(mode === "compact")}
            />
          </div>
        )}
      </div>

      {/* Та сама кнопка, що й під iframe-плеєрами (video-frame.tsx,
          embed-frame.tsx, клас "fullscreen-btn") — лише на телефоні
          (md:hidden): на планшеті/комп'ютері вистачає кнопки в самій
          панелі керування вище. Перемикає ТОЙ САМИЙ fullscreen-стан
          (handleFullscreenToggle), тож обидві кнопки синхронні. Схована під
          час fullscreen/псевдо-fullscreen — плеєр сам займає весь екран,
          і кнопка знову з'являється після виходу. Власний padded рядок
          (globals.css, .scene-fullscreen-btn-row) — кнопка лишається
          повністю всередині .glass-panel--video (page.tsx), не впритул до
          його нижнього округленого кута (панель без власного padding). */}
      {!(isFullscreen || isPseudoFullscreen) && (
        <div className="scene-fullscreen-btn-row md:hidden">
          <button type="button" onClick={() => void handleFullscreenToggle()} className="fullscreen-btn">
            <span className="glass-bar-badge" aria-hidden="true">
              <Maximize size={16} strokeWidth={2.4} />
            </span>
            {t("videoPlayer.fullscreen")}
          </button>
        </div>
      )}
    </div>
  );
}

// Картка слова (Крок 2 глосарію) — скляна плашка в тому ж стилі, що
// video-subtitle-plate, анкорена біля клікнутого слова (desktop) або
// bottom sheet на всю ширину (мобільний, <640px — сам .video-word-card
// у globals.css перевизначає left/right/transform під медіа-запитом).
// role="dialog" — єдина відкрита модальна картка, не меню/попап.
function VideoWordCard({
  item,
  leftPx,
  bottomPx,
  anchorTop,
  maxHeight,
  onClose,
  cardRef,
  onCompactChange,
}: {
  item: VideoVocabItem;
  leftPx: number | null;
  bottomPx: number;
  anchorTop: boolean;
  maxHeight: number;
  onClose: () => void;
  cardRef: React.RefObject<HTMLDivElement | null>;
  // Повідомляє VideoPlayer, чи зараз рендериться компактний "уже
  // збережено" рядок (для спільної горизонтальної clamp-математики, та
  // сама роль, що onLayoutChange у plain-word-panel.tsx) — задача-
  // виправлення "compact teacher card in saved state".
  onCompactChange?: (compact: boolean) => void;
}) {
  const { t } = useT();
  const pos = normalizePartOfSpeech(item.partOfSpeech);
  const posLabel = pos ? PART_OF_SPEECH_LABELS_FR[pos] : null;
  const posDotClass = pos ? PART_OF_SPEECH_COLORS[pos].dot : null;
  const wordKey = firstVocabVariant(item.word);
  const saved = useSavedWords();
  const isSavedWord = saved?.isSaved(wordKey) ?? false;
  const pending = saved?.isPending(wordKey) ?? false;
  // interacting/closing/таймери — той самий механізм 3с автозакриття
  // компактного стану, що plain-word-panel.tsx (задача-виправлення "saved
  // card actions row and 3s auto-close"): на відміну від PlainWordPanel
  // тут немає окремого "щойно збережено"-підтвердження — isSavedWord сама
  // й стає "persistent compact" станом, щойно слово збережено (SaveWordButton
  // у несвеженому стані нижче зберігає напряму, без власного кроку
  // підтвердження в цьому компоненті).
  const [interacting, setInteracting] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onCompactChange?.(isSavedWord);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onCompactChange з VideoPlayer стабільний лише за формою виклику, не за ідентичністю; залежність від isSavedWord навмисно єдина, що має перевикликати ефект
  }, [isSavedWord]);

  useEffect(() => {
    if (!isSavedWord || interacting) return;
    closeTimerRef.current = setTimeout(() => {
      const prefersReducedMotion =
        typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) {
        onClose();
        return;
      }
      setClosing(true);
      fadeTimerRef.current = setTimeout(onClose, 150);
    }, 3000);
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose стабільний лише за формою виклику; залежність навмисно лише isSavedWord/interacting
  }, [isSavedWord, interacting]);

  useEffect(() => {
    return () => {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, []);

  async function handleRemove() {
    await saved?.remove(wordKey);
  }

  // stopPropagation — щоб Space/←/→, натиснуті поки фокус усередині картки
  // (напр. на кнопці "×"), не спливли до onKeyDown обгортки плеєра й не
  // перемкнули play/перемотку замість дії картки. Escape лишається робочим
  // ТУТ самостійно (обгортка його теж ловить документним слухачем у
  // VideoPlayer — цей виклик лише дублює для фокусу всередині картки).
  function handleKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (e.key === "Escape") onClose();
  }

  // Слово вже збережене — компактний рядок замість повної картки (задача-
  // виправлення "compact teacher card in saved state" / "saved card
  // actions row and 3s auto-close"): рядок 1 — слово + тег частини мови +
  // пілюля "✓ У словнику"; рядок 2 — переклад (до 2 рядків, з "…");
  // ОСТАННІЙ рядок — Прибрати/Закрити РАЗОМ (.video-word-card-compact-
  // actions, не той самий клас, що рядок 1 — там flex-wrap, тут НІКОЛИ не
  // переноситься між собою). "З репліки" і фото НЕ показуємо тут —
  // лишаються лише в несвеженому стані нижче. onPointer*/onFocus/onBlur —
  // ставлять 3с-таймер автозакриття (ефект вище) на паузу.
  if (isSavedWord) {
    return (
      <div
        ref={cardRef}
        role="dialog"
        aria-label={t("videoPlayer.wordCardAria", { word: wordKey })}
        onKeyDown={handleKeyDown}
        className={`video-word-card video-word-card--compact-saved${closing ? " video-word-card--closing" : ""}`}
        style={{
          bottom: anchorTop ? undefined : `${bottomPx}px`,
          top: anchorTop ? "8px" : undefined,
          left: leftPx != null ? `${leftPx}px` : undefined,
          maxHeight: `${maxHeight}px`,
        }}
        onPointerEnter={() => setInteracting(true)}
        onPointerLeave={() => setInteracting(false)}
        onPointerDown={() => setInteracting(true)}
        onPointerUp={() => setInteracting(false)}
        onFocus={() => setInteracting(true)}
        onBlur={() => setInteracting(false)}
      >
        <div className="video-word-card-compact-row">
          <p className="video-word-card-compact-word">{wordKey}</p>
          {posLabel && posDotClass && (
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${posDotClass}`}>
              {posLabel}
            </span>
          )}
          <span className="save-word-pill save-word-pill--saved save-word-pill--saved-on-dark save-word-pill--compact">
            {t("dictionary.savedState")}
          </span>
        </div>
        {item.translation && <p className="video-word-card-compact-translation">{item.translation}</p>}
        <div className="video-word-card-compact-actions">
          <button
            type="button"
            onClick={handleRemove}
            disabled={pending}
            className="save-word-remove-link save-word-remove-link--on-dark"
          >
            {t("dictionary.removeAction")}
          </button>
          <button type="button" onClick={onClose} className="text-xs font-semibold text-white/70 underline hover:text-white">
            {t("dictionary.panelClose")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={t("videoPlayer.wordCardAria", { word: firstVocabVariant(item.word) })}
      onKeyDown={handleKeyDown}
      className="video-word-card"
      style={{
        bottom: anchorTop ? undefined : `${bottomPx}px`,
        top: anchorTop ? "8px" : undefined,
        left: leftPx != null ? `${leftPx}px` : undefined,
        maxHeight: `${maxHeight}px`,
      }}
    >
      <div className="video-word-card-header">
        <div className="flex items-start justify-between gap-2">
          <p className="font-heading pr-2 text-lg font-bold text-white">{firstVocabVariant(item.word)}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("button.closeAria")}
            className={`-m-1 shrink-0 rounded p-1 text-white/70 hover:bg-white/10 hover:text-white ${FOCUS_RING}`}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="video-word-card-scroll">
        {posLabel && posDotClass && (
          <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${posDotClass}`}>
            {posLabel}
          </span>
        )}

        <p className="mt-2 text-sm text-white/90">{item.translation}</p>

        {item.note?.trim() && <p className="mt-1 text-xs italic text-white/60">{item.note}</p>}

        {item.image_url && (
          // Невелике фото прикладу/ілюстрації слова — те саме поле, що
          // vocab-item-row.tsx (адмінський конструктор), тут лише читається.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt="" className="mt-2 h-16 w-16 rounded object-cover" />
        )}

        {item.example && (
          <div className="mt-3 border-t border-white/15 pt-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{t("videoPlayer.fromLine")}</p>
            <p className="mt-1 text-sm text-white/90">{renderHighlightedExample(item.example.text, item)}</p>
            {item.example.translationUk && <p className="mt-0.5 text-xs text-white/60">{item.example.translationUk}</p>}
          </div>
        )}
      </div>

      {/* SaveWordButton сама ховається, якщо немає SavedWordsProvider
          (сторінки матеріалів/DELF рендерять VideoPlayer поза контекстом
          сцени) — рендериться завжди в розмітці картки (а не в portal), щоб
          лишатись усередині wrapperRef і працювати й у fullscreen/iOS
          pseudo-fullscreen (коментар при useFullscreenWrapper вище). "Липкий"
          футер (video-word-card-footer, flex:0 0 auto, поза video-word-card-
          scroll) — кнопка завжди видима, навіть коли вміст вище скролить
          (задача-виправлення "bounded scroll area and sticky actions in word
          panels"). */}
      <div className="video-word-card-footer">
        <SaveWordButton
          snapshot={{
            word: firstVocabVariant(item.word),
            translation: item.translation,
            translationSource: "teacher",
            partOfSpeech: item.partOfSpeech ?? null,
            note: item.note?.trim() || null,
            imageUrl: item.image_url ?? null,
            vocabId: item.id ?? null,
            contextFr: item.example?.text ?? null,
            contextUk: item.example?.translationUk ?? null,
          } satisfies SaveWordSnapshot}
          variant="pill"
          surface="dark"
        />
      </div>
    </div>
  );
}

function SubsMenuItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={`flex min-h-10 items-center whitespace-nowrap px-3 text-left text-xs hover:bg-neutral-50 dark:hover:bg-neutral-700 ${
        active ? "font-semibold text-brand" : "text-neutral-600 dark:text-neutral-300"
      }`}
    >
      {label}
    </button>
  );
}

// requestAnimationFrame-цикл поточного часу відео під час відтворення —
// точніший крок, ніж рідкі timeupdate-події браузера, потрібен для плавних
// субтитрів і точного "до кінця репліки" в "Повторі репліки".
function PlaybackTicker({
  videoRef,
  playing,
  onTick,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  playing: boolean;
  onTick: (time: number) => void;
}) {
  useEffect(() => {
    if (!playing) return;
    let rafId: number;
    function tick() {
      if (videoRef.current) onTick(videoRef.current.currentTime);
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing, videoRef, onTick]);
  return null;
}
