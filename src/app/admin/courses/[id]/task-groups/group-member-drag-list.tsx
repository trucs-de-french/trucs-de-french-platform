"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { GripVertical, Copy, Trash2 } from "lucide-react";
import { deleteTask } from "@/app/admin/tasks/actions";
import { detachTask, reorderGroupMembers, copyTaskInGroup } from "@/app/admin/task-groups/actions";
import { SubmitButton } from "@/components/submit-button";
import { BUTTON_SECONDARY_SM } from "@/lib/button-styles";
import { HINT_TEXT } from "@/lib/typography-styles";
import { arrayMove, computeInsertIndex, resolveDropSide, type DropSide } from "@/lib/sortable-list";

type MemberRow = { id: string; type: string; title: string };

// Той самий native HTML5 drag-патерн, що TaskDragList на сторінці сцени
// (ручка GripVertical — джерело drag, увесь <li> — ціль drop), але простіше:
// усередині блоку лише задачі (блоки не вкладаються одне в одне), тож без
// розгалуження по kind і без "attach"-гілки. Insert-семантика для drag (не
// swap) — src/lib/sortable-list.ts; для ↑/↓ (сусідній обмін) arrayMove на
// сусідніх індексах дає той самий результат, що й swap, тож окремої функції
// не потрібно. Стрілки одразу спроєктовані як клієнтські (у вже відомому
// відсортованому масиві), а НЕ через <form action={moveTask...}> — та сама
// причина, що вже привела до full-page refresh на сторінці сцени: форма+
// redirect на фоні клієнтського drag-списку відчувається як регресія, тож
// тут одразу робимо правильно.
export function GroupMemberDragList({
  groupId,
  productId,
  initialMembers,
  sceneId,
  delfTestNumber,
}: {
  groupId: string;
  productId: string;
  initialMembers: MemberRow[];
  // Резолвлений батьківський контекст блоку (сцена/DELF-тест) — лише для
  // підсвітки активної сцени/тесту в CourseSwitcherSidebar (query-параметр
  // на посиланні задачі, той самий принцип, що task-drag-list.tsx/
  // test-section-drag-list.tsx). Обидва опційні й взаємовиключні — блок
  // може належати матеріалу, де підсвічувати нічого.
  sceneId?: string | null;
  delfTestNumber?: number | null;
}) {
  const [members, setMembers] = useState(initialMembers);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; side: DropSide } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function moveByIndex(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || toIndex >= members.length) return;

    const prev = members;
    const next = arrayMove(members, fromIndex, toIndex);
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

  async function move(fromId: string, overId: string, side: DropSide) {
    const fromIndex = members.findIndex((m) => m.id === fromId);
    const overIndex = members.findIndex((m) => m.id === overId);
    if (fromIndex === -1 || overIndex === -1) return;
    await moveByIndex(fromIndex, computeInsertIndex(fromIndex, overIndex, side));
  }

  // Копія одразу в цьому самому блоці, без пікера — вставляємо в локальний
  // список ПІСЛЯ оригіналу і одразу перезаписуємо order_index через уже
  // наявний reorderGroupMembers (той самий трюк, що moveByIndex), щоб
  // позиція реально збереглась, а не лишилась там, де RPC поставив
  // order_index (max+1 у блоці — кінець списку). На відміну від moveByIndex —
  // якщо reorderGroupMembers тут впаде, members НЕ відкочуємо: копія вже
  // реально створена в БД, приховати її локально було б оманливо (пропала
  // б із виду, хоча існує), лише повідомляємо про проблему з порядком.
  async function copy(taskId: string) {
    setError(null);
    const result = await copyTaskInGroup(taskId, groupId);
    if (!result.ok || !result.task) {
      setError(result.error ?? "Не вдалося скопіювати задачу");
      return;
    }

    const index = members.findIndex((m) => m.id === taskId);
    const next = [...members];
    next.splice(index + 1, 0, result.task);
    setMembers(next);

    const reorderResult = await reorderGroupMembers(
      groupId,
      next.map((m) => m.id)
    );
    if (!reorderResult.ok) {
      setError(reorderResult.error ?? "Задачу скопійовано, але не вдалося зберегти порядок");
    }
  }

  // Query-параметр лише для підсвітки в CourseSwitcherSidebar — той самий
  // принцип, що task-drag-list.tsx/test-section-drag-list.tsx.
  function taskHref(taskId: string) {
    const base = `/admin/courses/${productId}/tasks/${taskId}`;
    if (sceneId) return `${base}?sceneId=${sceneId}`;
    if (delfTestNumber) return `${base}?delfTestNumber=${delfTestNumber}`;
    return base;
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
          <li key={task.id} className="relative">
            {dropTarget?.id === task.id && dropTarget.side === "before" && (
              <span className="absolute -top-[5px] left-0 right-0 h-0.5 rounded-full bg-brand" aria-hidden />
            )}
            <div
              onDragOver={(e: DragEvent) => {
                e.preventDefault();
                if (draggingId === null) return;
                const side = resolveDropSide(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), "vertical");
                setDropTarget({ id: task.id, side });
              }}
              onDragLeave={() => setDropTarget((p) => (p?.id === task.id ? null : p))}
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
                  e.dataTransfer.setData("text/plain", task.id);
                  setDraggingId(task.id);
                }}
                className="cursor-grab select-none text-neutral-400 active:cursor-grabbing dark:text-neutral-500"
                aria-hidden
              >
                <GripVertical size={16} />
              </span>
              <div>
                <span className={`uppercase ${HINT_TEXT}`}>
                  {task.type}
                </span>
                <Link
                  href={taskHref(task.id)}
                  className="block font-medium hover:underline"
                >
                  {task.title}
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void moveByIndex(i, i - 1)}
                disabled={i === 0}
                className="rounded border px-2 py-1 text-xs disabled:opacity-30 dark:hover:bg-neutral-800"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => void moveByIndex(i, i + 1)}
                disabled={i === members.length - 1}
                className="rounded border px-2 py-1 text-xs disabled:opacity-30 dark:hover:bg-neutral-800"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => void copy(task.id)}
                aria-label="Копіювати задачу"
                title="Копіювати"
                className="rounded p-1.5 text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
              >
                <Copy size={16} />
              </button>
              <form action={detachTask.bind(null, task.id)}>
                <SubmitButton
                  pendingChildren="..."
                  className={BUTTON_SECONDARY_SM}
                >
                  Прибрати з блоку
                </SubmitButton>
              </form>
              <form action={deleteTask.bind(null, task.id)}>
                <SubmitButton
                  pendingChildren="…"
                  aria-label="Видалити задачу"
                  title="Видалити"
                  className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
                >
                  <Trash2 size={16} />
                </SubmitButton>
              </form>
            </div>
            </div>
            {dropTarget?.id === task.id && dropTarget.side === "after" && (
              <span className="absolute -bottom-[5px] left-0 right-0 h-0.5 rounded-full bg-brand" aria-hidden />
            )}
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
