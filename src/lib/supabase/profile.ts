import { createClient } from "./server";
import { normalizeUiLang } from "@/lib/ui/product-lang";

// Профіль користувача (public.profiles) — мінімальний спільний тип,
// раніше запити до profiles типувались ad-hoc в кожному місці окремо.
// ui_lang — 0064_profiles_ui_lang.sql, персональна мова кабінету студента
// (не плутати з products.ui_lang — мовою завдань конкретного продукту).
export type Profile = {
  id: string;
  role: "student" | "teacher";
  full_name: string | null;
  ui_lang: "uk" | "fr" | "en";
  created_at: string;
};

// Легкий per-request запит (role/full_name/ui_lang лише), спільний для
// сторінок кабінету — layout.tsx робить свій власний запит (для sidebar),
// сторінки викликають цей, не ділячись стейтом через контекст (app router
// layout не передає пропси в children напряму).
export async function getCabinetProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { lang: "uk" as const, fullName: null, email: null, isTeacher: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, ui_lang, role")
    .eq("id", user.id)
    .single<Pick<Profile, "full_name" | "ui_lang" | "role">>();

  return {
    lang: normalizeUiLang(profile?.ui_lang),
    fullName: profile?.full_name ?? null,
    email: user.email ?? null,
    isTeacher: profile?.role === "teacher",
  };
}
