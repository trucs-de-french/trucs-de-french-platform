import { createClient } from "@/lib/supabase/server";
import { collectSceneVocab, type VocabItem } from "@/lib/vocab";
import { buildVocabPdf } from "@/lib/pdf/vocab-pdf";

// Явно Node.js (не Edge) — читання шрифтів з файлової системи (fs) у
// buildVocabPdf вимагає Node.
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sceneId: string }> }
) {
  const { sceneId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Потрібна авторизація", { status: 401 });
  }

  const { data: scene } = await supabase
    .from("scenes")
    .select("title, dialogue")
    .eq("id", sceneId)
    .single();

  if (!scene) {
    return new Response("Сцену не знайдено", { status: 404 });
  }

  const vocab = collectSceneVocab((scene.dialogue ?? []) as { vocab?: VocabItem[] }[]);

  if (vocab.length === 0) {
    return new Response("У цій сцені ще немає позначеної лексики", { status: 404 });
  }

  const pdfBytes = await buildVocabPdf(vocab, scene.title);

  // Buffer.from(...) замість голого Uint8Array, який pdf-lib типізує як
  // Uint8Array<ArrayBufferLike> — DOM-lib цієї версії TS вимагає саме
  // Uint8Array<ArrayBuffer> для BodyInit, Buffer цю невідповідність знімає.
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=slovnyk.pdf",
    },
  });
}
