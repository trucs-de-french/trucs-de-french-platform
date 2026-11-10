import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { Quote } from "@/lib/cabinet/quotes";
import { CardTitle } from "@/components/cabinet/card-title";

export function QuoteCard({ lang, quote }: { lang: UiLang; quote: Quote }) {
  const translation = lang === "uk" ? quote.uk : lang === "en" ? quote.en : null;

  return (
    <div className="cabinet-card flex h-full min-h-[260px] flex-col justify-between gap-3 p-5">
      <CardTitle>{t(lang, "home.quote.title")}</CardTitle>
      <div className="flex flex-1 flex-col gap-2">
        <span
          className="font-body select-none text-[#d9b765]"
          style={{ fontSize: 64, fontWeight: 700, opacity: 0.9, height: 34, lineHeight: "34px", marginBottom: 6 }}
          aria-hidden="true"
        >
          “
        </span>
        <p className="font-body text-[22px] font-semibold italic leading-[1.35] text-[var(--cabinet-ink)]">
          {quote.fr}
        </p>
        {translation && <p className="font-body text-[15px] text-[var(--cabinet-muted)]">{translation}</p>}
      </div>
      <p className="mt-auto text-xs text-[var(--cabinet-muted)]">{t(lang, `home.quote.source.${quote.source}`)}</p>
    </div>
  );
}
