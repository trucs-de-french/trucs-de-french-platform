"use client";

import { useRef, useState, type DragEvent } from "react";
import { GripVertical, Trash2, ArrowRight, ChevronDown, ChevronUp, Upload, Clipboard, Languages } from "lucide-react";
import type { VocabItem } from "@/lib/vocab";
import { FileUpload } from "@/components/file-upload";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { parseScriptFile, parseTranslationFile } from "@/lib/script-import/actions";
import { parsePastedTranscript, type ParsedLine, type TranslationCue } from "@/lib/script-import/parse";
import { matchTranslations, type TranslationMatch } from "@/lib/script-import/match-translations";
import { formatTimecode } from "@/lib/format-timecode";
import { BUTTON_SECONDARY } from "@/lib/button-styles";
import { INPUT_BORDER } from "@/lib/input-styles";
import { HINT_TEXT } from "@/lib/typography-styles";

type Line = {
  speaker: string;
  text: string;
  vocab: VocabItem[];
  start?: number | null;
  end?: number | null;
  videoLink?: string | null;
  translationUk?: string | null;
};

function parsedLineToLine(p: ParsedLine): Line {
  return { speaker: p.speaker, text: p.text, vocab: [], start: p.start, end: p.end, videoLink: null };
}

function parseNullableNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

export function DialogueEditor({ initialDialogue }: { initialDialogue: Line[] }) {
  const [lines, setLines] = useState<Line[]>(initialDialogue);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());

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

  function addLine() {
    setLines((prev) => [...prev, { speaker: "", text: "", vocab: [] }]);
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLine(i: number, field: "speaker" | "text", value: string) {
    setLines((prev) => prev.map((line, idx) => (idx === i ? { ...line, [field]: value } : line)));
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
  // індексом (swap), а не за ідентифікатором.
  function swapLines(i: number, j: number) {
    if (i === j) return;
    setLines((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function addVocab(i: number) {
    setLines((prev) =>
      prev.map((line, idx) =>
        idx === i ? { ...line, vocab: [...line.vocab, { word: "", translation: "" }] } : line
      )
    );
  }

  function removeVocab(i: number, vi: number) {
    setLines((prev) =>
      prev.map((line, idx) =>
        idx === i ? { ...line, vocab: line.vocab.filter((_, vidx) => vidx !== vi) } : line
      )
    );
  }

  function updateVocab(
    i: number,
    vi: number,
    field: "word" | "translation" | "image_url",
    value: string
  ) {
    setLines((prev) =>
      prev.map((line, idx) =>
        idx === i
          ? {
              ...line,
              vocab: line.vocab.map((v, vidx) => (vidx === vi ? { ...v, [field]: value } : v)),
            }
          : line
      )
    );
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

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name="dialogue" value={JSON.stringify(lines)} readOnly />

      {lines.map((line, i) => (
        <div
          key={i}
          onDragOver={(e: DragEvent) => e.preventDefault()}
          onDragEnter={(e: DragEvent) => {
            e.preventDefault();
            setDragOverIndex(i);
          }}
          onDragLeave={() => setDragOverIndex((prev) => (prev === i ? null : prev))}
          onDrop={(e: DragEvent) => {
            e.preventDefault();
            setDragOverIndex(null);
            const from = Number(e.dataTransfer.getData("text/plain"));
            if (!Number.isNaN(from)) swapLines(from, i);
          }}
          className={`rounded-md border p-3 transition-colors ${
            dragOverIndex === i
              ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
              : "border-gray-100 dark:border-neutral-700"
          }`}
        >
          <div className="flex items-start gap-2">
            <span
              draggable
              onDragStart={(e: DragEvent) => e.dataTransfer.setData("text/plain", String(i))}
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
            <textarea
              placeholder="Текст репліки"
              value={line.text}
              onChange={(e) => updateLine(i, "text", e.target.value)}
              rows={1}
              className={`${INPUT_BORDER} h-10 flex-1 px-2 text-sm font-content`}
            />
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
              <div key={vi} className="flex flex-col gap-1 rounded-md border border-transparent p-1">
                <div className="flex items-center gap-2">
                  <input
                    placeholder="Слово/фраза"
                    value={v.word}
                    onChange={(e) => updateVocab(i, vi, "word", e.target.value)}
                    className={`${INPUT_BORDER} w-40 px-2 py-2 text-sm font-content`}
                  />
                  <ArrowRight size={16} className="shrink-0 text-neutral-400 dark:text-neutral-500" />
                  <input
                    placeholder="Переклад"
                    value={v.translation}
                    onChange={(e) => updateVocab(i, vi, "translation", e.target.value)}
                    className={`${INPUT_BORDER} w-48 px-2 py-2 text-sm font-content`}
                  />
                  <button
                    type="button"
                    onClick={() => removeVocab(i, vi)}
                    aria-label="Видалити слово"
                    title="Видалити"
                    className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="flex items-start gap-1">
                  <div className="flex w-full max-w-md flex-col gap-1">
                    <input
                      placeholder="Посилання на картинку (необов'язково)"
                      value={v.image_url ?? ""}
                      onChange={(e) => updateVocab(i, vi, "image_url", e.target.value)}
                      className={`${INPUT_BORDER} ml-0 w-full px-2 py-2 text-xs text-neutral-600 dark:text-neutral-400`}
                    />
                    <FileUpload
                      kind="image"
                      onUploaded={(url) => updateVocab(i, vi, "image_url", url)}
                    />
                  </div>
                  <ImageOrPlaceholder
                    src={v.image_url}
                    alt="Прев'ю"
                    className="h-12 w-12 shrink-0 rounded object-cover"
                  />
                </div>
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
          {parsing ? "Розпізнаю..." : "Завантажити файл сценарію"}
        </button>
        <button
          type="button"
          onClick={() => setShowPasteBox((v) => !v)}
          className={`inline-flex items-center gap-1.5 self-start ${BUTTON_SECONDARY}`}
        >
          <Clipboard size={14} />
          Вставити транскрипт
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
          {translationParsing ? "Зіставляю..." : "Завантажити переклад (.srt/.vtt)"}
        </button>
      </div>

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
