// "Робота над помилками" (standalone сторінка /cabinet/mistakes), крок 1 —
// чиста модель групування (без Supabase/React), спільна з серверним
// фетчем (page.tsx) і тестами (mistakes-overview.test.ts). Повторює
// семантику сценової сторінки (scenes/[sceneId]/page.tsx ~518-610) і
// buildErrorReviewEntry (error-review.ts) НАПРЯМУ (та сама функція, не
// копія правила), щоб "нерозв'язано" тут завжди означало те саме, що на
// сторінці сцени.
//
// Ефективний scene_id завдання (крок 2, виправлення): tasks.scene_id, якщо
// задано, інакше scene_id ГРУПИ через tasks.task_group_id (0031_task_groups.sql
// обнуляє власний tasks.scene_id завдання, коли воно стає членом групи —
// та сама логіка, що scene-error-review.ts). Завдання без жодного ефективного
// scene_id (DELF-завдання продукту без групи й без прямої сцени) лишаються
// виключені, як і раніше: єдиний існуючий UI виправлення (ErrorReviewBlock/
// ErrorReviewBlock-похідна сторінка /cabinet/mistakes/[sceneId]) прив'язана
// до сцени — для задач без жодної сцени такого блоку немає ніде в застосунку.
import {
  buildErrorReviewEntry,
  isMistakePracticeSupported,
  type MistakeRowLike,
} from "@/lib/exercises/error-review";

export type MistakeRawRow = { taskId: string; createdAt: string; detail: unknown };

export type MistakeTaskRow = {
  id: string;
  type: string;
  title: string | null;
  config: Record<string, unknown> | null;
  // Сирі (не ефективні) колонки tasks — резолюція в groupSceneById нижче.
  sceneId: string | null;
  taskGroupId: string | null;
  productId: string;
  orderIndex: number;
};

export type MistakeTaskGroupRow = { id: string; sceneId: string | null };
export type MistakeSceneRow = { id: string; title: string; productId: string; orderIndex: number };
export type MistakeProductRow = { id: string; title: string };
export type MistakeProgressRow = { taskId: string; score: number | null };
export type MistakeCorrectionStateRow = {
  taskId: string;
  correctedItemIds: string[];
  failedAttempts: Record<string, number>;
};

export type MistakeTaskEntry = {
  taskId: string;
  taskType: string;
  title: string;
  config: Record<string, unknown> | null;
  productId: string;
  sceneId: string;
  unresolvedCount: number;
};

export type MistakeSceneGroup = {
  sceneId: string;
  sceneTitle: string;
  productId: string;
  courseTitle: string;
  sceneOrderIndex: number;
  totalUnresolved: number;
  tasks: MistakeTaskEntry[];
};

export type MistakesOverview = {
  scenes: MistakeSceneGroup[];
  totalMistakes: number;
  scenesCount: number;
};

export const EMPTY_MISTAKES_OVERVIEW: MistakesOverview = { scenes: [], totalMistakes: 0, scenesCount: 0 };

// Ефективний scene_id (той самий факт, що scene-error-review.ts: пряма
// колонка переважає групу) і прапорець "прийшло через групу" — потрібен
// лише для порядку карток усередині сцени нижче (пряме tasks.scene_id
// завжди перед груповими, той самий порядок, що й конкатенація
// directTasks+groupedTasks у scene-error-review.ts — НЕ єдиний
// відсортований за order_index список).
function resolveSceneId(task: MistakeTaskRow, groupSceneById: Map<string, string | null>): string | null {
  if (task.sceneId) return task.sceneId;
  if (task.taskGroupId) return groupSceneById.get(task.taskGroupId) ?? null;
  return null;
}
function isViaGroup(task: MistakeTaskRow): boolean {
  return task.sceneId === null && task.taskGroupId !== null;
}

