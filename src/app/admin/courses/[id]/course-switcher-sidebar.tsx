"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

type Course = { id: string; title: string; type: string };

export function CourseSwitcherSidebar({
  courses,
  currentCourseId,
}: {
  courses: Course[];
  currentCourseId: string;
}) {
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const q = query.trim().toLowerCase();
  const filtered = q ? courses.filter((c) => c.title.toLowerCase().includes(q)) : courses;
  const film = filtered.filter((c) => c.type === "film");
  const delf = filtered.filter((c) => c.type === "delf");

  const list = (
    <div className="flex flex-col gap-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Пошук курсу..."
        className="rounded-md border px-2 py-1.5 text-sm"
      />
      <CourseGroup
        label="Кіно"
        courses={film}
        currentCourseId={currentCourseId}
        onNavigate={() => setMobileOpen(false)}
      />
      <CourseGroup
        label="DELF"
        courses={delf}
        currentCourseId={currentCourseId}
        onNavigate={() => setMobileOpen(false)}
      />
      {filtered.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Нічого не знайдено.</p>
      )}
    </div>
  );

  return (
    <>
      <div className="mb-4 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          <Menu size={16} />
          Курси
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[80vw] overflow-y-auto bg-white p-4 dark:bg-neutral-950">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold">Курси</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Закрити"
                className="text-neutral-500 hover:text-black dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            {list}
          </div>
        </div>
      )}

      <aside className="hidden w-56 shrink-0 lg:sticky lg:top-6 lg:block lg:self-start">
        {list}
      </aside>
    </>
  );
}

function CourseGroup({
  label,
  courses,
  currentCourseId,
  onNavigate,
}: {
  label: string;
  courses: Course[];
  currentCourseId: string;
  onNavigate: () => void;
}) {
  if (courses.length === 0) return null;

  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">
        {label}
      </p>
      <ul className="flex flex-col gap-0.5">
        {courses.map((c) => (
          <li key={c.id}>
            <Link
              href={`/admin/courses/${c.id}`}
              onClick={onNavigate}
              className={`block rounded-md px-2 py-1.5 text-sm ${
                c.id === currentCourseId
                  ? "bg-neutral-100 font-medium dark:bg-neutral-900"
                  : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-900/50"
              }`}
            >
              {c.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
