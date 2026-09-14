import Link from "next/link";
import { createProduct } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { FileUpload } from "@/components/file-upload";
import { CourseTypeFields } from "./course-type-fields";
import { BUTTON_PRIMARY_LG } from "@/lib/button-styles";
import { AdminLogo } from "@/components/admin-logo";

export default async function NewCoursePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      <div className="mb-6 border-b pb-4">
        <AdminLogo />
      </div>
      <Link href="/admin/courses" className="text-sm underline">
        ← До списку курсів
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Новий курс</h1>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <form action={createProduct} className="mt-4 flex flex-col gap-4">
        <CourseTypeFields />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Назва</label>
          <input name="title" required className="rounded-md border px-3 py-2" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Опис</label>
          <textarea name="description" rows={3} className="rounded-md border px-3 py-2" />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Ціна (грн)</label>
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            defaultValue="0"
            className="rounded-md border px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Обкладинка (URL)</label>
          <input name="cover_image_url" type="url" className="rounded-md border px-3 py-2" />
          <label className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Або завантажити картинку (перекриє URL вище, якщо вибрано)
          </label>
          <FileUpload kind="image" name="cover_image_file_url" />
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
