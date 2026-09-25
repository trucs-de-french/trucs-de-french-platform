"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  GripVertical,
  Video,
  MessageSquare,
  Link2,
  ListChecks,
  BookOpen,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from "lucide-react";
import { reorderSceneBlocks } from "@/app/admin/scenes/actions";
import { SCENE_CONTENT_BLOCK_ICON, SCENE_CONTENT_BLOCK_COLORS } from "@/lib/exercises/task-type-meta";
import { blockDomId } from "@/lib/block-dom-id";
import { arrayMove, computeInsertIndex, resolveDropSide, type DropSide } from "@/lib/sortable-list";
import { BUTTON_SECONDARY_SM } from "@/lib/button-styles";
import { Z_STICKY_HEADER } from "@/lib/z-layers";

// refId — null для 4 фіксованих типів (video/script/link/task, рівно один
// на сцену); для type === "content" — id самого scene_content_blocks-рядка,
// що відрізняє один довільний блок від іншого (їх може бути скільки
// завгодно, на відміну від фіксованих). contentType — лише для "content"
// (text/audio/video/embed/script/links, домен SCENE_CONTENT_BLOCK_*, НЕ
// TASK_GROUP_CONTENT_* — той про інший домен, task_groups.content_type),
// визначає іконку/колір цього конкретного блоку.
type Block = { type: string; refId: string | null; label: string; contentType?: string };

// Унікальний ключ блоку для React key/DnD/lookup — type сам по собі більше
// не унікальний для "content" (кількох блоків із цим типом може бути кілька
// на одну сцену), тому ключ = refId, коли він є, інакше type.
function blockKey(block: Block): string {
  return block.refId ? `content:${block.refId}` : block.type;
}

