"use client";

import { useState, type DragEvent } from "react";
import { GripVertical, Trash2, ExternalLink } from "lucide-react";
import { deleteLink, reorderLinks, updateLink } from "@/app/admin/scenes/actions";
import { SubmitButton } from "@/components/submit-button";
import { resolveSceneLinkMeta } from "@/lib/link-task-icon";
import { arrayMove, computeInsertIndex, resolveDropSide, type DropSide } from "@/lib/sortable-list";
import { INPUT_BORDER } from "@/lib/input-styles";
import { BUTTON_SECONDARY_SM } from "@/lib/button-styles";

type LinkRow = { id: string; platform: string; url: string; label: string | null };

// Той самий click-нейтральний drag-патерн, що й у SceneBlockList/TaskDragList:
// ручка (GripVertical) — джерело drag, увесь <li> — ціль drop. Insert-семантика
// (не swap) — див. src/lib/sortable-list.ts.
//
// useState(initialLinks) бере пропс лише як ПОЧАТКОВЕ значення — якщо
// revalidatePath (напр. з addLink/updateLink) принесе свіжий initialLinks,
// цей компонент сам його не підхопить, доки не перемонтується. Тому виклик
// на сторінці (page.tsx) передає key, що змінюється разом зі списком id —
// React сам перемонтує компонент зі свіжим станом замість синхронізації
// через useEffect (яку явно не рекомендує react-hooks/set-state-in-effect).
//
// edits — окремий стан (ключ — id посилання, стабільний через reorder) із
// полями "мітка"/"URL" ПІД РЕДАГУВАННЯМ: раніше рядок лише показував
// {platform}: {мітка чи обрізаний URL} без жодного способу це змінити
// (лише видалити й додати заново) — тепер кожен рядок сам controlled-форма
// на updateLink, що викликається НАПРЯМУ (той самий принцип, що move() ->
// reorderLinks нижче), без навігації: саме цей рядок показує
// pending/"Збережено ✓"/помилку, решта списку не перемальовується.
export function LinkDragList({
  sceneId,
  initialLinks,
}: {
  sceneId: string;
  initialLinks: LinkRow[];
}) {
  const [links, setLinks] = useState(initialLinks);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; side: DropSide } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [edits, setEdits] = useState<Record<string, { label: string; url: string }>>(() =>
    Object.fromEntries(initialLinks.map((l) => [l.id, { label: l.label ?? "", url: l.url }]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({});

  function editFor(link: LinkRow): { label: string; url: string } {
    return edits[link.id] ?? { label: link.label ?? "", url: link.url };
  }

  function setEdit(linkId: string, patch: Partial<{ label: string; url: string }>) {
    setEdits((prev) => ({ ...prev, [linkId]: { ...(prev[linkId] ?? { label: "", url: "" }), ...patch } }));
  }

  async function saveRow(link: LinkRow) {
    const edit = editFor(link);
    setSavingId(link.id);
    setRowErrors((prev) => ({ ...prev, [link.id]: null }));
    const result = await updateLink(link.id, { label: edit.label, url: edit.url });
    setSavingId(null);
    if (result?.ok) {
      setLinks((prev) =>
        prev.map((l) => (l.id === link.id ? { ...l, label: edit.label.trim() || null, url: edit.url.trim() || l.url } : l))
      );
      setSavedId(link.id);
      setTimeout(() => setSavedId((id) => (id === link.id ? null : id)), 1500);
    } else {
      setRowErrors((prev) => ({ ...prev, [link.id]: result?.error ?? "Не вдалося зберегти посилання" }));
    }
  }

  async function move(fromId: string, overId: string, side: DropSide) {
    const fromIndex = links.findIndex((l) => l.id === fromId);
    const overIndex = links.findIndex((l) => l.id === overId);
    if (fromIndex === -1 || overIndex === -1) return;
    const toIndex = computeInsertIndex(fromIndex, overIndex, side);
    if (toIndex === fromIndex) return;

    const prev = links;
    const next = arrayMove(links, fromIndex, toIndex);
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
        {links.map((link) => {
          const meta = resolveSceneLinkMeta(link.platform);
          const edit = editFor(link);
          const isCustom = link.platform === "custom";
          return (
            <li key={link.id} className="relative">
              {dropTarget?.id === link.id && dropTarget.side === "before" && (
                <span className="absolute -top-[5px] left-0 right-0 h-0.5 rounded-full bg-brand" aria-hidden />
              )}
              <div
                onDragOver={(e: DragEvent) => {
                  e.preventDefault();
                  if (draggingId === null) return;
                  const side = resolveDropSide(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect(), "vertical");
                  setDropTarget({ id: link.id, side });
                }}
                onDragLeave={() => setDropTarget((p) => (p?.id === link.id ? null : p))}
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
                className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-800"
              >
                <div className="flex items-center gap-2">
                  <span
                    draggable
                    onDragStart={(e: DragEvent) => {
                      e.dataTransfer.setData("text/plain", link.id);
                      setDraggingId(link.id);
                    }}
                    className="cursor-grab select-none text-neutral-400 active:cursor-grabbing dark:text-neutral-500"
                    aria-hidden
                  >
                    <GripVertical size={16} />
                  </span>
                  <ExternalLink size={16} className="shrink-0 text-neutral-400 dark:text-neutral-500" />
                  <span className="shrink-0 text-xs text-neutral-500 dark:text-neutral-400">{meta.label}</span>
                  <input
                    value={edit.label}
                    onChange={(e) => setEdit(link.id, { label: e.target.value })}
                    placeholder={meta.label}
                    aria-label="Мітка посилання"
                    className={`${INPUT_BORDER} h-8 flex-1 px-2 text-sm`}
                  />
                  <form action={deleteLink.bind(null, link.id)}>
                    <SubmitButton
                      pendingChildren="…"
                      aria-label="Видалити посилання"
                      title="Видалити"
                      className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
                    >
                      <Trash2 size={16} />
                    </SubmitButton>
                  </form>
                </div>

                {!isCustom && (
                  <input
                    value={edit.url}
                    onChange={(e) => setEdit(link.id, { url: e.target.value })}
                    placeholder="URL"
                    aria-label="URL посилання"
                    className={`${INPUT_BORDER} ml-[22px] h-8 px-2 text-sm`}
                  />
                )}

                <div className="ml-[22px] flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={savingId === link.id}
                    onClick={() => saveRow(link)}
                    className={BUTTON_SECONDARY_SM}
                  >
                    {savingId === link.id ? "Зберігаю..." : "Зберегти"}
                  </button>
                  {savedId === link.id && (
                    <span className="text-sm font-medium text-green-600 dark:text-green-400">Збережено ✓</span>
                  )}
                  {rowErrors[link.id] && (
                    <span className="text-sm text-red-600 dark:text-red-400">{rowErrors[link.id]}</span>
                  )}
                </div>
              </div>
              {dropTarget?.id === link.id && dropTarget.side === "after" && (
                <span className="absolute -bottom-[5px] left-0 right-0 h-0.5 rounded-full bg-brand" aria-hidden />
              )}
            </li>
          );
        })}
      </ul>
      {links.length === 0 && (
        <p className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">Посилань ще немає.</p>
      )}
    </div>
  );
}
