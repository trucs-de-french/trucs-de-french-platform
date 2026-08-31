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
      <nav className="mb-6 flex items-center justify-between border-b pb-4">
        <Link href="/admin/courses" className="flex flex-col leading-tight">
          <span className="text-lg font-semibold">Trucs de French</span>
          <span className="text-xs text-neutral-500 dark:text-neutral-400">Адмінка</span>
        </Link>
        <Link href="/dashboard" className="text-sm underline">
          До кабінету
        </Link>
      </nav>
      {children}
    </div>
  );
}
