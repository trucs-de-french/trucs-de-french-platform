// Агрегат для /cabinet/progress — поверх тих самих джерел/формул, що
// Home (home-data.ts) і сценовий BILAN (scene-summary.ts): 4 статистики
// плитки рахуються ТОЧНО тим самим getCabinetHomeData, а не копією
// формули, тож числа завжди збігаються з Home.
//
// DELF-навички (секція 6) рахуються ЛИШЕ для студентів, що мають право на
// showExamCard (активний enrollment у EXAM_PRODUCT_TYPES або збережена
// ціль іспиту в профілі) — та сама умова, що Home. Для решти студентів
// жоден DELF-запит НЕ виконується (не лише ховається у верстці).
import { createClient } from "@/lib/supabase/server";
import {
  getCabinetHomeData,
  getEnrolledProducts,
  hasTaskAttempt,
  type CabinetHomeData,
  type TaskRow,
  type SceneRow,
  type ProgressRow,
} from "@/lib/cabinet/home-data";
import { kyivDateString, addDays, longestStreak } from "@/lib/cabinet/kyiv-date";
import { computeTaskBest, totalPointsPossibleForTask, BILAN_REDO_THRESHOLD_PERCENT } from "@/lib/exercises/scene-summary";
import { GRADABLE_TASK_TYPES } from "@/lib/exercises/gradable-types";
import { isExamProductType } from "@/lib/cabinet/exam-products";
import { EXAM_SECTIONS, EXAM_SECTION_LABELS, type ExamSection } from "@/lib/delf/exam-structure";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type PointsByDay = { date: string; points: number };

export type SceneResultRow = {
  sceneId: string;
  productId: string;
  title: string;
  pointsEarned: number;
  pointsPossible: number;
  percent: number;
  needsRedo: boolean;
  href: string;
  lastActivity: string;
};

export type Achievement = {
  key: "firstScene" | "streak7" | "points100";
  earned: boolean;
};

export type DelfSkillRow = {
  section: ExamSection;
  label: string;
  pointsEarned: number;
  pointsPossible: number;
  percent: number;
};

export type DelfSkills = {
  level: string | null;
  productTitle: string;
  rows: DelfSkillRow[];
} | null;

export type CabinetProgressData = {
  home: CabinetHomeData;
  pointsByWeek: PointsByDay[];
  pointsByMonth: PointsByDay[];
  sceneResults: SceneResultRow[];
  achievements: Achievement[];
  delfSkills: DelfSkills;
};

type ActivityRow = {
  task_id: string;
  product_id: string | null;
  score: number;
  best_before: number;
  best_after: number;
  created_at: string;
};

