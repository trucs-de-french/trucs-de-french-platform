"use client";

import { useState, type DragEvent, type ReactNode } from "react";
import { reorderSceneBlocks } from "@/app/admin/scenes/actions";

type Block = { type: string; label: string };

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
      {blocks.map((block) => (
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
          className={`rounded-md border-2 p-3 transition-colors ${
            dragOver === block.type
              ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
              : "border-transparent"
          }`}
        >
          <button
            type="button"
            draggable
            onDragStart={(e: DragEvent) => e.dataTransfer.setData("text/plain", block.type)}
            onClick={() => clickHandle(block.type)}
            className={`mb-3 flex w-full cursor-grab items-center gap-2 rounded-md border px-3 py-1.5 text-left text-sm font-semibold active:cursor-grabbing ${
              selected === block.type
                ? "border-black bg-neutral-100 dark:border-white dark:bg-neutral-800"
                : "hover:bg-neutral-50 dark:hover:bg-neutral-800"
            }`}
          >
            <span aria-hidden>⠿</span> {block.label}
          </button>
          {contentByType[block.type]}
        </div>
      ))}
    </div>
  );
}
