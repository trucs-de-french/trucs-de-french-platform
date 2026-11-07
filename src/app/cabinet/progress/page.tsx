import { t } from "@/lib/i18n/t";
import { getCabinetProfile } from "@/lib/supabase/profile";
import { CabinetPageStub } from "@/components/cabinet/page-stub";

export default async function CabinetProgressPage() {
  const { lang } = await getCabinetProfile();

  return (
    <CabinetPageStub
      title={t(lang, "cabinet.nav.progress")}
      subtitle={t(lang, "cabinet.progress.subtitle")}
      comingSoonLabel={t(lang, "cabinet.soon")}
    />
  );
}
