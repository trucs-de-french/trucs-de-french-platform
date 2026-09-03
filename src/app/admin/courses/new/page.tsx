import Link from "next/link";
import { createProduct } from "../actions";
import { SubmitButton } from "@/components/submit-button";
import { CourseTypeFields } from "./course-type-fields";

export default async function NewCoursePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
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
        </div>

        <SubmitButton
          pendingChildren="Створюю..."
          className="self-start rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Створити
        </SubmitButton>
      </form>
    </div>
  );
}
