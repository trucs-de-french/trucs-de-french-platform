"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { GripVertical, Copy, Trash2 } from "lucide-react";
import { deleteScene, duplicateScene, reorderScenes } from "@/app/admin/scenes/actions";
import { SubmitButton } from "@/components/submit-button";

type Scene = { id: string; title: string };

// Той самий click-нейтральний drag-патерн, що й TaskDragList/LinkDragList:
// ручка — джерело drag, увесь <li> — ціль drop, swap-семантика. На відміну
// від TaskDragList, стрілки ↑/↓ тут НЕ лишені поряд із drag — свідома
// відмінність від того патерну (там стрілки — та сама операція, що drag на
// сусіда; тут drag повністю замінює стрілки, а не доповнює їх).
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
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function swap(fromId: string, toId: string) {
    if (fromId === toId) return;
    const fromIndex = scenes.findIndex((s) => s.id === fromId);
    const toIndex = scenes.findIndex((s) => s.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;

    const prev = scenes;
    const next = [...scenes];
    [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
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
          <li
            key={scene.id}
            onDragOver={(e: DragEvent) => e.preventDefault()}
            onDragEnter={(e: DragEvent) => {
              e.preventDefault();
              setDragOver(scene.id);
            }}
            onDragLeave={() => setDragOver((p) => (p === scene.id ? null : p))}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              setDragOver(null);
              const fromId = e.dataTransfer.getData("text/plain");
              if (fromId) void swap(fromId, scene.id);
            }}
            className={`flex items-center justify-between rounded-md border p-3 transition-colors ${
              dragOver === scene.id
                ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
                : "bg-white dark:bg-neutral-800"
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                draggable
                onDragStart={(e: DragEvent) => e.dataTransfer.setData("text/plain", scene.id)}
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
          </li>
        ))}
      </ul>
      {scenes.length === 0 && (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Сцен ще немає.</p>
      )}
    </div>
  );
}
