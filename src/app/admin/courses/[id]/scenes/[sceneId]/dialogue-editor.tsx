"use client";

import { useRef, useState, type DragEvent } from "react";
import { GripVertical, Trash2, ChevronDown, ChevronUp, Upload, Clipboard, Languages, Captions } from "lucide-react";
import { parseScriptFile, parseTranslationFile } from "@/lib/script-import/actions";
import { parsePastedTranscript, type ParsedLine, type TranslationCue } from "@/lib/script-import/parse";
import { matchTranslations, type TranslationMatch } from "@/lib/script-import/match-translations";
import { importDialogueFromVideoSubtitles } from "@/lib/script-import/import-from-video-subtitles";
import { formatTimecode } from "@/lib/format-timecode";
import { BUTTON_SECONDARY } from "@/lib/button-styles";
import { INPUT_BORDER } from "@/lib/input-styles";
import { HINT_TEXT } from "@/lib/typography-styles";
import { useDialogueState, type Line } from "./dialogue-state";
import { useVideoSubtitlesUrls } from "./video-subtitles-state";
import { VocabItemRow } from "./vocab-item-row";
import { arrayMove, computeInsertIndex, resolveDropSide, type DropSide } from "@/lib/sortable-list";

// Той самий принцип зіставлення, що apostrophe/case-insensitive матчер
// вокабуляру (vocab-match.ts) — тут застосований до ЦІЛОЇ репліки: за цим
// ключем вирішуємо, чи французький текст рядка "той самий", щоб перенести
// вже розмічений вокабуляр зі старого скрипту в імпортований з субтитрів.
function normalizeLineText(text: string): string {
  return text.trim().toLowerCase().replace(/[’‘ʼ]/g, "'").replace(/\s+/g, " ");
}

function mergeKeepingVocab(oldLines: Line[], newLines: Line[]): Line[] {
  const vocabByText = new Map<string, Line["vocab"]>();
  for (const line of oldLines) {
    if (line.vocab.length === 0) continue;
    const key = normalizeLineText(line.text);
    if (!vocabByText.has(key)) vocabByText.set(key, line.vocab);
  }
  return newLines.map((line) => ({ ...line, vocab: vocabByText.get(normalizeLineText(line.text)) ?? line.vocab }));
}

function parsedLineToLine(p: ParsedLine): Line {
  return { speaker: p.speaker, text: p.text, vocab: [], start: p.start, end: p.end, videoLink: null };
}

function parseNullableNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// Клік на кнопку (mousedown) забирає фокус із textarea, але
// selectionStart/selectionEnd/value на самому DOM-елементі НЕ скидаються
// при втраті фокусу — виділення залишається читаним у onClick кнопки без
// жодних preventDefault-трюків.
function getSelectedText(textarea: HTMLTextAreaElement | null | undefined): string {
  if (!textarea) return "";
  const { selectionStart, selectionEnd, value } = textarea;
  if (selectionStart == null || selectionEnd == null || selectionStart === selectionEnd) return "";
  return value.slice(selectionStart, selectionEnd);
}