// localStorage-backed collapsedKeys (переживає перезавантаження сторінки,
// на відміну від sessionStorage раніше) — через useSyncExternalStore, не
// useState+useEffect: сховище недоступне під час SSR, тож просте
// "прочитати в ефекті й setState" дало б і hydration mismatch (сервер
// рендерить дефолт, клієнтський перший рендер — уже інше), і саму лінтер-
// помилку react-hooks/set-state-in-effect. useSyncExternalStore — офіційно
// призначений саме для синхронізації зі сховищем, недоступним на сервері
// (getServerSnapshot повертає null — SSR завжди бачить лише дефолт).
// Підписка — власний мінімальний pub-sub (не подія "storage": та не
// спрацьовує для змін у тій самій вкладці, яка сама їх і зробила).
// try/catch навколо кожного звернення до localStorage — якщо сховище
// недоступне (приватний режим тощо), поведінка як без збереження взагалі
// (дефолтний collapsedKeys щоразу), без падіння.
function useCollapsedKeys(storageKey: string, defaultKeys: () => Set<string>) {
  const listenersRef = useRef(new Set<() => void>());

  const subscribe = useCallback((onStoreChange: () => void) => {
    listenersRef.current.add(onStoreChange);
    return () => listenersRef.current.delete(onStoreChange);
  }, []);

  const getSnapshot = useCallback(() => {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  }, [storageKey]);

  const getServerSnapshot = useCallback(() => null, []);

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const collapsedKeys = useMemo(() => {
    if (raw == null) return defaultKeys();
    try {
      return new Set<string>(JSON.parse(raw) as string[]);
    } catch {
      return defaultKeys();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  function setCollapsedKeys(updater: (prev: Set<string>) => Set<string>) {
    const next = updater(collapsedKeys);
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      // сховище недоступне (приватний режим тощо) — далі не пишемо, але й
      // не падаємо
    }
    listenersRef.current.forEach((onStoreChange) => onStoreChange());
  }

  return [collapsedKeys, setCollapsedKeys] as const;
}

// Колір за типом БЛОКУ сцени (video/script/link/task) — інший, паралельний
// домен, ніж CATEGORY_COLORS у task-type-meta.ts (там кольори за
// категорією ТИПУ ВПРАВИ, тут — за фіксованим набором із 4 блоків самої
// сцени). Не варто ані розширювати task-type-meta.ts, ані виносити цю мапу
// в окремий спільний файл — єдиний споживач саме цей компонент.
//
// border — колір верхньої лінії картки (border-t-4); iconColor — той самий
// колір на іконці типу блоку. Картка лишається білою/нейтральною (без
// кольорового відтінку фону) — кольорові лише лінія й іконка. iconColor без
// dark-варіанту — той самий принцип, що iconText у TASK_TYPE_COLORS
// (task-type-meta.ts): кольорова іконка на нейтральному фоні картки не
// потребує окремого відтінку для темної теми.
const BLOCK_COLORS: Record<string, { icon: LucideIcon; border: string; iconColor: string }> = {
  video: {
    icon: Video,
    border: "border-t-violet-500",
    iconColor: "text-violet-500",
  },
  script: {
    icon: MessageSquare,
    border: "border-t-teal-500",
    iconColor: "text-teal-500",
  },
  // Link2, не PlayCircle — блок веде на зовнішні тренажери (Quizlet/
  // Wordwall), той самий глиф, що вже для типу вправи "link" у
  // task-type-meta.ts.
  link: {
    icon: Link2,
    border: "border-t-green-500",
    iconColor: "text-green-500",
  },
  task: {
    icon: ListChecks,
    border: "border-t-amber-500",
    iconColor: "text-amber-500",
  },
  vocab: {
    icon: BookOpen,
    border: "border-t-rose-500",
    iconColor: "text-rose-500",
  },
};

// Той самий click+drag insert-патерн, що й у студентському SortableTileRow —
// клік на ручку однієї групи, потім клік на ручку іншої ставить першу рівно
// на місце другої (arrayMove); drag-and-drop робить те саме через
// ручку-заголовок (не через весь блок, щоб не заважати виділенню тексту/
// роботі з полями всередині), з визначенням "до"/"після" за верхньою/
// нижньою половиною картки під курсором (src/lib/sortable-list.ts).
//
// ВАЖЛИВО: у useState тримаємо лише ПОРЯДОК ({type, refId, label}), не сам
// вміст групи. Раніше сюди клали ще й content: ReactNode прямо в масив — і
// коли LinkDragList усередині цього content отримував новий key (після
// addLink + revalidatePath), SceneBlockList все одно рендерив свій старий,
// заморожений на першому монтуванні масив (бо порядок груп не змінювався,
// компонент не перемонтовувався) — новий LinkDragList просто ніколи не
// діставався до рендеру. contentByKey передається окремим пропом і
// читається напряму на кожному рендері (не копіюється в стан), тож завжди
// свіжий незалежно від того, перемонтувався компонент чи ні.
export function SceneBlockList({
  sceneId,
  initialBlocks,
  contentByKey,
}: {
  sceneId: string;
  initialBlocks: Block[];
  contentByKey: Record<string, ReactNode>;
}) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [selected, setSelected] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ key: string; side: DropSide } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Акордеон-згортання — суто візуальне (Tailwind "hidden", не умовний
  // рендер): контент кожного блоку лишається змонтованим, коли згорнутий,
  // щоб не скидати внутрішній стан (DialogueEditor/VocabTable через
  // DialogueStateProvider, LinkDragList, TaskDragList тощо) і щоб приховані
  // форми й надалі коректно сабмітились через requestSubmit() ("Зберегти
  // все"). Зберігається в localStorage по сцені (useCollapsedKeys вище) —
  // переживає не лише redirect() назад із "+ Нова задача" (окрема сторінка
  // /tasks/new), а й повне перезавантаження сторінки.
  const [collapsedKeys, setCollapsedKeys] = useCollapsedKeys(
    `scene-blocks-collapsed:${sceneId}`,
    () => new Set(initialBlocks.map(blockKey))
  );
  // Для scrollIntoView з кнопки "Згорнути" — той самий DOM-вузол, що вже
  // має id/scroll-mt-4 для якорів (#content-{id} тощо), лише прямий ref
  // замість getElementById, щоб не залежати від того, чи вже змонтовано.
  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function toggleCollapsed(key: string) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function collapseAndScrollToHeader(key: string) {
    toggleCollapsed(key);
    blockRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function collapseAll() {
    setCollapsedKeys(() => new Set(blocks.map(blockKey)));
  }

  function expandAll() {
    setCollapsedKeys(() => new Set());
  }

  // Перехід за якорем (#content-{id}, #task тощо — з redirect() дій вправ/
  // блоку чи прямого посилання) має показати цільовий блок РОЗГОРНУТИМ,
  // навіть якщо він був згорнутий раніше — інакше посилання приводить на
  // порожній заголовок без видимого вмісту. Ефект (не читання хеша прямо в
  // рендері) — location.hash доступний лише на клієнті, а сам вибір, який
  // блок розгорнути, не впливає на СЕРВЕРНИЙ рендер, тож без ризику
  // hydration-розбіжності: перший клієнтський рендер іще бачить дефолтний
  // collapsedKeys, ефект одразу після монтування виправляє його.
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;
    const target = blocks.find((b) => blockDomId(blockKey(b)) === hash);
    if (!target) return;
    const targetKey = blockKey(target);
    setCollapsedKeys((prev) => {
      if (!prev.has(targetKey)) return prev;
      const next = new Set(prev);
      next.delete(targetKey);
      return next;
    });
    // Лише на монтуванні (перехід за якорем стається один раз на завантаження
    // сторінки) — не на кожну зміну blocks/collapsedKeys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function moveByIndex(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex === -1 || toIndex === -1) return;

    const prev = blocks;
    const next = arrayMove(blocks, fromIndex, toIndex);
    setBlocks(next);
    setError(null);

    // Оптимістичне оновлення — але якщо запис у базу не вдався (напр. RLS
    // мовчки відхилив), відкочуємо локальний порядок назад, інакше адмінка
    // виглядала б "перетягнутою", а насправді нічого не зберіглось.
    const result = await reorderSceneBlocks(
      sceneId,
      next.map((b) => ({ type: b.type, refId: b.refId }))
    );
    if (!result.ok) {
      setBlocks(prev);
      setError(result.error ?? "Не вдалося зберегти новий порядок");
    }
  }

  async function move(fromKey: string, overKey: string, side: DropSide) {
    const fromIndex = blocks.findIndex((b) => blockKey(b) === fromKey);
    const overIndex = blocks.findIndex((b) => blockKey(b) === overKey);
    if (fromIndex === -1 || overIndex === -1) return;
    await moveByIndex(fromIndex, computeInsertIndex(fromIndex, overIndex, side));
  }

  function clickHandle(key: string) {
    if (selected === null) {
      setSelected(key);
    } else if (selected === key) {
      setSelected(null);
    } else {
      const fromIndex = blocks.findIndex((b) => blockKey(b) === selected);
      const toIndex = blocks.findIndex((b) => blockKey(b) === key);
      void moveByIndex(fromIndex, toIndex);
      setSelected(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={collapseAll}
          className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
        >
          Згорнути всі
        </button>
        <button
          type="button"
          onClick={expandAll}
          className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
        >
          Розгорнути всі
        </button>
      </div>
      {blocks.map((block) => {
        const key = blockKey(block);
        const isContent = block.type === "content";
        const BlockIcon = isContent
          ? SCENE_CONTENT_BLOCK_ICON[block.contentType ?? ""]
          : BLOCK_COLORS[block.type]?.icon;
        const border = isContent
          ? SCENE_CONTENT_BLOCK_COLORS[block.contentType ?? ""]?.border
          : BLOCK_COLORS[block.type]?.border;
        const iconColor = isContent
          ? SCENE_CONTENT_BLOCK_COLORS[block.contentType ?? ""]?.iconColor
          : BLOCK_COLORS[block.type]?.iconColor;
        return (
        <div
          key={key}
          id={blockDomId(key)}
          ref={(el) => {
            blockRefs.current[key] = el;
          }}
          className="relative scroll-mt-4"
        >
          {dropTarget?.key === key && dropTarget.side === "before" && (
            <span className="absolute -top-[7px] left-0 right-0 h-0.5 rounded-full bg-brand" aria-hidden />
          )}
          <div
            onDragOver={(e: DragEvent) => {
              e.preventDefault();
              if (draggingKey === null) return;
              const side = resolveDropSide(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), "vertical");
              setDropTarget({ key, side });
            }}
            onDragLeave={() => setDropTarget((prev) => (prev?.key === key ? null : prev))}
            onDragEnd={() => {
              setDraggingKey(null);
              setDropTarget(null);
            }}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              const fromKey = e.dataTransfer.getData("text/plain");
              if (fromKey && dropTarget) void move(fromKey, dropTarget.key, dropTarget.side);
              setDropTarget(null);
            }}
            className={`rounded-lg border border-t-4 bg-white p-4 shadow-sm dark:bg-neutral-800 border-gray-100 dark:border-neutral-700 ${border ?? ""}`}
          >
          {/* Липкий заголовок — top-4 узгоджено зі scroll-mt-4 вище (той
              самий 1rem-відступ, куди й так "приземляється" перехід за
              якорем/scrollIntoView), тож немає видимого "стрибка" між
              позицією після скролу й позицією прилипання. Прилипає лише в
              межах цього блоку — sticky виходить за екран разом із рештою
              картки, щойно вона проскролюється повз. Власний bg + тінь, щоб
              вміст блоку, який ковзає під заголовком, не проступав крізь
              нього. Z_STICKY_HEADER (не голе z-10) — щоб не опинитись НАД
              нижньою панеллю дій (Z_ACTION_BAR): обидва — position:sticky
              без спільного стекінг-контексту між ними, тож порівнюються
              напряму за z-index, не за DOM-порядком. */}
          <div
            className={`sticky top-4 ${Z_STICKY_HEADER} -mx-4 -mt-4 mb-3 flex items-center gap-2 rounded-t-lg bg-white px-4 pb-3 pt-4 shadow-[0_1px_3px_rgba(0,0,0,0.08)] dark:bg-neutral-800`}
          >
            <button
              type="button"
              draggable
              onDragStart={(e: DragEvent) => {
                e.dataTransfer.setData("text/plain", key);
                setDraggingKey(key);
              }}
              onClick={() => clickHandle(key)}
              className={`flex flex-1 cursor-grab items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-sm font-semibold shadow-sm shadow-cyan-100/50 active:cursor-grabbing dark:shadow-none ${
                selected === key
                  ? "border-brand bg-brand/5 dark:border-brand dark:bg-neutral-800"
                  : "border-gray-200 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              }`}
            >
              <span className="mr-1.5 inline-flex align-text-bottom" aria-hidden>
                <GripVertical size={14} />
              </span>
              {BlockIcon && (
                <BlockIcon
                  size={14}
                  className={`mr-1.5 shrink-0 ${iconColor ?? "text-neutral-400 dark:text-neutral-500"}`}
                  aria-hidden
                />
              )}
              {block.label}
            </button>
            <button
              type="button"
              onClick={() => toggleCollapsed(key)}
              aria-label={collapsedKeys.has(key) ? "Розгорнути блок" : "Згорнути блок"}
              title={collapsedKeys.has(key) ? "Розгорнути" : "Згорнути"}
              className="shrink-0 rounded p-1.5 text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
            >
              <ChevronDown
                size={16}
                className={`transition-transform ${collapsedKeys.has(key) ? "" : "rotate-180"}`}
              />
            </button>
          </div>
          <div className={collapsedKeys.has(key) ? "hidden" : ""}>
            {contentByKey[key]}
            {/* Завжди, не лише для "помітно довгих" блоків — визначити
                реальну відрендерену висоту тут довелось би виміром DOM
                (ResizeObserver на кожен блок), а вміст contentByKey —
                непрозорий ReactNode (DialogueEditor/VocabTable/TaskDragList/
                довільні content-блоки), тож надійно виміряти складно й не
                варте цього заради дрібної косметики: кнопка на короткому
                блоці — не завада, довгий блок без неї — реальна незручність. */}
            <button
              type="button"
              onClick={() => collapseAndScrollToHeader(key)}
              className={`mt-3 inline-flex items-center gap-1.5 ${BUTTON_SECONDARY_SM}`}
            >
              <ChevronUp size={14} />
              Згорнути
            </button>
          </div>
          </div>
          {dropTarget?.key === key && dropTarget.side === "after" && (
            <span className="absolute -bottom-[7px] left-0 right-0 h-0.5 rounded-full bg-brand" aria-hidden />
          )}
        </div>
        );
      })}
    </div>
  );
}
