import Link from "next/link";
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

  return (
    <div className="mx-auto max-w-4xl p-6">
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
