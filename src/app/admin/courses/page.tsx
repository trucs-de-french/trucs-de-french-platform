import Link from "next/link";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { toggleArchive, deleteProductPermanently } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmForm } from "@/components/confirm-form";
import { BUTTON_PRIMARY_LG, BUTTON_SECONDARY_SM } from "@/lib/button-styles";
import { AdminLogo } from "@/components/admin-logo";
import { ADMIN_PAGE_TITLE } from "@/lib/typography-styles";

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
      {/* pr-14 — резерв під плаваючу ThemeToggle-кнопку (position: fixed,
          top-4 right-4, у кореневому layout.tsx) — той самий, що раніше був
          у спільному admin/layout.tsx nav, перенесений сюди разом з "До
          кабінету" (admin/layout.tsx більше не рендерить жодного nav). */}
      <nav className="mb-8 flex items-center justify-between gap-4 border-b border-gray-200 pb-4 pr-14 dark:border-neutral-800">
        <AdminLogo />
        <Link
          href="/dashboard"
          className="text-sm text-slate-500 no-underline hover:text-brand dark:text-neutral-400 dark:hover:text-brand"
        >
          До кабінету
        </Link>
      </nav>
      <div className="flex items-center justify-between">
        <h1 className={ADMIN_PAGE_TITLE}>Курси</h1>
        <Link
          href="/admin/courses/new"
          className={BUTTON_PRIMARY_LG}
        >
          + Новий курс
        </Link>
      </div>

      <div className="mt-4 flex gap-1 border-b border-gray-200 dark:border-neutral-800">
        <Link
          href="/admin/courses"
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
            !showArchived
              ? "border-brand text-brand"
              : "border-transparent text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300"
          }`}
        >
          Активні
        </Link>
        <Link
          href="/admin/courses?archived=1"
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
            showArchived
              ? "border-brand text-brand"
              : "border-transparent text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300"
          }`}
        >
          Архівні
        </Link>
      </div>

      <ul className="mt-4 flex flex-col gap-2">
        {products?.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between rounded-md border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-300 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:border-indigo-700 dark:hover:bg-neutral-700"
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
                    ? "bg-accent/10 text-accent"
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
                      className={BUTTON_SECONDARY_SM}
                    >
                      Відновити
                    </SubmitButton>
                  </form>
                  <ConfirmForm
                    action={deleteProductPermanently.bind(null, p.id)}
                    message="Курс і весь вміст (сцени, тести, матеріали, завдання) буде видалено назавжди. Це незворотно. Ви впевнені?"
                  >
                    <SubmitButton
                      pendingChildren="…"
                      aria-label="Видалити курс назавжди"
                      title="Видалити назавжди"
                      className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
                    >
                      <Trash2 size={16} />
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
