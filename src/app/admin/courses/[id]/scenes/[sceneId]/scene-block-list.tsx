"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore, type DragEvent, type ReactNode } from "react";
import { GripVertical, Video, MessageSquare, Link2, ListChecks, BookOpen, ChevronDown, type LucideIcon } from "lucide-react";
import { reorderSceneBlocks } from "@/app/admin/scenes/actions";
import { SCENE_CONTENT_BLOCK_ICON, SCENE_CONTENT_BLOCK_COLORS } from "@/lib/exercises/task-type-meta";
import { blockDomId } from "./block-dom-id";

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

// sessionStorage-backed collapsedKeys — через useSyncExternalStore, не
// useState+useEffect: sessionStorage недоступний під час SSR, тож просте
// "прочитати в ефекті й setState" дало б і hydration mismatch (сервер
// рендерить дефолт, клієнтський перший рендер — уже інше), і саму лінтер-
// помилку react-hooks/set-state-in-effect. useSyncExternalStore — офіційно
// призначений саме для синхронізації зі сховищем, недоступним на сервері
// (getServerSnapshot повертає null — SSR завжди бачить лише дефолт).
// Підписка — власний мінімальний pub-sub (не подія "storage": та не
// спрацьовує для змін у тій самій вкладці, яка сама їх і зробила).
function useCollapsedKeys(storageKey: string, defaultKeys: () => Set<string>) {
  const listenersRef = useRef(new Set<() => void>());

  const subscribe = useCallback((onStoreChange: () => void) => {
    listenersRef.current.add(onStoreChange);
    return () => listenersRef.current.delete(onStoreChange);
  }, []);

  const getSnapshot = useCallback(() => {
    try {
      return sessionStorage.getItem(storageKey);
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
      sessionStorage.setItem(storageKey, JSON.stringify([...next]));
    } catch {
      // sessionStorage недоступний (приватний режим тощо) — далі не пишемо,
      // але й не падаємо
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

// Той самий click+drag swap-патерн, що й у студентській вправі reorder.tsx —
// клік на ручку однієї групи, потім клік на ручку іншої міняє їх місцями;
// drag-and-drop робить те саме через ручку-заголовок (не через весь блок,
// щоб не заважати виділенню тексту/роботі з полями всередині).
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
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Акордеон-згортання — суто візуальне (Tailwind "hidden", не умовний
  // рендер): контент кожного блоку лишається змонтованим, коли згорнутий,
  // щоб не скидати внутрішній стан (DialogueEditor/VocabTable через
  // DialogueStateProvider, LinkDragList, TaskDragList тощо) і щоб приховані
  // форми й надалі коректно сабмітились через requestSubmit() ("Зберегти
  // все"). Зберігається в sessionStorage по сцені (useCollapsedKeys вище) —
  // щоб redirect() назад із "+ Нова задача" (окрема сторінка /tasks/new) не
  // скидав акордеон до дефолту "усе згорнуто", а повертав саме той стан,
  // який був перед переходом.
  const [collapsedKeys, setCollapsedKeys] = useCollapsedKeys(
    `scene-blocks-collapsed:${sceneId}`,
    () => new Set(initialBlocks.map(blockKey))
  );

  function toggleCollapsed(key: string) {
    setCollapsedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function swap(fromKey: string, toKey: string) {
    if (fromKey === toKey) return;
    const fromIndex = blocks.findIndex((b) => blockKey(b) === fromKey);
    const toIndex = blocks.findIndex((b) => blockKey(b) === toKey);
    if (fromIndex === -1 || toIndex === -1) return;

    const prev = blocks;
    const next = [...blocks];
    [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
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

  function clickHandle(key: string) {
    if (selected === null) {
      setSelected(key);
    } else if (selected === key) {
      setSelected(null);
    } else {
      void swap(selected, key);
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
          onDragOver={(e: DragEvent) => e.preventDefault()}
          onDragEnter={(e: DragEvent) => {
            e.preventDefault();
            setDragOver(key);
          }}
          onDragLeave={() => setDragOver((prev) => (prev === key ? null : prev))}
          onDrop={(e: DragEvent) => {
            e.preventDefault();
            setDragOver(null);
            const fromKey = e.dataTransfer.getData("text/plain");
            if (fromKey) void swap(fromKey, key);
          }}
          className={`rounded-lg border border-t-4 bg-white p-4 shadow-sm transition-colors dark:bg-neutral-800 ${
            dragOver === key
              ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
              : `border-gray-100 dark:border-neutral-700 ${border ?? ""}`
          }`}
        >
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              draggable
              onDragStart={(e: DragEvent) => e.dataTransfer.setData("text/plain", key)}
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
          <div className={collapsedKeys.has(key) ? "hidden" : ""}>{contentByKey[key]}</div>
        </div>
        );
      })}
    </div>
  );
}
