import { Roboto } from "next/font/google";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// cyrillic — обов'язково, увесь текст адмінки українською; без цього
// підмножина шрифт вантажився б, але кирилиця йшла б фолбеком, а не Roboto.
const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin", "cyrillic"],
  variable: "--font-roboto",
});

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
    <div className={`admin-root mx-auto max-w-4xl p-6 ${roboto.variable}`}>
      {children}
    </div>
  );
}
