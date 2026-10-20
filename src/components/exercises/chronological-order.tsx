"use client";

import { useState, useEffect, useMemo } from "react";
import type {
  ChronologicalOrderPublic,
  ChronologicalOrderDetail,
  ChronologicalOrderAnswer,
  GradeResult,
} from "@/lib/exercises/types";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { ImageZoomBadge } from "./image-zoom-badge";
import { ImageLightbox } from "./image-lightbox";
import { useExerciseCheck } from "./use-exercise-check";
import { usePracticeCheck } from "./use-practice-check";
import { WHOLE_TASK_ITEM_ID } from "@/lib/exercises/error-review";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { pluralizePoints } from "@/lib/pluralize-points";
import { HintBulb } from "./hint-bulb";
import { TaskInstructionLine } from "./task-panel-header";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { frenchNbspHtml } from "@/lib/text/french-typography";
import { BlockTabs } from "./block-navigation";
import {
  ANSWER_CHIP_DEFAULT,
  COMPACT_IMAGE_GRID,
  COMPACT_IMAGE_CARD,
  COMPACT_IMAGE_FRAME,
  COMPACT_IMAGE_FILL,
  ITEM_NUMBER_BADGE,
} from "./answer-card-style";
import { STUDENT_BUTTON_PRIMARY, STUDENT_BUTTON_SECONDARY_TOUCH } from "@/lib/button-styles";
import { EXERCISE_STACK } from "@/lib/spacing";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";
import { TaskResult, RowScorePill, shouldShowRowScorePill, rowResultAriaLabel } from "./task-result";
import { useCheckConfirm, CheckConfirmBar } from "./check-confirm";
import { TABLE_FILL_ANSWERS_TOGGLE_LABEL } from "@/lib/exercises/default-task-labels";
import { frenchNbsp } from "@/lib/text/french-typography";

// Режим практики "Робота над помилками" (пілот, частина 7, хвиля 3) — той
// самий принцип whole, що ReorderPracticeProps (reorder.tsx): ЦІЛЕ завдання
// як один елемент (WHOLE_TASK_ITEM_ID, error-review.ts).
export type ChronologicalOrderPracticeProps = { whole: true; failedAttempts: Record<string, number> };

// Літерні позначки (A, B, C...) тепер використовують спільний
// .item-number-badge (26px градієнтний кружок) — та сама форма, що й
// порядкові номери інших типів вправ, попри те, що тут це літера, не
// число (клас лише про форму/колір/шрифт, вміст байдужий).

