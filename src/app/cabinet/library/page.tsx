import { t } from "@/lib/i18n/t";
import { getCabinetProfile } from "@/lib/supabase/profile";
import { CabinetPageStub } from "@/components/cabinet/page-stub";

export default async function CabinetLibraryPage() {
  const { lang } = await getCabinetProfile();

  return (
    <CabinetPageStub
      title={t(lang, "cabinet.nav.library")}
      subtitle={t(lang, "cabinet.library.subtitle")}
      comingSoonLabel={t(lang, "cabinet.soon")}
    />
  );
}
