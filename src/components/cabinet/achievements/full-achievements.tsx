"use client";

import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { AchievementCategory, AchievementState } from "@/lib/cabinet/achievements";
import { CATEGORY_LABEL_KEY, CATEGORY_ORDER } from "@/lib/cabinet/achievement-ui";
import { AchievementBadge } from "@/components/cabinet/home/achievement-badge";

function isCategory(value: string | null): value is AchievementCategory {
  return !!value && (CATEGORY_ORDER as string[]).includes(value);
}

// Чипи-фільтри категорій + дві зони "Зароблено"/"Попереду" — повна
// сторінка досягнень (/cabinet/achievements). Вибір категорії
// синхронізований з ?cat= (replace, без скролу), щоб посилання можна
// надіслати студенту прямо на фільтр, а "Усі" лишав URL без параметра.
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

  const visible = useMemo(
    () => items.filter((a) => a.available !== false && (!a.examOnly || showExamCard)),
    [items, showExamCard]
  );

  const chips = useMemo(
    () =>
      CATEGORY_ORDER.filter((category) => visible.some((a) => a.category === category)).map((category) => {
        const categoryItems = visible.filter((a) => a.category === category);
        return { category, earned: categoryItems.filter((a) => a.earned).length, total: categoryItems.length };
      }),
    [visible]
  );

  function selectCategory(category: AchievementCategory | null) {
    setSelected(category);
    const params = new URLSearchParams(searchParams.toString());
    if (category) params.set("cat", category);
    else params.delete("cat");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

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
  const showCategoryTag = selected === null;

  return (
    <>
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
              <AchievementBadge key={achievement.id} lang={lang} achievement={achievement} showCategoryTag={showCategoryTag} />
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
              <AchievementBadge key={achievement.id} lang={lang} achievement={achievement} showCategoryTag={showCategoryTag} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