// Мітка показу (A, B, C...) рахується на льоту з індексу вже перемішаного
// config.items — публічний тип свідомо не зберігає її окремо (див.
// ChronologicalOrderPublic у types.ts). Після Z переходить на AA, AB... —
// той самий принцип, що назви колонок у таблиці, про всяк випадок для
// вправ з >26 елементами (малоймовірно, але дешево покрити).
function indexToLabel(index: number): string {
  let n = index;
  let label = "";
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

// Елементи toggle-картки "Правильні відповіді", відсортовані за
// correctPosition (сервер, grade.ts) — незалежно від того, у якому порядку
// студент їх бачив/вводив. detail.content для mode:"image"/"mixed" — URL
// картинки (детейл не містить підпису item.text, тож він береться окремо з
// initialItems за id), для mode:"text" — сам текст речення/слова.
function sortedByCorrectPosition(detail: ChronologicalOrderDetail) {
  return [...detail.items].sort((a, b) => a.correctPosition - b.correctPosition);
}

export function ChronologicalOrderExercise({
  taskId,
  config,
  plaqueText,
  pointsVisible,
  onResult,
  hidePoints,
  practice,
}: {
  taskId: string;
  config: ChronologicalOrderPublic;
  plaqueText?: string;
  pointsVisible: boolean;
  onResult?: (result: GradeResult) => void;
  hidePoints?: boolean;
  practice?: ChronologicalOrderPracticeProps;
}) {
  const [positions, setPositions] = useState<Record<string, string>>({});
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const { submit, pending, result, error } = useExerciseCheck(taskId);
  const checkConfirm = useCheckConfirm();
  const answeredCount = config.items.filter((item) => positions[item.id]?.trim()).length;
  const singleDetail = result?.detail as ChronologicalOrderDetail | undefined;

  // config.items приходить із sanitizeChronologicalOrder, де shuffle()
  // недетермінований (Math.random, без seed) — кожен серверний рендер
  // сторінки (зокрема router.refresh() у use-exercise-check.ts після
  // "Перевірити") дає НОВИЙ порядок у новому config-пропі. Захоплюємо
  // показаний порядок ОДИН РАЗ при монтуванні (useState-ініціалізатор, не
  // залежить від подальших змін config) — звідти й стабільність "до
  // перевірки" (не реагує на сам re-render/resize/theme), і стабільні
  // мітки A, B, C... (indexToLabel за позицією в ЦЬОМУ захопленому масиві,
  // не в живому config.items).
  const [initialItems] = useState(() => config.items);
  const initialLabelById = useMemo(
    () => new Map(initialItems.map((item, i) => [item.id, indexToLabel(i)])),
    [initialItems]
  );
  // Підпис картинки (mode: "mixed") для alt toggle-картки "Правильні
  // відповіді" нижче — ChronologicalOrderDetail.content не містить item.text,
  // тож беремо його тут за id із захопленого initialItems.
  const initialTextById = useMemo(
    () => new Map(initialItems.map((item) => [item.id, item.text])),
    [initialItems]
  );

  // Підказка вчительки (лампочка) на все завдання — той самий принцип, що
  // word-choice.tsx (27fd820): hintShown (перманентний, іде в hintUsed) і
  // hintVisible (лише поточна видимість) розділені, щоб згортання/повторне
  // відкриття блоку ніколи не могло вдруге зняти бали. Практика нижче
  // (isPractice) ці стани взагалі не використовує — лампочка там не
  // рендериться (п.6 задачі).
  const [hintShown, setHintShown] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  function toggleHintVisible() {
    setHintShown(true);
    setHintVisible((v) => !v);
  }

  // ==== Гілка практики (whole, частина 7, хвиля 3) — ЦІЛЕ завдання як
  // один елемент (WHOLE_TASK_ITEM_ID), той самий принцип, що reorder.tsx.
  const isPractice = !!practice;
  const practiceCheck = usePracticeCheck(taskId);
  const [practiceDetail, setPracticeDetail] = useState<ChronologicalOrderDetail | undefined>(undefined);
  const [practiceCorrect, setPracticeCorrect] = useState(false);
  const [practiceFailedAttempts, setPracticeFailedAttempts] = useState<Record<string, number>>(
    practice?.failedAttempts ?? {}
  );

  const detail = isPractice ? practiceDetail : singleDetail;
  const locked = isPractice ? practiceCorrect : !!result;
  // Мітки показу для reveal-відповіді практики (practiceCheck.revealed —
  // масив id у правильному порядку, студенту зрозуміліше побачити
  // "C → A → B", ніж сирі id) — те саме захоплене initialLabelById, щоб
  // літера лишалась тією, що студент бачив на екрані.
  const labelById = initialLabelById;
  // Після перевірки елементи показуються у ПРАВИЛЬНОМУ хронологічному
  // порядку (за detail.items[].correctPosition від сервера) — літера (A,
  // B, C...) лишається прив'язаною до свого елемента (initialLabelById за
  // id, не за новою позицією), студентський номер і green/red статус
  // теж йдуть по itemId, не по позиції в масиві. До перевірки (!detail) —
  // показуємо initialItems як є, без сортування.
  const orderedItems = useMemo(() => {
    if (!detail) return initialItems;
    const correctPositionById = new Map(detail.items.map((d) => [d.id, d.correctPosition]));
    return [...initialItems].sort(
      (a, b) => (correctPositionById.get(a.id) ?? 0) - (correctPositionById.get(b.id) ?? 0)
    );
  }, [initialItems, detail]);

  useEffect(() => {
    if (!isPractice && result) onResult?.(result);
  }, [isPractice, result, onResult]);

  async function submitPractice() {
    const answer: ChronologicalOrderAnswer = {
      items: config.items.map((item) => ({
        itemId: item.id,
        position: Number(positions[item.id] ?? ""),
      })),
    };
    const r = await practiceCheck.check([WHOLE_TASK_ITEM_ID], answer);
    if (!r) return;
    const correct = r.results[0]?.correct ?? false;
    setPracticeCorrect(correct);
    setPracticeDetail(r.detail as ChronologicalOrderDetail | undefined);
    setPracticeFailedAttempts(r.failedAttempts);
    const attempts = r.failedAttempts[WHOLE_TASK_ITEM_ID] ?? 0;
    if (!correct && attempts >= 2 && !practiceCheck.revealed[WHOLE_TASK_ITEM_ID]) {
      practiceCheck.reveal(WHOLE_TASK_ITEM_ID, false);
    }
  }

  function updatePosition(itemId: string, value: string) {
    setPositions((prev) => ({ ...prev, [itemId]: value }));
  }

  function itemDetail(itemId: string) {
    return detail?.items.find((i) => i.id === itemId);
  }

  function inputClass(itemId: string) {
    const d = itemDetail(itemId);
    if (!d) return "glass-gap-shadow border-[rgba(217,183,101,0.55)] bg-white dark:bg-transparent dark:border-neutral-600";
    return d.isCorrect
      ? "border-green-500 bg-green-50 dark:bg-green-950/30"
      : "border-red-500 bg-red-50 dark:bg-red-950/30";
  }

  // Рамка+фон КАРТКИ (режим text, окрема картка на кожну фразу) після
  // перевірки — .chrono-phrase-row--correct/--incorrect (globals.css),
  // той самий зелений/червоний, що matching-card--correct/--incorrect
  // (border-green-500/bg-green-50, dark:bg-green-950/30 — рівно ті самі
  // RGBA, лише окремий клас, бо .glass-item-card (unlayered CSS) інакше
  // переміг би Tailwind-утиліту border-green-500/border-red-500 тієї ж
  // специфічності в каскаді шарів).
  function rowStateClass(itemId: string) {
    const d = itemDetail(itemId);
    if (!d) return "";
    return d.isCorrect ? "chrono-phrase-row--correct" : "chrono-phrase-row--incorrect";
  }

  // Зелена/червона рамка поля-номера (inputClass вище) лишається
  // НЕЗМІННОЮ для режиму image/mixed (compact-варіант нижче) — ця функція
  // обслуговує ЛИШЕ "line" (текстовий режим, слот праворуч картки),
  // окремо від inputClass, щоб зміна вигляду тут не торкалась image/mixed.
  function lineSlotClass(itemId: string) {
    const d = itemDetail(itemId);
    if (d) {
      return d.isCorrect
        ? "chrono-number-slot border border-green-500 bg-green-50 dark:bg-green-950/30"
        : "chrono-number-slot border border-red-500 bg-red-50 dark:bg-red-950/30";
    }
    const filled = !!positions[itemId]?.trim();
    return `chrono-number-slot ${filled ? "chrono-number-slot--filled" : "chrono-number-slot--empty"}`;
  }

  // "Marie : « ... »" — якщо текст фрази починається з мітки виступаючого
  // за цим рівно форматом (пробіл-двокрапка-пробіл-французька лапка),
  // підсвічуємо її напівжирним (п.3б задачі), без зміни самих даних
  // (config.items[].content лишається одним рядком, як і було) — текст,
  // що не відповідає формату, рендериться так само, як і раніше (plain).
  function renderPhraseText(content: string) {
    const sepIndex = content.indexOf(" : «");
    if (sepIndex === -1) return frenchNbsp(content);
    const speaker = content.slice(0, sepIndex);
    const rest = content.slice(sepIndex);
    return (
      <>
        <span className="font-heading font-extrabold">{frenchNbsp(speaker)}</span>
        {frenchNbsp(rest)}
      </>
    );
  }

  function pointsLabel(itemId: string, points: number) {
    if (hidePoints) return null;
    const d = itemDetail(itemId);
    if (!pointsVisible && !d) return null;
    if (d) {
      if (!shouldShowRowScorePill(points)) return null;
      return <RowScorePill earned={d.isCorrect ? points : 0} possible={points} full={d.isCorrect} />;
    }
    return <span className={SCORE_LABEL_CLASS}>{`${points} ${pluralizePoints(points)}`}</span>;
  }

  // Коли пілюля (RowScorePill) схована (рядок ≤1 бал), поле-номер — єдиний
  // елемент відповіді цього рядка, тож воно отримує aria-label
  // "Правильно"/"Неправильно" на додачу до власного "Номер події N" (той
  // самий принцип, що matching-board.tsx).
  function numberInputAriaLabel(itemId: string, points: number, base: string) {
    const d = itemDetail(itemId);
    if (!d || shouldShowRowScorePill(points)) return base;
    return `${base}: ${rowResultAriaLabel(d.isCorrect)}`;
  }

  function handleSubmit() {
    const answer: ChronologicalOrderAnswer = {
      items: config.items.map((item) => ({
        itemId: item.id,
        position: Number(positions[item.id] ?? ""),
      })),
      hintUsed: hintShown,
    };
    submit(answer);
  }

  function numberInput(
    itemId: string,
    variant: "wide" | "square" | "compact" | "line" = "wide",
    label?: string,
    points: number = 1,
  ) {
    // "line" — слот-картка режиму text (мокап задачі): 56x56 на десктопі,
    // 48x48 на мобільному, порожній/заповнений вигляд через
    // lineSlotClass — повністю ОКРЕМИЙ від "compact" (image/mixed), той
    // не зачіпається.
    if (variant === "line") {
      return (
        <input
          type="number"
          min={1}
          max={config.items.length}
          value={positions[itemId] ?? ""}
          onChange={(e) => updatePosition(itemId, e.target.value)}
          disabled={locked}
          placeholder="№"
          aria-label={numberInputAriaLabel(itemId, points, label ? `Номер події ${label}` : "Номер події")}
          className={lineSlotClass(itemId)}
        />
      );
    }
    // "compact" — лише щільна сітка image/mixed (НЕ торкається режиму text
    // вище): h-10 (40px) за замовчуванням покриває і дотик, і вузький
    // екран; sm:pointer-fine:h-8 (32px) звужує лише на реальному десктопі
    // з мишкою (sm+ ширина ТА pointer:fine) — на touch-екрані будь-якої
    // ширини лишається 40px. text-base (16px) завжди, щоб Safari не зумив
    // сторінку при фокусі на дотику (вимагає ≥16px), на десктопі це теж
    // ≥14px з запасом.
    if (variant === "compact") {
      return (
        <input
          type="number"
          min={1}
          max={config.items.length}
          value={positions[itemId] ?? ""}
          onChange={(e) => updatePosition(itemId, e.target.value)}
          disabled={locked}
          placeholder="№"
          aria-label={numberInputAriaLabel(itemId, points, label ? `Номер події ${label}` : "Номер події")}
          className={`h-10 w-12 rounded border text-center text-base sm:pointer-fine:h-8 ${inputClass(itemId)}`}
        />
      );
    }
    const sizeClass = variant === "square" ? "h-11 w-11 px-1 text-center" : "w-16 px-2";
    return (
      <input
        type="number"
        min={1}
        max={config.items.length}
        value={positions[itemId] ?? ""}
        onChange={(e) => updatePosition(itemId, e.target.value)}
        disabled={locked}
        placeholder="№"
        className={`${sizeClass} rounded border py-1 text-sm ${inputClass(itemId)}`}
      />
    );
  }

  // Текст-підказка нумерації (дизайн B, задача M) — для image/mixed поле
  // підписане "n°" (рядок 358 нижче), для text такого підпису біля поля
  // нема (audit: лише буква-бейдж + текст + поле), тож формулювання інше.
  const numberingNoteText =
    config.mode === "text"
      ? `Впишіть номер за порядком (від 1 до ${config.items.length}) біля кожного пункту.`
      : `Впишіть у поле n° номер за порядком (від 1 до ${config.items.length}).`;

  return (
    <div className={EXERCISE_STACK}>
      <BlockTabs plaqueText={plaqueText} />
      <div className="task-panel-header">
        {/* flex items-start — лампочка притиснута до верху, не по центру
            (можливо багаторядкового) блоку інструкції, той самий принцип
            flex-sibling, що word-choice.tsx (27fd820) — лампочка ніколи не
            бере участі в перенесенні тексту інструкції, не збільшує висоту
            першого рядка. Практика (isPractice) лампочку не показує взагалі
            (п.6 задачі) — умова `!isPractice && config.hint` нижче явно
            враховує це. */}
        <div className="flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <TaskInstructionLine
              fr={frenchNbspHtml(
                sanitizeInstructionsHtml(config.instructions ?? DEFAULT_INSTRUCTIONS.chronological_order.instruction)
              )}
              uk={frenchNbspHtml(
                sanitizeInstructionsHtml(
                  config.subInstructions ?? DEFAULT_INSTRUCTIONS.chronological_order.subInstruction
                )
              )}
            />
          </div>
          {!isPractice && config.hint && (
            <HintBulb
              state={hintShown ? "used" : "available"}
              onClick={toggleHintVisible}
              label="Підказка до всього завдання"
              ariaExpanded={hintVisible}
              className="mt-0.5 shrink-0"
            />
          )}
        </div>
        {!isPractice && config.hint && hintVisible && (
          <div role="status" aria-live="polite" className="word-choice-hint-chip">
            <HintBulb state="available" as="span" />
            <span className="word-choice-hint-chip-text">{config.hint}</span>
          </div>
        )}
        <p className="chrono-order-note">
          <span className="chrono-order-note-badge" aria-hidden="true">
            n°
          </span>
          {numberingNoteText}
        </p>
        {config.mode === "text" ? (
          // Рядок прогресу (п.2 задачі) — лише режим text: пілюля
          // "Заповнено X з N" (X = answeredCount, те саме, що й кнопка
          // "Перевірити" нижче вже рахує) + смужка-бар, той самий gradient
          // #5a55e6→#3b36c4, що й .chrono-order-note-badge/.item-number-
          // badge вище (не новий колір). Власна нижня лінія замінює
          // task-panel-header-divider для цього режиму (п.2: "Thin hairline
          // below" — рівно під цим рядком, не над ним вдруге).
          <div className="chrono-progress-row">
            <span className="chrono-progress-pill">
              Заповнено {answeredCount} з {config.items.length}
            </span>
            <div
              className="chrono-progress-track"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={config.items.length}
              aria-valuenow={answeredCount}
              aria-label="Заповнено пунктів"
            >
              <div
                className="chrono-progress-fill"
                style={{ width: `${config.items.length > 0 ? (answeredCount / config.items.length) * 100 : 0}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="task-panel-header-divider" data-header-divider="" />
        )}
      </div>

      {config.mode === "image" || config.mode === "mixed" ? (
        // Щільна сітка: 3/4/5 колонок за брейкпоінтами, gap-2 — щоб 10+
        // картинок вміщались на екран майже без прокрутки (попередня
        // версія — 2/3 колонки з великим квадратом (до 12rem) — і 10
        // елементів розтягувались на кілька екранів прокрутки).
        <div className={COMPACT_IMAGE_GRID}>
          {orderedItems.map((item) => {
            const label = initialLabelById.get(item.id) ?? "";
            return (
              <div
                key={item.id}
                className={`${COMPACT_IMAGE_CARD} ${ANSWER_CHIP_DEFAULT}`}
              >
                {/* overflow-hidden + img absolute inset-0 — <img> більше не
                    задає власну висоту через проценти (h-full проти
                    батька, чия висота похідна від aspect-square, давало
                    нестабільний розрахунок і картинка "наповзала" на
                    рядок номера нижче). inset-0 завжди прилягає рівно до
                    країв найближчого position:relative предка — без
                    відсоткового розв'язання, тому немає залежності від
                    self-stretch (видалено — він нічого корисного не
                    додавав: width тут і так "100%", не "auto", align-self
                    на явний відсоток не впливає, а в парі з aspect-square
                    саме він і провокував непослідовний розрахунок хіпотетичного
                    cross-size ДО застосування max-width, звідки квадрат
                    ~208px замість затиснутого max-w-[6.5rem]=104px). */}
                <div className={COMPACT_IMAGE_FRAME}>
                  <ImageOrPlaceholder
                    src={item.content}
                    alt=""
                    className={COMPACT_IMAGE_FILL}
                    useFocus
                  />
                  <span
                    className="item-number-badge image-match-card-badge z-10"
                    aria-label={`Картка ${label}`}
                  >
                    {label}
                  </span>
                  {/* boxClass без "relative": span уже absolute (своя база
                      класів компонента) — зайвий "relative" поруч з
                      "absolute" в ОДНОМУ className — та сама CSS-властивість
                      position двічі, переміг "relative" (пізніший у
                      згенерованому Tailwind-шарі) і кнопка стала звичайним
                      "relative" (в потоці) flex-блоком, який авто-розтягся
                      на всю ширину батька — звідси суцільна смуга; w-6/h-6
                      тепер явно, без purge-залежного p-1+iconSize підбору. */}
                  <ImageZoomBadge
                    onOpen={() => setLightboxSrc(item.content)}
                    boxClass="h-6 w-6 before:absolute before:-inset-2 before:content-['']"
                    iconSize={12}
                  />
                </div>
                {config.mode === "mixed" && (
                  <p className="line-clamp-2 text-center text-xs font-medium" title={item.text}>
                    {frenchNbsp(item.text)}
                  </p>
                )}
                <div className="mt-1.5 flex items-center justify-center gap-1.5">
                  <span className="text-xs text-neutral-500 dark:text-neutral-400">n°</span>
                  {numberInput(item.id, "compact", label, item.points)}
                </div>
                {!hidePoints && (pointsVisible || (itemDetail(item.id) && shouldShowRowScorePill(item.points))) ? (
                  <p className="flex justify-center">{pointsLabel(item.id, item.points)}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        // Компактні рядки: ОДИН контейнер-картка (рамка/тло/закруглення —
        // те саме ANSWER_CARD_DEFAULT, що й раніше на кожній картці
        // окремо), рядки всередині — без власних карток, розділені тонкою
        // лінією (divide-y з явним кольором рамки — не border/currentColor,
        // щоб уникнути відомого Tailwind v4 бага). Висота рядка — за
        // вмістом (py-2 px-2.5, без фіксованої min-height), тож довге
        // (дворядкове) речення просто займає трохи більше місця, а не
        // обрізається.
        <div className="flex flex-col gap-2.5">
          {orderedItems.map((item) => {
            const label = initialLabelById.get(item.id) ?? "";
            return (
              <div
                key={item.id}
                className={`chrono-phrase-row glass-item-card transition-colors ${rowStateClass(item.id)}`}
              >
                <span className="item-number-badge" aria-label={`Картка ${label}`}>
                  {label}
                </span>
                <span className="min-w-0 flex-1 break-words text-left text-base leading-snug [overflow-wrap:anywhere]">
                  {renderPhraseText(item.content)}
                </span>
                {numberInput(item.id, "line", label, item.points)}
                {!hidePoints && (pointsVisible || (itemDetail(item.id) && shouldShowRowScorePill(item.points))) && (
                  <span className="flex-none">{pointsLabel(item.id, item.points)}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isPractice ? (
        <div className="flex flex-col gap-2">
          {!practiceCorrect && (
            <button
              type="button"
              onClick={submitPractice}
              disabled={practiceCheck.pending}
              className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
            >
              {practiceCheck.pending ? "Перевіряю..." : "Перевірити"}
            </button>
          )}
          {practiceCorrect && (
            <p className={`${RESULT_MESSAGE_CLASS} text-green-600 dark:text-green-400`}>Правильно! ✓</p>
          )}
          {practiceDetail && !practiceCorrect && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-red-600 dark:text-red-400">
                Неправильно, спробуйте ще раз (спроб: {practiceFailedAttempts[WHOLE_TASK_ITEM_ID] ?? 0})
              </span>
              {!practiceCheck.revealed[WHOLE_TASK_ITEM_ID] && (
                <button
                  type="button"
                  onClick={() => practiceCheck.reveal(WHOLE_TASK_ITEM_ID, true)}
                  disabled={!!practiceCheck.revealPending[WHOLE_TASK_ITEM_ID]}
                  className={STUDENT_BUTTON_SECONDARY_TOUCH}
                >
                  Показати відповідь
                </button>
              )}
            </div>
          )}
          {practiceCheck.revealed[WHOLE_TASK_ITEM_ID] && (
            <p className="text-sm italic text-amber-700 dark:text-amber-400">
              Правильний порядок:{" "}
              {practiceCheck.revealed[WHOLE_TASK_ITEM_ID]
                .map((id) => labelById.get(id) ?? id)
                .join(" → ")}
            </p>
          )}
          {practiceCheck.error && <p className="text-sm text-red-600 dark:text-red-400">{practiceCheck.error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {!result ? (
            <div className="flex flex-col items-start gap-2">
              <button
                type="button"
                onClick={() =>
                  checkConfirm.attemptCheck(config.items.length - answeredCount, handleSubmit)
                }
                disabled={pending || answeredCount === 0}
                className={`self-start ${STUDENT_BUTTON_PRIMARY}`}
              >
                {pending ? "Перевіряю..." : "Перевірити"}
              </button>
              {checkConfirm.confirming && (
                <CheckConfirmBar
                  unansweredCount={config.items.length - answeredCount}
                  onConfirm={() => checkConfirm.confirmCheck(handleSubmit)}
                  onCancel={checkConfirm.cancelCheck}
                />
              )}
            </div>
          ) : (
            <TaskResult
              correct={result.correct}
              pointsEarned={result.pointsEarned}
              pointsPossible={result.pointsPossible}
              toggleTitle={TABLE_FILL_ANSWERS_TOGGLE_LABEL}
              toggleCount={detail ? 1 : undefined}
              hintSummary={
                detail?.hintUsed ? { hintCount: "task", reducesPoints: config.hintsReducePoints } : undefined
              }
            >
              {detail && config.mode === "text" && (
                <div className={`divide-y divide-gray-100 overflow-hidden rounded-xl border dark:divide-neutral-700 ${ANSWER_CHIP_DEFAULT}`}>
                  {sortedByCorrectPosition(detail).map((it) => (
                    <div key={it.id} className="flex items-start gap-2.5 px-2.5 py-2">
                      <span className={ITEM_NUMBER_BADGE} aria-hidden="true">
                        {it.correctPosition}
                      </span>
                      <span className="min-w-0 flex-1 break-words text-left leading-snug [overflow-wrap:anywhere]">
                        {frenchNbsp(it.content)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {detail && config.mode !== "text" && (
                <div className={COMPACT_IMAGE_GRID}>
                  {sortedByCorrectPosition(detail).map((it) => {
                    const label = initialLabelById.get(it.id) ?? "";
                    const caption = initialTextById.get(it.id);
                    const alt = caption
                      ? frenchNbsp(caption)
                      : `Картка ${label}, позиція ${it.correctPosition}`;
                    return (
                      <div key={it.id} className={`${COMPACT_IMAGE_CARD} ${ANSWER_CHIP_DEFAULT}`}>
                        <div className={COMPACT_IMAGE_FRAME}>
                          <ImageOrPlaceholder src={it.content} alt={alt} className={COMPACT_IMAGE_FILL} useFocus />
                          <span className={`absolute left-1 top-1 z-10 ${ITEM_NUMBER_BADGE}`} aria-hidden="true">
                            {it.correctPosition}
                          </span>
                        </div>
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </TaskResult>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}

      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
    </div>
  );
}
