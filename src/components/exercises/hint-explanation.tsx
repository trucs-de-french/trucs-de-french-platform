import { HINT_EXPLANATIONS, HINTS_REDUCE_POINTS_SUFFIX } from "@/lib/exercises/hints";
import { HintBulb } from "./hint-bulb";

// Один рядок під інструкцією вправи, що пояснює механізм підказок — лише
// там, де підказки реально доступні. hidden — обчислює викликач (DELF,
// "Перевірити" вже натиснуто, чи, для fill_blank, увімкнений банк слів —
// будь-яка з причин, чому підказки в ЦЬОМУ проходженні недоступні). type —
// ключ HINT_EXPLANATIONS; типи без запису там (усі, крім 6 із підказками)
// просто не рендерять нічого.
export function HintExplanation({
  type,
  hintsReducePoints,
  hidden,
}: {
  type: string;
  hintsReducePoints: boolean;
  hidden: boolean;
}) {
  if (hidden) return null;
  const text = HINT_EXPLANATIONS[type];
  if (!text) return null;

  return (
    <p className="flex items-center gap-1.5 text-sm text-neutral-500 dark:text-neutral-400">
      <HintBulb size="sm" state="available" as="span" />
      {text}
      {hintsReducePoints ? HINTS_REDUCE_POINTS_SUFFIX : ""}
    </p>
  );
}
