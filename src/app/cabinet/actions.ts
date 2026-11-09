"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { isExamType } from "@/lib/cabinet/exam-types";
import { isExamProductType } from "@/lib/cabinet/exam-products";

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

  if (!isExamType(examType)) {
    return { ok: false, error: "type" };
  }
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(examDate) || examDate < todayStr) {
    return { ok: false, error: "date" };
  }

  // Еліджбл: вже є збережена ціль (редагує існуючу) або активна
  // enrollment у продукт екзаменаційного типу (delf/...) — та сама умова,
  // що показує/ховає картку на Home (home-data.ts showExamCard), але тут
  // перевіряється на сервері окремо: UI-приховування картки не захищає
  // від прямого POST без eligibility.
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("exam_type, exam_date")
    .eq("id", user.id)
    .single<{ exam_type: string | null; exam_date: string | null }>();
  const hasSavedExamGoal = !!(existingProfile?.exam_type && existingProfile?.exam_date);

  if (!hasSavedExamGoal) {
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("products!inner(type, archived_at, is_published)")
      .eq("user_id", user.id)
      .eq("status", "active");
    type EnrollmentTypeRow = {
      products: { type: string; archived_at: string | null; is_published: boolean } | null;
    };
    const hasExamProduct = ((enrollments ?? []) as unknown as EnrollmentTypeRow[]).some(
      (row) =>
        row.products &&
        row.products.archived_at === null &&
        row.products.is_published &&
        isExamProductType(row.products.type)
    );
    if (!hasExamProduct) {
      return { ok: false, error: "ineligible" };
    }
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
