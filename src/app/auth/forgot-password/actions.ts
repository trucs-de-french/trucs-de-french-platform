"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Той самий redirectTo, що requestPasswordReset (cabinet/settings/
// actions.ts) — одне й те саме /auth/confirm обробляє і лист студента,
// що просить відновити пароль НЕ залогінившись, і лист "Змінити пароль"
// із /cabinet/settings. origin — той самий спосіб (headers().get("origin")
// з фолбеком на host), без нової env-змінної.
//
// Результат ЗАВЖДИ однаковий ("лист надіслано"), незалежно від того, чи
// існує акаунт з цим email — resetPasswordForEmail сам не розкриває
// існування акаунта, і ми не додаємо власної перевірки, що могла б це
// зробити. Єдиний виняток — rate limit (429/over_email_send_rate_limit):
// це про спробу студента, не про існування акаунта, тож безпечно
// показати окреме повідомлення.
export async function requestPasswordResetByEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!EMAIL_REGEX.test(email)) {
    redirect("/auth/forgot-password?error=invalid_email");
  }

  const supabase = await createClient();
  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm`,
  });

  if (error && (error.status === 429 || error.code === "over_email_send_rate_limit")) {
    redirect("/auth/forgot-password?error=rate_limited");
  }

  redirect("/auth/forgot-password?sent=1");
}
