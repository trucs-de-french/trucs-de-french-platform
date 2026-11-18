import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { t } from "@/lib/i18n/t";
import { rowToSavedWord, type SavedWord } from "@/lib/cabinet/saved-words";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { PageHeader } from "@/components/cabinet/page-header";
import { DictionaryView } from "@/components/cabinet/dictionary/dictionary-view";
import { TrainEntryCard } from "@/components/cabinet/dictionary/train-entry-card";
import { getTrainingOverview } from "@/app/cabinet/dictionary/train/actions";
import type { Profile } from "@/lib/supabase/profile";

export default async function CabinetDictionaryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // guarded by cabinet/layout.tsx — не повинно трапитись
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ui_lang")
    .eq("id", user.id)
    .single<Pick<Profile, "ui_lang">>();

  const lang = normalizeUiLang(profile?.ui_lang);

  // Лімітуємо 1000 — той самий стеля, що saveWord перевіряє перед
  // вставкою (MAX_SAVED_WORDS у dictionary/actions.ts), тож цей select
  // ніколи не повинен обрізати реальні дані студента.
  const { data: rows } = await supabase
    .from("saved_words")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1000);

  const words: SavedWord[] = (rows ?? []).map(rowToSavedWord);

  // "Тренувати мої слова" — картка-вхід рендериться лише коли фіча
  // реально доступна (міграція 0070 застосована — overviewResult.ok) і є
  // бодай одне збережене слово; інакше сторінка словника лишається
  // точно такою, як до цієї фічі (жодного частково-зламаного стану).
  const overviewResult = await getTrainingOverview();
  const showTrainEntry = overviewResult.ok && overviewResult.overview.total >= 1;

  return (
    <div>
      <CabinetMobileHeader />
      <PageHeader title={t(lang, "cabinet.nav.dictionary")} subtitle={t(lang, "cabinet.dictionary.subtitle")} />
      {showTrainEntry && overviewResult.ok && <TrainEntryCard lang={lang} overview={overviewResult.overview} />}
      <DictionaryView lang={lang} initialWords={words} />
    </div>
  );
}
