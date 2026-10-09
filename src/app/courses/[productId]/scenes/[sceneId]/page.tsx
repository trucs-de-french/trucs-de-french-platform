import { Fragment } from "react";
import Link from "next/link";
import { Puzzle, Layers, Gamepad2, ExternalLink, type LucideIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPreviewCourseId, isVisibleToEnrolledStudent } from "@/lib/course-preview";
import { PreviewBanner, PreviewBlocked } from "@/components/preview-banner";
import { resolvePlatform } from "@/lib/platform";
import { PlatformIcon } from "@/components/platform-icon";
import { sanitizeConfigForStudent } from "@/lib/exercises/sanitize";
import { summarizeMistake } from "@/lib/exercises/summarize-mistake";
import {
  ERROR_REVIEW_EXCLUDED_TASK_TYPES,
  buildErrorReviewEntry,
  isPracticeItemsTaskType,
} from "@/lib/exercises/error-review";
import { isGradableTaskType, type GradableTaskType } from "@/lib/exercises/gradable-types";
import { ErrorReviewBlock } from "@/components/exercises/error-review-block";
import { ExerciseCard, isExerciseType } from "@/components/exercises/exercise-card";
import { ExerciseErrorBoundary } from "@/components/exercises/exercise-error-boundary";
import { VocabQuizExercise } from "@/components/exercises/vocab-quiz";
import { FlipCardsExercise } from "@/components/exercises/flip-cards";
import { EssayCheckExercise } from "@/components/exercises/essay-check";
import { CalloutExercise } from "@/components/exercises/callout";
import { PhoneticsExercise } from "@/components/exercises/phonetics";
import { TaskMedia } from "@/components/task-media";
import { EmbedFrame } from "@/components/embed-frame";
import { collectSceneVocab, type VocabItem } from "@/lib/vocab";
import { buildQuizQuestions } from "@/lib/exercises/vocab-quiz-logic";
import type {
  FlipCardsConfig,
  VocabQuizConfig,
  CalloutConfig,
  PhoneticsConfig,
} from "@/lib/exercises/types";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { DEFAULT_SCENE_BLOCK_ORDER, type SceneBlockType } from "@/lib/scene-block-order";
import { toEmbedUrl } from "@/lib/video";
import { VideoFrame } from "@/components/video-frame";
import { ScriptSection } from "./script-section";
import { VocabSection } from "./vocab-section";
import type { ExerciseTask } from "../../exercise-block";
import { TaskGroupBlock, type TaskGroupData } from "../../task-group-block";
import { EXERCISE_BLOCK_CLASS } from "@/components/task-card-style";
import { STUDENT_LINK_BUTTON } from "@/lib/button-styles";
import { H1_TO_CONTENT, H2_TO_CONTENT, EXERCISE_LIST_GAP, EXERCISE_STACK } from "@/lib/spacing";
import { STUDENT_PAGE_TITLE, STUDENT_SECTION_HEADING, EXERCISE_SUBINSTRUCTION } from "@/lib/typography-styles";
import { taskHasRenderableContent, contentBlockHasRenderableContent } from "@/lib/exercises/task-visibility";
import { TASK_TYPES_WITH_VISIBLE_TITLE } from "@/lib/exercises/task-type-meta";
import {
  SceneContentBlock,
  SceneContentBlockContent,
  type SceneContentBlockData,
  type SceneContentLink,
} from "../../scene-content-block";

type DialogueEntry = {
  speaker: string;
  text: string;
  vocab: VocabItem[];
  start?: number | null;
  videoLink?: string | null;
  translationUk?: string | null;
};

type LinkEmbedConfig = {
  url?: string;
  height?: number;
  label?: string;
  platform?: string;
  download?: boolean;
};

type TaskRow = {
  id: string;
  type: string;
  title: string;
  config: Record<string, unknown> | null;
  image_url: string | null;
  audio_url: string | null;
  points_visible: boolean;
  games: { embed_url: string | null; provider: string } | null;
};

// Технічна назва типу (напр. "embed") — лише для link/game, де вона реально
// підказує студенту, із чим він має справу (зовнішнє посилання/гра). Для
// embed прибрано: студент бачить заголовок вправи ("Jeu" тощо) і сам
// вміст, службова назва типу йому не потрібна. Той самий підхід, що вже
// в exercise-block.tsx.
const TYPES_WITH_TYPE_BADGE = ["link", "game"];

// ERROR_REVIEW_EXCLUDED_TASK_TYPES — перенесено в error-review.ts (reviewMode()
// має знати про винятки, не лише фільтр рендеру тут).

