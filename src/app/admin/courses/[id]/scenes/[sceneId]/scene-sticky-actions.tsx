"use client";

import { useState } from "react";
import { useStudentPreview } from "@/lib/use-student-preview";
import { BUTTON_PRIMARY_LG, BUTTON_PREVIEW } from "@/lib/button-styles";

// Форми Назва/Відео/Скрипт мають реальний "чернетковий" стан (текстові
// поля, що можна редагувати й забути зберегти) — саме їх охоплює "Зберегти
// все". "Практика" тут НЕ форма стану блоку, а форма ДОДАВАННЯ нового
// посилання (url required) — сабміт її звідси або нічого не зробить (поля
// порожні), або впаде на HTML5-валідації; "Завдання" взагалі без форми,
// задачі/блоки зберігаються миттєво своїми діями. Обидва не чіпаємо тут.
const SAVE_ALL_FORM_IDS = ["scene-title-form", "scene-video-form", "scene-script-form"];

// Чекає на подію "saveform:done" (SaveForm диспетчерить її на собі одразу
// після того, як її власний action-виклик завершився) — requestSubmit()
// сам по собі лише синхронно тригерить "submit", без жодного способу
// дізнатись, коли форма справді доробила свій запит.
function waitForFormSubmit(form: HTMLFormElement): Promise<boolean> {
  return new Promise((resolve) => {
    function handleDone(e: Event) {
      form.removeEventListener("saveform:done", handleDone);
      resolve(Boolean((e as CustomEvent<{ ok: boolean }>).detail?.ok));
    }
    form.addEventListener("saveform:done", handleDone);
  });
}

export function SceneStickyActions({
  productId,
  sceneId,
}: {
  productId: string;
  sceneId: string;
}) {
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const { pending: previewPending, handleClick: handlePreviewClick } = useStudentPreview(
    productId,
    `/courses/${productId}/scenes/${sceneId}`
  );

  async function handleSaveAll() {
    setSaving(true);
    setShowSaved(false);

    const pending: Promise<boolean>[] = [];
    for (const id of SAVE_ALL_FORM_IDS) {
      const form = document.getElementById(id);
      if (form instanceof HTMLFormElement) {
        pending.push(waitForFormSubmit(form));
        form.requestSubmit();
      }
    }
    const results = await Promise.all(pending);

    setSaving(false);
    if (results.every(Boolean)) {
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 1500);
    }
  }

  return (
    <div className="sticky bottom-0 -mx-6 mt-6 flex items-center gap-3 border-t border-gray-200 bg-white px-6 py-3 shadow-[0_-1px_3px_rgba(0,0,0,0.1)] dark:border-neutral-800 dark:bg-neutral-950">
      <button
        type="button"
        onClick={handleSaveAll}
        disabled={saving}
        className={`transition-colors ${BUTTON_PRIMARY_LG}`}
      >
        {saving ? "Зберігаю..." : showSaved ? "Збережено ✓" : "Зберегти все"}
      </button>
      <button
        type="button"
        onClick={handlePreviewClick}
        disabled={previewPending}
        className={`transition-colors ${BUTTON_PREVIEW}`}
      >
        Переглянути як студент
      </button>
    </div>
  );
}
