"use client";

import { useState, type DragEvent } from "react";
import Link from "next/link";
import { GripVertical, Copy, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { deleteTask, reorderSceneRows } from "@/app/admin/tasks/actions";
import { deleteTaskGroup, attachTaskInline } from "@/app/admin/task-groups/actions";
import { SubmitButton } from "@/components/submit-button";
import {
  TASK_TYPE_COLORS,
  TASK_GROUP_CONTENT_COLORS,
  TASK_GROUP_CONTENT_ICON,
} from "@/lib/exercises/task-type-meta";
import { TaskTypeIconBadge } from "@/lib/exercises/task-type-icon-badge";
import { pluralizePoints } from "@/lib/pluralize-points";
import { arrayMove, computeInsertIndex, resolveDropSide, type DropSide } from "@/lib/sortable-list";
import { useNewTaskHighlight } from "@/lib/use-new-task-highlight";

type TaskRow = { id: string; type: string; title: string; config: Record<string, unknown> | null };
type GroupRow = { id: string; title: string | null; content_type: string; maxPoints: number };
// Задачі й блоки ділять одну спільну послідовність order_index у межах
// сцени (task-order.ts) — тут вони так само ділять один спільний
// перетягуваний список, а не дві окремі секції (як тимчасово було до
// об'єднання): інакше новий блок завжди опинявся в самому низу без спроби
// перемістити його вище задач.
type Row = ({ kind: "task" } & TaskRow) | ({ kind: "group" } & GroupRow);

function stripeClassFor(type: string): string {
  return TASK_TYPE_COLORS[type]?.stripe ?? "";
}

function badgeClassFor(type: string): string {
  return TASK_TYPE_COLORS[type]?.badge ?? "text-neutral-500 dark:text-neutral-400";
}

function shadowClassFor(type: string): string {
  return TASK_TYPE_COLORS[type]?.shadow ?? "";
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
// (GripVertical) — джерело drag, увесь <li> — ціль drop. Insert-семантика для
// звичайного reorder (перетягнута картка стає рівно на місце, куди її
// кинули, решта зсувається — src/lib/sortable-list.ts) — АЛЕ кидок задачі
// САМЕ на рядок блоку лишається окремою, незмінною операцією "прикріпити"
// (attach), не позиціюванням: там і далі повний кольоровий highlight картки
// блоку, без лінії-індикатора.
//
// Стрілки ↑/↓ НЕ ходять через moveTask/moveTaskGroup (form + redirect) —
// свідоме рішення: цей список уже повністю клієнтський (rows у useState),
// і клік по стрілці — це рівно та сама операція, що drag на сусідній
// рядок відсортованого масиву (сусід — rows[i±1], уже відомий клієнту, не
// треба навіть звертатись по нього на сервер). Раніше стрілки йшли через
// <form action={moveTask.bind(...)}> з redirect() на ту саму сторінку —
// технічно не порушення чекліста (redirect на той самий шлях — "досить"),
// але на фоні миттєвого клієнтського drag-оновлення в цьому самому списку
// такий full-page refresh відчувався як регресія/перезавантаження.
// moveTask/moveTaskGroup лишаються НЕЗМІННИМИ — і далі коректно
// обслуговують форми-стрілки на флет-списку курсу, сторінці матеріалу й
// (поки) списку членів блоку, де немає клієнтського rows-стану.
//
// useState(initialRows) бере пропс лише як початкове значення — якщо
// колись цю сторінку почне revalidatePath-ити, компонент сам не підхопить
// свіжі дані без перемонтування; виклик на сторінці передає для цього key.
export function TaskDragList({
  sceneId,
  productId,
  initialRows,
  newTaskIds = [],
}: {
  sceneId: string;
  productId: string;
  initialRows: Row[];
  // Щойно створені (bulk-from-vocab) — підсвічуються рамкою кольору brand
  // на ~3с (useNewTaskHighlight).
  newTaskIds?: string[];
}) {
  const [rows, setRows] = useState(initialRows);
  const highlightedIds = useNewTaskHighlight(newTaskIds);
  // Повний кольоровий highlight картки блоку — лише для "прикріпити"
  // (willAttach), не для звичайного reorder (той тепер показує тонку лінію
  // через dropTarget, не підсвічування всієї картки).
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; side: DropSide } | null>(null);
  // Яка задача/блок зараз тягнеться — потрібно ЗАЗДАЛЕГІДЬ (під час
  // dragover, до drop), щоб показати іншу підсвітку для "прикріпити" на
  // блок, а не лише "поміняти місцями". dataTransfer.getData() тут не
  // підходить — за специфікацією HTML5 вона надійно читається лише в
  // самому onDrop, не в onDragOver/onDragEnter.
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const draggingRow = rows.find((r) => r.id === draggingId) ?? null;

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function moveByIndex(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex || fromIndex === -1 || toIndex === -1) return;

    const prev = rows;
    const next = arrayMove(rows, fromIndex, toIndex);
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

  async function move(fromId: string, overId: string, side: DropSide) {
    const fromIndex = rows.findIndex((r) => r.id === fromId);
    const overIndex = rows.findIndex((r) => r.id === overId);
    if (fromIndex === -1 || overIndex === -1) return;
    await moveByIndex(fromIndex, computeInsertIndex(fromIndex, overIndex, side));
  }

  // Кинути задачу САМЕ на рядок блоку — прикріпити її до блоку (той самий
  // ефект, що вже робить пікер на сторінці блоку), а не поміняти місцями.
  // attachTaskInline (на відміну від attachTaskToGroup, яка й далі
  // обслуговує форму на сторінці блоку) повертає {ok,error} замість
  // redirect — той самий сценарій 4 чекліста, що вже reorderSceneRows.
  // Задача, яку прикріпили, більше не належить сцені на верхньому рівні
  // (її scene_id обнулився), тож прибираємо її рядок з локального списку —
  // це саме те, що показав би і повний рефреш, лише без нього.
  async function attach(taskId: string, taskGroupId: string) {
    setError(null);
    const result = await attachTaskInline(taskId, taskGroupId);
    if (result.ok) {
      setRows((prev) => prev.filter((r) => r.id !== taskId));
    } else {
      setError(result.error ?? "Не вдалося прикріпити задачу до блоку");
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
          // Кинути задачу САМЕ на блок = прикріпити, не позиціювати —
          // усі інші комбінації (задача на задачу, блок на будь-що)
          // лишаються звичайним insert-reorder.
          const willAttach = row.kind === "group" && draggingRow?.kind === "task";

          const dragProps = {
            onDragOver: (e: DragEvent) => {
              e.preventDefault();
              if (draggingId === null) return;
              if (!willAttach) {
                const side = resolveDropSide(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), "vertical");
                setDropTarget({ id: row.id, side });
              }
            },
            onDragEnter: (e: DragEvent) => {
              e.preventDefault();
              setDragOver(row.id);
            },
            onDragLeave: () => {
              setDragOver((p) => (p === row.id ? null : p));
              setDropTarget((p) => (p?.id === row.id ? null : p));
            },
            onDrop: (e: DragEvent) => {
              e.preventDefault();
              setDragOver(null);
              const fromId = e.dataTransfer.getData("text/plain");
              setDraggingId(null);
              if (!fromId || fromId === row.id) return;
              const fromRow = rows.find((r) => r.id === fromId);
              if (fromRow?.kind === "task" && row.kind === "group") {
                void attach(fromId, row.id);
              } else if (dropTarget) {
                void move(fromId, dropTarget.id, dropTarget.side);
              }
              setDropTarget(null);
            },
          };
          const handle = (
            <span
              draggable
              onDragStart={(e: DragEvent) => {
                setDraggingId(row.id);
                e.dataTransfer.setData("text/plain", row.id);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setDragOver(null);
                setDropTarget(null);
              }}
              className="cursor-grab select-none text-neutral-400 active:cursor-grabbing dark:text-neutral-500"
              aria-hidden
            >
              <GripVertical size={16} />
            </span>
          );

          if (row.kind === "group") {
            const ContentIcon = TASK_GROUP_CONTENT_ICON[row.content_type];
            return (
              <li key={row.id} className="relative">
              {dropTarget?.id === row.id && dropTarget.side === "before" && (
                <span className="absolute -top-[5px] left-0 right-0 h-0.5 rounded-full bg-brand" aria-hidden />
              )}
              <div
                {...dragProps}
                className={`flex flex-col rounded-md border border-t-4 bg-white p-3 shadow-sm transition-colors dark:bg-neutral-800 ${
                  dragOver === row.id && willAttach
                    ? "border-emerald-400 bg-emerald-50 dark:border-emerald-500 dark:bg-emerald-950/30"
                    : `border-gray-200 dark:border-neutral-700 ${
                        TASK_GROUP_CONTENT_COLORS[row.content_type]?.border ?? ""
                      }`
                }`}
              >
                {dragOver === row.id && willAttach && (
                  <p className="mb-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    Відпустіть, щоб прикріпити задачу до цього блоку
                  </p>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {handle}
                    {ContentIcon && (
                      <ContentIcon
                        size={14}
                        className={`shrink-0 ${
                          TASK_GROUP_CONTENT_COLORS[row.content_type]?.iconColor ?? "text-neutral-400 dark:text-neutral-500"
                        }`}
                        aria-hidden
                      />
                    )}
                    <div>
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs uppercase text-neutral-500 dark:text-neutral-400">
                        Блок · {row.content_type}
                        {row.maxPoints > 0 && ` · ${row.maxPoints} ${pluralizePoints(row.maxPoints)}`}
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
                    <button
                      type="button"
                      onClick={() => void moveByIndex(i, i - 1)}
                      disabled={i === 0}
                      aria-label="Перемістити вище"
                      title="Перемістити вище"
                      className="rounded p-1.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 dark:text-neutral-500 dark:hover:text-neutral-200"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void moveByIndex(i, i + 1)}
                      disabled={i === rows.length - 1}
                      aria-label="Перемістити нижче"
                      title="Перемістити нижче"
                      className="rounded p-1.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 dark:text-neutral-500 dark:hover:text-neutral-200"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <form action={deleteTaskGroup.bind(null, row.id)}>
                      <SubmitButton
                        pendingChildren="…"
                        aria-label="Видалити блок"
                        title="Видалити"
                        className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
                      >
                        <Trash2 size={16} />
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              </div>
              {dropTarget?.id === row.id && dropTarget.side === "after" && (
                <span className="absolute -bottom-[5px] left-0 right-0 h-0.5 rounded-full bg-brand" aria-hidden />
              )}
              </li>
            );
          }

          const preview = getTaskPreview(row.config);
          const isExpanded = expanded.has(row.id);
          return (
            <li key={row.id} className="relative">
            {dropTarget?.id === row.id && dropTarget.side === "before" && (
              <span className="absolute -top-[5px] left-0 right-0 h-0.5 rounded-full bg-brand" aria-hidden />
            )}
            <div
              {...dragProps}
              className={`flex flex-col rounded-md border p-3 transition-shadow ${stripeClassFor(
                row.type
              )} border-gray-200 bg-white shadow-sm ${shadowClassFor(row.type)} dark:border-neutral-700 dark:bg-neutral-800 ${
                highlightedIds.has(row.id) ? "ring-2 ring-brand" : ""
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
                  <TaskTypeIconBadge type={row.type} />
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs uppercase ${badgeClassFor(
                        row.type
                      )}`}
                    >
                      {row.type}
                    </span>
                    <Link
                      href={`/admin/courses/${productId}/tasks/${row.id}?sceneId=${sceneId}`}
                      className="block text-base font-semibold hover:underline"
                    >
                      {row.title}
                    </Link>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => void moveByIndex(i, i - 1)}
                    disabled={i === 0}
                    aria-label="Перемістити вище"
                    title="Перемістити вище"
                    className="rounded p-1.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 dark:text-neutral-500 dark:hover:text-neutral-200"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void moveByIndex(i, i + 1)}
                    disabled={i === rows.length - 1}
                    aria-label="Перемістити нижче"
                    title="Перемістити нижче"
                    className="rounded p-1.5 text-neutral-400 hover:text-neutral-700 disabled:opacity-30 dark:text-neutral-500 dark:hover:text-neutral-200"
                  >
                    <ChevronDown size={16} />
                  </button>
                  <Link
                    href={`/admin/courses/${productId}/tasks/${row.id}/copy`}
                    aria-label="Копіювати задачу"
                    title="Копіювати"
                    className="rounded p-1.5 text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
                  >
                    <Copy size={16} />
                  </Link>
                  <form action={deleteTask.bind(null, row.id)}>
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
              {isExpanded && preview && (
                <p className="mt-2 border-t pt-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {preview}
                </p>
              )}
            </div>
            {dropTarget?.id === row.id && dropTarget.side === "after" && (
              <span className="absolute -bottom-[5px] left-0 right-0 h-0.5 rounded-full bg-brand" aria-hidden />
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
