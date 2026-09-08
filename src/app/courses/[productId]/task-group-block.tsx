"use client";

import { useState, useMemo } from "react";
import { toEmbedUrl, isGdriveUrl } from "@/lib/video";
import { AudioPlayer } from "@/components/audio-player";
import { InstructionsText } from "@/components/exercises/instructions-text";
import { isExerciseType } from "@/components/exercises/exercise-card";
import { pluralizePoints } from "@/lib/pluralize-points";
import type { GradeResult } from "@/lib/exercises/types";
import { ExerciseBlock, type ExerciseTask } from "./exercise-block";

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
export function TaskGroupBlock({ group, tasks }: { group: TaskGroupData; tasks: ExerciseTask[] }) {
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

  return (
    <section className="rounded-md border p-3">
      {group.content_type === "text" && group.content_text && (
        <InstructionsText text={group.content_text} className="mb-3" />
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

          if (!provider) {
            return <AudioPlayer src={group.media_url} className="mb-3" />;
          }

          return (
            <div className="mb-3">
              <div className="overflow-hidden rounded-md border" style={{ height: 140 }}>
                <iframe
                  src={toEmbedUrl(group.media_url, provider)}
                  className="h-full w-full"
                  allow="autoplay"
                />
              </div>
              {/* Той самий завжди видимий резервний варіант, що video/embed
                  вище — gdrive iframe не гарантовано вбудовується (приватні
                  файли тощо). */}
              <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
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
        })()}

      {group.content_type === "video" && group.media_url && (
        <div className="mb-3 aspect-video w-full overflow-hidden rounded-md bg-black">
          <iframe
            src={toEmbedUrl(group.media_url, group.media_provider as "youtube" | "gdrive" | null)}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {group.content_type === "embed" && group.media_url && (
        <div className="mb-3">
          <div className="overflow-hidden rounded-md border" style={{ height: 480 }}>
            <iframe src={group.media_url} className="h-full w-full" allowFullScreen />
          </div>
          {/* Завжди видимий резервний варіант — той самий принцип, що
              ExerciseBlock (не опційний, без перемикача вимкнення). */}
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Якщо вміст не відкривається,{" "}
            <a href={group.media_url} target="_blank" rel="noopener noreferrer" className="underline">
              перейдіть за посиланням
            </a>
            .
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4 border-t pt-3">
        {tasks.map((task) => (
          <ExerciseBlock
            key={task.id}
            task={task}
            onResult={onResultCallbacks[task.id]}
            // Режим "фіксовано" — індивідуальний бал на кожній задачі
            // безумовно ховається, бо сума окремих балів природно НЕ
            // дорівнює flat_points (формула тут — flat_points × середній %,
            // не сума) і виглядала б для вчителя як нестикування чисел.
            // Лишається видимим лише один загальний підсумок блоку нижче.
            hidePoints={group.points_mode === "flat"}
          />
        ))}
      </div>

      {group.points_mode === "sum" && allAnswered && pointsPossible > 0 && (
        <p className="mt-3 border-t pt-3 text-sm font-medium">
          Підсумок блоку:{" "}
          <span className="font-normal text-neutral-500 dark:text-neutral-400">
            {pointsEarned} з {pointsPossible} {pluralizePoints(pointsPossible)}
          </span>
        </p>
      )}

      {group.points_mode === "flat" && allAnswered && flatPoints > 0 && (
        <p className="mt-3 border-t pt-3 text-sm font-medium">
          Підсумок блоку:{" "}
          <span className="font-normal text-neutral-500 dark:text-neutral-400">
            {flatEarned} з {flatPoints} {pluralizePoints(flatPoints)}
          </span>
        </p>
      )}
    </section>
  );
}
