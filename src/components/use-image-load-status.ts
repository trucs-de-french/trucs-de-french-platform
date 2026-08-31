"use client";

import { useEffect, useState } from "react";

// Попередньо перевіряє, чи картинка справді завантажується, ЩЕ ДО того, як
// вставити <img> у DOM — так бита картинка ніколи не встигає бути видимою
// (на відміну від onError на самому <img>, який на практиці не завжди
// встигає сховати биту іконку).
export function useImageLoadStatus(url: string | null | undefined): "idle" | "ok" | "failed" {
  const [status, setStatus] = useState<"ok" | "failed" | null>(null);

  useEffect(() => {
    if (!url) return;

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setStatus("ok");
    };
    img.onerror = () => {
      if (!cancelled) setStatus("failed");
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url) return "idle";
  return status ?? "idle";
}
