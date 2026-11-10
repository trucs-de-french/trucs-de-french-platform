"use client";

// Профіль: прев'ю аватара (92px) + завантаження фото/видалення + пікер
// маскотів + ім'я/email. Фото завантажується в Storage ОДРАЗУ при виборі
// файлу (crop/resize тут, не на сервері) — лише сам запис avatar_url/
// avatar_mascot у profiles чекає на загальну кнопку "Зберегти" нижче
// (settings-form.tsx), як і решта полів цієї картки.
import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { ProfileAvatar } from "@/components/cabinet/profile-avatar";
import { MascotPicker } from "./mascot-picker";
import { createClient } from "@/lib/supabase/client";
import { validatePhotoFile, compressImage } from "@/lib/cabinet/avatar-upload";
import { CardTitle } from "@/components/cabinet/card-title";

export function SettingsProfileCard({
  lang,
  userId,
  name,
  email,
  mascot,
  avatarUrl,
  onNameChange,
  onMascotChange,
  onAvatarUrlChange,
}: {
  lang: UiLang;
  userId: string;
  name: string;
  email: string;
  mascot: string | null;
  avatarUrl: string | null;
  onNameChange: (value: string) => void;
  onMascotChange: (value: string | null) => void;
  onAvatarUrlChange: (value: string | null) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Прибирання object URL прев'ю — і при розмонтуванні, і щоразу, коли
  // прев'ю заміняється новим (інакше URL.createObjectURL протікав би
  // пам'ять при виборі кількох файлів поспіль).
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  function setPreview(url: string | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreviewUrl(url);
  }

  async function handleFile(file: File) {
    setError(null);
    const invalid = validatePhotoFile(file);
    if (invalid) {
      setError(t(lang, invalid === "type" ? "settings.photo.error.type" : "settings.photo.error.size"));
      return;
    }

    setPreview(URL.createObjectURL(file));

    setCompressing(true);
    let blob: Blob;
    try {
      blob = await compressImage(file);
    } catch {
      setCompressing(false);
      setPreview(null);
      setError(t(lang, "settings.photo.error.upload"));
      return;
    }
    setCompressing(false);

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      // Унікальне ім'я (timestamp) — cache-busting і водночас позначка
      // "найновішого" файлу для серверного прибирання старих
      // (saveProfileSettings/actions.ts, ПІСЛЯ успішного запису в БД, не
      // тут — інакше провал збереження лишив би аватар зламаним).
      const path = `${userId}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { contentType: blob.type });
      if (uploadError) throw uploadError;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      onAvatarUrlChange(pub.publicUrl);
      onMascotChange(null);
    } catch {
      setError(t(lang, "settings.photo.error.upload"));
    } finally {
      setUploading(false);
      setPreview(null);
    }
  }

  return (
    <div className="cabinet-card flex flex-col gap-3 p-5 md:col-span-2">
      <CardTitle>{t(lang, "settings.section.profile")}</CardTitle>

      <div className="flex flex-col items-start gap-4 min-[560px]:flex-row">
        <ProfileAvatar name={name} size={92} imageUrl={previewUrl ?? avatarUrl} mascotId={mascot} />
        {/* Права колонка: кнопка, підказка, лейбл маскота, грід і тоглер —
            усі вирівняні по лівому краю кнопки "Завантажити фото" (items-
            start + w-full на кожному дочірньому блоку, а не центрування
            рядка, як було раніше). */}
        <div className="flex w-full flex-col items-start gap-2 min-[560px]:min-w-0 min-[560px]:flex-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploading || compressing}
              onClick={() => inputRef.current?.click()}
              className="min-h-11 rounded-full px-4 text-sm font-bold text-[var(--cabinet-on-gold)] disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" }}
            >
              {compressing ? t(lang, "settings.photo.compressing") : t(lang, "settings.photo.upload")}
            </button>
            {avatarUrl && (
              <button
                type="button"
                disabled={uploading || compressing}
                onClick={() => onAvatarUrlChange(null)}
                className="flex min-h-11 items-center justify-center rounded-full border border-[var(--cabinet-line)] bg-transparent px-4 text-sm font-bold text-[var(--cabinet-ghost-fg)] hover:bg-[var(--cabinet-ghost-bg-hover)] disabled:opacity-60 dark:border-[1.5px] dark:border-[var(--cabinet-btn-border)] dark:focus-visible:outline-2 dark:focus-visible:outline-offset-2 dark:focus-visible:outline-[var(--cabinet-focus-ring)]"
              >
                {t(lang, "settings.photo.remove")}
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void handleFile(file);
            }}
          />
          <p className="text-xs text-[var(--cabinet-muted)]">{t(lang, "settings.photo.hint")}</p>
          {error && <p className="text-xs text-[#9b4a44] dark:text-[#e2a49c]">{error}</p>}

          <div className="mt-2 w-full">
            <p className="mb-2 text-sm font-semibold text-[var(--cabinet-muted)]">
              {t(lang, "settings.mascot.label")}
            </p>
            <MascotPicker
              lang={lang}
              selected={mascot}
              onSelect={(id) => {
                onMascotChange(id);
                onAvatarUrlChange(null);
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[var(--cabinet-muted)]">
            {t(lang, "settings.name.label")}
          </span>
          <input
            value={name}
            maxLength={40}
            onChange={(e) => onNameChange(e.target.value)}
            className="cabinet-input"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[var(--cabinet-muted)]">
            {t(lang, "settings.email.label")}
          </span>
          <input value={email} readOnly disabled className="cabinet-input opacity-60" />
        </label>
      </div>
    </div>
  );
}
