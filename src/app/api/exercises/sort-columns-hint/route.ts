import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDelfTask } from "@/lib/exercises/delf";
import type { SortColumnsConfig } from "@/lib/exercises/types";

// Єдина причина існування цього маршруту: SortColumnsPublic.items НІКОЛИ не
// містить columnId (на відміну від CrosswordPublic.solution чи
// LetterGapsPublicWord.hiddenLetters, де підказку можна намалювати суто на
// клієнті) — лампочка тому питає по ОДНОМУ елементу за раз і отримує лише
// його правильну колонку, а не весь розв'язок наперед. Доступ до config —
// той самий шлях, що /api/exercises/check (authenticated Supabase client,
// anon-ключ під RLS, БЕЗ service-role).
export async function POST(request: Request) {
  const body = await request.json();
  const taskId = body.taskId as string | undefined;
  const itemId = body.itemId as string | undefined;

  if (!taskId || !itemId) {
    return NextResponse.json({ error: "Поля taskId і itemId обов'язкові" }, { status: 400 });
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

  if (taskError || !task || task.type !== "sort_columns") {
    return NextResponse.json({ error: "Завдання не знайдено" }, { status: 404 });
  }

  if (await isDelfTask(supabase, task)) {
    return NextResponse.json({ error: "Підказки недоступні для DELF-тестів" }, { status: 403 });
  }

  const config = task.config as SortColumnsConfig;
  if (!config.hintsEnabled) {
    return NextResponse.json({ error: "Підказки вимкнені для цього завдання" }, { status: 403 });
  }

  const item = config.items?.find((i) => i.id === itemId);
  if (!item) {
    return NextResponse.json({ error: "Елемент не знайдено" }, { status: 400 });
  }

  return NextResponse.json({ columnId: item.columnId });
}
