import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { bulkCreateTasksFromVocab } from "@/app/admin/tasks/actions";
import { collectSceneVocab, type VocabItem } from "@/lib/vocab";
import { blockDomId } from "@/lib/block-dom-id";
import { ADMIN_PAGE_TITLE, BREADCRUMB_LINK } from "@/lib/typography-styles";
import { BulkFromVocabForm } from "./bulk-from-vocab-form";

// Лише для сцен — словник (dialogue.vocab) є тільки в них, на відміну від
// матеріалів/DELF-тестів. taskGroupId — опційний: коли є, нові задачі йдуть
// у цей блок (вхід "Вправи блоку"), інакше — прямо в список "Завдання"
// сцени (вхід там-таки, поруч із "+ Нове завдання").
export default async function BulkFromVocabPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; sceneId: string }>;
  searchParams: Promise<{ taskGroupId?: string; anchor?: string }>;
}) {
  const { id: productId, sceneId } = await params;
  const { taskGroupId, anchor } = await searchParams;

  const supabase = await createClient();
  const { data: scene } = await supabase
    .from("scenes")
    .select("id, title, dialogue")
    .eq("id", sceneId)
    .eq("product_id", productId)
    .single();

  if (!scene) notFound();

  const sceneVocab: VocabItem[] = collectSceneVocab((scene.dialogue ?? []) as { vocab?: VocabItem[] }[]);

  // Той самий якір, куди приведе й сам сабміт (bulkCreateTasksFromVocab) —
  // "Назад" і "після створення" ведуть в те саме місце, звідки прийшли.
  const resolvedAnchor = anchor ?? (taskGroupId ? null : blockDomId("task"));
  const backHref = `/admin/courses/${productId}/scenes/${sceneId}${resolvedAnchor ? `#${resolvedAnchor}` : ""}`;

  return (
    <div>
      <Link href={backHref} className={BREADCRUMB_LINK}>
        ← До сцени
      </Link>
      <h1 className={`mt-2 ${ADMIN_PAGE_TITLE}`}>Створити вправи зі словника</h1>

      <BulkFromVocabForm
        action={bulkCreateTasksFromVocab}
        productId={productId}
        sceneId={sceneId}
        taskGroupId={taskGroupId ?? null}
        anchor={resolvedAnchor}
        sceneVocab={sceneVocab}
      />
    </div>
  );
}
