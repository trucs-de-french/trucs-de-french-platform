"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { formatPoints } from "@/lib/exercises/format-points";

function ChevronIcon({
  direction,
  size,
  strokeWidth = 2.6,
}: {
  direction: "left" | "right";
  size: number;
  strokeWidth?: number;
}) {
  const d = direction === "left" ? "M12.5 4.5 7 10l5.5 5.5" : "M7 3.5 12.5 9 7 14.5";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Відстань, яку лишаємо під круглу стрілку (28px + відступ від краю),
// щоб авто-скрол не ставив активну вкладку рівно під кнопку, коли вона
// показана (fade.left/right — та сама умова, що й показ самої стрілки).
const TAB_SCROLL_EDGE_MARGIN = 24;
const TAB_SCROLL_ARROW_ALLOWANCE = 34;

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

  // Горизонтальний скрол ЛИШЕ самого скролера (scrollTo з offsetLeft/
  // offsetWidth) — НЕ scrollIntoView, який міг би зсунути всю сторінку
  // вертикально. Відступ від краю більший, коли з того боку показана
  // кругла стрілка (інакше активна вкладка опиняється рівно під нею).
  useEffect(() => {
    if (!hasTabs) return;
    const scroller = scrollRef.current;
    const tab = tabRefs.current[activeBlock];
    if (!scroller || !tab) return;

    const leftOverflow = scroller.scrollLeft > 1;
    const rightOverflow = scroller.scrollLeft < scroller.scrollWidth - scroller.clientWidth - 1;
    const leftMargin = TAB_SCROLL_EDGE_MARGIN + (leftOverflow ? TAB_SCROLL_ARROW_ALLOWANCE : 0);
    const rightMargin = TAB_SCROLL_EDGE_MARGIN + (rightOverflow ? TAB_SCROLL_ARROW_ALLOWANCE : 0);

    const tabLeft = tab.offsetLeft;
    const tabRight = tabLeft + tab.offsetWidth;
    const viewLeft = scroller.scrollLeft;
    const viewRight = viewLeft + scroller.clientWidth;

    let target: number | null = null;
    if (tabLeft - leftMargin < viewLeft) {
      target = tabLeft - leftMargin;
    } else if (tabRight + rightMargin > viewRight) {
      target = tabRight + rightMargin - scroller.clientWidth;
    }
    if (target != null) {
      scroller.scrollTo({ left: Math.max(0, target), behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
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
    const ro = new ResizeObserver(() => updateFade());
    ro.observe(el);
    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
    };
  }, [hasTabs, blockCount]);

  function scrollByDirection(direction: "left" | "right") {
    const el = scrollRef.current;
    if (!el) return;
    const delta = el.clientWidth * 0.6;
    const left = direction === "left" ? el.scrollLeft - delta : el.scrollLeft + delta;
    el.scrollTo({ left, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

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
            <div className="task-tabs-wrap">
              {fade.left && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Прокрутити вкладки блоків ліворуч"
                  className="tabs-scroll-arrow tabs-scroll-arrow--left"
                  onClick={() => scrollByDirection("left")}
                >
                  <ChevronIcon direction="left" size={14} strokeWidth={2.4} />
                </button>
              )}
              <div ref={scrollRef} className={`task-tabs-scroll ${fadeClass}`.trim()} onScroll={updateFade}>
                <div className="task-tabs-track" role="tablist" aria-label="Навігація по блоках">
                  {Array.from({ length: blockCount! }, (_, i) => {
                    const isActive = i === activeBlock;
                    const checked = isBlockChecked?.(i);
                    const disabled = isBlockDisabled?.(i) ?? false;
                    const customLabel = labels?.[i];
                    const text = `${blockLabel} ${i + 1}`;
                    const a11yLabel = `${customLabel ? `${text}: ${customLabel}` : text}${checked ? ", виконано" : ""}`;
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
                        {isActive ? text : String(i + 1)}
                      </button>
                    );
                  })}
                </div>
              </div>
              {fade.right && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Прокрутити вкладки блоків праворуч"
                  className="tabs-scroll-arrow tabs-scroll-arrow--right"
                  onClick={() => scrollByDirection("right")}
                >
                  <ChevronIcon direction="right" size={14} strokeWidth={2.4} />
                </button>
              )}
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
export type TaskBlockResult = { correct: boolean; pointsEarned?: number; pointsPossible?: number };

export function BlockNavigation({
  blockCount,
  activeBlock,
  onChangeBlock,
  blockResults,
  checkButton,
  hideFooter = false,
  children,
}: {
  blockCount: number;
  activeBlock: number;
  onChangeBlock: (index: number) => void;
  // per-блок GradeResult (той самий стан, що вже тримає кожен виклик-сайт,
  // напр. table-fill.tsx: Record<number, TableFillResult>) — лише для
  // плиток підсумку нижче, жодної нової логіки підрахунку.
  blockResults?: Record<number, TaskBlockResult>;
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
  // contentRef — обгортка навколо children (сам контент активного блоку).
  // contentRef.current.parentElement — це сам div.EXERCISE_STACK, яким
  // кожен виклик-сайт (table-fill.tsx, letter-gaps.tsx тощо) обгортає
  // РАЗОМ BlockTabs (вкладки блоків нагорі) + TaskPanelHeader (заголовок/
  // інструкція) + сам BlockNavigation: contentRef і TaskSummaryCard нижче
  // повертаються як фрагмент (без власного DOM-вузла), тож їхній спільний
  // батько в DOM — це і є той зовнішній контейнер вправи. Скрол до НЬОГО
  // (а не до contentRef) показує студенту вкладки+заголовок+початок блоку,
  // а не середину — саме це мало зламатись при зміні блоку великим вмістом.
  const contentRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(false);

  // Єдина точка скролу для БУДЬ-ЯКОГО перемикання блоку (вкладки BlockTabs
  // нагорі, кнопки ←/→ у BlockNavFooter, плитки картки "Підсумок завдання"
  // нижче) — усі три керують тим самим `activeBlock` пропсом, тож ефект,
  // підписаний на нього, спрацьовує однаково незалежно від контролу. Ефект
  // (а не скрол одразу в обробнику кліку) спрацьовує ПІСЛЯ коміту нового
  // DOM — висота нового блоку вже врахована в getBoundingClientRect.
  // Скролимо лише якщо початок вправи вже НЕ видний (rect.top < 0 — той
  // самий критерій, що вже є в scene-header-bar.tsx:scrollToHeaderAndFocus);
  // якщо він і так у вʼюпорті — не чіпаємо скрол узагалі.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const container = contentRef.current?.parentElement ?? contentRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.top >= 0) return;
    // Запас під можливий майбутній sticky-бар нагорі сторінки (сьогодні
    // такого бару немає на студентській сторінці сцени — перевірено,
    // немає sticky/fixed top у layout.tsx/компонентах), той самий кушон,
    // що вже застосовано в scene-header-bar.tsx (HEADER_SCROLL_MARGIN_PX).
    container.style.scrollMarginTop = "12px";
    container.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  }, [activeBlock]);

  // Один блок — навігація не рендериться взагалі (той самий принцип, що й
  // раніше: виклик-сайти й сьогодні обходять BlockNavigation для плоского
  // списку без блоків; цей захист — лише додаткова гарантія на рівні самого
  // компонента).
  if (blockCount <= 1) {
    return <>{children}</>;
  }

  return (
    <>
      <div ref={contentRef}>
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

      {blockResults && Object.keys(blockResults).length > 0 && (
        <TaskSummaryCard
          blockCount={blockCount}
          blockResults={blockResults}
          activeBlock={activeBlock}
          onChangeBlock={onChangeBlock}
        />
      )}
    </>
  );
}

// Картка "Підсумок завдання" — замінює колишні дві паралельні лінії
// ("Загалом: N% (X з Y балів)" тут і, в іншому компоненті, "Підсумок
// блоку") для tasks із 2+ блоками: сума БАЛІВ лише по вже перевірених
// блоках (неперевірені не входять у суму) + плитка на кожен блок. Плитки —
// РЕАЛЬНІ кнопки (onChangeBlock — той самий перемикач, що вкладки блоків
// угорі панелі): клік перемикає activeBlock, а скрол до початку вправи
// (якщо він поза видимою зоною) робить спільний ефект у BlockNavigation
// вище, однаковий для вкладок/←→/цих плиток — стан блоку
// (відповіді/перевірка/підказки) НЕ перераховується й НЕ втрачається,
// бо він і так тримається в per-блок мапах виклик-сайту (blockResults
// тощо), а не локально тут.
function TaskSummaryCard({
  blockCount,
  blockResults,
  activeBlock,
  onChangeBlock,
}: {
  blockCount: number;
  blockResults: Record<number, TaskBlockResult>;
  activeBlock: number;
  onChangeBlock: (index: number) => void;
}) {
  const checked = Object.values(blockResults);
  const sumEarned = checked.reduce((sum, r) => sum + (r.pointsEarned ?? 0), 0);
  const sumPossible = checked.reduce((sum, r) => sum + (r.pointsPossible ?? 0), 0);

  return (
    <div className="task-result-card task-summary-card">
      <div className="task-summary-top">
        <span className="task-summary-title">Підсумок завдання</span>
        {sumPossible > 0 && (
          <span className="task-summary-total-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#b8902f" aria-hidden="true">
              <path d="M12 2l2.9 6.6 7.1.7-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.3l7.1-.7z" />
            </svg>
            Загалом: {formatPoints(sumEarned, sumPossible)}
          </span>
        )}
      </div>
      <div className="task-summary-tiles">
        {Array.from({ length: blockCount }, (_, i) => {
          const isActive = i === activeBlock;
          const r = blockResults[i];
          if (!r) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => onChangeBlock(i)}
                aria-current={isActive ? "true" : undefined}
                className={`task-summary-tile task-summary-tile--pending ${
                  isActive ? "task-summary-tile--active" : ""
                }`}
              >
                Блок {i + 1} — —
              </button>
            );
          }
          const possible = r.pointsPossible ?? 0;
          const earned = r.pointsEarned ?? 0;
          const full = possible > 0 ? earned >= possible : r.correct;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChangeBlock(i)}
              aria-current={isActive ? "true" : undefined}
              className={`task-summary-tile ${full ? "task-summary-tile--success" : "task-summary-tile--warn"} ${
                isActive ? "task-summary-tile--active" : ""
              }`}
            >
              Блок {i + 1} <span className="task-summary-tile-value">{earned}/{possible}</span>
              {full ? " ✓" : ""}
            </button>
          );
        })}
      </div>
    </div>
  );
}
