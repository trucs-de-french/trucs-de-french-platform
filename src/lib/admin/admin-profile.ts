import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/profile";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type AdminSidebarProfile = {
  fullName: string | null;
  avatarUrl: string | null;
  avatarMascot: string | null;
};

// Той самий запит/та сама обережність, що cabinet/layout.tsx: full_name
// лежить у core-профілі (завжди є), avatar_url/avatar_mascot — окремий
// запит у try/catch, бо міграція 0066_cabinet_settings.sql може ще не
// бути застосована на цій БД (тоді аватар/маскот лишаються null, решта
// профілю — як завжди).
export async function getAdminSidebarProfile(supabase: SupabaseClient, userId: string): Promise<AdminSidebarProfile> {
  const { data: core } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", userId)
    .single<Pick<Profile, "full_name">>();

  let avatarUrl: string | null = null;
  let avatarMascot: string | null = null;
  try {
    const { data: extra } = await supabase
      .from("profiles")
      .select("avatar_url, avatar_mascot")
      .eq("id", userId)
      .single<Pick<Profile, "avatar_url" | "avatar_mascot">>();
    avatarUrl = extra?.avatar_url ?? null;
    avatarMascot = extra?.avatar_mascot ?? null;
  } catch {
    // міграція 0066 ще не застосована — аватар/маскот лишаються null
  }

  return { fullName: core?.full_name ?? null, avatarUrl, avatarMascot };
}
