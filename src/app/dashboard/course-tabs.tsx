"use client";

import { useState } from "react";
import Link from "next/link";

type Enrollment = {
  id: string;
  products: { id: string; title: string; type: string } | null;
};

const TABS: { value: "film" | "delf"; label: string }[] = [
  { value: "film", label: "Кіно" },
  { value: "delf", label: "DELF" },
];

export function CourseTabs({ enrollments }: { enrollments: Enrollment[] }) {
  const [tab, setTab] = useState<"film" | "delf">("film");
  const filtered = enrollments.filter((e) => e.products?.type === tab);

  return (
    <div className="mt-4">
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

      {filtered.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {filtered.map((e) => (
            <li key={e.id}>
              {e.products && (
                <Link
                  href={`/courses/${e.products.id}`}
                  className="block rounded-md border p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  {e.products.title}
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-neutral-500 dark:text-neutral-400">
          У вас поки немає активних курсів цього треку.
        </p>
      )}
    </div>
  );
}
