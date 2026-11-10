// Каталог досягнень — одне джерело правди для Home (achievements-home-
// card.tsx) і Progress (progress/achievements-card.tsx): обидва місця
// рендерять ТОЙ САМИЙ ACHIEVEMENTS_CATALOG і дані з getAchievements, тож
// назви/стани ніколи не розходяться. Усе рахується з уже наявних даних
// (enrollments, progress, activity_log, профіль) — жодної нової таблиці.
//
// Для метрик, що рахуються ПОВНОЮ історією activity_log (бали/стрік/
// вправи/помилки/DELF/ціль тижня), earnedAt береться з МОМЕНТУ, коли
// кумулятивне значення вперше досягло порогу — для цього кожна метрика
// будує "timeline" (відсортований за часом список подій) і шукає перший
// момент, коли значення timeline досягає порогу кожного ачівмента цієї
// категорії. Для "scenes"/"films" дата — last_attempt_at останнього
// завдання, що завершило сцену/фільм (нема іншої точної дати).
import { createClient } from "@/lib/supabase/server";
import {
  getEnrolledProducts,
  getExamSettingsData,
  isSceneCompleted,
  type SceneRow,
  type TaskRow,
  type ProgressRow,
} from "@/lib/cabinet/home-data";
import { GRADABLE_TASK_TYPES } from "@/lib/exercises/gradable-types";
import { totalPointsPossibleForTask, BILAN_REDO_THRESHOLD_PERCENT } from "@/lib/exercises/scene-summary";
import { isExamProductType } from "@/lib/cabinet/exam-products";
import { kyivDateString, addDays, startOfWeekKyiv, computeStreakDays } from "@/lib/cabinet/kyiv-date";
import type { MessageKey } from "@/lib/i18n/t";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type AchievementCategory =
  | "scenes"
  | "films"
  | "streak"
  | "points"
  | "exercises"
  | "mistakes"
  | "weeklyGoal"
  | "exam"
  | "dictionary"
  | "collection";

export type AchievementDef = {
  id: string;
  category: AchievementCategory;
  threshold: number;
  nameKey: MessageKey;
  descKey: MessageKey;
  examOnly?: boolean;
  available?: boolean;
  // Колекція (1, 2, 3...) — ширша "книга" бейджів. Число, не літерал 1|2,
  // щоб майбутня Колекція III була просто новими записами в каталозі,
  // без зміни типу.
  collection: number;
  // Фінальний бейдж колекції (Trophy, без числа) — виключається з
  // collectionProgress() як "member", рахується окремо в getAchievements.
  isCollectionFinal?: boolean;
};

export type AchievementState = AchievementDef & {
  earned: boolean;
  earnedAt: string | null;
  current: number;
};

