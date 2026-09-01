"use client";

import { useState } from "react";

const DELF_LEVELS = ["A1", "A2", "B1", "B2"];

export function CourseTypeFields() {
  const [type, setType] = useState("film");

  return (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Тип курсу</label>
        <select
          name="type"
          required
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-md border px-3 py-2"
        >
          <option value="film">Фільм/серіал</option>
          <option value="delf">DELF</option>
        </select>
      </div>

      {type === "delf" && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Рівень DELF</label>
          <select name="level" required defaultValue="A1" className="rounded-md border px-3 py-2">
            {DELF_LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
