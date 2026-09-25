"use client";

import type { CSSProperties } from "react";
import { useImageLoadStatus } from "./use-image-load-status";
import { parseImageFocus } from "@/lib/image-focus";

// Єдина точка правди для "картинка за URL чи ні" — щоб flip-cards/task-media
// не могли знову розійтися в поведінці. Три стани: немає URL — нічого; URL
// є, завантажилась — картинка; URL є, не завантажилась — плейсхолдер (не
// нативна бита іконка браузера).
//
// Фокус кадрування (#focus=X,Y у самому src, src/lib/image-focus.ts) —
// <img src> ЗАВЖДИ рендериться без фрагмента (parseImageFocus.src),
// незалежно від useFocus, оскільки фрагмент — суто клієнтська розмітка, не
// частина реального шляху до файлу. useFocus=true додатково застосовує
// objectPosition з розпарсеної точки — вмикати лише для object-cover
// мініатюр (де кадрування видиме), НЕ для object-contain показу картинки
// цілком (там кадр не обрізається, фокус нічого не змінив би, крім
// зсуву в межах "letterbox"-порожнього простору — свідомо ігнорується).
export function ImageOrPlaceholder({
  src,
  alt,
  className,
  style,
  useFocus = false,
}: {
  src: string | null | undefined;
  alt: string;
  className: string;
  style?: CSSProperties;
  useFocus?: boolean;
}) {
  const parsed = src ? parseImageFocus(src) : null;
  const status = useImageLoadStatus(parsed?.src ?? src);

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

  const mergedStyle =
    useFocus && parsed ? { ...style, objectPosition: `${parsed.x}% ${parsed.y}%` } : style;

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={parsed?.src ?? (src as string)} alt={alt} className={className} style={mergedStyle} />;
}
