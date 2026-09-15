import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createTaskGroup } from "@/app/admin/task-groups/actions";
import { SubmitButton } from "@/components/submit-button";
import { TaskGroupFields } from "../task-group-fields";
import { BUTTON_PRIMARY_LG } from "@/lib/button-styles";
import { BREADCRUMB_LINK } from "@/lib/typography-styles";

export default async function NewTaskGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sceneId?: string;
    materialId?: string;
    delfSection?: string;
    delfTestNumber?: string;
  }>;
}) {
  const { id: productId } = await params;
  const { sceneId, materialId, delfSection, delfTestNumber } = await searchParams;

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
      : delfTestNumber
        ? `/admin/courses/${productId}/tests/${delfTestNumber}`
        : `/admin/courses/${productId}#tasks`;
  const backLabel = sceneId
    ? "← До сцени"
    : materialId
      ? "← До матеріалу"
      : delfTestNumber
        ? "← До тесту"
        : "← До курсу";

  return (
    <div>
      <Link href={backHref} className={BREADCRUMB_LINK}>
        {backLabel}
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Новий блок</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Спільний контент (текст/аудіо/відео/embed), під яким рендеряться кілька задач одним
        цілим, без окремих рамок навколо кожної.
      </p>

      <form
        action={createTaskGroup}
        className="mt-4 flex flex-col gap-4 rounded-md border bg-white p-4 dark:bg-neutral-800"
      >
        <input type="hidden" name="product_id" value={productId} />
        {sceneId && <input type="hidden" name="scene_id" value={sceneId} />}
        {materialId && <input type="hidden" name="material_id" value={materialId} />}

        <TaskGroupFields
          productType={product?.type}
          materialId={materialId}
          initialGroup={
            delfSection || delfTestNumber
              ? {
                  delf_section: delfSection ?? null,
                  delf_test_number: delfTestNumber ? Number(delfTestNumber) : null,
                }
              : undefined
          }
        />

        <div className="sticky bottom-0 -mx-4 border-t bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
          <SubmitButton
            pendingChildren="Створюю..."
            className={`self-start ${BUTTON_PRIMARY_LG}`}
          >
            Створити
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
