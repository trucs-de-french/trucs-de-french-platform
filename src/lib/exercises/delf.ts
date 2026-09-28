import type { SupabaseClient } from "@supabase/supabase-js";

// Єдине місце, де визначається "ця задача належить DELF-тесту" — сервером
// (API-маршрути підказок), а не в кожному компоненті окремо. Задача
// належить тесту АБО напряму (delf_section+delf_test_number на самому
// tasks-рядку), АБО через блок задач (tasks.task_group_id): задачі-члени
// блоку лишають ВЛАСНІ delf_section/delf_test_number null і успадковують їх
// від task_groups (0031_task_groups.sql) — тому для такої задачі треба
// окремо доглянути групу.
export type DelfTaskFields = {
  delf_section: string | null;
  delf_test_number: number | null;
  task_group_id: string | null;
};

export async function isDelfTask(
  supabase: SupabaseClient,
  task: DelfTaskFields
): Promise<boolean> {
  if (task.delf_section != null || task.delf_test_number != null) return true;
  if (!task.task_group_id) return false;

  const { data: group } = await supabase
    .from("task_groups")
    .select("delf_section, delf_test_number")
    .eq("id", task.task_group_id)
    .single();

  return !!group && (group.delf_section != null || group.delf_test_number != null);
}
