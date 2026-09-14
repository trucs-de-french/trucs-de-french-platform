import { createClient } from "@/lib/supabase/server";
import { CourseSwitcherSidebar } from "./course-switcher-sidebar";

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

  const { data: courses } = await supabase
    .from("products")
    .select("id, title, type")
    .is("archived_at", null)
    .order("title");

  return (
    <div className="mx-[calc(50%-50vw)] w-screen px-6">
      <div className="mx-auto flex max-w-6xl items-start gap-6">
        <CourseSwitcherSidebar courses={courses ?? []} currentCourseId={id} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
