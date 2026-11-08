import { t } from "@/lib/i18n/t";
import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { getLibraryData } from "@/lib/cabinet/library-data";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { LibraryView } from "@/components/cabinet/library/library-view";
import type { Profile } from "@/lib/supabase/profile";

export default async function CabinetLibraryPage() {
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
  const items = await getLibraryData(supabase, user.id);

  return (
    <div className="flex flex-col gap-6">
      <CabinetMobileHeader />

      <header>
        <h1 className="font-body text-2xl font-semibold text-[var(--cabinet-ink)] sm:text-3xl">
          {t(lang, "cabinet.nav.library")}
        </h1>
        <p className="mt-1 text-sm text-[var(--cabinet-muted)]">{t(lang, "library.subtitle")}</p>
      </header>

      <LibraryView lang={lang} items={items} />
    </div>
  );
}
