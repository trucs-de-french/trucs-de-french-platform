"use client";

import { useState } from "react";
import { INPUT_BORDER } from "@/lib/input-styles";
import { LABEL_TEXT } from "@/lib/typography-styles";
import { LevelUiLangFields } from "../level-ui-lang-fields";

export function CourseTypeFields() {
  const [type, setType] = useState("film");

  return (
    <>
      <div className="flex flex-col gap-1">
        <label className={LABEL_TEXT}>Тип курсу</label>
        <select
          name="type"
          required
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={`${INPUT_BORDER} px-3 py-2`}
        >
          <option value="film">Фільм/серіал</option>
          <option value="delf">DELF</option>
        </select>
      </div>

      <LevelUiLangFields type={type} initialLevels={[]} initialUiLang="uk" initialDelfLevel={null} />
    </>
  );
}
