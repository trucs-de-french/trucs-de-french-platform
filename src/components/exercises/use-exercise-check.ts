"use client";

import { useState } from "react";
import type { GradeResult } from "@/lib/exercises/types";

export function useExerciseCheck(taskId: string) {
  const [result, setResult] = useState<GradeResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(answer: unknown) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/exercises/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, answer }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Помилка перевірки");
      }

      setResult((await res.json()) as GradeResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка перевірки");
    } finally {
      setPending(false);
    }
  }

  return { submit, pending, result, error };
}
