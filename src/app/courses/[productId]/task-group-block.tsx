"use client";

import { useState, useMemo } from "react";
import { toEmbedUrl, isGdriveUrl } from "@/lib/video";
import { AudioPlayer } from "@/components/audio-player";
import { GdriveAudioPlayer } from "@/components/gdrive-audio-player";
import { isExerciseType } from "@/components/exercises/exercise-card";
import { pluralizePoints } from "@/lib/pluralize-points";
import type { GradeResult } from "@/lib/exercises/types";
import { ExerciseBlock, type ExerciseTask } from "./exercise-block";
import { EXERCISE_BLOCK_CLASS, SHARED_CONTENT_PANEL } from "@/components/task-card-style";
import { EmbedWithFallback } from "@/components/embed-with-fallback";
import { EXERCISE_STACK } from "@/lib/spacing";
import type { ReactNode } from "react";
import { EXERCISE_BODY } from "@/lib/typography-styles";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { isBlankHtml } from "@/lib/html-text";
import { contentBlockHasRenderableContent, taskHasRenderableContent } from "@/lib/exercises/task-visibility";

export type TaskGroupData = {
  id: string;
  content_type: string;
  content_text: string | null;
  media_url: string | null;
  media_provider: string | null;
  points_mode: string;
  // Лише для points_mode === "flat" — один загальний бал за блок, зароблений
  // пропорційно середньому score% усіх задач блоку (узгоджене з учителем
  // рішення, Крок 5). Може бути null для блоків у режимі "сума".
  flat_points: number | null;
};

