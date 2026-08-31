import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Клієнт для Server Components / Server Actions / Route Handlers.
// Працює від імені поточного користувача (використовує anon key + його сесію),
// підпорядковується RLS-політикам.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll викликано з Server Component без можливості писати куки —
            // ігноруємо, якщо є middleware, що оновлює сесію.
          }
        },
      },
    }
  );
}

// Адмін-клієнт з service_role key — ОБХОДИТЬ RLS.
// Використовувати лише в довірених серверних місцях (API route/server action),
// напр. для AI-перевірки DELF-відповідей або адмінських дій викладача.
// Ніколи не імпортувати цей файл у клієнтський ("use client") код.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
