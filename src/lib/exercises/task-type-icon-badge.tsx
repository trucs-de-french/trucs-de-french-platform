import { TASK_TYPE_ICON } from "./task-type-meta";

// Кругла товстоконтурна іконка типу завдання (референс 2 нового дизайну) —
// обгортка над звичайною lucide-іконкою (stroke="currentColor", підтримує
// strokeWidth), без нової бібліотеки. Кільце-ОБВІДКА (не залита заливка) —
// у реальних файлах референсу (design-refs/image.png) іконки всередині кола
// це кастомні двоколірні (фіолет+бірюза) плоскі піктограми на прозорому/
// білому тлі, не суцільний колір; товста фіолетова рамка + один lucide-гліф
// усередині — найближче наближення без переходу на кастомні SVG per тип
// (те, що обговорювалось з користувачем як окремий, значно більший крок).
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

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 border-brand bg-white dark:bg-neutral-950 ${box}`}
      aria-hidden
    >
      <Icon size={icon} strokeWidth={2.5} className="text-brand" />
    </span>
  );
}
