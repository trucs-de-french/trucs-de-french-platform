import { Fragment } from "react";
import Link from "next/link";
import { Gamepad2 } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPreviewCourseId, isVisibleToEnrolledStudent } from "@/lib/course-preview";
import { PreviewBanner, PreviewBlocked } from "@/components/preview-banner";
import { resolveLinkTaskIcon, linkTaskDefaultSubtitle, resolveSceneLinkMeta } from "@/lib/link-task-icon";
import {
  sanitizeConfigForStudent,
  sanitizeMatchingForPractice,
  sanitizeDragDropForPractice,
  sanitizeImageMatchForPractice,
} from "@/lib/exercises/sanitize";
import { summarizeMistake } from "@/lib/exercises/summarize-mistake";
import {
  ERROR_REVIEW_EXCLUDED_TASK_TYPES,
  buildErrorReviewEntry,
  isPracticeItemsTaskType,
  isWholePracticeTaskType,
} from "@/lib/exercises/error-review";
import { isGradableTaskType, type GradableTaskType } from "@/lib/exercises/gradable-types";
import { ErrorReviewBlock } from "@/components/exercises/error-review-block";
import { ExerciseCard, isExerciseType } from "@/components/exercises/exercise-card";
import { ExerciseErrorBoundary } from "@/components/exercises/exercise-error-boundary";
import { BlockTabs } from "@/components/exercises/block-navigation";
import { VocabQuizExercise } from "@/components/exercises/vocab-quiz";
import { FlipCardsExercise } from "@/components/exercises/flip-cards";
import { EssayCheckExercise } from "@/components/exercises/essay-check";
import { CalloutExercise } from "@/components/exercises/callout";
import { PhoneticsExercise } from "@/components/exercises/phonetics";
import { TaskMedia } from "@/components/task-media";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { LinkCard } from "@/components/link-card";
import { GlassBlock } from "@/components/glass-block";
import { resolveBlockIcon } from "@/lib/block-icons";
import { getTaskBarText } from "@/lib/exercises/task-bar-text";
import { EmbedFrame } from "@/components/embed-frame";
import { collectSceneVocab, collectVideoVocab, type VocabItem } from "@/lib/vocab";
import { buildQuizQuestions } from "@/lib/exercises/vocab-quiz-logic";
import type {
  FlipCardsConfig,
  VocabQuizConfig,
  CalloutConfig,
  PhoneticsConfig,
  MatchingConfig,
  DragDropConfig,
  ImageMatchConfig,
} from "@/lib/exercises/types";
import { DEFAULT_SCENE_BLOCK_ORDER, type SceneBlockType } from "@/lib/scene-block-order";
import { toEmbedUrl } from "@/lib/video";
import { VideoFrame } from "@/components/video-frame";
import { VideoPlayer, type VideoSubtitleTrack } from "@/components/video-player";
import { ScriptSection } from "./script-section";
import { VocabSection } from "./vocab-section";
import type { ExerciseTask } from "../../exercise-block";
import { TaskGroupBlock, type TaskGroupData } from "../../task-group-block";
import { H1_TO_CONTENT, H2_TO_CONTENT, EXERCISE_LIST_GAP, EXERCISE_STACK } from "@/lib/spacing";
import { STUDENT_PAGE_TITLE, STUDENT_SECTION_HEADING } from "@/lib/typography-styles";
import { taskHasRenderableContent, contentBlockHasRenderableContent } from "@/lib/exercises/task-visibility";
import {
  SceneContentBlock,
  SceneContentBlockContent,
  type SceneContentBlockData,
  type SceneContentLink,
} from "../../scene-content-block";
import { SceneBackground } from "@/components/scene-background";
import { SectionHeaderBar } from "@/components/scene-header-bar";
import { validateR2ImageUrl, validateHexColor } from "@/lib/validate-r2-url";
import { sceneBackgroundMode } from "@/lib/scene-background-mode";

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
  description?: string;
  icon?: string;
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
// ERROR_REVIEW_EXCLUDED_TASK_TYPES — перенесено в error-review.ts (reviewMode()
// має знати про винятки, не лише фільтр рендеру тут).

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

  const [{ data: scene }, { data: product }] = await Promise.all([
    supabase
      .from("scenes")
      .select("id, title, video_url, video_provider, subtitles, dialogue")
      .eq("id", sceneId)
      .eq("product_id", productId)
      .single(),
    // Фон — курсовий (один на products, не на scenes, SceneBackground нижче)
    // — окремий запит від scene вище (різні таблиці), той самий productId.
    supabase
      .from("products")
      .select("background_desktop_url, background_mobile_url, background_fill_color")
      .eq("id", productId)
      .single(),
  ]);

  if (!scene) {
    notFound();
  }

  // Повторна валідація — product щойно з БД, ніколи не довіряємо напряму
  // (ані тут, ані в SceneBackground нижче, яка валідує ще раз сама по
  // собі, читай коментар там): значення могло потрапити в рядок повз цю ж
  // перевірку в updateProductBackground (напр. пряме редагування БД).
  // Рахується до scriptNode/vocabNode нижче — onBackground (панель під
  // текстом секцій) залежить від bgMode.
  const bgDesktopUrl = validateR2ImageUrl(product?.background_desktop_url ?? null);
  const bgMobileUrl = validateR2ImageUrl(product?.background_mobile_url ?? null);
  const bgFillColor = validateHexColor(product?.background_fill_color ?? null);
  const bgMode = sceneBackgroundMode(bgFillColor, Boolean(bgDesktopUrl || bgMobileUrl));
  const onBackground = bgMode !== null;

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
        "id, content_type, content_text, media_url, media_provider, subtitles, points_mode, flat_points, order_index"
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
      .select("id, content_type, content_text, media_url, media_provider, subtitles, dialogue")
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
            "id, scene_content_block_id, content_type, content_text, media_url, media_provider, subtitles, points_mode, flat_points"
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

  // RPC get_mistake_correction_state — для пілотних items-типів і для
  // whole-типів з реальною практикою (частина 7, хвиля 3, isWholePracticeTaskType)
  // серед sceneMistakes: інші whole-типи (open_answer — тимчасовий фолбек
  // reviewMode, і будь-який майбутній невідомий тип) цій моделі не
  // потребують (mode!=="items" і не в WHOLE_MODE_TASK_TYPES).
  const pilotTaskIds = sceneMistakes
    .map((m) => m.task_id)
    .filter((id) => {
      const t = taskTypeById.get(id) ?? "";
      return isPracticeItemsTaskType(t) || isWholePracticeTaskType(t);
    });
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
          config: (taskConfigById.get(m.task_id) ?? null) as Record<string, unknown> | null,
        }),
      ] as const;
    })
  );
  // Картки блоку "Робота над помилками" (ErrorReviewBlock, клієнтський
  // компонент нижче) — для items-типів передаємо санітизований config
  // (sanitizeConfigForStudent, той самий, що вже рендерить вправу вище на
  // сторінці), щоб inline-практика могла показати ТОЙ САМИЙ студентський
  // компонент (MultipleChoiceExercise/FillBlankExercise) з onlyItemIds; для
  // whole-типів з реальною практикою (частина 7, хвиля 3) — ТОЙ САМИЙ
  // sanitizeConfigForStudent (перемішаний/порожній початковий стан, як при
  // звичайному проходженні — те, що задача явно вимагає), без summary
  // (summarizeMistake показав би готову правильну відповідь ДО практики —
  // спойлер, якого items-типи й так уникають); для решти whole-типів
  // (open_answer — тимчасовий фолбек reviewMode, майбутні невідомі типи) —
  // старий шлях без змін: короткий опис з summarizeMistake, без config.
  const errorReviewEntries = sceneMistakes.map((m) => {
    const review = errorReviewByTask.get(m.task_id)!;
    const taskType = taskTypeById.get(m.task_id) ?? "";
    const isWholePractice = review.mode === "whole" && isWholePracticeTaskType(taskType);
    return {
      taskId: m.task_id,
      title: taskTitleById.get(m.task_id) ?? "",
      taskType,
      mode: review.mode,
      status: review.status,
      total: review.total,
      remainingItemIds: review.remainingItemIds,
      failedAttempts: review.failedAttempts,
      summary: review.mode === "items" || isWholePractice ? null : summarizeMistake(m.ai_feedback),
      // matching — окремий шлях (sanitizeMatchingForPractice): на відміну
      // від інших items-типів, де increment-компонент сам фільтрує повний
      // публічний config за onlyItemIds (елементи самодостатні, без
      // прихованого зв'язку), у matching right-варіанти не прив'язані до
      // left публічно (секрет) — лише сервер, маючи повний (несанітизований)
      // config, може звузити left/right саме до пар review.remainingItemIds.
      config:
        review.mode === "items"
          ? taskType === "matching"
            ? sanitizeMatchingForPractice(
                (taskConfigById.get(m.task_id) ?? {}) as unknown as MatchingConfig,
                review.remainingItemIds
              )
            : taskType === "drag_drop"
              ? sanitizeDragDropForPractice(
                  (taskConfigById.get(m.task_id) ?? {}) as unknown as DragDropConfig,
                  review.remainingItemIds
                )
              : taskType === "image_match"
                ? sanitizeImageMatchForPractice(
                    (taskConfigById.get(m.task_id) ?? {}) as unknown as ImageMatchConfig,
                    review.remainingItemIds
                  )
                : sanitizeConfigForStudent(taskType as GradableTaskType, taskConfigById.get(m.task_id) ?? {})
          : isWholePractice
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

  const videoBody =
    scene.video_provider === "file" ? (
      <VideoPlayer
        src={scene.video_url}
        subtitles={(scene.subtitles as VideoSubtitleTrack[] | null) ?? undefined}
        vocab={collectVideoVocab(dialogue)}
        title={scene.title}
      />
    ) : (
      <VideoFrame
        src={toEmbedUrl(scene.video_url, scene.video_provider)}
        title={scene.title}
        provider={scene.video_provider ?? "youtube"}
      />
    );

  const videoNode = scene.video_url && (
    <section>
      {/* Бар + панель окремими сиблінгами з 14px відступом (.scene-bar
          margin-bottom, globals.css) — та сама "скляна" мова, що й усюди
          інде. glass-panel--video — прозора/без падінгу (попередній
          вигляд картки), з overflow:hidden під округлені кути; жодних
          transform/filter/backdrop-filter/will-change/contain ні на барі,
          ні на панелі, щоб не стати containing-block для position:fixed
          iOS pseudo-fullscreen/Fullscreen API wrapper усередині
          VideoPlayer/VideoFrame. */}
      <div className="flex flex-col gap-[14px]">
        <SectionHeaderBar title="Відео" icon={resolveBlockIcon("video")} />
        <div className="glass-block-panel glass-panel--video">{videoBody}</div>
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
      {onBackground ? (
        <SectionHeaderBar title="Практика" icon={resolveBlockIcon("practice")} />
      ) : (
        <h2 className={`student-on-bg ${STUDENT_SECTION_HEADING}`}>Практика</h2>
      )}
      {/* link-card-grid — 3/2/1 колонки (desktop/tablet/phone), globals.css.
          mt-3 (не H2_TO_CONTENT/mt-4) під баром — STANDALONE-варіант
          скляного бару (globals.css, SectionHeaderBar) свідомо на 12px, а
          не 16px. */}
      <div className={`${onBackground ? "mt-3" : H2_TO_CONTENT} link-card-grid`}>
        {linkList.map((link) => {
          const meta = resolveSceneLinkMeta(link.platform);
          return (
            <LinkCard
              key={link.id}
              href={link.url}
              icon={meta.icon}
              title={link.label ?? meta.label}
              subtitle={meta.label}
              variant={meta.featured ? "featured" : "default"}
            />
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
      {onBackground ? (
        <SectionHeaderBar title="Завдання" icon={resolveBlockIcon("tasks")} />
      ) : (
        <h2 className={`student-on-bg ${STUDENT_SECTION_HEADING}`}>Завдання</h2>
      )}
      <ul className={`${onBackground ? "mt-3" : H2_TO_CONTENT} flex flex-col ${EXERCISE_LIST_GAP}`}>
        {sceneRows.map((row) => {
          if (row.kind === "group") {
            return (
              <li key={`group-${row.group.id}`} id={`group-${row.group.id}`} className="scroll-mt-4">
                <TaskGroupBlock group={row.group} tasks={row.members} sceneDialogue={dialogue} />
              </li>
            );
          }

          const task = row.task;
          const config = (task.config ?? {}) as LinkEmbedConfig;
          if (!taskHasRenderableContent(task)) return null;

          // callout/link/game мають власне самодостатнє оформлення
          // (кольоровий блок CalloutExercise, темно-скляна LinkCard) — друга
          // картка-обгортка навколо них дублювала б рамку/тінь. Усі інші
          // типи (включно з embed — голий iframe без власного оформлення)
          // ідуть крізь GlassBlock: заголовок задачі в барі (замість
          // колишнього інлайн <p>), тіло — токени --glass-* (globals.css)
          // замість EXERCISE_BLOCK_CLASS.
          const skipGlass = task.type === "callout" || task.type === "link" || task.type === "game";
          const barText = skipGlass ? undefined : getTaskBarText(task);

          return (
            <li key={task.id} id={`task-${task.id}`} className="scroll-mt-4">
              {skipGlass ? (
                <>
                  {task.type === "callout" && (
                    <ExerciseErrorBoundary>
                      <CalloutExercise config={task.config as unknown as CalloutConfig} />
                    </ExerciseErrorBoundary>
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
                </>
              ) : (
                <>
                  {/* image_match: task.image_url — ОПЦІЙНА обкладинка
                      блоку, не частина спільного заголовка. Рендериться
                      ПОЗА .glass-block-panel (сестра GlassBlock, не
                      дитина), бо escape-трюк плашки нижче
                      (.task-header-strip-anchor) вимагає бути буквально
                      ПЕРШИМ елементом усередині панелі — якби картинка
                      лишалась усередині EXERCISE_STACK ПЕРЕД BlockTabs
                      (як для решти типів через TaskMedia нижче), анкер
                      рахував би відступ від точки одразу під картинкою,
                      а не від верхнього краю панелі, і плашка "Images et
                      mots" наїжджала б на низ картинки. Аудіо (якщо є) —
                      і далі всередині панелі через TaskMedia, лише
                      imageUrl там занулено, щоб не рендерити картинку
                      двічі. */}
                  {task.type === "image_match" && task.image_url && (
                    <ImageOrPlaceholder
                      src={task.image_url}
                      alt=""
                      className="mb-4 h-24 w-full rounded-xl object-cover"
                    />
                  )}
                  <GlassBlock>
                  <div className={EXERCISE_STACK}>
                    {/* Плашка/смужка (мокап "варіант 4") — ОБОВ'ЯЗКОВО
                        перший елемент тут (escape-трюк негативних margin,
                        .task-header-strip-anchor, globals.css, рахує
                        відступ відносно верхнього краю .glass-block-panel).
                        Лише для типів, що НЕ рендерять власну BlockTabs
                        усередині свого компонента: isExerciseType —
                        gradable-типи через ExerciseCard нижче, кожен сам
                        малює BlockTabs першим елементом власного дерева;
                        flip_cards — те саме, власні сторінки-вкладки
                        (FlipCardsExercise, flip-cards.tsx), бо лише сам
                        компонент знає totalPages/page/handlePageChange. */}
                    {!isExerciseType(task.type) && task.type !== "flip_cards" && (
                      <BlockTabs plaqueText={barText} />
                    )}

                    <TaskMedia
                      imageUrl={task.type === "image_match" ? null : task.image_url}
                      audioUrl={task.audio_url}
                    />

                    {task.type === "vocab_quiz" && (
                      <ExerciseErrorBoundary>
                        {(() => {
                          const quizVocab = vocabForQuiz(task.config as VocabQuizConfig | null);
                          return (
                            <VocabQuizExercise
                              vocab={quizVocab}
                              initialQuestions={buildQuizQuestions(quizVocab)}
                            />
                          );
                        })()}
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
                          plaqueText={barText}
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
                        plaqueText={barText}
                        pointsVisible={task.points_visible}
                      />
                    )}

                    {task.type === "embed" && config.url && (
                      <EmbedFrame url={config.url} height={config.height ?? 480} />
                    )}
                  </div>
                </GlassBlock>
                </>
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
    <div className="student-bg-wrapper" data-scene-bg={bgMode ?? undefined}>
      <SceneBackground desktopUrl={bgDesktopUrl} mobileUrl={bgMobileUrl} fillColor={bgFillColor} />
      <main className="student-bg-content mx-auto w-full max-w-3xl p-6">
        <Link href={`/courses/${productId}`} className="student-on-bg text-sm underline">
          ← До курсу
        </Link>
        {isPreviewing && <PreviewBanner productId={productId} />}
        <h1 className={`student-on-bg mt-2 ${STUDENT_PAGE_TITLE}`}>{scene.title}</h1>

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
                  <section key={`content-${row.ref_id}`}>
                    <TaskGroupBlock
                      group={attachedGroup}
                      tasks={attachedMembers}
                      sceneDialogue={dialogue}
                      extraSharedContent={
                        blockHasOwnContent ? (
                          <SceneContentBlockContent block={block} panelForText sceneDialogue={dialogue} />
                        ) : null
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
                  <SceneContentBlock block={block} sceneDialogue={dialogue} />
                </section>
              );
            }
            return <Fragment key={`${row.block_type}-${i}`}>{nodeByBlockType[row.block_type]}</Fragment>;
          })}
        </div>
      </main>
    </div>
  );
}
