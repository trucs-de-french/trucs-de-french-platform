import Link from "next/link";
import { PlatformWordmark } from "@/components/platform-wordmark";

// Шапка мобільного кабінету — лише на /cabinet/** (не чіпає існуючий
// /dashboard). Панель кабінету світла (кремова) чи темна залежно від теми
// сайту — колір вордмарку сам перемикається між ними (tone не задано).
export function CabinetMobileHeader() {
  return (
    <div className="w-full md:hidden">
      <div className="flex justify-center pt-[26px]">
        <Link href="/cabinet" aria-label="Trucs d’French" className="inline-block">
          <PlatformWordmark size="mobile" />
        </Link>
      </div>
      <div className="cabinet-mobile-header-divider" />
    </div>
  );
}
