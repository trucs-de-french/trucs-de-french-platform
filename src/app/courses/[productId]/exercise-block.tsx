import { TaskMedia } from "@/components/task-media";
import { PlatformIcon } from "@/components/platform-icon";
import { resolvePlatform } from "@/lib/platform";
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
  points_visible?: boolean;
  games?: { embed_url: string | null; provider: string } | null;
};

type LinkEmbedConfig = {
  url?: string;
  height?: number;
  label?: string;
  platform?: string;
  download?: boolean;
};

// Для цих типів студенту потрібно бачити, що саме це за посилання/гра —
// решта типів вправ показують власну інструкцію замість технічної назви.
// Той самий список, що вже в scenes/[sceneId]/page.tsx.
const TYPES_WITH_BADGE = ["link", "game", "embed"];

// Рендер ОДНІЄЇ задачі — той самий набір компонентів і той самий
// sanitizeConfigForStudent (не пускати правильні відповіді на клієнт), що й
// у сценах фільмів (scenes/[sceneId]/page.tsx), звужений до типів,
// релевантних DELF-контенту (тестам і матеріалам): essay_check, callout,
// game/link/embed, і всі auto-graded типи через ExerciseCard.
// vocab_quiz/error_correction прив'язані до сцен фільмів (лексика/помилки
// саме тієї сцени) — свідомо не підтримуються тут.
// Спільний для delf-test-tasks.tsx і сторінки матеріалу — третє місце
// використання того самого блоку вже виправдовує винесення.
export function ExerciseBlock({ task }: { task: ExerciseTask }) {
  const config = (task.config ?? {}) as LinkEmbedConfig;

  return (
    <>
      {TYPES_WITH_BADGE.includes(task.type) && (
        <>
          <span className="text-xs uppercase text-neutral-500 dark:text-neutral-400">
            {task.type}
          </span>
          <p className="font-medium">{task.title}</p>
        </>
      )}

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
          pointsVisible={task.points_visible}
        />
      )}

      {task.type === "game" && task.games?.embed_url && (
        <a
          href={task.games.embed_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block text-sm underline"
        >
          Відкрити гру ({task.games.provider})
        </a>
      )}

      {task.type === "link" && config.url && config.download && (
        <a
          href={config.url}
          download
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          ⬇ {config.label ?? "Завантажити файл"}
        </a>
      )}

      {task.type === "link" && config.url && !config.download && (
        <a
          href={config.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          <PlatformIcon platform={resolvePlatform(config.url, config.platform)} />
          {config.label ?? "Відкрити"}
        </a>
      )}

      {task.type === "embed" && config.url && (
        <>
          <div
            className="mt-2 overflow-hidden rounded-md border"
            style={{ height: config.height ?? 480 }}
          >
            <iframe src={config.url} className="h-full w-full" allowFullScreen />
          </div>
          {/* Завжди видимий резервний варіант — не опційний, без перемикача
              вимкнення (напр. якщо стороннній сервіс блокує вбудовування
              в iframe, як уже траплялось із Wordwall). */}
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Якщо відео (гра) не відкривається,{" "}
            <a href={config.url} target="_blank" rel="noopener noreferrer" className="underline">
              перейдіть за посиланням
            </a>
            .
          </p>
        </>
      )}
    </>
  );
}
