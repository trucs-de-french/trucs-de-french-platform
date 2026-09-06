import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createTaskGroup } from "@/app/admin/task-groups/actions";
import { SubmitButton } from "@/components/submit-button";
import { TaskGroupFields } from "../task-group-fields";

export default async function NewTaskGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sceneId?: string; materialId?: string }>;
}) {
  const { id: productId } = await params;
  const { sceneId, materialId } = await searchParams;

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("type")
    .eq("id", productId)
    .single();

  const backHref = sceneId
    ? `/admin/courses/${productId}/scenes/${sceneId}`
    : materialId
      ? `/admin/courses/${productId}/materials/${materialId}`
      : `/admin/courses/${productId}#tasks`;
  const backLabel = sceneId ? "← До сцени" : materialId ? "← До матеріалу" : "← До курсу";

  return (
    <div>
      <Link href={backHref} className="text-sm underline">
        {backLabel}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Новий блок</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Спільний контент (текст/аудіо/відео/embed), під яким рендеряться кілька задач одним
        цілим, без окремих рамок навколо кожної.
      </p>

      <form
        action={createTaskGroup}
        className="mt-4 flex flex-col gap-4 rounded-md border p-4"
      >
        <input type="hidden" name="product_id" value={productId} />
        {sceneId && <input type="hidden" name="scene_id" value={sceneId} />}
        {materialId && <input type="hidden" name="material_id" value={materialId} />}

        <TaskGroupFields productType={product?.type} materialId={materialId} />

        <div className="sticky bottom-0 -mx-4 border-t bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
          <SubmitButton
            pendingChildren="Створюю..."
            className="self-start rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
          >
            Створити
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
