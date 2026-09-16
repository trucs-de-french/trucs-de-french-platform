"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";
import { FileUpload } from "./file-upload";
import { INPUT_BORDER } from "@/lib/input-styles";

type FileOrLinkFieldProps =
  | {
      kind: "image" | "audio";
      placeholder?: string;
      // Контрольований варіант — значення живе в React-стані викликача
      // (напр. vocab-item у пам'яті, картка flip_cards тощо), той самий
      // принцип, що onUploaded= у FileUpload.
      mode: "controlled";
      value: string;
      onChange: (value: string) => void;
    }
  | {
      kind: "image" | "audio";
      placeholder?: string;
      // Форма-поле — значення читає сервер напряму з FormData при сабміті
      // (напр. cover_image_url), той самий принцип, що name= у FileUpload;
      // uploadName — окреме приховане поле файлу (сервер сам вирішує
      // пріоритет файл/URL, як і зараз).
      mode: "name";
      urlName: string;
      uploadName: string;
      defaultValue?: string;
    };

// Дві окремі icon-only кнопки замість однієї скрепки: Paperclip (як і
// раніше) відкриває завантаження файлу; Link2 лише тоглить видимість поля
// прямого URL — саме поле за замовчуванням сховане, крім випадку, коли
// значення вже заповнене (щоб не ховати наявні дані за зайвим кліком).
export function FileOrLinkField(props: FileOrLinkFieldProps) {
  const initialValue = props.mode === "controlled" ? props.value : (props.defaultValue ?? "");
  const [showUrl, setShowUrl] = useState(() => Boolean(initialValue));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        {props.mode === "controlled" ? (
          <FileUpload kind={props.kind} variant="icon" onUploaded={props.onChange} />
        ) : (
          <FileUpload kind={props.kind} variant="icon" name={props.uploadName} />
        )}
        <button
          type="button"
          onClick={() => setShowUrl((v) => !v)}
          aria-label={showUrl ? "Сховати поле посилання" : "Вставити посилання"}
          title={showUrl ? "Сховати посилання" : "Вставити посилання"}
          className={`inline-flex w-fit shrink-0 items-center justify-center rounded p-1.5 ${
            showUrl
              ? "text-brand"
              : "text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
          }`}
        >
          <Link2 size={16} />
        </button>
      </div>
      {showUrl &&
        (props.mode === "controlled" ? (
          <input
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            placeholder={props.placeholder ?? "Посилання на файл"}
            className={`${INPUT_BORDER} px-2 py-2 text-sm`}
          />
        ) : (
          <input
            name={props.urlName}
            defaultValue={props.defaultValue ?? ""}
            placeholder={props.placeholder ?? "Посилання на файл"}
            className={`${INPUT_BORDER} px-2 py-2 text-sm`}
          />
        ))}
    </div>
  );
}
