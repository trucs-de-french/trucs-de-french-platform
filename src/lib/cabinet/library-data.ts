// Дані для "Моя бібліотека" (/cabinet/library) — список куплених продуктів
// користувача з прогресом, зібраний кількома пакетними запитами (жодного
// запиту в циклі по продуктах/завданнях), тим самим підходом, що
// home-data.ts. isSceneCompleted/hasTaskAttempt — той самий предикат
// "здано", що й BILAN-лейбл "Scène terminée", навмисно імпортований
// звідти, а не продубльований.
import { createClient } from "@/lib/supabase/server";
import { GRADABLE_TASK_TYPES } from "@/lib/exercises/gradable-types";
import {
  hasTaskAttempt,
  isSceneCompleted,
  type ProgressRow,
  type SceneRow,
  type TaskRow,
} from "@/lib/cabinet/home-data";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type LibraryItemStatus = "not_started" | "in_progress" | "completed";
export type LibraryUnitKind = "scenes" | "tasks";

export type LibraryItem = {
  productId: string;
  title: string;
  type: "film" | "delf";
  coverUrl: string | null;
  levels: string[];
  purchasedAt: string;
  unitsTotal: number;
  unitsDone: number;
  unitKind: LibraryUnitKind;
  status: LibraryItemStatus;
  lastAttemptAt: string | null;
  href: string;
  progressFraction: number;
};

type EnrolledProduct = {
  id: string;
  title: string;
  type: "film" | "delf";
  coverUrl: string | null;
  levels: string[];
  purchasedAt: string;
};

