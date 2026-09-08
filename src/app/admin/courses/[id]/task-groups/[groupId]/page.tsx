import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  updateTaskGroup,
  deleteTaskGroup,
  attachTaskToGroup,
} from "@/app/admin/task-groups/actions";
import { resolveGroupMaxPoints } from "@/app/admin/block-points";
import { SaveForm } from "@/components/save-form";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmForm } from "@/components/confirm-form";
import { pluralizePoints } from "@/lib/pluralize-points";
import { TaskGroupFields, type TaskGroupInitial } from "../task-group-fields";
import { GroupMemberDragList } from "../group-member-drag-list";

type GroupDetail = TaskGroupInitial & {
  id: string;
  product_id: string;
  scene_id: string | null;
  material_id: string | null;
};

type MemberTask = {
  id: string;
  type: string;
  title: string;
  order_index: number;
  config: Record<string, unknown> | null;
};

export default async function EditTaskGroupPage({
  params,
}: {
  params: Promise<{ id: string; groupId: string }>;
}) {
  const { id: productId, groupId } = await params;
  const supabase = await createClient();

  const [{ data: group }, { data: product }] = await Promise.all([
    supabase
      .from("task_groups")
      .select(
        "id, product_id, scene_id, material_id, delf_section, delf_test_number, title, content_type, content_text, media_url, media_provider, points_mode, flat_points"
      )
      .eq("id", groupId)
      .single<GroupDetail>(),
    supabase.from("products").select("type").eq("id", productId).single(),
  ]);

  if (!group) notFound();

  const backHref = group.scene_id
    ? `/admin/courses/${productId}/scenes/${group.scene_id}`
    : group.material_id
      ? `/admin/courses/${productId}/materials/${group.material_id}`
      : `/admin/courses/${productId}#tasks`;
  const backLabel = group.scene_id ? "← До сцени" : group.material_id ? "← До матеріалу" : "← До курсу";

  // Студентська сторінка, де цей блок реально відображається — той самий
  // розподіл, що backHref, але веде на публічну сторону (сцени/матеріали
  // спільні з backHref, DELF — окремо, за номером тесту, той самий принцип,
  // що вже на сторінці редагування задачі). #group-{id} — якір на сам блок
  // (не лише на батьківську сторінку загалом), доданий на всіх трьох
  // студентських рендер-сайтах (Крок 3). null — коли для блоку взагалі
  // немає валідного студентського місця (сирота без номера DELF-тесту).
  const studentHref = group.scene_id
    ? `/courses/${productId}/scenes/${group.scene_id}#group-${group.id}`
    : group.material_id
      ? `/courses/${productId}/materials/${group.material_id}#group-${group.id}`
      : group.delf_test_number
        ? `/courses/${productId}/tests/${group.delf_test_number}#group-${group.id}`
        : null;

  const { data: members } = await supabase
    .from("tasks")
    .select("id, type, title, order_index, config")
    .eq("task_group_id", groupId)
    .order("order_index")
    .returns<MemberTask[]>();

  const maxPoints = resolveGroupMaxPoints(group, members ?? []);

  // Кандидати для "додати наявну задачу" — вільні задачі (без свого блоку)
  // того самого батьківського контексту, що й сам блок.
  let candidateQuery = supabase
    .from("tasks")
    .select("id, type, title")
    .eq("product_id", productId)
    .is("task_group_id", null);
  if (group.scene_id) {
    candidateQuery = candidateQuery.eq("scene_id", group.scene_id);
  } else if (group.material_id) {
    candidateQuery = candidateQuery.eq("material_id", group.material_id);
  } else {
    candidateQuery = candidateQuery
      .is("scene_id", null)
      .is("material_id", null)
      .eq("delf_section", group.delf_section ?? "")
      .eq("delf_test_number", group.delf_test_number ?? -1);
  }
  const { data: candidates } = await candidateQuery.order("order_index");

  return (
    <div>
      <Link href={backHref} className="text-sm underline">
        {backLabel}
      </Link>
      <div className="mt-2 flex items-center gap-2">
        <h1 className="text-2xl font-bold">Редагування блоку</h1>
        {maxPoints > 0 && (
          <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
            Максимум: {maxPoints} {pluralizePoints(maxPoints)}
          </span>
        )}
      </div>

      <SaveForm
        action={updateTaskGroup.bind(null, productId, group.id)}
        className="mt-4 flex flex-col gap-4 rounded-md border p-4"
        sticky
        backLink={{ href: backHref, label: backLabel }}
        previewLink={studentHref ? { productId, href: studentHref } : undefined}
      >
        <TaskGroupFields initialGroup={group} productType={product?.type} materialId={group.material_id} />
      </SaveForm>

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Задачі блоку</h2>
          <Link
            href={`/admin/courses/${productId}/tasks/new?taskGroupId=${group.id}`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            + Нова задача в блоці
          </Link>
        </div>

        <GroupMemberDragList
          key={members?.map((m) => m.id).join(",") ?? ""}
          groupId={group.id}
          productId={productId}
          initialMembers={members ?? []}
        />

        {candidates && candidates.length > 0 && (
          <form action={attachTaskToGroup} className="mt-3 flex items-center gap-2">
            <input type="hidden" name="task_group_id" value={group.id} />
            <select
              name="task_id"
              required
              defaultValue=""
              className="flex-1 rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="" disabled>
                — обрати наявну задачу —
              </option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.type}] {c.title}
                </option>
              ))}
            </select>
            <SubmitButton
              pendingChildren="Додаю..."
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              Додати до блоку
            </SubmitButton>
          </form>
        )}
      </section>

      <section className="mt-6 rounded-md border border-red-200 p-4 dark:border-red-900">
        <h2 className="text-lg font-medium text-red-700 dark:text-red-400">Небезпечна зона</h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Видалення блоку не видаляє задачі всередині — вони повертаються туди, де живе сам блок
          (сцена/матеріал/DELF-тест), і лишаються редагованими окремо.
        </p>
        <ConfirmForm
          action={deleteTaskGroup.bind(null, group.id)}
          message="Блок буде видалено. Задачі всередині НЕ видаляться — повернуться в контекст блоку. Продовжити?"
          className="mt-2"
        >
          <SubmitButton
            pendingChildren="..."
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
          >
            Видалити блок
          </SubmitButton>
        </ConfirmForm>
      </section>
    </div>
  );
}