export const ACHIEVEMENTS_CATALOG: AchievementDef[] = [
  { id: "scenes1", category: "scenes", collection: 1, threshold: 1, nameKey: "achievements.scenes1.name", descKey: "achievements.scenes1.desc" },
  { id: "scenes5", category: "scenes", collection: 1, threshold: 5, nameKey: "achievements.scenes5.name", descKey: "achievements.scenes5.desc" },
  { id: "scenes10", category: "scenes", collection: 1, threshold: 10, nameKey: "achievements.scenes10.name", descKey: "achievements.scenes10.desc" },
  { id: "scenes25", category: "scenes", collection: 1, threshold: 25, nameKey: "achievements.scenes25.name", descKey: "achievements.scenes25.desc" },
  { id: "scenes50", category: "scenes", collection: 1, threshold: 50, nameKey: "achievements.scenes50.name", descKey: "achievements.scenes50.desc" },

  { id: "films1", category: "films", collection: 1, threshold: 1, nameKey: "achievements.films1.name", descKey: "achievements.films1.desc" },
  { id: "films3", category: "films", collection: 1, threshold: 3, nameKey: "achievements.films3.name", descKey: "achievements.films3.desc" },

  { id: "streak3", category: "streak", collection: 1, threshold: 3, nameKey: "achievements.streak3.name", descKey: "achievements.streak3.desc" },
  { id: "streak7", category: "streak", collection: 1, threshold: 7, nameKey: "achievements.streak7.name", descKey: "achievements.streak7.desc" },
  { id: "streak14", category: "streak", collection: 1, threshold: 14, nameKey: "achievements.streak14.name", descKey: "achievements.streak14.desc" },
  { id: "streak30", category: "streak", collection: 1, threshold: 30, nameKey: "achievements.streak30.name", descKey: "achievements.streak30.desc" },

  { id: "points100", category: "points", collection: 1, threshold: 100, nameKey: "achievements.points100.name", descKey: "achievements.points100.desc" },
  { id: "points500", category: "points", collection: 1, threshold: 500, nameKey: "achievements.points500.name", descKey: "achievements.points500.desc" },
  { id: "points1000", category: "points", collection: 1, threshold: 1000, nameKey: "achievements.points1000.name", descKey: "achievements.points1000.desc" },
  { id: "points5000", category: "points", collection: 1, threshold: 5000, nameKey: "achievements.points5000.name", descKey: "achievements.points5000.desc" },

  { id: "exercises10", category: "exercises", collection: 1, threshold: 10, nameKey: "achievements.exercises10.name", descKey: "achievements.exercises10.desc" },
  { id: "exercises50", category: "exercises", collection: 1, threshold: 50, nameKey: "achievements.exercises50.name", descKey: "achievements.exercises50.desc" },
  { id: "exercises100", category: "exercises", collection: 1, threshold: 100, nameKey: "achievements.exercises100.name", descKey: "achievements.exercises100.desc" },
  { id: "exercises250", category: "exercises", collection: 1, threshold: 250, nameKey: "achievements.exercises250.name", descKey: "achievements.exercises250.desc" },

  { id: "mistakes1", category: "mistakes", collection: 1, threshold: 1, nameKey: "achievements.mistakes1.name", descKey: "achievements.mistakes1.desc" },
  { id: "mistakes10", category: "mistakes", collection: 1, threshold: 10, nameKey: "achievements.mistakes10.name", descKey: "achievements.mistakes10.desc" },
  { id: "mistakes50", category: "mistakes", collection: 1, threshold: 50, nameKey: "achievements.mistakes50.name", descKey: "achievements.mistakes50.desc" },

  { id: "weeklyGoal1", category: "weeklyGoal", collection: 1, threshold: 1, nameKey: "achievements.weeklyGoal1.name", descKey: "achievements.weeklyGoal1.desc" },
  { id: "weeklyGoal4", category: "weeklyGoal", collection: 1, threshold: 4, nameKey: "achievements.weeklyGoal4.name", descKey: "achievements.weeklyGoal4.desc" },

  { id: "examFirst", category: "exam", collection: 1, threshold: 1, nameKey: "achievements.examFirst.name", descKey: "achievements.examFirst.desc", examOnly: true },
  { id: "examDateAdded", category: "exam", collection: 1, threshold: 1, nameKey: "achievements.examDateAdded.name", descKey: "achievements.examDateAdded.desc", examOnly: true },
  { id: "examDelf25", category: "exam", collection: 1, threshold: 25, nameKey: "achievements.examDelf25.name", descKey: "achievements.examDelf25.desc", examOnly: true },
  { id: "examDelf100", category: "exam", collection: 1, threshold: 100, nameKey: "achievements.examDelf100.name", descKey: "achievements.examDelf100.desc", examOnly: true },

  { id: "dict10", category: "dictionary", collection: 1, threshold: 10, nameKey: "achievements.dict10.name", descKey: "achievements.dict10.desc", available: false },
  { id: "dict50", category: "dictionary", collection: 1, threshold: 50, nameKey: "achievements.dict50.name", descKey: "achievements.dict50.desc", available: false },
  { id: "dict100", category: "dictionary", collection: 1, threshold: 100, nameKey: "achievements.dict100.name", descKey: "achievements.dict100.desc", available: false },

  // Колекція II "Майстерність" — вищі рівні, розблоковуються після
  // завершення Колекції I (isCollectionComplete). Ті самі категорії, нові
  // пороги.
  { id: "scenes100", category: "scenes", collection: 2, threshold: 100, nameKey: "achievements.scenes100.name", descKey: "achievements.scenes100.desc" },
  { id: "scenes250", category: "scenes", collection: 2, threshold: 250, nameKey: "achievements.scenes250.name", descKey: "achievements.scenes250.desc" },

  { id: "films5", category: "films", collection: 2, threshold: 5, nameKey: "achievements.films5.name", descKey: "achievements.films5.desc" },
  { id: "films10", category: "films", collection: 2, threshold: 10, nameKey: "achievements.films10.name", descKey: "achievements.films10.desc" },

  { id: "streak60", category: "streak", collection: 2, threshold: 60, nameKey: "achievements.streak60.name", descKey: "achievements.streak60.desc" },
  { id: "streak100", category: "streak", collection: 2, threshold: 100, nameKey: "achievements.streak100.name", descKey: "achievements.streak100.desc" },

  { id: "points10000", category: "points", collection: 2, threshold: 10000, nameKey: "achievements.points10000.name", descKey: "achievements.points10000.desc" },

  { id: "exercises500", category: "exercises", collection: 2, threshold: 500, nameKey: "achievements.exercises500.name", descKey: "achievements.exercises500.desc" },
  { id: "exercises1000", category: "exercises", collection: 2, threshold: 1000, nameKey: "achievements.exercises1000.name", descKey: "achievements.exercises1000.desc" },

  { id: "mistakes100", category: "mistakes", collection: 2, threshold: 100, nameKey: "achievements.mistakes100.name", descKey: "achievements.mistakes100.desc" },
  { id: "mistakes250", category: "mistakes", collection: 2, threshold: 250, nameKey: "achievements.mistakes250.name", descKey: "achievements.mistakes250.desc" },

  { id: "weeklyGoal8", category: "weeklyGoal", collection: 2, threshold: 8, nameKey: "achievements.weeklyGoal8.name", descKey: "achievements.weeklyGoal8.desc" },
  { id: "weeklyGoal12", category: "weeklyGoal", collection: 2, threshold: 12, nameKey: "achievements.weeklyGoal12.name", descKey: "achievements.weeklyGoal12.desc" },

  // Фінальні бейджі колекцій — category "collection", threshold лише
  // placeholder (перезаписується в getAchievements на earned/total
  // "інших" бейджів колекції); isCollectionFinal виключає їх із
  // collectionProgress(), щоб не рахувати бейдж сам на себе.
  { id: "collection1Complete", category: "collection", collection: 1, threshold: 0, nameKey: "achievements.collection1.name", descKey: "achievements.collection1.desc", isCollectionFinal: true },
  { id: "collection2Complete", category: "collection", collection: 2, threshold: 0, nameKey: "achievements.collection2.name", descKey: "achievements.collection2.desc", isCollectionFinal: true },
];

