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
  // конкретних місцях використання: CourseSwitcherSidebar (усередині курсу)
  // і локально на courses/page.tsx/courses/new/page.tsx (де sidebar нема).
  // Спільного "верхнього nav" для всієї адмінки більше не існує.
  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      {children}
    </div>
  );
}
