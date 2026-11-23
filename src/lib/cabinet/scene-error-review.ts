// "Робота над помилками", крок 2 — серверний завантажувач ТІЄЇ САМОЇ
// моделі ErrorReviewBlock, що вже будує сценова сторінка (scenes/[sceneId]/
// page.tsx, приблизно рядки 404-671), для НОВОЇ сторінки /cabinet/mistakes/
// [sceneId] (не прив'язаної до наявності task.type==="error_correction" у
// сцені).
//
// Це НЕ витягнута спільна функція сценової сторінки — свідомий компромісний
// вибір, не недогляд:
// - allSceneTaskEntries (сценова сторінка) збирається з повного дерева
//   content-блоків сцени (orderedBlockRows/contentBlocksById/
//   attachedGroupByContentBlockId/membersByGroup), що вимагає десятків
//   попередніх запитів, не пов'язаних із "Роботою над помилками" взагалі
//   (відео/діалог/вокабуляр/оформлення тощо) — витягнути звідти лише
//   "список завдань сцени" без ризику зачепити порядок/видимість чогось
//   ІНШОГО на сторінці сцени означало б або ризиковий рефакторинг файлу
//   на 1000+ рядків, або нову абстракцію, якою сценова сторінка сама не
//   користується (а задача прямо просить не змінювати її поведінку).
// - Натомість тут — пряме відтворення: дві паралельні сторони одного й
//   того самого факту "завдання належить цій сцені" (scene_id напряму, або
//   через task_group, якщо tasks.task_group_id задано — 0031_task_groups.sql
//   обнуляє власний tasks.scene_id завдання, коли воно стає членом групи,
//   ефективний scene_id тоді лише в task_groups.scene_id). Порядок карток
//   усередині сцени тут — за tasks.order_index (а не за точною позицією
//   content-блоків сторінки сцени) — косметична відмінність: сама МОДЕЛЬ
//   помилок (buildErrorReviewEntry, isMistakePracticeSupported,
//   config_hash-інвалідація через RPC) — ТА САМА функція, викликана так
//   само, як на сторінці сцени, тож "виправлено/не виправлено"/кількість
//   елементів тут завжди збігаються з тим, що показала б сторінка сцени.
import {
  buildErrorReviewEntry,
  isMistakePracticeSupported,
  isWholePracticeTaskType,
  confirmedSolvedBlankIds,
  type MistakeRowLike,
} from "@/lib/exercises/error-review";
import { isGradableTaskType } from "@/lib/exercises/gradable-types";
import {
  sanitizeConfigForStudent,
  sanitizeMatchingForPractice,
  sanitizeDragDropForPractice,
  sanitizeImageMatchForPractice,
  sanitizeFillBlankForPractice,
  BLANK_RE,
} from "@/lib/exercises/sanitize";
import { getTaskBarText } from "@/lib/exercises/task-bar-text";
import type { GradableTaskType } from "@/lib/exercises/gradable-types";
import type { MatchingConfig, DragDropConfig, ImageMatchConfig, FillBlankConfig } from "@/lib/exercises/types";
import type { ErrorReviewEntryData, ErrorReviewEmptyState } from "@/components/exercises/error-review-block";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type SceneErrorReviewResult = {
  // null — сцена не знайдена/недоступна студенту (RLS: scenes_select
  // вимагає активний enrollment, той самий критерій, що сценова сторінка).
  scene: { id: string; title: string; productId: string } | null;
  courseTitle: string;
  entries: ErrorReviewEntryData[];
  emptyState: ErrorReviewEmptyState;
};

