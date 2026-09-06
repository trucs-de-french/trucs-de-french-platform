"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { deleteTask, moveTask, reorderSceneRows } from "@/app/admin/tasks/actions";
import { deleteTaskGroup, moveTaskGroup } from "@/app/admin/task-groups/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  CATEGORY_COLORS,
  getTaskTypeCategory,
  getTaskTypeIcon,
} from "@/lib/exercises/task-type-meta";

type TaskRow = { id: string; type: string; title: string; config: Record<string, unknown> | null };
type GroupRow = { id: string; title: string | null; content_type: string };
// Задачі й блоки ділять одну спільну послідовність order_index у межах
// сцени (task-order.ts) — тут вони так само ділять один спільний
// перетягуваний список, а не дві окремі секції (як тимчасово було до
// об'єднання): інакше новий блок завжди опинявся в самому низу без спроби
// перемістити його вище задач.
type Row = ({ kind: "task" } & TaskRow) | ({ kind: "group" } & GroupRow);

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
// баг. Блоки (kind: "group") прев'ю взагалі не мають — короткий
// badge+назва вже достатньо інформативні, без окремого summarizer-а для
// content_text/media_url.
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
// SceneBlockList/reorder.tsx, а не insert-shift. Стрілки ↑/↓ (moveTask/
// moveTaskGroup) лишаються паралельно — обидва механізми пишуть у той
// самий order_index.
//
// useState(initialRows) бере пропс лише як початкове значення — якщо
// колись цю сторінку почне revalidatePath-ити, компонент сам не підхопить
// свіжі дані без перемонтування; виклик на сторінці передає для цього key.
export function TaskDragList({
  sceneId,
  productId,
  initialRows,
}: {
  sceneId: string;
  productId: string;
  initialRows: Row[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function swap(fromId: string, toId: string) {
    if (fromId === toId) return;
    const fromIndex = rows.findIndex((r) => r.id === fromId);
    const toIndex = rows.findIndex((r) => r.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;

    const prev = rows;
    const next = [...rows];
    [next[fromIndex], next[toIndex]] = [next[toIndex], next[fromIndex]];
    setRows(next);
    setError(null);

    const result = await reorderSceneRows(
      sceneId,
      next.map((r) => ({ id: r.id, kind: r.kind === "task" ? ("task" as const) : ("task_group" as const) }))
    );
    if (!result.ok) {
      setRows(prev);
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
        {rows.map((row, i) => {
          const dragProps = {
            onDragOver: (e: DragEvent) => e.preventDefault(),
            onDragEnter: (e: DragEvent) => {
              e.preventDefault();
              setDragOver(row.id);
            },
            onDragLeave: () => setDragOver((p) => (p === row.id ? null : p)),
            onDrop: (e: DragEvent) => {
              e.preventDefault();
              setDragOver(null);
              const fromId = e.dataTransfer.getData("text/plain");
              if (fromId) void swap(fromId, row.id);
            },
          };
          const handle = (
            <span
              draggable
              onDragStart={(e: DragEvent) => e.dataTransfer.setData("text/plain", row.id)}
              className="cursor-grab select-none text-neutral-400 active:cursor-grabbing dark:text-neutral-500"
              aria-hidden
            >
              ⠿
            </span>
          );

          if (row.kind === "group") {
            return (
              <li
                key={row.id}
                {...dragProps}
                className={`flex flex-col rounded-md border-2 border-dashed p-3 transition-colors ${
                  dragOver === row.id
                    ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {handle}
                    <div>
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs uppercase text-neutral-500 dark:text-neutral-400">
                        Блок · {row.content_type}
                      </span>
                      <Link
                        href={`/admin/courses/${productId}/task-groups/${row.id}`}
                        className="block text-base font-semibold hover:underline"
                      >
                        {row.title || "Без назви"}
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <form action={moveTaskGroup.bind(null, row.id, "up")}>
                      <SubmitButton
                        disabled={i === 0}
                        className="rounded border px-2 py-1 text-xs disabled:opacity-30 dark:hover:bg-neutral-800"
                      >
                        ↑
                      </SubmitButton>
                    </form>
                    <form action={moveTaskGroup.bind(null, row.id, "down")}>
                      <SubmitButton
                        disabled={i === rows.length - 1}
                        className="rounded border px-2 py-1 text-xs disabled:opacity-30 dark:hover:bg-neutral-800"
                      >
                        ↓
                      </SubmitButton>
                    </form>
                    <form action={deleteTaskGroup.bind(null, row.id)}>
                      <SubmitButton
                        pendingChildren="..."
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
                      >
                        Видалити
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              </li>
            );
          }

          const Icon = getTaskTypeIcon(row.type);
          const preview = getTaskPreview(row.config);
          const isExpanded = expanded.has(row.id);
          return (
            <li
              key={row.id}
              {...dragProps}
              className={`flex flex-col rounded-md border p-3 transition-colors ${stripeClassFor(
                row.type
              )} ${
                dragOver === row.id
                  ? "border-blue-400 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {handle}
                  {preview && (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(row.id)}
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
                        row.type
                      )}`}
                    >
                      {Icon && <Icon className="h-3 w-3" aria-hidden />}
                      {row.type}
                    </span>
                    <Link
                      href={`/admin/courses/${productId}/tasks/${row.id}`}
                      className="block text-base font-semibold hover:underline"
                    >
                      {row.title}
                    </Link>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <form action={moveTask.bind(null, row.id, "up")}>
                    <SubmitButton
                      disabled={i === 0}
                      className="rounded border px-2 py-1 text-xs disabled:opacity-30 dark:hover:bg-neutral-800"
                    >
                      ↑
                    </SubmitButton>
                  </form>
                  <form action={moveTask.bind(null, row.id, "down")}>
                    <SubmitButton
                      disabled={i === rows.length - 1}
                      className="rounded border px-2 py-1 text-xs disabled:opacity-30 dark:hover:bg-neutral-800"
                    >
                      ↓
                    </SubmitButton>
                  </form>
                  <Link
                    href={`/admin/courses/${productId}/tasks/${row.id}/copy`}
                    className="rounded border px-2 py-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    Копіювати
                  </Link>
                  <form action={deleteTask.bind(null, row.id)}>
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
      {rows.length === 0 && (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Завдань ще немає.</p>
      )}
    </div>
  );
}
