import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminCoursesPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, title, type, is_published, price")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Курси</h1>
        <Link
          href="/admin/courses/new"
          className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          + Новий курс
        </Link>
      </div>

      <ul className="mt-6 flex flex-col gap-2">
        {products?.map((p) => (
          <li key={p.id}>
            <Link
              href={`/admin/courses/${p.id}`}
              className="flex items-center justify-between rounded-md border p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              <div>
                <p className="font-medium">{p.title}</p>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  {p.type === "film" ? "Фільм/серіал" : "DELF"} · {p.price} грн
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-xs ${
                  p.is_published
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                    : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                }`}
              >
                {p.is_published ? "Опубліковано" : "Чернетка"}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {(!products || products.length === 0) && (
        <p className="mt-6 text-neutral-500 dark:text-neutral-400">Курсів ще немає.</p>
      )}
    </div>
  );
}