// Усі номери колекцій, що реально є в каталозі (відсортовано) — звідси
// Колекція III в майбутньому стане видимою скрізь (чипи, currentCollection,
// isCollectionComplete) лише через додавання записів у каталог вище, без
// зміни коду нижче.
export const COLLECTION_NUMBERS: number[] = [...new Set(ACHIEVEMENTS_CATALOG.map((d) => d.collection))].sort(
  (a, b) => a - b
);

// "Інші" бейджі колекції — усі, окрім isCollectionFinal (бейдж не рахує
// сам себе), з урахуванням тих самих правил видимості, що й решта UI
// (available!==false, examOnly лише якщо showExamCard) — інакше студент
// без увімкненого іспиту ніколи не побачив би DELF-бейджі колекції I, але
// міг би застрягти на "неповній" колекції назавжди.
export function collectionProgress(
  items: AchievementState[],
  showExamCard: boolean,
  collection: number
): { earned: number; total: number } {
  const members = items.filter(
    (a) => a.collection === collection && !a.isCollectionFinal && a.available !== false && (!a.examOnly || showExamCard)
  );
  return { earned: members.filter((a) => a.earned).length, total: members.length };
}

export function isCollectionComplete(items: AchievementState[], showExamCard: boolean, collection: number): boolean {
  const { earned, total } = collectionProgress(items, showExamCard, collection);
  return total > 0 && earned === total;
}

// Перша неповна колекція; якщо всі повні — остання (найвища).
export function currentCollection(items: AchievementState[], showExamCard: boolean): number {
  for (const n of COLLECTION_NUMBERS) {
    if (!isCollectionComplete(items, showExamCard, n)) return n;
  }
  return COLLECTION_NUMBERS[COLLECTION_NUMBERS.length - 1] ?? 1;
}

