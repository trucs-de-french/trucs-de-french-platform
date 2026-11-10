"use client";

// Спільний аватар профілю — бічна панель кабінету (розгорнута й колапс),
// мобільна картка профілю на домашній сторінці і settings/profile-card.tsx,
// щоб стиль жив в одному місці (.profile-avatar/.dark .profile-avatar в
// globals.css). Пріоритет: imageUrl (завантажене фото) > mascotId (вибраний
// маскот) > ініціал на indigo-градієнті. Усе кругле (border-radius 50% уже
// в .profile-avatar; .profile-avatar-img додає object-fit: cover).
//
// "use client" — потрібен лише щоб обробити onError (зіпсоване/ще не
// додане зображення маскота/фото) через useState; сам рендер лишається
// тим самим деревом і на сервері, і на клієнті (fallback не блимає при
// гідратації, бо з'являється лише ПІСЛЯ помилки завантаження картинки).
import { useState } from "react";
import { findMascot, mascotNumber } from "@/lib/cabinet/mascots";

export function ProfileAvatar({
  name,
  size,
  imageUrl = null,
  mascotId = null,
  className = "",
  alt,
  loading = "eager",
}: {
  name: string;
  size: number;
  imageUrl?: string | null;
  mascotId?: string | null;
  className?: string;
  // За замовчуванням декоративний (alt="" aria-hidden) — як і скрізь,
  // де аватар лише ілюструє ім'я/вибір, що вже озвучене поруч. Грід
  // вибору маскота (mascot-picker.tsx) передає справжній alt=label,
  // бо там картинка — єдиний спосіб розрізнити варіанти.
  alt?: string;
  loading?: "eager" | "lazy";
}) {
  const [broken, setBroken] = useState(false);
  const trimmed = name.trim();
  const initial = (trimmed[0] ?? "?").toUpperCase();
  const fontSize = Math.round(size * 0.44);

  const src = imageUrl ?? findMascot(mascotId)?.src ?? null;

  if (src && !broken) {
    return (
      <img
        src={src}
        alt={alt ?? ""}
        aria-hidden={alt ? undefined : "true"}
        loading={loading}
        onError={() => setBroken(true)}
        className={`profile-avatar profile-avatar-img ${className}`.trim()}
        style={{ width: size, height: size }}
      />
    );
  }

  // Маскот вибраний, але картинка не завантажилась (ще не додана) —
  // нейтральний сірий кружок із номером маскота, не ініціал імені: так
  // студентка бачить, що це саме маскот №N тимчасово без картинки, а не
  // що вибір не зберігся.
  if (!imageUrl && mascotId && broken) {
    return (
      <span
        className={`profile-avatar profile-avatar--placeholder ${className}`.trim()}
        aria-hidden="true"
        style={{ width: size, height: size, fontSize }}
      >
        {mascotNumber(mascotId)}
      </span>
    );
  }

  return (
    <span
      className={`profile-avatar ${className}`.trim()}
      aria-hidden="true"
      style={{ width: size, height: size, fontSize }}
    >
      {initial}
    </span>
  );
}
