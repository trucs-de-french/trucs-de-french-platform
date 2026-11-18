// "Робота над помилками" (standalone сторінка /cabinet/mistakes), крок 1 —
// чиста модель групування (без Supabase/React), спільна з серверним
// фетчем (page.tsx) і тестами (mistakes-overview.test.ts). Повторює
// семантику сценової сторінки (scenes/[sceneId]/page.tsx ~518-610) і
// buildErrorReviewEntry (error-review.ts) НАПРЯМУ (та сама функція, не
// копія правила), щоб "нерозв'язано" тут завжди означало те саме, що на
// сторінці сцени.
//
// Завдання без scene_id (DELF-завдання продукту, 0001_init.sql: "scene_id
// nullable — DELF-завдання не прив'язані") пропускаються свідомо: єдиний
// існуючий UI виправлення (ErrorReviewBlock) змонтований лише всередині
// сценової сторінки (на task.type==="error_correction" у ТІЙ сцені) — для
// задач без сцени такого блоку просто немає ніде в застосунку, а ця задача
// не передбачає створення нового шляху виправлення.
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
  sceneId: string | null;
  productId: string;
  orderIndex: number;
};

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

export function buildMistakesOverview(input: {
  mistakeRows: MistakeRawRow[];
  tasks: MistakeTaskRow[];
  scenes: MistakeSceneRow[];
  products: MistakeProductRow[];
  progress: MistakeProgressRow[];
  correctionStates: MistakeCorrectionStateRow[];
}): MistakesOverview {
  const taskById = new Map(input.tasks.map((t) => [t.id, t]));
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
    if (!task || !task.sceneId) continue;
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

    const scene = sceneById.get(task.sceneId);
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
    group.tasks.sort((a, b) => {
      const ta = taskById.get(a.taskId)?.orderIndex ?? 0;
      const tb = taskById.get(b.taskId)?.orderIndex ?? 0;
      return ta - tb;
    });
  }
  scenes.sort((a, b) => b.totalUnresolved - a.totalUnresolved || a.sceneOrderIndex - b.sceneOrderIndex);

  const totalMistakes = scenes.reduce((sum, g) => sum + g.totalUnresolved, 0);

  return { scenes, totalMistakes, scenesCount: scenes.length };
}
