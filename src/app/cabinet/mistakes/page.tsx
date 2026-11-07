import { t } from "@/lib/i18n/t";
import { getCabinetProfile } from "@/lib/supabase/profile";
import { CabinetPageStub } from "@/components/cabinet/page-stub";

export default async function CabinetMistakesPage() {
  const { lang } = await getCabinetProfile();

  return (
    <CabinetPageStub
      title={t(lang, "cabinet.nav.mistakes")}
      subtitle={t(lang, "cabinet.mistakes.subtitle")}
      comingSoonLabel={t(lang, "cabinet.soon")}
    />
  );
}
