"use client";

import { useStudentPreview } from "@/lib/use-student-preview";
import { BUTTON_PRIMARY_LG, BUTTON_PREVIEW } from "@/lib/button-styles";

// Форми Назва/Відео/Скрипт мають реальний "чернетковий" стан (текстові
// поля, що можна редагувати й забути зберегти) — саме їх охоплює "Зберегти
// все". "Практика" тут НЕ форма стану блоку, а форма ДОДАВАННЯ нового
// посилання (url required) — сабміт її звідси або нічого не зробить (поля
// порожні), або впаде на HTML5-валідації; "Завдання" взагалі без форми,
// задачі/блоки зберігаються миттєво своїми діями. Обидва не чіпаємо тут.
const SAVE_ALL_FORM_IDS = ["scene-title-form", "scene-video-form", "scene-script-form"];

export function SceneStickyActions({
  productId,
  sceneId,
}: {
  productId: string;
  sceneId: string;
}) {
  const { pending: previewPending, handleClick: handlePreviewClick } = useStudentPreview(
    productId,
    `/courses/${productId}/scenes/${sceneId}`
  );

  function handleSaveAll() {
    for (const id of SAVE_ALL_FORM_IDS) {
      const form = document.getElementById(id);
      if (form instanceof HTMLFormElement) form.requestSubmit();
    }
  }

  return (
    <div className="sticky bottom-0 -mx-6 mt-6 flex items-center gap-3 border-t border-gray-200 bg-white px-6 py-3 shadow-[0_-1px_3px_rgba(0,0,0,0.1)] dark:border-neutral-800 dark:bg-neutral-950">
      <button type="button" onClick={handleSaveAll} className={BUTTON_PRIMARY_LG}>
        Зберегти все
      </button>
      <button
        type="button"
        onClick={handlePreviewClick}
        disabled={previewPending}
        className={BUTTON_PREVIEW}
      >
        Переглянути як студент
      </button>
    </div>
  );
}
