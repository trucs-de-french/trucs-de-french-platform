import Link from "next/link";
import { createMaterial } from "@/app/admin/materials/actions";
import { SubmitButton } from "@/components/submit-button";
import { MaterialArticleFields } from "../material-article-fields";
import { BUTTON_PRIMARY_LG } from "@/lib/button-styles";
import { INPUT_BORDER } from "@/lib/input-styles";
import { BREADCRUMB_LINK, LABEL_TEXT } from "@/lib/typography-styles";

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
      <Link href={`/admin/courses/${productId}#materials`} className={BREADCRUMB_LINK}>
        ← До матеріалів
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Новий матеріал</h1>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <form
        action={createMaterial.bind(null, productId)}
        className="mt-4 flex flex-col gap-4 rounded-md border bg-white p-4 dark:bg-neutral-800"
      >
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Назва</label>
          <input
            name="title"
            required
            className={`${INPUT_BORDER} px-3 py-2 text-base font-medium`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Категорія</label>
          <select name="category" defaultValue="" className={`${INPUT_BORDER} px-2 py-2 text-sm`}>
            <option value="">— Без категорії —</option>
            <option value="delf_guide">Рекомендації DELF (як здати іспит)</option>
            <option value="general_tip">Загальні рекомендації (типові помилки)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>
            Посилання на PDF (URL, необов&apos;язково)
          </label>
          <input name="file_url" type="url" className={`${INPUT_BORDER} px-2 py-2 text-sm`} />
        </div>

        <MaterialArticleFields />

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
