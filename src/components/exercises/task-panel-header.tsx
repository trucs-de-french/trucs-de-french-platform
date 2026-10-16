import { Lightbulb } from "lucide-react";
import { BlockSegments } from "./block-navigation";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { frenchNbspHtml } from "@/lib/text/french-typography";

// Єдина "зона заголовка" панелі задачі (дизайн-варіант 3) — перший елемент
// усередині .glass-block-panel, одразу над картками вправи: інструкція
// (FR / UK, рядок a), пілюля балів + пілюля підказки-лампочки (рядок b),
// тонка лінія-роздільник (c). Пагінація блоків (підпис "Блок N з M" +
// прогрес-смужка) більше не живе тут узагалі — вона переїхала у вкладки
// над панеллю (BlockTabs, block-navigation.tsx); пілюля балів тепер ЗАВЖДИ
// в рядку (b), незалежно від blockCount. Дані (бали/інструкція/підказка)
// лишаються СЕРВЕР-ОБЧИСЛЕНИМИ самим викликачем (як і раніше) — цей
// компонент лише розкладає вже готові значення у новий вигляд.
export function TaskPanelHeader({
  pointsText,
  instructionText,
  subInstructionText,
  hintText,
}: {
  // blockCount/activeBlock/onChangeBlock/isBlockChecked/labels/blockLabel —
  // пагінація блоків більше не рендериться тут (переїхала у вкладки,
  // BlockTabs, block-navigation.tsx): лишаються в типі пропсів, щоб ~20
  // виклик-сайтів вправ, що й досі їх передають, не вимагали правок.
  blockCount?: number;
  activeBlock?: number;
  onChangeBlock?: (index: number) => void;
  isBlockChecked?: (index: number) => boolean;
  labels?: (string | undefined)[];
  // "Блок" (типово) / "Сторінка" (flip-cards.tsx).
  blockLabel?: string;
  // Уже готовий текст пілюлі балів ("6 балів", "3/6 балів") — викликач
  // вирішує, коли й що показати (pointsVisible/hidePoints/до чи після
  // перевірки), той самий принцип, що й раніше. Відсутній — пілюля не
  // рендериться.
  pointsText?: string;
  // Санітизується тут же (як і раніше в InstructionsText) — сире HTML з
  // БД, не довіряти без санітизації навіть повторно.
  instructionText?: string;
  subInstructionText?: string;
  // Готовий текст підказки (hintExplanationText, hint-explanation.tsx) —
  // відсутній/null — пілюля підказки не рендериться.
  hintText?: string | null;
}) {
  const safeText = instructionText ? frenchNbspHtml(sanitizeInstructionsHtml(instructionText)) : null;
  const safeSub = subInstructionText ? frenchNbspHtml(sanitizeInstructionsHtml(subInstructionText)) : null;
  const showInstructionLine = !!safeText;
  const showPillsRow = !!pointsText || !!hintText;

  if (!showInstructionLine && !showPillsRow) return null;

  return (
    <div className="task-panel-header">
      {showInstructionLine && (
        <div className="task-panel-instruction-line">
          <span className="task-panel-instruction-fr-group">
            <span className="task-panel-instruction-fr" dangerouslySetInnerHTML={{ __html: safeText! }} />
            {safeSub && <span className="task-panel-instruction-slash">/</span>}
          </span>
          {safeSub && (
            <span className="task-panel-instruction-uk" dangerouslySetInnerHTML={{ __html: safeSub }} />
          )}
        </div>
      )}
      {showPillsRow && (
        <div className="task-panel-pills-row">
          {pointsText && <PointsPill text={pointsText} variant="tabs" />}
          {hintText && <HintPill text={hintText} />}
        </div>
      )}
      <div className="task-panel-header-divider" />
    </div>
  );
}

// Рядок 1 окремо (TaskPanelHeader вище рендерить його як частину спільної
// зони) — потрібен САМ ПО СОБІ лише flip-cards.tsx (режим random_reveal):
// там пагінація сторінок (←/→) сидить МІЖ кнопкою "Випадковий вибір" і
// сіткою карток, а не одразу під інструкцією (структурне рішення, що існує
// до цієї задачі, не торкаємось) — інструкцію там малює ОКРЕМИЙ виклик
// TaskPanelHeader (лише instructionText, без blockCount) угорі вправи.
export function TaskPanelProgressRow({
  blockCount,
  activeBlock,
  onChangeBlock,
  isBlockChecked,
  labels,
  blockLabel = "Блок",
  pointsText,
}: {
  blockCount?: number;
  activeBlock?: number;
  onChangeBlock?: (index: number) => void;
  isBlockChecked?: (index: number) => boolean;
  labels?: (string | undefined)[];
  blockLabel?: string;
  pointsText?: string;
}) {
  const hasBlocks = !!blockCount && blockCount > 1 && !!onChangeBlock;
  if (!hasBlocks && !pointsText) return null;

  return (
    <div className={`flex items-center gap-3 ${hasBlocks ? "" : "justify-end"}`}>
      {hasBlocks && (
        <>
          <span className="shrink-0 whitespace-nowrap font-body text-[17px] font-bold text-[#2b2a4a] dark:text-white">
            {blockLabel} {(activeBlock ?? 0) + 1}
            <span className="font-medium text-neutral-500 dark:text-neutral-400"> з {blockCount}</span>
          </span>
          <div className="min-w-0 flex-1">
            <BlockSegments
              blockCount={blockCount!}
              activeBlock={activeBlock ?? 0}
              onChangeBlock={onChangeBlock!}
              isBlockChecked={isBlockChecked}
              labels={labels}
              label={blockLabel}
            />
          </div>
        </>
      )}
      {pointsText && <PointsPill text={pointsText} />}
    </div>
  );
}

// variant "panel" (типово) — стара гранатова пілюля всередині рядка 1
// панелі (TaskPanelProgressRow, лише для вправ БЕЗ блоків/вкладок — ця
// задача її не чіпає). variant "tabs" — нова градієнтна пілюля САМЕ в
// смужці вкладок (BlockTabs), з зіркою: окремий вигляд, щоб не зачепити
// вправи без вкладок через спільний компонент.
export function PointsPill({ text, variant = "panel" }: { text: string; variant?: "panel" | "tabs" }) {
  if (variant === "tabs") {
    return (
      <span className="points-pill-gradient">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="#f6dc8e"
          aria-hidden="true"
          className="points-pill-star"
        >
          <path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7z" />
        </svg>
        {text}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-[#1a1640] px-3 py-[3px] font-heading text-[13px] font-extrabold text-[#f6dc8e] dark:border dark:border-[rgba(243,217,139,0.25)] dark:bg-white/[0.06] dark:text-[#f6dc8e]">
      {text}
    </span>
  );
}

function HintPill({ text }: { text: string }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-[rgba(217,183,101,0.55)] bg-white py-[5px] pl-[6px] pr-[14px] font-body text-[14px] font-semibold text-[#6b4a14] dark:border-[rgba(243,217,139,0.28)] dark:bg-white/[0.06] dark:text-[#f6dc8e]">
      <span className="lamp-badge flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#fdf0c4] text-[#b8761a] dark:bg-amber-900/70 dark:text-amber-300">
        <Lightbulb size={13} aria-hidden />
      </span>
      <span className="min-w-0">{text}</span>
    </span>
  );
}
