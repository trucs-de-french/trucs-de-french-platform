import Link from "next/link";
import { Copy, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateMaterial, deleteMaterial } from "@/app/admin/materials/actions";
import { deleteTask, moveTask } from "@/app/admin/tasks/actions";
import { deleteTaskGroup, moveTaskGroup } from "@/app/admin/task-groups/actions";
import { fetchGroupMemberTasks, resolveGroupMaxPoints } from "@/app/admin/block-points";
import { SaveForm } from "@/components/save-form";
import { SubmitButton } from "@/components/submit-button";
import { pluralizePoints } from "@/lib/pluralize-points";
import { MaterialArticleFields } from "../material-article-fields";
import { BUTTON_SECONDARY, BUTTON_DANGER } from "@/lib/button-styles";
import { INPUT_BORDER } from "@/lib/input-styles";
import { H2_TEXT, BREADCRUMB_LINK, LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";
import { TASK_GROUP_CONTENT_COLORS, TASK_GROUP_CONTENT_ICON } from "@/lib/exercises/task-type-meta";

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

  // Секція "Вправи" — лише для general_tip (за задумом delf_guide вправ не
  // має взагалі, не просто показує порожній список).
  const { data: exercises } =
    material.category === "general_tip"
      ? await supabase
          .from("tasks")
          .select("id, type, title, order_index")
          .eq("material_id", materialId)
          .is("task_group_id", null)
          .order("order_index")
      : { data: null };

  const { data: exerciseGroups } =
    material.category === "general_tip"
      ? await supabase
          .from("task_groups")
          .select("id, title, content_type, points_mode, flat_points, order_index")
          .eq("material_id", materialId)
          .order("order_index")
      : { data: null };

  // Максимум балів блоку (для бейджа поруч із назвою) — той самий принцип,
  // що на флет-списку курсу (admin/courses/[id]/page.tsx).
  const memberTasksByGroup = await fetchGroupMemberTasks(
    supabase,
    (exerciseGroups ?? []).map((g) => g.id)
  );

  // Задачі й блоки конкурують за одну спільну послідовність order_index
  // (task-order.ts) — зливаємо для рендеру в один список, той самий принцип,
  // що на флет-списку курсу (admin/courses/[id]/page.tsx).
  type Row =
    | { kind: "task"; id: string; order_index: number; type: string; title: string }
    | { kind: "group"; id: string; order_index: number; title: string | null; content_type: string; maxPoints: number };
  const rows: Row[] = [
    ...(exercises ?? []).map((t): Row => ({ kind: "task", ...t })),
    ...(exerciseGroups ?? []).map(
      (g): Row => ({
        kind: "group",
        ...g,
        maxPoints: resolveGroupMaxPoints(g, memberTasksByGroup[g.id] ?? []),
      })
    ),
  ].sort((a, b) => a.order_index - b.order_index);

  return (
    <div>
      <Link href={`/admin/courses/${productId}#materials`} className={BREADCRUMB_LINK}>
        ← Назад до матеріалів
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Редагування матеріалу</h1>

      <SaveForm
        action={updateMaterial.bind(null, material.id)}
        className="mt-4 flex flex-col gap-4 rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
        sticky
      >
        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Назва</label>
          <input
            name="title"
            defaultValue={material.title ?? ""}
            required
            className={`${INPUT_BORDER} px-3 py-2 text-base font-medium`}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>Категорія</label>
          <select
            name="category"
            defaultValue={material.category ?? ""}
            className={`${INPUT_BORDER} px-2 py-2 text-sm`}
          >
            <option value="">— Без категорії —</option>
            <option value="delf_guide">Рекомендації DELF (як здати іспит)</option>
            <option value="general_tip">Загальні рекомендації (типові помилки)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className={LABEL_TEXT}>
            Посилання на PDF (URL, необов&apos;язково)
          </label>
          <input
            name="file_url"
            type="url"
            defaultValue={material.file_url ?? ""}
            className={`${INPUT_BORDER} px-2 py-2 text-sm`}
          />
        </div>

        <MaterialArticleFields initialContent={material.content} initialStyle={material.style} />
      </SaveForm>

      {material.category === "general_tip" && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className={H2_TEXT}>Вправи</h2>
            <div className="flex gap-2">
              <Link
                href={`/admin/courses/${productId}/task-groups/new?materialId=${material.id}`}
                className={BUTTON_SECONDARY}
              >
                + Блок
              </Link>
              <Link
                href={`/admin/courses/${productId}/tasks/new?materialId=${material.id}`}
                className={BUTTON_SECONDARY}
              >
                + Нове завдання
              </Link>
            </div>
          </div>

          <ul className="mt-3 flex flex-col gap-2">
            {rows.map((row, i) => {
              if (row.kind === "group") {
                const ContentIcon = TASK_GROUP_CONTENT_ICON[row.content_type];
                return (
                <li
                  key={`group-${row.id}`}
                  className="flex items-center justify-between rounded-md border border-indigo-100 bg-indigo-50/30 p-3 dark:border-indigo-900 dark:bg-indigo-950/20"
                >
                  <div className="flex items-center gap-2">
                    {ContentIcon && (
                      <span
                        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                          TASK_GROUP_CONTENT_COLORS[row.content_type]?.badge ?? ""
                        }`}
                        aria-hidden
                      >
                        <ContentIcon size={14} />
                      </span>
                    )}
                    <div>
                      <span className={`uppercase ${HINT_TEXT}`}>
                        Блок · {row.content_type}
                        {row.maxPoints > 0 && ` · ${row.maxPoints} ${pluralizePoints(row.maxPoints)}`}
                      </span>
                      <Link
                        href={`/admin/courses/${productId}/task-groups/${row.id}`}
                        className="block font-medium hover:underline"
                      >
                        {row.title || "Без назви"}
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <form action={moveTaskGroup.bind(null, row.id, "up")}>
                      <SubmitButton
                        disabled={i === 0}
                        aria-label="Перемістити вище"
                        title="Перемістити вище"
                        className="rounded p-1.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 dark:text-neutral-500 dark:hover:text-neutral-200"
                      >
                        <ChevronUp size={16} />
                      </SubmitButton>
                    </form>
                    <form action={moveTaskGroup.bind(null, row.id, "down")}>
                      <SubmitButton
                        disabled={i === rows.length - 1}
                        aria-label="Перемістити нижче"
                        title="Перемістити нижче"
                        className="rounded p-1.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 dark:text-neutral-500 dark:hover:text-neutral-200"
                      >
                        <ChevronDown size={16} />
                      </SubmitButton>
                    </form>
                    <form action={deleteTaskGroup.bind(null, row.id)}>
                      <SubmitButton
                        pendingChildren="…"
                        aria-label="Видалити блок"
                        title="Видалити"
                        className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
                      >
                        <Trash2 size={16} />
                      </SubmitButton>
                    </form>
                  </div>
                </li>
                );
              }
              return (
                <li
                  key={`task-${row.id}`}
                  className="flex items-center justify-between rounded-md border border-gray-200 bg-white p-3 shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
                >
                  <div>
                    <span className={`uppercase ${HINT_TEXT}`}>
                      {row.type}
                    </span>
                    <Link
                      href={`/admin/courses/${productId}/tasks/${row.id}`}
                      className="block font-medium hover:underline"
                    >
                      {row.title}
                    </Link>
                  </div>
                  <div className="flex items-center gap-1">
                    <form action={moveTask.bind(null, row.id, "up")}>
                      <SubmitButton
                        disabled={i === 0}
                        aria-label="Перемістити вище"
                        title="Перемістити вище"
                        className="rounded p-1.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 dark:text-neutral-500 dark:hover:text-neutral-200"
                      >
                        <ChevronUp size={16} />
                      </SubmitButton>
                    </form>
                    <form action={moveTask.bind(null, row.id, "down")}>
                      <SubmitButton
                        disabled={i === rows.length - 1}
                        aria-label="Перемістити нижче"
                        title="Перемістити нижче"
                        className="rounded p-1.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 dark:text-neutral-500 dark:hover:text-neutral-200"
                      >
                        <ChevronDown size={16} />
                      </SubmitButton>
                    </form>
                    <Link
                      href={`/admin/courses/${productId}/tasks/${row.id}/copy`}
                      aria-label="Копіювати задачу"
                      title="Копіювати"
                      className="rounded p-1.5 text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
                    >
                      <Copy size={16} />
                    </Link>
                    <form action={deleteTask.bind(null, row.id)}>
                      <SubmitButton
                        pendingChildren="…"
                        aria-label="Видалити задачу"
                        title="Видалити"
                        className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
                      >
                        <Trash2 size={16} />
                      </SubmitButton>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
          {rows.length === 0 && (
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              Вправ ще немає.
            </p>
          )}
        </section>
      )}

      <form action={deleteMaterial.bind(null, material.id, productId)} className="mt-3">
        <SubmitButton
          pendingChildren="Видаляю..."
          className={`inline-flex items-center gap-1.5 ${BUTTON_DANGER}`}
        >
          <Trash2 size={16} />
          Видалити матеріал
        </SubmitButton>
      </form>
    </div>
  );
}
