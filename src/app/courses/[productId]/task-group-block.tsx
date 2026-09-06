import { toEmbedUrl } from "@/lib/video";
import { AudioPlayer } from "@/components/audio-player";
import { InstructionsText } from "@/components/exercises/instructions-text";
import { ExerciseBlock, type ExerciseTask } from "./exercise-block";

export type TaskGroupData = {
  id: string;
  content_type: string;
  content_text: string | null;
  media_url: string | null;
  media_provider: string | null;
};

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
  return (
    <section className="rounded-md border-2 border-dashed p-3">
      {group.content_type === "text" && group.content_text && (
        <InstructionsText text={group.content_text} className="mb-3" />
      )}

      {group.content_type === "audio" && group.media_url && (
        <AudioPlayer src={group.media_url} className="mb-3" />
      )}

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
          <ExerciseBlock key={task.id} task={task} />
        ))}
      </div>
    </section>
  );
}
