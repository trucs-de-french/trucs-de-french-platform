"use client";

import { useState, type MouseEvent } from "react";
import { Crosshair, X } from "lucide-react";
import { ImageOrPlaceholder } from "@/components/image-or-placeholder";
import { parseImageFocus, withImageFocus } from "@/lib/image-focus";
import { HINT_TEXT } from "@/lib/typography-styles";
import { Z_MODAL } from "@/lib/z-layers";

const PREVIEW_MAX = 240;
const EXAMPLE_SIZE = 64;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Кнопка-іконка (Crosshair) поруч з іконками FileOrLinkField, kind="image",
// allowFocus — відкриває попап із прев'ю (object-contain, до 240px): клік
// ставить точку фокусу (кружечок), поруч — маленька квадратна мініатюра-
// приклад, як картинка виглядатиме у студента (object-cover, той самий
// фокус). Сама точка фокусу НЕ окреме поле — кодується прямо у value
// (фрагмент #focus=X,Y, src/lib/image-focus.ts), тож onChange віддає той
// самий рядок URL з оновленим фрагментом.
//
// Попап-контейнер — inline-block навколо самого <img> (не фіксований
// квадрат): при object-contain у контейнері з фіксованим розміром картинка
// нестандартних пропорцій "плавала" б усередині (letterboxing), і клік по
// порожній смузі поруч не відповідав би точці на самій картинці. Тут
// контейнер завжди рівно по розміру відрендереної картинки (max-h/max-w
// без явних height/width), тому відсоток кліку від rect контейнера — це
// завжди відсоток від самої картинки.
export function ImageFocusButton({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const { x, y } = parseImageFocus(value);
  const hasFocus = x !== 50 || y !== 50;

  function handlePick(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = clamp(Math.round(((e.clientX - rect.left) / rect.width) * 100), 0, 100);
    const ny = clamp(Math.round(((e.clientY - rect.top) / rect.height) * 100), 0, 100);
    onChange(withImageFocus(value, nx, ny));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Точка фокусу картинки"
        title="Точка фокусу картинки"
        className={`inline-flex w-fit shrink-0 items-center justify-center rounded p-1.5 ${
          hasFocus
            ? "text-brand"
            : "text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
        }`}
      >
        <Crosshair size={16} />
      </button>

      {open && (
        <div
          className={`fixed inset-0 ${Z_MODAL} flex items-center justify-center bg-black/50 p-4`}
          onClick={() => setOpen(false)}
        >
          <div
            className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Точка фокусу</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Закрити"
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-wrap items-start gap-4">
              <div
                onClick={handlePick}
                role="button"
                tabIndex={0}
                title="Клікніть, щоб задати точку фокусу"
                className="relative inline-block cursor-crosshair"
              >
                <ImageOrPlaceholder
                  src={value}
                  alt="Прев'ю"
                  className="block rounded-md border border-gray-200 object-contain dark:border-neutral-700"
                  style={{ maxWidth: PREVIEW_MAX, maxHeight: PREVIEW_MAX }}
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand shadow"
                  style={{ left: `${x}%`, top: `${y}%` }}
                />
              </div>

              <div className="flex flex-col items-center gap-1">
                <p className={HINT_TEXT}>Як у студента</p>
                <ImageOrPlaceholder
                  src={value}
                  alt="Приклад мініатюри"
                  className="rounded-md border border-gray-200 object-cover dark:border-neutral-700"
                  style={{ width: EXAMPLE_SIZE, height: EXAMPLE_SIZE }}
                  useFocus
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2">
              <p className={HINT_TEXT}>Точка фокусу — що лишається видимим при кадруванні.</p>
              <button
                type="button"
                onClick={() => onChange(withImageFocus(value, 50, 50))}
                disabled={!hasFocus}
                className="shrink-0 text-xs text-neutral-500 hover:underline disabled:opacity-40 disabled:hover:no-underline dark:text-neutral-400"
              >
                Скинути
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
