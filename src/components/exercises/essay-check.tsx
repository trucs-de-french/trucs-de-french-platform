"use client";

import { useState } from "react";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";

type DelfCheckResult = {
  correct: boolean;
  feedback: string;
  score?: number;
};

export function EssayCheckExercise({
  taskId,
  prompt,
}: {
  taskId: string;
  prompt?: string;
}) {
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<DelfCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/delf/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, answer }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Помилка перевірки");
      }

      setResult((await res.json()) as DelfCheckResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка перевірки");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <p className="mb-2 font-medium">{prompt ?? DEFAULT_INSTRUCTIONS.essay_check}</p>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        disabled={!!result}
        rows={5}
        className="w-full rounded-md border px-2 py-1.5 text-sm"
        placeholder="Ваша відповідь..."
      />

      {!result ? (
        <button
          type="button"
          onClick={submit}
          disabled={pending || !answer.trim()}
          className="mt-3 rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          {pending ? "Перевіряю..." : "Надіслати"}
        </button>
      ) : (
        <p
          className={`mt-3 text-sm font-medium ${
            result.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {result.feedback}
        </p>
      )}

      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
