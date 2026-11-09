// Агрегат для Home кабінету студента (/cabinet) — один typed-об'єкт із
// кількох пакетних запитів (жодного запиту в циклі по завданнях). Увесь
// розрахунок балів/завершеності йде через ті самі чисті хелпери, що й
// сценовий BILAN (scene-summary.ts) — тут НЕ переповнюється жодна формула
// оцінювання, лише агрегація поверх тих самих чисел.
//
// Межі "сьогодні"/"цей тиждень" (Monday..Sunday) рахуються в Europe/Kyiv
// (явна вимога задачі), а не в TZ сервера — звичайні числові Date-обчислення
// велись би в UTC і зсували межу дня/тижня для студентів у Києві.
//
// Захист: кожен під-запит обгорнутий у try/catch і деградує лише СВІЙ
// віджет до порожнього стану — падіння однієї частини не повинно рвати всю
// Home-сторінку.
import { createClient } from "@/lib/supabase/server";
import { computeTaskBest, totalPointsPossibleForTask, BILAN_REDO_THRESHOLD_PERCENT } from "@/lib/exercises/scene-summary";
import { GRADABLE_TASK_TYPES } from "@/lib/exercises/gradable-types";
import { getDefaultTaskName } from "@/lib/exercises/default-task-labels";
import { isExamProductType } from "@/lib/cabinet/exam-products";
import { kyivDateString, addDays, startOfWeekKyiv, computeStreakDays, longestStreak } from "@/lib/cabinet/kyiv-date";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const ACTIVITY_LOOKBACK_DAYS = 90;

export type EnrolledProduct = {
  id: string;
  title: string;
  type: "film" | "delf";
  cover_image_url: string | null;
  levels: string[];
  purchased_at: string;
};

// Активні enrollments користувача (архівні/неопубліковані продукти
// відфільтровані) — винесено з getCabinetHomeData, бо Progress-сторінці
// (progress-data.ts) потрібен ТОЙ САМИЙ список продуктів для своїх
// запитів сцен/завдань/DELF-навичок, а не копія запиту.
export async function getEnrolledProducts(
  supabase: SupabaseClient,
  userId: string
): Promise<EnrolledProduct[]> {
  try {
    const { data } = await supabase
      .from("enrollments")
      .select(
        "purchased_at, products!inner(id, title, type, cover_image_url, levels, archived_at, is_published)"
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
        levels: string[];
        archived_at: string | null;
        is_published: boolean;
      } | null;
    };
    return ((data ?? []) as unknown as EnrollmentRow[])
      .filter((row) => row.products && row.products.archived_at === null && row.products.is_published)
      .map((row) => ({
        id: row.products!.id,
        title: row.products!.title,
        type: row.products!.type,
        cover_image_url: row.products!.cover_image_url,
        levels: row.products!.levels ?? [],
        purchased_at: row.purchased_at,
      }));
  } catch {
    return [];
  }
}

export type ContinueTarget = {
  kind: "continue" | "start";
  href: string;
  productId: string;
  productTitle: string;
  productType: "film" | "delf";
  productCoverUrl: string | null;
  productLevel: string | null;
  sceneTitle: string | null;
  sceneIndex: number | null;
  sceneTotal: number | null;
  taskTypeName: string | null;
  scenesCompletedInProduct: number;
  scenesTotalInProduct: number;
};

export type RedoItem = {
  taskId: string;
  taskTypeName: string;
  sceneLabel: string;
  pointsEarned: number;
  pointsPossible: number;
  href: string;
};

export type PointsByDay = { date: string; points: number };

export type Achievement = {
  key: "firstScene" | "streak7" | "points100";
  earned: boolean;
  earnedAt: string | null;
  current: number;
  target: number;
};

// Для блоку "Останні досягнення" на Home: до 3 нещодавно здобутих (за
// earnedAt, найновіші перші), далі найближче "в процесі" (найбільший
// current/target серед нездобутих), далі наступне "заблоковане". Зараз у
// проєкті лише 3 ключі досягнень, тож реально показує максимум 3 —
// свідомо, решта слотів лишаються порожніми, а не вигаданими
// досягненнями.
export function pickHomeAchievements(all: Achievement[]): Achievement[] {
  const earned = [...all]
    .filter((a) => a.earned)
    .sort((a, b) => (b.earnedAt ?? "").localeCompare(a.earnedAt ?? ""))
    .slice(0, 3);
  const earnedKeys = new Set(earned.map((a) => a.key));
  const unearned = all.filter((a) => !earnedKeys.has(a.key));
  const inProgress = [...unearned]
    .filter((a) => a.current > 0)
    .sort((a, b) => b.current / b.target - a.current / a.target)[0];
  const locked = unearned.find((a) => a.key !== inProgress?.key);
  return [earned, inProgress, locked].flat().filter((a): a is Achievement => !!a);
}

