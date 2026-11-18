import { t } from "@/lib/i18n/t";
import { getCabinetProfile } from "@/lib/supabase/profile";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { PageHeader } from "@/components/cabinet/page-header";

// Заглушка — крок 3 замінить це на реальні вправи. Налаштування з
// setup-екрана (filter/category/limit/types) уже йдуть у query string
// (train-setup-view.tsx), тож ця сторінка вже отримує їх у searchParams,
// просто ще не використовує.
export default async function TrainPlayPage() {
  const { lang } = await getCabinetProfile();

  return (
    <div className="train-page flex flex-col gap-6">
      <CabinetMobileHeader />
      <PageHeader
        title={t(lang, "cabinet.dictionary.train.setup.title")}
        backHref="/cabinet/dictionary/train"
        backLabel={t(lang, "cabinet.dictionary.train.play.backLink")}
      />
      <p className="train-status-text">{t(lang, "cabinet.dictionary.train.play.comingSoon")}</p>
    </div>
  );
}
