import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { t } from "@/lib/i18n/t";
import { getAchievements, EMPTY_BADGE_STATS } from "@/lib/cabinet/achievements";
import { AdminLogo } from "@/components/admin-logo";
import { ADMIN_PAGE_TITLE } from "@/lib/typography-styles";
import { AdminPreviewProvider } from "@/lib/cabinet/admin-preview";
import { AdminSimulatorPanel } from "./simulator-panel";
import type { Profile } from "@/lib/supabase/profile";

// Адмін-сторінка симулятора досягнень — лише вчителі (guard: admin/
// layout.tsx вище). Prefill інпутів бере РЕАЛЬНІ stats цього вчителя
// (getAchievements, та сама функція, що й /cabinet/achievements); сам
// override живе лише в localStorage цього браузера (lib/cabinet/
// admin-preview.tsx) — нічого не пишеться в Supabase.
export default async function AchievementsPreviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // guarded by admin/layout.tsx — не повинно трапитись
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ui_lang")
    .eq("id", user.id)
    .single<Pick<Profile, "ui_lang">>();

  const lang = normalizeUiLang(profile?.ui_lang);
  const { stats } = await getAchievements(supabase, user.id).catch(() => ({ stats: EMPTY_BADGE_STATS }));

  return (
    <div>
      <nav className="mb-8 flex items-center justify-between gap-4 border-b border-gray-200 pb-4 pr-14 dark:border-neutral-800">
        <AdminLogo />
        <Link
          href="/admin/courses"
          className="text-sm text-slate-500 no-underline hover:text-brand dark:text-neutral-400 dark:hover:text-brand"
        >
          До курсів
        </Link>
      </nav>

      <h1 className={ADMIN_PAGE_TITLE}>{t(lang, "achievements.admin.page.title")}</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-neutral-400">{t(lang, "achievements.admin.page.subtitle")}</p>

      <div className="cabinet mt-6">
        <AdminPreviewProvider>
          <AdminSimulatorPanel lang={lang} realStats={stats} />
        </AdminPreviewProvider>
      </div>
    </div>
  );
}
