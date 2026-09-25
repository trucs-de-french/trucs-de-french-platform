"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { GripVertical, Copy, Trash2 } from "lucide-react";
import { deleteScene, duplicateScene, reorderScenes } from "@/app/admin/scenes/actions";
import { SubmitButton } from "@/components/submit-button";
import { arrayMove, computeInsertIndex, resolveDropSide, type DropSide } from "@/lib/sortable-list";

type Scene = { id: string; title: string };

// Той самий click-нейтральний drag-патерн, що й TaskDragList/LinkDragList:
// ручка — джерело drag, увесь <li> — ціль drop. Insert-семантика (не swap) —
// відпущена сцена стає рівно на місце, куди її кинули, решта зсувається (див.
// src/lib/sortable-list.ts). На відміну від TaskDragList, стрілки ↑/↓ тут НЕ
// лишені поряд із drag — свідома відмінність від того патерну (там стрілки —
// та сама операція, що drag на сусіда; тут drag повністю замінює стрілки, а
// не доповнює їх).
//
// useState(initialScenes) бере пропс лише як початкове значення — той самий
// компроміс, що в TaskDragList.
export function SceneDragList({
  productId,
  initialScenes,
}: {
  productId: string;
  initialScenes: Scene[];
}) {
  const [scenes, setScenes] = useState(initialScenes);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; side: DropSide } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function move(fromId: string, overId: string, side: DropSide) {
    const fromIndex = scenes.findIndex((s) => s.id === fromId);
    const overIndex = scenes.findIndex((s) => s.id === overId);
    if (fromIndex === -1 || overIndex === -1) return;
    const toIndex = computeInsertIndex(fromIndex, overIndex, side);
    if (toIndex === fromIndex) return;

    const prev = scenes;
    const next = arrayMove(scenes, fromIndex, toIndex);
    setScenes(next);
    setError(null);

    const result = await reorderScenes(
      productId,
      next.map((s) => s.id)
    );
    if (!result.ok) {
      setScenes(prev);
      setError(result.error ?? "Не вдалося зберегти новий порядок");
    }
  }

  return (
    <div>
      {error && (
        <p className="mb-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {scenes.map((scene) => (
          <li key={scene.id} className="relative">
            {dropTarget?.id === scene.id && dropTarget.side === "before" && (
              <span className="absolute -top-[5px] left-0 right-0 h-0.5 rounded-full bg-brand" aria-hidden />
            )}
            <div
              onDragOver={(e: DragEvent) => {
                e.preventDefault();
                if (draggingId === null) return;
                const side = resolveDropSide(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), "vertical");
                setDropTarget({ id: scene.id, side });
              }}
              onDragLeave={() => setDropTarget((p) => (p?.id === scene.id ? null : p))}
              onDragEnd={() => {
                setDraggingId(null);
                setDropTarget(null);
              }}
              onDrop={(e: DragEvent) => {
                e.preventDefault();
                const fromId = e.dataTransfer.getData("text/plain");
                if (fromId && dropTarget) void move(fromId, dropTarget.id, dropTarget.side);
                setDropTarget(null);
              }}
              className="flex items-center justify-between rounded-md border border-gray-100 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800"
            >
            <div className="flex items-center gap-2">
              <span
                draggable
                onDragStart={(e: DragEvent) => {
                  e.dataTransfer.setData("text/plain", scene.id);
                  setDraggingId(scene.id);
                }}
                className="cursor-grab select-none text-neutral-400 active:cursor-grabbing dark:text-neutral-500"
                aria-hidden
              >
                <GripVertical size={16} />
              </span>
              <Link
                href={`/admin/courses/${productId}/scenes/${scene.id}`}
                className="font-medium hover:underline"
              >
                {scene.title}
              </Link>
            </div>
            <div className="flex items-center gap-1">
              <form action={duplicateScene.bind(null, scene.id)}>
                <SubmitButton
                  pendingChildren="…"
                  aria-label="Копіювати сцену"
                  title="Копіювати"
                  className="rounded p-1.5 text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
                >
                  <Copy size={16} />
                </SubmitButton>
              </form>
              <form action={deleteScene.bind(null, scene.id)}>
                <SubmitButton
                  pendingChildren="…"
                  aria-label="Видалити сцену"
                  title="Видалити"
                  className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
                >
                  <Trash2 size={16} />
                </SubmitButton>
              </form>
            </div>
            </div>
            {dropTarget?.id === scene.id && dropTarget.side === "after" && (
              <span className="absolute -bottom-[5px] left-0 right-0 h-0.5 rounded-full bg-brand" aria-hidden />
            )}
          </li>
        ))}
      </ul>
      {scenes.length === 0 && (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Сцен ще немає.</p>
      )}
    </div>
  );
}
