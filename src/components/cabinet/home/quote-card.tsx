import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { Quote } from "@/lib/cabinet/quotes";
import { CardTitle } from "@/components/cabinet/card-title";

export function QuoteCard({ lang, quote }: { lang: UiLang; quote: Quote }) {
  const translation = lang === "uk" ? quote.uk : lang === "en" ? quote.en : null;

  return (
    <div className="cabinet-card flex h-full flex-col gap-3 p-5">
      <CardTitle>{t(lang, "home.quote.title")}</CardTitle>
      <p className="font-body text-[19px] font-semibold italic leading-snug text-[var(--cabinet-ink)]">
        {quote.fr}
      </p>
      {translation && <p className="text-sm text-[var(--cabinet-muted)]">{translation}</p>}
      <p className="mt-auto text-xs text-[var(--cabinet-muted)]">{t(lang, `home.quote.source.${quote.source}`)}</p>
    </div>
  );
}
