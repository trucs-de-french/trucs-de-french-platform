import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Посилання з листа підтвердження email/відновлення пароля веде сюди —
// один route для обох: token_hash+verifyOtp (НЕ PKCE/exchangeCodeForSession
// — той потребував би того самого браузера, що надіслав запит, лист же
// можуть відкрити на іншому пристрої/в in-app browser пошти).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      // type=recovery — сесія вже створена verifyOtp, але студент ще НЕ
      // задав новий пароль: без цієї гілки layout.tsx (!user-guard)
      // пропустив би його просто в /cabinet. Усі інші type (signup тощо)
      // — поведінка БЕЗ змін.
      if (type === "recovery") {
        redirect("/auth/update-password");
      }
      redirect("/cabinet");
    }

    // Посилання для відновлення пароля — застаріле/вже використане:
    // ведемо назад на forgot-password з конкретним поясненням, а не на
    // /login (студент прийшов сюди саме відновлювати пароль).
    if (type === "recovery") {
      redirect("/auth/forgot-password?error=expired");
    }
  }

  redirect("/login?error=" + encodeURIComponent("Посилання недійсне або застаріле"));
}