// earnedAt по кожному порогу категорії — для "count"-метрик timeline[i] =
// момент, коли i-та за часом подія сталась (значення метрики в цей момент
// = i+1); для points (кумулятивна сума) timeline[i].value — поточна сума
// після рядка i. computeThresholdTimestamps шукає ПЕРШИЙ момент, коли
// timeline.value >= порогу.
function computeThresholdTimestamps(
  thresholds: number[],
  timeline: { value: number; at: string }[]
): Map<number, string> {
  const result = new Map<number, string>();
  for (const threshold of thresholds) {
    for (const point of timeline) {
      if (point.value >= threshold) {
        result.set(threshold, point.at);
        break;
      }
    }
  }
  return result;
}

// earnedAt-мітки для кожного def у списку — за його threshold у timeline
// (один timeline, кілька порогів усередині тієї самої категорії, включно
// з Колекцією II — вищі пороги тієї самої метрики).
function earnedAtByIdFromTimeline(
  defs: AchievementDef[],
  timeline: { value: number; at: string }[]
): Partial<Record<string, string | null>> {
  const thresholds = defs.map((d) => d.threshold);
  const byThreshold = computeThresholdTimestamps(thresholds, timeline);
  const result: Partial<Record<string, string | null>> = {};
  for (const def of defs) result[def.id] = byThreshold.get(def.threshold) ?? null;
  return result;
}

// Прості цифри/прапорці студента — без дат чи таймлайнів. getAchievements
// рахує їх з повної історії activity_log (earnedAt при цьому йде ОКРЕМО,
// через earnedAtById, бо pure-функція нижче не має доступу до дат подій);
// адмін-симулятор (симулятор на фронтенді) підставляє сюди довільні
// значення, не торкаючись БД.
export type BadgeStats = {
  scenesCompleted: number;
  filmsCompleted: number;
  // streakDays — рекордний (ever-max) пробіг, визначає earned; currentStreakDays
  // — пробіг "сьогодні" для прогресу незавершеного бейджа (якщо не задано,
  // дорівнює streakDays — так симулятору достатньо одного поля).
  streakDays: number;
  currentStreakDays?: number;
  totalPoints: number;
  exercisesDone: number;
  mistakesFixed: number;
  weeksGoalDone: number;
  // examFirst/examDelf25/examDelf100 — усі три пороги тієї самої метрики.
  delfExercisesDone: number;
  examDateAdded: boolean;
};

// Чиста функція каталог+stats → AchievementState[] — ОДНЕ джерело правди
// для реальної сторінки (getAchievements нижче, earnedAtById з реальних
// дат) і для адмін-симулятора (без earnedAtById — дати не підставляються,
// вони не потрібні для перевірки розблокування/банера колекцій).
export function computeBadges(
  stats: BadgeStats,
  showExamCard: boolean,
  earnedAtById: Partial<Record<string, string | null>> = {}
): AchievementState[] {
  const currentStreakDays = stats.currentStreakDays ?? stats.streakDays;
  const valueByCategory: Record<AchievementCategory, number> = {
    scenes: stats.scenesCompleted,
    films: stats.filmsCompleted,
    streak: stats.streakDays,
    points: stats.totalPoints,
    exercises: stats.exercisesDone,
    mistakes: stats.mistakesFixed,
    weeklyGoal: stats.weeksGoalDone,
    exam: stats.delfExercisesDone,
    dictionary: 0,
    collection: 0,
  };

  const items: AchievementState[] = [];
  for (const def of ACHIEVEMENTS_CATALOG) {
    if (def.category === "collection") continue;
    if (def.category === "dictionary") {
      items.push({ ...def, earned: false, earnedAt: null, current: 0 });
      continue;
    }
    if (def.id === "examDateAdded") {
      items.push({ ...def, earned: stats.examDateAdded, earnedAt: null, current: stats.examDateAdded ? 1 : 0 });
      continue;
    }
    const value = valueByCategory[def.category];
    const earned = value >= def.threshold;
    const current = def.category === "streak" ? Math.min(currentStreakDays, def.threshold) : Math.min(value, def.threshold);
    items.push({ ...def, earned, earnedAt: earned ? earnedAtById[def.id] ?? null : null, current });
  }

  // Фінальні бейджі колекцій — рахуються ПІСЛЯ всіх інших items (бо
  // потребують collectionProgress() по вже побудованому списку). current/
  // threshold тут перезаписуються на earned/total "інших" бейджів цієї
  // колекції — так caption заблокованого бейджа ("{current} з {target}")
  // показує "{earned} з {total}" без окремого рендер-кейсу.
  for (const def of ACHIEVEMENTS_CATALOG) {
    if (def.category !== "collection") continue;
    const progress = collectionProgress(items, showExamCard, def.collection);
    const earned = progress.total > 0 && progress.earned === progress.total;
    let earnedAt: string | null = null;
    if (earned) {
      for (const member of items) {
        if (member.collection !== def.collection || member.isCollectionFinal) continue;
        if (member.earnedAt && (!earnedAt || member.earnedAt > earnedAt)) earnedAt = member.earnedAt;
      }
    }
    items.push({ ...def, threshold: progress.total, earned, earnedAt, current: progress.earned });
  }

  return items;
}

