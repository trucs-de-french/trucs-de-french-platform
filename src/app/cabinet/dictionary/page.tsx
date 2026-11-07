import { t } from "@/lib/i18n/t";
import { getCabinetProfile } from "@/lib/supabase/profile";
import { CabinetPageStub } from "@/components/cabinet/page-stub";

export default async function CabinetDictionaryPage() {
  const { lang } = await getCabinetProfile();

  return (
    <CabinetPageStub
      title={t(lang, "cabinet.nav.dictionary")}
      subtitle={t(lang, "cabinet.dictionary.subtitle")}
      comingSoonLabel={t(lang, "cabinet.soon")}
    />
  );
}