export async function getCabinetProgressData(
  supabase: SupabaseClient,
  userId: string
): Promise<CabinetProgressData> {
  const home = await getCabinetHomeData(supabase, userId);
  const now = new Date();
  const todayStr = kyivDateString(now);
  const last7Days = Array.from({ length: 7 }, (_, i) => addDays(todayStr, i - 6));
  const last30Days = Array.from({ length: 30 }, (_, i) => addDays(todayStr, i - 29));

  const enrolledProducts = await getEnrolledProducts(supabase, userId);

  // Повна історія activity_log (без лімiту lookback, на відміну від Home)
  // — потрібна для "100 балів"/"7 днів поспіль" (досягнення "КОЛИСЬ", не
  // лише за останні 90 днів) і для графіка за місяць.
  let activityRows: ActivityRow[] = [];
  try {
    const { data } = await supabase
      .from("activity_log")
      .select("task_id, product_id, score, best_before, best_after, created_at")
      .eq("user_id", userId);
    activityRows = (data ?? []) as ActivityRow[];
  } catch {
    activityRows = [];
  }

  // Знаменник балів кожного завдання — потрібен лише для tasks, що
  // реально зустрічаються в activity_log (один пакетний запит, не по
  // продуктах/сценах).
  const activityTaskIds = [...new Set(activityRows.map((r) => r.task_id))];
  let activityTasks: { id: string; type: string; config: Record<string, unknown> | null }[] = [];
  if (activityTaskIds.length > 0) {
    try {
      const { data } = await supabase
        .from("tasks")
        .select("id, type, config")
        .in("id", activityTaskIds);
      activityTasks = (data ?? []) as typeof activityTasks;
    } catch {
      activityTasks = [];
    }
  }
  const activityTaskById = new Map(activityTasks.map((t) => [t.id, t]));

  const pointsByDayMap = new Map<string, number>();
  const activityDates = new Set<string>();
  let totalPointsEver = 0;
  for (const row of activityRows) {
    const task = activityTaskById.get(row.task_id);
    if (!task) continue;
    const pointsPossible = totalPointsPossibleForTask(task.type, task.config);
    const delta = Math.max(0, (pointsPossible * (row.best_after - row.best_before)) / 100);
    totalPointsEver += delta;
    const dateStr = kyivDateString(new Date(row.created_at));
    activityDates.add(dateStr);
    pointsByDayMap.set(dateStr, (pointsByDayMap.get(dateStr) ?? 0) + delta);
  }

  const pointsByWeek: PointsByDay[] = last7Days.map((date) => ({
    date,
    points: Math.round((pointsByDayMap.get(date) ?? 0) * 10) / 10,
  }));
  const pointsByMonth: PointsByDay[] = last30Days.map((date) => ({
    date,
    points: Math.round((pointsByDayMap.get(date) ?? 0) * 10) / 10,
  }));

  const achievements: Achievement[] = [
    { key: "firstScene", earned: home.scenesCompleted >= 1 },
    { key: "streak7", earned: longestStreak(activityDates) >= 7 },
    { key: "points100", earned: totalPointsEver >= 100 },
  ];

  // Scene results: сцени лише НЕ-екзаменаційних продуктів для студентів
  // без showExamCard (ELIGIBILITY, задача п.3) — у студентів із
  // showExamCard DELF-продукти й так без сцен (тести організовані через
  // delf_test_number, scene_id завжди null), тож фільтр нічого не змінює
  // для типового випадку, але лишається явним enforcement на рівні даних.
  const resultsProductIds = (
    home.showExamCard ? enrolledProducts : enrolledProducts.filter((p) => !isExamProductType(p.type))
  ).map((p) => p.id);

  let scenes: SceneRow[] = [];
  let tasks: TaskRow[] = [];
  let progressRows: ProgressRow[] = [];
  if (resultsProductIds.length > 0) {
    try {
      const { data } = await supabase
        .from("scenes")
        .select("id, product_id, title, order_index")
        .in("product_id", resultsProductIds)
        .order("order_index");
      scenes = (data ?? []) as SceneRow[];
    } catch {
      scenes = [];
    }
    try {
      const { data } = await supabase
        .from("tasks")
        .select("id, type, config, scene_id, product_id")
        .in("product_id", resultsProductIds)
        .in("type", GRADABLE_TASK_TYPES as unknown as string[])
        .not("scene_id", "is", null);
      tasks = (data ?? []) as TaskRow[];
    } catch {
      tasks = [];
    }
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
  }

  const progressByTaskId = new Map(progressRows.map((p) => [p.task_id, p]));
  const tasksByScene = new Map<string, TaskRow[]>();
  for (const task of tasks) {
    if (!task.scene_id) continue;
    const list = tasksByScene.get(task.scene_id) ?? [];
    list.push(task);
    tasksByScene.set(task.scene_id, list);
  }

  const sceneResults: SceneResultRow[] = [];
  for (const scene of scenes) {
    const sceneTasks = tasksByScene.get(scene.id) ?? [];
    if (sceneTasks.length === 0) continue;
    if (!sceneTasks.some((t) => hasTaskAttempt(progressByTaskId.get(t.id)))) continue;

    let pointsPossible = 0;
    let pointsEarned = 0;
    let lastActivity = "";
    for (const task of sceneTasks) {
      const progress = progressByTaskId.get(task.id);
      const best = computeTaskBest(
        task.type,
        task.config,
        progress
          ? { score: progress.score, bestScore: progress.best_score, blockProgress: progress.block_progress }
          : undefined
      );
      pointsPossible += best.pointsPossible;
      pointsEarned += best.pointsEarned;
      if (progress?.last_attempt_at && progress.last_attempt_at > lastActivity) {
        lastActivity = progress.last_attempt_at;
      }
    }
    if (pointsPossible <= 0) continue;
    const percent = Math.round((100 * pointsEarned) / pointsPossible);
    sceneResults.push({
      sceneId: scene.id,
      productId: scene.product_id,
      title: scene.title,
      pointsEarned: Math.round(pointsEarned * 10) / 10,
      pointsPossible: Math.round(pointsPossible * 10) / 10,
      percent,
      needsRedo: percent < BILAN_REDO_THRESHOLD_PERCENT,
      href: `/courses/${scene.product_id}/scenes/${scene.id}`,
      lastActivity,
    });
  }
  sceneResults.sort((a, b) => (a.lastActivity < b.lastActivity ? 1 : -1));

  // DELF-навички — лише для showExamCard (enforcement і у верстці, і
  // тут: для решти студентів жоден із запитів нижче не виконується).
  let delfSkills: DelfSkills = null;
  if (home.showExamCard) {
    const examProducts = enrolledProducts.filter((p) => isExamProductType(p.type));
    if (examProducts.length > 0) {
      let examType: string | null = null;
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("exam_type")
          .eq("id", userId)
          .single<{ exam_type: string | null }>();
        examType = profile?.exam_type ?? null;
      } catch {
        examType = null;
      }
      const goalLevel = examType?.split(" ")[1] ?? null;

      const byGoalLevel = goalLevel
        ? examProducts.find((p) => p.levels.includes(goalLevel))
        : undefined;

      let chosenProduct = byGoalLevel;
      if (!chosenProduct) {
        // Найактивніший — за найпізнішим last_attempt_at серед завдань
        // продукту, fallback purchased_at, якщо активності ще не було.
        const examProductIds = examProducts.map((p) => p.id);
        let lastActivityByProduct = new Map<string, string>();
        try {
          const { data: examTasks } = await supabase
            .from("tasks")
            .select("id, product_id")
            .in("product_id", examProductIds);
          const productByTaskId = new Map(
            ((examTasks ?? []) as { id: string; product_id: string }[]).map((t) => [t.id, t.product_id])
          );
          const taskIds = [...productByTaskId.keys()];
          if (taskIds.length > 0) {
            const { data: prog } = await supabase
              .from("progress")
              .select("task_id, last_attempt_at")
              .eq("user_id", userId)
              .in("task_id", taskIds)
              .not("last_attempt_at", "is", null);
            for (const row of (prog ?? []) as { task_id: string; last_attempt_at: string }[]) {
              const pid = productByTaskId.get(row.task_id);
              if (!pid) continue;
              const current = lastActivityByProduct.get(pid);
              if (!current || row.last_attempt_at > current) {
                lastActivityByProduct.set(pid, row.last_attempt_at);
              }
            }
          }
        } catch {
          lastActivityByProduct = new Map();
        }
        chosenProduct = [...examProducts].sort((a, b) => {
          const aKey = lastActivityByProduct.get(a.id) ?? a.purchased_at;
          const bKey = lastActivityByProduct.get(b.id) ?? b.purchased_at;
          return aKey < bKey ? 1 : -1;
        })[0];
      }

      if (chosenProduct) {
        type DelfTaskRow = {
          id: string;
          type: string;
          config: Record<string, unknown> | null;
          delf_section: string | null;
          task_group_id: string | null;
        };
        let delfTasks: DelfTaskRow[] = [];
        try {
          const { data } = await supabase
            .from("tasks")
            .select("id, type, config, delf_section, task_group_id")
            .eq("product_id", chosenProduct.id)
            .in("type", GRADABLE_TASK_TYPES as unknown as string[]);
          delfTasks = (data ?? []) as DelfTaskRow[];
        } catch {
          delfTasks = [];
        }

        const groupIds = [...new Set(delfTasks.filter((t) => !t.delf_section && t.task_group_id).map((t) => t.task_group_id as string))];
        let groupSectionById = new Map<string, string | null>();
        if (groupIds.length > 0) {
          try {
            const { data } = await supabase
              .from("task_groups")
              .select("id, delf_section")
              .in("id", groupIds);
            groupSectionById = new Map(
              ((data ?? []) as { id: string; delf_section: string | null }[]).map((g) => [g.id, g.delf_section])
            );
          } catch {
            groupSectionById = new Map();
          }
        }

        const delfTaskIds = delfTasks.map((t) => t.id);
        let delfProgressRows: ProgressRow[] = [];
        if (delfTaskIds.length > 0) {
          try {
            const { data } = await supabase
              .from("progress")
              .select("task_id, score, best_score, attempts, last_attempt_at, block_progress")
              .eq("user_id", userId)
              .in("task_id", delfTaskIds);
            delfProgressRows = (data ?? []) as ProgressRow[];
          } catch {
            delfProgressRows = [];
          }
        }
        const delfProgressByTaskId = new Map(delfProgressRows.map((p) => [p.task_id, p]));

        const bySection = new Map<ExamSection, { earned: number; possible: number }>();
        for (const task of delfTasks) {
          const section = (task.delf_section ?? (task.task_group_id ? groupSectionById.get(task.task_group_id) : null)) as ExamSection | null;
          if (!section || !(EXAM_SECTIONS as readonly string[]).includes(section)) continue;
          const progress = delfProgressByTaskId.get(task.id);
          const best = computeTaskBest(
            task.type,
            task.config,
            progress
              ? { score: progress.score, bestScore: progress.best_score, blockProgress: progress.block_progress }
              : undefined
          );
          const bucket = bySection.get(section) ?? { earned: 0, possible: 0 };
          bucket.possible += best.pointsPossible;
          bucket.earned += best.pointsEarned;
          bySection.set(section, bucket);
        }

        const rows: DelfSkillRow[] = EXAM_SECTIONS.filter((section) => {
          const bucket = bySection.get(section);
          return bucket && bucket.possible > 0;
        }).map((section) => {
          const bucket = bySection.get(section)!;
          return {
            section,
            label: EXAM_SECTION_LABELS[section],
            pointsEarned: Math.round(bucket.earned * 10) / 10,
            pointsPossible: Math.round(bucket.possible * 10) / 10,
            percent: Math.round((100 * bucket.earned) / bucket.possible),
          };
        });

        if (rows.length > 0) {
          delfSkills = {
            level: chosenProduct.levels[0] ?? goalLevel,
            productTitle: chosenProduct.title,
            rows,
          };
        }
      }
    }
  }

  return { home, pointsByWeek, pointsByMonth, sceneResults, achievements, delfSkills };
}
