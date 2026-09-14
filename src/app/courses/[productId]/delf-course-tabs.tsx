"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Menu, X } from "lucide-react";

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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  function selectTab(value: Tab) {
    setTab(value);
    setMobileOpen(false);
  }

  const nav = (
    <ul className="flex flex-col gap-0.5">
      {TABS.map((t) => (
        <li key={t.value}>
          <button
            type="button"
            onClick={() => selectTab(t.value)}
            className={`block w-full rounded-md px-3 py-2 text-left text-sm font-medium ${
              tab === t.value
                ? "bg-neutral-100 text-black dark:bg-neutral-900 dark:text-white"
                : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900/50 dark:hover:text-neutral-200"
            }`}
          >
            {t.label}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          <Menu size={16} />
          {TABS.find((t) => t.value === tab)?.label}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 max-w-[80vw] overflow-y-auto bg-white p-4 dark:bg-neutral-950">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold">Розділи курсу</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Закрити"
                className="text-neutral-500 hover:text-black dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            {nav}
          </div>
        </div>
      )}

      <aside className="hidden w-48 shrink-0 lg:block">{nav}</aside>

      <div className="min-w-0 flex-1">
        {tab === "tests" && testsContent}

        {tab === "materials" && materialsContent}

        {tab === "recommendations" && recommendationsContent}

        {tab === "progress" && (
          <p className="text-neutral-500 dark:text-neutral-400">
            Календар занять і планова дата іспиту — з&apos;являться на наступному етапі.
          </p>
        )}
      </div>
    </div>
  );
}
