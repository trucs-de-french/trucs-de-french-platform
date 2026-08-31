"use client";

import { useImageLoadStatus } from "./use-image-load-status";

// Єдина точка правди для "картинка за URL чи ні" — щоб flip-cards/task-media
// не могли знову розійтися в поведінці. Три стани: немає URL — нічого; URL
// є, завантажилась — картинка; URL є, не завантажилась — плейсхолдер (не
// нативна бита іконка браузера).
export function ImageOrPlaceholder({
  src,
  alt,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  className: string;
}) {
  const status = useImageLoadStatus(src);

  if (status === "idle") return null;

  if (status === "failed") {
    return (
      <div
        className={`flex items-center justify-center bg-neutral-100 text-center text-xs text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500 ${className}`}
      >
        Зображення недоступне
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src as string} alt={alt} className={className} />;
}
