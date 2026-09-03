import { TaskMedia } from "@/components/task-media";
import { EssayCheckExercise } from "@/components/exercises/essay-check";
import { CalloutExercise } from "@/components/exercises/callout";
import { ExerciseCard, isExerciseType } from "@/components/exercises/exercise-card";
import { sanitizeConfigForStudent } from "@/lib/exercises/sanitize";
import type { CalloutConfig } from "@/lib/exercises/types";

export type ExerciseTask = {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown> | null;
  image_url: string | null;
  audio_url: string | null;
};

// Рендер ОДНІЄЇ задачі — той самий набір компонентів і той самий
// sanitizeConfigForStudent (не пускати правильні відповіді на клієнт), що й
// у сценах фільмів (scenes/[sceneId]/page.tsx), звужений до типів,
// релевантних DELF-контенту (тестам і матеріалам): essay_check, callout, і
// всі auto-graded типи через ExerciseCard. vocab_quiz/error_correction/
// game/link/embed прив'язані до сцен фільмів — свідомо не підтримуються.
// Спільний для delf-test-tasks.tsx і материал-сторінки — третє місце
// використання того самого блоку вже виправдовує винесення.
export function ExerciseBlock({ task }: { task: ExerciseTask }) {
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
