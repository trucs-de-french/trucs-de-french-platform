import { createClient } from "@/lib/supabase/server";
import { EXAM_SECTIONS, EXAM_SECTION_LABELS, type ExamSection } from "@/lib/delf/exam-structure";
import { ExerciseBlock, type ExerciseTask } from "./exercise-block";
import { TaskGroupBlock, type TaskGroupData } from "./task-group-block";

type TestTask = ExerciseTask & { delf_section: string | null };
type TestTaskGroup = TaskGroupData & {
  delf_section: string | null;
  order_index: number;
};

// Задачі й блоки ділять одну спільну послідовність order_index у межах
// одного батьківського контексту (task-order.ts, admin-сторона) — тут
// зливаємо їх в один сортований список для рендеру, той самий принцип, що
// вже застосований в адмінських списках (admin/courses/[id]/page.tsx
// тощо), лише студентською мовою: Row замість TestTask.
type Row =
  | { kind: "task"; task: TestTask; order_index: number }
  | { kind: "group"; group: TestTaskGroup; members: ExerciseTask[] };

// Той самий список рендериться і для Entraînement, і (пізніше) для
// Examen blanc — режим це спосіб проходження (таймер/фідбек), обраний
// студентом, а не окремо авторений контент (delf_mode на tasks був хибним
// припущенням і видалений).
export async function DelfTestTasks({
  productId,
  testNumber,
}: {
  productId: string;
  testNumber: number;
}) {
  const supabase = await createClient();
  const [{ data: tasks }, { data: taskGroups }] = await Promise.all([
    supabase
      .from("tasks")
      .select(
        "id, type, title, config, image_url, audio_url, delf_section, points_visible, order_index, games(embed_url, provider)"
      )
      .eq("product_id", productId)
      .eq("delf_test_number", testNumber)
      .is("scene_id", null)
      .is("material_id", null)
      .is("task_group_id", null)
      .order("order_index")
      .returns<(TestTask & { order_index: number })[]>(),
    supabase
      .from("task_groups")
      .select(
        "id, content_type, content_text, media_url, media_provider, points_mode, flat_points, delf_section, order_index"
      )
      .eq("product_id", productId)
      .eq("delf_test_number", testNumber)
      .is("scene_id", null)
      .is("material_id", null)
      .order("order_index")
      .returns<TestTaskGroup[]>(),
  ]);

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

  // Блоки без жодної задачі-члена (щойно створені, ще не наповнені) не
  // рендеримо взагалі студенту — показати спільний контент без жодного
  // питання під ним лише збентежило б.
  const nonEmptyGroups = (taskGroups ?? []).filter(
    (g) => (membersByGroup.get(g.id) ?? []).length > 0
  );

  if ((!tasks || tasks.length === 0) && nonEmptyGroups.length === 0) {
    return (
      <p className="mt-4 text-neutral-500 dark:text-neutral-400">
        Для цього тесту ще немає задач.
      </p>
    );
  }

  const rows: Row[] = [
    ...(tasks ?? []).map((task): Row => ({ kind: "task", task, order_index: task.order_index })),
    ...nonEmptyGroups.map(
      (group): Row => ({ kind: "group", group, members: membersByGroup.get(group.id)! })
    ),
  ];

  function sectionOf(row: Row): string | null {
    return row.kind === "task" ? row.task.delf_section : row.group.delf_section;
  }
  function orderOf(row: Row): number {
    return row.kind === "task" ? row.order_index : row.group.order_index;
  }

  const bySection = new Map<ExamSection, Row[]>();
  for (const section of EXAM_SECTIONS) bySection.set(section, []);
  const noSection: Row[] = [];
  for (const row of rows) {
    const section = sectionOf(row);
    if (EXAM_SECTIONS.includes(section as ExamSection)) {
      bySection.get(section as ExamSection)!.push(row);
    } else {
      noSection.push(row);
    }
  }
  for (const arr of bySection.values()) arr.sort((a, b) => orderOf(a) - orderOf(b));
  noSection.sort((a, b) => orderOf(a) - orderOf(b));

  function renderRow(row: Row) {
    if (row.kind === "group") {
      return (
        <li key={`group-${row.group.id}`} id={`group-${row.group.id}`} className="scroll-mt-4">
          <TaskGroupBlock group={row.group} tasks={row.members} />
        </li>
      );
    }
    const task = row.task;
    return (
      <li key={task.id} className={task.type === "callout" ? "" : "rounded-md border p-3"}>
        <ExerciseBlock task={task} />
      </li>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-8">
      {EXAM_SECTIONS.map((section) => {
        const sectionRows = bySection.get(section) ?? [];
        if (sectionRows.length === 0) return null;
        return (
          <section key={section}>
            <h2 className="text-lg font-medium">
              {section} — {EXAM_SECTION_LABELS[section]}
            </h2>
            <ul className="mt-2 flex flex-col gap-3">{sectionRows.map(renderRow)}</ul>
          </section>
        );
      })}

      {noSection.length > 0 && (
        <section>
          <h2 className="text-lg font-medium">Без секції</h2>
          <ul className="mt-2 flex flex-col gap-3">{noSection.map(renderRow)}</ul>
        </section>
      )}
    </div>
  );
}
