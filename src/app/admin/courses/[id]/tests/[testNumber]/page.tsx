import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchGroupMemberTasks, resolveGroupMaxPoints } from "@/app/admin/block-points";
import { EXAM_SECTIONS, EXAM_SECTION_LABELS, type ExamSection } from "@/lib/delf/exam-structure";
import { deleteTest, toggleTestPublish } from "@/app/admin/tests/actions";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmForm } from "@/components/confirm-form";
import { BUTTON_PRIMARY, BUTTON_SECONDARY, BUTTON_WARNING, BUTTON_DANGER } from "@/lib/button-styles";
import { TestSectionDragList } from "./test-section-drag-list";

// Сторінка ОДНОГО DELF-тесту (номер 1-30) — той самий принцип, що сторінка
// сцени фільму, лише замість однієї спільної послідовності задач тут ЧОТИРИ
// незалежні секції (CO/CE/PE/PO, EXAM_SECTIONS), кожна зі своїм власним
// order_index-скоупом (task-order.ts, Крок 1) і власним перетягуваним
// списком. Досі немає окремої таблиці для самого поняття "тест" — номер
// існує лише як значення delf_test_number на задачах/блоках (той самий
// підхід, що в студентському DelfTestGrid); є лише delf_tests
// (0035_delf_test_published.sql) — суто візуальний прапорець
// опубліковано/чернетка для сітки на сторінці курсу, не джерело істини про
// існування тесту.
export default async function AdminTestPage({
  params,
}: {
  params: Promise<{ id: string; testNumber: string }>;
}) {
  const { id: productId, testNumber: testNumberParam } = await params;
  const testNumber = Number(testNumberParam);
  if (!Number.isInteger(testNumber) || testNumber < 1) notFound();

  const supabase = await createClient();

  const [{ data: product }, { data: tasks }, { data: taskGroups }, { data: delfTest }] =
    await Promise.all([
      supabase.from("products").select("id, title, type, level").eq("id", productId).single(),
      supabase
        .from("tasks")
        .select("id, type, title, config, order_index, delf_section")
        .eq("product_id", productId)
        .eq("delf_test_number", testNumber)
        .order("order_index"),
      supabase
        .from("task_groups")
        .select(
          "id, title, content_type, points_mode, flat_points, order_index, delf_section"
        )
        .eq("product_id", productId)
        .eq("delf_test_number", testNumber)
        .order("order_index"),
      supabase
        .from("delf_tests")
        .select("is_published")
        .eq("product_id", productId)
        .eq("test_number", testNumber)
        .maybeSingle(),
    ]);
  const isTestPublished = delfTest?.is_published ?? false;

  // type !== "delf" — сторінка тесту не має сенсу для фільмів (немає
  // delf_section/delf_test_number), той самий guard, що isFilm на сторінці
  // курсу.
  if (!product || product.type !== "delf") notFound();

  const memberTasksByGroup = await fetchGroupMemberTasks(
    supabase,
    (taskGroups ?? []).map((g) => g.id)
  );

  type Row =
    | {
        kind: "task";
        id: string;
        type: string;
        title: string;
        config: Record<string, unknown> | null;
        order_index: number;
      }
    | {
        kind: "group";
        id: string;
        title: string | null;
        content_type: string;
        order_index: number;
        maxPoints: number;
      };

  // Групуємо за секцією ПІСЛЯ мержу задач+блоків (не до) — той самий
  // принцип сортування за спільним order_index, що на сторінці сцени, лише
  // застосований чотири рази (по одному на секцію), бо кожна секція має
  // власну незалежну послідовність.
  const rowsBySection: Record<ExamSection, Row[]> = { CO: [], CE: [], PE: [], PO: [] };
  for (const t of tasks ?? []) {
    const section = t.delf_section as ExamSection | null;
    if (section && section in rowsBySection) {
      rowsBySection[section].push({ kind: "task", ...t });
    }
  }
  for (const g of taskGroups ?? []) {
    const section = g.delf_section as ExamSection | null;
    if (section && section in rowsBySection) {
      rowsBySection[section].push({
        kind: "group",
        ...g,
        maxPoints: resolveGroupMaxPoints(g, memberTasksByGroup[g.id] ?? []),
      });
    }
  }
  for (const section of EXAM_SECTIONS) {
    rowsBySection[section].sort((a, b) => a.order_index - b.order_index);
  }

  return (
    <div>
      <Link href={`/admin/courses/${productId}#tasks`} className="text-sm underline">
        ← До курсу
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-heading text-2xl font-bold">
          Тест {testNumber}
          {product.level && (
            <span className="ml-2 text-base font-normal text-neutral-500 dark:text-neutral-400">
              {product.level}
            </span>
          )}
        </h1>
        <div className="flex items-center gap-2">
          <form action={toggleTestPublish.bind(null, productId, testNumber, !isTestPublished)}>
            <SubmitButton
              pendingChildren="..."
              className={isTestPublished ? BUTTON_WARNING : BUTTON_PRIMARY}
            >
              {isTestPublished ? "Зняти з публікації" : "Опублікувати"}
            </SubmitButton>
          </form>
          <ConfirmForm
            action={deleteTest.bind(null, productId, testNumber)}
            message={`Тест ${testNumber} і всі його задачі (${(tasks?.length ?? 0) + (taskGroups?.length ?? 0)}) буде видалено назавжди. Це незворотно. Ви впевнені?`}
          >
            <SubmitButton pendingChildren="..." className={BUTTON_DANGER}>
              Видалити тест
            </SubmitButton>
          </ConfirmForm>
        </div>
      </div>

      {EXAM_SECTIONS.map((section) => (
        <section key={section} className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">
              {section} — {EXAM_SECTION_LABELS[section]}
            </h2>
            <div className="flex gap-2">
              <Link
                href={`/admin/courses/${productId}/task-groups/new?delfSection=${section}&delfTestNumber=${testNumber}`}
                className={BUTTON_SECONDARY}
              >
                + Блок
              </Link>
              <Link
                href={`/admin/courses/${productId}/tasks/new?delfSection=${section}&delfTestNumber=${testNumber}`}
                className={BUTTON_SECONDARY}
              >
                + Нове завдання
              </Link>
            </div>
          </div>

          <div className="mt-2">
            <TestSectionDragList
              key={rowsBySection[section].map((r) => r.id).join(",")}
              productId={productId}
              delfSection={section}
              testNumber={testNumber}
              initialRows={rowsBySection[section]}
            />
          </div>
        </section>
      ))}
    </div>
  );
}