export type ExamInfo = { type: string; date: string; daysLeft: number };

export type ExamSettingsData = { exam: ExamInfo | null; showExamCard: boolean };

// Легкий підзапит лише для картки іспиту в Налаштуваннях (settings/page.tsx)
// — той самий showExamCard-критерій, що й Home (getCabinetHomeData нижче),
// але без решти важкого агрегату (сцени/бали/стрік/redo), який сторінці
// Налаштувань не потрібен. getEnrolledProducts — та сама функція, що й
// Home/Progress, не копія запиту.
export async function getExamSettingsData(
  supabase: SupabaseClient,
  userId: string
): Promise<ExamSettingsData> {
  const todayStr = kyivDateString(new Date());
  let exam: ExamInfo | null = null;
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("exam_type, exam_date")
      .eq("id", userId)
      .single<{ exam_type: string | null; exam_date: string | null }>();
    if (profile?.exam_type && profile?.exam_date) {
      const daysLeft = Math.round(
        (new Date(`${profile.exam_date}T00:00:00Z`).getTime() - new Date(`${todayStr}T00:00:00Z`).getTime()) /
          86_400_000
      );
      exam = { type: profile.exam_type, date: profile.exam_date, daysLeft };
    }
  } catch {
    // немає збереженого іспиту — exam лишається null
  }

  const enrolledProducts = await getEnrolledProducts(supabase, userId);
  const hasExamProduct = enrolledProducts.some((p) => isExamProductType(p.type));
  return { exam, showExamCard: hasExamProduct || exam !== null };
}

export type NewLibraryItem = {
  id: string;
  title: string;
  description: string | null;
  type: "film" | "delf";
  level: string | null;
  coverUrl: string | null;
  href: string;
};

// "Нове в бібліотеці" на Home — 5 найновіших ОПУБЛІКОВАНИХ продуктів
// каталогу (films зараз; songs/texts, коли в products.type з'являться нові
// значення — той самий запит їх підхопить без змін), незалежно від
// enrollment користувача (це вітрина нового в каталозі, не "моя
// бібліотека"). Не прив'язано до userId — викликається окремо від
// getCabinetHomeData, паралельно (Promise.all) у page.tsx.
export async function getNewLibraryItems(supabase: SupabaseClient, limit = 5): Promise<NewLibraryItem[]> {
  try {
    const { data } = await supabase
      .from("products")
      .select("id, title, description, type, level, levels, cover_image_url, created_at")
      .eq("is_published", true)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    type Row = {
      id: string;
      title: string;
      description: string | null;
      type: "film" | "delf";
      level: string | null;
      levels: string[] | null;
      cover_image_url: string | null;
    };
    return ((data ?? []) as unknown as Row[]).map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      type: p.type,
      level: (p.levels && p.levels.length > 0 ? p.levels[0] : p.level) ?? null,
      coverUrl: p.cover_image_url,
      href: `/courses/${p.id}`,
    }));
  } catch {
    return [];
  }
}

export type CabinetHomeData = {
  fullName: string | null;
  avatarUrl: string | null;
  avatarMascot: string | null;
  continueTarget: ContinueTarget | null;
  scenesCompleted: number;
  pointsThisWeek: number;
  pointsByDay: PointsByDay[];
  streakDays: number;
  activeDays: string[];
  weeklyGoal: { done: number; goal: number };
  redoList: RedoItem[];
  redoCount: number;
  exam: ExamInfo | null;
  showExamCard: boolean;
  achievements: Achievement[];
};

const EMPTY_ACHIEVEMENTS: Achievement[] = [
  { key: "firstScene", earned: false, earnedAt: null, current: 0, target: 1 },
  { key: "streak7", earned: false, earnedAt: null, current: 0, target: 7 },
  { key: "points100", earned: false, earnedAt: null, current: 0, target: 100 },
];

