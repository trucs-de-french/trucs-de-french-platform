"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { FrenchLevel, FrenchLevelSource } from "@/lib/supabase/profile";
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
const LEARNING_GOAL_VALUES = ["self", "travel", "work", "move", "exam", "kids"] as const;
const FRENCH_LEVEL_VALUES = ["A0", "A1", "A2", "B1", "B2", "C1C2"] as const;

// profiles.learning_goals/french_level* (0067_profile_goals_level.sql,
// ще НЕ застосована на момент написання — update на неіснуючі колонки
// просто впаде, settings-form.tsx тоді дизейблить саму кнопку "Зберегти"
// ще ДО виклику цієї дії, а не покладається на try/catch тут). Рівень
// з цієї картки — завжди "self", АЛЕ лише коли рівень справді змінився:
// картка вміє зберігати goals без торкання рівня (щоб не перебивати
// свіжіший french_level_source="test" з іншої вкладки, де щойно пройшли
// тест) — звідси читання поточного рядка ПЕРЕД update і порівняння зі
// збереженим значенням, а не з тим, що клієнт вважав початковим.
export async function saveAboutMe(
  formData: FormData
): Promise<{
  ok: boolean;
  error?: string;
  level?: FrenchLevel | null;
  levelSource?: FrenchLevelSource | null;
  levelSetAt?: string | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  const goalsRaw = formData.getAll("goals").map(String);
  const goals = goalsRaw.filter((g): g is (typeof LEARNING_GOAL_VALUES)[number] =>
    (LEARNING_GOAL_VALUES as readonly string[]).includes(g)
  );
  if (goals.length !== goalsRaw.length) {
    return { ok: false, error: "goals" };
  }

  const levelRaw = String(formData.get("level") ?? "");
  if (levelRaw && !(FRENCH_LEVEL_VALUES as readonly string[]).includes(levelRaw)) {
    return { ok: false, error: "level" };
  }
  const submittedLevel = (levelRaw || null) as FrenchLevel | null;

  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select("french_level, french_level_source, french_level_set_at")
    .eq("id", user.id)
    .single();
  if (readError) return { ok: false, error: "db" };

  const storedLevel = (current.french_level ?? null) as FrenchLevel | null;

  const update: {
    learning_goals: typeof goals;
    french_level?: FrenchLevel | null;
    french_level_source?: FrenchLevelSource | null;
    french_level_set_at?: string | null;
  } = { learning_goals: goals };

  let levelSource = current.french_level_source as FrenchLevelSource | null;
  let levelSetAt = current.french_level_set_at as string | null;

  if (submittedLevel !== storedLevel) {
    if (submittedLevel === null) {
      update.french_level = null;
      update.french_level_source = null;
      update.french_level_set_at = null;
      levelSource = null;
      levelSetAt = null;
    } else {
      update.french_level = submittedLevel;
      update.french_level_source = "self";
      update.french_level_set_at = new Date().toISOString();
      levelSource = "self";
      levelSetAt = update.french_level_set_at;
    }
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return { ok: false, error: "db" };

  revalidatePath("/cabinet/settings");
  revalidatePath("/cabinet");
  return { ok: true, level: submittedLevel, levelSource, levelSetAt };
}

// Рівень з теста (/cabinet/placement-test) — рахується на клієнті
// (низький ризик для короткого orientation-теста, без анти-чіт), сюди
// приходить лише готовий рядок рівня. french_level_source завжди 'test'
// тут (на відміну від saveAboutMe, де завжди 'self') — два різних шляхи
// запису в ОДНІ й ті самі колонки. Журнал спроб (placement_attempts)
// сюди більше НЕ пишеться — те окремо й завжди робить logPlacementAttempt
// одразу по завершенню тесту, незалежно від того, чи натиснуть "Зберегти".
export async function savePlacementLevel(level: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  if (!(FRENCH_LEVEL_VALUES as readonly string[]).includes(level)) {
    return { ok: false, error: "level" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ french_level: level, french_level_source: "test", french_level_set_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { ok: false, error: "db" };

  revalidatePath("/cabinet/settings");
  revalidatePath("/cabinet");
  return { ok: true };
}

// Журнал спроб (0068_placement_attempts.sql) — один рядок на КОЖЕН
// завершений тест, незалежно від того, чи буде збережено рівень у
// профіль ("Зберегти" — окрема дія savePlacementLevel, що більше НЕ
// пише сюди). Клієнт викликає це рівно один раз одразу по завершенню
// тесту (на самому переході до екрана результату), з ref-guard'ом від
// повторного виклику при React Strict Mode / ре-рендері.
export async function logPlacementAttempt(attempt: {
  level: string;
  grammarCorrect: number;
  vocabCorrect: number;
  partScores: Record<string, number>;
  durationSeconds: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "auth" };

  if (!(FRENCH_LEVEL_VALUES as readonly string[]).includes(attempt.level)) {
    return { ok: false, error: "level" };
  }

  const { data: before } = await supabase
    .from("profiles")
    .select("french_level")
    .eq("id", user.id)
    .single();
  const previousLevel = (before?.french_level ?? null) as FrenchLevel | null;

  const { error } = await supabase.from("placement_attempts").insert({
    user_id: user.id,
    level: attempt.level,
    previous_level: previousLevel,
    grammar_correct: attempt.grammarCorrect,
    vocab_correct: attempt.vocabCorrect,
    part_scores: attempt.partScores,
    duration_seconds: attempt.durationSeconds,
  });
  if (error) {
    console.error("placement_attempts insert failed:", error);
    return { ok: false, error: "db" };
  }

  return { ok: true };
}

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