export type EarnedAtById = Partial<Record<string, string | null>>;

export type AchievementsResult = {
  items: AchievementState[];
  showExamCard: boolean;
  stats: BadgeStats;
  earnedAtById: EarnedAtById;
};

// Фолбек на випадок падіння getAchievements (сторінки catch'ають помилку
// окремо) — нейтральний stats-об'єкт для адмін-симулятора, щоб типи
// catch-фолбеків не розходились із реальним результатом.
export const EMPTY_BADGE_STATS: BadgeStats = {
  scenesCompleted: 0,
  filmsCompleted: 0,
  streakDays: 0,
  currentStreakDays: 0,
  totalPoints: 0,
  exercisesDone: 0,
  mistakesFixed: 0,
  weeksGoalDone: 0,
  delfExercisesDone: 0,
  examDateAdded: false,
};

// Найвищий порог категорії СЕРЕД записів з collection<=collection — для
// адмін-симулятора ("Зібрати всю Колекцію N"): значення, що задовольняє
// ВСІ пороги цієї категорії до вказаної колекції включно (монотонно —
// пороги Колекції II завжди вищі за Колекції I в тій самій категорії).
function maxThresholdUpTo(category: AchievementCategory, collection: number): number {
  let max = 0;
  for (const def of ACHIEVEMENTS_CATALOG) {
    if (def.category !== category || def.isCollectionFinal) continue;
    if (def.collection <= collection && def.threshold > max) max = def.threshold;
  }
  return max;
}

// Stats, що "закриває" колекцію N (і всі попередні — вищі пороги тієї ж
// категорії домінують над нижчими) — лише для адмін-симулятора, ніколи
// не торкається БД.
export function collectionPresetStats(collection: number): BadgeStats {
  const streak = maxThresholdUpTo("streak", collection);
  return {
    scenesCompleted: maxThresholdUpTo("scenes", collection),
    filmsCompleted: maxThresholdUpTo("films", collection),
    streakDays: streak,
    currentStreakDays: streak,
    totalPoints: maxThresholdUpTo("points", collection),
    exercisesDone: maxThresholdUpTo("exercises", collection),
    mistakesFixed: maxThresholdUpTo("mistakes", collection),
    weeksGoalDone: maxThresholdUpTo("weeklyGoal", collection),
    delfExercisesDone: maxThresholdUpTo("exam", collection),
    examDateAdded: true,
  };
}