export async function loadSceneErrorReviewEntries(
  supabase: SupabaseClient,
  userId: string,
  sceneId: string
): Promise<SceneErrorReviewResult> {
  const { data: scene } = await supabase
    .from("scenes")
    .select("id, title, product_id")
    .eq("id", sceneId)
    .maybeSingle();

  if (!scene) {
    return { scene: null, courseTitle: "", entries: [], emptyState: "not_attempted" };
  }

  const { data: product } = await supabase.from("products").select("title").eq("id", scene.product_id).maybeSingle();

  // Два джерела завдань сцени (той самий факт, що tasksBlockEntries +
  // membersByGroup на сторінці сцени) — прямі (scene_id) і через групу
  // (task_groups.scene_id, бо tasks.scene_id члена групи обнульований).
  const [{ data: directTasks }, { data: groupRows }] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, type, title, config, order_index")
      .eq("scene_id", sceneId)
      .order("order_index", { ascending: true }),
    supabase.from("task_groups").select("id").eq("scene_id", sceneId),
  ]);

  const groupIds = (groupRows ?? []).map((g) => g.id);
  const { data: groupedTasks } = groupIds.length
    ? await supabase
        .from("tasks")
        .select("id, type, title, config, order_index")
        .in("task_group_id", groupIds)
        .order("order_index", { ascending: true })
    : { data: [] as never[] };

  const allSceneTasks = [...(directTasks ?? []), ...(groupedTasks ?? [])];
  const taskIds = allSceneTasks.map((t) => t.id);
  const taskTypeById = new Map(allSceneTasks.map((t) => [t.id, t.type]));
  const taskConfigById = new Map(allSceneTasks.map((t) => [t.id, t.config as Record<string, unknown> | null]));
  const taskTitleById = new Map(allSceneTasks.map((t) => [t.id, t.title as string]));
  const taskOrderPosition = new Map(allSceneTasks.map((t, i) => [t.id, i]));

  if (taskIds.length === 0) {
    return {
      scene: { id: scene.id, title: scene.title, productId: scene.product_id },
      courseTitle: product?.title ?? "",
      entries: [],
      emptyState: "not_attempted",
    };
  }

  const [{ data: rawMistakes }, { data: latestProgress }] = await Promise.all([
    supabase
      .from("mistakes")
      .select("task_id, ai_feedback, created_at")
      .eq("user_id", userId)
      .in("task_id", taskIds)
      .order("created_at", { ascending: false }),
    supabase.from("progress").select("task_id, score").eq("user_id", userId).in("task_id", taskIds),
  ]);

  const latestScoreByTask = new Map((latestProgress ?? []).map((p) => [p.task_id, p.score]));

  const mistakeRowsByTask = new Map<string, MistakeRowLike[]>();
  for (const m of rawMistakes ?? []) {
    const arr = mistakeRowsByTask.get(m.task_id) ?? [];
    arr.push({ createdAt: m.created_at, detail: m.ai_feedback });
    mistakeRowsByTask.set(m.task_id, arr);
  }
  const latestMistakeTaskIds = [...mistakeRowsByTask.keys()];

  // sceneMistakes — той самий фільтр, що сторінка сцени: лише завдання з
  // помилкою, остання спроба якої не 100%, і лише типи з реальною
  // практикою (isMistakePracticeSupported — те саме, що pilotTaskIds там).
  const sceneMistakeTaskIds = latestMistakeTaskIds
    .filter((id) => latestScoreByTask.get(id) !== 100)
    .filter((id) => isMistakePracticeSupported(taskTypeById.get(id) ?? ""))
    .sort((a, b) => (taskOrderPosition.get(a) ?? 0) - (taskOrderPosition.get(b) ?? 0));

  const correctionStates = await Promise.all(
    sceneMistakeTaskIds.map((id) => supabase.rpc("get_mistake_correction_state", { p_user_id: userId, p_task_id: id }))
  );
  const correctionStateByTask = new Map(
    sceneMistakeTaskIds.map((id, i) => [
      id,
      correctionStates[i].data?.[0] as
        | { corrected_item_ids: string[]; failed_attempts: Record<string, number> }
        | undefined,
    ])
  );

  const entries: ErrorReviewEntryData[] = sceneMistakeTaskIds
    .map((taskId) => {
      const taskType = taskTypeById.get(taskId) ?? "";
      const state = correctionStateByTask.get(taskId);
      const review = buildErrorReviewEntry({
        taskId,
        taskType,
        mistakeRows: mistakeRowsByTask.get(taskId) ?? [],
        correctedItemIds: state?.corrected_item_ids ?? [],
        failedAttempts: state?.failed_attempts ?? {},
        config: taskConfigById.get(taskId) ?? null,
      });
      const isWholePractice = review.mode === "whole" && isWholePracticeTaskType(taskType);
      const config = taskConfigById.get(taskId) ?? {};
      // Задача "fill_blank practice: show solved words instead of dashed
      // dots" — той самий принцип, що matching/drag_drop/image_match нижче
      // (page.tsx, errorReviewEntries, дзеркально): лише сервер (повний
      // config.template) може дати слово для пропусків поза помилками.
      // confirmedSolvedBlankIds вирішує, які саме безпечно показати, з
      // review.wrongItemIds/remainingItemIds, що вже рахує
      // buildErrorReviewEntry вище для цього самого запису.
      function fillBlankPracticeConfig(cfg: FillBlankConfig) {
        const blankCount = [...(cfg.template ?? "").matchAll(BLANK_RE)].length;
        return sanitizeFillBlankForPractice(
          cfg,
          confirmedSolvedBlankIds(blankCount, review.wrongItemIds, review.remainingItemIds)
        );
      }
      return {
        taskId,
        title: taskTitleById.get(taskId) ?? "",
        displayTitle: getTaskBarText({ type: taskType, config: taskConfigById.get(taskId) ?? null }),
        taskType,
        mode: review.mode,
        status: review.status,
        total: review.total,
        remainingItemIds: review.remainingItemIds,
        failedAttempts: review.failedAttempts,
        // Обидва включені режими (items/isWholePractice) завжди null —
        // summarizeMistake лише для НЕвключених типів на сторінці сцени
        // (не досягаються тут, бо isMistakePracticeSupported вище вже
        // відфільтрував усе інше).
        summary: null,
        config:
          review.mode === "items"
            ? taskType === "matching"
              ? // "Робота над помилками", сцена-вигляд (крок 4, мистейки-
                // сторінка) — фікс "pre-corrected pairs напіввирішені"
                // (owner report: "un formulaire"/"couramment" зеленим зліва,
                // звичайною карткою справа, без лінії): review.remainingItemIds
                // (ЖИВИЙ, звужується щоразу, коли студент виправляє пару),
                // НЕ review.wrongItemIds (ПОВНИЙ, ніколи не звужуваний набір
                // пар, що колись були помилкою, commit 17b7ac9) — пари,
                // виправлені ДО відкриття цієї задачі, тепер взагалі не
                // потрапляють у config.left/right/pairs (а не лише в один
                // стовпець, напіввирішено). Стабільність блоків У ЦІЙ сесії
                // (щойно виправлена пара НЕ має зникнути з дошки одразу
                // після router.refresh()) тепер забезпечує matching.tsx
                // (frozenSceneConfig — заморожує ПЕРШИЙ отриманий config на
                // монтуванні компонента, а не сервер через стабільний
                // пул) — той самий принцип "знімок на момент відкриття", що
                // snapshot у error-review-block.tsx для інших 3 типів, лише
                // тут заморожується увесь зріз конфіга (left/right/pairs),
                // бо right-варіанти не прив'язані до left публічно (секрет)
                // — клієнт не може сам дофільтрувати config.right за
                // id-списком. perBlockShuffle=true — right перемішується в
                // межах кожного блоку (sanitize.ts), щоб matching.tsx міг
                // позиційно нарізати config.right тим самим chunkMatchingPairs,
                // що config.left.
                sanitizeMatchingForPractice(config as unknown as MatchingConfig, review.remainingItemIds, true)
              : taskType === "drag_drop"
                ? sanitizeDragDropForPractice(config as unknown as DragDropConfig, review.remainingItemIds)
                : taskType === "image_match"
                  ? sanitizeImageMatchForPractice(config as unknown as ImageMatchConfig, review.remainingItemIds)
                  : taskType === "fill_blank"
                    ? fillBlankPracticeConfig(config as unknown as FillBlankConfig)
                    : sanitizeConfigForStudent(taskType as GradableTaskType, config)
            : isWholePractice
              ? sanitizeConfigForStudent(taskType as GradableTaskType, config)
              : null,
      };
    });
  // "done"-записи НЕ прибрані (та сама поведінка, що ErrorReviewBlock на
  // сторінці сцени — показує їх із банером "виправлено", не ховає) —
  // викликач (mistakes/[sceneId]/page.tsx) сам вирішує, чи лишився бодай
  // ОДИН НЕвиправлений запис (entries.some(e => e.status !== "done")),
  // щоб обрати між цим блоком і власною карткою "нічого не лишилось".

  const gradableTaskIds = allSceneTasks.filter((t) => isGradableTaskType(t.type)).map((t) => t.id);
  const attemptedGradableCount = gradableTaskIds.filter((id) => latestScoreByTask.has(id)).length;
  const emptyState: ErrorReviewEmptyState =
    attemptedGradableCount === 0
      ? "not_attempted"
      : gradableTaskIds.length > 0 && gradableTaskIds.every((id) => latestScoreByTask.get(id) === 100)
        ? "all_perfect"
        : "no_errors";

  return {
    scene: { id: scene.id, title: scene.title, productId: scene.product_id },
    courseTitle: product?.title ?? "",
    entries,
    emptyState,
  };
}
