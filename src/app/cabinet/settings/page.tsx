import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { t } from "@/lib/i18n/t";
import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { getExamSettingsData } from "@/lib/cabinet/home-data";
import { signOut } from "@/app/login/actions";
import { THEME_COOKIE, parseThemeCookieValue } from "@/lib/theme-cookie";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { PageHeader } from "@/components/cabinet/page-header";
import { SettingsForm } from "@/components/cabinet/settings/settings-form";
import type { FrenchLevel, FrenchLevelSource, LearningGoal, NotificationPrefs, Profile } from "@/lib/supabase/profile";

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = { review: true, weekly_goal: true, news: false };

export default async function CabinetSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login"); // guarded by cabinet/layout.tsx теж — подвійний захист не шкодить
  }

  // Основні поля (ім'я/мова/роль) — ОКРЕМИМ запитом від нових колонок
  // (avatar_url/avatar_mascot/notification_prefs, 0066_cabinet_settings.sql):
  // якщо власниця ще не застосувала цю міграцію, select із неіснуючою
  // колонкою валить ЦІЛИЙ рядок в одному спільному запиті — full_name
  // приходив би null разом з аватаром, і поле імені на сторінці виглядало
  // б порожнім, хоча сайдбар (окремий, менший запит у cabinet/layout.tsx)
  // показує ім'я коректно. Друга спроба — у try/catch, деградує до
  // дефолтів, не рвучи сторінку.
  const { data: coreProfile } = await supabase
    .from("profiles")
    .select("role, full_name, ui_lang")
    .eq("id", user.id)
    .single<Pick<Profile, "role" | "full_name" | "ui_lang">>();

  const lang = normalizeUiLang(coreProfile?.ui_lang);

  let avatarUrl: string | null = null;
  let avatarMascot: string | null = null;
  let notificationPrefs: NotificationPrefs = DEFAULT_NOTIFICATION_PREFS;
  let weeklyGoalScenes = 3;
  try {
    const { data: extra } = await supabase
      .from("profiles")
      .select("avatar_url, avatar_mascot, notification_prefs, weekly_goal_scenes")
      .eq("id", user.id)
      .single<Pick<Profile, "avatar_url" | "avatar_mascot" | "notification_prefs" | "weekly_goal_scenes">>();
    avatarUrl = extra?.avatar_url ?? null;
    avatarMascot = extra?.avatar_mascot ?? null;
    notificationPrefs = extra?.notification_prefs ?? DEFAULT_NOTIFICATION_PREFS;
    weeklyGoalScenes = extra?.weekly_goal_scenes ?? 3;
  } catch {
    // міграція 0066 ще не застосована — лишаємось на дефолтах вище
  }

  // learning_goals/french_level* — 0067_profile_goals_level.sql, ОКРЕМИЙ
  // запит/try-catch від 0066-полів вище: якщо 0066 вже застосована, а
  // 0067 ще ні (чи навпаки), один спільний select впав би ЦІЛИМ рядком
  // через будь-яку відсутню колонку, гублячи й аватар/сповіщення теж.
  // aboutMeAvailable=false — картка рендериться, але "Зберегти"
  // дизейблена (settings-form.tsx/about-me-card.tsx), не падає.
  let aboutMeAvailable = true;
  let learningGoals: LearningGoal[] = [];
  let frenchLevel: FrenchLevel | null = null;
  let frenchLevelSource: FrenchLevelSource | null = null;
  try {
    const { data: aboutMe } = await supabase
      .from("profiles")
      .select("learning_goals, french_level, french_level_source")
      .eq("id", user.id)
      .single<Pick<Profile, "learning_goals" | "french_level" | "french_level_source">>();
    learningGoals = aboutMe?.learning_goals ?? [];
    frenchLevel = aboutMe?.french_level ?? null;
    frenchLevelSource = aboutMe?.french_level_source ?? null;
  } catch {
    // міграція 0067 ще не застосована
    aboutMeAvailable = false;
  }

  const { exam, showExamCard } = await getExamSettingsData(supabase, user.id);

  const cookieStore = await cookies();
  const initialIsDark = parseThemeCookieValue(cookieStore.get(THEME_COOKIE)?.value);

  return (
    // pb-24 (96px) — місце під плаваючу пілюлю "Є незбережені зміни"
    // (sticky, settings-form.tsx/save-bar.tsx), щоб вона, прилипнувши
    // внизу, не перекривала останні картки (Сповіщення/Акаунт).
    <div className="flex flex-col gap-6 pb-24">
      <CabinetMobileHeader />

      <PageHeader title={t(lang, "cabinet.nav.settings")} subtitle={t(lang, "cabinet.settings.subtitle")} />

      <SettingsForm
        lang={lang}
        userId={user.id}
        email={user.email ?? ""}
        isTeacher={coreProfile?.role === "teacher"}
        initialName={coreProfile?.full_name ?? ""}
        initialMascot={avatarMascot}
        initialAvatarUrl={avatarUrl}
        initialNotificationPrefs={notificationPrefs}
        weeklyGoal={weeklyGoalScenes}
        exam={exam}
        showExamCard={showExamCard}
        aboutMeAvailable={aboutMeAvailable}
        initialLearningGoals={learningGoals}
        initialFrenchLevel={frenchLevel}
        initialFrenchLevelSource={frenchLevelSource}
        initialIsDark={initialIsDark}
        onSignOut={signOut}
      />
    </div>
  );
}
