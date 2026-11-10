"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Lock, X, ArrowRight, Trophy } from "lucide-react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { AchievementCategory, AchievementState } from "@/lib/cabinet/achievements";
import { COLLECTION_NUMBERS, collectionProgress, currentCollection, isCollectionComplete } from "@/lib/cabinet/achievements";
import { CATEGORY_LABEL_KEY, CATEGORY_ORDER, COLLECTION_ROMAN } from "@/lib/cabinet/achievement-ui";
import { AchievementBadge, AchievementBadgeCoin } from "@/components/cabinet/home/achievement-badge";

function isCategory(value: string | null): value is AchievementCategory {
  return !!value && (CATEGORY_ORDER as string[]).includes(value);
}

function dismissKey(collection: number): string {
  return `tdf.collectionBannerDismissed.${collection}`;
}

function roman(n: number): string {
  return COLLECTION_ROMAN[n] ?? String(n);
}

// Чипи-фільтри категорій + дві зони "Зароблено"/"Попереду" + перемикач
// колекцій (Колекція I/II) — повна сторінка досягнень (/cabinet/
// achievements). Вибір категорії синхронізований з ?cat= (replace, без
// скролу); вибір колекції — лише локальний state (не URL). Дисмісс
// банера "Колекцію зібрано" — localStorage, читається ПІСЛЯ mount
// (SSR-safe, щоб не блимнути банером при гідратації).
export function FullAchievements({
  lang,
  items,
  showExamCard,
}: {
  lang: UiLang;
  items: AchievementState[];
  showExamCard: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlCat = searchParams.get("cat");
  const [selected, setSelected] = useState<AchievementCategory | null>(isCategory(urlCat) ? urlCat : null);
  const [selectedCollection, setSelectedCollection] = useState<number>(() => currentCollection(items, showExamCard));
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState<Record<number, boolean>>({});

  useEffect(() => {
    // SSR-safe localStorage hydration (один раз на mount, не в циклі
    // рендерів) — банер не блимає при SSR/гідратації.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    const next: Record<number, boolean> = {};
    for (const n of COLLECTION_NUMBERS) {
      try {
        next[n] = localStorage.getItem(dismissKey(n)) === "1";
      } catch {
        next[n] = false;
      }
    }
    setDismissed(next);
    // Якщо є щойно завершена, але ще не закрита колекція — показати ЇЇ
    // (і банер) замість того, щоб одразу перескочити на currentCollection()
    // (= наступна незавершена): інакше банер "Колекцію зібрано" ніколи не
    // з'явився б студенту, бо дефолтна вкладка вже була б наступною.
    const attention = COLLECTION_NUMBERS.find(
      (n) => isCollectionComplete(items, showExamCard, n) && !next[n]
    );
    if (attention !== undefined) setSelectedCollection(attention);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: items/showExamCard прийшли одним серверним снепшотом і не змінюються за життя сторінки
  }, []);

  function dismissBanner(n: number) {
    setDismissed((prev) => ({ ...prev, [n]: true }));
    try {
      localStorage.setItem(dismissKey(n), "1");
    } catch {
      // localStorage недоступний (приватний режим тощо) — банер просто
      // з'явиться знову при наступному відкритті, не критично.
    }
  }

  function selectCategory(category: AchievementCategory | null) {
    setSelected(category);
    const params = new URLSearchParams(searchParams.toString());
    if (category) params.set("cat", category);
    else params.delete("cat");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function selectCollection(n: number) {
    setSelectedCollection(n);
    selectCategory(null);
  }

  const collectionChips = useMemo(
    () =>
      COLLECTION_NUMBERS.map((n, idx) => {
        const prev = idx > 0 ? COLLECTION_NUMBERS[idx - 1] : null;
        const unlocked = prev === null || isCollectionComplete(items, showExamCard, prev);
        const progress = collectionProgress(items, showExamCard, n);
        const complete = progress.total > 0 && progress.earned === progress.total;
        return { n, prev, unlocked, progress, complete };
      }),
    [items, showExamCard]
  );

  const allVisible = useMemo(
    () => items.filter((a) => a.available !== false && (!a.examOnly || showExamCard)),
    [items, showExamCard]
  );
  const visible = useMemo(() => allVisible.filter((a) => a.collection === selectedCollection), [allVisible, selectedCollection]);

  const chips = useMemo(
    () =>
      CATEGORY_ORDER.filter((category) => visible.some((a) => a.category === category)).map((category) => {
        const categoryItems = visible.filter((a) => a.category === category);
        return { category, earned: categoryItems.filter((a) => a.earned).length, total: categoryItems.length };
      }),
    [visible]
  );

  const filtered = selected ? visible.filter((a) => a.category === selected) : visible;
  const earnedList = [...filtered]
    .filter((a) => a.earned)
    .sort((a, b) => (b.earnedAt ?? "").localeCompare(a.earnedAt ?? ""));
  const upcomingList = [...filtered]
    .filter((a) => !a.earned)
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) || a.threshold - b.threshold
    );

  const viewedProgress = collectionProgress(items, showExamCard, selectedCollection);
  const viewedComplete = viewedProgress.total > 0 && viewedProgress.earned === viewedProgress.total;
  const selectedIdx = COLLECTION_NUMBERS.indexOf(selectedCollection);
  const nextCollection = selectedIdx >= 0 && selectedIdx < COLLECTION_NUMBERS.length - 1 ? COLLECTION_NUMBERS[selectedIdx + 1] : null;
  const finalBadge = items.find((a) => a.collection === selectedCollection && a.isCollectionFinal);
  const showBanner = mounted && viewedComplete && !dismissed[selectedCollection];

  return (
    <>
      {showBanner && finalBadge && (
        <div className="achievements-banner">
          <div className="achievements-banner-coin">
            <AchievementBadgeCoin earned number={null} Icon={Trophy} />
          </div>
          <div className="achievements-banner-text">
            <p className="achievements-banner-title">
              {t(lang, "achievements.collection.banner.title", { n: roman(selectedCollection) })}
            </p>
            <p className="achievements-banner-subtitle">
              {nextCollection
                ? t(lang, "achievements.collection.banner.next", { next: roman(nextCollection) })
                : t(lang, "achievements.collection.banner.last")}
            </p>
          </div>
          <div className="achievements-banner-actions">
            {nextCollection && (
              <button type="button" className="cabinet-pill-link" onClick={() => selectCollection(nextCollection)}>
                {t(lang, "achievements.collection.banner.cta", { next: roman(nextCollection) })}
                <ArrowRight size={16} strokeWidth={2.2} className="cabinet-pill-link-icon" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              className="achievements-banner-close"
              onClick={() => dismissBanner(selectedCollection)}
              aria-label={t(lang, "achievements.collection.banner.close")}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <div className="achievements-collection-row">
        {collectionChips.map(({ n, prev, unlocked, progress, complete }) =>
          unlocked ? (
            <button
              key={n}
              type="button"
              className={`achievements-collection-chip ${selectedCollection === n ? "achievements-collection-chip--active" : ""}`}
              onClick={() => selectCollection(n)}
            >
              {t(lang, "achievements.collection.chip", { n: roman(n) })}
              <span className="achievements-chip-count">
                {progress.earned}/{progress.total}
              </span>
              {complete && mounted && dismissed[n] && (
                <span className="achievements-collection-check" aria-hidden="true">
                  ✓
                </span>
              )}
            </button>
          ) : (
            <span
              key={n}
              className="achievements-collection-chip achievements-collection-chip--locked"
              aria-disabled="true"
              title={t(lang, "achievements.collection.locked", { prev: prev !== null ? roman(prev) : "" })}
            >
              <Lock size={14} aria-hidden="true" />
              {t(lang, "achievements.collection.chip", { n: roman(n) })}
            </span>
          )
        )}
      </div>

      <div className="achievements-chip-row">
        <button
          type="button"
          className={`achievements-chip ${selected === null ? "achievements-chip--active" : ""}`}
          onClick={() => selectCategory(null)}
        >
          {t(lang, "achievements.filter.all")}
        </button>
        {chips.map(({ category, earned, total }) => (
          <button
            key={category}
            type="button"
            className={`achievements-chip ${selected === category ? "achievements-chip--active" : ""}`}
            onClick={() => selectCategory(category)}
          >
            {t(lang, CATEGORY_LABEL_KEY[category])}
            <span className="achievements-chip-count">
              {earned}/{total}
            </span>
          </button>
        ))}
      </div>

      {earnedList.length > 0 && (
        <div>
          <p className="achievements-zone-label">{t(lang, "achievements.zone.earned", { count: earnedList.length })}</p>
          <div className="achievements-zone-grid">
            {earnedList.map((achievement) => (
              <AchievementBadge key={achievement.id} lang={lang} achievement={achievement} />
            ))}
          </div>
        </div>
      )}

      {upcomingList.length > 0 && (
        <div>
          <p className="achievements-zone-label">
            {t(lang, "achievements.zone.upcoming", { count: upcomingList.length })}
          </p>
          <div className="achievements-zone-grid">
            {upcomingList.map((achievement) => (
              <AchievementBadge key={achievement.id} lang={lang} achievement={achievement} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
