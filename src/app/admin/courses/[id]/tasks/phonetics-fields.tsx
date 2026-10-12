"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { Trash2 } from "lucide-react";
import type { PhoneticsConfig, PhoneticsItem } from "@/lib/exercises/types";
import {
  detectMediaSource,
  extractYoutubeId,
  extractDriveId,
  isHttpsUrl,
  PHONETICS_SOURCE_LABELS,
  type PhoneticsMedia,
  type PhoneticsMediaSource,
} from "@/lib/phonetics-media";
import { InstructionsRichTextField } from "./instructions-rich-text-field";
import type { TypeSwitchHandle } from "./type-switch-handle";
import { useFileOrLink } from "@/components/file-or-link-field";
import { FileUpload } from "@/components/file-upload";
import { INPUT_BORDER } from "@/lib/input-styles";

function emptyItem(): PhoneticsItem {
  return { text: "", transcription: "", translation: "", imageUrl: "" };
}

const SOURCE_OPTIONS: PhoneticsMediaSource[] = ["upload", "youtube", "drive", "url"];

const SOURCE_BUTTON_IDLE =
  "rounded border border-gray-200 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800";
const SOURCE_BUTTON_ACTIVE = "rounded border border-brand bg-brand/10 px-2 py-1 text-xs font-medium text-brand";

// Старе mediaUrl (без source/kind) показуємо тут як source="url" із вже
// заповненим посиланням (той самий нейтральний варіант, що
// normalizeLegacyMedia використовує для рендеру студенту) — учитель одразу
// бачить наявне посилання і може або лишити, або явно обрати джерело.
function initialMediaOf(item: PhoneticsItem): PhoneticsMedia | null {
  if (item.media) return item.media;
  if (item.mediaUrl) return { source: "url", kind: "audio", url: item.mediaUrl };
  return null;
}

// Окремий компонент на репліку (не інлайн у .map()) — useFileOrLink і
// useState всередині, порушення правил хуків усередині callback .map().
function PhoneticsItemRow({
  item,
  onUpdateField,
  onUpdateImage,
  onUpdateMedia,
  onRemove,
}: {
  item: PhoneticsItem;
  onUpdateField: (field: "text" | "transcription" | "translation", value: string) => void;
  onUpdateImage: (url: string) => void;
  onUpdateMedia: (media: PhoneticsMedia | null) => void;
  onRemove: () => void;
}) {
  const initialMedia = initialMediaOf(item);
  const [source, setSource] = useState<PhoneticsMediaSource>(initialMedia?.source ?? "upload");
  const [linkValue, setLinkValue] = useState(
    initialMedia && initialMedia.source !== "upload" ? initialMedia.url : ""
  );
  const [driveKind, setDriveKind] = useState<"audio" | "video">(
    initialMedia?.source === "drive" ? initialMedia.kind : "video"
  );
  const [uploadUrl, setUploadUrl] = useState(initialMedia?.source === "upload" ? initialMedia.url : "");
  const [uploadKind, setUploadKind] = useState<"audio" | "video">(
    initialMedia?.source === "upload" ? initialMedia.kind : "audio"
  );

  const image = useFileOrLink({
    kind: "image",
    mode: "controlled",
    value: item.imageUrl ?? "",
    onChange: onUpdateImage,
    placeholder: "Картинка (URL, необов'язково)",
    allowFocus: true,
  });

  // Один емітер для всіх шляхів зміни медіа (вибір джерела, друк у поле
  // посилання, завантаження файлу, перемикач аудіо/відео Диска) — кожен
  // викликає його з тим, що саме змінилось, решта бере поточний стан.
  function emitMedia(next: {
    source: PhoneticsMediaSource;
    link?: string;
    driveKind?: "audio" | "video";
    uploadUrl?: string;
    uploadKind?: "audio" | "video";
  }) {
    if (next.source === "upload") {
      const url = next.uploadUrl ?? uploadUrl;
      onUpdateMedia(url ? { source: "upload", kind: next.uploadKind ?? uploadKind, url } : null);
      return;
    }
    const link = (next.link ?? linkValue).trim();
    if (!link) {
      onUpdateMedia(null);
      return;
    }
    if (next.source === "drive") {
      onUpdateMedia({ source: "drive", kind: next.driveKind ?? driveKind, url: link });
      return;
    }
    // youtube/url — остаточний kind вирішує normalizeMedia на сервері
    // (task-config-builder.ts) з вигляду посилання; тут лише сире значення.
    onUpdateMedia({ source: next.source, kind: "audio", url: link });
  }

  function handleSourceClick(next: PhoneticsMediaSource) {
    setSource(next);
    emitMedia({ source: next });
  }

  function handleLinkChange(value: string) {
    setLinkValue(value);
    // Автовизначення за вставленою адресою — лише серед "посилальних"
    // вкладок (youtube/drive/url), "upload" має власне окреме поле.
    if (source !== "upload") {
      const detected = detectMediaSource(value);
      if (detected.source !== source) {
        setSource(detected.source);
        emitMedia({ source: detected.source, link: value });
        return;
      }
    }
    emitMedia({ source, link: value });
  }

  let linkError: string | null = null;
  if (source === "youtube" && linkValue.trim() && !extractYoutubeId(linkValue)) {
    linkError = "Не вдалося розпізнати посилання YouTube";
  } else if (source === "drive" && linkValue.trim() && !extractDriveId(linkValue)) {
    linkError = "Не вдалося розпізнати посилання Google Диска";
  } else if (source === "url" && linkValue.trim() && !isHttpsUrl(linkValue.trim())) {
    linkError = "Пряме посилання має бути https і вести на файл (mp3, mp4 тощо)";
  }

  return (
    <div className="flex flex-col gap-1 rounded-md border border-gray-100 p-2 dark:border-neutral-700">
      <div className="flex items-center gap-2">
        <input
          value={item.text}
          onChange={(e) => onUpdateField("text", e.target.value)}
          placeholder="Репліка (французькою)"
          className={`${INPUT_BORDER} flex-1 px-2 py-2 text-base font-medium font-content`}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Видалити репліку"
          title="Видалити"
          className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
        >
          <Trash2 size={16} />
        </button>
      </div>
      <input
        value={item.transcription}
        onChange={(e) => onUpdateField("transcription", e.target.value)}
        placeholder="Транскрипція (напр. [ʒə vɛ bjɛ̃])"
        className={`${INPUT_BORDER} px-2 py-2 text-base font-medium font-content`}
      />
      <input
        value={item.translation ?? ""}
        onChange={(e) => onUpdateField("translation", e.target.value)}
        placeholder="Переклад (необов'язково)"
        className={`${INPUT_BORDER} px-2 py-2 text-sm`}
      />

      <div className="flex items-center gap-2">{image.icons}</div>
      {image.input && <div>{image.input}</div>}

      <div className="mt-1 flex flex-col gap-1.5 rounded-md bg-neutral-50 p-2 dark:bg-neutral-800">
        <div className="flex flex-wrap gap-1">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleSourceClick(opt)}
              className={source === opt ? SOURCE_BUTTON_ACTIVE : SOURCE_BUTTON_IDLE}
            >
              {PHONETICS_SOURCE_LABELS[opt]}
            </button>
          ))}
        </div>

        {source === "upload" && (
          <FileUpload
            kind="media"
            variant="button"
            onUploaded={(url, contentType) => {
              const kind: "audio" | "video" = contentType?.startsWith("video/") ? "video" : "audio";
              setUploadUrl(url);
              setUploadKind(kind);
              emitMedia({ source: "upload", uploadUrl: url, uploadKind: kind });
            }}
          />
        )}

        {source !== "upload" && (
          <input
            value={linkValue}
            onChange={(e) => handleLinkChange(e.target.value)}
            placeholder={
              source === "youtube"
                ? "Посилання на YouTube"
                : source === "drive"
                  ? "Посилання на Google Диск"
                  : "Пряме посилання (https, mp3/mp4)"
            }
            className={`${INPUT_BORDER} px-2 py-2 text-sm`}
          />
        )}

        {source === "drive" && (
          <>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-neutral-500 dark:text-neutral-400">Тип файлу:</span>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={driveKind === "audio"}
                  onChange={() => {
                    setDriveKind("audio");
                    emitMedia({ source: "drive", driveKind: "audio" });
                  }}
                />
                Аудіо
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={driveKind === "video"}
                  onChange={() => {
                    setDriveKind("video");
                    emitMedia({ source: "drive", driveKind: "video" });
                  }}
                />
                Відео
              </label>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Файл на Диску має бути відкритий: «Усі, хто має посилання, можуть переглядати». Інакше студент
              побачить запит на вхід.
            </p>
          </>
        )}

        {linkError && <p className="text-xs text-red-600 dark:text-red-400">{linkError}</p>}
      </div>
    </div>
  );
}

