import { t } from "@/lib/i18n/t";
import { getCabinetProfile } from "@/lib/supabase/profile";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { PageHeader } from "@/components/cabinet/page-header";
import { PlacementTestClient } from "@/components/cabinet/placement-test/placement-test-client";

export default async function PlacementTestPage() {
  const { lang } = await getCabinetProfile();

  return (
    <div className="flex flex-col gap-6">
      <CabinetMobileHeader />

      <PageHeader
        title={t(lang, "cabinet.nav.placementTest")}
        backHref="/cabinet"
        backLabel={t(lang, "cabinet.nav.home")}
      />

      <PlacementTestClient lang={lang} />
    </div>
  );
}
