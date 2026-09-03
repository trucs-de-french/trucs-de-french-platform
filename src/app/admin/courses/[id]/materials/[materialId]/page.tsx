import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateMaterial, deleteMaterial } from "@/app/admin/materials/actions";
import { SaveForm } from "@/components/save-form";
import { SubmitButton } from "@/components/submit-button";
import { MaterialArticleFields } from "../material-article-fields";

export default async function EditMaterialPage({
  params,
}: {
  params: Promise<{ id: string; materialId: string }>;
}) {
  const { id: productId, materialId } = await params;
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("materials")
    .select("id, title, file_url, category, content")
    .eq("id", materialId)
    .single();

  if (!material) notFound();

  return (
    <div>
      <h1 className="text-2xl font-bold">Редагування матеріалу</h1>

      <SaveForm
        action={updateMaterial.bind(null, material.id)}
        className="mt-4 flex flex-col gap-4 rounded-md border p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">Назва</label>
          <input
            name="title"
            defaultValue={material.title ?? ""}
            required
            className="rounded-md border px-3 py-2 text-base font-medium"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">Категорія</label>
          <select
            name="category"
            defaultValue={material.category ?? ""}
            className="rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">— Без категорії —</option>
            <option value="delf_guide">Рекомендації DELF (як здати іспит)</option>
            <option value="general_tip">Загальні рекомендації (типові помилки)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">
            Посилання на PDF (URL, необов&apos;язково)
          </label>
          <input
            name="file_url"
            type="url"
            defaultValue={material.file_url ?? ""}
            className="rounded-md border px-2 py-1.5 text-sm"
          />
        </div>

        <MaterialArticleFields initialContent={material.content} />
      </SaveForm>

      <form action={deleteMaterial.bind(null, material.id, productId)} className="mt-3">
        <SubmitButton
          pendingChildren="Видаляю..."
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
        >
          Видалити матеріал
        </SubmitButton>
      </form>
    </div>
  );
}
