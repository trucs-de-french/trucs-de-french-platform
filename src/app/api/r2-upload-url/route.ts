import { createClient } from "@/lib/supabase/server";
import { buildPresignedUploadUrl } from "@/lib/r2-client";

// aws4fetch використовує лише Web Crypto/fetch — сумісний і з edge, і з
// node, але явний "nodejs" для узгодженості з рештою серверних роутів
// проєкту (напр. /api/scenes/[sceneId]/vocab-pdf).
export const runtime = "nodejs";

const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Потрібна авторизація" }, { status: 401 });
  }

  // Той самий чек ролі, що admin/layout.tsx — цей роут не під /admin, тож
  // серверний layout-guard його не захищає автоматично.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "teacher") {
    return Response.json({ error: "Доступ лише для викладача" }, { status: 403 });
  }

  if (!BUCKET || !PUBLIC_URL) {
    return Response.json(
      { error: "R2_BUCKET_NAME/R2_PUBLIC_URL не налаштовані на сервері" },
      { status: 500 }
    );
  }

  const body = (await request.json()) as { filename?: string; contentType?: string };
  const filename = body.filename ?? "";
  const contentType = body.contentType || "application/octet-stream";

  const ext = filename.includes(".") ? filename.split(".").pop() : "mp3";
  const key = `${crypto.randomUUID()}.${ext}`;

  try {
    const uploadUrl = await buildPresignedUploadUrl(BUCKET, key, contentType);
    const publicUrl = `${PUBLIC_URL.replace(/\/$/, "")}/${key}`;
    return Response.json({ uploadUrl, publicUrl, contentType });
  } catch (error) {
    console.error("r2-upload-url: не вдалося підписати URL", error);
    return Response.json({ error: "Не вдалося підготувати завантаження" }, { status: 500 });
  }
}
