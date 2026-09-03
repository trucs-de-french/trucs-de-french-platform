"use client";

import { useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";

const TABS = [
  { value: "tests", label: "Тести" },
  { value: "materials", label: "Матеріали" },
  { value: "recommendations", label: "Рекомендації" },
  { value: "progress", label: "Прогрес" },
] as const;

type Tab = (typeof TABS)[number]["value"];

const TAB_VALUES: Tab[] = TABS.map((t) => t.value);

export function DelfCourseTabs({
  testsContent,
  materialsContent,
  recommendationsContent,
}: {
  testsContent: ReactNode;
  materialsContent: ReactNode;
  recommendationsContent: ReactNode;
}) {
  const searchParams = useSearchParams();
  // ?tab=... дозволяє посиланням ззовні (напр. "← До матеріалів" зі
  // сторінки матеріалу) відкривати конкретну вкладку, а не завжди першу.
  const initialTab = searchParams.get("tab");
  const [tab, setTab] = useState<Tab>(
    TAB_VALUES.includes(initialTab as Tab) ? (initialTab as Tab) : "tests"
  );

  return (
    <div className="mt-6">
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`px-3 py-2 text-sm font-medium ${
              tab === t.value
                ? "border-b-2 border-black text-black dark:border-white dark:text-white"
                : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tests" && testsContent}

      {tab === "materials" && materialsContent}

      {tab === "recommendations" && recommendationsContent}

      {tab === "progress" && (
        <p className="mt-4 text-neutral-500 dark:text-neutral-400">
          Календар занять і планова дата іспиту — з&apos;являться на наступному етапі.
        </p>
      )}
    </div>
  );
}
