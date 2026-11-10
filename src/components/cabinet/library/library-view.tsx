"use client";

import { useMemo, useState } from "react";
import { Check, Film, Search, Target } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { LibraryItem } from "@/lib/cabinet/library-data";

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function LibraryCard({ lang, item }: { lang: UiLang; item: LibraryItem }) {
  const level = item.levels[0] ?? null;
  const progressPercent = Math.round(item.progressFraction * 100);
  const actionKey =
    item.status === "completed"
      ? "library.action.view"
      : item.status === "in_progress"
        ? "library.action.continue"
        : "library.action.start";
  const metaKey = item.unitKind === "scenes" ? "library.progress.scenes" : "library.progress.tasks";
  const isGhost = item.status === "completed";

  return (
    <div className="cabinet-card flex flex-col gap-3 p-3">
      <div className="relative h-[104px] w-full overflow-hidden rounded-2xl bg-black/5">
        {item.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- зовнішній R2-URL, next/image вимагав би remotePatterns у next.config
          <img src={item.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : item.type === "film" ? (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "linear-gradient(135deg, #2f2c6b, #4b46da)" }}
          >
            <Film size={36} className="text-white" aria-hidden="true" />
          </div>
        ) : (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
          >
            <Target size={36} className="text-[var(--cabinet-on-gold)]" aria-hidden="true" />
          </div>
        )}
        <span
          className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--cabinet-on-gold)]"
          style={{ background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
        >
          {item.type === "film" ? t(lang, "library.type.film") : t(lang, "library.type.delf")}
        </span>
        {level && (
          <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold text-white dark:border dark:border-[var(--cabinet-line)] dark:bg-[var(--cabinet-track)] dark:text-[var(--cabinet-ink)]">
            {level}
          </span>
        )}
      </div>

      <h3 className="line-clamp-2 font-body text-base font-semibold leading-tight text-[var(--cabinet-ink)]">
        {item.title}
      </h3>

      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-xs text-[var(--cabinet-muted)]">
          {t(lang, metaKey, { done: item.unitsDone, total: item.unitsTotal })}
        </p>
        {item.status === "completed" && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--cabinet-surface-2)] px-2 py-0.5 text-[10px] font-bold text-[var(--cabinet-ink)]">
            <Check size={11} aria-hidden="true" />
            {t(lang, "library.completed")}
          </span>
        )}
      </div>

      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--cabinet-track)]"
        role="progressbar"
        aria-valuenow={progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${progressPercent}%`, background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
        />
      </div>

      <a
        href={item.href}
        className={
          isGhost
            ? "flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--cabinet-line)] bg-transparent text-sm font-bold text-[var(--cabinet-ghost-fg)] hover:bg-[var(--cabinet-ghost-bg-hover)] dark:border-[1.5px] dark:border-[var(--cabinet-btn-border)] dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)]"
            : "flex min-h-11 w-full items-center justify-center rounded-full border-[1.5px] border-[var(--cabinet-btn-border)] bg-[var(--cabinet-btn-bg)] text-sm font-bold text-[var(--cabinet-btn-fg)] hover:bg-[var(--cabinet-btn-bg-hover)] dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)]"
        }
      >
        {t(lang, actionKey)}
      </a>
    </div>
  );
}

export function LibraryView({ lang, items }: { lang: UiLang; items: LibraryItem[] }) {
  const [typeFilter, setTypeFilter] = useState<"all" | "film" | "delf">("all");
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const presentTypes = useMemo(() => {
    const set = new Set(items.map((i) => i.type));
    return ["film", "delf"].filter((type) => set.has(type as "film" | "delf")) as ("film" | "delf")[];
  }, [items]);

  const presentLevels = useMemo(() => {
    const set = new Set(items.flatMap((i) => i.levels));
    return CEFR_ORDER.filter((level) => set.has(level));
  }, [items]);

  const filtered = useMemo(() => {
    const query = normalizeSearch(search.trim());
    return items.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (levelFilter && !item.levels.includes(levelFilter)) return false;
      if (query && !normalizeSearch(item.title).includes(query)) return false;
      return true;
    });
  }, [items, typeFilter, levelFilter, search]);

  function resetFilters() {
    setTypeFilter("all");
    setLevelFilter(null);
    setSearch("");
  }

  if (items.length === 0) {
    return (
      <div className="cabinet-card flex flex-col items-center gap-2 p-8 text-center">
        <p className="font-body text-base text-[var(--cabinet-ink)]">{t(lang, "library.empty.title")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="task-tabs-scroll min-w-0 flex-1 basis-[200px]">
          <div className="flex items-center gap-2 whitespace-nowrap">
            <button
              type="button"
              aria-pressed={typeFilter === "all"}
              onClick={() => setTypeFilter("all")}
              className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)] ${
                typeFilter === "all"
                  ? "border-[1.5px] border-[var(--cabinet-pill-selected-border)] bg-[var(--cabinet-pill-selected-bg)] text-[var(--cabinet-pill-selected-fg)]"
                  : "border border-[var(--cabinet-line)] text-[var(--cabinet-ink)] dark:bg-[var(--cabinet-surface-2)]"
              }`}
            >
              {t(lang, "library.tab.all")}
            </button>
            {presentTypes.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={typeFilter === type}
                onClick={() => setTypeFilter(type)}
                className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)] ${
                  typeFilter === type
                    ? "border-[1.5px] border-[var(--cabinet-pill-selected-border)] bg-[var(--cabinet-pill-selected-bg)] text-[var(--cabinet-pill-selected-fg)]"
                    : "border border-[var(--cabinet-line)] text-[var(--cabinet-ink)] dark:bg-[var(--cabinet-surface-2)]"
                }`}
              >
                {t(lang, type === "film" ? "library.tab.film" : "library.tab.delf")}
              </button>
            ))}
          </div>
        </div>

        <label className="relative flex min-h-11 w-full min-w-0 flex-1 basis-[220px] items-center sm:ml-auto sm:max-w-[320px]">
          <span className="sr-only">{t(lang, "library.search")}</span>
          <Search
            size={16}
            className="pointer-events-none absolute left-3 text-[var(--cabinet-muted)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(lang, "library.search")}
            className="min-h-11 w-full rounded-full border border-[var(--cabinet-line)] bg-[var(--cabinet-surface-2)] py-2 pl-9 pr-3 text-sm text-[var(--cabinet-ink)] placeholder:text-[var(--cabinet-muted)] dark:accent-[var(--cabinet-btn-border)] dark:focus:border-[var(--cabinet-btn-border)] dark:focus:ring-2 dark:focus:ring-[var(--cabinet-focus-ring)]"
          />
        </label>
      </div>

      {presentLevels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-[var(--cabinet-muted)]">
            {t(lang, "library.level.label")}
          </span>
          <button
            type="button"
            aria-pressed={levelFilter === null}
            onClick={() => setLevelFilter(null)}
            className={`inline-flex h-11 shrink-0 items-center justify-center rounded-full px-4 text-sm font-extrabold dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)] ${
              levelFilter === null
                ? "border-[1.5px] border-[var(--cabinet-pill-selected-border)] bg-[var(--cabinet-pill-selected-bg)] text-[var(--cabinet-pill-selected-fg)]"
                : "border border-[var(--cabinet-line)] text-[var(--cabinet-ink)] dark:bg-[var(--cabinet-surface-2)]"
            }`}
          >
            {t(lang, "library.level.all")}
          </button>
          {presentLevels.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={levelFilter === level}
              onClick={() => setLevelFilter((cur) => (cur === level ? null : level))}
              className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0 text-sm font-extrabold dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)] ${
                levelFilter === level
                  ? "border-[1.5px] border-[var(--cabinet-pill-selected-border)] bg-[var(--cabinet-pill-selected-bg)] text-[var(--cabinet-pill-selected-fg)]"
                  : "border border-[var(--cabinet-line)] text-[var(--cabinet-ink)] dark:bg-[var(--cabinet-surface-2)]"
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-[var(--cabinet-muted)]">{t(lang, "library.empty.nothing")}</p>
          <button
            type="button"
            onClick={resetFilters}
            className="min-h-11 rounded-full border border-[var(--cabinet-line)] px-4 text-sm font-bold text-[var(--cabinet-ghost-fg)] hover:bg-[var(--cabinet-ghost-bg-hover)] dark:border-[1.5px] dark:border-[var(--cabinet-btn-border)] dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)]"
          >
            {t(lang, "library.empty.reset")}
          </button>
        </div>
      ) : (
        <div className="cabinet-library-grid">
          <div className="cabinet-library-cols">
            {filtered.map((item) => (
              <LibraryCard key={item.productId} lang={lang} item={item} />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
