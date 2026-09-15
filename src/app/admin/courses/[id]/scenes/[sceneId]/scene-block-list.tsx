"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import { GripVertical, Video, MessageSquare, Link2, ListChecks, type LucideIcon } from "lucide-react";
import { reorderSceneBlocks } from "@/app/admin/scenes/actions";

type Block = { type: string; label: string };

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
};

// Той самий click+drag swap-патерн, що й у студентській вправі reorder.tsx —
// клік на ручку однієї групи, потім клік на ручку іншої міняє їх місцями;
// drag-and-drop робить те саме через ручку-заголовок (не через весь блок,
// щоб не заважати виділенню тексту/роботі з полями всередині).
//
// ВАЖЛИВО: у useState тримаємо лише ПОРЯДОК ({type, label}), не сам вміст
// групи. Раніше сюди клали ще й content: ReactNode прямо в масив — і коли
// LinkDragList усередині цього content отримував новий key (після addLink +
// revalidatePath), SceneBlockList все одно рендерив свій старий, заморожений
// на першому монтуванні масив (бо порядок груп не змінювався, компонент не
// перемонтовувався) — новий LinkDragList просто ніколи не діставався до
// рендеру. contentByType передається окремим пропом і читається напряму на
// кожному рендері (не копіюється в стан), тож завжди свіжий незалежно від
// того, перемонтувався компонент чи ні.
export function SceneBlockList({
  sceneId,
  initialBlocks,
  contentByType,
}: {
  sceneId: string;
  initialBlocks: Block[];
  contentByType: Record<string, ReactNode>;
}) {
  const [blocks, setBlocks] = useState(initialBlocks);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function swap(fromType: string, toType: string) {
    if (fromType === toType) return;
    const fromIndex = blocks.findIndex((b) => b.type === fromType);
    const toIndex = blocks.findIndex((b) => b.type === toType);
    if (fromIndex === -1 || toIndex === -1) return;

    const prev = blocks;
    const next = [...blocks];
    [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
    setBlocks(next);
    setError(null);

    // Оптимістичне оновлення — але якщо запис у базу не вдався (напр. RLS
    // мовчки відхилив), відкочуємо локальний порядок назад, інакше адмінка
    // виглядала б "перетягнутою", а насправді нічого не зберіглось.
    const result = await reorderSceneBlocks(sceneId, next.map((b) => b.type));
    if (!result.ok) {
      setBlocks(prev);
      setError(result.error ?? "Не вдалося зберегти новий порядок");
    }
  }

  function clickHandle(type: string) {
    if (selected === null) {
      setSelected(type);
    } else if (selected === type) {
      setSelected(null);
    } else {
      void swap(selected, type);
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
        const color = BLOCK_COLORS[block.type];
        const BlockIcon = color?.icon;
        return (
        <div
          key={block.type}
          onDragOver={(e: DragEvent) => e.preventDefault()}
          onDragEnter={(e: DragEvent) => {
            e.preventDefault();
            setDragOver(block.type);
          }}
          onDragLeave={() => setDragOver((prev) => (prev === block.type ? null : prev))}
          onDrop={(e: DragEvent) => {
            e.preventDefault();
            setDragOver(null);
            const fromType = e.dataTransfer.getData("text/plain");
            if (fromType) void swap(fromType, block.type);
          }}
          className={`rounded-lg border border-t-4 bg-white p-4 shadow-sm transition-colors dark:bg-neutral-800 ${
            dragOver === block.type
              ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
              : `border-gray-100 dark:border-neutral-700 ${color?.border ?? ""}`
          }`}
        >
          <button
            type="button"
            draggable
            onDragStart={(e: DragEvent) => e.dataTransfer.setData("text/plain", block.type)}
            onClick={() => clickHandle(block.type)}
            className={`mb-3 flex w-full cursor-grab items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-sm font-semibold shadow-sm shadow-cyan-100/50 active:cursor-grabbing dark:shadow-none ${
              selected === block.type
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
                className={`mr-1.5 shrink-0 ${color?.iconColor ?? "text-neutral-400 dark:text-neutral-500"}`}
                aria-hidden
              />
            )}
            {block.label}
          </button>
          {contentByType[block.type]}
        </div>
        );
      })}
    </div>
  );
}