// Без ImportableFieldsHandle — навмисно без імпорту лексики: vocab дає лише
// {word, translation}, без транскрипції й медіа, а phonetics про фрази з
// транскрипцією, тож слово-в-слово імпорт більше плутав би, ніж допомагав.
// forwardRef тут лише для TypeSwitchHandle (перенос при зміні типу ↔
// flip_cards), не для імпорту.
export const PhoneticsFields = forwardRef<
  TypeSwitchHandle<PhoneticsConfig>,
  { initialConfig?: Partial<PhoneticsConfig> }
>(function PhoneticsFields({ initialConfig }, ref) {
  const [items, setItems] = useState<PhoneticsItem[]>(
    initialConfig?.items?.length ? initialConfig.items : [emptyItem()]
  );

  useImperativeHandle(ref, () => ({
    getValue: () => ({
      instructions: initialConfig?.instructions,
      subInstructions: initialConfig?.subInstructions,
      items,
    }),
  }));

  function addItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function removeItem(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateItemField(i: number, field: "text" | "transcription" | "translation", value: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)));
  }

  function updateItemImage(i: number, url: string) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, imageUrl: url } : it)));
  }

  function updateItemMedia(i: number, media: PhoneticsMedia | null) {
    setItems((prev) =>
      prev.map((it, idx) => (idx === i ? { ...it, media: media ?? undefined, mediaUrl: undefined } : it))
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
      <input type="hidden" name="phonetics_items" value={JSON.stringify(items)} readOnly />

      <InstructionsRichTextField
        name="phonetics_instructions"
        label="Інструкція для студента"
        initialValue={initialConfig?.instructions ?? ""}
      />

      <InstructionsRichTextField
        name="phonetics_sub_instructions"
        label="Додаткові інструкції (опційно)"
        initialValue={initialConfig?.subInstructions ?? ""}
        compact
      />

      {items.map((item, i) => (
        <PhoneticsItemRow
          key={i}
          item={item}
          onUpdateField={(field, value) => updateItemField(i, field, value)}
          onUpdateImage={(url) => updateItemImage(i, url)}
          onUpdateMedia={(media) => updateItemMedia(i, media)}
          onRemove={() => removeItem(i)}
        />
      ))}
      <button
        type="button"
        onClick={addItem}
        className="self-start text-xs text-blue-700 hover:underline dark:text-blue-400"
      >
        + додати репліку
      </button>
    </div>
  );
});
