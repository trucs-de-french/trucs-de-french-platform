import Link from "next/link";
import { PlatformWordmark } from "@/components/platform-wordmark";

// Шапка мобільного кабінету — лише на /cabinet/** (не чіпає існуючий
// /dashboard). Два варіанти вордмарку лежать поруч, перемикає сама тема
// (dark:hidden / hidden dark:block) — без JS: панель кабінету світла
// (кремова) чи темна (навіго-тесамно), темний варіант завжди "onDark"-тон,
// навіть попри те, що дефолтний tone теж має dark:-клас — явна вимога
// завдання (кабінет, не загальний вордмарк).
export function CabinetMobileHeader() {
  return (
    <div className="mb-4 flex w-full justify-center md:hidden">
      <Link href="/cabinet" aria-label="Trucs d'French" className="inline-block">
        <span className="dark:hidden">
          <PlatformWordmark size="sm" />
        </span>
        <span className="hidden dark:inline-block">
          <PlatformWordmark size="sm" tone="onDark" />
        </span>
      </Link>
    </div>
  );
}
