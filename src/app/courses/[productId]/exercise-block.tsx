import { Gamepad2 } from "lucide-react";
import { TaskMedia } from "@/components/task-media";
import { LinkCard } from "@/components/link-card";
import { resolveLinkTaskIcon, linkTaskDefaultSubtitle } from "@/lib/link-task-icon";
import { EssayCheckExercise } from "@/components/exercises/essay-check";
import { CalloutExercise } from "@/components/exercises/callout";
import { ExerciseCard, isExerciseType } from "@/components/exercises/exercise-card";
import { ExerciseErrorBoundary } from "@/components/exercises/exercise-error-boundary";
import { BlockTabs } from "@/components/exercises/block-navigation";
import { EmbedFrame } from "@/components/embed-frame";
import { sanitizeConfigForStudent } from "@/lib/exercises/sanitize";
import type { CalloutConfig, GradeResult } from "@/lib/exercises/types";
import { TASK_TYPES_WITH_VISIBLE_TITLE } from "@/lib/exercises/task-type-meta";
import { getTaskBarText } from "@/lib/exercises/task-bar-text";

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
  description?: string;
  icon?: string;
};

// Технічна назва типу (напр. "embed") — лише для game, де вона реально
// підказує студенту, із чим він має справу (зовнішня гра). Для embed
// прибрано: студент бачить заголовок вправи ("Jeu" тощо) і сам вміст,
// службова назва типу йому не потрібна. link сюди не входить — назва й
// іконка вже на самій LinkCard (див. нижче), окремий бейдж типу зайвий.
const TYPES_WITH_TYPE_BADGE = ["game"];

// Рендер ОДНІЄЇ задачі — той самий набір компонентів і той самий
// sanitizeConfigForStudent (не пускати правильні відповіді на клієнт), що й
// у сценах фільмів (scenes/[sceneId]/page.tsx), звужений до типів,
// релевантних DELF-контенту (тестам і матеріалам): essay_check, callout,
// game/link/embed, і всі auto-graded типи через ExerciseCard.
// vocab_quiz/error_correction прив'язані до сцен фільмів (лексика/помилки
// саме тієї сцени) — свідомо не підтримуються тут.
// Спільний для delf-test-tasks.tsx і сторінки матеріалу — третє місце
// використання того самого блоку вже виправдовує винесення.
export function ExerciseBlock({
  task,
  onResult,
  hidePoints,
  isDelf = false,
  suppressTitle = false,
  showPlaque = true,
}: {
  task: ExerciseTask;
  // Опційний — для блоків (TaskGroupBlock), щоб рахувати живий підсумок
  // балів усіх задач блоку (режим "сума"). Прокидається без змін в
  // ExerciseCard, звідти — у відповідний gradable-компонент.
  onResult?: (result: GradeResult) => void;
  // Опційний — для блоків у режимі "фіксовано", щоб безумовно ховати
  // індивідуальний бал задачі. Прокидається без змін в ExerciseCard.
  hidePoints?: boolean;
  // Задача належить DELF-тесту — вимикає підказки (ExerciseCard, 6 типів,
  // де вони є). За замовчуванням false: сцени фільмів і матеріали
  // структурно ніколи не є DELF-тестом (delf_test_number там завжди null,
  // 0018_delf_tracks.sql) — лише delf-test-tasks.tsx передає тут true.
  isDelf?: boolean;
  // true — ЦЯ задача вже позначена в GlassBlock-барі групи (TaskGroupBlock,
  // єдина задача в групі без власної назви) — власний інлайн-заголовок
  // (нижче, лише для link/game/embed) пригнічується, щоб назва не
  // показувалась двічі.
  suppressTitle?: boolean;
  // false — лише TaskGroupBlock, коли кілька задач сидять в ОДНІЙ
  // спільній панелі: escape-трюк плашки/смужки (.task-header-strip-anchor,
  // globals.css) рахує відступ відносно верхнього краю .glass-block-panel
  // і ламається, якщо ПЕРЕД ним у тій самій панелі вже є інший контент
  // (спільний текст групи, попередні задачі-члени) — тож у групі плашка
  // не рендериться взагалі. Вкладки блоків (коли в задачі 2+ блоки)
  // лишаються НЕзалежно від цього пропса (BlockTabs рендерить їх навіть
  // без plaqueText) — лише сама плашка типу гаситься.
  showPlaque?: boolean;
}) {
  const config = (task.config ?? {}) as LinkEmbedConfig;
  // Плашка типу (мокап "варіант 4") — рахується з СИРОГО task.config
  // (не з sanitizeConfigForStudent нижче, де cardTitle не входить у
  // whitelist жодного типу): callout/link/game взагалі не доходять до
  // GlassBlock-обгортки (викликачі цього компонента самі їх виключають,
  // page.tsx/task-group-block.tsx), тож плашка потрібна лише
  // essay_check/embed тут напряму й усім gradable-типам через
  // ExerciseCard нижче.
  const plaqueText = showPlaque ? getTaskBarText(task) : undefined;

  return (
    <>
      {/* BlockTabs/плашка — ОБОВ'ЯЗКОВО перший елемент тут: escape-трюк
          негативних margin (.task-header-strip-anchor, globals.css)
          рахує відступ відносно верхнього краю .glass-block-panel, тож
          анкер мусить бути ПЕРШОЮ дитиною контенту панелі, інакше margin
          зіллється з попереднім сиблінгом, а не з рамкою панелі. */}
      {(task.type === "essay_check" || task.type === "embed") && <BlockTabs plaqueText={plaqueText} />}

      {TASK_TYPES_WITH_VISIBLE_TITLE.includes(task.type) && task.type !== "link" && !suppressTitle && (
        <>
          {TYPES_WITH_TYPE_BADGE.includes(task.type) && (
            <span className="text-xs uppercase text-neutral-500 dark:text-neutral-400">
              {task.type}
            </span>
          )}
          <p className="font-medium">{task.title}</p>
        </>
      )}

      <TaskMedia imageUrl={task.image_url} audioUrl={task.audio_url} />

      {task.type === "essay_check" && (
        <ExerciseErrorBoundary>
          <EssayCheckExercise
            taskId={task.id}
            prompt={(task.config as { prompt?: string } | null)?.prompt}
            config={(task.config ?? {}) as Record<string, unknown>}
          />
        </ExerciseErrorBoundary>
      )}

      {task.type === "callout" && (
        <ExerciseErrorBoundary>
          <CalloutExercise config={task.config as unknown as CalloutConfig} />
        </ExerciseErrorBoundary>
      )}

      {isExerciseType(task.type) && (
        <ExerciseCard
          taskId={task.id}
          type={task.type}
          config={sanitizeConfigForStudent(task.type, task.config ?? {})}
          plaqueText={plaqueText}
          pointsVisible={task.points_visible}
          onResult={onResult}
          hidePoints={hidePoints}
          isDelf={isDelf}
        />
      )}

      {task.type === "game" && task.games?.embed_url && (
        <LinkCard
          href={task.games.embed_url}
          icon={Gamepad2}
          title="Відкрити гру"
          subtitle={task.games.provider}
        />
      )}

      {task.type === "link" &&
        config.url &&
        (() => {
          const meta = resolveLinkTaskIcon(config);
          const description = config.description?.trim();
          return (
            <LinkCard
              href={config.url!}
              download={config.download}
              icon={meta.icon}
              title={task.title}
              subtitle={description || linkTaskDefaultSubtitle(config)}
            />
          );
        })()}

      {task.type === "embed" && config.url && (
        <EmbedFrame url={config.url} height={config.height ?? 480} />
      )}
    </>
  );
}