const EMPTY_HOME_DATA: CabinetHomeData = {
  fullName: null,
  avatarUrl: null,
  avatarMascot: null,
  continueTarget: null,
  scenesCompleted: 0,
  pointsThisWeek: 0,
  pointsByDay: [],
  streakDays: 0,
  activeDays: [],
  weeklyGoal: { done: 0, goal: 3 },
  redoList: [],
  redoCount: 0,
  exam: null,
  showExamCard: false,
  achievements: EMPTY_ACHIEVEMENTS,
};

export type TaskRow = {
  id: string;
  type: string;
  config: Record<string, unknown> | null;
  scene_id: string | null;
  product_id: string;
};

export type SceneRow = { id: string; product_id: string; title: string; order_index: number };

export type ProgressRow = {
  task_id: string;
  score: number | null;
  best_score: number | null;
  attempts: number;
  last_attempt_at: string | null;
  block_progress: Record<string, { pointsEarned?: number; bestPointsEarned?: number }> | null;
};

type ActivityRow = {
  task_id: string;
  scene_id: string | null;
  product_id: string | null;
  score: number;
  best_before: number;
  best_after: number;
  created_at: string;
};

// Чи має завдання хоч одну спробу — та сама умова, що BILAN-лейбл
// "Scène terminée" (buildSceneSummary.allAttempted) перевіряє по кожному
// завданню сцени; винесено, бо library-data.ts (кабінет "Моя бібліотека")
// рахує той самий предикат і для завдань DELF-продуктів без сцен.
export function hasTaskAttempt(p: ProgressRow | undefined): boolean {
  return !!p && (p.attempts > 0 || p.score !== null || p.best_score !== null);
}

// Чи "здана" сцена для рахунку scenesCompleted: кожне гардоване завдання
// сцени має хоч одну спробу — рахується лише ознака "здано", без балів.
export function isSceneCompleted(
  sceneTasks: TaskRow[],
  progressByTaskId: Map<string, ProgressRow>
): boolean {
  if (sceneTasks.length === 0) return false;
  return sceneTasks.every((task) => hasTaskAttempt(progressByTaskId.get(task.id)));
}

