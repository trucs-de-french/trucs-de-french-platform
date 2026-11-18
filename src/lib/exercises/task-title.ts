import { taskVariantLabel } from "./task-type-meta";
import { frenchNbsp } from "@/lib/text/french-typography";

// Автоназва вправи — ДО цього виправлення генерувала "<назва типу>:
// <перші слова з config>…" (історія в git), що згодом просочувалось у
// студентський UI (список "Робота над помилками" тощо) як сирий
// tasks.title — порушення правила "студент бачить лише коротку назву
// ТИПУ". Нове правило: автоназва = сама назва типу (taskVariantLabel),
// без жодного "хвоста" з контенту. Викликається і при збереженні
// (tasks/actions.ts, коли назва порожня чи ще дорівнює попередній
// автоназві), і для живого прев'ю в полі "Назва" (task-config-fields.tsx).
//
// Існуючі рядки в БД зі старим "хвостом" НЕ переписані цією задачею
// (навмисно, без миграції) — вони лишаються видимими ЛИШЕ в адмінці
// (task-drag-list.tsx: показує tasks.title як є, і для вчительки такий
// хвіст корисний — відрізняє кілька задач одного типу в списку сцени без
// відкривання кожної). Студентський бік (scene page: лише link/game/embed
// показують tasks.title, завжди ручний, ERROR_TYPES... — див.
// TASK_TYPES_WITH_VISIBLE_TITLE нижче; мистейки-сторінки/error-review —
// task-display-name.ts) ніколи не читає сирий tasks.title для
// гарантованих-автоназва типів, тож старі "хвостаті" рядки в БД безпечні.
export function generateTaskTitle(type: string, config: Record<string, unknown> | null | undefined): string {
  return taskVariantLabel(type, config);
}

// Назва картки "Робота над помилками" (частина 6, хвиля 2; уніфікація
// назв типів, хвилі 3-4) — лише ВІДОБРАЖЕННЯ, title у БД не чіпається.
// Завжди українська назва ТИПУ з ВРАХУВАННЯМ варіанта (taskVariantLabel,
// task-type-meta.ts — напр. word_choice+cross_out → "Вибір зайвого", не
// "Вибір правильної форми"), а не довільний title вчителя (раніше короткий
// title показувався як є — звідси мішанина укр/англ/фр назв у картках:
// "V ou F", "Reorder", "Audio" тощо, бо вчителька могла назвати задачу як
// завгодно). config — опційний: якщо викликач його не передав (чи для
// задачі немає санітизованого config), поведінка як без варіанта —
// TASK_TYPE_LABELS[taskType]. Ординал при кількох картках ОДНАКОВОЇ
// фінальної назви — відповідальність викликача (ця функція не знає про
// сусідні картки); сирий task.title НЕ використовується викликачами для
// студентського відображення взагалі (title-атрибут error-review-block.tsx
// тепер теж дзеркалить відображену назву, не сирий title — див. коментар
// там).
export function displayTaskTitle(task: {
  title: string | null | undefined;
  taskType: string;
  config?: Record<string, unknown> | null;
}): string {
  return frenchNbsp(taskVariantLabel(task.taskType, task.config));
}
