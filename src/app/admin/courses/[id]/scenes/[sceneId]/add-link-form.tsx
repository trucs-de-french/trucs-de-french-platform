"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";
import { FileUpload } from "@/components/file-upload";
import { INPUT_BORDER } from "@/lib/input-styles";
import { BUTTON_SECONDARY } from "@/lib/button-styles";

const LINK_STYLE = "self-start text-sm text-brand hover:underline disabled:opacity-50";

// Замінює SaveForm тут — потрібні ДВІ кнопки з ІДЕНТИЧНИМ збереженням
// (той самий addLink), але різною поведінкою ПІСЛЯ успіху: "Зберегти"
// закриває форму, "Додати нову" одразу очищає поля для наступного
// посилання. SaveForm розрахований на одну кнопку/один сабміт — розширювати
// його заради цього єдиного нетипового місця не варто.
export function AddLinkForm({
  action,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
}) {
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState("quizlet");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();
  const [showSaved, setShowSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Інкрементується при кожному успішному збереженні — примусово перемонтовує
  // FileUpload (інакше "✓ Завантажено: файл.html" від попереднього запису
  // лишилось би видимим після очищення полів для "Додати нову").
  const [formKey, setFormKey] = useState(0);

  function resetFields() {
    setPlatform("quizlet");
    setUrl("");
    setLabel("");
    setFormKey((k) => k + 1);
  }

  function save(keepOpen: boolean) {
    if (!url.trim()) {
      setError("URL обов'язковий");
      return;
    }
    const formData = new FormData();
    formData.set("platform", platform);
    formData.set("url", url);
    formData.set("label", label);

    startTransition(async () => {
      const result = await action(null, formData);
      if (result?.ok) {
        setError(null);
        setShowSaved(true);
        setTimeout(() => setShowSaved(false), 1500);
        resetFields();
        setOpen(keepOpen);
      } else {
        setError(result?.error ?? "Не вдалося зберегти посилання");
      }
    });
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={LINK_STYLE}>
        + Додати посилання
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
          aria-label="Платформа"
          className={`${INPUT_BORDER} h-10 px-2 text-sm`}
        >
          <option value="quizlet">Quizlet</option>
          <option value="wordwall">Wordwall</option>
          <option value="custom">Власна гра</option>
        </select>
        <div className="flex items-center gap-1">
          <input
            placeholder="URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className={`${INPUT_BORDER} h-10 px-2 text-sm`}
          />
          <FileUpload key={formKey} kind="html" variant="icon" onUploaded={setUrl} />
        </div>
        <input
          placeholder="Мітка"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className={`${INPUT_BORDER} h-10 px-2 text-sm`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={pending} onClick={() => save(false)} className={BUTTON_SECONDARY}>
          {pending ? "Зберігаю..." : "Зберегти"}
        </button>
        <button type="button" disabled={pending} onClick={() => save(true)} className={LINK_STYLE}>
          {pending ? "Зберігаю..." : "Додати нову"}
        </button>
        {showSaved && (
          <span className="text-sm font-medium text-green-600 dark:text-green-400">Збережено ✓</span>
        )}
        {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            resetFields();
            setError(null);
          }}
          className="text-sm text-neutral-500 hover:underline dark:text-neutral-400"
        >
          Скасувати
        </button>
      </div>
    </div>
  );
}
