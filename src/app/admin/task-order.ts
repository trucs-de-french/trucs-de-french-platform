// Спільна логіка order_index для tasks/task_groups — задачі й блоки-сусіди
// (не всередині одна одної) конкурують за ОДНУ спільну послідовність у
// межах одного батьківського контексту (сцена/матеріал/DELF-тест/жоден),
// інакше значення order_index могли б зіштовхнутись між таблицями (задача
// order_index=2 і блок order_index=2 в тій самій сцені), і сортування
// змішаного списку "задачі+блоки" для рендеру студенту стало б
// неоднозначним при рівних значеннях.
//
// Контекст "усередині блоку" (taskGroupId) — виняток: блоки не вкладаються
// одне в одне, тож там задачі впорядковуються самі між собою, без огляду на
// task_groups.
//
// delfSection/delfTestNumber — раніше НЕ існували тут узагалі: усі DELF-
// задачі й блоки (сцена/матеріал відсутні, лише ці два поля) ділили ОДНУ
// спільну послідовність order_index на весь продукт, незалежно від номера
// тесту чи секції — стрілки ↑/↓ і create могли знайти "сусіда" з геть
// іншого тесту. Скоуп — за ПАРОЮ (секція, номер), не лише номером: кожна
// секція одного тесту (CO/CE/PE/PO) має власну незалежну послідовність,
// той самий принцип, що вже "усередині блоку" не залежить від сусідів поза
// ним.
import { createClient } from "@/lib/supabase/server";

type Supa = Awaited<ReturnType<typeof createClient>>;

export type ParentScope = {
  productId: string;
  sceneId: string | null;
  materialId: string | null;
  taskGroupId: string | null;
  // Опційні — старі виклики (сцена/матеріал/усередині блоку) не потребують
  // їх узагалі, ці гілки завжди перевіряються першими. undefined трактується
  // як null (жодного DELF-скоупу).
  delfSection?: string | null;
  delfTestNumber?: number | null;
};

function scopedTaskQuery(supabase: Supa, scope: ParentScope) {
  const base = supabase.from("tasks").select("id, order_index").eq("product_id", scope.productId);
  if (scope.taskGroupId) return base.eq("task_group_id", scope.taskGroupId);
  if (scope.sceneId) return base.eq("scene_id", scope.sceneId);
  if (scope.materialId) return base.eq("material_id", scope.materialId);
  if (scope.delfTestNumber != null) {
    return base
      .eq("delf_section", scope.delfSection as string)
      .eq("delf_test_number", scope.delfTestNumber)
      .is("scene_id", null)
      .is("material_id", null)
      .is("task_group_id", null);
  }
  return base
    .is("scene_id", null)
    .is("material_id", null)
    .is("task_group_id", null)
    .is("delf_test_number", null);
}

function scopedGroupQuery(supabase: Supa, scope: ParentScope) {
  const base = supabase
    .from("task_groups")
    .select("id, order_index")
    .eq("product_id", scope.productId);
  if (scope.sceneId) return base.eq("scene_id", scope.sceneId);
  if (scope.materialId) return base.eq("material_id", scope.materialId);
  if (scope.delfTestNumber != null) {
    return base
      .eq("delf_section", scope.delfSection as string)
      .eq("delf_test_number", scope.delfTestNumber)
      .is("scene_id", null)
      .is("material_id", null);
  }
  return base.is("scene_id", null).is("material_id", null).is("delf_test_number", null);
}

// Наступний order_index для НОВОЇ задачі/блоку в даному батьківському
// контексті — максимум серед задач І блоків цього контексту, +1.
export async function nextOrderIndex(supabase: Supa, scope: ParentScope): Promise<number> {
  if (scope.taskGroupId) {
    const { data } = await scopedTaskQuery(supabase, scope)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data?.order_index ?? 0) + 1;
  }

  const [{ data: lastTask }, { data: lastGroup }] = await Promise.all([
    scopedTaskQuery(supabase, scope).order("order_index", { ascending: false }).limit(1).maybeSingle(),
    scopedGroupQuery(supabase, scope)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return Math.max(lastTask?.order_index ?? 0, lastGroup?.order_index ?? 0) + 1;
}

export type Neighbor = { kind: "task" | "task_group"; id: string; order_index: number };

// Найближчий сусід (задача АБО блок, у той самий бік) у тому самому
// контексті. null — якщо на краю списку. Контекст "усередині блоку" не
// звертається до task_groups (див. scopedGroupQuery — блоки не
// вкладаються).
export async function findNeighbor(
  supabase: Supa,
  scope: ParentScope,
  orderIndex: number,
  direction: "up" | "down"
): Promise<Neighbor | null> {
  const taskQuery =
    direction === "up"
      ? scopedTaskQuery(supabase, scope)
          .lt("order_index", orderIndex)
          .order("order_index", { ascending: false })
      : scopedTaskQuery(supabase, scope)
          .gt("order_index", orderIndex)
          .order("order_index", { ascending: true });

  const groupQuery = scope.taskGroupId
    ? null
    : direction === "up"
      ? scopedGroupQuery(supabase, scope)
          .lt("order_index", orderIndex)
          .order("order_index", { ascending: false })
      : scopedGroupQuery(supabase, scope)
          .gt("order_index", orderIndex)
          .order("order_index", { ascending: true });

  const [{ data: taskNeighbor }, groupResult] = await Promise.all([
    taskQuery.limit(1).maybeSingle(),
    groupQuery ? groupQuery.limit(1).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const groupNeighbor = groupResult?.data ?? null;

  const candidates: Neighbor[] = [];
  if (taskNeighbor) {
    candidates.push({ kind: "task", id: taskNeighbor.id, order_index: taskNeighbor.order_index });
  }
  if (groupNeighbor) {
    candidates.push({
      kind: "task_group",
      id: groupNeighbor.id,
      order_index: groupNeighbor.order_index,
    });
  }
  if (candidates.length === 0) return null;

  return candidates.reduce((best, c) => {
    if (direction === "up") return c.order_index > best.order_index ? c : best;
    return c.order_index < best.order_index ? c : best;
  });
}
