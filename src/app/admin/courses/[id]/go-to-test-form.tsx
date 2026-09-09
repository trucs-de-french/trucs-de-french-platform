"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Ручне введення номера тесту (1-30) — доповнює "+ Новий тест" (наступний
// вільний номер), а не замінює: вчитель може хотіти конкретний номер, не
// обов'язково наступний вільний. Чиста навігація (сторінка тесту сама не
// створює жодного рядка в БД, поки на ній щось реально не додадуть — Крок
// 2), тож без Server Action, простий client-side push.
export function GoToTestForm({ productId }: { productId: string }) {
  const [value, setValue] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) return;
    router.push(`/admin/courses/${productId}/tests/${n}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1">
      <input
        type="number"
        min={1}
        max={30}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="№"
        className="w-16 rounded-md border px-2 py-1.5 text-sm"
      />
      <button
        type="submit"
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
      >
        Перейти
      </button>
    </form>
  );
}
