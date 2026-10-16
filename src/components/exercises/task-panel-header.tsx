import { Lightbulb } from "lucide-react";
import { BlockSegments } from "./block-navigation";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { frenchNbspHtml } from "@/lib/text/french-typography";
import { EXERCISE_SUBINSTRUCTION } from "@/lib/typography-styles";

// Єдина "зона заголовка" панелі задачі (дизайн-варіант 3) — замінює РІЗНІ
// рядки, що раніше кожен тип вправи малював окремо (сірий текст "N балів"
// біля інструкції, саму інструкцію через InstructionsText, окремий рядок
// лампочки-підказки HintExplanation, підпис "Блок N з M" + сегменти
// прогресу BlockProgressHeader) — ОДНИМ спільним компонентом з двома
// рядками:
//   Рядок 1 (лише якщо є пагінація блоків АБО бали): підпис блоку зліва,
//     смужка прогресу (BlockSegments) посередині (flex:1), пілюля балів
//     праворуч. Без блоків — лише пілюля балів, праворуч.
//   Рядок 2: українська інструкція зліва, пілюля підказки-лампочки
//     праворуч; обидва огортаються (wrap) на вузьких екранах.
// Дані (бали/інструкція/підказка/блок) лишаються СЕРВЕР-ОБЧИСЛЕНИМИ самим
// викликачем (як і раніше) — цей компонент лише розкладає вже готові
// рядки/значення у новий вигляд, не додає нових полів і не рахує бали сам.
export function TaskPanelHeader({
  blockCount,
  activeBlock,
  onChangeBlock,
  isBlockChecked,
  labels,
  blockLabel = "Блок",
  pointsText,
  instructionText,
  subInstructionText,
  hintText,
}: {
  // Відсутній/≤1 — рядок 1 не показує підпис блоку й смужку прогресу
  // (типи без пагінації блоків: fill_blank, image_match, drag_drop тощо).
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
  const showRow1 =
    (!!blockCount && blockCount > 1 && !!onChangeBlock) || !!pointsText;
  const showRow2 = !!safeText || !!hintText;

  if (!showRow1 && !showRow2) return null;

  return (
    <div className="flex flex-col gap-[18px]">
      {showRow1 && (
        <TaskPanelProgressRow
          blockCount={blockCount}
          activeBlock={activeBlock}
          onChangeBlock={onChangeBlock}
          isBlockChecked={isBlockChecked}
          labels={labels}
          blockLabel={blockLabel}
          pointsText={pointsText}
        />
      )}

      {showRow2 && (
        <div className="flex flex-wrap items-center gap-3">
          {safeText && (
            <div className="min-w-0 flex-1">
              <div
                className="instruction-text font-body text-[18px] font-normal text-[#2b2a4a] dark:text-white"
                dangerouslySetInnerHTML={{ __html: safeText }}
              />
              {safeSub && (
                <div
                  className={`instruction-subtext mt-1 ${EXERCISE_SUBINSTRUCTION}`}
                  dangerouslySetInnerHTML={{ __html: safeSub }}
                />
              )}
            </div>
          )}
          {hintText && <HintPill text={hintText} />}
        </div>
      )}
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

function PointsPill({ text }: { text: string }) {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-[#1a1640] px-3 py-[3px] font-heading text-[13px] font-extrabold text-[#f6dc8e] dark:border dark:border-[rgba(243,217,139,0.25)] dark:bg-white/[0.06] dark:text-[#f6dc8e]">
      {text}
    </span>
  );
}

function HintPill({ text }: { text: string }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[rgba(217,183,101,0.55)] bg-white py-[5px] pl-[6px] pr-[14px] text-[13px] font-bold text-[#6b4a14] dark:border-transparent dark:bg-transparent dark:text-neutral-400">
      <span className="lamp-badge flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#fdf0c4] text-[#b8761a] dark:bg-amber-900/70 dark:text-amber-300">
        <Lightbulb size={13} aria-hidden />
      </span>
      {text}
    </span>
  );
}
