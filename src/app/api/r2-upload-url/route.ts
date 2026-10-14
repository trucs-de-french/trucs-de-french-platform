import { createClient } from "@/lib/supabase/server";
import { buildPresignedUploadUrl, headR2Object } from "@/lib/r2-client";

// aws4fetch використовує лише Web Crypto/fetch — сумісний і з edge, і з
// node, але явний "nodejs" для узгодженості з рештою серверних роутів
// проєкту (напр. /api/scenes/[sceneId]/vocab-pdf).
export const runtime = "nodejs";

// ----------------------------------------------------------------------------
// Content-addressed uploads (дедуплікація): для файлів ≤100 МБ браузер сам
// рахує SHA-256 і надсилає hash+size разом із запитом. Якщо об'єкт
// "<hash>.<ext>" уже є в R2 з тим самим розміром — повертаємо
// { exists: true, publicUrl } і браузер НЕ вантажить файл повторно. Інакше
// підписуємо PUT на той самий ключ (ідемпотентно: два вчителі одночасно
// просто перезапишуть одні й ті самі байти). Без hash (великі відео >100 МБ,
// клієнт свідомо пропускає хешування) — поведінка як і раніше: випадковий
// UUID-ключ. Старі файли й ключі НЕ мігруються.
// ----------------------------------------------------------------------------

type UploadKind = "audio" | "image" | "html" | "media" | "subtitle";

type UploadUrlResponse = {
  uploadUrl?: string;
  publicUrl?: string;
  contentType?: string;
  // true, коли контент із таким самим SHA-256 (і розміром) уже лежить у R2 —
  // у цьому разі uploadUrl відсутній: завантажувати нічого не треба.
  exists?: boolean;
  // base64 сирих байтів SHA-256 — якщо присутній, клієнт ЗОБОВ'ЯЗАНИЙ
  // надіслати його як заголовок x-amz-checksum-sha256 у самому PUT, інакше
  // підпис (SignedHeaders) не збіжиться і R2 поверне помилку.
  checksumSha256Base64?: string;
  error?: string;
};

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
  // "media" (аудіо/відео для phonetics) — свідомо той самий бакет, що
  // "audio": відео там просто ще один об'єкт для зберігання, окремий
  // бакет/env для нього додав би інфраструктурний крок (нові ключі R2),
  // не потрібний лише заради відтворення файлу за URL.
  media: { bucket: process.env.R2_BUCKET_NAME, publicUrl: process.env.R2_PUBLIC_URL },
  // "subtitle" (.vtt для VideoPlayer) — той самий бакет, що "media"/"audio",
  // та сама причина.
  subtitle: { bucket: process.env.R2_BUCKET_NAME, publicUrl: process.env.R2_PUBLIC_URL },
};

// x-amz-checksum-sha256 підписується і вимагається лише для kind, чий бакет
// (task-audio) уже має CORS AllowedHeaders: "*" — підтверджено перед цією
// зміною. task-images (CORS невідомий) і task-html-games (AllowedHeaders
// лише Content-Type) можуть відхилити preflight із новим заголовком, доки
// вчитель не оновить CORS-конфігурацію цих двох бакетів у Cloudflare —
// дедуплікація за хешем для них УСЕ ОДНО працює (ключ однаково
// content-addressed), просто без додаткової серверної перевірки цілісності.
const CHECKSUM_HEADER_SUPPORTED_KINDS = new Set<UploadKind>(["audio", "media", "subtitle"]);

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/ogg": "ogg",
  "audio/webm": "weba",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "text/vtt": "vtt",
  "text/html": "html",
};
const ALLOWED_EXTENSIONS = new Set(Object.values(EXT_BY_CONTENT_TYPE));

// Лише для content-addressed (hash) гілки — НЕ довіряємо довільному
// filename від клієнта напряму для імені об'єкта: спершу відоме
// розширення з валідованого Content-Type, інакше санітизоване розширення
// файлу ТІЛЬКИ якщо воно входить до того самого allowlist, інакше "bin".
function safeExtFromContentType(contentType: string, filename: string): string {
  const fromType = EXT_BY_CONTENT_TYPE[contentType.toLowerCase()];
  if (fromType) return fromType;
  const raw = filename.includes(".") ? (filename.split(".").pop() ?? "") : "";
  const cleaned = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (cleaned && ALLOWED_EXTENSIONS.has(cleaned)) return cleaned;
  return "bin";
}

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

function isUploadKind(value: unknown): value is UploadKind {
  return (
    value === "audio" || value === "image" || value === "html" || value === "media" || value === "subtitle"
  );
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
    size?: number;
    hash?: string;
  };

  if (!isUploadKind(body.kind)) {
    return Response.json(
      { error: 'kind має бути "audio", "image", "html", "media" або "subtitle"' },
      { status: 400 }
    );
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

  if (body.hash !== undefined && !SHA256_HEX_RE.test(body.hash)) {
    return Response.json({ error: "hash має бути 64 hex символи (SHA-256)" }, { status: 400 });
  }

  let key: string;
  let checksumHeaders: Record<string, string> | undefined;
  let checksumSha256Base64: string | undefined;

  if (body.hash) {
    const ext = safeExtFromContentType(contentType, filename);
    key = `${body.hash}.${ext}`;

    try {
      const existing = await headR2Object(bucket, key);
      if (existing && typeof body.size === "number" && existing.size === body.size) {
        const fileUrl = `${publicUrl.replace(/\/$/, "")}/${key}`;
        const response: UploadUrlResponse = { exists: true, publicUrl: fileUrl, contentType };
        return Response.json(response);
      }
    } catch (error) {
      // HEAD, що впав (мережа/R2) — не блокуємо завантаження через це,
      // просто підписуємо PUT як для нового файлу.
      console.error("r2-upload-url: HeadObject для дедуплікації впав", error);
    }

    if (CHECKSUM_HEADER_SUPPORTED_KINDS.has(body.kind)) {
      checksumSha256Base64 = Buffer.from(body.hash, "hex").toString("base64");
      checksumHeaders = { "x-amz-checksum-sha256": checksumSha256Base64 };
    }
  } else {
    // Без hash (файл >100 МБ, клієнт свідомо пропустив хешування) —
    // поведінка 1:1 як до цієї зміни: випадковий UUID-ключ.
    const fallbackExt =
      body.kind === "image"
        ? "jpg"
        : body.kind === "html"
          ? "html"
          : body.kind === "subtitle"
            ? "vtt"
            : body.kind === "media" && contentType.startsWith("video/")
              ? "mp4"
              : "mp3";
    const ext = filename.includes(".") ? filename.split(".").pop() : fallbackExt;
    key = `${crypto.randomUUID()}.${ext}`;
  }

  try {
    const uploadUrl = await buildPresignedUploadUrl(bucket, key, contentType, 300, checksumHeaders);
    const fileUrl = `${publicUrl.replace(/\/$/, "")}/${key}`;
    const response: UploadUrlResponse = { uploadUrl, publicUrl: fileUrl, contentType, checksumSha256Base64 };
    return Response.json(response);
  } catch (error) {
    console.error("r2-upload-url: не вдалося підписати URL", error);
    return Response.json({ error: "Не вдалося підготувати завантаження" }, { status: 500 });
  }
}
