"use client";

import { useState } from "react";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import {
  CRITERIA,
  CRITERION_LABELS,
  getLevelGrid,
  type CriterionKey,
  type DelfLevel,
} from "@/lib/delf/evaluation-grids";

type EssayError = {
  original: string;
  fix: string;
  category: string;
  rule: string;
  explanation: string;
};

type EssayResult = {
  criteria: Record<CriterionKey, number>;
  errors: EssayError[];
  advice: string;
  totalScore: number;
  maxScore: number;
  anomalyFlags: string[];
};

type FormulaireFieldResult = {
  id: string;
  label: string;
  studentValue: string;
  correct: boolean;
  comment?: string;
};

type FormulaireResult = {
  fields: FormulaireFieldResult[];
  totalScore: number;
  maxScore: number;
  feedback: string;
};

type Segment = { text: string; errorIndex?: number };

function buildSegments(text: string, errors: EssayError[]): Segment[] {
  const matches: { start: number; end: number; errorIndex: number }[] = [];
  errors.forEach((error, errorIndex) => {
    if (!error.original) return;
    const start = text.indexOf(error.original);
    if (start === -1) return;
    matches.push({ start, end: start + error.original.length, errorIndex });
  });
  matches.sort((a, b) => a.start - b.start);

  const filtered: typeof matches = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  const segments: Segment[] = [];
  let cursor = 0;
  for (const m of filtered) {
    if (m.start > cursor) segments.push({ text: text.slice(cursor, m.start) });
    segments.push({ text: text.slice(m.start, m.end), errorIndex: m.errorIndex });
    cursor = m.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

function EssayResultView({ studentAnswer, result }: { studentAnswer: string; result: EssayResult }) {
  const [activeErrorIndex, setActiveErrorIndex] = useState<number | null>(null);
  const segments = buildSegments(studentAnswer, result.errors);
  const activeError = activeErrorIndex !== null ? result.errors[activeErrorIndex] : null;

  return (
    <div className="mt-3 flex flex-col gap-4">
      <div className="rounded-md border p-3 text-sm leading-relaxed whitespace-pre-wrap">
        {segments.map((seg, i) =>
          seg.errorIndex !== undefined ? (
            <mark
              key={i}
              onClick={() => setActiveErrorIndex(activeErrorIndex === seg.errorIndex ? null : seg.errorIndex!)}
              className="cursor-pointer rounded bg-amber-200/70 px-0.5 underline decoration-amber-600 decoration-wavy dark:bg-amber-900/50 dark:decoration-amber-400"
            >
              {seg.text}
            </mark>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </div>

      {activeError && (
        <div className="rounded-md bg-neutral-50 p-3 text-sm dark:bg-neutral-900">
          <p className="font-medium text-amber-700 dark:text-amber-400">{activeError.category}</p>
          <p className="mt-1">
            <span className="text-neutral-500 dark:text-neutral-400">Виправлення: </span>
            {activeError.fix}
          </p>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">{activeError.rule}</p>
          <p className="mt-1 text-neutral-600 dark:text-neutral-400">{activeError.explanation}</p>
        </div>
      )}

      <div className="flex flex-col gap-1.5 rounded-md border p-3 text-sm">
        {CRITERIA.map((key) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <span className="text-neutral-600 dark:text-neutral-400">{CRITERION_LABELS[key]}</span>
            <span className="font-medium">{result.criteria[key]}</span>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between gap-2 border-t pt-1.5 font-semibold">
          <span>Разом</span>
          <span>
            {result.totalScore} / {result.maxScore}
          </span>
        </div>
      </div>

      {result.advice && (
        <p className="text-sm text-neutral-700 dark:text-neutral-300">{result.advice}</p>
      )}
    </div>
  );
}

function FormulaireResultView({ result }: { result: FormulaireResult }) {
  return (
    <div className="mt-3 flex flex-col gap-2">
      {result.fields.map((f) => (
        <div key={f.id} className="flex flex-col gap-0.5 rounded-md border p-2 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-neutral-600 dark:text-neutral-400">{f.label}</span>
            <span className={f.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
              {f.correct ? "✓" : "✗"}
            </span>
          </div>
          {!f.correct && f.comment && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{f.comment}</p>
          )}
        </div>
      ))}
      <p className="mt-1 text-sm font-medium">
        {result.totalScore} / {result.maxScore}
      </p>
    </div>
  );
}

export function EssayCheckExercise({
  taskId,
  prompt,
  config,
}: {
  taskId: string;
  prompt?: string;
  config?: Record<string, unknown>;
}) {
  const level = ((config?.level as DelfLevel) ?? "B1") as DelfLevel;
  const exerciseNumber = config?.exerciseNumber as 1 | 2 | undefined;
  const isFormulaire = level === "A1" && exerciseNumber === 1;
  const fields = isFormulaire ? ((config?.fields as { id: string; label: string }[]) ?? []) : [];

  const [answer, setAnswer] = useState("");
  const [formAnswer, setFormAnswer] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [essayResult, setEssayResult] = useState<EssayResult | null>(null);
  const [formulaireResult, setFormulaireResult] = useState<FormulaireResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const grid = !isFormulaire ? getLevelGrid(level, exerciseNumber) : null;

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/delf/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, answer: isFormulaire ? formAnswer : answer }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Помилка перевірки");
      }

      const data = await res.json();
      if (isFormulaire) {
        setFormulaireResult(data as FormulaireResult);
      } else {
        setEssayResult(data as EssayResult);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка перевірки");
    } finally {
      setPending(false);
    }
  }

  const submitted = isFormulaire ? !!formulaireResult : !!essayResult;
  const canSubmit = isFormulaire
    ? fields.some((f) => (formAnswer[f.id] ?? "").trim())
    : !!answer.trim();

  return (
    <div>
      <p className="mb-2 font-medium">{prompt ?? DEFAULT_INSTRUCTIONS.essay_check}</p>
      {grid && (
        <p className="mb-2 text-xs text-neutral-500 dark:text-neutral-400">
          Рівень {level}
          {exerciseNumber ? ` · Ex.${exerciseNumber}` : ""} · максимум {grid.maxScore} балів
          {grid.minWords ? ` · мінімум ${grid.minWords} слів` : ""}
        </p>
      )}

      {isFormulaire ? (
        <div className="flex flex-col gap-2">
          {fields.map((f) => (
            <div key={f.id} className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500 dark:text-neutral-400">{f.label}</label>
              <input
                value={formAnswer[f.id] ?? ""}
                onChange={(e) => setFormAnswer((prev) => ({ ...prev, [f.id]: e.target.value }))}
                disabled={submitted}
                className="rounded-md border px-2 py-1.5 text-sm"
              />
            </div>
          ))}
        </div>
      ) : (
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={submitted}
          rows={8}
          className="w-full rounded-md border px-2 py-1.5 text-sm"
          placeholder="Ваша відповідь..."
        />
      )}

      {!submitted && (
        <button
          type="button"
          onClick={submit}
          disabled={pending || !canSubmit}
          className="mt-3 rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          {pending ? "Перевіряю..." : "Надіслати"}
        </button>
      )}

      {isFormulaire && formulaireResult && <FormulaireResultView result={formulaireResult} />}
      {!isFormulaire && essayResult && <EssayResultView studentAnswer={answer} result={essayResult} />}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
