import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDelfTask } from "@/lib/exercises/delf";
import type { LetterRearrangementConfig } from "@/lib/exercises/types";

// Єдина причина існування цього маршруту: LetterRearrangementPublic
// НІКОЛИ не містить правильного порядку літер (на відміну від
// CrosswordPublic.solution чи LetterGapsPublicWord.hiddenLetters, де
// підказку можна намалювати суто на клієнті) — кнопка-лампочка тому
// питає по ОДНІЙ літері за раз замість того, щоб отримати весь
// розв'язок наперед чи в "зашифрованому" вигляді (останнє однаково
// зворотне на клієнті, лише складніше й оманливо-безпечне на вигляд).
// Доступ до config — той самий шлях, що /api/exercises/check
// (authenticated Supabase client, anon-ключ під RLS, БЕЗ
// service-role) — читає лише те завдання, до якого в студента вже є
// доступ за політиками RLS.
export async function POST(request: Request) {
  const body = await request.json();
  const taskId = body.taskId as string | undefined;
  const wordIndex = body.wordIndex as number | undefined;
  const position = body.position as number | undefined;

  if (!taskId || typeof wordIndex !== "number" || typeof position !== "number") {
    return NextResponse.json(
      { error: "Поля taskId, wordIndex і position обов'язкові" },
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

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, type, config, delf_section, delf_test_number, task_group_id")
    .eq("id", taskId)
    .single();

  if (taskError || !task || task.type !== "letter_rearrangement") {
    return NextResponse.json({ error: "Завдання не знайдено" }, { status: 404 });
  }

  // DELF — жодних підказок, навіть за прямим викликом маршруту в обхід UI
  // (кнопка й так уже прихована на клієнті, isDelf).
  if (await isDelfTask(supabase, task)) {
    return NextResponse.json({ error: "Підказки недоступні для DELF-тестів" }, { status: 403 });
  }

  const config = task.config as LetterRearrangementConfig;
  const word = config.words?.[wordIndex]?.word;

  if (word === undefined || position < 0 || position >= word.length) {
    return NextResponse.json({ error: "Некоректний індекс" }, { status: 400 });
  }

  return NextResponse.json({ letter: word[position] });
}
