import { createClient } from "@/lib/supabase/server";
import { EXAM_SECTIONS, EXAM_SECTION_LABELS, type ExamSection } from "@/lib/delf/exam-structure";
import { ExerciseBlock, type ExerciseTask } from "./exercise-block";

type TestTask = ExerciseTask & { delf_section: string | null };

// Той самий список задач рендериться і для Entraînement, і (пізніше) для
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
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, type, title, config, image_url, audio_url, delf_section")
    .eq("product_id", productId)
    .eq("delf_test_number", testNumber)
    .is("scene_id", null)
    .is("material_id", null)
    .order("order_index")
    .returns<TestTask[]>();

  if (!tasks || tasks.length === 0) {
    return (
      <p className="mt-4 text-neutral-500 dark:text-neutral-400">
        Для цього тесту ще немає задач.
      </p>
    );
  }

  const bySection = new Map<ExamSection, TestTask[]>();
  for (const section of EXAM_SECTIONS) bySection.set(section, []);
  const noSection: TestTask[] = [];
  for (const task of tasks) {
    if (EXAM_SECTIONS.includes(task.delf_section as ExamSection)) {
      bySection.get(task.delf_section as ExamSection)!.push(task);
    } else {
      noSection.push(task);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-8">
      {EXAM_SECTIONS.map((section) => {
        const sectionTasks = bySection.get(section) ?? [];
        if (sectionTasks.length === 0) return null;
        return (
          <section key={section}>
            <h2 className="text-lg font-medium">
              {section} — {EXAM_SECTION_LABELS[section]}
            </h2>
            <ul className="mt-2 flex flex-col gap-3">
              {sectionTasks.map((task) => (
                <li key={task.id} className="rounded-md border p-3">
                  <ExerciseBlock task={task} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {noSection.length > 0 && (
        <section>
          <h2 className="text-lg font-medium">Без секції</h2>
          <ul className="mt-2 flex flex-col gap-3">
            {noSection.map((task) => (
              <li key={task.id} className="rounded-md border p-3">
                <ExerciseBlock task={task} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
