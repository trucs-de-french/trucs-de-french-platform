"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// RISK 3 ("stay until next open", п.7) — модульний (не per-hook) таймер:
// кожен items-тип монтує СВІЙ usePracticeCheck, тож без спільного замка
// одна подія focus/visibilitychange викликала б N router.refresh() одразу
// (N — кількість змонтованих практик на сторінці, зазвичай 1, але
// теоретично можливо кілька). Один модульний timestamp гарантує РІВНО один
// refresh на весь документ у межах дебаунс-вікна, незалежно від кількості
// хуків.
let lastVisibilityRefreshAt = 0;
const VISIBILITY_REFRESH_DEBOUNCE_MS = 1000;

export type PracticeCheckResponse = {
  results: { itemId: string; correct: boolean }[];
  remainingItemIds: string[];
  failedAttempts: Record<string, number>;
  status: "not_started" | "partial" | "done";
  // whole-режим (частина 7, хвиля 3) — повний detail gradeAnswer, щоб
  // компонент показав, які плитки/клітинки/елементи неправильні (items-
  // режим цим полем не користується, results уже несуть усе потрібне).
  detail?: unknown;
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
  //
  // Задача "fix continuous color flicker in the practice answers panel" —
  // раніше й тут викликався router.refresh(), скопійований із check()
  // вище без потреби: /api/exercises/practice/reveal НІЧОГО не пише в БД
  // (лише читає config і повертає правильну відповідь — itemId
  // навмисно НЕ потрапляє в corrected_item_ids, див. коментар у самому
  // route.ts), тож серверній моделі (entries/remainingItemIds/
  // failedAttempts) після reveal нема що оновлювати. Коли панель
  // відкривається з кількома ще неправильними елементами (wrongIds),
  // revealWrongItems викликає reveal() для КОЖНОГО з них майже
  // одночасно — із router.refresh() це означало N паралельних
  // перезапитів RSC-дерева одразу; aggregateWrongItems сортує рядки
  // помилок за created_at, і рядки з однаковим таймстемпом (одна
  // перевірка) повертаються Postgres у БУДЬ-ЯКОМУ порядку між двома
  // SELECT — тож remainingItemIds (а з ним onlyItemIdsKey, усі 9 items-
  // типів) реально переставлявся на кожен із N refresh, N разів поспіль,
  // перезапускаючи pruneStaleResults-ефект і перерендерюючи весь список
  // (значення кольорів лишались ті самі, pruneStaleResults це вже
  // гарантує, — та N швидких ререндерів поспіль і є тим самим видимим
  // "миготінням", що бачив власник на Спробі 4). Без цього виклику
  // reveal() більше не чіпає серверну модель узагалі — лишається лише
  // сам setRevealed, звичайний один React-рендер на елемент.
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
      return body.answer;
    } finally {
      setRevealPending((prev) => ({ ...prev, [itemId]: false }));
    }
  }

  // RISK 3 ("stay until next open", п.7) — друге вікно/вкладка з тим
  // самим завданням може виправити елементи, поки ЦЕ вікно лишається
  // відкритим: щойно воно знову стає видимим/у фокусі, один
  // router.refresh() (дебаунс ~1с, пропускається, поки САМЕ ЦЕЙ хук має
  // check()/reveal() у польоті — pending/revealPending вище) підхоплює
  // свіжий remainingItemIds. shownPracticeItemIds/prunePracticeResults
  // (error-review.ts) уже гарантують, що елемент, виправлений ІНШИМ
  // вікном (не local practiceResults цього компонента), після цього
  // refresh коректно піде в "gone" (requirement 3), а не лишиться
  // хибно зеленим — і що pruneStaleResults/reveal() самі не
  // перезапускають цей самий цикл (той самий router.refresh()-less
  // reveal(), що вже виправлено в задачі "flicker").
  useEffect(() => {
    function maybeRefresh() {
      if (document.visibilityState !== "visible") return;
      if (pending || Object.values(revealPending).some(Boolean)) return;
      const now = Date.now();
      if (now - lastVisibilityRefreshAt < VISIBILITY_REFRESH_DEBOUNCE_MS) return;
      lastVisibilityRefreshAt = now;
      router.refresh();
    }
    window.addEventListener("focus", maybeRefresh);
    document.addEventListener("visibilitychange", maybeRefresh);
    return () => {
      window.removeEventListener("focus", maybeRefresh);
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, [router, pending, revealPending]);

  return { check, pending, error, reveal, revealed, revealPending };
}
