import type { ReactNode } from "react";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { frenchNbspHtml } from "@/lib/text/french-typography";
import { HintBulb } from "./hint-bulb";

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
          <span
            className="task-panel-instruction-fr"
            data-instruction-fr=""
            dangerouslySetInnerHTML={{ __html: fr }}
          />
          {uk && (
            <span className="task-panel-instruction-slash" data-instruction-slash="">
              /
            </span>
          )}
        </span>
      )}
      {uk && (
        <span
          className="task-panel-instruction-uk"
          data-instruction-uk=""
          dangerouslySetInnerHTML={{ __html: uk }}
        />
      )}
    </div>
  );
}

export function TaskPanelHeader({
  pointsText,
  instructionText,
  subInstructionText,
  hintText,
  counter,
  rightContent,
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
  // Пілюля-лічильник питань вікторини ("N / M") — поруч із пілюлею балів,
  // ліворуч від пілюлі підказки. total <= 1 — викликач сам не передає
  // counter (vocab-quiz.tsx ховає пілюлю на екрані результату й коли
  // питань замало для лічильника).
  counter?: { current: number; total: number } | null;
  // Мокап "варіант 1" — task-специфічні контролі праворуч у тому самому
  // інфо-рядку (зараз лише зум сітки word_search/crossword,
  // GridZoomControls) — відсутній, слот просто не рендериться.
  rightContent?: ReactNode;
}) {
  const safeText = instructionText ? frenchNbspHtml(sanitizeInstructionsHtml(instructionText)) : null;
  const safeSub = subInstructionText ? frenchNbspHtml(sanitizeInstructionsHtml(subInstructionText)) : null;
  const showInstructionLine = !!safeText || !!safeSub;
  const showPillsRow = !!pointsText || !!hintText || !!counter || !!rightContent;

  if (!showInstructionLine && !showPillsRow) return null;

  return (
    <div className="task-panel-header" data-task-header="">
      {showInstructionLine && <TaskInstructionLine fr={safeText} uk={safeSub} />}
      {showPillsRow && (
        <div className="task-panel-pills-row">
          <div className="task-panel-pills-left">
            {pointsText && <PointsPill text={pointsText} />}
            {counter && <CounterPill current={counter.current} total={counter.total} />}
            {hintText && <HintPill text={hintText} />}
          </div>
          {rightContent && <div className="task-panel-controls-right">{rightContent}</div>}
        </div>
      )}
      <div className="task-panel-header-divider" data-header-divider="" />
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

// Лічильник питань вікторини ("N / M") у рядку (b) поруч із пілюлею балів
// (мокап "варіант 1") — замінює колишній тонкий прогрес-бар/текст
// "Питання N з M" під роздільником (vocab-quiz.tsx). role="status" +
// aria-live="polite" на самій пілюлі — зміна current/total (новий
// aria-label) оголошується скрінридером без окремого live-region-елемента.
export function CounterPill({ current, total }: { current: number; total: number }) {
  return (
    <span className="counter-pill" role="status" aria-live="polite" aria-label={`Питання ${current} з ${total}`}>
      <span className="counter-pill-current">{current}</span>
      <span className="counter-pill-total">{` / ${total}`}</span>
    </span>
  );
}

// Мокап "варіант 1" — коротка пілюля-підказка: лампочка — стандартний
// HintBulb (28px, той самий вигляд, що всюди інде), текст короткий, з
// жирним напівжирним лейблом "Підказка:" перед ним (решта тексту —
// weight 600 через font-semibold на самому контейнері, лейбл локально
// переважає його font-bold'ом). Висота пілюлі — h-9 (36px, було h-8/32px):
// піднята під лампочку (раніше 24px, тепер 28px), щоб та не впиралась у
// верх/низ пілюлі.
function HintPill({ text }: { text: string }) {
  return (
    <span className="inline-flex h-9 min-w-0 max-w-full items-center gap-2 rounded-full border border-[rgba(217,183,101,0.55)] bg-white pl-1 pr-[14px] font-body text-[14px] font-semibold text-[#6b4a14] dark:border-[rgba(243,217,139,0.28)] dark:bg-white/[0.06] dark:text-[#f6dc8e]">
      <HintBulb state="available" as="span" />
      <span className="min-w-0">
        <span className="font-bold">Підказка:</span> {text}
      </span>
    </span>
  );
}
