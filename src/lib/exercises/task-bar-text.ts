import { getDefaultTaskName } from "./default-task-labels";
import { htmlToPlainText } from "@/lib/html-text";

// Текст компактного бару задачі (GlassBlock, glass-block.tsx) — коротка
// французька НАЗВА ТИПУ (мокап "варіант 3"), не інструкція вправи (та
// тепер живе ЛИШЕ в заголовку панелі, task-panel-header.tsx — ніколи не
// дублюється тут). config.cardTitle — ручний перепис вчительки (нове
// поле конструктора "Назва типу (FR)", task-config-fields.tsx), окремо
// від tasks.title (технічна/прев'ю назва задачі в адмінці, не студентська
// — навмисно різні поля, щоб зміна одної не чіпала іншу). Порожнє/відсутнє
// cardTitle — дефолтна назва типу (default-task-labels.ts).
export function getTaskBarText(task: { type: string; config: Record<string, unknown> | null }): string {
  const config = task.config ?? {};
  const custom = typeof config.cardTitle === "string" ? htmlToPlainText(config.cardTitle).trim() : "";
  return custom || getDefaultTaskName(task.type, config);
}
