import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import type { Quote } from "@/lib/cabinet/quotes";
import { CardTitle } from "@/components/cabinet/card-title";

export function QuoteCard({ lang, quote }: { lang: UiLang; quote: Quote }) {
  const translation = lang === "uk" ? quote.uk : lang === "en" ? quote.en : null;

  return (
    <div className="cabinet-card flex h-full min-h-[260px] flex-col justify-between gap-3 p-5">
      <CardTitle>{t(lang, "home.quote.title")}</CardTitle>
      <div className="flex flex-1 flex-col">
        <span
          className="font-body select-none text-[#d9b765]"
          style={{
            fontSize: 64,
            fontWeight: 700,
            opacity: 0.9,
            display: "block",
            lineHeight: 0.6,
            height: 28,
            margin: 0,
            marginTop: 30,
            overflow: "visible",
          }}
          aria-hidden="true"
        >
          “
        </span>
        <p
          className="font-body text-[22px] font-semibold italic leading-[1.35] text-[var(--cabinet-ink)]"
          style={{ marginTop: -9 }}
        >
          {quote.fr}
        </p>
        {translation && (
          <p className="font-body text-[15px] text-[var(--cabinet-muted)]" style={{ marginTop: 16 }}>
            {translation}
          </p>
        )}
        <p className="text-xs text-[var(--cabinet-muted)]" style={{ marginTop: 24 }}>
          {t(lang, `home.quote.source.${quote.source}`)}
        </p>
      </div>
    </div>
  );
}
