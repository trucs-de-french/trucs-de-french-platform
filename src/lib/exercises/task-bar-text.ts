import { DEFAULT_INSTRUCTIONS, WORD_CHOICE_DEFAULT_INSTRUCTIONS } from "./default-instructions";
import { htmlToPlainText } from "@/lib/html-text";

// Текст компактного бару задачі (GlassBlock, glass-block.tsx) — ОДНЕ місце
// для всіх типів вправ, замість назви задачі (task.title) показує ту саму
// французьку інструкцію, яку студент і так бачить у тілі вправи
// (InstructionsText/config.instructions), щоб бар одразу підказував, що
// робити, не дублюючи малопомітну технічну назву.
//
// Мапінг поля інструкції — однаковий для ВСІХ типів із записом у
// DEFAULT_INSTRUCTIONS (config.instructions ?? дефолт типу), крім:
// - word_choice: дефолт залежить від config.mode (select/cross_out) —
//   WORD_CHOICE_DEFAULT_INSTRUCTIONS, не DEFAULT_INSTRUCTIONS.word_choice
//   (такого запису там і нема).
// - essay_check: власне поле — config.prompt (тема есе вчителя), не
//   config.instructions, і воно вже показується в тілі вправи ІНШИМ
//   стилем (не через InstructionsText/.instruction-text, а окремим <p>,
//   essay-check.tsx) — свідомо НЕ підставляємо в бар: тема есе може бути
//   довгим текстом конкретного завдання, а не короткою інструкцією, і
//   немає спільного CSS-гачка, яким можна було б безпечно прибрати
//   дублікат у тілі (на відміну від .instruction-text нижче).
// Типи без запису в DEFAULT_INSTRUCTIONS (callout/link/game — не минають
// GlassBlock узагалі; embed/ai_examiner/error_correction — немає
// редагованої інструкції) — фолбек (b) нижче.
function resolveInstructionText(type: string, config: Record<string, unknown>): string | undefined {
  if (type === "essay_check") return undefined;

  const raw = typeof config.instructions === "string" ? config.instructions.trim() : "";
  const fallback =
    type === "word_choice"
      ? WORD_CHOICE_DEFAULT_INSTRUCTIONS[config.mode === "cross_out" ? "cross_out" : "select"].instruction
      : DEFAULT_INSTRUCTIONS[type]?.instruction;

  const value = raw || fallback;
  if (!value) return undefined;
  const plain = htmlToPlainText(value);
  return plain || undefined;
}

export type TaskBarText = {
  // undefined — немає чим заповнити бар узагалі (ні інструкції, ні назви)
  // — GlassBlock тоді рендерить лише панель, без бару (той самий принцип,
  // що вже є: {title && (...)}).
  text: string | undefined;
  // true — text узято з інструкції вправи (а не з назви задачі): викликач
  // передає це в GlassBlock.hideInstructionInPanel, щоб та сама
  // інструкція не малювалась ЩЕ РАЗ усередині панелі (.instruction-text).
  fromInstruction: boolean;
};

export function getTaskBarText(task: {
  type: string;
  title: string;
  config: Record<string, unknown> | null;
}): TaskBarText {
  const config = task.config ?? {};
  const instruction = resolveInstructionText(task.type, config);
  if (instruction) return { text: instruction, fromInstruction: true };

  const title = task.title?.trim();
  return { text: title || undefined, fromInstruction: false };
}
