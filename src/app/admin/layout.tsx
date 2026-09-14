import Link from "next/link";
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

  return (
    <div className={`admin-root mx-auto max-w-4xl p-6 ${roboto.variable}`}>
      {/* Лого ("Trucs de French"/"Адмінка") переїхало в CourseSwitcherSidebar
          (видиме лише всередині курсу) — тут лишається тільки "До кабінету".
          На courses/page.tsx і courses/new/page.tsx (де sidebar нема) лого
          тепер узагалі не показується — прямий наслідок "перенести", не
          "продублювати". pr-14 — той самий резерв під плаваючу ThemeToggle-
          кнопку (position: fixed, top-4 right-4, у кореневому layout.tsx),
          що й раніше: на viewport вужчому за max-w-4xl права межа nav
          збігається з правою межею viewport. */}
      <nav className="mb-6 flex items-center justify-end gap-4 border-b pb-4 pr-14">
        <Link href="/dashboard" className="text-sm underline">
          До кабінету
        </Link>
      </nav>
      {children}
    </div>
  );
}
