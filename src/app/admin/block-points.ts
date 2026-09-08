// Максимум балів блоку для адмінки — рахується СЕРВЕРНО, без проходження
// студентом вправи (на відміну від TaskGroupBlock, який підсумовує реальні
// GradeResult після перевірки). Кожна з 13 gradeXxx-функцій у grade.ts вже
// рахує pointsPossible ВИКЛЮЧНО з config (answer впливає лише на
// pointsEarned/correct) — тож замість дублювання per-type формул тут просто
// проганяємо gradeAnswer з порожньою відповіддю (безпечно для всіх 13 типів:
// .map()/індексація на [] не падає) і беремо лише pointsPossible.
import { gradeAnswer } from "@/lib/exercises/grade";
import { isGradableTaskType } from "@/lib/exercises/gradable-types";
import { createClient } from "@/lib/supabase/server";

type Supa = Awaited<ReturnType<typeof createClient>>;

export function resolveMaxPoints(type: string, config: Record<string, unknown> | null): number {
  if (!isGradableTaskType(type)) return 0;
  return gradeAnswer(type, config ?? {}, []).pointsPossible ?? 0;
}

export type GroupPointsInput = { points_mode?: string; flat_points?: number | null };
export type MemberTaskInput = { type: string; config: Record<string, unknown> | null };

// Режим "фіксовано" — просто flat_points (те, що вчитель задав напряму).
// Режим "сума" — сума resolveMaxPoints по гейдованих членах (essay_check/
// callout/link/game/embed серед членів не мають points узагалі, isGradableTaskType
// відсіює їх через resolveMaxPoints).
export function resolveGroupMaxPoints(group: GroupPointsInput, memberTasks: MemberTaskInput[]): number {
  if (group.points_mode === "flat") return group.flat_points ?? 0;
  return memberTasks.reduce((sum, t) => sum + resolveMaxPoints(t.type, t.config), 0);
}

// Один запит для КІЛЬКОХ блоків одразу (флет-список курсу, сторінка
// матеріалу, сторінка сцени — всі показують кілька рядків-блоків за раз) —
// уникає N+1. Сторінці самого блоку (task-groups/[groupId]) цей хелпер не
// потрібен — вона вже й так завантажує свій єдиний список членів, туди
// достатньо додати config у вже наявний select.
export async function fetchGroupMemberTasks(
  supabase: Supa,
  groupIds: string[]
): Promise<Record<string, MemberTaskInput[]>> {
  if (groupIds.length === 0) return {};
  const { data } = await supabase
    .from("tasks")
    .select("task_group_id, type, config")
    .in("task_group_id", groupIds);

  const byGroup: Record<string, MemberTaskInput[]> = {};
  for (const t of data ?? []) {
    const groupId = t.task_group_id as string;
    const arr = byGroup[groupId] ?? [];
    arr.push({ type: t.type, config: t.config });
    byGroup[groupId] = arr;
  }
  return byGroup;
}
