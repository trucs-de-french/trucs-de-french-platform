"use client";

import { useState } from "react";
import { INPUT_BORDER } from "@/lib/input-styles";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// Текстове поле hex-кольору з живою мініатюрою-прев'ю — єдиний color-
// input-паттерн у проєкті (раніше не було, native type="color" не
// використовується ніде інде), звідси звичайний текстовий input, а не
// браузерний color picker.
export function FillColorField({ name, defaultValue }: { name: string; defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  const isValid = HEX_COLOR_RE.test(value);

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        name={name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="#RRGGBB"
        pattern="^#[0-9a-fA-F]{6}$"
        className={`${INPUT_BORDER} w-36 px-3 py-2`}
      />
      <span
        aria-hidden
        className="h-7 w-7 shrink-0 rounded border border-gray-200 dark:border-neutral-700"
        style={{ backgroundColor: isValid ? value : "transparent" }}
      />
    </div>
  );
}
