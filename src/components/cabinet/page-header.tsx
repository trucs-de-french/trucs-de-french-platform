import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Спільний заголовок non-home сторінок кабінету ("hero V3") — title + gold
// риска + subtitle, з м'яким gold-відблиском тільки в light темі (dark —
// плаский, без градієнта позаду тексту). Home лишає свій GreetingHero.
//
// backHref/backLabel — лише для сторінок, відкритих з батьківської
// сторінки (не з sidebar) — напр. повна сторінка досягнень, відкрита з
// "Мій прогрес". Top-level sidebar-сторінки (Головна, Бібліотека, Мій
// прогрес, Налаштування) backHref не передають.
export function PageHeader({
  title,
  subtitle,
  actions,
  backHref,
  backLabel,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <header className="cabinet-page-header">
      {backHref && backLabel && (
        <Link href={backHref} className="cabinet-back-link" aria-label={backLabel}>
          <span className="cabinet-back-link-circle">
            <ArrowLeft size={18} strokeWidth={2} className="cabinet-back-link-icon" aria-hidden="true" />
          </span>
          <span className="cabinet-back-link-label">{backLabel}</span>
        </Link>
      )}
      {actions ? (
        <div className="cabinet-page-header-row">
          <div>
            <h1 className="cabinet-page-title">{title}</h1>
            {subtitle && <p className="cabinet-page-subtitle">{subtitle}</p>}
          </div>
          <div className="cabinet-page-header-actions">{actions}</div>
        </div>
      ) : (
        <>
          <h1 className="cabinet-page-title">{title}</h1>
          {subtitle && <p className="cabinet-page-subtitle">{subtitle}</p>}
        </>
      )}
    </header>
  );
}
