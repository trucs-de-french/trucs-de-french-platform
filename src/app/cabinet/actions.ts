"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";

// Варіанти exam_type — власні назви іспитів, не перекладаються жодною
// мовою інтерфейсу (той самий рядок в uk/fr/en), тож тут і лише тут, а не
// в i18n-словниках.
export const EXAM_TYPE_OPTIONS = [
  "DELF A1",
  "DELF A2",
  "DELF B1",
  "DELF B2",
  "DALF C1",
  "DALF C2",
  "TCF",
  "TEF",
] as const;

// profiles.exam_type/exam_date (0065_cabinet_profile_and_activity.sql) —
// власник рядка (RLS profiles_update_own) може оновити їх напряму; тут
// лише серверна валідація (тип зі списку, дата не в минулому) ДО запису,
// бо форма на клієнті довіряти не може.
export async function saveExam(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const examType = String(formData.get("examType") ?? "");
  const examDate = String(formData.get("examDate") ?? "");

  if (!(EXAM_TYPE_OPTIONS as readonly string[]).includes(examType)) {
    return { ok: false, error: "type" };
  }
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate) || examDate < todayStr) {
    return { ok: false, error: "date" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ exam_type: examType, exam_date: examDate })
    .eq("id", user.id);
  if (error) return { ok: false, error: "db" };

  revalidatePath("/cabinet");
  return { ok: true };
}

// profiles.weekly_goal_scenes — check(1..14) у міграції теж, перевірка тут
// лише щоб повернути чистий {ok:false} замість падіння на constraint.
export async function saveWeeklyGoal(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const goal = Number(formData.get("goal"));
  if (!Number.isInteger(goal) || goal < 1 || goal > 14) {
    return { ok: false, error: "goal" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ weekly_goal_scenes: goal })
    .eq("id", user.id);
  if (error) return { ok: false, error: "db" };

  revalidatePath("/cabinet");
  return { ok: true };
}

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
