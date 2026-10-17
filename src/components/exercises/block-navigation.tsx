"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { pluralizePoints } from "@/lib/pluralize-points";
import { RESULT_MESSAGE_CLASS, SCORE_LABEL_CLASS } from "./score-style";

// Спільний підсумок для рядка "Загалом" — навмисно НЕ повний GradeResult
// (той несе ще й detail, типізований по-різному для кожного gradable-типу,
// тут не потрібен): лише 4 поля, які реально показує рядок.
export type BlockNavigationSummary = {
  correct: boolean;
  score: number;
  pointsEarned?: number;
  pointsPossible?: number;
};

function ChevronIcon({ direction, size }: { direction: "left" | "right"; size: number }) {
  const d = direction === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7 3.5 12.5 9 7 14.5";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function TabCheckIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="block-tab-check"
    >
      <path d="M3 8.5 6.5 12 13 4" />
    </svg>
  );
}

// Мокап "варіант 4" — ОДНА смужка над панеллю задачі: плашка типу
// (.task-plaque, назва типу — getTaskBarText/default-task-labels.ts,
// переданa викликачем як plaqueText, бо лише він знає raw task.config/
// type) + роздільник + вкладки блоків "Блок N" (лише 2+ блоки; замінює
// підпис "Блок N з M" + BlockSegments, що раніше малювались РЯДКОМ 1
// усередині панелі, task-panel-header.tsx). Та сама панель
// (.task-header-strip-anchor, CSS, globals.css) "виходить" за падінг
// .glass-block-panel і підіймає саму смужку НАД верхню рамку панелі
// (position:absolute, bottom:0 відносно anchor висотою 0, що сидить
// рівно на лінії рамки панелі) — без зміни структури GlassBlock/
// сторінок-викликачів, які самі панель і рендерять. onChangeBlock/
// isBlockChecked — РІВНО ті самі пропси, що вже йшли в
// BlockSegments/BlockNavFooter: жодної нової логіки перемикання блоків,
// вкладка лише кличе той самий обробник з потрібним індексом.
//
// Плашка рендериться ЗАВЖДИ (навіть без вкладок/без plaqueText — тоді
// лишається порожньою й компонент повертає null, бо немає що показати):
// одна вправа без блоків все одно показує лише свою плашку, без
// роздільника й вкладок (режим "один блок").
export function BlockTabs({
  plaqueText,
  blockCount,
  activeBlock = 0,
  onChangeBlock,
  isBlockChecked,
  isBlockDisabled,
  labels,
  blockLabel = "Блок",
}: {
  // Відсутній — у групі з кількома задачами немає єдиної "головної" назви
  // (task-group-block.tsx) — компонент тоді не рендерить нічого.
  plaqueText?: string;
  blockCount?: number;
  activeBlock?: number;
  onChangeBlock?: (index: number) => void;
  isBlockChecked?: (index: number) => boolean;
  // Жоден тип вправи сьогодні не має послідовного розблокування блоків —
  // пропс підготовлений про запас (CSS .block-tab[aria-disabled] уже
  // готовий), не підключений ніде.
  isBlockDisabled?: (index: number) => boolean;
  labels?: (string | undefined)[];
  blockLabel?: string;
  // ЕТАП N — пілюля балів переїхала в заголовок панелі (TaskPanelHeader),
  // більше не рендериться тут; пропс лишається у типі, щоб усі існуючі
  // виклик-сайти (вони й далі передають pointsText і в BlockTabs, і в
  // TaskPanelHeader) не вимагали правок.
  pointsText?: string;
}) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [fade, setFade] = useState<{ left: boolean; right: boolean }>({ left: false, right: false });

  const hasTabs = !!blockCount && blockCount > 1 && !!onChangeBlock;

  useEffect(() => {
    if (!hasTabs) return;
    tabRefs.current[activeBlock]?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeBlock, hasTabs]);

  function updateFade() {
    const el = scrollRef.current;
    if (!el) return;
    setFade({
      left: el.scrollLeft > 1,
      right: el.scrollLeft < el.scrollWidth - el.clientWidth - 1,
    });
  }

  useEffect(() => {
    if (!hasTabs) return;
    updateFade();
    const el = scrollRef.current;
    if (!el) return;
    const onResize = () => updateFade();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [hasTabs, blockCount]);

  if (!plaqueText && !hasTabs) return null;

  function focusAndChange(index: number) {
    if (!blockCount || !onChangeBlock) return;
    const clamped = Math.max(0, Math.min(blockCount - 1, index));
    tabRefs.current[clamped]?.focus();
    onChangeBlock(clamped);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!blockCount) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAndChange(index + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAndChange(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      focusAndChange(0);
    } else if (e.key === "End") {
      e.preventDefault();
      focusAndChange(blockCount - 1);
    }
  }

  const fadeClass =
    fade.left && fade.right
      ? "task-tabs-scroll--fade-left task-tabs-scroll--fade-right"
      : fade.right
        ? "task-tabs-scroll--fade-right"
        : fade.left
          ? "task-tabs-scroll--fade-left"
          : "";

  return (
    <div className="task-header-strip-anchor">
      <div className="task-header-strip">
        {plaqueText && (
          <span className="task-plaque" title={plaqueText}>
            {plaqueText}
          </span>
        )}
        {hasTabs && (
          <>
            {plaqueText && <span className="task-plaque-divider" aria-hidden="true" />}
            <div ref={scrollRef} className={`task-tabs-scroll ${fadeClass}`.trim()} onScroll={updateFade}>
              <div className="task-tabs-track" role="tablist" aria-label="Навігація по блоках">
                {Array.from({ length: blockCount! }, (_, i) => {
                  const isActive = i === activeBlock;
                  const checked = isBlockChecked?.(i);
                  const disabled = isBlockDisabled?.(i) ?? false;
                  const customLabel = labels?.[i];
                  const text = `${blockLabel} ${i + 1}`;
                  const a11yLabel = `${customLabel ? `${text}: ${customLabel}` : text}${checked ? ", перевірено" : ""}`;
                  return (
                    <button
                      key={i}
                      ref={(el) => {
                        tabRefs.current[i] = el;
                      }}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      aria-disabled={disabled || undefined}
                      aria-label={a11yLabel}
                      tabIndex={isActive ? 0 : -1}
                      onClick={() => !disabled && onChangeBlock!(i)}
                      onKeyDown={(e) => handleKeyDown(e, i)}
                      className={`block-tab ${isActive ? "block-tab--active" : "block-tab--inactive"}`}
                    >
                      {checked && <TabCheckIcon />}
                      {text}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Нижній рядок: кнопка "Перевірити блок" (checkButton — викликач передає
// готовий <button>, той самий елемент/обробник, що й раніше, лише
// вирваний з його старого місця всередині children — див. коментар у
// BlockNavigation нижче) + spacer + ←/→, усі в ОДНОМУ flex-рядку
// (ЕТАП M). flip-cards взагалі не оцінюється (checkButton там немає й не
// було) — цей компонент і сьогодні викликається без checkButton для
// такого випадку, просто не рендерить лівий слот.
export function BlockNavFooter({
  blockCount,
  activeBlock,
  onChangeBlock,
  checkButton,
}: {
  blockCount: number;
  activeBlock: number;
  onChangeBlock: (index: number) => void;
  checkButton?: ReactNode;
}) {
  if (blockCount <= 1) return null;

  const isFirst = activeBlock === 0;
  const isLast = activeBlock === blockCount - 1;

  return (
    <div className="exercise-bottom-row">
      {checkButton}
      <div className="exercise-bottom-row-spacer" />
      <button
        type="button"
        onClick={() => onChangeBlock(activeBlock - 1)}
        disabled={isFirst}
        aria-label="Попередній блок"
        className="exercise-block-prev-btn"
      >
        <ChevronIcon direction="left" size={18} />
      </button>
      <button
        type="button"
        onClick={() => onChangeBlock(activeBlock + 1)}
        disabled={isLast}
        aria-label="Далі"
        className="exercise-block-next-btn"
      >
        <span className="exercise-block-next-btn-label">Далі</span>
        {/* Кругла золота "плашка" під шеврон (градієнтний індиго-дизайн,
            та сама родина, що аудіоплеєр) — замінює голу іконку, яка
            раніше сиділа прямо в рядку кнопки. */}
        <span className="exercise-block-next-btn-badge">
          <ChevronIcon direction="right" size={16} />
        </span>
      </button>
    </div>
  );
}

// Навігація по блоках великої вправи (>10 елементів: matching, letter_gaps,
// letter_rearrangement, table_fill, word_search, crossword та інші
// gradable-типи — exercise-blocks.ts) — складає children + BlockNavFooter
// РАЗОМ в ОДНІЙ обгортці (div без власного flex/gap): виклик-сайт сидить
// усередині EXERCISE_STACK (flex flex-col gap-4 md:gap-6, spacing.ts) —
// якби ці дві частини були окремими дітьми ТІЄЇ Ж flex-обгортки, gap-4/
// gap-6 самого EXERCISE_STACK додавався б ПОВЕРХ margin-top самого футера
// (22px, CSS). Один спільний div без gap прибирає цей подвійний відступ.
// Прогрес-смужку (BlockSegments) більше НЕ малює цей компонент — виклик-
// сайт малює її сам усередині TaskPanelHeader (task-panel-header.tsx), НАД
// усім цим компонентом, разом із підписом "{label} N з M" і пілюлею балів.
//
// Кнопка "Перевірити блок" НЕ рендериться тут — вона й сьогодні лишається
// всередині children (кожен виклик-сайт малює її сам, одразу при своєму
// контенті блоку): у word_search.tsx/crossword.tsx всі блоки змонтовані
// одночасно, кожен ЗІ СВОЄЮ власною кнопкою/станом (приховані лише class
// hidden, не умовним рендером — власний стан блоку не можна втрачати при
// перемиканні), тож єдиного "активного" button угорі БЕЗ структурної
// переробки цих двох типів вивести неможливо. Щоб не переробляти механіку
// двох типів вправ заради суто презентаційної задачі, кнопка лишається на
// місці й лише перефарбовується (className на кожному виклик-сайті).
export function BlockNavigation({
  blockCount,
  activeBlock,
  onChangeBlock,
  summary,
  checkButton,
  hideFooter = false,
  children,
}: {
  blockCount: number;
  activeBlock: number;
  onChangeBlock: (index: number) => void;
  summary?: BlockNavigationSummary | null;
  // Кнопка "Перевірити блок" — викликач передає готовий елемент (той
  // самий onClick/disabled, що й раніше), цей компонент лише ставить
  // його в один рядок із ←/→ (BlockNavFooter вище).
  checkButton?: ReactNode;
  // true — crossword.tsx/word-search.tsx: там усі блоки змонтовані
  // одночасно, кожен зі СВОЄЮ кнопкою перевірки й локальним
  // pending/result (useExerciseCheck усередині блоку), тож рядок
  // check+←/→ там малює САМ активний блок (своя копія BlockNavFooter
  // поруч із власною кнопкою), а не цей компонент — щоб не рендерити
  // рядок двічі.
  hideFooter?: boolean;
  children: ReactNode;
}) {
  // Один блок — навігація не рендериться взагалі (той самий принцип, що й
  // раніше: виклик-сайти й сьогодні обходять BlockNavigation для плоского
  // списку без блоків; цей захист — лише додаткова гарантія на рівні самого
  // компонента).
  if (blockCount <= 1) {
    return <>{children}</>;
  }

  return (
    <>
      <div>
        {children}
        {!hideFooter && (
          <BlockNavFooter
            blockCount={blockCount}
            activeBlock={activeBlock}
            onChangeBlock={onChangeBlock}
            checkButton={checkButton}
          />
        )}
      </div>

      {summary && (
        <p
          className={`${RESULT_MESSAGE_CLASS} ${
            summary.correct ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          Загалом: {summary.correct ? "Правильно! ✓" : `${summary.score}%`}
          {summary.pointsPossible !== undefined && (
            <span className={`ml-2 ${SCORE_LABEL_CLASS}`}>
              ({summary.pointsEarned} з {summary.pointsPossible} {pluralizePoints(summary.pointsPossible)})
            </span>
          )}
        </p>
      )}
    </>
  );
}
