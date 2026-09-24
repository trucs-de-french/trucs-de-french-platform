import Link from "next/link";
import { createProduct } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { FileOrLinkField } from "@/components/file-or-link-field";
import { CourseTypeFields } from "./course-type-fields";
import { BUTTON_PRIMARY_LG } from "@/lib/button-styles";
import { AdminLogo } from "@/components/admin-logo";
import { INPUT_BORDER } from "@/lib/input-styles";
import { ADMIN_PAGE_TITLE, BREADCRUMB_LINK, LABEL_TEXT } from "@/lib/typography-styles";

export default async function NewCoursePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      {/* pr-14 — той самий резерв під плаваючу ThemeToggle-кнопку, що був у
          спільному admin/layout.tsx nav (тепер видаленому). */}
      <nav className="mb-8 flex items-center justify-between gap-4 border-b border-gray-200 pb-4 pr-14 dark:border-neutral-800">
        <AdminLogo />
        <Link
          href="/dashboard"
          className="text-sm text-slate-500 no-underline hover:text-brand dark:text-neutral-400 dark:hover:text-brand"
        >
          До кабінету
        </Link>
      </nav>
      <Link href="/admin/courses" className={BREADCRUMB_LINK}>
        ← До списку курсів
      </Link>
      <h1 className={`mt-2 ${ADMIN_PAGE_TITLE}`}>Новий курс</h1>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <form action={createProduct} className="mt-4 flex flex-col gap-4">
        <CourseTypeFields />

        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Назва</label>
          <input name="title" required className={`${INPUT_BORDER} px-3 py-2`} />
        </div>

        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Опис</label>
          <textarea name="description" rows={3} className={`${INPUT_BORDER} px-3 py-2`} />
        </div>

        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Ціна (грн)</label>
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            className={`${INPUT_BORDER} px-3 py-2`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Обкладинка</label>
          <FileOrLinkField
            kind="image"
            mode="name"
            urlName="cover_image_url"
            uploadName="cover_image_file_url"
            placeholder="URL картинки"
          />
        </div>

        <SubmitButton
          pendingChildren="Створюю..."
          className={`self-start ${BUTTON_PRIMARY_LG}`}
        >
          Створити
        </SubmitButton>
      </form>
    </div>
  );
}
