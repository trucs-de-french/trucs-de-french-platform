import { Lightbulb } from "lucide-react";
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
// Єдиний рендер рядка "FR-інструкція / UK-пояснення" (мокап "варіант 4") —
// раніше жив лише тут, інлайн; винесений в окрему функцію, щоб інші
// заголовки (flip-cards.tsx через TaskPanelHeader нижче, і будь-який
// майбутній виклик-сайт) не копіювали ту саму розмітку. fr/uk — уже
// санітизований HTML (sanitizeInstructionsHtml) або null/undefined.
// "/" рендериться лише коли ОБИДВА тексти не пусті; лишається всередині
// того самого inline-елемента, що й FR-текст (fr-group), тож не може
// перенестись на новий рядок окремо чи опинитись після UK-тексту.
export function TaskInstructionLine({ fr, uk }: { fr?: string | null; uk?: string | null }) {
  if (!fr && !uk) return null;
  return (
    <div className="task-panel-instruction-line">
      {fr && (
        <span className="task-panel-instruction-fr-group">
          <span className="task-panel-instruction-fr" dangerouslySetInnerHTML={{ __html: fr }} />
          {uk && <span className="task-panel-instruction-slash">/</span>}
        </span>
      )}
      {uk && (
        <span className="task-panel-instruction-uk" dangerouslySetInnerHTML={{ __html: uk }} />
      )}
    </div>
  );
}

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
  const showInstructionLine = !!safeText || !!safeSub;
  const showPillsRow = !!pointsText || !!hintText;

  if (!showInstructionLine && !showPillsRow) return null;

  return (
    <div className="task-panel-header">
      {showInstructionLine && <TaskInstructionLine fr={safeText} uk={safeSub} />}
      {showPillsRow && (
        <div className="task-panel-pills-row">
          {pointsText && <PointsPill text={pointsText} />}
          {hintText && <HintPill text={hintText} />}
        </div>
      )}
      <div className="task-panel-header-divider" />
    </div>
  );
}

// Остання вправа, що показувала пілюлю балів/прогрес-смужку в "рядку 1"
// панелі (flip-cards.tsx, TaskPanelProgressRow) тепер малює ту саму смужку
// вкладок, що й усі інші типи (BlockTabs, block-navigation.tsx) — сам
// TaskPanelProgressRow і BlockSegments, які він єдиний використовував,
// стали мертвим кодом і видалені разом.
export function PointsPill({ text }: { text: string }) {
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
