import { TASK_TYPE_ICON, CATEGORY_COLORS, getTaskTypeCategory } from "./task-type-meta";

// Кругла тонкоконтурна іконка типу завдання — обгортка над звичайною
// lucide-іконкою (stroke="currentColor", підтримує strokeWidth), без нової
// бібліотеки. Кільце тепер кольору КАТЕГОРІЇ типу (те саме, що ліва смужка
// й бейдж на рядку задачі, CATEGORY_COLORS.icon*) — раніше було завжди
// indigo/brand незалежно від категорії; свідомо змінено на запит користувача,
// щоб іконка й бейдж читались як один колір. Фолбек на brand — типів поза
// TASK_TYPE_CATEGORY немає, але про всяк випадок.
// Розмір "xs" — для щільних списків (task-drag-list, test-section-drag-
// list), "sm" — для комбобоксу/бейджа вибору типу, де іконка трохи більша.
const SIZE = {
  xs: { box: "h-6 w-6", icon: 12 },
  sm: { box: "h-7 w-7", icon: 14 },
} as const;

export function TaskTypeIconBadge({
  type,
  size = "xs",
}: {
  type: string;
  size?: keyof typeof SIZE;
}) {
  // TASK_TYPE_ICON[type] напряму (не через getTaskTypeIcon(type)) — react
  // hooks eslint-плагін хибно трактує "змінна = виклик функції, потім
  // <Змінна/>" як створення компонента під час рендеру (той самий обхід,
  // що вже є в task-config-fields.tsx).
  const Icon = TASK_TYPE_ICON[type];
  if (!Icon) return null;

  const { box, icon } = SIZE[size];
  const category = getTaskTypeCategory(type);
  const iconBorder = category ? CATEGORY_COLORS[category].iconBorder : "border-brand";
  const iconText = category ? CATEGORY_COLORS[category].iconText : "text-brand";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border ${iconBorder} bg-white dark:bg-neutral-950 ${box}`}
      aria-hidden
    >
      <Icon size={icon} strokeWidth={2.5} className={iconText} />
    </span>
  );
}
