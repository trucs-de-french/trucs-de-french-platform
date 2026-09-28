import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isDelfTask } from "@/lib/exercises/delf";
import { BLANK_RE } from "@/lib/exercises/sanitize";
import type { FillBlankConfig, TableFillConfig } from "@/lib/exercises/types";

// Спільний маршрут для fill_blank (пропуск за індексом) і table_fill
// (клітинка за rowId+side) — обидва повертають лише ПЕРШУ літеру першого
// прийнятного варіанта відповіді, ніколи весь конфіг. Доступ — той самий
// шлях, що /api/exercises/check (authenticated Supabase client, anon-ключ
// під RLS, БЕЗ service-role). DELF — окрема жорстка заборона (403), навіть
// якщо викликати маршрут напряму, не лише сховати кнопку на клієнті.
export async function POST(request: Request) {
  const body = await request.json();
  const taskId = body.taskId as string | undefined;
  const kind = body.kind as "fill_blank" | "table_fill" | undefined;

  if (!taskId || (kind !== "fill_blank" && kind !== "table_fill")) {
    return NextResponse.json({ error: "Некоректний запит" }, { status: 400 });
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

  if (taskError || !task || task.type !== kind) {
    return NextResponse.json({ error: "Завдання не знайдено" }, { status: 404 });
  }

  if (await isDelfTask(supabase, task)) {
    return NextResponse.json({ error: "Підказки недоступні для DELF-тестів" }, { status: 403 });
  }

  if (kind === "fill_blank") {
    const config = task.config as FillBlankConfig;
    const blankIndex = body.blankIndex as number | undefined;
    if (typeof blankIndex !== "number") {
      return NextResponse.json({ error: "Некоректний індекс" }, { status: 400 });
    }
    const matches = [...(config.template ?? "").matchAll(BLANK_RE)];
    const acceptedRaw = matches[blankIndex]?.[1];
    const first = acceptedRaw?.split("|")[0];
    if (!first) {
      return NextResponse.json({ error: "Некоректний індекс" }, { status: 400 });
    }
    return NextResponse.json({ letter: first[0] });
  }

  // table_fill
  const config = task.config as TableFillConfig;
  const rowId = body.rowId as string | undefined;
  const side = body.side as "left" | "right" | undefined;
  if (!rowId || (side !== "left" && side !== "right")) {
    return NextResponse.json({ error: "Некоректні дані" }, { status: 400 });
  }
  const row = config.rows?.find((r) => r.id === rowId);
  const hidden = row && (side === "left" ? row.leftHidden : row.rightHidden);
  if (!row || !hidden) {
    return NextResponse.json({ error: "Некоректні дані" }, { status: 400 });
  }
  const raw = side === "left" ? row.left : row.right;
  const first = raw?.split("|")[0];
  if (!first) {
    return NextResponse.json({ error: "Немає відповіді" }, { status: 400 });
  }
  return NextResponse.json({ letter: first[0] });
}