export async function getAchievements(supabase: SupabaseClient, userId: string): Promise<AchievementsResult> {
  const defsByCategory = new Map<AchievementCategory, AchievementDef[]>();
  for (const def of ACHIEVEMENTS_CATALOG) {
    const list = defsByCategory.get(def.category) ?? [];
    list.push(def);
    defsByCategory.set(def.category, list);
  }

  const [enrolledProducts, examSettings] = await Promise.all([
    getEnrolledProducts(supabase, userId),
    getExamSettingsData(supabase, userId),
  ]);
  const { exam, showExamCard } = examSettings;

  const productIds = enrolledProducts.map((p) => p.id);
  const examProductIds = new Set(enrolledProducts.filter((p) => isExamProductType(p.type)).map((p) => p.id));

  let scenes: SceneRow[] = [];
  let tasks: TaskRow[] = [];
  let progressRows: ProgressRow[] = [];
  if (productIds.length > 0) {
    try {
      const { data } = await supabase
        .from("scenes")
        .select("id, product_id, title, order_index")
        .in("product_id", productIds);
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

  // scenes: кожна здана сцена → її completion time (max last_attempt_at
  // серед завдань сцени).
  const sceneCompletionTimes: string[] = [];
  const sceneCompletionTimeByScene = new Map<string, string>();
  for (const scene of scenes) {
    const sceneTasks = tasksByScene.get(scene.id) ?? [];
    if (!isSceneCompleted(sceneTasks, progressByTaskId)) continue;
    let latest = "";
    for (const task of sceneTasks) {
      const last = progressByTaskId.get(task.id)?.last_attempt_at;
      if (last && last > latest) latest = last;
    }
    if (latest) {
      sceneCompletionTimes.push(latest);
      sceneCompletionTimeByScene.set(scene.id, latest);
    }
  }
  sceneCompletionTimes.sort();

  // films: продукт типу "film" здано, коли здані ВСІ його сцени (і їх > 0).
  const filmCompletionTimes: string[] = [];
  for (const product of enrolledProducts) {
    if (product.type !== "film") continue;
    const productScenes = scenesByProduct.get(product.id) ?? [];
    if (productScenes.length === 0) continue;
    let latest = "";
    let allDone = true;
    for (const scene of productScenes) {
      const time = sceneCompletionTimeByScene.get(scene.id);
      if (!time) {
        allDone = false;
        break;
      }
      if (time > latest) latest = time;
    }
    if (allDone) filmCompletionTimes.push(latest);
  }
  filmCompletionTimes.sort();

  // Повна історія activity_log (без lookback) — для balls/стріку/вправ/
  // помилок/DELF/цілі тижня: on-purpose НЕ taskById вище, бо ці завдання
  // можуть належати продуктам, що вже не в enrolledProducts.
  let allActivityRows: {
    task_id: string;
    scene_id: string | null;
    score: number;
    best_before: number;
    best_after: number;
    created_at: string;
  }[] = [];
  try {
    const { data } = await supabase
      .from("activity_log")
      .select("task_id, scene_id, score, best_before, best_after, created_at")
      .eq("user_id", userId);
    allActivityRows = (data ?? []) as typeof allActivityRows;
  } catch {
    allActivityRows = [];
  }
  allActivityRows.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

  const allTaskIds = [...new Set(allActivityRows.map((r) => r.task_id))];
  let allActivityTasks: { id: string; type: string; config: Record<string, unknown> | null; product_id: string }[] = [];
  if (allTaskIds.length > 0) {
    try {
      const { data } = await supabase.from("tasks").select("id, type, config, product_id").in("id", allTaskIds);
      allActivityTasks = (data ?? []) as typeof allActivityTasks;
    } catch {
      allActivityTasks = [];
    }
  }
  const allActivityTaskById = new Map(allActivityTasks.map((t) => [t.id, t]));

  // exercises: кожне ЗАВДАННЯ рахується раз, у момент ПЕРШОЇ спроби
  // (перший рядок activity_log для нього), а не в момент останньої.
  const firstAttemptByTask = new Map<string, string>();
  for (const row of allActivityRows) {
    if (!firstAttemptByTask.has(row.task_id)) firstAttemptByTask.set(row.task_id, row.created_at);
  }
  // DELF-вправи: той самий предикат "перша спроба", лише для завдань
  // продуктів isExamProductType серед ПОТОЧНИХ enrollments.
  const delfFirstAttempts: string[] = [];
  for (const [taskId, at] of firstAttemptByTask) {
    const task = allActivityTaskById.get(taskId);
    if (task && examProductIds.has(task.product_id)) delfFirstAttempts.push(at);
  }
  delfFirstAttempts.sort();
  const delfTimeline = delfFirstAttempts.map((at, i) => ({ value: i + 1, at }));
  const delfExercisesDone = delfTimeline.length;

  // points: кумулятивна сума балів по кожному рядку (та сама формула, що
  // Home/Progress).
  let cumulativePoints = 0;
  const pointsTimeline: { value: number; at: string }[] = [];
  const activityDates = new Set<string>();
  const weekSceneIds = new Map<string, Set<string>>();
  const weekLatestAt = new Map<string, string>();
  const correctedTaskIds = new Set<string>();
  const mistakeCorrectionTimes: string[] = [];
  for (const row of allActivityRows) {
    const task = allActivityTaskById.get(row.task_id);
    const dateStr = kyivDateString(new Date(row.created_at));
    activityDates.add(dateStr);

    if (task) {
      const pointsPossible = totalPointsPossibleForTask(task.type, task.config);
      const delta = Math.max(0, (pointsPossible * (row.best_after - row.best_before)) / 100);
      cumulativePoints += delta;
      pointsTimeline.push({ value: cumulativePoints, at: row.created_at });
    }

    if (row.best_before < BILAN_REDO_THRESHOLD_PERCENT && row.best_after >= BILAN_REDO_THRESHOLD_PERCENT) {
      if (!correctedTaskIds.has(row.task_id)) {
        correctedTaskIds.add(row.task_id);
        mistakeCorrectionTimes.push(row.created_at);
      }
    }

    if (row.scene_id) {
      const weekStart = startOfWeekKyiv(new Date(row.created_at));
      const set = weekSceneIds.get(weekStart) ?? new Set<string>();
      set.add(row.scene_id);
      weekSceneIds.set(weekStart, set);
      const prevLatest = weekLatestAt.get(weekStart);
      if (!prevLatest || row.created_at > prevLatest) weekLatestAt.set(weekStart, row.created_at);
    }
  }
  mistakeCorrectionTimes.sort();

  // streak: timeline[i] = довжина поточного пробігу на i-ий день активності
  // (для earnedAt "коли-небудь досягнуто"); currentStreak — лише сьогоднішній
  // пробіг (для прогресу "in progress", щоб неактивний студент не бачив
  // хибно близький прогрес до давно втраченого стріку).
  const sortedDates = [...activityDates].sort();
  const streakTimeline: { value: number; at: string }[] = [];
  {
    let runLength = 0;
    let prev: string | null = null;
    for (const d of sortedDates) {
      runLength = prev !== null && addDays(prev, 1) === d ? runLength + 1 : 1;
      streakTimeline.push({ value: runLength, at: d });
      prev = d;
    }
  }
  const todayStr = kyivDateString(new Date());
  const currentStreak = computeStreakDays(activityDates, todayStr);

  // weeklyGoal: тижні, де унікальних scene_id >= ПОТОЧНОЇ цілі тижня
  // (ретроактивно, як і Home) — рахуємо раз на тиждень, дата = остання
  // активність ЦЬОГО тижня.
  let weeklyGoalSetting = 3;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("weekly_goal_scenes")
      .eq("id", userId)
      .single<{ weekly_goal_scenes: number }>();
    weeklyGoalSetting = data?.weekly_goal_scenes ?? 3;
  } catch {
    weeklyGoalSetting = 3;
  }
  const qualifyingWeekTimes: string[] = [];
  for (const [weekStart, sceneIds] of weekSceneIds) {
    if (sceneIds.size >= weeklyGoalSetting) {
      qualifyingWeekTimes.push(weekLatestAt.get(weekStart) ?? weekStart);
    }
  }
  qualifyingWeekTimes.sort();

  // Прості цифри — те, що реально рахувалось і раніше (сума/лічильники),
  // лише тепер зведені в один stats-об'єкт для чистої computeBadges().
  const everMax = streakTimeline.reduce((m, p) => Math.max(m, p.value), 0);
  const stats: BadgeStats = {
    scenesCompleted: sceneCompletionTimes.length,
    filmsCompleted: filmCompletionTimes.length,
    streakDays: everMax,
    currentStreakDays: currentStreak,
    totalPoints: Math.round(cumulativePoints * 10) / 10,
    exercisesDone: firstAttemptByTask.size,
    mistakesFixed: mistakeCorrectionTimes.length,
    weeksGoalDone: qualifyingWeekTimes.length,
    delfExercisesDone: delfExercisesDone,
    examDateAdded: !!exam,
  };

  // earnedAt — ОКРЕМО від stats (pure computeBadges() не бачить дат подій,
  // лише пороги): один timeline на категорію, той самий, що рахував
  // sortedTimes/pointsTimeline/streakTimeline/delfTimeline раніше.
  const earnedAtById: Partial<Record<string, string | null>> = {
    ...earnedAtByIdFromTimeline(
      defsByCategory.get("scenes") ?? [],
      sceneCompletionTimes.map((at, i) => ({ value: i + 1, at }))
    ),
    ...earnedAtByIdFromTimeline(
      defsByCategory.get("films") ?? [],
      filmCompletionTimes.map((at, i) => ({ value: i + 1, at }))
    ),
    ...earnedAtByIdFromTimeline(
      defsByCategory.get("exercises") ?? [],
      [...firstAttemptByTask.values()].sort().map((at, i) => ({ value: i + 1, at }))
    ),
    ...earnedAtByIdFromTimeline(
      defsByCategory.get("mistakes") ?? [],
      mistakeCorrectionTimes.map((at, i) => ({ value: i + 1, at }))
    ),
    ...earnedAtByIdFromTimeline(
      defsByCategory.get("weeklyGoal") ?? [],
      qualifyingWeekTimes.map((at, i) => ({ value: i + 1, at }))
    ),
    ...earnedAtByIdFromTimeline(defsByCategory.get("points") ?? [], pointsTimeline),
    ...earnedAtByIdFromTimeline(defsByCategory.get("streak") ?? [], streakTimeline),
    ...earnedAtByIdFromTimeline(
      (defsByCategory.get("exam") ?? []).filter((d) => d.id !== "examDateAdded"),
      delfTimeline
    ),
  };

  const items = computeBadges(stats, showExamCard, earnedAtById);
  return { items, showExamCard, stats, earnedAtById };
}

// Для Home: завжди 5 слотів (якщо каталог має стільки доступних items) —
// 3 нещодавно здобутих (earnedAt desc), далі найближчі "в процесі"
// (current/threshold desc, різні категорії пріоритетні), далі наступні
// "заблоковані" (threshold asc, різні категорії пріоритетні). available:
// false і examOnly без showExamCard — виключені одразу.
export function pickHomeAchievements(items: AchievementState[], showExamCard: boolean): AchievementState[] {
  const cur = currentCollection(items, showExamCard);
  const visible = items.filter(
    (a) => a.collection === cur && !a.isCollectionFinal && a.available !== false && (!a.examOnly || showExamCard)
  );

  const earned = [...visible]
    .filter((a) => a.earned)
    .sort((a, b) => (b.earnedAt ?? "").localeCompare(a.earnedAt ?? ""))
    .slice(0, 3);
  const chosenIds = new Set(earned.map((a) => a.id));
  const result = [...earned];

  // Бере з pool у порядку sortFn, по черзі віддаючи перевагу найкращому
  // item з ЩЕ не використаної категорії — usedCategories перевіряється
  // ЗНОВУ на кожній ітерації (а не один раз до циклу), інакше кілька
  // item того самого першого-побаченого category (напр. scenes5/10/25)
  // усі потрапляють у "fresh" одночасно й заповнюють увесь рядок.
  function takeVaried(pool: AchievementState[], sortFn: (a: AchievementState, b: AchievementState) => number) {
    const sorted = [...pool].sort(sortFn).filter((a) => !chosenIds.has(a.id));
    while (result.length < 5 && sorted.length > 0) {
      const usedCategories = new Set(result.map((a) => a.category));
      const idx = sorted.findIndex((a) => !usedCategories.has(a.category));
      const picked = sorted.splice(idx >= 0 ? idx : 0, 1)[0];
      result.push(picked);
      chosenIds.add(picked.id);
    }
  }

  const inProgressPool = visible.filter((a) => !a.earned && a.current > 0);
  takeVaried(inProgressPool, (a, b) => b.current / b.threshold - a.current / a.threshold || a.threshold - b.threshold);

  const lockedPool = visible.filter((a) => !a.earned && a.current === 0);
  takeVaried(lockedPool, (a, b) => a.threshold - b.threshold);

  return result.slice(0, 5);
}

// Для компактної картки "Досягнення" на /cabinet/progress: усі здобуті
// (earnedAt desc, без обмеження у 3), далі по ОДНОМУ найближчому
// нездобутому бейджу з кожної категорії (найменший нездобутий порог),
// відсортовані за порогом — до `limit` штук разом.
export function pickCompactAchievements(
  items: AchievementState[],
  showExamCard: boolean,
  limit = 8
): AchievementState[] {
  const cur = currentCollection(items, showExamCard);
  const visible = items.filter(
    (a) => a.collection === cur && !a.isCollectionFinal && a.available !== false && (!a.examOnly || showExamCard)
  );

  const earned = [...visible]
    .filter((a) => a.earned)
    .sort((a, b) => (b.earnedAt ?? "").localeCompare(a.earnedAt ?? ""));
  const result = [...earned];

  const nextByCategory = new Map<AchievementCategory, AchievementState>();
  for (const a of visible) {
    if (a.earned) continue;
    const existing = nextByCategory.get(a.category);
    if (!existing || a.threshold < existing.threshold) nextByCategory.set(a.category, a);
  }
  const nextUp = [...nextByCategory.values()].sort((a, b) => a.threshold - b.threshold);
  for (const a of nextUp) {
    if (result.length >= limit) break;
    result.push(a);
  }

  return result.slice(0, limit);
}
