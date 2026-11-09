import { t } from "@/lib/i18n/t";
import type { UiLang } from "@/lib/ui/product-lang";
import { SOCIAL_LINKS, SHOP_URL } from "@/lib/site-links";

// Прості stroke-гліфи — у lucide-react немає брендових іконок (Facebook/
// Instagram/Youtube/Telegram прибрали ще в ранніх версіях), тож мінімальні
// inline SVG, currentColor, round caps/joins.
function TelegramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 4 2.5 11.2c-.9.35-.9 1.6.02 1.9l4.6 1.5 1.7 5.4c.3.95 1.5 1.2 2.15.45l2.5-2.9 4.6 3.4c.8.6 1.95.15 2.15-.85L22.9 5.2c.2-1-.9-1.7-1.9-1.2Z" />
      <path d="M7.1 14.6 17.5 7" />
    </svg>
  );
}
function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h-2a4 4 0 0 0-4 4v3H6v3h3v8h3v-8h2.8l.7-3H12V7a1 1 0 0 1 1-1h2Z" />
    </svg>
  );
}
function YoutubeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="m10.5 9 4.5 3-4.5 3Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

const SOCIAL_ICONS: Record<keyof typeof SOCIAL_LINKS, typeof TelegramIcon> = {
  telegram: TelegramIcon,
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  youtube: YoutubeIcon,
};

export function CabinetFooter({ lang }: { lang: UiLang }) {
  const year = new Date().getFullYear();
  const socials = (Object.keys(SOCIAL_LINKS) as (keyof typeof SOCIAL_LINKS)[]).filter((key) => SOCIAL_LINKS[key]);

  return (
    <footer className="cabinet-footer flex flex-col items-center gap-3 px-2 py-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
      <div>
        <div className="font-heading text-base font-black text-[var(--cabinet-ink)]">Trucs d’French</div>
        <p className="text-xs text-[var(--cabinet-muted)]">{t(lang, "footer.tagline")}</p>
      </div>
      <div className="flex flex-col items-center gap-2 sm:items-end">
        {socials.length > 0 && (
          <div className="flex gap-2.5">
            {socials.map((key) => {
              const Icon = SOCIAL_ICONS[key];
              return (
                <a
                  key={key}
                  href={SOCIAL_LINKS[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t(lang, `footer.social.${key}`)}
                  className="cabinet-footer-icon"
                >
                  <Icon />
                </a>
              );
            })}
          </div>
        )}
        <p className="text-xs text-[var(--cabinet-muted)]">
          {t(lang, "footer.copyright", { year })}
          {" · "}
          <a
            href={SHOP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--cabinet-muted)] hover:underline"
          >
            {t(lang, "footer.shop")}
          </a>
        </p>
      </div>
    </footer>
  );
}