// platform у scene_links — НЕ той самий домен, що LinkPlatform/PlatformIcon
// (lib/platform.ts, для config.platform завдань типу link/embed:
// youtube/genially/custom за доменом URL) — тут окрема, вужча БД-колонка з
// CHECK-обмеженням рівно на 3 значення (0001_init.sql, розширено 0043
// custom для власних HTML-ігор): 'quizlet' | 'wordwall' | 'custom'.
// Fallback (ключа немає) — суто захисний, БД інших значень не пропустить.
const SCENE_LINK_PLATFORM_META: Record<string, { icon: LucideIcon; label: string }> = {
  wordwall: { icon: Puzzle, label: "Wordwall" },
  quizlet: { icon: Layers, label: "Quizlet" },
  custom: { icon: Gamepad2, label: "Власна гра" },
};
const DEFAULT_SCENE_LINK_META = { icon: ExternalLink, label: "Посилання" };

type MistakeRow = {
  id: string;
  task_id: string;
  ai_feedback: unknown;
  created_at: string;
};

type SceneBlockRow = { block_type: SceneBlockType | "content"; ref_id: string | null };

export default async function ScenePage({
  params,
}: {
  params: Promise<{ productId: string; sceneId: string }>;
}) {
  const { productId, sceneId } = await params;
  const supabase = await createClient();

  const { data: scene } = await supabase
    .from("scenes")
    .select("id, title, video_url, video_provider, dialogue")
    .eq("id", sceneId)
    .eq("product_id", productId)
    .single();

  if (!scene) {
    notFound();
  }

  const previewCourseId = await getPreviewCourseId();
  const isPreviewing = previewCourseId === productId;
  let previewBlocked = false;
  if (isPreviewing) {
    const { data: previewProduct } = await supabase
      .from("products")
      .select("is_published, archived_at")
      .eq("id", productId)
      .single();
    previewBlocked = !previewProduct || !isVisibleToEnrolledStudent(previewProduct);
  }

  if (previewBlocked) {
    return (
      <main className="mx-auto w-full max-w-3xl p-6">
        <Link href={`/courses/${productId}`} className="text-sm underline">
          ← До курсу
        </Link>
        <h1 className={`mt-2 ${STUDENT_PAGE_TITLE}`}>{scene.title}</h1>
        <PreviewBlocked productId={productId} />
      </main>
    );
  }

  const [
    { data: links },
    { data: tasks, error: tasksError },
    { data: taskGroups },
    { data: blocks, error: blocksError },
    { data: sceneContentBlocks },
  ] = await Promise.all([
    // is("content_block_id", null) — фіксована Практика сцени, не посилання
    // додаткових блоків типу 'links' (0038, підвантажуються окремо нижче).
    supabase
      .from("scene_links")
      .select("id, platform, url, label")
      .eq("scene_id", sceneId)
      .is("content_block_id", null)
      .order("order_index"),
    supabase
      .from("tasks")
      .select(
        "id, type, title, config, image_url, audio_url, points_visible, order_index, games(embed_url, provider)"
      )
      .eq("scene_id", sceneId)
      // Учасники task_group рендеряться ВСЕРЕДИНІ спільної рамки блоку
      // (TaskGroupBlock, через membersByGroup нижче) — без цього фільтра
      // (той самий, що вже є в delf-test-tasks.tsx і materials/page.tsx)
      // та сама задача потрапляла б у sceneRows ЩЕ РАЗ як окремий "task"-рядок
      // зі своєю власною EXERCISE_BLOCK_CLASS-рамкою — блок візуально
      // розпадався б на дві картки замість однієї спільної.
      .is("task_group_id", null)
      .order("order_index")
      .returns<(TaskRow & { order_index: number })[]>(),
    supabase
      .from("task_groups")
      .select(
        "id, content_type, content_text, media_url, media_provider, points_mode, flat_points, order_index"
      )
      .eq("scene_id", sceneId)
      .order("order_index")
      .returns<(TaskGroupData & { order_index: number })[]>(),
    supabase
      .from("scene_blocks")
      .select("block_type, ref_id")
      .eq("scene_id", sceneId)
      .order("position")
      .returns<SceneBlockRow[]>(),
    // Крок 2: сам порядок (включно з довільними content-блоками) визначає
    // scene_blocks вище, ref_id -> id тут.
    supabase
      .from("scene_content_blocks")
      .select("id, content_type, content_text, media_url, media_provider, dialogue")
      .eq("scene_id", sceneId)
      .returns<SceneContentBlockData[]>(),
  ]);

  // Посилання для додаткових блоків типу 'links' — окремий запит (не
  // фіксована Практика вище), той самий принцип пакетного підвантаження, що
  // groupMembers/membersByGroup нижче.
  const linksBlockIds = (sceneContentBlocks ?? [])
    .filter((b) => b.content_type === "links")
    .map((b) => b.id);
  const { data: blockLinks } =
    linksBlockIds.length > 0
      ? await supabase
          .from("scene_links")
          .select("id, platform, url, label, content_block_id")
          .in("content_block_id", linksBlockIds)
          .order("order_index")
          .returns<(SceneContentLink & { content_block_id: string })[]>()
      : { data: null };
  const linksByBlockId = new Map<string, SceneContentLink[]>();
  for (const link of blockLinks ?? []) {
    const arr = linksByBlockId.get(link.content_block_id) ?? [];
    arr.push(link);
    linksByBlockId.set(link.content_block_id, arr);
  }

  // Опційно прикріплений набір вправ (0040) — будь-який content-блок може
  // мати щонайбільше один такий task_group, батьківство scene_content_
  // block_id, не scene_id (тому НЕ в taskGroups вище, окремий запит). Його
  // id додається в taskGroupIds нижче — той самий groupMembers/membersByGroup
  // запит обслуговує обидва джерела task_groups.
  const contentBlockIds = (sceneContentBlocks ?? []).map((b) => b.id);
  const { data: attachedGroups } =
    contentBlockIds.length > 0
      ? await supabase
          .from("task_groups")
          .select(
            "id, scene_content_block_id, content_type, content_text, media_url, media_provider, points_mode, flat_points"
          )
          .in("scene_content_block_id", contentBlockIds)
          .returns<(TaskGroupData & { scene_content_block_id: string })[]>()
      : { data: null };
  const attachedGroupByContentBlockId = new Map(
    (attachedGroups ?? []).map((g) => [g.scene_content_block_id, g])
  );

  const taskGroupIds = [
    ...(taskGroups ?? []).map((g) => g.id),
    ...(attachedGroups ?? []).map((g) => g.id),
  ];
  const { data: groupMembers } =
    taskGroupIds.length > 0
      ? await supabase
          .from("tasks")
          .select(
            "id, type, title, config, image_url, audio_url, points_visible, task_group_id, games(embed_url, provider)"
          )
          .in("task_group_id", taskGroupIds)
          .order("order_index")
          .returns<(ExerciseTask & { task_group_id: string })[]>()
      : { data: null };

  const membersByGroup = new Map<string, ExerciseTask[]>();
  for (const m of groupMembers ?? []) {
    const arr = membersByGroup.get(m.task_group_id) ?? [];
    arr.push(m);
    membersByGroup.set(m.task_group_id, arr);
  }

  // Блоки без жодної задачі-члена не рендеримо взагалі — той самий принцип,
  // що вже в delf-test-tasks.tsx/materials-сторінці.
  //
  // vocab_quiz/error_correction (нижче, у tasksNode) — свідомо ЛИШЕ для
  // задач верхнього рівня сцени, не всередині блоків: обидва типи
  // потребують vocabForQuiz/sceneMistakes, специфічних для ЦІЄЇ сцени
  // closures, яких немає (і не повинно бути) у ExerciseBlock/
  // TaskGroupBlock — той самий, уже задокументований у exercise-block.tsx
  // принцип: "vocab_quiz/error_correction... свідомо не підтримуються тут".
  // Якщо вчитель покладе такий тип у блок, він просто не відрендериться —
  // наявне, а не нове обмеження ExerciseBlock.
  type SceneRow =
    | { kind: "task"; task: TaskRow & { order_index: number } }
    | {
        kind: "group";
        group: TaskGroupData & { order_index: number };
        members: ExerciseTask[];
      };
  const sceneRows: SceneRow[] = [
    ...(tasks ?? []).map((task): SceneRow => ({ kind: "task", task })),
    ...(taskGroups ?? [])
      .filter((g) => (membersByGroup.get(g.id) ?? []).length > 0)
      .map(
        (group): SceneRow => ({ kind: "group", group, members: membersByGroup.get(group.id)! })
      ),
  ].sort((a, b) => {
    const aIndex = a.kind === "task" ? a.task.order_index : a.group.order_index;
    const bIndex = b.kind === "task" ? b.task.order_index : b.group.order_index;
    return aIndex - bIndex;
  });

  if (tasksError) {
    // не даємо помилці запиту мовчки ховати весь блок вправ — принаймні
    // видно в серверних логах, що саме і чому не завантажилось
    console.error(`Не вдалося завантажити tasks для сцени ${sceneId}:`, tasksError.message);
  }

  if (blocksError) {
    // так само для scene_blocks — раніше ця помилка мовчки ховалась за
    // фолбеком DEFAULT_SCENE_BLOCK_ORDER, і виглядало так, ніби порядок груп
    // працює, хоча реальний запит увесь час падав.
    console.error(
      `Не вдалося завантажити scene_blocks для сцени ${sceneId}:`,
      blocksError.message
    );
  }

  const orderedBlockRows: SceneBlockRow[] =
    blocks && blocks.length > 0
      ? blocks
      : DEFAULT_SCENE_BLOCK_ORDER.map((type) => ({ block_type: type, ref_id: null }));

  const contentBlocksById = new Map((sceneContentBlocks ?? []).map((b) => [b.id, b]));

  const dialogue = (scene.dialogue ?? []) as DialogueEntry[];
  // Для блоку "Словник" у "Практиці" — лише лексика ЦІЄЇ сцени (на відміну
  // від vocabForQuiz нижче, який може об'єднувати кілька сцен курсу).
  const sceneVocab = collectSceneVocab(dialogue);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Плоский список УСІХ задач сцени для mistakes/progress — у два джерела:
  // (1) sceneRows — top-level задачі й ГРУПИ, прив'язані напряму через
  // task_groups.scene_id (ті, що формують блок "Завдання"); (2) групи,
  // прив'язані через task_groups.scene_content_block_id (attachedGroups/
  // membersByGroup, визначені вище) — ці НЕ входять у sceneRows узагалі
  // (sceneRows будує лише блок "Завдання", прикріплені групи рендеряться
  // окремо, разом зі своїм content-блоком, у render-циклі нижче), тож
  // 35735ab (що брав лише sceneRows) пропускав усі 4 групи сцени, прив'язані
  // лише через scene_content_block_id (із 5 груп, прив'язаних до сцен у БД,
  // лише 1 має task_groups.scene_id напряму).
  //
  // Порядок — не з двох довільних списків підряд, а повторює РЕАЛЬНИЙ
  // порядок рендеру: прохід по orderedBlockRows (той самий масив, що визначає
  // порядок секцій нижче) — на позиції block_type "task" вставляємо весь
  // sceneRows-список одним шматком (sceneRows уже впорядкований усередині
  // себе), на позиції block_type "content" із прикріпленою групою — її
  // задач-членів. Тобто картка прикріпленої групи в списку помилок стає на
  // місце свого content-блоку в сцені, а не в довільний кінець списку.
  type SceneTaskEntry = { id: string; type: string };
  const tasksBlockEntries: SceneTaskEntry[] = sceneRows.flatMap((row) =>
    row.kind === "task" ? [row.task] : row.members
  );
  let taskBlockInserted = false;
  const allSceneTaskEntries: SceneTaskEntry[] = [];
  for (const row of orderedBlockRows) {
    if (row.block_type === "task") {
      // "task" типово один рядок на сцену (nodeByBlockType — по одному
      // React-вузлу на тип) — guard лише на випадок, якщо scene_blocks
      // міститиме його двічі, щоб не продублювати весь список.
      if (taskBlockInserted) continue;
      taskBlockInserted = true;
      allSceneTaskEntries.push(...tasksBlockEntries);
      continue;
    }
    if (row.block_type === "content") {
      const content = row.ref_id ? contentBlocksById.get(row.ref_id) : undefined;
      const attachedGroup = content ? attachedGroupByContentBlockId.get(content.id) : undefined;
      if (attachedGroup) {
        allSceneTaskEntries.push(...(membersByGroup.get(attachedGroup.id) ?? []));
      }
    }
  }
  const taskIds = allSceneTaskEntries.map((t) => t.id);
  const taskTypeById = new Map(allSceneTaskEntries.map((t) => [t.id, t.type]));
  // config/title — allSceneTaskEntries типізований вузько як SceneTaskEntry
  // ({id,type}), але елементи в рантаймі — повні TaskRow/ExerciseTask (той
  // самий масив, лише звужений тип на момент push вище) — тут потрібні
  // config (для inline-практики items-типів — multiple_choice/fill_blank/
  // true_false/word_choice/letter_gaps, ErrorReviewBlock нижче) і title
  // (замість m.tasks?.title зі старого mistakes-запиту, щоб не плутати з
  // назвою з іншого джерела).
  const taskConfigById = new Map(
    allSceneTaskEntries.map((t) => [
      t.id,
      (t as unknown as { config: Record<string, unknown> | null }).config,
    ])
  );
  const taskTitleById = new Map(
    allSceneTaskEntries.map((t) => [t.id, (t as unknown as { title: string }).title])
  );
  const taskOrderPosition = new Map(allSceneTaskEntries.map((t, i) => [t.id, i]));
  // mistakes і progress не мають прямого FK одна на одну (обидві лише на
  // task_id/user_id окремо) — Supabase/PostgREST не виразить це одним
  // embed-запитом, тож два паралельні. progress має unique(user_id, task_id)
  // — один рядок на завдання, який ЗАВЖДИ перезаписується останньою спробою
  // (record_task_attempt RPC, викликається на кожній перевірці до mistakes-
  // insert) — тож не треба порівнювати часові мітки з mistakes.created_at:
  // score===100 у progress вже й так означає "остання спроба правильна",
  // а будь-який mistakes-рядок на це завдання — заздалегідь застарілий.
  const [{ data: rawMistakes }, { data: latestProgress }] =
    user && taskIds.length > 0
      ? await Promise.all([
          supabase
            .from("mistakes")
            .select("id, task_id, ai_feedback, created_at")
            .eq("user_id", user.id)
            .in("task_id", taskIds)
            .order("created_at", { ascending: false })
            .returns<MistakeRow[]>(),
          supabase
            .from("progress")
            .select("task_id, score")
            .eq("user_id", user.id)
            .in("task_id", taskIds)
            .returns<{ task_id: string; score: number | null }[]>(),
        ])
      : [{ data: null }, { data: null }];

  const latestScoreByTask = new Map<string, number | null>();
  for (const p of latestProgress ?? []) {
    latestScoreByTask.set(p.task_id, p.score);
  }

  // одна найсвіжіша помилка на завдання — не показуємо всю історію спроб
  const latestMistakeByTask = new Map<string, MistakeRow>();
  for (const m of rawMistakes ?? []) {
    if (!latestMistakeByTask.has(m.task_id)) {
      latestMistakeByTask.set(m.task_id, m);
    }
  }

  // Серверна модель "Робота над помилками": mode="items" (переробка
  // поелементно) реалізовано для multiple_choice/fill_blank (частина 1) і
  // true_false/word_choice/letter_gaps (частина 3) — isPracticeItemsTaskType,
  // error-review.ts. Для НИХ рахуємо помилки по ВСІХ записах mistakes
  // завдання (aggregateWrongItems, не лише найновішому, бо для блокових
  // вправ кожен запис несе лише detail одного перевіреного блоку). Для
  // решти типів (mode="whole")
  // buildErrorReviewEntry повертає тривіальну "items"-частину (завжди
  // порожню/not_started) — короткий опис картки такого завдання береться
  // з summarizeMistake (нижче), а не з цієї моделі.
  const mistakeRowsByTask = new Map<string, { createdAt: string; detail: unknown }[]>();
  for (const m of rawMistakes ?? []) {
    const arr = mistakeRowsByTask.get(m.task_id) ?? [];
    arr.push({ createdAt: m.created_at, detail: m.ai_feedback });
    mistakeRowsByTask.set(m.task_id, arr);
  }
  // Якщо остання спроба на це завдання (за progress, не за mistakes) уже
  // повністю правильна — не показуємо давню помилку, ніби вона й досі
  // актуальна.
  // Другий .filter — ERROR_REVIEW_EXCLUDED_TASK_TYPES (essay_check/word_search/
  // crossword/karaoke/vocab_quiz, визначено вище) не беруть участі в списку
  // помилок. .sort — той самий порядок, що в списку "Завдання" (taskOrderPosition,
  // побудований з уже відсортованого sceneRows), а не порядок mistakes.created_at.
  const sceneMistakes = [...latestMistakeByTask.values()]
    .filter((m) => latestScoreByTask.get(m.task_id) !== 100)
    .filter(
      (m) => !(ERROR_REVIEW_EXCLUDED_TASK_TYPES as readonly string[]).includes(taskTypeById.get(m.task_id) ?? "")
    )
    .sort((a, b) => (taskOrderPosition.get(a.task_id) ?? 0) - (taskOrderPosition.get(b.task_id) ?? 0));

  // RPC get_mistake_correction_state — лише для пілотних items-типів
  // серед sceneMistakes: whole-типам ця модель не потрібна (mode!=="items",
  // correctedItemIds/failedAttempts не використовуються).
  const pilotTaskIds = sceneMistakes
    .map((m) => m.task_id)
    .filter((id) => isPracticeItemsTaskType(taskTypeById.get(id) ?? ""));
  const correctionStates = await Promise.all(
    pilotTaskIds.map((id) =>
      supabase.rpc("get_mistake_correction_state", { p_user_id: user!.id, p_task_id: id })
    )
  );
  const correctionStateByTask = new Map(
    pilotTaskIds.map((id, i) => [
      id,
      correctionStates[i].data?.[0] as
        | { corrected_item_ids: string[]; failed_attempts: Record<string, number> }
        | undefined,
    ])
  );
  const errorReviewByTask = new Map(
    sceneMistakes.map((m) => {
      const state = correctionStateByTask.get(m.task_id);
      return [
        m.task_id,
        buildErrorReviewEntry({
          taskId: m.task_id,
          taskType: taskTypeById.get(m.task_id) ?? "",
          mistakeRows: mistakeRowsByTask.get(m.task_id) ?? [],
          correctedItemIds: state?.corrected_item_ids ?? [],
          failedAttempts: state?.failed_attempts ?? {},
        }),
      ] as const;
    })
  );
  // Картки блоку "Робота над помилками" (ErrorReviewBlock, клієнтський
  // компонент нижче) — для items-типів передаємо санітизований config
  // (sanitizeConfigForStudent, той самий, що вже рендерить вправу вище на
  // сторінці), щоб inline-практика могла показати ТОЙ САМИЙ студентський
  // компонент (MultipleChoiceExercise/FillBlankExercise) з onlyItemIds; для
  // whole-типів — короткий опис з summarizeMistake (старий шлях, без змін).
  const errorReviewEntries = sceneMistakes.map((m) => {
    const review = errorReviewByTask.get(m.task_id)!;
    const taskType = taskTypeById.get(m.task_id) ?? "";
    return {
      taskId: m.task_id,
      title: taskTitleById.get(m.task_id) ?? "",
      taskType,
      mode: review.mode,
      status: review.status,
      total: review.total,
      remainingItemIds: review.remainingItemIds,
      failedAttempts: review.failedAttempts,
      summary: review.mode === "items" ? null : summarizeMistake(m.ai_feedback),
      config:
        review.mode === "items"
          ? sanitizeConfigForStudent(taskType as GradableTaskType, taskConfigById.get(m.task_id) ?? {})
          : null,
    };
  });
  const gradableTaskIds = allSceneTaskEntries.filter((t) => isGradableTaskType(t.type)).map((t) => t.id);
  const attemptedGradableCount = gradableTaskIds.filter((id) => latestScoreByTask.has(id)).length;
  const errorReviewEmptyState: "not_attempted" | "no_errors" | "all_perfect" =
    attemptedGradableCount === 0
      ? "not_attempted"
      : gradableTaskIds.length > 0 && gradableTaskIds.every((id) => latestScoreByTask.get(id) === 100)
        ? "all_perfect"
        : "no_errors";

  // vocab_quiz бере лексику не лише з поточної сцени, а з будь-яких сцен
  // курсу, обраних вчителем у config.sceneIds — підвантажуємо їхній dialogue
  // одним батч-запитом (а не по одному на кожне завдання).
  const vocabQuizSceneIds = new Set<string>();
  for (const task of tasks ?? []) {
    if (task.type === "vocab_quiz") {
      const ids = (task.config as VocabQuizConfig | null)?.sceneIds ?? [];
      ids.forEach((id) => vocabQuizSceneIds.add(id));
    }
  }
  const idsToFetch = [...vocabQuizSceneIds].filter((id) => id !== sceneId);

  const { data: vocabScenes } =
    idsToFetch.length > 0
      ? await supabase
          .from("scenes")
          .select("id, dialogue")
          .eq("product_id", productId)
          .in("id", idsToFetch)
      : { data: null };

  const dialogueBySceneId = new Map<string, DialogueEntry[]>();
  dialogueBySceneId.set(sceneId, dialogue);
  for (const vs of vocabScenes ?? []) {
    dialogueBySceneId.set(vs.id, (vs.dialogue ?? []) as DialogueEntry[]);
  }

  function vocabForQuiz(config: VocabQuizConfig | null | undefined): VocabItem[] {
    const ids = config?.sceneIds ?? [];
    const merged = ids.flatMap((id) => dialogueBySceneId.get(id) ?? []);
    return collectSceneVocab(merged);
  }

  const videoNode = scene.video_url && (
    <section>
      <h2 className={STUDENT_SECTION_HEADING}>Відео</h2>
      <div className={H2_TO_CONTENT}>
        <VideoFrame
          src={toEmbedUrl(scene.video_url, scene.video_provider)}
          title={scene.title}
          provider={scene.video_provider ?? "youtube"}
        />
      </div>
    </section>
  );

  const scriptNode = (
    <section>
      <ScriptSection dialogue={dialogue} title="Скрипт" />
    </section>
  );

  const linkList = links ?? [];
  const hasLinks = linkList.length > 0;
  const hasVocab = sceneVocab.length > 0;

  const linksNode = hasLinks && (
    <section>
      <h2 className={STUDENT_SECTION_HEADING}>Практика</h2>
      {/* auto-fill(minmax(12rem,1fr)) — кілька карток у ряд на широкому
          екрані, по одній на всю ширину на мобільних. */}
      <div className={`${H2_TO_CONTENT} grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3`}>
        {linkList.map((link) => {
          const meta = SCENE_LINK_PLATFORM_META[link.platform] ?? DEFAULT_SCENE_LINK_META;
          const Icon = meta.icon;
          return (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition duration-150 hover:-translate-y-0.5 hover:border-brand hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:border-neutral-700 dark:bg-neutral-800"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <Icon size={18} />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-heading text-base font-semibold">
                  {link.label ?? meta.label}
                </span>
                <span className="text-sm text-neutral-500 dark:text-neutral-400">{meta.label}</span>
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );

  const vocabNode = hasVocab && (
    <section>
      <VocabSection vocab={sceneVocab} pdfHref={`/api/scenes/${sceneId}/vocab-pdf`} />
    </section>
  );

  const tasksNode = sceneRows.length > 0 && (
    <section>
      <h2 className={STUDENT_SECTION_HEADING}>Завдання</h2>
      <ul className={`${H2_TO_CONTENT} flex flex-col ${EXERCISE_LIST_GAP}`}>
        {sceneRows.map((row) => {
          if (row.kind === "group") {
            return (
              <li key={`group-${row.group.id}`} id={`group-${row.group.id}`} className="scroll-mt-4">
                <TaskGroupBlock group={row.group} tasks={row.members} />
              </li>
            );
          }

          const task = row.task;
          const config = (task.config ?? {}) as LinkEmbedConfig;
          if (!taskHasRenderableContent(task)) return null;

          return (
            <li
              key={task.id}
              id={`task-${task.id}`}
              className={`scroll-mt-4 ${EXERCISE_STACK} ${task.type === "callout" ? "" : EXERCISE_BLOCK_CLASS}`}
            >
              {TASK_TYPES_WITH_VISIBLE_TITLE.includes(task.type) && (
                <div>
                  {TYPES_WITH_TYPE_BADGE.includes(task.type) && (
                    <span className="text-xs uppercase text-neutral-500 dark:text-neutral-400">
                      {task.type}
                    </span>
                  )}
                  <p className="font-medium">{task.title}</p>
                </div>
              )}

              <TaskMedia imageUrl={task.image_url} audioUrl={task.audio_url} />

              {task.type === "vocab_quiz" && (
                <ExerciseErrorBoundary>
                  <div className="flex flex-col gap-2">
                    <div>
                      <p className="font-medium">{DEFAULT_INSTRUCTIONS.vocab_quiz.instruction}</p>
                      <p className={`mt-1 ${EXERCISE_SUBINSTRUCTION}`}>
                        {DEFAULT_INSTRUCTIONS.vocab_quiz.subInstruction}
                      </p>
                    </div>
                    {(() => {
                      const quizVocab = vocabForQuiz(task.config as VocabQuizConfig | null);
                      return (
                        <VocabQuizExercise
                          vocab={quizVocab}
                          initialQuestions={buildQuizQuestions(quizVocab)}
                        />
                      );
                    })()}
                  </div>
                </ExerciseErrorBoundary>
              )}

              {task.type === "error_correction" && (
                <ExerciseErrorBoundary>
                  <ErrorReviewBlock entries={errorReviewEntries} emptyState={errorReviewEmptyState} />
                </ExerciseErrorBoundary>
              )}

              {task.type === "flip_cards" && (
                <ExerciseErrorBoundary>
                  <FlipCardsExercise
                    config={(task.config ?? { cards: [] }) as unknown as FlipCardsConfig}
                  />
                </ExerciseErrorBoundary>
              )}

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

              {task.type === "phonetics" && (
                <ExerciseErrorBoundary>
                  <PhoneticsExercise
                    config={(task.config ?? { items: [] }) as unknown as PhoneticsConfig}
                  />
                </ExerciseErrorBoundary>
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
                  className={`inline-flex items-center gap-2 self-start ${STUDENT_LINK_BUTTON}`}
                >
                  Відкрити гру ({task.games.provider})
                </a>
              )}

              {task.type === "link" && config.url && config.download && (
                <a
                  href={config.url}
                  download
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 self-start ${STUDENT_LINK_BUTTON}`}
                >
                  ⬇ {config.label ?? "Завантажити файл"}
                </a>
              )}

              {task.type === "link" && config.url && !config.download && (
                <a
                  href={config.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-2 self-start ${STUDENT_LINK_BUTTON}`}
                >
                  <PlatformIcon platform={resolvePlatform(config.url, config.platform)} />
                  {config.label ?? "Відкрити"}
                </a>
              )}

              {task.type === "embed" && config.url && (
                <EmbedFrame url={config.url} height={config.height ?? 480} />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );

  const nodeByBlockType: Record<SceneBlockType, React.ReactNode> = {
    video: videoNode,
    script: scriptNode,
    link: linksNode,
    task: tasksNode,
    vocab: vocabNode,
  };

  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <Link href={`/courses/${productId}`} className="text-sm underline">
        ← До курсу
      </Link>
      {isPreviewing && <PreviewBanner productId={productId} />}
      <h1 className={`mt-2 ${STUDENT_PAGE_TITLE}`}>{scene.title}</h1>

      {/* H1_TO_CONTENT — відступ від h1 до першої секції; gap-8 — той самий
          32px МІЖ секціями (Відео/Скрипт/Практика/Вокабуляр/Завдання/
          довільні content-блоки) — одна спільна обгортка замість mt-8 на
          КОЖНІЙ із 6 секцій нижче. Секції рендеряться умовно (falsy/null),
          але це не заважає: React не створює DOM-вузол для false/null,
          тож flex-gap коректно рахує лише те, що справді відображається. */}
      <div className={`${H1_TO_CONTENT} flex flex-col gap-8`}>
        {orderedBlockRows.map((row, i) => {
          if (row.block_type === "content") {
            const content = row.ref_id ? contentBlocksById.get(row.ref_id) : undefined;
            if (!content) return null;
            const block =
              content.content_type === "links"
                ? { ...content, links: linksByBlockId.get(content.id) ?? [] }
                : content;
            const attachedGroup = attachedGroupByContentBlockId.get(content.id);
            const attachedMembers = attachedGroup ? (membersByGroup.get(attachedGroup.id) ?? []) : [];
            const hasAttachedContent = !!attachedGroup && attachedMembers.length > 0;
            const blockHasOwnContent = contentBlockHasRenderableContent(block);
            // Сам content-блок порожній (нема заповненого поля для свого
            // content_type) І немає прикріпленого набору вправ — секцію
            // цілком пропускаємо, інакше лишається невидима "рамка" з
            // padding, а gap-8 батьківського flex усе одно додав би зазор
            // з обох боків порожнього елемента.
            if (!blockHasOwnContent && !hasAttachedContent) return null;

            // Прикріплена група — ОДНА спільна секція на контент блоку й
            // вправи разом (bare-режим TaskGroupBlock, без його власної
            // <section>) — інакше картка розпадається на дві (баг, що
            // виправляє ця задача). panelForText на SceneContentBlockContent
            // додає ту саму сіру підкладку з смугою зліва, що й для
            // текстового контенту самого TaskGroupBlock — і сірий
            // фон/смугу так само НЕ додає для аудіо/відео/embed/лінків.
            if (hasAttachedContent) {
              return (
                <section key={`content-${row.ref_id}`} className={`${EXERCISE_BLOCK_CLASS} ${EXERCISE_STACK}`}>
                  <TaskGroupBlock
                    group={attachedGroup}
                    tasks={attachedMembers}
                    bare
                    extraSharedContent={
                      blockHasOwnContent ? <SceneContentBlockContent block={block} panelForText /> : null
                    }
                  />
                </section>
              );
            }

            // Без прикріпленої групи — звичайна окрема картка content-блоку,
            // як і раніше (без підкладки, вона потрібна лише коли під
            // матеріалом є вправи).
            return (
              <section key={`content-${row.ref_id}`}>
                <SceneContentBlock block={block} />
              </section>
            );
          }
          return <Fragment key={`${row.block_type}-${i}`}>{nodeByBlockType[row.block_type]}</Fragment>;
        })}
      </div>
    </main>
  );
}
