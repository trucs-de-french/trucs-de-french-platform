import { createClient } from "@/lib/supabase/server";
import { CourseSwitcherSidebar, type SidebarCourse } from "./course-switcher-sidebar";

// Батьківський admin/layout.tsx має жорсткий mx-auto max-w-4xl p-6 (потрібний
// admin/courses і admin/courses/new, які лишаються вузькими) — тому тут
// full-bleed breakout (mx-[calc(50%-50vw)] w-screen), а не зміна батька.
// Формула коректна незалежно від власного padding батька: "50%" рахується
// від W (ширина контентної area батька, тобто max-w-4xl мінус його padding),
// а це саме компенсує зсув, який цей padding вносить.
export default async function CourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select("id, title, type")
    .is("archived_at", null)
    .order("title");

  const courses = products ?? [];
  const filmIds = courses.filter((c) => c.type === "film").map((c) => c.id);
  const delfIds = courses.filter((c) => c.type === "delf").map((c) => c.id);

  // Один пакетний запит на ВСІ фільм-курси одразу (не в циклі по курсу) —
  // кількість запитів не залежить від кількості курсів у списку.
  const { data: allScenes } = filmIds.length
    ? await supabase
        .from("scenes")
        .select("id, title, order_index, product_id")
        .in("product_id", filmIds)
        .order("order_index")
    : { data: [] };

  const scenesByProduct = new Map<string, { id: string; title: string }[]>();
  for (const scene of allScenes ?? []) {
    const list = scenesByProduct.get(scene.product_id) ?? [];
    list.push({ id: scene.id, title: scene.title });
    scenesByProduct.set(scene.product_id, list);
  }

  // Та сама derivation-логіка тестів, що в admin/courses/[id]/page.tsx —
  // номер тесту існує лише як delf_test_number на самостійних задачах/
  // блоках, окремої таблиці "тестів" немає. Тут — пакетно на всі DELF-курси.
  const { data: allDelfTasks } = delfIds.length
    ? await supabase
        .from("tasks")
        .select("product_id, delf_test_number")
        .in("product_id", delfIds)
        .is("scene_id", null)
        .is("material_id", null)
        .is("task_group_id", null)
        .not("delf_test_number", "is", null)
    : { data: [] };

  const { data: allDelfTaskGroups } = delfIds.length
    ? await supabase
        .from("task_groups")
        .select("product_id, delf_test_number")
        .in("product_id", delfIds)
        .is("scene_id", null)
        .is("material_id", null)
        .not("delf_test_number", "is", null)
    : { data: [] };

  const testNumbersByProduct = new Map<string, Set<number>>();
  for (const row of [...(allDelfTasks ?? []), ...(allDelfTaskGroups ?? [])]) {
    const set = testNumbersByProduct.get(row.product_id) ?? new Set<number>();
    set.add(row.delf_test_number as number);
    testNumbersByProduct.set(row.product_id, set);
  }

  const sidebarCourses: SidebarCourse[] = courses.map((c) => {
    if (c.type === "film") {
      const scenes = scenesByProduct.get(c.id) ?? [];
      return {
        id: c.id,
        title: c.title,
        type: c.type,
        children: scenes.map((scene, i) => ({
          key: scene.id,
          label: `${i + 1}. ${scene.title}`,
          href: `/admin/courses/${c.id}/scenes/${scene.id}`,
        })),
      };
    }

    const testNumbers = [...(testNumbersByProduct.get(c.id) ?? [])].sort((a, b) => a - b);
    return {
      id: c.id,
      title: c.title,
      type: c.type,
      children: testNumbers.map((n) => ({
        key: String(n),
        label: `Тест ${n}`,
        href: `/admin/courses/${c.id}/tests/${n}`,
      })),
    };
  });

  return (
    <div className="mx-[calc(50%-50vw)] w-screen px-6">
      <div className="mx-auto flex max-w-6xl items-start gap-6">
        <CourseSwitcherSidebar courses={sidebarCourses} currentCourseId={id} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
