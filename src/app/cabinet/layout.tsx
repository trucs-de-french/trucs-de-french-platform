import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { CabinetSidebar } from "@/components/cabinet/sidebar";
import { CabinetMobileTabBar } from "@/components/cabinet/mobile-tab-bar";
import type { Profile } from "@/lib/supabase/profile";
import { THEME_COOKIE, parseThemeCookieValue } from "@/lib/theme-cookie";

const NAV_COOKIE = "tdf_cabinet_nav";

// Єдиний guard для всього /cabinet — сторінки всередині (page.tsx) його
// НЕ повторюють, той самий підхід, що admin/layout.tsx. Кука
// tdf_cabinet_nav читається тут (сервер), щоб перший рендер одразу
// відобразив правильну ширину sidebar без миготіння — клієнтський Sidebar
// лише перемикає стан і сам пише ту саму куку далі.
export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, ui_lang, avatar_url, avatar_mascot")
    .eq("id", user.id)
    .single<Pick<Profile, "role" | "full_name" | "ui_lang" | "avatar_url" | "avatar_mascot">>();

  const isTeacher = profile?.role === "teacher";
  const lang = normalizeUiLang(profile?.ui_lang);

  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get(NAV_COOKIE)?.value === "collapsed";
  const initialIsDark = parseThemeCookieValue(cookieStore.get(THEME_COOKIE)?.value);

  // {children} рендериться РІВНО один раз — хром (sidebar/frame/tab bar)
  // навколо нього перемикається чистим CSS (медіа-запити в globals.css),
  // а не двома паралельними деревами з дубльованим children: інакше кожен
  // заголовок/landmark сторінки з'являвся б у DOM двічі одночасно.
  return (
    <div className="cabinet cabinet-frame">
      <CabinetSidebar
        lang={lang}
        isTeacher={isTeacher}
        fullName={profile?.full_name ?? null}
        avatarUrl={profile?.avatar_url ?? null}
        avatarMascot={profile?.avatar_mascot ?? null}
        initialCollapsed={initialCollapsed}
        initialIsDark={initialIsDark}
        onSignOut={signOut}
      />
      <main className="cabinet-panel">{children}</main>
      <CabinetMobileTabBar lang={lang} />
    </div>
  );
}
