import { createClient } from "@/lib/supabase/server";

// Той самий чек ролі, що admin/layout.tsx (сторінки) і api/r2-upload-url
// (route handler) — тут лише для Server Actions у src/app/admin/**/actions.ts.
// Server Action — публічний POST-ендпоінт, сторінковий layout-guard його не
// захищає автоматично, тож кожна дія, що пише чи читає привілейовані дані,
// викликає requireTeacher()/requireTeacherOrThrow() ПЕРШИМ рядком.
//
// Повертає ОДИН session-клієнт (anon key, підпорядкований RLS) — той самий,
// який дія інакше створила б сама через createClient(); ніколи не
// service-role і ніколи не кешується між запитами (createClient() сам
// читає cookies() поточного запиту).
export type TeacherSession = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string };
};

export async function requireTeacher(): Promise<TeacherSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "teacher") return null;

  return { supabase, user };
}

export async function requireTeacherOrThrow(): Promise<TeacherSession> {
  const session = await requireTeacher();
  if (!session) throw new Error("Forbidden");
  return session;
}
