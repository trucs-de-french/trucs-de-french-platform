"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { deleteTask, moveTask, reorderTasks } from "@/app/admin/tasks/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  CATEGORY_COLORS,
  getTaskTypeCategory,
  getTaskTypeIcon,
} from "@/lib/exercises/task-type-meta";

type TaskRow = { id: string; type: string; title: string; config: Record<string, unknown> | null };

function stripeClassFor(type: string): string {
  const category = getTaskTypeCategory(type);
  return category ? CATEGORY_COLORS[category].stripe : "";
}

function badgeClassFor(type: string): string {
  const category = getTaskTypeCategory(type);
  return category
    ? CATEGORY_COLORS[category].badge
    : "text-neutral-500 dark:text-neutral-400";
}

// Простий евристичний прев'ю без формату під кожен тип окремо (свідомо
// узгоджений компроміс) — бере перше непорожнє з типових текстових полів.
// Для типів, чий основний контент лежить у масивах (matching.pairs,
// table_fill.rows тощо), прев'ю не покаже нічого змістовного, окрім хіба
// instructions, якщо вчитель його заповнив — це прийнятне обмеження, а не
// баг.
const PREVIEW_FIELDS = ["instructions", "question", "template", "content", "prompt"] as const;
const PREVIEW_MAX_LENGTH = 150;

function getTaskPreview(config: Record<string, unknown> | null): string | null {
  if (!config) return null;
  for (const field of PREVIEW_FIELDS) {
    const value = config[field];
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      return trimmed.length > PREVIEW_MAX_LENGTH
        ? `${trimmed.slice(0, PREVIEW_MAX_LENGTH)}…`
        : trimmed;
    }
  }
  return null;
}

// Той самий click-нейтральний drag-патерн, що й у SceneBlockList: ручка
// (⠿) — джерело drag, увесь <li> — ціль drop. Swap-семантика (перетягнута
// картка міняється місцями з тією, на яку кинута) — узгоджено з
// SceneBlockList/reorder.tsx, а не insert-shift. Стрілки ↑/↓ (moveTask)
// лишаються паралельно — обидва механізми пишуть у той самий order_index.
//
// useState(initialTasks) бере пропс лише як початкове значення — якщо
// колись цю сторінку почне revalidatePath-ити, компонент сам не підхопить
// свіжі дані без перемонтування; виклик на сторінці передає для цього key.
export function TaskDragList({
  sceneId,
  productId,
  initialTasks,
}: {
  sceneId: string;
  productId: string;
  initialTasks: TaskRow[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(taskId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  async function swap(fromId: string, toId: string) {
    if (fromId === toId) return;
    const fromIndex = tasks.findIndex((t) => t.id === fromId);
    const toIndex = tasks.findIndex((t) => t.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;

    const prev = tasks;
    const next = [...tasks];
    [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
    setTasks(next);
    setError(null);

    const result = await reorderTasks(
      sceneId,
      next.map((t) => t.id)
    );
    if (!result.ok) {
      setTasks(prev);
      setError(result.error ?? "Не вдалося зберегти новий порядок завдань");
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
        {tasks.map((task, i) => {
          const Icon = getTaskTypeIcon(task.type);
          const preview = getTaskPreview(task.config);
          const isExpanded = expanded.has(task.id);
          return (
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
            className={`flex flex-col rounded-md border p-3 transition-colors ${stripeClassFor(
              task.type
            )} ${
              dragOver === task.id
                ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
                : ""
            }`}
          >
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                draggable
                onDragStart={(e: DragEvent) => e.dataTransfer.setData("text/plain", task.id)}
                className="cursor-grab select-none text-neutral-400 active:cursor-grabbing dark:text-neutral-500"
                aria-hidden
              >
                ⠿
              </span>
              {preview && (
                <button
                  type="button"
                  onClick={() => toggleExpanded(task.id)}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? "Згорнути прев'ю" : "Розгорнути прев'ю"}
                  className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
                >
                  {isExpanded ? "▾" : "▸"}
                </button>
              )}
              <div>
                <span
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs uppercase ${badgeClassFor(
                    task.type
                  )}`}
                >
                  {Icon && <Icon className="h-3 w-3" aria-hidden />}
                  {task.type}
                </span>
                <Link
                  href={`/admin/courses/${productId}/tasks/${task.id}`}
                  className="block text-base font-semibold hover:underline"
                >
                  {task.title}
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <form action={moveTask.bind(null, task.id, "up")}>
                <SubmitButton
                  disabled={i === 0}
                  className="rounded border px-2 py-1 text-xs disabled:opacity-30 dark:hover:bg-neutral-800"
                >
                  ↑
                </SubmitButton>
              </form>
              <form action={moveTask.bind(null, task.id, "down")}>
                <SubmitButton
                  disabled={i === tasks.length - 1}
                  className="rounded border px-2 py-1 text-xs disabled:opacity-30 dark:hover:bg-neutral-800"
                >
                  ↓
                </SubmitButton>
              </form>
              <Link
                href={`/admin/courses/${productId}/tasks/${task.id}/copy`}
                className="rounded border px-2 py-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                Копіювати
              </Link>
              <form action={deleteTask.bind(null, task.id)}>
                <SubmitButton
                  pendingChildren="..."
                  className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
                >
                  Видалити
                </SubmitButton>
              </form>
            </div>
            </div>
            {isExpanded && preview && (
              <p className="mt-2 border-t pt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {preview}
              </p>
            )}
          </li>
          );
        })}
      </ul>
      {tasks.length === 0 && (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Завдань ще немає.</p>
      )}
    </div>
  );
}
