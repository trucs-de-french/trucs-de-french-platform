"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Trash2, Play } from "lucide-react";
import type { KaraokeConfig, KaraokeLine } from "@/lib/exercises/types";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import { tokenizeKaraokeLine, isWordToken } from "@/lib/exercises/karaoke-tokens";
import { formatTime, parseTime, extractLeadingTimeLabel } from "@/lib/exercises/karaoke-time";
import { useYoutubePlayer } from "@/lib/youtube-player";
import { extractYoutubeId } from "@/lib/video";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";
import { BUTTON_SECONDARY_SM } from "@/lib/button-styles";

type EditableLine = KaraokeLine & { id: string; timeText: string };

function emptyLine(): EditableLine {
  return { id: crypto.randomUUID(), start: 0, tokens: [], gapTokenIndices: [], timeText: formatTime(0) };
}

function stripLine(l: EditableLine): KaraokeLine {
  return { start: l.start, tokens: l.tokens, gapTokenIndices: l.gapTokenIndices };
}

// Один рядок тексту — токени рендеряться інлайн (не flex+gap, як
// letter-gaps-fields.tsx для символів): роздільники (пробіли/пунктуація) —
// уже готові текстові вузли з власним пробілом усередині, звичайний inline-
// потік HTML розставляє їх без додаткової розмітки. Клікабельні — лише
// "словесні" токени (isWordToken), клік перемикає його в/із gapTokenIndices —
// той самий принцип toggle, що letter-gaps-fields.tsx, лише на рівні слова.
function LineTokens({
  tokens,
  gapTokenIndices,
  onToggle,
}: {
  tokens: string[];
  gapTokenIndices: number[];
  onToggle: (tokenIndex: number) => void;
}) {
  return (
    <p className="leading-8">
      {tokens.map((token, i) =>
        isWordToken(token) ? (
          <button
            key={i}
            type="button"
            onClick={() => onToggle(i)}
            title={gapTokenIndices.includes(i) ? "Показати студенту" : "Зробити пропуском"}
            className={`rounded px-0.5 font-content text-base ${
              gapTokenIndices.includes(i)
                ? "bg-amber-100 text-amber-800 underline decoration-2 dark:bg-amber-900/40 dark:text-amber-300"
                : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          >
            {token}
          </button>
        ) : (
          <span key={i} className="font-content text-base">
            {token}
          </span>
        )
      )}
    </p>
  );
}

export const KaraokeFields = forwardRef<
  TypeSwitchHandle<KaraokeConfig>,
  { initialConfig?: Partial<KaraokeConfig> }
>(function KaraokeFields({ initialConfig }, ref) {
  const [videoUrl, setVideoUrl] = useState(initialConfig?.videoUrl ?? "");
  const [pasteText, setPasteText] = useState("");
  const [lines, setLines] = useState<EditableLine[]>(
    initialConfig?.lines?.length
      ? initialConfig.lines.map((l) => ({ ...l, id: crypto.randomUUID(), timeText: formatTime(l.start) }))
      : []
  );
  const [answerMode, setAnswerMode] = useState<"choice" | "typing">(initialConfig?.answerMode ?? "typing");
  const [pauseOnGap, setPauseOnGap] = useState(initialConfig?.pauseOnGap ?? false);
  const [pointsPerGap, setPointsPerGap] = useState(initialConfig?.pointsPerGap ?? 1);

  // Прев'ю-плеєр лише для кнопки "▶" на кожному рядку (перевірити розмітку
  // часу вручну) — та сама обгортка (useYoutubePlayer), що студентський
  // компонент і майбутній режим розмітки пробілом (крок 4).
  const videoId = extractYoutubeId(videoUrl);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const player = useYoutubePlayer({ videoId, containerRef });

  useImperativeHandle(ref, () => ({
    getValue: () => ({
      instructions: initialConfig?.instructions,
      subInstructions: initialConfig?.subInstructions,
      videoUrl,
      answerMode,
      pauseOnGap,
      pointsPerGap,
      lines: lines.map(stripLine),
    }),
  }));

  // Мітка [m:ss]/[mm:ss.xx] на самому початку рядка — стає start і
  // прибирається з тексту ДО токенізації (extractLeadingTimeLabel,
  // karaoke-time.ts); рядки без мітки лишаються start=0 для ручного
  // введення, як і раніше. Рядок, що після прибирання мітки лишився
  // порожнім (сама лише мітка, без слів), пропускається — як і звичайні
  // порожні рядки.
  function splitIntoLines() {
    const newLines = pasteText
      .split("\n")
      .map((raw) => raw.trim())
      .filter((raw) => raw.length > 0)
      .map((raw) => {
        const parsed = extractLeadingTimeLabel(raw);
        return { start: parsed?.seconds ?? 0, text: (parsed?.rest ?? raw).trim() };
      })
      .filter(({ text }) => text.length > 0)
      .map(({ start, text }) => ({
        id: crypto.randomUUID(),
        start,
        tokens: tokenizeKaraokeLine(text),
        gapTokenIndices: [],
        timeText: formatTime(start),
      }));
    setLines(newLines);
  }

  // Для вже наявних рядків (у т.ч. збережених раніше), де мітка часу лишилась
  // ПРЯМО В ТОКЕНАХ (напр. створені до цієї можливості) — той самий розбір,
  // застосований до вже токенізованого тексту: рахуємо, скільки токенів
  // спереду точно відповідають довжині знайденої мітки (символ-в-символ —
  // токенізатор і регекс мітки використовують ті самі класи символів,
  // цифри/дужки/двокрапка/пробіл, тож межа завжди збігається з межею
  // токена), і прибираємо лише ЇХ — решта токенів і gapTokenIndices (зсунуті
  // на кількість прибраних) лишаються як є. Рядок без мітки на початку не
  // чіпається взагалі.
  function readTimeFromText() {
    setLines((prev) =>
      prev.map((line) => {
        const fullText = line.tokens.join("");
        const parsed = extractLeadingTimeLabel(fullText);
        if (!parsed) return line;

        const matchedLength = fullText.length - parsed.rest.length;
        let consumed = 0;
        let removedCount = 0;
        while (removedCount < line.tokens.length && consumed < matchedLength) {
          consumed += line.tokens[removedCount].length;
          removedCount += 1;
        }
        // Межа мітки не збіглась із межею токена (нетиповий сусідній
        // символ одразу після дужки) — безпечніше не чіпати рядок, ніж
        // ризикнути обрізати слово навпіл.
        if (consumed !== matchedLength) return line;

        return {
          ...line,
          start: parsed.seconds,
          timeText: formatTime(parsed.seconds),
          tokens: line.tokens.slice(removedCount),
          gapTokenIndices: line.gapTokenIndices
            .filter((i) => i >= removedCount)
            .map((i) => i - removedCount),
        };
      })
    );
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(id: string) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function toggleGap(id: string, tokenIndex: number) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const gapTokenIndices = l.gapTokenIndices.includes(tokenIndex)
          ? l.gapTokenIndices.filter((i) => i !== tokenIndex)
          : [...l.gapTokenIndices, tokenIndex].sort((a, b) => a - b);
        return { ...l, gapTokenIndices };
      })
    );
  }

  function updateTimeText(id: string, value: string) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, timeText: value } : l)));
  }

  // Комміт у start — лише на blur (не на кожен keystroke): текстовий буфер
  // timeText лишається вільним для набору "01:1" на півдорозі, не
  // перезаписується форматованим значенням, поки вчителька ще друкує.
  // Невалідний ввід відкочується назад до останнього дійсного start.
  function commitTime(id: string) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l;
        const parsed = parseTime(l.timeText);
        const start = parsed ?? l.start;
        return { ...l, start, timeText: formatTime(start) };
      })
    );
  }

  function playFrom(start: number) {
    player.seekTo(start);
    player.play();
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="karaoke_video_url" value={videoUrl} readOnly />
      <input type="hidden" name="karaoke_answer_mode" value={answerMode} readOnly />
      <input type="hidden" name="karaoke_pause_on_gap" value={pauseOnGap ? "true" : "false"} readOnly />
      <input type="hidden" name="karaoke_points_per_gap" value={pointsPerGap} readOnly />
      <input type="hidden" name="karaoke_lines" value={JSON.stringify(lines.map(stripLine))} readOnly />

      <InstructionsRichTextField
        name="karaoke_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />
      <InstructionsRichTextField
        name="karaoke_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Посилання на відео (YouTube)</label>
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className={`${INPUT_BORDER} px-2 py-2 text-sm`}
        />
        {videoUrl && !videoId && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Не вдалося розпізнати YouTube-посилання — перевірте URL.
          </p>
        )}
      </div>

      {videoId && (
        <div className="aspect-video w-full max-w-sm overflow-hidden rounded-md bg-black">
          <div ref={containerRef} className="h-full w-full" />
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Текст пісні (вставте цілком — розіб&apos;ється на рядки)</label>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={6}
          placeholder={"Рядок 1\nРядок 2\n..."}
          className={`${INPUT_BORDER} px-2 py-2 text-sm font-content`}
        />
        <button
          type="button"
          onClick={splitIntoLines}
          disabled={!pasteText.trim()}
          className={`self-start ${BUTTON_SECONDARY_SM}`}
        >
          {lines.length > 0 ? "Замінити рядки нижче текстом вище" : "Розбити на рядки"}
        </button>
        {lines.length > 0 && (
          <p className={HINT_TEXT}>
            Натискання кнопки вище ЗАМІНИТЬ усі рядки нижче (разом із часом і позначеними пропусками).
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <label className={LABEL_TEXT}>Рядки — клік по слову робить його пропуском</label>
          {lines.length > 0 && (
            <button
              type="button"
              onClick={readTimeFromText}
              title="Якщо на початку рядка лишилась мітка [m:ss] — перенести її в поле часу і прибрати з тексту"
              className={BUTTON_SECONDARY_SM}
            >
              Зчитати час із тексту
            </button>
          )}
        </div>
        {lines.map((line) => (
          <div key={line.id} className="flex flex-col gap-1 rounded-md border border-gray-100 p-2 dark:border-neutral-700">
            <div className="flex items-center gap-2">
              <input
                value={line.timeText}
                onChange={(e) => updateTimeText(line.id, e.target.value)}
                onBlur={() => commitTime(line.id)}
                placeholder="00:00.0"
                title="Час початку рядка (мм:сс.с)"
                className={`${INPUT_BORDER} w-24 px-2 py-1 text-sm`}
              />
              <button
                type="button"
                onClick={() => playFrom(line.start)}
                disabled={!videoId || !player.isReady}
                aria-label="Відтворити з цього моменту"
                title="Відтворити з цього моменту"
                className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                <Play size={16} />
              </button>
              <div className="flex-1">
                <LineTokens
                  tokens={line.tokens}
                  gapTokenIndices={line.gapTokenIndices}
                  onToggle={(i) => toggleGap(line.id, i)}
                />
              </div>
              <button
                type="button"
                onClick={() => removeLine(line.id)}
                aria-label="Видалити рядок"
                title="Видалити"
                className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addLine}
          className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
        >
          + рядок
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Режим відповіді</label>
          <div className="flex gap-1">
            {(
              [
                { mode: "typing" as const, label: "Введення з клавіатури" },
                { mode: "choice" as const, label: "Вибір варіантів" },
              ]
            ).map(({ mode, label }) => (
              <button
                key={mode}
                type="button"
                onClick={() => setAnswerMode(mode)}
                className={`rounded border px-2 py-1 text-xs ${
                  answerMode === mode
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-gray-200 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className={`flex items-center gap-1.5 ${LABEL_TEXT}`}>
          <input type="checkbox" checked={pauseOnGap} onChange={(e) => setPauseOnGap(e.target.checked)} />
          Зупиняти відео на рядку з пропуском
        </label>

        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Бали за пропуск</label>
          <input
            type="number"
            min={0}
            step={0.5}
            value={pointsPerGap}
            onChange={(e) => setPointsPerGap(Number(e.target.value) || 0)}
            className={`${INPUT_BORDER} w-20 px-2 py-1 text-sm`}
          />
        </div>
      </div>
    </div>
  );
});
