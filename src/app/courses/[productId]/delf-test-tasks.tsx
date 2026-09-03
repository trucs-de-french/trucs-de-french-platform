import { createClient } from "@/lib/supabase/server";
import { TaskMedia } from "@/components/task-media";
import { EssayCheckExercise } from "@/components/exercises/essay-check";
import { CalloutExercise } from "@/components/exercises/callout";
import { ExerciseCard, isExerciseType } from "@/components/exercises/exercise-card";
import { sanitizeConfigForStudent } from "@/lib/exercises/sanitize";
import { EXAM_SECTIONS, EXAM_SECTION_LABELS, type ExamSection } from "@/lib/delf/exam-structure";
import type { CalloutConfig } from "@/lib/exercises/types";

type TestTask = {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown> | null;
  image_url: string | null;
  audio_url: string | null;
  delf_section: string | null;
};

// Рендер задач ОДНОГО тесту (CO+CE+PE+PO) — той самий набір компонентів і
// той самий sanitizeConfigForStudent (не пускати правильні відповіді на
// клієнт), що й у сценах фільмів (scenes/[sceneId]/page.tsx), але звужений
// до типів, релевантних CO/CE/PE: essay_check, callout (текст для CE) і всі
// auto-graded типи через ExerciseCard. vocab_quiz/error_correction/game/
// link/embed тут не мають сенсу (прив'язані до сцен фільмів) — свідомо не
// підтримуються.
//
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
                  <TaskExercise task={task} />
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
                <TaskExercise task={task} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function TaskExercise({ task }: { task: TestTask }) {
  return (
    <>
      <TaskMedia imageUrl={task.image_url} audioUrl={task.audio_url} />

      {task.type === "essay_check" && (
        <EssayCheckExercise
          taskId={task.id}
          prompt={(task.config as { prompt?: string } | null)?.prompt}
          config={(task.config ?? {}) as Record<string, unknown>}
        />
      )}

      {task.type === "callout" && (
        <CalloutExercise config={task.config as unknown as CalloutConfig} />
      )}

      {isExerciseType(task.type) && (
        <ExerciseCard
          taskId={task.id}
          type={task.type}
          config={sanitizeConfigForStudent(task.type, task.config ?? {})}
        />
      )}
    </>
  );
}
