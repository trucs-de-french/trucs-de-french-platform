"use client";

import { useState, type ReactNode } from "react";

const TABS: { value: "entrainement" | "examen"; label: string }[] = [
  { value: "entrainement", label: "Entraînement" },
  { value: "examen", label: "Examen" },
];

export function DelfModeTabs({
  level,
  entrainementContent,
}: {
  level: string | null;
  entrainementContent: ReactNode;
}) {
  const [tab, setTab] = useState<"entrainement" | "examen">("entrainement");

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

      {tab === "entrainement" ? (
        entrainementContent
      ) : (
        <p className="mt-4 text-neutral-500 dark:text-neutral-400">
          Симуляція іспиту DELF {level ?? ""} — з&apos;явиться на наступному етапі.
        </p>
      )}
    </div>
  );
}
