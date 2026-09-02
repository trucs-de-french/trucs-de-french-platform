import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gradeAnswer } from "@/lib/exercises/grade";

export async function POST(request: Request) {
  const body = await request.json();
  const exerciseId = body.exerciseId as string | undefined;
  const answer = body.answer;

  if (!exerciseId || answer === undefined) {
    return NextResponse.json(
      { error: "Поля exerciseId і answer обов'язкові" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Потрібна авторизація" }, { status: 401 });
  }

  // RLS (remedial_exercises_select) і так обмежує вибіркою власника, .eq
  // user_id тут — явність, а не єдиний захист.
  const { data: exercise, error: fetchError } = await supabase
    .from("remedial_exercises")
    .select("id, config")
    .eq("id", exerciseId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !exercise) {
    return NextResponse.json({ error: "Вправу не знайдено" }, { status: 404 });
  }

  const result = gradeAnswer("fill_blank", exercise.config as Record<string, unknown>, answer);

  await supabase
    .from("remedial_exercises")
    .update({
      student_answer: answer,
      score: result.score,
      completed_at: new Date().toISOString(),
    })
    .eq("id", exercise.id);

  return NextResponse.json(result);
}
