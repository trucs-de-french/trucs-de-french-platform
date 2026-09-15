"use client";

import { useTransition } from "react";
import { setStudentPreviewCookie } from "@/app/admin/courses/actions";
import { setThemeCookie } from "@/lib/theme-cookie";

// Винесено з save-form.tsx — той самий хендлер потрібен і поза формою
// (scene-sticky-actions.tsx), не лише всередині SaveForm.
export function useStudentPreview(productId: string, href: string) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    // window.open МАЄ бути синхронним усередині обробника кліка — інакше
    // браузер трактує його як програмний popup (не "у відповідь на дію
    // користувача") і блокує. Тому відкриваємо порожню вкладку одразу, а
    // навігацію в неї застосовуємо вже після того, як кука прев'ю
    // виставиться на сервері.
    const newTab = window.open("", "_blank");
    // Кука теми (не URL-параметр) — той самий origin, тож нова вкладка
    // отримає її автоматично в заголовку Cookie свого ж запиту, і
    // layout.tsx вставить правильний клас у <html> ВЖЕ на сервері, до
    // будь-якого клієнтського JS.
    const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    setThemeCookie(theme);
    startTransition(async () => {
      await setStudentPreviewCookie(productId);
      if (newTab) newTab.location.href = href;
    });
  }

  return { pending, handleClick };
}
