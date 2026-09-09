"use client";

import { useState } from "react";
import { EXAM_SECTIONS, EXAM_SECTION_LABELS } from "@/lib/delf/exam-structure";
import { InstructionsRichTextField } from "../tasks/instructions-rich-text-field";

export type TaskGroupInitial = {
  title?: string | null;
  content_type?: string;
  content_text?: string | null;
  media_url?: string | null;
  media_provider?: string | null;
  points_mode?: string;
  flat_points?: number | null;
  delf_section?: string | null;
  delf_test_number?: number | null;
};

// Той самий пікер секції/тесту DELF, що вже в task-config-fields.tsx (для
// окремих задач) — блок належить сцені/матеріалу/DELF-тесту нарівні із
// задачами, той самий вибір батьківського контексту.
export function TaskGroupFields({
  initialGroup,
  productType,
  materialId,
}: {
  initialGroup?: TaskGroupInitial;
  productType?: string;
  materialId?: string | null;
}) {
  const [contentType, setContentType] = useState(initialGroup?.content_type ?? "text");
  const [pointsMode, setPointsMode] = useState(initialGroup?.points_mode ?? "sum");
  const [delfSection, setDelfSection] = useState(initialGroup?.delf_section ?? "");
  const [delfTestNumber, setDelfTestNumber] = useState(
    initialGroup?.delf_test_number ? String(initialGroup.delf_test_number) : ""
  );

  return (
    <>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Назва блоку (для адмінки, студент не бачить)
        </label>
        <input
          name="title"
          defaultValue={initialGroup?.title ?? ""}
          placeholder="напр. CO — Situations du quotidien"
          className="rounded-md border px-3 py-2 text-base font-medium"
        />
      </div>

      {productType === "delf" && !materialId && (
        <div className="flex gap-4">
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">Секція іспиту</label>
            <select
              name="delf_section"
              required
              value={delfSection}
              onChange={(e) => setDelfSection(e.target.value)}
              className="rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">—</option>
              {EXAM_SECTIONS.map((s) => (
                <option key={s} value={s}>
                  {s} — {EXAM_SECTION_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <label className="text-xs text-neutral-500 dark:text-neutral-400">
              № тесту (1-30)
            </label>
            <input
              name="delf_test_number"
              type="number"
              min={1}
              max={30}
              required
              value={delfTestNumber}
              onChange={(e) => setDelfTestNumber(e.target.value)}
              className="rounded-md border px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Тип спільного контенту
        </label>
        <select
          name="content_type"
          value={contentType}
          onChange={(e) => setContentType(e.target.value)}
          className="w-fit rounded-md border px-2 py-1.5 text-sm"
        >
          <option value="text">Текст</option>
          <option value="audio">Аудіо</option>
          <option value="video">Відео</option>
          <option value="embed">Вбудований контент (iframe)</option>
        </select>
      </div>

      {contentType === "text" && (
        <InstructionsRichTextField
          name="content_text"
          label="Текст"
          initialValue={initialGroup?.content_text ?? ""}
        />
      )}

      {(contentType === "audio" || contentType === "video" || contentType === "embed") && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">
            {contentType === "audio"
              ? "URL аудіо"
              : contentType === "video"
                ? "URL відео"
                : "URL для вбудовування (iframe src)"}
          </label>
          <input
            name="media_url"
            defaultValue={initialGroup?.media_url ?? ""}
            className="rounded-md border px-3 py-2 text-sm"
          />
        </div>
      )}

      {contentType === "audio" && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">
            Або завантажити аудіофайл (перекриє URL вище, якщо вибрано)
          </label>
          <input type="file" name="media_audio_file" accept="audio/*" className="text-sm" />
        </div>
      )}

      {(contentType === "video" || contentType === "audio") && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">Платформа</label>
          <select
            name="media_provider"
            defaultValue={initialGroup?.media_provider ?? "youtube"}
            className="w-fit rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="youtube">YouTube</option>
            <option value="gdrive">Google Drive</option>
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs text-neutral-500 dark:text-neutral-400">
          Підсумок балів блоку
        </label>
        <select
          name="points_mode"
          value={pointsMode}
          onChange={(e) => setPointsMode(e.target.value)}
          className="w-fit rounded-md border px-2 py-1.5 text-sm"
        >
          <option value="sum">Сума балів окремих завдань</option>
          <option value="flat">Один загальний бал на весь блок</option>
        </select>
      </div>

      {pointsMode === "flat" && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">
            Загальний бал за блок (зараховується пропорційно середньому % правильності всіх
            завдань блоку)
          </label>
          <input
            name="flat_points"
            type="number"
            min={0}
            step={0.5}
            defaultValue={initialGroup?.flat_points ?? 1}
            className="w-24 rounded-md border px-2 py-1.5 text-sm"
          />
        </div>
      )}
    </>
  );
}
