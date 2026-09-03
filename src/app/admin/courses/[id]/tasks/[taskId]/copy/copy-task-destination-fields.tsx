"use client";

import { useState } from "react";
import { EXAM_SECTIONS, EXAM_SECTION_LABELS } from "@/lib/delf/exam-structure";

// Радіо саме визначає, яке з двох піднаборів полів реально піде в
// FormData — немонтований піднабір просто не подається (той самий принцип,
// що вже для disabled-полів в інших формах цієї сесії).
export function CopyTaskDestinationFields({
  materials,
}: {
  materials: { id: string; title: string | null }[];
}) {
  const [destination, setDestination] = useState<"test" | "material">("test");

  return (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">Куди скопіювати</label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="destination"
              value="test"
              checked={destination === "test"}
              onChange={() => setDestination("test")}
            />
            DELF-тест
          </label>
          <label className={`flex items-center gap-1.5 ${materials.length === 0 ? "opacity-50" : ""}`}>
            <input
              type="radio"
              name="destination"
              value="material"
              disabled={materials.length === 0}
              checked={destination === "material"}
              onChange={() => setDestination("material")}
            />
            Матеріал {materials.length === 0 && "(немає доступних)"}
          </label>
        </div>
      </div>

      {destination === "test" && (
        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">Секція іспиту</label>
            <select name="delf_section" required className="rounded-md border px-2 py-1.5 text-sm">
              {EXAM_SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s} — {EXAM_SECTION_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">№ тесту (1-30)</label>
            <input
              name="delf_test_number"
              type="number"
              min={1}
              max={30}
              required
              className="rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      {destination === "material" && materials.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">Матеріал</label>
          <select name="material_id" required className="rounded-md border px-2 py-1.5 text-sm">
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title ?? "Матеріал"}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
