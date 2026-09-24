import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPreviewCourseId, isVisibleToEnrolledStudent } from "@/lib/course-preview";
import { PreviewBanner, PreviewBlocked } from "@/components/preview-banner";
import { resolvePlatform } from "@/lib/platform";
import { PlatformIcon } from "@/components/platform-icon";
import { sanitizeConfigForStudent } from "@/lib/exercises/sanitize";
import { summarizeMistake } from "@/lib/exercises/summarize-mistake";
import { ExerciseCard, isExerciseType } from "@/components/exercises/exercise-card";
import { VocabQuizExercise } from "@/components/exercises/vocab-quiz";
import { FlipCardsExercise } from "@/components/exercises/flip-cards";
import { EssayCheckExercise } from "@/components/exercises/essay-check";
import { CalloutExercise } from "@/components/exercises/callout";
import { PhoneticsExercise } from "@/components/exercises/phonetics";
import { TaskMedia } from "@/components/task-media";
import { collectSceneVocab, type VocabItem } from "@/lib/vocab";
import { buildQuizQuestions } from "@/lib/exercises/vocab-quiz-logic";
import type {
  FlipCardsConfig,
  VocabQuizConfig,
  CalloutConfig,
  PhoneticsConfig,
} from "@/lib/exercises/types";
import { DEFAULT_INSTRUCTIONS } from "@/lib/exercises/default-instructions";
import { toEmbedUrl } from "@/lib/video";
import { ScriptSection } from "./script-section";
import { VocabSection } from "./vocab-section";
import type { ExerciseTask } from "../../exercise-block";
import { TaskGroupBlock, type TaskGroupData } from "../../task-group-block";
import { EXERCISE_BLOCK_CLASS } from "@/components/task-card-style";
import { STUDENT_LINK_BUTTON } from "@/lib/button-styles";
import { H1_TO_CONTENT, H2_TO_CONTENT, EXERCISE_LIST_GAP } from "@/lib/spacing";
import { STUDENT_PAGE_TITLE, STUDENT_SECTION_HEADING } from "@/lib/typography-styles";
import {
  SceneContentBlock,
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

// Для цих типів студенту потрібно бачити заголовок замість власної
// інструкції (як в решти типів вправ).
const TYPES_WITH_TITLE = ["link", "game", "embed"];
// Технічна назва типу (напр. "embed") — лише для link/game, де вона реально
// підказує студенту, із чим він має справу (зовнішнє посилання/гра). Для
// embed прибрано: студент бачить заголовок вправи ("Jeu" тощо) і сам
// вміст, службова назва типу йому не потрібна. Той самий підхід, що вже
// в exercise-block.tsx.
const TYPES_WITH_TYPE_BADGE = ["link", "game"];

type MistakeRow = {
  id: string;
  task_id: string;
  ai_feedback: unknown;
  created_at: string;
  tasks: { title: string } | null;
};

type SceneBlockType = "video" | "script" | "link" | "task" | "vocab";
type SceneBlockRow = { block_type: SceneBlockType | "content"; ref_id: string | null };

// Фолбек на випадок, якщо scene_blocks порожній для сцени (напр. міграцію
// ще не застосовано) — відтворює порядок, який був жорстко закодований до
// впровадження scene_blocks.
const DEFAULT_BLOCK_ORDER: SceneBlockType[] = ["video", "script", "vocab", "link", "task"];

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
    // фолбеком DEFAULT_BLOCK_ORDER, і виглядало так, ніби порядок груп
    // працює, хоча реальний запит увесь час падав.
    console.error(
      `Не вдалося завантажити scene_blocks для сцени ${sceneId}:`,
      blocksError.message
    );
  }

  const orderedBlockRows: SceneBlockRow[] =
    blocks && blocks.length > 0
      ? blocks
      : DEFAULT_BLOCK_ORDER.map((type) => ({ block_type: type, ref_id: null }));

  const contentBlocksById = new Map((sceneContentBlocks ?? []).map((b) => [b.id, b]));

  const dialogue = (scene.dialogue ?? []) as DialogueEntry[];
  // Для блоку "Словник" у "Практиці" — лише лексика ЦІЄЇ сцени (на відміну
  // від vocabForQuiz нижче, який може об'єднувати кілька сцен курсу).
  const sceneVocab = collectSceneVocab(dialogue);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const taskIds = (tasks ?? []).map((t) => t.id);
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
            .select("id, task_id, ai_feedback, created_at, tasks(title)")
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
  // Якщо остання спроба на це завдання (за progress, не за mistakes) уже
  // повністю правильна — не показуємо давню помилку, ніби вона й досі
  // актуальна.
  const sceneMistakes = [...latestMistakeByTask.values()].filter(
    (m) => latestScoreByTask.get(m.task_id) !== 100
  );

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
      <div className={`${H2_TO_CONTENT} aspect-video w-full overflow-hidden rounded-md bg-black dark:border dark:border-neutral-700`}>
        <iframe
          src={toEmbedUrl(scene.video_url, scene.video_provider)}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
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
      <div className={`${H2_TO_CONTENT} flex flex-wrap gap-2`}>
        {linkList.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={STUDENT_LINK_BUTTON}
          >
            {link.label ?? link.platform}
          </a>
        ))}
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

          return (
            <li
              key={task.id}
              id={`task-${task.id}`}
              className={`scroll-mt-4 ${task.type === "callout" ? "" : EXERCISE_BLOCK_CLASS}`}
            >
              {TYPES_WITH_TITLE.includes(task.type) && (
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

              {task.type === "vocab_quiz" && (
                <div className="mt-2">
                  <p className="mb-2 font-medium">{DEFAULT_INSTRUCTIONS.vocab_quiz}</p>
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
              )}

              {task.type === "error_correction" && (
                <div className="mt-2 flex flex-col gap-2">
                  {sceneMistakes.length === 0 ? (
                    <p className="text-sm text-neutral-500 dark:text-neutral-400">
                      Поки що без помилок — так тримати!
                    </p>
                  ) : (
                    <>
                      <p className="font-medium">{DEFAULT_INSTRUCTIONS.error_correction}</p>
                      {sceneMistakes.map((m) => (
                        <a
                          key={m.id}
                          href={`#task-${m.task_id}`}
                          className="block rounded-md border p-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
                        >
                          <span className="font-medium">{m.tasks?.title}</span>
                          <span className="block text-neutral-500 dark:text-neutral-400">
                            {summarizeMistake(m.ai_feedback)}
                          </span>
                        </a>
                      ))}
                    </>
                  )}
                </div>
              )}

              {task.type === "flip_cards" && (
                <div className="mt-2">
                  <FlipCardsExercise
                    config={(task.config ?? { cards: [] }) as unknown as FlipCardsConfig}
                  />
                </div>
              )}

              {task.type === "essay_check" && (
                <div className="mt-2">
                  <EssayCheckExercise
                    taskId={task.id}
                    prompt={(task.config as { prompt?: string } | null)?.prompt}
                    config={(task.config ?? {}) as Record<string, unknown>}
                  />
                </div>
              )}

              {task.type === "callout" && (
                <div className="mt-2">
                  <CalloutExercise config={task.config as unknown as CalloutConfig} />
                </div>
              )}

              {task.type === "phonetics" && (
                <div className="mt-2">
                  <PhoneticsExercise
                    config={(task.config ?? { items: [] }) as unknown as PhoneticsConfig}
                  />
                </div>
              )}

              {isExerciseType(task.type) && (
                <div className="mt-2">
                  <ExerciseCard
                    taskId={task.id}
                    type={task.type}
                    config={sanitizeConfigForStudent(task.type, task.config ?? {})}
                    pointsVisible={task.points_visible}
                  />
                </div>
              )}

              {task.type === "game" && task.games?.embed_url && (
                <a
                  href={task.games.embed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-2 inline-flex items-center gap-2 ${STUDENT_LINK_BUTTON}`}
                >
                  Відкрити гру ({task.games.provider})
                </a>
              )}

              {task.type === "link" && config.url && config.download && (
                <a
                  href={config.url}
                  download
                  rel="noopener noreferrer"
                  className={`mt-2 inline-flex items-center gap-2 ${STUDENT_LINK_BUTTON}`}
                >
                  ⬇ {config.label ?? "Завантажити файл"}
                </a>
              )}

              {task.type === "link" && config.url && !config.download && (
                <a
                  href={config.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-2 inline-flex items-center gap-2 ${STUDENT_LINK_BUTTON}`}
                >
                  <PlatformIcon platform={resolvePlatform(config.url, config.platform)} />
                  {config.label ?? "Відкрити"}
                </a>
              )}

              {task.type === "embed" && config.url && (
                <>
                  <div
                    className="mt-2 overflow-hidden rounded-md border border-gray-200 dark:border-neutral-700"
                    style={{ height: config.height ?? 480 }}
                  >
                    <iframe src={config.url} className="h-full w-full" allowFullScreen />
                  </div>
                  {/* Завжди видимий резервний варіант — не опційний, без
                      перемикача вимкнення (напр. якщо сторонній сервіс
                      блокує вбудовування в iframe, як уже траплялось із
                      Wordwall). Той самий фрагмент, що в exercise-block.tsx. */}
                  <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                    Якщо гра чи відео не відкривається (браузер міг заблокувати сторонній вміст),{" "}
                    <a
                      href={config.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      перейдіть за посиланням
                    </a>
                    .
                  </p>
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
            return (
              <section key={`content-${row.ref_id}`}>
                <SceneContentBlock block={block} />
                {/* Той самий принцип, що вже в "Завданнях" — блок без жодної
                    задачі-члена не рендеримо взагалі. */}
                {attachedGroup && attachedMembers.length > 0 && (
                  <div className="mt-3">
                    <TaskGroupBlock group={attachedGroup} tasks={attachedMembers} />
                  </div>
                )}
              </section>
            );
          }
          return <Fragment key={`${row.block_type}-${i}`}>{nodeByBlockType[row.block_type]}</Fragment>;
        })}
      </div>
    </main>
  );
}
