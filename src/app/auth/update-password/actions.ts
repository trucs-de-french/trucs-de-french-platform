"use server";

import type { AuthError } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export const MIN_PASSWORD_LENGTH = 8;

export type UpdatePasswordError =
  | "too_short"
  | "mismatch"
  | "same_password"
  | "weak_password"
  | "session_missing"
  | "generic";

// Мапить сирі повідомлення/коди Supabase на наші ключі — ніколи не
// показуємо студенту сирий текст Supabase напряму (різні версії API
// повертають трохи різні формулювання, тож перевіряємо і code, і
// фрагменти message, не лише одне з двох).
function mapSupabaseError(error: AuthError): UpdatePasswordError {
  const code = (error as AuthError & { code?: string }).code;
  const message = error.message?.toLowerCase() ?? "";

  if (code === "same_password" || message.includes("different from the old password")) {
    return "same_password";
  }
  if (code === "weak_password" || message.includes("weak") || message.includes("should be at least")) {
    return "weak_password";
  }
  if (
    code === "session_not_found" ||
    message.includes("session missing") ||
    message.includes("not authenticated") ||
    message.includes("auth session missing")
  ) {
    return "session_missing";
  }
  return "generic";
}

// Викликається напряму (не як `<form action>`) з клієнтського
// UpdatePasswordForm — так клієнт лишається власником значень полів і
// може зберегти їх після невдалої спроби (сервер ніколи не "ехо" пароль
// назад, лише код помилки). Пароль ніде не логується.
export async function updatePassword(
  password: string,
  confirmPassword: string
): Promise<{ ok: boolean; error?: UpdatePasswordError }> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, error: "too_short" };
  }
  if (password !== confirmPassword) {
    return { ok: false, error: "mismatch" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { ok: false, error: mapSupabaseError(error) };
  }

  revalidatePath("/cabinet", "layout");
  return { ok: true };
}