export async function getLibraryData(
  supabase: SupabaseClient,
  userId: string
): Promise<LibraryItem[]> {
  let enrolledProducts: EnrolledProduct[] = [];
  try {
    const { data } = await supabase
      .from("enrollments")
      .select(
        "purchased_at, products!inner(id, title, type, cover_image_url, levels, level, archived_at, is_published)"
      )
      .eq("user_id", userId)
      .eq("status", "active");
    type EnrollmentRow = {
      purchased_at: string;
      products: {
        id: string;
        title: string;
        type: "film" | "delf";
        cover_image_url: string | null;
        levels: string[] | null;
        level: string | null;
        archived_at: string | null;
        is_published: boolean;
      } | null;
    };
    enrolledProducts = ((data ?? []) as unknown as EnrollmentRow[])
      .filter((row) => row.products && row.products.archived_at === null && row.products.is_published)
      .map((row) => {
        const product = row.products!;
        const levels = product.levels && product.levels.length > 0
          ? product.levels
          : product.level
            ? [product.level]
            : [];
        return {
          id: product.id,
          title: product.title,
          type: product.type,
          coverUrl: product.cover_image_url,
          levels,
          purchasedAt: row.purchased_at,
        };
      });
  } catch {
    return [];
  }

  if (enrolledProducts.length === 0) return [];

  const productIds = enrolledProducts.map((p) => p.id);

  let scenes: SceneRow[] = [];
  try {
    const { data } = await supabase
      .from("scenes")
      .select("id, product_id, title, order_index")
      .in("product_id", productIds)
      .order("order_index");
    scenes = (data ?? []) as SceneRow[];
  } catch {
    scenes = [];
  }

  let tasks: TaskRow[] = [];
  try {
    const { data } = await supabase
      .from("tasks")
      .select("id, type, config, scene_id, product_id")
      .in("product_id", productIds)
      .in("type", GRADABLE_TASK_TYPES as unknown as string[]);
    tasks = (data ?? []) as TaskRow[];
  } catch {
    tasks = [];
  }

  let progressRows: ProgressRow[] = [];
  const taskIds = tasks.map((t) => t.id);
  if (taskIds.length > 0) {
    try {
      const { data } = await supabase
        .from("progress")
        .select("task_id, score, best_score, attempts, last_attempt_at, block_progress")
        .eq("user_id", userId)
        .in("task_id", taskIds);
      progressRows = (data ?? []) as ProgressRow[];
    } catch {
      progressRows = [];
    }
  }

  const progressByTaskId = new Map(progressRows.map((p) => [p.task_id, p]));
  const scenesByProduct = new Map<string, SceneRow[]>();
  for (const scene of scenes) {
    const list = scenesByProduct.get(scene.product_id) ?? [];
    list.push(scene);
    scenesByProduct.set(scene.product_id, list);
  }
  const tasksByProduct = new Map<string, TaskRow[]>();
  const tasksByScene = new Map<string, TaskRow[]>();
  for (const task of tasks) {
    const byProduct = tasksByProduct.get(task.product_id) ?? [];
    byProduct.push(task);
    tasksByProduct.set(task.product_id, byProduct);
    if (task.scene_id) {
      const byScene = tasksByScene.get(task.scene_id) ?? [];
      byScene.push(task);
      tasksByScene.set(task.scene_id, byScene);
    }
  }

  const items: LibraryItem[] = enrolledProducts.map((product) => {
    const productScenes = (scenesByProduct.get(product.id) ?? []).sort(
      (a, b) => a.order_index - b.order_index
    );
    const productTasks = tasksByProduct.get(product.id) ?? [];
    const unitKind: LibraryUnitKind = productScenes.length > 0 ? "scenes" : "tasks";

    let unitsTotal: number;
    let unitsDone: number;
    if (unitKind === "scenes") {
      unitsTotal = productScenes.length;
      unitsDone = productScenes.filter((scene) =>
        isSceneCompleted(tasksByScene.get(scene.id) ?? [], progressByTaskId)
      ).length;
    } else {
      unitsTotal = productTasks.length;
      unitsDone = productTasks.filter((task) => hasTaskAttempt(progressByTaskId.get(task.id))).length;
    }

    const attempted = productTasks.some((task) => hasTaskAttempt(progressByTaskId.get(task.id)));
    const status: LibraryItemStatus =
      unitsTotal > 0 && unitsDone === unitsTotal ? "completed" : attempted ? "in_progress" : "not_started";

    let lastAttemptAt: string | null = null;
    for (const task of productTasks) {
      const p = progressByTaskId.get(task.id);
      if (p?.last_attempt_at && (!lastAttemptAt || p.last_attempt_at > lastAttemptAt)) {
        lastAttemptAt = p.last_attempt_at;
      }
    }

    let href: string;
    if (status === "in_progress") {
      let latestTask: TaskRow | null = null;
      let latestAt: string | null = null;
      for (const task of productTasks) {
        const p = progressByTaskId.get(task.id);
        if (p?.last_attempt_at && (!latestAt || p.last_attempt_at > latestAt)) {
          latestAt = p.last_attempt_at;
          latestTask = task;
        }
      }
      const scene = latestTask?.scene_id
        ? productScenes.find((s) => s.id === latestTask!.scene_id) ?? null
        : null;
      href = scene
        ? `/courses/${product.id}/scenes/${scene.id}#task-${latestTask!.id}`
        : `/courses/${product.id}`;
    } else if (status === "not_started") {
      const firstScene = productScenes[0] ?? null;
      href = firstScene ? `/courses/${product.id}/scenes/${firstScene.id}` : `/courses/${product.id}`;
    } else {
      href = `/courses/${product.id}`;
    }

    return {
      productId: product.id,
      title: product.title,
      type: product.type,
      coverUrl: product.coverUrl,
      levels: product.levels,
      purchasedAt: product.purchasedAt,
      unitsTotal,
      unitsDone,
      unitKind,
      status,
      lastAttemptAt,
      href,
      progressFraction: unitsTotal > 0 ? unitsDone / unitsTotal : 0,
    };
  });

  const statusRank: Record<LibraryItemStatus, number> = { in_progress: 0, not_started: 1, completed: 2 };
  items.sort((a, b) => {
    const rankDiff = statusRank[a.status] - statusRank[b.status];
    if (rankDiff !== 0) return rankDiff;
    if (a.status === "in_progress" || a.status === "completed") {
      return (b.lastAttemptAt ?? "").localeCompare(a.lastAttemptAt ?? "");
    }
    return b.purchasedAt.localeCompare(a.purchasedAt);
  });

  return items;
}
