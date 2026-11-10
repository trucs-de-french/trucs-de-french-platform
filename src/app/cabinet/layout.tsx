import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { CabinetSidebar } from "@/components/cabinet/sidebar";
import { CabinetMobileTabBar } from "@/components/cabinet/mobile-tab-bar";
import type { Profile } from "@/lib/supabase/profile";
import { THEME_COOKIE, parseThemeCookieValue } from "@/lib/theme-cookie";
import { AdminPreviewProvider } from "@/lib/cabinet/admin-preview";
import { AdminPreviewBar } from "@/components/cabinet/admin-preview-bar";

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

  // Core-запит (role/full_name/ui_lang) — від нього залежать "Адмінка",
  // решта role-based видимості й ім'я/ініціал, тож він ОКРЕМО від
  // avatar_url/avatar_mascot (0066_cabinet_settings.sql, ще не
  // застосована міграція валила б увесь спільний рядок, а не лише
  // аватар — "Адмінка" зникала б і вчительці, хоча роль насправді відома).
  const { data: coreProfile, error: coreError } = await supabase
    .from("profiles")
    .select("role, full_name, ui_lang")
    .eq("id", user.id)
    .single<Pick<Profile, "role" | "full_name" | "ui_lang">>();

  if (coreError) {
    console.error("[cabinet/layout] core profile query failed:", coreError.message);
  }

  // email до "@" — фолбек ТІЛЬКИ для відображення (нікнейм/ініціал), не
  // пишеться назад у profiles.full_name. Застосовується і коли
  // full_name дійсно порожнє, і коли сам core-запит впав (coreProfile
  // null) — у цьому рідкому випадку роль теж невідома, тож isTeacher
  // свідомо false (тихо показати "Адмінку" тому, хто насправді вчитель,
  // гірше, ніж тимчасово не показати її тому, хто дійсно вчитель).
  const emailLocalPart = user.email?.split("@")[0] ?? "";
  const displayName = coreProfile?.full_name?.trim() || emailLocalPart || null;

  const isTeacher = coreProfile?.role === "teacher";
  const lang = normalizeUiLang(coreProfile?.ui_lang);

  let avatarUrl: string | null = null;
  let avatarMascot: string | null = null;
  try {
    const { data: extra } = await supabase
      .from("profiles")
      .select("avatar_url, avatar_mascot")
      .eq("id", user.id)
      .single<Pick<Profile, "avatar_url" | "avatar_mascot">>();
    avatarUrl = extra?.avatar_url ?? null;
    avatarMascot = extra?.avatar_mascot ?? null;
  } catch {
    // міграція 0066 ще не застосована — аватар/маскот лишаються null,
    // ім'я/роль з core-запиту вище це не зачіпає
  }

  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get(NAV_COOKIE)?.value === "collapsed";
  const initialIsDark = parseThemeCookieValue(cookieStore.get(THEME_COOKIE)?.value);

  // {children} рендериться РІВНО один раз — хром (sidebar/frame/tab bar)
  // навколо нього перемикається чистим CSS (медіа-запити в globals.css),
  // а не двома паралельними деревами з дубльованим children: інакше кожен
  // заголовок/landmark сторінки з'являвся б у DOM двічі одночасно.
  return (
    <div className="cabinet cabinet-frame">
      {/* Спільні gradient defs для gold-штрихових іконок (stat-tiles.tsx) —
          одне місце на весь /cabinet, щоб нові "bare gold icon" місця не
          дублювали свій <linearGradient>. width=0 height=0 + absolute (НЕ
          display:none — у Safari defs усередині display:none svg іноді не
          резолвляться як referenced paint server). */}
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <defs>
          <linearGradient id="tdf-stat-gold" gradientUnits="userSpaceOnUse" x1="0" y1="2" x2="0" y2="22">
            <stop offset="0" stopColor="#e9c870" />
            <stop offset="1" stopColor="#b8923f" />
          </linearGradient>
          <linearGradient id="tdf-stat-gold-dark" gradientUnits="userSpaceOnUse" x1="0" y1="2" x2="0" y2="22">
            <stop offset="0" stopColor="#f3d98b" />
            <stop offset="1" stopColor="#d9b765" />
          </linearGradient>
        </defs>
      </svg>
      <CabinetSidebar
        lang={lang}
        isTeacher={isTeacher}
        fullName={displayName}
        avatarUrl={avatarUrl}
        avatarMascot={avatarMascot}
        initialCollapsed={initialCollapsed}
        initialIsDark={initialIsDark}
        onSignOut={signOut}
      />
      <main className="cabinet-panel">
        {isTeacher ? (
          <AdminPreviewProvider>
            <AdminPreviewBar lang={lang} />
            {children}
          </AdminPreviewProvider>
        ) : (
          children
        )}
      </main>
      <CabinetMobileTabBar lang={lang} />
    </div>
  );
}