export async function getCabinetHomeData(
  supabase: SupabaseClient,
  userId: string
): Promise<CabinetHomeData> {
  const now = new Date();
  const todayStr = kyivDateString(now);
  const weekStartStr = startOfWeekKyiv(now);
  const last7Days: string[] = Array.from({ length: 7 }, (_, i) => addDays(todayStr, i - 6));

  let fullName: string | null = null;
  let weeklyGoalSetting = 3;
  let exam: ExamInfo | null = null;
  try {
    // full_name/exam_*/weekly_goal_scenes — усі з давніх міграцій
    // (0001/0065), завжди присутні; НЕ в одному запиті з avatar_url/
    // avatar_mascot (0066) нижче — інакше непридатна до міграції колонка
    // валила б і це, й ProfileCard на Home показував би геть порожній
    // профіль замість лише відсутнього аватара.
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, exam_type, exam_date, weekly_goal_scenes")
      .eq("id", userId)
      .single<{
        full_name: string | null;
        exam_type: string | null;
        exam_date: string | null;
        weekly_goal_scenes: number;
      }>();
    fullName = profile?.full_name ?? null;
    weeklyGoalSetting = profile?.weekly_goal_scenes ?? 3;
    if (profile?.exam_type && profile?.exam_date) {
      const daysLeft = Math.round(
        (new Date(`${profile.exam_date}T00:00:00Z`).getTime() - new Date(`${todayStr}T00:00:00Z`).getTime()) /
          86_400_000
      );
      exam = { type: profile.exam_type, date: profile.exam_date, daysLeft };
    }
  } catch {
    // лишається null/дефолт — профільна картка просто не покаже іспит
  }

  let avatarUrl: string | null = null;
  let avatarMascot: string | null = null;
  try {
    const { data: extra } = await supabase
      .from("profiles")
      .select("avatar_url, avatar_mascot")
      .eq("id", userId)
      .single<{ avatar_url: string | null; avatar_mascot: string | null }>();
    avatarUrl = extra?.avatar_url ?? null;
    avatarMascot = extra?.avatar_mascot ?? null;
  } catch {
    // міграція 0066 ще не застосована — аватар/маскот лишаються null
  }

  const enrolledProducts = await getEnrolledProducts(supabase, userId);

  const productIds = enrolledProducts.map((p) => p.id);
  const productById = new Map(enrolledProducts.map((p) => [p.id, p]));
  const hasExamProduct = enrolledProducts.some((p) => isExamProductType(p.type));
  const showExamCard = hasExamProduct || exam !== null;

  let scenes: SceneRow[] = [];
  let tasks: TaskRow[] = [];
  let progressRows: ProgressRow[] = [];

  if (productIds.length > 0) {
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

  let activityRows: ActivityRow[] = [];
  try {
    const since = new Date(now.getTime() - ACTIVITY_LOOKBACK_DAYS * 86_400_000).toISOString();
    const { data } = await supabase
      .from("activity_log")
      .select("task_id, scene_id, product_id, score, best_before, best_after, created_at")
      .eq("user_id", userId)
      .gte("created_at", since);
    activityRows = (data ?? []) as ActivityRow[];
  } catch {
    activityRows = [];
  }

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const progressByTaskId = new Map(progressRows.map((p) => [p.task_id, p]));
  const scenesByProduct = new Map<string, SceneRow[]>();
  for (const scene of scenes) {
    const list = scenesByProduct.get(scene.product_id) ?? [];
    list.push(scene);
    scenesByProduct.set(scene.product_id, list);
  }
  const tasksByScene = new Map<string, TaskRow[]>();
  for (const task of tasks) {
    if (!task.scene_id) continue;
    const list = tasksByScene.get(task.scene_id) ?? [];
    list.push(task);
    tasksByScene.set(task.scene_id, list);
  }

  // scenesCompleted — по ВСІХ продуктах користувача.
  let scenesCompleted = 0;
  for (const scene of scenes) {
    const sceneTasks = tasksByScene.get(scene.id) ?? [];
    if (isSceneCompleted(sceneTasks, progressByTaskId)) scenesCompleted += 1;
  }

  function scenesCompletedForProduct(productId: string): { done: number; total: number } {
    const productScenes = scenesByProduct.get(productId) ?? [];
    let done = 0;
    for (const scene of productScenes) {
      const sceneTasks = tasksByScene.get(scene.id) ?? [];
      if (isSceneCompleted(sceneTasks, progressByTaskId)) done += 1;
    }
    return { done, total: productScenes.length };
  }

  // continue — завдання з найпізнішим last_attempt_at серед усіх продуктів.
  let continueTarget: ContinueTarget | null = null;
  try {
    let latest: ProgressRow | null = null;
    for (const p of progressRows) {
      if (!p.last_attempt_at) continue;
      if (!latest || !latest.last_attempt_at || p.last_attempt_at > latest.last_attempt_at) {
        latest = p;
      }
    }

    if (latest) {
      const task = taskById.get(latest.task_id);
      const product = task ? productById.get(task.product_id) : undefined;
      if (task && product) {
        const scene = task.scene_id
          ? (scenesByProduct.get(product.id) ?? []).find((s) => s.id === task.scene_id) ?? null
          : null;
        const productScenes = scenesByProduct.get(product.id) ?? [];
        const sceneIndex = scene ? productScenes.findIndex((s) => s.id === scene.id) + 1 : null;
        const { done, total } = scenesCompletedForProduct(product.id);
        continueTarget = {
          kind: "continue",
          href: scene
            ? `/courses/${product.id}/scenes/${scene.id}#task-${task.id}`
            : `/courses/${product.id}`,
          productId: product.id,
          productTitle: product.title,
          productType: product.type,
          productCoverUrl: product.cover_image_url,
          productLevel: product.levels[0] ?? null,
          sceneTitle: scene?.title ?? null,
          sceneIndex: sceneIndex && sceneIndex > 0 ? sceneIndex : null,
          sceneTotal: productScenes.length || null,
          taskTypeName: getDefaultTaskName(task.type, task.config),
          scenesCompletedInProduct: done,
          scenesTotalInProduct: total,
        };
      }
    } else if (enrolledProducts.length > 0) {
      const mostRecent = [...enrolledProducts].sort((a, b) =>
        a.purchased_at < b.purchased_at ? 1 : -1
      )[0];
      const productScenes = (scenesByProduct.get(mostRecent.id) ?? []).sort(
        (a, b) => a.order_index - b.order_index
      );
      const firstScene = productScenes[0] ?? null;
      const { done, total } = scenesCompletedForProduct(mostRecent.id);
      continueTarget = {
        kind: "start",
        href: firstScene
          ? `/courses/${mostRecent.id}/scenes/${firstScene.id}`
          : `/courses/${mostRecent.id}`,
        productId: mostRecent.id,
        productTitle: mostRecent.title,
        productType: mostRecent.type,
        productCoverUrl: mostRecent.cover_image_url,
        productLevel: mostRecent.levels[0] ?? null,
        sceneTitle: firstScene?.title ?? null,
        sceneIndex: firstScene ? 1 : null,
        sceneTotal: productScenes.length || null,
        taskTypeName: null,
        scenesCompletedInProduct: done,
        scenesTotalInProduct: total,
      };
    }
  } catch {
    continueTarget = null;
  }

  // pointsThisWeek / pointsByDay — та сама формула знаменника, що BILAN.
  let pointsThisWeek = 0;
  const pointsByDayMap = new Map(last7Days.map((d) => [d, 0]));
  try {
    for (const row of activityRows) {
      const task = taskById.get(row.task_id);
      if (!task) continue;
      const pointsPossible = totalPointsPossibleForTask(task.type, task.config);
      const delta = Math.max(0, (pointsPossible * (row.best_after - row.best_before)) / 100);
      const dateStr = kyivDateString(new Date(row.created_at));
      if (dateStr >= weekStartStr) pointsThisWeek += delta;
      if (pointsByDayMap.has(dateStr)) {
        pointsByDayMap.set(dateStr, (pointsByDayMap.get(dateStr) ?? 0) + delta);
      }
    }
  } catch {
    pointsThisWeek = 0;
  }
  const pointsByDay: PointsByDay[] = last7Days.map((date) => ({
    date,
    points: Math.round((pointsByDayMap.get(date) ?? 0) * 10) / 10,
  }));

  // streakDays / activeDays — з дат activity_log (90 днів вистачає і на
  // streak, і на дні активного місяця).
  const activityDates = new Set(activityRows.map((row) => kyivDateString(new Date(row.created_at))));
  const streakDays = computeStreakDays(activityDates, todayStr);
  const currentMonthPrefix = todayStr.slice(0, 7);
  const activeDays = [...activityDates].filter((d) => d.startsWith(currentMonthPrefix)).sort();

  // weeklyGoal.done — унікальні scene_id з активністю цього тижня.
  const sceneIdsThisWeek = new Set<string>();
  for (const row of activityRows) {
    if (!row.scene_id) continue;
    const dateStr = kyivDateString(new Date(row.created_at));
    if (dateStr >= weekStartStr) sceneIdsThisWeek.add(row.scene_id);
  }
  const weeklyGoal = { done: sceneIdsThisWeek.size, goal: weeklyGoalSetting };

  // redoList — усі гардовані завдання користувача з best% < порогу,
  // за зростанням відсотка, перші 4; redoCount — повна кількість.
  const redoCandidates: (RedoItem & { percent: number })[] = [];
  try {
    for (const task of tasks) {
      const progress = progressByTaskId.get(task.id);
      const best = computeTaskBest(
        task.type,
        task.config,
        progress
          ? { score: progress.score, bestScore: progress.best_score, blockProgress: progress.block_progress }
          : undefined
      );
      if (!best.attempted || best.pointsPossible <= 0) continue;
      const percent = Math.round((100 * best.pointsEarned) / best.pointsPossible);
      if (percent >= BILAN_REDO_THRESHOLD_PERCENT) continue;
      const product = productById.get(task.product_id);
      if (!product) continue;
      const scene = task.scene_id
        ? (scenesByProduct.get(product.id) ?? []).find((s) => s.id === task.scene_id)
        : undefined;
      redoCandidates.push({
        taskId: task.id,
        taskTypeName: getDefaultTaskName(task.type, task.config),
        sceneLabel: scene?.title ?? product.title,
        pointsEarned: Math.round(best.pointsEarned * 10) / 10,
        pointsPossible: Math.round(best.pointsPossible * 10) / 10,
        href: scene
          ? `/courses/${product.id}/scenes/${scene.id}#task-${task.id}`
          : `/courses/${product.id}#task-${task.id}`,
        percent,
      });
    }
    redoCandidates.sort((a, b) => a.percent - b.percent);
  } catch {
    redoCandidates.length = 0;
  }
  const redoCount = redoCandidates.length;
  const redoList: RedoItem[] = redoCandidates.slice(0, 4).map(({ percent, ...rest }) => {
    void percent;
    return rest;
  });

  // Досягнення — рахуються на ПОВНІЙ історії activity_log (без 90-денного
  // lookback, інакше студент, що здобув їх давно й неактивний останні 90
  // днів, побачив би "не здобуто"), окремим легким запитом, бо tasks тут
  // можуть належати продуктам, що вже не в enrolledProducts (архівовані/
  // відписані) — on-purpose НЕ той самий taskById, що вище.
  let achievements: Achievement[] = EMPTY_ACHIEVEMENTS;
  try {
    const { data } = await supabase
      .from("activity_log")
      .select("task_id, score, best_before, best_after, created_at")
      .eq("user_id", userId);
    const allActivityRows = (data ?? []) as {
      task_id: string;
      score: number;
      best_before: number;
      best_after: number;
      created_at: string;
    }[];
    allActivityRows.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

    const allTaskIds = [...new Set(allActivityRows.map((r) => r.task_id))];
    let allActivityTasks: { id: string; type: string; config: Record<string, unknown> | null }[] = [];
    if (allTaskIds.length > 0) {
      const { data: taskData } = await supabase.from("tasks").select("id, type, config").in("id", allTaskIds);
      allActivityTasks = (taskData ?? []) as typeof allActivityTasks;
    }
    const allActivityTaskById = new Map(allActivityTasks.map((t) => [t.id, t]));

    let totalPointsEver = 0;
    let points100EarnedAt: string | null = null;
    const allActivityDates = new Set<string>();
    for (const row of allActivityRows) {
      const task = allActivityTaskById.get(row.task_id);
      if (!task) continue;
      const pointsPossible = totalPointsPossibleForTask(task.type, task.config);
      const delta = Math.max(0, (pointsPossible * (row.best_after - row.best_before)) / 100);
      totalPointsEver += delta;
      allActivityDates.add(kyivDateString(new Date(row.created_at)));
      if (points100EarnedAt === null && totalPointsEver >= 100) points100EarnedAt = row.created_at;
    }

    let streak7EarnedAt: string | null = null;
    {
      const sortedDates = [...allActivityDates].sort();
      let runLength = 0;
      let prev: string | null = null;
      for (const d of sortedDates) {
        runLength = prev !== null && addDays(prev, 1) === d ? runLength + 1 : 1;
        if (runLength >= 7 && streak7EarnedAt === null) streak7EarnedAt = d;
        prev = d;
      }
    }

    let firstSceneEarnedAt: string | null = null;
    {
      const completionTimes: string[] = [];
      for (const scene of scenes) {
        const sceneTasks = tasksByScene.get(scene.id) ?? [];
        if (!isSceneCompleted(sceneTasks, progressByTaskId)) continue;
        let latest = "";
        for (const task of sceneTasks) {
          const last = progressByTaskId.get(task.id)?.last_attempt_at;
          if (last && last > latest) latest = last;
        }
        if (latest) completionTimes.push(latest);
      }
      completionTimes.sort();
      firstSceneEarnedAt = completionTimes[0] ?? null;
    }

    achievements = [
      {
        key: "firstScene",
        earned: scenesCompleted >= 1,
        earnedAt: firstSceneEarnedAt,
        current: Math.min(scenesCompleted, 1),
        target: 1,
      },
      {
        key: "streak7",
        earned: longestStreak(allActivityDates) >= 7,
        earnedAt: streak7EarnedAt,
        current: Math.min(streakDays, 7),
        target: 7,
      },
      {
        key: "points100",
        earned: totalPointsEver >= 100,
        earnedAt: points100EarnedAt,
        current: Math.round(Math.min(totalPointsEver, 100) * 10) / 10,
        target: 100,
      },
    ];
  } catch {
    achievements = EMPTY_ACHIEVEMENTS;
  }

  return {
    fullName,
    avatarUrl,
    avatarMascot,
    continueTarget,
    scenesCompleted,
    pointsThisWeek: Math.round(pointsThisWeek * 10) / 10,
    pointsByDay,
    streakDays,
    activeDays,
    weeklyGoal,
    redoList,
    redoCount,
    exam,
    showExamCard,
    achievements,
  };
}

export { EMPTY_HOME_DATA };
