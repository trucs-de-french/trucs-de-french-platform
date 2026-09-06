import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeCalloutHtml } from "@/lib/sanitize-callout-html";
import { STYLE_CLASSES, STYLE_ICONS } from "@/components/exercises/callout";
import type { CalloutStyle } from "@/lib/exercises/types";
import { getPreviewCourseId, isVisibleToEnrolledStudent } from "@/lib/course-preview";
import { PreviewBanner, PreviewBlocked } from "@/components/preview-banner";
import { ExerciseBlock, type ExerciseTask } from "../../exercise-block";
import { TaskGroupBlock, type TaskGroupData } from "../../task-group-block";

export default async function MaterialPage({
  params,
}: {
  params: Promise<{ productId: string; materialId: string }>;
}) {
  const { productId, materialId } = await params;
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("materials")
    .select("id, product_id, title, file_url, content, style, category")
    .eq("id", materialId)
    .single();

  if (!material || material.product_id !== productId) {
    notFound();
  }

  const previewCourseId = await getPreviewCourseId();
  const isPreviewing = previewCourseId === productId;
  let previewBlocked = false;
  if (isPreviewing) {
    const { data: previewProduct } = await supabase
      .from("products")
      .select("is_published, archived_at")
      .eq("id", productId)
      .single();
    previewBlocked = !previewProduct || !isVisibleToEnrolledStudent(previewProduct);
  }

  if (previewBlocked) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Link href={`/courses/${productId}?tab=materials`} className="text-sm underline">
          ← До матеріалів
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{material.title ?? "Матеріал"}</h1>
        <PreviewBlocked productId={productId} />
      </main>
    );
  }

  // Категорійна різниця лише у вправах: "Рекомендації DELF" — без вправ,
  // "Загальні рекомендації" — з вправами. PDF показується для обох
  // категорій (і для нетегованих "Інше"), якщо file_url заповнений.
  const showExercises = material.category !== "delf_guide";

  const [{ data: exercises }, { data: taskGroups }] = showExercises
    ? await Promise.all([
        supabase
          .from("tasks")
          .select(
            "id, type, title, config, image_url, audio_url, points_visible, order_index, games(embed_url, provider)"
          )
          .eq("material_id", materialId)
          .is("task_group_id", null)
          .order("order_index")
          .returns<(ExerciseTask & { order_index: number })[]>(),
        supabase
          .from("task_groups")
          .select("id, content_type, content_text, media_url, media_provider, points_mode, order_index")
          .eq("material_id", materialId)
          .order("order_index")
          .returns<(TaskGroupData & { order_index: number })[]>(),
      ])
    : [{ data: null }, { data: null }];

  const groupIds = (taskGroups ?? []).map((g) => g.id);
  const { data: groupMembers } =
    groupIds.length > 0
      ? await supabase
          .from("tasks")
          .select(
            "id, type, title, config, image_url, audio_url, points_visible, task_group_id, games(embed_url, provider)"
          )
          .in("task_group_id", groupIds)
          .order("order_index")
          .returns<(ExerciseTask & { task_group_id: string })[]>()
      : { data: null };

  const membersByGroup = new Map<string, ExerciseTask[]>();
  for (const m of groupMembers ?? []) {
    const arr = membersByGroup.get(m.task_group_id) ?? [];
    arr.push(m);
    membersByGroup.set(m.task_group_id, arr);
  }

  // Блоки без жодної задачі-члена не рендеримо взагалі студенту — той самий
  // принцип, що вже в delf-test-tasks.tsx.
  type Row =
    | { kind: "task"; task: ExerciseTask & { order_index: number } }
    | { kind: "group"; group: TaskGroupData & { order_index: number }; members: ExerciseTask[] };
  const rows: Row[] = [
    ...(exercises ?? []).map((task): Row => ({ kind: "task", task })),
    ...(taskGroups ?? [])
      .filter((g) => (membersByGroup.get(g.id) ?? []).length > 0)
      .map((group): Row => ({ kind: "group", group, members: membersByGroup.get(group.id)! })),
  ].sort((a, b) => {
    const aIndex = a.kind === "task" ? a.task.order_index : a.group.order_index;
    const bIndex = b.kind === "task" ? b.task.order_index : b.group.order_index;
    return aIndex - bIndex;
  });

  const style = (material.style as CalloutStyle) ?? "none";
  // Друга (визначальна для показу) санітизація — на межі рендеру, той самий
  // принцип, що в CalloutExercise, незалежно від того, що вже мало бути
  // санітизовано при збереженні.
  const safeHtml = material.content ? sanitizeCalloutHtml(material.content) : null;
  const hasPdf = !!material.file_url;
  const hasExercises = showExercises && rows.length > 0;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href={`/courses/${productId}?tab=materials`} className="text-sm underline">
        ← До матеріалів
      </Link>

      {isPreviewing && <PreviewBanner productId={productId} />}

      <h1 className="mt-2 text-2xl font-semibold">{material.title ?? "Матеріал"}</h1>

      {safeHtml && (
        <div className={`mt-4 flex gap-2 rounded-md border-2 p-3 ${STYLE_CLASSES[style]}`}>
          <span aria-hidden className="shrink-0">
            {STYLE_ICONS[style]}
          </span>
          <div className="rich-text" dangerouslySetInnerHTML={{ __html: safeHtml }} />
        </div>
      )}

      {hasPdf && (
        <a
          href={material.file_url!}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          Завантажити PDF
        </a>
      )}

      {hasExercises && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">Вправи</h2>
          <ul className="mt-2 flex flex-col gap-3">
            {rows.map((row) =>
              row.kind === "group" ? (
                <li key={`group-${row.group.id}`}>
                  <TaskGroupBlock group={row.group} tasks={row.members} />
                </li>
              ) : (
                <li
                  key={row.task.id}
                  className={row.task.type === "callout" ? "" : "rounded-md border p-3"}
                >
                  <ExerciseBlock task={row.task} />
                </li>
              )
            )}
          </ul>
        </section>
      )}

      {!safeHtml && !hasPdf && !hasExercises && (
        <p className="mt-4 text-neutral-500 dark:text-neutral-400">
          Цей матеріал поки порожній.
        </p>
      )}
    </main>
  );
}
