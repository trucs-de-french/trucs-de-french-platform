"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type PracticeCheckResponse = {
  results: { itemId: string; correct: boolean }[];
  remainingItemIds: string[];
  failedAttempts: Record<string, number>;
  status: "not_started" | "partial" | "done";
};

// Спільний для multiple-choice.tsx/fill-blank.tsx хук режиму практики
// (пілот "Робота над помилками", частина 2) — на відміну від
// useExerciseCheck (/api/exercises/check, один результат на всю вправу),
// тут ДВА окремі серверні маршрути (practice/check, practice/reveal,
// частина 1), обидва викликаються повторно для одного taskId протягом
// однієї сесії практики (кожне "Перевірити"/"Показати відповідь" —
// окремий запит, не один remount). router.refresh() після кожного —
// той самий принцип, що useExerciseCheck, щоб картка "Робота над
// помилками" (review.remainingItemIds/failedAttempts, серверна модель)
// оновилась без перезавантаження сторінки.
export function usePracticeCheck(taskId: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Record<string, string[]>>({});
  const [revealPending, setRevealPending] = useState<Record<string, boolean>>({});

  async function check(itemIds: string[], answer: unknown): Promise<PracticeCheckResponse | null> {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/exercises/practice/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, itemIds, answer }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Помилка перевірки");
      }
      const result = (await res.json()) as PracticeCheckResponse;
      router.refresh();
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка перевірки");
      return null;
    } finally {
      setPending(false);
    }
  }

  // fromButton=false — автоматичний виклик після 2 невдалих спроб
  // (сервер сам звіряє лічильник, 403 якщо ще не настав час — викликач
  // відповідає лише за те, щоб не дзвонити занадто рано; fromButton=true
  // — кнопка "Показати відповідь", завжди 200).
  async function reveal(itemId: string, fromButton: boolean): Promise<string[] | null> {
    setRevealPending((prev) => ({ ...prev, [itemId]: true }));
    try {
      const res = await fetch("/api/exercises/practice/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, itemId, fromButton }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { answer: string[] };
      setRevealed((prev) => ({ ...prev, [itemId]: body.answer }));
      router.refresh();
      return body.answer;
    } finally {
      setRevealPending((prev) => ({ ...prev, [itemId]: false }));
    }
  }

  return { check, pending, error, reveal, revealed, revealPending };
}
