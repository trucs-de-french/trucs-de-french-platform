import { t, type MessageKey } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { AchievementCategory, AchievementState } from "@/lib/cabinet/achievements";
import { AchievementBadge } from "@/components/cabinet/home/achievement-badge";
import { CardTitle } from "@/components/cabinet/card-title";

// Той самий порядок категорій, що каталог (achievements.ts) — "dictionary"
// виключено свідомо: available:false, нема джерела даних, не показуємо її
// взагалі, навіть locked (щоб не плутати студента неіснуючим словником).
const CATEGORY_ORDER: AchievementCategory[] = [
  "scenes",
  "films",
  "streak",
  "points",
  "exercises",
  "mistakes",
  "weeklyGoal",
  "exam",
];
const CATEGORY_LABEL_KEY: Record<AchievementCategory, MessageKey> = {
  scenes: "achievements.category.scenes",
  films: "achievements.category.films",
  streak: "achievements.category.streak",
  points: "achievements.category.points",
  exercises: "achievements.category.exercises",
  mistakes: "achievements.category.mistakes",
  weeklyGoal: "achievements.category.weeklyGoal",
  exam: "achievements.category.exam",
  dictionary: "achievements.category.exam", // недосяжно: dictionary завжди відфільтровано нижче
};

export function AchievementsCard({
  lang,
  items,
  showExamCard,
}: {
  lang: UiLang;
  items: AchievementState[];
  showExamCard: boolean;
}) {
  const visible = items.filter((a) => a.available !== false && (!a.examOnly || showExamCard));

  return (
    <div className="cabinet-card flex flex-col gap-5 p-5">
      <CardTitle>{t(lang, "progress.achievements.title")}</CardTitle>
      <div className="achievements-groups">
        {CATEGORY_ORDER.map((category) => {
          const categoryItems = visible
            .filter((a) => a.category === category)
            .sort((a, b) => Number(b.earned) - Number(a.earned) || a.threshold - b.threshold);
          if (categoryItems.length === 0) return null;
          return (
            <div key={category} className="flex flex-col gap-3">
              <h4 className="text-xs font-bold uppercase tracking-[0.04em] text-[var(--cabinet-muted)]">
                {t(lang, CATEGORY_LABEL_KEY[category])}
              </h4>
              <div className="achievements-group-badges">
                {categoryItems.map((achievement) => (
                  <AchievementBadge key={achievement.id} lang={lang} achievement={achievement} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
