"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { INPUT_BORDER } from "@/lib/input-styles";

// Поля форми "+ Додати посилання" ("Практика") — виділені в окремий
// клієнтський компонент, бо полю url тепер потрібен контрольований стан:
// завантаження власної HTML-гри (kind="html") підставляє отриманий
// публічний R2 URL прямо в це поле (on submit іде звичайним name="url"
// через FormData — SaveForm читає DOM напряму, контрольованість інпута
// цьому не заважає).
export function AddLinkFields() {
  const [url, setUrl] = useState("");

  return (
    <>
      <select name="platform" aria-label="Платформа" className={`${INPUT_BORDER} h-10 px-2 text-sm`}>
        <option value="quizlet">Quizlet</option>
        <option value="wordwall">Wordwall</option>
        <option value="custom">Власна гра</option>
      </select>
      <div className="flex items-center gap-1">
        <input
          name="url"
          placeholder="URL"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className={`${INPUT_BORDER} h-10 px-2 text-sm`}
        />
        <FileUpload kind="html" variant="icon" onUploaded={setUrl} />
      </div>
      <input name="label" placeholder="Мітка" className={`${INPUT_BORDER} h-10 px-2 text-sm`} />
    </>
  );
}