// Час початку/кінця (с) + посилання на відео — спільна підпанель, що
// перевикористовується і в основному списку (згорнута за замовчуванням,
// щоб не заважати базовому ручному вводу), і в прев'ю імпорту (розгорнута
// одразу — саме ці поля там і потребують уваги вчительки).
function OptionalFieldsPanel({
  line,
  onChange,
}: {
  line: Line;
  onChange: (field: "start" | "end" | "videoLink", value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md bg-neutral-50 p-2 dark:bg-neutral-800/50">
      <div className="flex flex-col gap-0.5">
        <label className={HINT_TEXT}>Час початку, с</label>
        <input
          type="number"
          step="0.1"
          value={line.start ?? ""}
          onChange={(e) => onChange("start", e.target.value)}
          className={`${INPUT_BORDER} h-8 w-24 px-2 text-sm`}
        />
      </div>
      <div className="flex flex-col gap-0.5">
        <label className={HINT_TEXT}>Час кінця, с</label>
        <input
          type="number"
          step="0.1"
          value={line.end ?? ""}
          onChange={(e) => onChange("end", e.target.value)}
          className={`${INPUT_BORDER} h-8 w-24 px-2 text-sm`}
        />
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <label className={HINT_TEXT}>Посилання на відео (з таймкодом)</label>
        <input
          value={line.videoLink ?? ""}
          onChange={(e) => onChange("videoLink", e.target.value)}
          placeholder="https://drive.google.com/file/d/.../view?...&t=83"
          className={`${INPUT_BORDER} h-8 px-2 text-sm`}
        />
      </div>
    </div>
  );
}

export function DialogueEditor() {
  const { lines, setLines, updateVocab } = useDialogueState();
  const videoSubs = useVideoSubtitlesUrls();
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; side: DropSide } | null>(null);
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());

  // Імпорт скрипту із субтитрів відео (FR[+UA] .vtt, URL із
  // VideoSubtitlesProvider — поточний, не обов'язково збережений). pendingVideoImport
  // ненульовий лише коли в скрипті вже були репліки — тоді потрібне явне
  // підтвердження "Замінити скрипт"/"Скасувати" (без тихого перезапису).
  const [videoImporting, setVideoImporting] = useState(false);
  const [videoImportError, setVideoImportError] = useState<string | null>(null);
  const [videoImportMessage, setVideoImportMessage] = useState<string | null>(null);
  const [pendingVideoImport, setPendingVideoImport] = useState<Line[] | null>(null);
  const [mergeSentences, setMergeSentences] = useState(true);
  // Пам'ятається в стані компонента на всю сесію редагування (не
  // localStorage — учителька зазвичай ставить ОДНЕ ім'я на всі репліки
  // одразу після імпорту, перечитувати значення між сесіями не потрібно).
  const [defaultSpeaker, setDefaultSpeaker] = useState("");

  const [preview, setPreview] = useState<Line[] | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Прев'ю зіставлення перекладу — окреме від прев'ю імпорту сценарію вище:
  // це не додавання/заміна реплік, а заповнення translationUk в УЖЕ наявних
  // рядках. translationDraft — один запис на кожну репліку сценарію (той
  // самий порядок/довжина, що lines), редагований до підтвердження.
  const [translationDraft, setTranslationDraft] = useState<TranslationMatch[] | null>(null);
  const [translationUnmatched, setTranslationUnmatched] = useState<TranslationCue[]>([]);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translationParsing, setTranslationParsing] = useState(false);
  const translationFileInputRef = useRef<HTMLInputElement>(null);

  // Доступ до textarea конкретного рядка для читання виділення мишкою —
  // ключ - індекс репліки, той самий принцип, що вже й для реплік загалом
  // (не мають власного id).
  const textRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});
  const translationRefs = useRef<Record<number, HTMLTextAreaElement | null>>({});

  function addLine() {
    setLines((prev) => [...prev, { speaker: prev[prev.length - 1]?.speaker ?? "", text: "", vocab: [] }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: "speaker" | "text" | "translationUk", value: string) {
    setLines((prev) =>
      prev.map((line, idx) =>
        idx === i ? { ...line, [field]: field === "translationUk" ? value || null : value } : line
      )
    );
  }

  function updateLineOptionalField(i: number, field: "start" | "end" | "videoLink", value: string) {
    setLines((prev) =>
      prev.map((line, idx) =>
        idx === i
          ? { ...line, [field]: field === "videoLink" ? value || null : parseNullableNumber(value) }
          : line
      )
    );
  }

  function toggleExpanded(i: number) {
    setExpandedLines((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  // Реплік не має власного id — це просто позиції в масиві, тож reorder за
  // індексом. Insert-семантика (не swap) — репліка стає рівно на місце,
  // куди її кинули, решта зсувається (arrayMove, src/lib/sortable-list.ts).
  function moveLine(from: number, to: number) {
    if (from === to) return;
    setLines((prev) => arrayMove(prev, from, to));
  }

  function addVocab(i: number) {
    // Виділення у французькому textarea цієї репліки — якщо є, стає word
    // одразу; якщо нема, точно як раніше (порожній word, вписується вручну).
    const selected = getSelectedText(textRefs.current[i]);
    setLines((prev) =>
      prev.map((line, idx) =>
        idx === i
          ? { ...line, vocab: [...line.vocab, { id: crypto.randomUUID(), word: selected, translation: "" }] }
          : line
      )
    );
  }

  // Виділення в textarea перекладу цієї репліки -> translatedForm КОНКРЕТНОГО
  // vocab-запису. Без виділення — нічого не робимо (підтверджено з учителькою,
  // без спливаючої підказки).
  function takeTranslationSelection(i: number, vi: number) {
    const selected = getSelectedText(translationRefs.current[i]);
    if (!selected) return;
    updateVocab(i, vi, "translatedForm", selected);
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setParsing(true);
    setPreviewError(null);
    const formData = new FormData();
    formData.append("file", file);
    const result = await parseScriptFile(formData);
    setParsing(false);

    if (!result.ok) {
      setPreviewError(result.error);
      return;
    }
    setPreview(result.lines.map(parsedLineToLine));
    setShowPasteBox(false);
  }

  function handleParsePaste() {
    const result = parsePastedTranscript(pasteText);
    if (!result.ok) {
      setPreviewError(result.error);
      return;
    }
    setPreviewError(null);
    setPreview(result.lines.map(parsedLineToLine));
    setShowPasteBox(false);
    setPasteText("");
  }

  async function handleImportFromVideoSubtitles() {
    if (!videoSubs?.subFr.trim()) return;

    setVideoImporting(true);
    setVideoImportError(null);
    setVideoImportMessage(null);
    const result = await importDialogueFromVideoSubtitles(videoSubs.subFr, videoSubs.subUk || null, {
      mergeSentences,
      defaultSpeaker,
    });
    setVideoImporting(false);

    if (!result.ok) {
      setVideoImportError(result.error);
      return;
    }

    const newLines: Line[] = result.lines.map((l) => ({
      speaker: l.speaker,
      text: l.text,
      vocab: [],
      translationUk: l.translationUk,
    }));

    if (lines.length > 0) {
      setPendingVideoImport(newLines);
    } else {
      setLines(newLines);
    }

    const parts = [`Імпортовано ${result.lines.length} ${result.lines.length === 1 ? "репліку" : "реплік"} (переклад: ${result.matchedCount})`];
    if (result.ukWarning) parts.push(result.ukWarning);
    setVideoImportMessage(parts.join(". "));
  }

  function confirmReplaceWithVideoImport() {
    if (!pendingVideoImport) return;
    setLines((prev) => mergeKeepingVocab(prev, pendingVideoImport));
    setPendingVideoImport(null);
  }

  function cancelVideoImport() {
    setPendingVideoImport(null);
    setVideoImportMessage(null);
  }

  function updatePreviewField(i: number, field: "speaker" | "text", value: string) {
    setPreview((prev) => (prev ? prev.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)) : prev));
  }

  function updatePreviewOptionalField(i: number, field: "start" | "end" | "videoLink", value: string) {
    setPreview((prev) =>
      prev
        ? prev.map((l, idx) =>
            idx === i
              ? { ...l, [field]: field === "videoLink" ? value || null : parseNullableNumber(value) }
              : l
          )
        : prev
    );
  }

  function removePreviewLine(i: number) {
    setPreview((prev) => (prev ? prev.filter((_, idx) => idx !== i) : prev));
  }

  function applyPreview(mode: "replace" | "append") {
    if (!preview) return;
    setLines((prev) => (mode === "replace" ? preview : [...prev, ...preview]));
    setPreview(null);
  }

  function cancelPreview() {
    setPreview(null);
    setPreviewError(null);
  }

  async function handleTranslationFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setTranslationParsing(true);
    setTranslationError(null);
    const formData = new FormData();
    formData.append("file", file);
    const result = await parseTranslationFile(formData);
    setTranslationParsing(false);

    if (!result.ok) {
      setTranslationError(result.error);
      return;
    }
    const { matches, unmatchedCues } = matchTranslations(lines, result.cues);
    setTranslationDraft(matches);
    setTranslationUnmatched(unmatchedCues);
  }

  function updateTranslationDraft(lineIndex: number, value: string) {
    setTranslationDraft((prev) =>
      prev ? prev.map((m) => (m.lineIndex === lineIndex ? { ...m, translation: value || null } : m)) : prev
    );
  }

  function applyTranslationMatches() {
    if (!translationDraft) return;
    setLines((prev) =>
      prev.map((line, idx) => {
        const match = translationDraft.find((m) => m.lineIndex === idx);
        // Немає значення для цього рядка (не має таймкоду, чи не зіставилось,
        // і вчителька не вписала вручну) — лишаємо наявний translationUk як
        // є, не затираємо його порожнім.
        if (!match || match.translation == null) return line;
        return { ...line, translationUk: match.translation };
      })
    );
    setTranslationDraft(null);
    setTranslationUnmatched([]);
  }

  function cancelTranslationPreview() {
    setTranslationDraft(null);
    setTranslationUnmatched([]);
    setTranslationError(null);
  }

  // Порожні/недописані vocab-записи (word лише з пробілів чи порожній —
  // напр. "+ слово в лексику" натиснуто, але так і не заповнено) не
  // потрапляють у збережений dialogue: такий запис ламає підсвітку в
  // рендері (порожня альтернатива regex матчить усюди — детальніше в
  // dialogue-line.tsx). Фільтрація лише ТУТ, у серіалізації для збереження
  // — не в самому lines-стані, щоб рядок не зникав із форми просто через
  // порожнє поле під час набору.
  const dialogueToSave = lines.map((line) => ({
    ...line,
    vocab: line.vocab.filter((v) => v.word.trim() !== ""),
  }));

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="dialogue" value={JSON.stringify(dialogueToSave)} readOnly />

      {lines.map((line, i) => (
        <div key={i} className="relative">
          {dropTarget?.index === i && dropTarget.side === "before" && (
            <span className="absolute -top-[5px] left-0 right-0 h-0.5 rounded-full bg-brand" aria-hidden />
          )}
          <div
            onDragOver={(e: DragEvent) => {
              e.preventDefault();
              if (draggingIndex === null) return;
              const side = resolveDropSide(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), "vertical");
              setDropTarget({ index: i, side });
            }}
            onDragLeave={() => setDropTarget((prev) => (prev?.index === i ? null : prev))}
            onDragEnd={() => {
              setDraggingIndex(null);
              setDropTarget(null);
            }}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              const from = Number(e.dataTransfer.getData("text/plain"));
              if (!Number.isNaN(from) && dropTarget) {
                moveLine(from, computeInsertIndex(from, dropTarget.index, dropTarget.side));
              }
              setDropTarget(null);
            }}
            className="rounded-md border border-gray-100 p-3 dark:border-neutral-700"
          >
          <div className="flex items-start gap-2">
            <span
              draggable
              onDragStart={(e: DragEvent) => {
                e.dataTransfer.setData("text/plain", String(i));
                setDraggingIndex(i);
              }}
              className="mt-1.5 cursor-grab select-none text-neutral-400 active:cursor-grabbing dark:text-neutral-500"
              aria-hidden
            >
              <GripVertical size={16} />
            </span>
            <input
              placeholder="Спікер"
              value={line.speaker}
              onChange={(e) => updateLine(i, "speaker", e.target.value)}
              className={`${INPUT_BORDER} h-10 w-32 bg-slate-50 px-2 text-sm dark:bg-neutral-800/50`}
            />
            <div className="flex flex-1 flex-col gap-1">
              <textarea
                ref={(el) => {
                  textRefs.current[i] = el;
                }}
                placeholder="Текст репліки"
                value={line.text}
                onChange={(e) => updateLine(i, "text", e.target.value)}
                rows={1}
                className={`${INPUT_BORDER} h-10 px-2 text-sm font-content`}
              />
              <textarea
                ref={(el) => {
                  translationRefs.current[i] = el;
                }}
                placeholder="Переклад (українською)"
                value={line.translationUk ?? ""}
                onChange={(e) => updateLine(i, "translationUk", e.target.value)}
                rows={1}
                className={`${INPUT_BORDER} h-10 px-2 text-sm font-content`}
              />
            </div>
            <button
              type="button"
              onClick={() => toggleExpanded(i)}
              aria-label={expandedLines.has(i) ? "Згорнути час/посилання" : "Час/посилання на відео"}
              title="Час/посилання на відео"
              className="mt-1.5 rounded p-1.5 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
            >
              {expandedLines.has(i) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <button
              type="button"
              onClick={() => removeLine(i)}
              aria-label="Видалити репліку"
              title="Видалити"
              className="mt-1.5 rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
            >
              <Trash2 size={16} />
            </button>
          </div>

          {expandedLines.has(i) && (
            <div className="mt-2 pl-6">
              <OptionalFieldsPanel
                line={line}
                onChange={(field, value) => updateLineOptionalField(i, field, value)}
              />
            </div>
          )}

          <div className="mt-2 flex flex-col gap-1 pl-2">
            {line.vocab.map((v, vi) => (
              <div key={v.id ?? vi} className="flex flex-col gap-1 rounded-md border border-transparent p-1">
                <VocabItemRow
                  lineIndex={i}
                  vocabIndex={vi}
                  onTakeTranslationSelection={() => takeTranslationSelection(i, vi)}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => addVocab(i)}
              className="mt-1 self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
            >
              + слово в лексику
            </button>
          </div>
          </div>
          {dropTarget?.index === i && dropTarget.side === "after" && (
            <span className="absolute -bottom-[5px] left-0 right-0 h-0.5 rounded-full bg-brand" aria-hidden />
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={addLine} className={`self-start ${BUTTON_SECONDARY}`}>
          + Репліка
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".srt,.vtt,.txt"
          onChange={handleFileSelected}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={parsing}
          className={`inline-flex items-center gap-1.5 self-start ${BUTTON_SECONDARY}`}
        >
          <Upload size={14} />
          {parsing ? "Розпізнаю..." : "Завантажити fr .srt"}
        </button>
        <input
          ref={translationFileInputRef}
          type="file"
          accept=".srt,.vtt"
          onChange={handleTranslationFileSelected}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => translationFileInputRef.current?.click()}
          disabled={translationParsing}
          className={`inline-flex items-center gap-1.5 self-start ${BUTTON_SECONDARY}`}
        >
          <Languages size={14} />
          {translationParsing ? "Зіставляю..." : "Завантажити переклад srt"}
        </button>
        <button
          type="button"
          onClick={() => setShowPasteBox((v) => !v)}
          className={`inline-flex items-center gap-1.5 self-start ${BUTTON_SECONDARY}`}
        >
          <Clipboard size={14} />
          Скрипт Google Диск
        </button>
        {videoSubs && (
          <button
            type="button"
            onClick={handleImportFromVideoSubtitles}
            disabled={videoImporting || !videoSubs.subFr.trim()}
            title={!videoSubs.subFr.trim() ? "Спочатку завантажте FR субтитри у блоці Відео" : undefined}
            className={`inline-flex items-center gap-1.5 self-start ${BUTTON_SECONDARY} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <Captions size={14} />
            {videoImporting ? "Імпортую..." : "Імпорт із субтитрів відео"}
          </button>
        )}
      </div>
      {videoSubs && !videoSubs.subFr.trim() && (
        <p className={HINT_TEXT}>Спочатку завантажте FR субтитри у блоці Відео, щоб імпортувати скрипт.</p>
      )}

      {videoSubs && (
        <div className="flex flex-wrap items-center gap-4 rounded-md bg-neutral-50 p-2 dark:bg-neutral-800/50">
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={mergeSentences}
              onChange={(e) => setMergeSentences(e.target.checked)}
            />
            Об&apos;єднувати рядки в речення
          </label>
          <div className="flex items-center gap-1.5">
            <label className={HINT_TEXT}>Мовець за замовчуванням</label>
            <input
              value={defaultSpeaker}
              onChange={(e) => setDefaultSpeaker(e.target.value.slice(0, 60))}
              placeholder="напр. Марі"
              maxLength={60}
              className={`${INPUT_BORDER} h-8 w-40 px-2 text-sm`}
            />
          </div>
        </div>
      )}

      {showPasteBox && (
        <div className="flex flex-col gap-2 rounded-md border border-gray-100 p-3 dark:border-neutral-700">
          <label className={HINT_TEXT}>
            Вставте текст із панелі &quot;Текстова версія&quot; плеєра Google Диска (кожен рядок: m:ss текст)
          </label>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={6}
            className={`${INPUT_BORDER} px-2 py-1.5 text-sm`}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleParsePaste}
              disabled={!pasteText.trim()}
              className={BUTTON_SECONDARY}
            >
              Розпізнати
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPasteBox(false);
                setPasteText("");
              }}
              className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
            >
              Скасувати
            </button>
          </div>
        </div>
      )}

      {previewError && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {previewError}
        </p>
      )}

      {preview && (
        <div className="flex flex-col gap-3 rounded-md border border-brand/30 bg-brand/5 p-3">
          <p className="text-sm font-medium">Перегляд розпізнаних реплік ({preview.length})</p>

          {preview.map((line, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-md border border-gray-100 bg-white p-2 dark:border-neutral-700 dark:bg-neutral-900">
              <div className="flex items-start gap-2">
                <input
                  placeholder="Спікер"
                  value={line.speaker}
                  onChange={(e) => updatePreviewField(i, "speaker", e.target.value)}
                  className={`${INPUT_BORDER} h-10 w-32 px-2 text-sm`}
                />
                <textarea
                  placeholder="Текст репліки"
                  value={line.text}
                  onChange={(e) => updatePreviewField(i, "text", e.target.value)}
                  rows={1}
                  className={`${INPUT_BORDER} h-10 flex-1 px-2 text-sm font-content`}
                />
                <button
                  type="button"
                  onClick={() => removePreviewLine(i)}
                  aria-label="Видалити рядок"
                  title="Видалити"
                  className="mt-1.5 rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <OptionalFieldsPanel
                line={line}
                onChange={(field, value) => updatePreviewOptionalField(i, field, value)}
              />
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            {lines.length > 0 ? (
              <>
                <button type="button" onClick={() => applyPreview("replace")} className={BUTTON_SECONDARY}>
                  Замінити наявні репліки
                </button>
                <button type="button" onClick={() => applyPreview("append")} className={BUTTON_SECONDARY}>
                  Додати до наявних
                </button>
              </>
            ) : (
              <button type="button" onClick={() => applyPreview("replace")} className={BUTTON_SECONDARY}>
                Застосувати
              </button>
            )}
            <button type="button" onClick={cancelPreview} className="text-sm text-neutral-500 hover:underline dark:text-neutral-400">
              Скасувати
            </button>
          </div>
        </div>
      )}

      {videoImportError && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {videoImportError}
        </p>
      )}

      {videoImportMessage && !pendingVideoImport && (
        <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          {videoImportMessage}
        </p>
      )}

      {pendingVideoImport && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/30">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            {videoImportMessage} У скрипті вже є {lines.length} {lines.length === 1 ? "репліка" : "реплік"}. Замінити
            його імпортованим? Позначена лексика збережеться лише в незмінених репліках (французький текст
            яких не змінився).
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={confirmReplaceWithVideoImport} className={BUTTON_SECONDARY}>
              Замінити скрипт
            </button>
            <button
              type="button"
              onClick={cancelVideoImport}
              className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
            >
              Скасувати
            </button>
          </div>
        </div>
      )}

      {translationError && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {translationError}
        </p>
      )}

      {translationDraft && (
        <div className="flex flex-col gap-3 rounded-md border border-brand/30 bg-brand/5 p-3">
          <p className="text-sm font-medium">Зіставлення перекладу</p>

          {translationDraft.map((match) => {
            const line = lines[match.lineIndex];
            if (!match.hasTimecode) {
              return (
                <div
                  key={match.lineIndex}
                  className="rounded-md border border-gray-100 bg-neutral-50 p-2 text-sm text-neutral-500 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-400"
                >
                  <span className="font-medium">{line.speaker || "—"}:</span> {line.text}
                  <span className="ml-2 italic">Без таймкоду — переклад не зіставлено</span>
                </div>
              );
            }
            return (
              <div
                key={match.lineIndex}
                className="flex flex-col gap-1 rounded-md border border-gray-100 bg-white p-2 dark:border-neutral-700 dark:bg-neutral-900"
              >
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  <span className="font-medium">{line.speaker || "—"}:</span> {line.text}
                </p>
                {match.conflict && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠ Кілька рядків перекладу претендують на цю репліку — перевірте вручну
                  </p>
                )}
                <textarea
                  value={match.translation ?? ""}
                  onChange={(e) => updateTranslationDraft(match.lineIndex, e.target.value)}
                  placeholder="Пару не знайдено — можна вписати переклад вручну"
                  rows={1}
                  className={`${INPUT_BORDER} px-2 py-1.5 text-sm`}
                />
              </div>
            );
          })}

          {translationUnmatched.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className={HINT_TEXT}>Рядки перекладу без пари ({translationUnmatched.length})</p>
              {translationUnmatched.map((cue, i) => (
                <p key={i} className="text-xs text-neutral-500 dark:text-neutral-400">
                  {formatTimecode(cue.start)}–{formatTimecode(cue.end)}: {cue.text}
                </p>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <button type="button" onClick={applyTranslationMatches} className={BUTTON_SECONDARY}>
              Застосувати
            </button>
            <button
              type="button"
              onClick={cancelTranslationPreview}
              className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
            >
              Скасувати
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
