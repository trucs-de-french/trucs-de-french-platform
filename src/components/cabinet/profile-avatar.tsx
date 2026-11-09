// Спільний аватар профілю — бічна панель кабінету (розгорнута й колапс)
// і мобільна картка профілю на домашній сторінці, щоб стиль жив в
// одному місці (.profile-avatar/.dark .profile-avatar в globals.css).
// imageUrl поки завжди null — фото/маскот ще не підключені (жодної
// колонки БД, бакета чи UI завантаження тут немає), але пропс уже
// готовий під них: коли з'явиться URL, компонент сам покаже <img>
// замість інціала без додаткових змін у викликах.
export function ProfileAvatar({
  name,
  size,
  imageUrl = null,
}: {
  name: string;
  size: number;
  imageUrl?: string | null;
}) {
  const trimmed = name.trim();
  const initial = (trimmed[0] ?? "?").toUpperCase();
  const fontSize = Math.round(size * 0.44);

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        className="profile-avatar profile-avatar-img"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      className="profile-avatar"
      aria-hidden="true"
      style={{ width: size, height: size, fontSize }}
    >
      {initial}
    </span>
  );
}
