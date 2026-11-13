import Link from "next/link";
import { t, type MessageKey } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { FrenchLevel, FrenchLevelSource } from "@/lib/supabase/profile";
import { CardTitle } from "@/components/cabinet/card-title";
import { PlacementLevelCoin } from "@/components/cabinet/placement-test/placement-level-coin";
import { formatDateNumeric } from "@/lib/cabinet/format-date";
import { kyivDateString } from "@/lib/cabinet/kyiv-date";

const LEVEL_TITLE_KEY: Record<FrenchLevel, MessageKey> = {
  A0: "placementTest.level.A0.title",
  A1: "placementTest.level.A1.title",
  A2: "placementTest.level.A2.title",
  B1: "placementTest.level.B1.title",
  B2: "placementTest.level.B2.title",
  C1C2: "placementTest.level.C1C2.title",
};
export const LEVEL_COIN_LABEL: Record<FrenchLevel, string> = {
  A0: "A0",
  A1: "A1",
  A2: "A2",
  B1: "B1",
  B2: "B2",
  C1C2: "C1–C2",
};

// Картка "Мій рівень" на Home — показується в тому самому місці стеку, де
// Іспит, коли home.showExamCard=false (Home/cabinet/page.tsx, examOrLevelCard,
// та сама умова, що й QuickActionsCard). Монета — та сама PlacementLevelCoin,
// що й результат тесту (placement-test-client.tsx), лише менша тут (CSS-
// скоуп .cabinet-level-card нижче, не власний розмір компонента).
export function LevelCard({
  lang,
  level,
  levelSource,
  levelSetAt,
}: {
  lang: UiLang;
  level: FrenchLevel | null;
  levelSource: FrenchLevelSource | null;
  levelSetAt: string | null;
}) {
  return (
    <div className="cabinet-card cabinet-level-card">
      <div className="cabinet-level-card-head">
        <CardTitle>{t(lang, "home.level.title")}</CardTitle>
        <Link href="/cabinet/placement-test" className="cabinet-card-link">
          {t(lang, level ? "home.level.retake" : "home.level.take")}
        </Link>
      </div>
      <div className="cabinet-level-card-body">
        {level ? (
          <>
            <PlacementLevelCoin label={LEVEL_COIN_LABEL[level]} />
            <div className="cabinet-level-card-text">
              <p className="cabinet-level-card-name">{t(lang, LEVEL_TITLE_KEY[level])}</p>
              <p className="cabinet-level-card-source">
                {levelSource === "test"
                  ? t(lang, "home.level.sourceTest", {
                      date: levelSetAt ? formatDateNumeric(kyivDateString(new Date(levelSetAt)), lang) : "",
                    })
                  : t(lang, "home.level.sourceSelf")}
              </p>
            </div>
          </>
        ) : (
          <p className="cabinet-level-card-empty">{t(lang, "home.level.empty")}</p>
        )}
      </div>
    </div>
  );
}
