import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toggleArchive, deleteProductPermanently } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmForm } from "@/components/confirm-form";

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";

  const supabase = await createClient();
  const query = supabase
    .from("products")
    .select("id, title, type, is_published, price, archived_at")
    .order("created_at", { ascending: false });
  const { data: products } = showArchived
    ? await query.not("archived_at", "is", null)
    : await query.is("archived_at", null);

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

      <div className="mt-4 flex gap-1 border-b">
        <Link
          href="/admin/courses"
          className={`px-3 py-2 text-sm font-medium ${
            !showArchived
              ? "border-b-2 border-black text-black dark:border-white dark:text-white"
              : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
          }`}
        >
          Активні
        </Link>
        <Link
          href="/admin/courses?archived=1"
          className={`px-3 py-2 text-sm font-medium ${
            showArchived
              ? "border-b-2 border-black text-black dark:border-white dark:text-white"
              : "text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200"
          }`}
        >
          Архівні
        </Link>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {products?.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-md border p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            <Link href={`/admin/courses/${p.id}`} className="flex-1">
              <p className="font-medium">{p.title}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {p.type === "film" ? "Фільм/серіал" : "DELF"} · {p.price} грн
              </p>
            </Link>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-1 text-xs ${
                  p.is_published
                    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                    : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400"
                }`}
              >
                {p.is_published ? "Опубліковано" : "Чернетка"}
              </span>
              {showArchived && (
                <>
                  <form action={toggleArchive.bind(null, p.id, false)}>
                    <SubmitButton
                      pendingChildren="..."
                      className="rounded border px-2 py-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    >
                      Відновити
                    </SubmitButton>
                  </form>
                  <ConfirmForm
                    action={deleteProductPermanently.bind(null, p.id)}
                    message="Курс і весь вміст (сцени, тести, матеріали, завдання) буде видалено назавжди. Це незворотно. Ви впевнені?"
                  >
                    <SubmitButton
                      pendingChildren="..."
                      className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
                    >
                      Видалити назавжди
                    </SubmitButton>
                  </ConfirmForm>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {(!products || products.length === 0) && (
        <p className="mt-6 text-neutral-500 dark:text-neutral-400">
          {showArchived ? "Архівних курсів немає." : "Курсів ще немає."}
        </p>
      )}
    </div>
  );
}
