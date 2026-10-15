import { ChevronDown, ChevronUp } from "lucide-react";

// Обгортка JOINED-картки (бар+тіло одним блоком, globals.css) — videoNode/
// ScriptSection/VocabSection (сторінка сцени) підставляють напряму в
// className=, коли секція і розгорнута, і на фоні курсу.
export const SCENE_CARD_CLASS = "scene-card";

// Скляний заголовок-бар секції студентської сторінки сцени, коли активний
// фон курсу (onBackground) — замінює student-on-bg h2/тогл-кнопку (видно
// лише на самому фоні) там, де текст інакше лежить прямо на фоновій
// картинці. attached — бар безпосередньо над тілом картки (JOINED,
// розгорнуто): верхні кути округлені, нижньої межі нема, тінь на обгортці
// (SCENE_CARD_CLASS). !attached — бар сам по собі (JOINED згорнуто, або
// STANDALONE секція): повне округлення/рамка/власна тінь. collapsible —
// рендериться як <button aria-expanded>, увесь бар лишається зоною кліку
// (великий тач-таргет); інакше — звичайний div без тоглу (напр. "Відео",
// не згортається).
export function SectionHeaderBar({
  title,
  attached,
  collapsible = false,
  expanded,
  onToggle,
}: {
  title: string;
  attached: boolean;
  collapsible?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  const barClass = `scene-bar ${attached ? "scene-bar--attached" : "scene-bar--detached"}`;

  if (!collapsible) {
    return (
      <div className={barClass}>
        <h2 className="scene-bar-title">{title}</h2>
      </div>
    );
  }

  const Chevron = expanded ? ChevronUp : ChevronDown;

  return (
    <button type="button" onClick={onToggle} aria-expanded={expanded} className={barClass}>
      <h2 className="scene-bar-title">{title}</h2>
      <span className="scene-bar-toggle" aria-hidden>
        <Chevron size={18} strokeWidth={2.8} className="text-[#f6dc8e]" />
      </span>
    </button>
  );
}