export function buildMistakesOverview(input: {
  mistakeRows: MistakeRawRow[];
  tasks: MistakeTaskRow[];
  taskGroups: MistakeTaskGroupRow[];
  scenes: MistakeSceneRow[];
  products: MistakeProductRow[];
  progress: MistakeProgressRow[];
  correctionStates: MistakeCorrectionStateRow[];
}): MistakesOverview {
  const taskById = new Map(input.tasks.map((t) => [t.id, t]));
  const groupSceneById = new Map(input.taskGroups.map((g) => [g.id, g.sceneId]));
  const sceneById = new Map(input.scenes.map((s) => [s.id, s]));
  const productTitleById = new Map(input.products.map((p) => [p.id, p.title]));
  const latestScoreByTask = new Map(input.progress.map((p) => [p.taskId, p.score]));
  const correctionStateByTask = new Map(input.correctionStates.map((s) => [s.taskId, s]));

  const rowsByTask = new Map<string, MistakeRowLike[]>();
  for (const row of input.mistakeRows) {
    const arr = rowsByTask.get(row.taskId) ?? [];
    arr.push({ createdAt: row.createdAt, detail: row.detail });
    rowsByTask.set(row.taskId, arr);
  }

  const sceneGroups = new Map<string, MistakeSceneGroup>();

  for (const taskId of rowsByTask.keys()) {
    const task = taskById.get(taskId);
    if (!task) continue;
    const effectiveSceneId = resolveSceneId(task, groupSceneById);
    if (!effectiveSceneId) continue;
    if (!isMistakePracticeSupported(task.type)) continue;
    if (latestScoreByTask.get(taskId) === 100) continue;

    const state = correctionStateByTask.get(taskId);
    const entry = buildErrorReviewEntry({
      taskId,
      taskType: task.type,
      mistakeRows: rowsByTask.get(taskId) ?? [],
      correctedItemIds: state?.correctedItemIds ?? [],
      failedAttempts: state?.failedAttempts ?? {},
      config: task.config,
    });

    const unresolvedCount = entry.remainingItemIds.length;
    if (unresolvedCount === 0) continue;

    const scene = sceneById.get(effectiveSceneId);
    if (!scene) continue;

    let group = sceneGroups.get(scene.id);
    if (!group) {
      group = {
        sceneId: scene.id,
        sceneTitle: scene.title,
        productId: scene.productId,
        courseTitle: productTitleById.get(scene.productId) ?? "",
        sceneOrderIndex: scene.orderIndex,
        totalUnresolved: 0,
        tasks: [],
      };
      sceneGroups.set(scene.id, group);
    }
    group.tasks.push({
      taskId,
      taskType: task.type,
      title: task.title ?? "",
      config: task.config,
      productId: task.productId,
      sceneId: scene.id,
      unresolvedCount,
    });
    group.totalUnresolved += unresolvedCount;
  }

  const scenes = [...sceneGroups.values()];
  for (const group of scenes) {
    // Той самий порядок, що scene-error-review.ts: усі ПРЯМІ завдання
    // сцени (за order_index), потім усі ГРУПОВІ (за order_index) — не
    // єдиний злитий сорт за order_index (значення order_index завдання і
    // групи не порівнювані одне з одним напряму).
    group.tasks.sort((a, b) => {
      const ta = taskById.get(a.taskId);
      const tb = taskById.get(b.taskId);
      const bucketA = ta && isViaGroup(ta) ? 1 : 0;
      const bucketB = tb && isViaGroup(tb) ? 1 : 0;
      if (bucketA !== bucketB) return bucketA - bucketB;
      return (ta?.orderIndex ?? 0) - (tb?.orderIndex ?? 0);
    });
  }
  scenes.sort((a, b) => b.totalUnresolved - a.totalUnresolved || a.sceneOrderIndex - b.sceneOrderIndex);

  const totalMistakes = scenes.reduce((sum, g) => sum + g.totalUnresolved, 0);

  return { scenes, totalMistakes, scenesCount: scenes.length };
}
