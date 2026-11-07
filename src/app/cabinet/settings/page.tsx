import { t } from "@/lib/i18n/t";
import { getCabinetProfile } from "@/lib/supabase/profile";
import { CabinetPageStub } from "@/components/cabinet/page-stub";

export default async function CabinetSettingsPage() {
  const { lang } = await getCabinetProfile();

  return (
    <CabinetPageStub
      title={t(lang, "cabinet.nav.settings")}
      subtitle={t(lang, "cabinet.settings.subtitle")}
      comingSoonLabel={t(lang, "cabinet.soon")}
    />
  );
}
