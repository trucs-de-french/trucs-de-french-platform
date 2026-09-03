import { Fragment } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { toEmbedUrl } from "@/lib/video";
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
import { ScriptSection } from "./script-section";

type DialogueEntry = {
  speaker: string;
  text: string;
  vocab: VocabItem[];
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
  games: { embed_url: string | null; provider: string } | null;
};

// Для цих типів студенту потрібно бачити, що саме це за посилання/гра —
// решта типів вправ показують власну інструкцію замість технічної назви.
const TYPES_WITH_BADGE = ["link", "game", "embed"];

type MistakeRow = {
  id: string;
  task_id: string;
  ai_feedback: unknown;
  created_at: string;
  tasks: { title: string } | null;
};

type SceneBlockType = "video" | "script" | "link" | "task";
type SceneBlockRow = { block_type: SceneBlockType };

// Фолбек на випадок, якщо scene_blocks порожній для сцени (напр. міграцію
// ще не застосовано) — відтворює порядок, який був жорстко закодований до
// впровадження scene_blocks.
const DEFAULT_BLOCK_ORDER: SceneBlockType[] = ["video", "script", "link", "task"];

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

  const [
    { data: links },
    { data: tasks, error: tasksError },
    { data: blocks, error: blocksError },
  ] = await Promise.all([
    supabase
      .from("scene_links")
      .select("id, platform, url, label")
      .eq("scene_id", sceneId)
      .order("order_index"),
    supabase
      .from("tasks")
      .select("id, type, title, config, image_url, audio_url, games(embed_url, provider)")
      .eq("scene_id", sceneId)
      .order("order_index")
      .returns<TaskRow[]>(),
    supabase
      .from("scene_blocks")
      .select("block_type")
      .eq("scene_id", sceneId)
      .order("position")
      .returns<SceneBlockRow[]>(),
  ]);

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

  const blockOrder =
    blocks && blocks.length > 0 ? blocks.map((b) => b.block_type) : DEFAULT_BLOCK_ORDER;

  const dialogue = (scene.dialogue ?? []) as DialogueEntry[];
  // Для блоку "Словник" у "Практиці" — лише лексика ЦІЄЇ сцени (на відміну
  // від vocabForQuiz нижче, який може об'єднувати кілька сцен курсу).
  const sceneVocab = collectSceneVocab(dialogue);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const taskIds = (tasks ?? []).map((t) => t.id);
  const { data: rawMistakes } =
    user && taskIds.length > 0
      ? await supabase
          .from("mistakes")
          .select("id, task_id, ai_feedback, created_at, tasks(title)")
          .eq("user_id", user.id)
          .in("task_id", taskIds)
          .order("created_at", { ascending: false })
          .returns<MistakeRow[]>()
      : { data: null };

  // одна найсвіжіша помилка на завдання — не показуємо всю історію спроб
  const latestMistakeByTask = new Map<string, MistakeRow>();
  for (const m of rawMistakes ?? []) {
    if (!latestMistakeByTask.has(m.task_id)) {
      latestMistakeByTask.set(m.task_id, m);
    }
  }
  const sceneMistakes = [...latestMistakeByTask.values()];

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
    <section className="mt-6">
      <h2 className="text-lg font-medium">Відео</h2>
      <div className="mt-2 aspect-video w-full overflow-hidden rounded-md bg-black">
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
    <section className="mt-6">
      <h2 className="text-lg font-medium">Скрипт</h2>
      <div className="mt-2">
        <ScriptSection dialogue={dialogue} />
      </div>
    </section>
  );

  const linkList = links ?? [];
  const hasLinks = linkList.length > 0;
  const hasVocab = sceneVocab.length > 0;

  const linksNode = (hasLinks || hasVocab) && (
    <section className="mt-6">
      <h2 className="text-lg font-medium">Практика</h2>

      {hasVocab && (
        <div className="mt-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium">Словник</h3>
            <a
              href={`/api/scenes/${sceneId}/vocab-pdf`}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              Завантажити PDF
            </a>
          </div>
          <table className="mt-2 w-full max-w-md border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-neutral-500 dark:text-neutral-400">
                <th className="py-1 pr-2 font-medium">Французька</th>
                <th className="py-1 font-medium">Переклад</th>
              </tr>
            </thead>
            <tbody>
              {sceneVocab.map((v) => (
                <tr key={v.word} className="border-b last:border-0">
                  <td className="py-1 pr-2">{v.word}</td>
                  <td className="py-1">{v.translation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasLinks && (
        <div className="mt-3 flex flex-wrap gap-2">
          {linkList.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              {link.label ?? link.platform}
            </a>
          ))}
        </div>
      )}
    </section>
  );

  const tasksNode = tasks && tasks.length > 0 && (
    <section className="mt-6">
      <h2 className="text-lg font-medium">Завдання</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {tasks.map((task) => {
          const config = (task.config ?? {}) as LinkEmbedConfig;

          return (
            <li
              key={task.id}
              id={`task-${task.id}`}
              className={`scroll-mt-4 ${task.type === "callout" ? "" : "rounded-md border p-3"}`}
            >
              {TYPES_WITH_BADGE.includes(task.type) && (
                <>
                  <span className="text-xs uppercase text-neutral-500 dark:text-neutral-400">
                    {task.type}
                  </span>
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
                  />
                </div>
              )}

              {task.type === "game" && task.games?.embed_url && (
                <a
                  href={task.games.embed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-sm underline"
                >
                  Відкрити гру ({task.games.provider})
                </a>
              )}

              {task.type === "link" && config.url && config.download && (
                <a
                  href={config.url}
                  download
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  ⬇ {config.label ?? "Завантажити файл"}
                </a>
              )}

              {task.type === "link" && config.url && !config.download && (
                <a
                  href={config.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  <PlatformIcon platform={resolvePlatform(config.url, config.platform)} />
                  {config.label ?? "Відкрити"}
                </a>
              )}

              {task.type === "embed" && config.url && (
                <div
                  className="mt-2 overflow-hidden rounded-md border"
                  style={{ height: config.height ?? 480 }}
                >
                  <iframe src={config.url} className="h-full w-full" allowFullScreen />
                </div>
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
  };

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">{scene.title}</h1>

      {blockOrder.map((type) => (
        <Fragment key={type}>{nodeByBlockType[type]}</Fragment>
      ))}
    </main>
  );
}