// "use client" — потрібен локальний стан для живого підсумку балів
// (results, знизу): кожна задача-член звітує свій GradeResult через
// onResult, TaskGroupBlock підсумовує. group/tasks — прості серіалізовані
// пропи від сервера (жодних функцій), тож перехід у клієнтський компонент
// не порушує RSC-межу.
//
// Рендер одного блоку — спільний контент (текст/аудіо/відео/embed) зверху,
// потім усі задачі-члени як ОДНЕ ціле, БЕЗ окремих рамок навколо кожної
// (саме та вимога, яка відрізняє блок від звичайного списку задач), одна
// спільна рамка на весь <section>. Кожна задача-член рендериться тим самим
// ExerciseBlock, що й будь-яка звичайна задача (media, essay_check,
// callout, ExerciseCard за типом, game/link/embed) — border навколо
// кожної задачі й раніше додавав НЕ ExerciseBlock, а сторінка-викликач
// (<li className="rounded-md border p-3">), тож для членів блоку просто
// не додаємо цей border узагалі.
//
// title блоку — свідомо НЕ рендериться (адмінська мітка, "студент не
// бачить", task-group-fields.tsx) — сам контент і є тим, що ідентифікує
// блок студенту.
export function TaskGroupBlock({
  group,
  tasks,
  bare = false,
  extraSharedContent = null,
}: {
  group: TaskGroupData;
  tasks: ExerciseTask[];
  // true — коли групу прикріплено до scene_content_block і сторінка сцени
  // сама малює ОДНУ спільну <section className={EXERCISE_BLOCK_CLASS}>
  // навколо контенту блоку + цього компонента: тоді TaskGroupBlock не додає
  // власної секції/рамки, лише свій вміст (спільний контент групи, якщо є,
  // список задач, підсумок балів) — інакше картка розпадалась би на дві
  // (контент-блок окремо, група окремо), саме той баг, що виправляє ця
  // задача.
  bare?: boolean;
  // Вміст САМОГО scene_content_block (SceneContentBlockContent з
  // panelForText) — рендериться ПЕРЕД власним контентом групи, у межах
  // тієї самої секції, лише коли bare (прикріплена група).
  extraSharedContent?: ReactNode;
}) {
  const [results, setResults] = useState<Record<string, GradeResult>>({});

  // Один стабільний onResult-колбек НА КОЖЕН task.id, мемоізований через
  // useMemo (не нова inline-стрілка в .map() нижче на кожен рендер, і не
  // мутація ref під час рендеру — react-hooks/refs забороняє це саме тому,
  // що рендер, відкинутий React без коміту, лишив би застарілий кеш).
  // Без стабільного колбеку useEffect([result, onResult]) у кожній
  // gradable-вправі (fill-blank.tsx тощо) перезапускався б на кожен рендер
  // TaskGroupBlock (реф onResult змінювався б), кожен виклик onResult робив
  // би НОВИЙ об'єкт results (spread завжди створює новий референс, навіть
  // коли значення під task.id не змінилось) → React не бейлаутиться за
  // референсом → ре-рендер TaskGroupBlock → НОВІ inline-стрілки для ВСІХ
  // задач блоку → їхні ефекти знову спрацьовують → знову setResults →
  // самопідтримний цикл. Найпомітніше на drag_drop (useTilePlacement
  // перемальовує розкладку плиток на кожен рендер), хоча цикл однаково
  // зачіпав би будь-який гейдований тип у блоці.
  //
  // Залежність — лише tasks (стабільний пропс від сервера для одного
  // монтування компонента, не міняється через внутрішні setResults) —
  // setResults навмисно не в масиві залежностей: сеттер useState
  // гарантовано стабільний між рендерами.
  const onResultCallbacks = useMemo(() => {
    const map: Record<string, (result: GradeResult) => void> = {};
    for (const task of tasks) {
      map[task.id] = (result: GradeResult) => {
        setResults((prev) => ({ ...prev, [task.id]: result }));
      };
    }
    return map;
  }, [tasks]);

  // Та сама перевірка, що й для порожніх обгорток-задач/content-блоків
  // (task-visibility.ts) — вирішує, чи є взагалі що показати (guard нижче).
  const visibleTasks = tasks.filter(taskHasRenderableContent);
  const hasOwnSharedContent = contentBlockHasRenderableContent(group);
  const hasSharedContent = hasOwnSharedContent || !!extraSharedContent;

  // Ні спільного контенту (ні свого, ні переданого зовні), ні жодної
  // задачі, що реально щось покаже — показувати голу рамку немає сенсу.
  // У bare-режимі викликач (сторінка сцени) і так уже перевірив те саме
  // перед викликом — цей guard тут лише для звичайного (не bare) виклику.
  // Хуки (useState/useMemo) вище вже викликані безумовно — це не порушує
  // Rules of Hooks.
  if (!bare && !hasSharedContent && visibleTasks.length === 0) return null;

  // Підсумок рахуємо лише коли ВІДПОВІЛИ на всі задачі блоку, що взагалі
  // мають бали (essay_check/callout/embed/link/game серед tasks ніколи не
  // покличуть onResult — не чекаємо на них) — інакше "з Y балів" зростав
  // би поступово в міру відповідей, і студент бачив би рухому ціль замість
  // фіксованого підсумку.
  const gradableIds = tasks.filter((t) => isExerciseType(t.type)).map((t) => t.id);
  const allAnswered = gradableIds.length > 0 && gradableIds.every((id) => id in results);

  const resultValues = Object.values(results);
  const pointsEarned = resultValues.reduce((sum, r) => sum + (r.pointsEarned ?? 0), 0);
  const pointsPossible = resultValues.reduce((sum, r) => sum + (r.pointsPossible ?? 0), 0);

  // Режим "фіксовано": score є в КОЖНОМУ GradeResult завжди (на відміну від
  // pointsEarned/pointsPossible, які лише для types із підтримкою балів),
  // тож середнє score% рахується однаково для будь-якого gradable-типу
  // всередині блоку, незалежно від того, чи він узагалі підтримує бали.
  const averageScore =
    resultValues.length > 0
      ? resultValues.reduce((sum, r) => sum + r.score, 0) / resultValues.length
      : 0;
  const flatPoints = group.flat_points ?? 0;
  const flatEarned = Math.round(((flatPoints * averageScore) / 100) * 100) / 100;

  // Підкладка (SHARED_CONTENT_PANEL) — лише навколо ТЕКСТОВОГО контенту:
  // аудіо/відео/embed мають власний вигляд (плеєр/iframe із власним фоном),
  // смуга+сірий фон навколо них були б зайвим подвійним обрамленням. Якщо
  // прикріплений content-блок (extraSharedContent) теж текстовий — це вже
  // ЙОГО власна підкладка (SceneContentBlockContent, panelForText),
  // рендерена окремо ПЕРЕД цим — дві незалежні підкладки одна під одною,
  // не одна об'єднана, якщо в обох текст.
  const ownSharedContent = (
    <>
      {group.content_type === "text" && !isBlankHtml(group.content_text) && (
        <div className={SHARED_CONTENT_PANEL}>
          <div
            className={`rich-text ${EXERCISE_BODY}`}
            dangerouslySetInnerHTML={{ __html: sanitizeInstructionsHtml(group.content_text ?? "") }}
          />
        </div>
      )}

      {group.content_type === "audio" &&
        group.media_url &&
        (() => {
          // media_provider — джерело правди, коли заповнене; isGdriveUrl —
          // fallback за виглядом URL для записів, збережених до того, як
          // селектор платформи з'явився для аудіо (media_provider лишився
          // null, хоча URL уже вказує на Google Drive) — інакше зіпсований
          // запис лишався б зламаним, поки вчитель вручну не перезбереже
          // блок.
          const provider =
            (group.media_provider as "youtube" | "gdrive" | null) ??
            (isGdriveUrl(group.media_url) ? "gdrive" : null);

          if (provider === "gdrive") {
            // Гібрид: пряме gdrive-посилання в наш AudioPlayer (кнопки
            // швидкості), iframe — лише резерв при провалі. Деталі й
            // залишковий ризик — коментар у самому GdriveAudioPlayer.
            return <GdriveAudioPlayer url={group.media_url} />;
          }

          if (provider === "youtube") {
            // YouTube не має аналогічного прямого-посилання трюку (і не
            // повинен мати) — лишається iframe, як і для відео.
            return (
              <div className="flex flex-col gap-1">
                <div className="overflow-hidden rounded-md border border-gray-200 dark:border-neutral-700" style={{ height: 140 }}>
                  <iframe
                    src={toEmbedUrl(group.media_url, "youtube")}
                    className="h-full w-full"
                    allow="autoplay"
                  />
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Якщо аудіо не відкривається,{" "}
                  <a
                    href={group.media_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    перейдіть за посиланням
                  </a>
                  .
                </p>
              </div>
            );
          }

          return <AudioPlayer src={group.media_url} />;
        })()}

      {group.content_type === "video" && group.media_url && (
        <div className="aspect-video w-full overflow-hidden rounded-md bg-black dark:border dark:border-neutral-700">
          <iframe
            src={toEmbedUrl(group.media_url, group.media_provider as "youtube" | "gdrive" | null)}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {group.content_type === "embed" && group.media_url && (
        <EmbedWithFallback url={group.media_url} height={480} />
      )}
    </>
  );

  const body = (
    <>
      {extraSharedContent}
      {ownSharedContent}

      {/* Подвійний ритм (gap-8 md:gap-12) МІЖ задачами-членами — свідомо
          більший за звичайний EXERCISE_LIST_GAP: ці задачі йдуть БЕЗ власних
          рамок (одна спільна рамка на весь блок), тож потребують помітнішого
          проміжку, щоб не зливатись візуально одна з одною. Кожна задача —
          в ОКРЕМІЙ обгортці-EXERCISE_STACK (одинарний ритм УСЕРЕДИНІ неї:
          заголовок/медіа/тіло тієї Ж задачі), інакше фрагмент ExerciseBlock
          розсипав би title/media/тіло ОДНІЄЇ задачі як окремі елементи
          цього-таки списку — вони отримали б подвійний ритм МІЖ СОБОЮ,
          а не лише між різними задачами. Відступ від контенту вище до
          першої задачі — звичайний одинарний ритм EXERCISE_STACK зовнішньої
          секції (bare чи ні — усі ці частини прості сиблінги в одному
          flex-col). Жодної лінії-розділювача тут більше немає — підкладка
          спільного контенту сама відділяє його фоном. */}
      {visibleTasks.length > 0 && (
        <div className="flex flex-col gap-8 md:gap-12">
          {visibleTasks.map((task) => (
            <div key={task.id} className={EXERCISE_STACK}>
              <ExerciseBlock
                task={task}
                onResult={onResultCallbacks[task.id]}
                // Режим "фіксовано" — індивідуальний бал на кожній задачі
                // безумовно ховається, бо сума окремих балів природно НЕ
                // дорівнює flat_points (формула тут — flat_points × середній %,
                // не сума) і виглядала б для вчителя як нестикування чисел.
                // Лишається видимим лише один загальний підсумок блоку нижче.
                hidePoints={group.points_mode === "flat"}
              />
            </div>
          ))}
        </div>
      )}

      {group.points_mode === "sum" && allAnswered && pointsPossible > 0 && (
        <p className="border-t border-gray-200 pt-4 text-sm font-medium md:pt-6 dark:border-neutral-700">
          Підсумок блоку:{" "}
          <span className="font-normal text-neutral-500 dark:text-neutral-400">
            {pointsEarned} з {pointsPossible} {pluralizePoints(pointsPossible)}
          </span>
        </p>
      )}

      {group.points_mode === "flat" && allAnswered && flatPoints > 0 && (
        <p className="border-t border-gray-200 pt-4 text-sm font-medium md:pt-6 dark:border-neutral-700">
          Підсумок блоку:{" "}
          <span className="font-normal text-neutral-500 dark:text-neutral-400">
            {flatEarned} з {flatPoints} {pluralizePoints(flatPoints)}
          </span>
        </p>
      )}
    </>
  );

  // bare — сторінка сцени сама малює зовнішню <section className={EXERCISE_BLOCK_CLASS}>
  // навколо контенту прикріпленого scene_content_block і цього вмісту разом
  // (одна спільна картка); інакше (звичайний виклик зі списку "Завдання") —
  // TaskGroupBlock малює свою секцію сам, як і раніше.
  if (bare) return body;

  return <section className={`${EXERCISE_BLOCK_CLASS} ${EXERCISE_STACK}`}>{body}</section>;
}
