"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";

// Мова інтерфейсу кабінету — персональна (profiles.ui_lang, 0064), окремо
// від products.ui_lang (мова завдань конкретного курсу). RLS
// "profiles_update_own" (0062_profiles_role_update_guard.sql) вже дозволяє
// власнику рядка міняти будь-яку колонку, крім role, тож тут достатньо
// звичайного update під сесійним (anon-key) клієнтом.
export async function setCabinetUiLang(lang: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const normalized = normalizeUiLang(lang);

  await supabase.from("profiles").update({ ui_lang: normalized }).eq("id", user.id);

  revalidatePath("/cabinet", "layout");
}
