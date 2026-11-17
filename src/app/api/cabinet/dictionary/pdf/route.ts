import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { t } from "@/lib/i18n/t";
import { filterSavedWords, rowToSavedWord, type SavedWord } from "@/lib/cabinet/saved-words";
import { PART_OF_SPEECH_ORDER, type PartOfSpeech } from "@/lib/vocab-categories";
import { buildVocabPdf } from "@/lib/pdf/vocab-pdf";
import type { Profile } from "@/lib/supabase/profile";

// Явно Node.js (не Edge) — buildVocabPdf читає шрифти з файлової системи,
// той самий принцип, що /api/scenes/[sceneId]/vocab-pdf/route.ts.
export const runtime = "nodejs";

function parsePos(raw: string | null): PartOfSpeech | "all" {
  if (!raw) return "all";
  return (PART_OF_SPEECH_ORDER as readonly string[]).includes(raw) ? (raw as PartOfSpeech) : "all";
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Потрібна авторизація", { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ui_lang")
    .eq("id", user.id)
    .single<Pick<Profile, "ui_lang">>();
  const lang = normalizeUiLang(profile?.ui_lang);

  // Той самий запит, що /cabinet/dictionary/page.tsx (ліміт 1000 — та сама
  // стеля, що MAX_SAVED_WORDS в actions.ts) — фільтр q/pos застосовується
  // ТУТ, filterSavedWords, щоб PDF містив рівно те, що бачить студент під
  // активним пошуком/чіпом dictionary-view.tsx, а не копію логіки.
  const { data: rows } = await supabase
    .from("saved_words")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1000);
  const words: SavedWord[] = (rows ?? []).map(rowToSavedWord);

  const url = new URL(request.url);
  const filtered = filterSavedWords(words, {
    search: url.searchParams.get("q") ?? "",
    pos: parsePos(url.searchParams.get("pos")),
  });

  if (filtered.length === 0) {
    return new Response(t(lang, "cabinet.dictionary.pdf.empty"), { status: 404 });
  }

  // translation: "" замість null — buildVocabPdf (wrapText) очікує рядок;
  // порожній рядок дає порожній, але не зламаний рядок перекладу (слово
  // лишається видимим саме собою), той самий випадок, що й "додайте
  // переклад" на картці словника.
  const vocab = filtered.map((w) => ({
    word: w.word,
    translation: w.translation ?? "",
    partOfSpeech: w.partOfSpeech,
  }));

  const date = new Date().toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric" });
  const title = t(lang, "cabinet.dictionary.pdf.title", { date });
  const pdfBytes = await buildVocabPdf(vocab, title);

  const isoDate = new Date().toISOString().slice(0, 10);
  // Buffer.from(...) — те саме обходження типів DOM-lib/pdf-lib, що й
  // /api/scenes/[sceneId]/vocab-pdf/route.ts.
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=trucs-de-french-dictionary-${isoDate}.pdf`,
    },
  });
}
