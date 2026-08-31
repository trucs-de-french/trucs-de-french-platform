import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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

  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, status, products(id, title, type)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .returns<
      { id: string; status: string; products: { id: string; title: string; type: string } | null }[]
    >();

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
            Trucs de French
          </p>
          <h1 className="text-2xl font-semibold">Мій кабінет</h1>
        </div>
        <div className="flex items-center gap-4">
          {profile?.role === "teacher" && (
            <Link href="/admin/courses" className="text-sm underline">
              Адмінка
            </Link>
          )}
          <form action={signOut}>
            <button type="submit" className="text-sm underline">
              Вийти
            </button>
          </form>
        </div>
      </div>

      <p className="mt-2 text-neutral-600 dark:text-neutral-400">{user.email}</p>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <h2 className="mt-8 text-lg font-medium">Мої курси</h2>
      {enrollments && enrollments.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {enrollments.map((e) => (
            <li key={e.id}>
              {e.products && (
                <Link
                  href={`/courses/${e.products.id}`}
                  className="block rounded-md border p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  {e.products.title}
                </Link>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-neutral-500 dark:text-neutral-400">
          У вас поки немає активних курсів.
        </p>
      )}
    </main>
  );
}
