import { isBlankHtml } from "@/lib/html-text";

type MinimalTask = {
  type: string;
  title: string;
  image_url: string | null;
  audio_url: string | null;
  config: Record<string, unknown> | null;
  games?: { embed_url: string | null } | null;
};

// Спільна перевірка для ВСІХ трьох місць, де задача рендериться в
// EXERCISE_BLOCK_CLASS-обгортці (scenes/[sceneId]/page.tsx, delf-test-tasks.tsx,
// materials/[materialId]/page.tsx) — обгортка не повинна з'являтись, якщо
// студент побачив би лише порожню рамку з padding.
//
// Стосується ЛИШЕ типів, чий видимий вміст похідний з ОДНОГО необов'язкового
// поля, яке може лишитись незаповненим (game — games.embed_url, link/embed —
// config.url, callout — config.content) — за відсутності title/медіа це
// єдине, що взагалі могло б там з'явитись. Решта типів (усі gradable через
// ExerciseCard, vocab_quiz, error_correction, flip_cards, phonetics,
// essay_check) завжди показують структурний вміст чи повідомлення-заглушку
// ("У цій вправі ще немає карток" тощо) навіть при порожніх даних — їм ця
// перевірка не потрібна, тому default — true (рендерити як завжди).
export function taskHasRenderableContent(task: MinimalTask): boolean {
  if (!isBlankHtml(task.title)) return true;
  if (task.image_url || task.audio_url) return true;

  const config = (task.config ?? {}) as { url?: string; content?: string };
  switch (task.type) {
    case "game":
      return !isBlankHtml(task.games?.embed_url);
    case "link":
    case "embed":
      return !isBlankHtml(config.url);
    case "callout":
      return !isBlankHtml(config.content);
    default:
      return true;
  }
}

type MinimalContentBlock = {
  content_type: string;
  content_text?: string | null;
  media_url?: string | null;
  dialogue?: unknown[] | null;
  links?: unknown[] | null;
};

// Той самий принцип, для іншого домену — довільні content-блоки сцени
// (scene_content_blocks: text/script/links/audio/video/embed,
// scene-content-block.tsx) і блоки задач (task_groups: підмножина
// text/audio/video/embed, task-group-block.tsx) — обидва рендерять
// EXERCISE_BLOCK_CLASS БЕЗУМОВНО, незалежно від того, чи заповнене єдине
// релевантне поле для свого content_type. На відміну від
// taskHasRenderableContent, тут НЕМАЄ "типів, які завжди показують щось" —
// усі 5 типів рендерять рівно один блок за наявності одного конкретного
// поля, тож default (невідомий content_type) — false, не true.
export function contentBlockHasRenderableContent(block: MinimalContentBlock): boolean {
  switch (block.content_type) {
    case "text":
      return !isBlankHtml(block.content_text);
    case "script":
      return (block.dialogue ?? []).length > 0;
    case "links":
      return (block.links ?? []).length > 0;
    case "audio":
    case "video":
    case "embed":
      return !isBlankHtml(block.media_url);
    default:
      return false;
  }
}
