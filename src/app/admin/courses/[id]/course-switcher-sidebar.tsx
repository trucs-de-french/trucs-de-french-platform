"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clapperboard,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";

export type SidebarCourseChild = { key: string; label: string; href: string };
export type SidebarCourse = {
  id: string;
  title: string;
  type: string;
  children: SidebarCourseChild[];
};

export function CourseSwitcherSidebar({
  courses,
  currentCourseId,
}: {
  courses: SidebarCourse[];
  currentCourseId: string;
}) {
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  // Поточний курс розгорнутий одразу — користувач і так у ньому; можна
  // розгорнути кілька курсів одночасно (не строгий accordion "лише один").
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([currentCourseId]));

  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
        className="rounded-md border px-2 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      <CourseGroup
        label="Кіно"
        icon={Clapperboard}
        courses={film}
        currentCourseId={currentCourseId}
        expanded={expanded}
        onToggleExpanded={toggleExpanded}
        onNavigate={() => setMobileOpen(false)}
      />
      <CourseGroup
        label="DELF"
        icon={GraduationCap}
        courses={delf}
        currentCourseId={currentCourseId}
        expanded={expanded}
        onToggleExpanded={toggleExpanded}
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

      <aside className="hidden w-56 shrink-0 lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:self-start">
        {list}
      </aside>
    </>
  );
}

function CourseGroup({
  label,
  icon: Icon,
  courses,
  currentCourseId,
  expanded,
  onToggleExpanded,
  onNavigate,
}: {
  label: string;
  icon: LucideIcon;
  courses: SidebarCourse[];
  currentCourseId: string;
  expanded: Set<string>;
  onToggleExpanded: (id: string) => void;
  onNavigate: () => void;
}) {
  if (courses.length === 0) return null;

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">
        <Icon size={14} className="shrink-0" />
        {label}
      </p>
      <ul className="flex flex-col gap-1">
        {courses.map((c) => {
          const isOpen = expanded.has(c.id) && c.children.length > 0;
          return (
            <li key={c.id}>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => onToggleExpanded(c.id)}
                  disabled={c.children.length === 0}
                  aria-label={isOpen ? "Згорнути" : "Розгорнути"}
                  className="shrink-0 rounded p-1 text-indigo-400 hover:text-indigo-600 disabled:opacity-0 dark:hover:text-indigo-400"
                >
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <Link
                  href={`/admin/courses/${c.id}`}
                  onClick={onNavigate}
                  className={`block flex-1 truncate rounded-lg px-2 py-2 text-sm ${
                    c.id === currentCourseId
                      ? "bg-indigo-50 font-medium text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
                      : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-900/50"
                  }`}
                >
                  {c.title}
                </Link>
              </div>
              {isOpen && (
                <ul className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l pl-2">
                  {c.children.map((child) => (
                    <li key={child.key}>
                      <Link
                        href={child.href}
                        onClick={onNavigate}
                        className="block truncate rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-50 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-900/50 dark:hover:text-neutral-200"
                      >
                        {child.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
