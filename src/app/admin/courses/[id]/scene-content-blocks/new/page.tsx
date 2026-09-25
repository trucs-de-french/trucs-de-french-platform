import Link from "next/link";
import { createSceneContentBlock } from "@/app/admin/scene-content-blocks/actions";
import { SubmitButton } from "@/components/submit-button";
import { ContentBlockFields } from "../content-block-fields";
import { BUTTON_PRIMARY_LG } from "@/lib/button-styles";
import { BREADCRUMB_LINK } from "@/lib/typography-styles";
import { Z_ACTION_BAR } from "@/lib/z-layers";

export default async function NewSceneContentBlockPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sceneId: string }>;
}) {
  const { id: productId } = await params;
  const { sceneId } = await searchParams;

  const backHref = `/admin/courses/${productId}/scenes/${sceneId}`;

  return (
    <div>
      <Link href={backHref} className={BREADCRUMB_LINK}>
        ← До сцени
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Новий додатковий блок</h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Самостійний контент (текст/аудіо/відео/embed) на сцені, окремо від Відео/Скрипта/
        Практики/Завдання. Одразу після створення блок можна перетягнути на потрібне місце
        серед інших блоків сцени.
      </p>

      <form
        action={createSceneContentBlock}
        className="mt-4 flex flex-col gap-4 rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
      >
        <input type="hidden" name="product_id" value={productId} />
        <input type="hidden" name="scene_id" value={sceneId} />

        <ContentBlockFields />

        <div className={`sticky bottom-0 ${Z_ACTION_BAR} -mx-4 border-t border-gray-200 bg-white px-4 py-3 shadow-[0_-1px_3px_rgba(0,0,0,0.1)] dark:border-neutral-800 dark:bg-neutral-950`}>
          <SubmitButton pendingChildren="Створюю..." className={`self-start ${BUTTON_PRIMARY_LG}`}>
            Створити
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
