"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Видаляє ВЕСЬ DELF-тест — усі задачі й блоки з цим product_id+
// delf_test_number, безповоротно. Немає окремого рядка "тест" для
// видалення (той самий підхід, що вже скрізь у цій фічі — номер тесту
// існує лише як значення на задачах/блоках), тож це два DELETE, не один.
//
// Порядок не має значення: task_groups.delete() каскадно видаляє СВОЇХ
// членів через tasks.task_group_id FK (0031_task_groups.sql) — на відміну
// від deleteTaskGroup (яка НЕ покладається на каскад для ОДНОГО блоку, щоб
// не губити задачі поза контекстом видалення), тут каскад — саме те, що
// треба: весь тест видаляється разом, члени блоків цього тесту й так
// мають зникнути. Самостійні задачі тесту (delf_test_number=N напряму, без
// task_group_id) — окремий, неперетинний набір рядків, той самий принцип
// взаємовиключності контексту.
export async function deleteTest(productId: string, testNumber: number) {
  const supabase = await createClient();

  const { error: groupsError } = await supabase
    .from("task_groups")
    .delete()
    .eq("product_id", productId)
    .eq("delf_test_number", testNumber);

  const { error: tasksError } = await supabase
    .from("tasks")
    .delete()
    .eq("product_id", productId)
    .eq("delf_test_number", testNumber);

  const error = groupsError ?? tasksError;
  if (error) {
    redirect(`/admin/courses/${productId}?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/admin/courses/${productId}`);
}
