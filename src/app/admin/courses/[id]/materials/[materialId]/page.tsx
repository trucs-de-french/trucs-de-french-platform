import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateMaterial, deleteMaterial } from "@/app/admin/materials/actions";
import { SaveForm } from "@/components/save-form";
import { SubmitButton } from "@/components/submit-button";
import { MaterialArticleFields } from "../material-article-fields";
import { MaterialCategoryFileFields } from "../material-category-file-fields";

export default async function EditMaterialPage({
  params,
}: {
  params: Promise<{ id: string; materialId: string }>;
}) {
  const { id: productId, materialId } = await params;
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("materials")
    .select("id, title, file_url, category, content, style")
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

        <MaterialCategoryFileFields
          initialCategory={material.category}
          initialFileUrl={material.file_url}
        />

        <MaterialArticleFields initialContent={material.content} initialStyle={material.style} />
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
