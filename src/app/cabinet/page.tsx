import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { getCabinetHomeData, getNewLibraryItems } from "@/lib/cabinet/home-data";
import { getAchievements, EMPTY_BADGE_STATS, type AchievementsResult } from "@/lib/cabinet/achievements";
import { getDailyQuote } from "@/lib/cabinet/quotes";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { GreetingHero } from "@/components/cabinet/home/greeting-hero";
import { ContinueCard } from "@/components/cabinet/home/continue-card";
import { ExamCard } from "@/components/cabinet/home/exam-card";
import { LevelCard } from "@/components/cabinet/home/level-card";
import { WeeklyGoalCard } from "@/components/cabinet/home/weekly-goal-card";
import { AchievementsHomeCard } from "@/components/cabinet/home/achievements-home-card";
import { QuoteCard } from "@/components/cabinet/home/quote-card";
import { QuickActionsCard } from "@/components/cabinet/home/quick-actions-card";
import { RedoList } from "@/components/cabinet/home/redo-list";
import { LibraryCarousel } from "@/components/cabinet/home/library-carousel";
import { CabinetFooter } from "@/components/cabinet/home/cabinet-footer";
import type { Profile } from "@/lib/supabase/profile";

export default async function CabinetHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // guarded by cabinet/layout.tsx — не повинно трапитись
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ui_lang, french_level, french_level_source, french_level_set_at")
    .eq("id", user.id)
    .single<Pick<Profile, "ui_lang" | "french_level" | "french_level_source" | "french_level_set_at">>();

  const lang = normalizeUiLang(profile?.ui_lang);
  const [home, newLibraryItems, achievements] = await Promise.all([
    getCabinetHomeData(supabase, user.id),
    getNewLibraryItems(supabase),
    getAchievements(supabase, user.id).catch((err): AchievementsResult => {
      console.error("getAchievements failed on Home", err);
      return { items: [], showExamCard: false, stats: EMPTY_BADGE_STATS, earnedAtById: {} };
    }),
  ]);
  const quote = getDailyQuote();

  const firstName = home.fullName?.split(" ")[0] || "";

  // Єдина умова "є іспит" для ВСІХ трьох розкладок нижче (той самий
  // прапор, що й QuickActionsCard отримує як showExamCard) — картка і
  // швидка дія ніколи не можуть розійтись: обидві рахуються з одного
  // серверного home.showExamCard, адмінський симулятор лишається як був
  // (підміняє лише лейбл кнопки всередині QuickActionsCard, не сам
  // прапор — так само, як до цієї задачі).
  const levelCard = (
    <LevelCard
      lang={lang}
      level={profile?.french_level ?? null}
      levelSource={profile?.french_level_source ?? null}
      levelSetAt={profile?.french_level_set_at ?? null}
    />
  );
  // Той самий компактний Іспит/Рівень на ВСІХ ширинах (<640px теж) —
  // колишній окремий ring-дизайн мобільного ExamCard (variant="default")
  // прибрано разом із тим, що мобільний Home раніше не показував "Мій
  // рівень" зовсім, коли іспиту нема (тепер той самий єдиний прапор
  // home.showExamCard, що й QuickActionsCard/AchievementsHomeCard).
  const examOrLevelCard = home.showExamCard ? <ExamCard lang={lang} exam={home.exam} /> : levelCard;
  const achievementsCard = (
    <AchievementsHomeCard
      lang={lang}
      realStats={achievements.stats}
      earnedAtById={achievements.earnedAtById}
      showExamCard={achievements.showExamCard}
    />
  );
  const weeklyGoalCard = <WeeklyGoalCard lang={lang} realDone={home.weeklyGoal.done} realGoal={home.weeklyGoal.goal} />;
  const quickActionsCard = (
    <QuickActionsCard lang={lang} showExamCard={home.showExamCard} delfProductId={home.delfProductId} />
  );
  const continueCard = <ContinueCard lang={lang} target={home.continueTarget} />;
  const quoteCard = <QuoteCard lang={lang} quote={quote} />;
  const redoList = <RedoList lang={lang} items={home.redoList} totalCount={home.redoCount} />;

  return (
    <div className="flex flex-col gap-6">
      <CabinetMobileHeader />

      <GreetingHero
        lang={lang}
        firstName={firstName}
        fullName={home.fullName}
        avatarUrl={home.avatarUrl}
        avatarMascot={home.avatarMascot}
        streakDays={home.streakDays}
        weekActiveDays={home.weekActiveDays}
        level={profile?.french_level ?? null}
      />

      {/* <640px: той самий порядок блоків, що й раніше ("Продовжити"
          лишається на своєму місці), але "Ціль тижня"+"Іспит/Рівень"
          тепер той самий компактний cabinet-home-stack, що на планшеті/
          десктопі (той самий компонент/стан/копірайт/i18n), замість
          старого великого ring-дизайну. Дві картки стоять ОДНА ПІД
          ОДНОЮ (full-width), не поруч: .cabinet-exam-card-body вже
          впритул заповнює ~290px контенту картки на 360px екрані
          (46px-цифра+підпис зліва, назва типу іспиту+дата справа) —
          удвічі вужча колонка "поруч" переповнила б довгу FR/EN назву
          типу іспиту (DALF C1/C2) чи дату. */}
      <div className="flex flex-col gap-6 sm:hidden">
        <div className="cabinet-home-split">
          {achievementsCard}
          <div className="cabinet-home-stack">
            {weeklyGoalCard}
            {examOrLevelCard}
          </div>
          {continueCard}
          {quoteCard}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {quickActionsCard}
          {redoList}
        </div>
      </div>

      {/* 640–1023px (планшет): привітання/hero/цитата кожна на всю
          ширину окремо, потім 2 колонки [стек ціль+іспит/рівень |
          швидкі дії], досягнення на всю ширину, "Повторити" на всю
          ширину. */}
      <div className="hidden flex-col gap-6 sm:flex lg:hidden">
        {continueCard}
        {quoteCard}
        <div className="cabinet-home-tablet-row2">
          <div className="cabinet-home-stack">
            {weeklyGoalCard}
            {examOrLevelCard}
          </div>
          {quickActionsCard}
        </div>
        {achievementsCard}
        {redoList}
      </div>

      {/* >=1024px (десктоп): hero 2fr + цитата 1fr, потім 3 рівні
          колонки [стек ціль+іспит/рівень | досягнення | швидкі дії]. */}
      <div className="hidden flex-col gap-6 lg:flex">
        <div className="cabinet-home-hero-row">
          {continueCard}
          {quoteCard}
        </div>
        <div className="cabinet-home-row3">
          <div className="cabinet-home-stack">
            {weeklyGoalCard}
            {examOrLevelCard}
          </div>
          {achievementsCard}
          {quickActionsCard}
        </div>
        {redoList}
      </div>

      <LibraryCarousel lang={lang} items={newLibraryItems} />

      <CabinetFooter lang={lang} />
    </div>
  );
}
