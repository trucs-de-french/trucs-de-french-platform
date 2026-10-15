"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { FileUpload } from "@/components/file-upload";
import { HINT_TEXT } from "@/lib/typography-styles";

// Контрольоване поле "картинка фону курсу" (десктоп/мобільний банер) —
// завантаження, мініатюра-прев'ю й кнопка "Прибрати", той самий принцип
// контрольованого FileUpload (onUploaded), що вже в FileOrLinkField, але
// тут без паралельного текстового поля URL (не потрібне для цього поля:
// лише завантажені нами R2-картинки, звідси й лише FileUpload, без Link2).
export function BackgroundImageField({
  name,
  defaultValue,
  helperText,
  thumbClassName = "h-20 w-32",
}: {
  name: string;
  defaultValue: string;
  helperText: string;
  thumbClassName?: string;
}) {
  const [url, setUrl] = useState(defaultValue);

  return (
    <div className="flex flex-col gap-1">
      <input type="hidden" name={name} value={url} readOnly />
      {url ? (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- довільний зовнішній R2-origin, next/image тут не додає нічого (вже стиснутий upload) */}
          <img
            src={url}
            alt=""
            className={`${thumbClassName} shrink-0 rounded-md border border-gray-200 object-cover dark:border-neutral-700`}
          />
          <button
            type="button"
            onClick={() => setUrl("")}
            className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
          >
            <X size={14} />
            Прибрати
          </button>
        </div>
      ) : (
        <FileUpload kind="image" onUploaded={(uploadedUrl) => setUrl(uploadedUrl)} />
      )}
      <p className={HINT_TEXT}>{helperText}</p>
    </div>
  );
}
