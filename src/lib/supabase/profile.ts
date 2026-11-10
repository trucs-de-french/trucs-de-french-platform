import { createClient } from "./server";
import { normalizeUiLang } from "@/lib/ui/product-lang";

// Профіль користувача (public.profiles) — мінімальний спільний тип,
// раніше запити до profiles типувались ad-hoc в кожному місці окремо.
// ui_lang — 0064_profiles_ui_lang.sql, персональна мова кабінету студента
// (не плутати з products.ui_lang — мовою завдань конкретного продукту).
// exam_type/exam_date/weekly_goal_scenes — 0065_cabinet_profile_and_activity.sql.
export type NotificationPrefs = { review: boolean; weekly_goal: boolean; news: boolean };

// learning_goals/french_level* — 0067_profile_goals_level.sql (ще не
// застосована на момент написання коду — settings/page.tsx читає їх
// ОКРЕМИМ запитом у try/catch, деградуючи до порожніх значень, якщо
// колонок ще нема). Нічого з цих полів поки не читається деінде в
// кабінеті (явна вимога задачі — лише зберігання).
export type LearningGoal = "self" | "travel" | "work" | "move" | "exam" | "kids";
export type FrenchLevel = "A0" | "A1" | "A2" | "B1" | "B2";
export type FrenchLevelSource = "self" | "test";

export type Profile = {
  id: string;
  role: "student" | "teacher";
  full_name: string | null;
  ui_lang: "uk" | "fr" | "en";
  exam_type: string | null;
  exam_date: string | null;
  weekly_goal_scenes: number;
  avatar_url: string | null;
  avatar_mascot: string | null;
  notification_prefs: NotificationPrefs;
  learning_goals: LearningGoal[];
  french_level: FrenchLevel | null;
  french_level_source: FrenchLevelSource | null;
  french_level_set_at: string | null;
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
