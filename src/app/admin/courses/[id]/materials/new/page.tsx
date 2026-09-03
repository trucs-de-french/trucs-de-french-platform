import { createMaterial } from "@/app/admin/materials/actions";
import { SubmitButton } from "@/components/submit-button";
import { MaterialArticleFields } from "../material-article-fields";
import { MaterialCategoryFileFields } from "../material-category-file-fields";

export default async function NewMaterialPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: productId } = await params;
  const { error } = await searchParams;

  return (
    <div>
      <h1 className="text-2xl font-bold">Новий матеріал</h1>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <form
        action={createMaterial.bind(null, productId)}
        className="mt-4 flex flex-col gap-4 rounded-md border p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">Назва</label>
          <input
            name="title"
            required
            className="rounded-md border px-3 py-2 text-base font-medium"
          />
        </div>

        <MaterialCategoryFileFields />

        <MaterialArticleFields />

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
