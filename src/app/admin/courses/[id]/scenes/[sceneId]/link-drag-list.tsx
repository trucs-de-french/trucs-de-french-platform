"use client";

import { useState, type DragEvent } from "react";
import { deleteLink, reorderLinks } from "@/app/admin/scenes/actions";
import { SubmitButton } from "@/components/submit-button";

type LinkRow = { id: string; platform: string; url: string; label: string | null };

// Той самий click-нейтральний drag-патерн, що й у SceneBlockList/TaskDragList:
// ручка (⠿) — джерело drag, увесь <li> — ціль drop, swap-семантика.
//
// useState(initialLinks) бере пропс лише як ПОЧАТКОВЕ значення — якщо
// revalidatePath (напр. з addLink) принесе свіжий initialLinks, цей
// компонент сам його не підхопить, доки не перемонтується. Тому виклик
// на сторінці (page.tsx) передає key, що змінюється разом зі списком id —
// React сам перемонтує компонент зі свіжим станом замість синхронізації
// через useEffect (яку явно не рекомендує react-hooks/set-state-in-effect).
export function LinkDragList({
  sceneId,
  initialLinks,
}: {
  sceneId: string;
  initialLinks: LinkRow[];
}) {
  const [links, setLinks] = useState(initialLinks);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function swap(fromId: string, toId: string) {
    if (fromId === toId) return;
    const fromIndex = links.findIndex((l) => l.id === fromId);
    const toIndex = links.findIndex((l) => l.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;

    const prev = links;
    const next = [...links];
    [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
    setLinks(next);
    setError(null);

    const result = await reorderLinks(
      sceneId,
      next.map((l) => l.id)
    );
    if (!result.ok) {
      setLinks(prev);
      setError(result.error ?? "Не вдалося зберегти новий порядок посилань");
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
        {links.map((link) => (
          <li
            key={link.id}
            onDragOver={(e: DragEvent) => e.preventDefault()}
            onDragEnter={(e: DragEvent) => {
              e.preventDefault();
              setDragOver(link.id);
            }}
            onDragLeave={() => setDragOver((p) => (p === link.id ? null : p))}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              setDragOver(null);
              const fromId = e.dataTransfer.getData("text/plain");
              if (fromId) void swap(fromId, link.id);
            }}
            className={`flex items-center justify-between rounded-md border p-3 text-sm transition-colors ${
              dragOver === link.id
                ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
                : ""
            }`}
          >
            <span className="flex items-center gap-2">
              <span
                draggable
                onDragStart={(e: DragEvent) => e.dataTransfer.setData("text/plain", link.id)}
                className="cursor-grab select-none text-neutral-400 active:cursor-grabbing dark:text-neutral-500"
                aria-hidden
              >
                ⠿
              </span>
              {link.platform}: {link.label ?? link.url}
            </span>
            <form action={deleteLink.bind(null, link.id)}>
              <SubmitButton
                pendingChildren="..."
                className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
              >
                Видалити
              </SubmitButton>
            </form>
          </li>
        ))}
      </ul>
      {links.length === 0 && (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Посилань ще немає.</p>
      )}
    </div>
  );
}
