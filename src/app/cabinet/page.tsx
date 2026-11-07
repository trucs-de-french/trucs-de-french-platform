import { t } from "@/lib/i18n/t";
import { getCabinetProfile } from "@/lib/supabase/profile";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";

export default async function CabinetHomePage() {
  const { lang, fullName, email } = await getCabinetProfile();
  const name = fullName?.split(" ")[0] || email?.split("@")[0] || "";

  return (
    <div>
      <CabinetMobileHeader />
      <h1 className="font-body text-2xl font-semibold text-[var(--cabinet-ink)] sm:text-3xl">
        {t(lang, "cabinet.home.greeting", { name })}
      </h1>

      {/* Слот для майбутніх віджетів Home: continue-де-зупинились, зворотний
          відлік до іспиту, тижнева ціль, статистика, графік прогресу,
          "Exercices à refaire" по всіх курсах. Навмисно порожньо — дані ще
          не спроєктовані (окремий агрегат по продукту/користувачу поки не
          існує, аудит показав це). */}
      <div className="cabinet-stub-card">{t(lang, "cabinet.soon")}</div>
    </div>
  );
}
