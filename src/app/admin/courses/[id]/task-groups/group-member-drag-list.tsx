"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { deleteTask } from "@/app/admin/tasks/actions";
import { detachTask, reorderGroupMembers } from "@/app/admin/task-groups/actions";
import { SubmitButton } from "@/components/submit-button";

type MemberRow = { id: string; type: string; title: string };

// Той самий native HTML5 drag-патерн, що TaskDragList на сторінці сцени
// (ручка ⠿ — джерело drag, увесь <li> — ціль drop, swap-семантика), але
// простіше: усередині блоку лише задачі (блоки не вкладаються одне в
// одне), тож без розгалуження по kind і без "attach"-гілки. Стрілки ↑/↓
// одразу спроєктовані як клієнтські (swap із сусідом у вже відомому
// відсортованому масиві), а НЕ через <form action={moveTask...}> —
// та сама причина, що вже привела до full-page refresh на сторінці сцени:
// форма+redirect на фоні клієнтського drag-списку відчувається як
// регресія, тож тут одразу робимо правильно.
export function GroupMemberDragList({
  groupId,
  productId,
  initialMembers,
}: {
  groupId: string;
  productId: string;
  initialMembers: MemberRow[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function swap(fromId: string, toId: string) {
    if (fromId === toId) return;
    const fromIndex = members.findIndex((m) => m.id === fromId);
    const toIndex = members.findIndex((m) => m.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;

    const prev = members;
    const next = [...members];
    [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
    setMembers(next);
    setError(null);

    const result = await reorderGroupMembers(
      groupId,
      next.map((m) => m.id)
    );
    if (!result.ok) {
      setMembers(prev);
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
        {members.map((task, i) => (
          <li
            key={task.id}
            onDragOver={(e: DragEvent) => e.preventDefault()}
            onDragEnter={(e: DragEvent) => {
              e.preventDefault();
              setDragOver(task.id);
            }}
            onDragLeave={() => setDragOver((p) => (p === task.id ? null : p))}
            onDrop={(e: DragEvent) => {
              e.preventDefault();
              setDragOver(null);
              const fromId = e.dataTransfer.getData("text/plain");
              if (fromId) void swap(fromId, task.id);
            }}
            className={`flex items-center justify-between rounded-md border p-3 transition-colors ${
              dragOver === task.id
                ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
                : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                draggable
                onDragStart={(e: DragEvent) => e.dataTransfer.setData("text/plain", task.id)}
                className="cursor-grab select-none text-neutral-400 active:cursor-grabbing dark:text-neutral-500"
                aria-hidden
              >
                ⠿
              </span>
              <div>
                <span className="text-xs uppercase text-neutral-500 dark:text-neutral-400">
                  {task.type}
                </span>
                <Link
                  href={`/admin/courses/${productId}/tasks/${task.id}`}
                  className="block font-medium hover:underline"
                >
                  {task.title}
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void swap(task.id, members[i - 1].id)}
                disabled={i === 0}
                className="rounded border px-2 py-1 text-xs disabled:opacity-30 dark:hover:bg-neutral-800"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => void swap(task.id, members[i + 1].id)}
                disabled={i === members.length - 1}
                className="rounded border px-2 py-1 text-xs disabled:opacity-30 dark:hover:bg-neutral-800"
              >
                ↓
              </button>
              <form action={detachTask.bind(null, task.id)}>
                <SubmitButton
                  pendingChildren="..."
                  className="rounded border px-2 py-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  Прибрати з блоку
                </SubmitButton>
              </form>
              <form action={deleteTask.bind(null, task.id)}>
                <SubmitButton
                  pendingChildren="..."
                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
                >
                  Видалити
                </SubmitButton>
              </form>
            </div>
          </li>
        ))}
      </ul>
      {members.length === 0 && (
        <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
          У блоці ще немає задач.
        </p>
      )}
    </div>
  );
}
