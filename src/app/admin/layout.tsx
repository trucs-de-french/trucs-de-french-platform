import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "teacher") {
    redirect(
      "/dashboard?error=" + encodeURIComponent("Доступ до адмінки лише для викладача")
    );
  }

  // Ні лого, ні "До кабінету" тут більше нема — обидва розкладені по
  // конкретних місцях використання: CourseSwitcherSidebar (усередині курсу,
  // courses/[id]/**, full-bleed breakout зі своїм sidebar), AdminShell
  // (courses/page.tsx, achievements-preview/page.tsx — cabinet-style рейка,
  // теж full-bleed breakout) і AdminLogo (courses/new/page.tsx — досі без
  // жодного sidebar). Спільного "верхнього nav" для всієї адмінки немає;
  // цей layout лишається ЛИШЕ guard'ом (role==="teacher") + вузьким
  // max-w-4xl контейнером для сторінок без власного full-bleed shell.
  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      {children}
    </div>
  );
}
