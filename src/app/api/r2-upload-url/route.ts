import { createClient } from "@/lib/supabase/server";
import { buildPresignedUploadUrl } from "@/lib/r2-client";

// aws4fetch використовує лише Web Crypto/fetch — сумісний і з edge, і з
// node, але явний "nodejs" для узгодженості з рештою серверних роутів
// проєкту (напр. /api/scenes/[sceneId]/vocab-pdf).
export const runtime = "nodejs";

type UploadKind = "audio" | "image" | "html";

// Один спільний bucket на весь акаунт "не коштував" би нічого зайвого
// (безкоштовний ліміт R2 рахується на акаунт, не на bucket), але окремі
// task-audio/task-images/task-html-games дають чистішу організацію в
// дашборді — свідомий вибір, підтверджений з учителем перед реалізацією.
const BUCKETS: Record<UploadKind, { bucket?: string; publicUrl?: string }> = {
  audio: { bucket: process.env.R2_BUCKET_NAME, publicUrl: process.env.R2_PUBLIC_URL },
  image: {
    bucket: process.env.R2_IMAGES_BUCKET_NAME,
    publicUrl: process.env.R2_IMAGES_PUBLIC_URL,
  },
  html: {
    bucket: process.env.R2_HTML_GAMES_BUCKET_NAME,
    publicUrl: process.env.R2_HTML_GAMES_PUBLIC_URL,
  },
};

function isUploadKind(value: unknown): value is UploadKind {
  return value === "audio" || value === "image" || value === "html";
}

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

  const body = (await request.json()) as {
    filename?: string;
    contentType?: string;
    kind?: string;
  };

  if (!isUploadKind(body.kind)) {
    return Response.json({ error: 'kind має бути "audio", "image" або "html"' }, { status: 400 });
  }

  const { bucket, publicUrl } = BUCKETS[body.kind];
  if (!bucket || !publicUrl) {
    return Response.json(
      { error: `R2 для kind="${body.kind}" не налаштований на сервері (бракує env-змінних)` },
      { status: 500 }
    );
  }

  const filename = body.filename ?? "";
  const contentType = body.contentType || "application/octet-stream";

  const fallbackExt = body.kind === "image" ? "jpg" : body.kind === "html" ? "html" : "mp3";
  const ext = filename.includes(".") ? filename.split(".").pop() : fallbackExt;
  const key = `${crypto.randomUUID()}.${ext}`;

  try {
    const uploadUrl = await buildPresignedUploadUrl(bucket, key, contentType);
    const fileUrl = `${publicUrl.replace(/\/$/, "")}/${key}`;
    return Response.json({ uploadUrl, publicUrl: fileUrl, contentType });
  } catch (error) {
    console.error("r2-upload-url: не вдалося підписати URL", error);
    return Response.json({ error: "Не вдалося підготувати завантаження" }, { status: 500 });
  }
}
