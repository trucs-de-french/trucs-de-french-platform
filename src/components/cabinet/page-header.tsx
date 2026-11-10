// Спільний заголовок non-home сторінок кабінету ("hero V3") — title + gold
// риска + subtitle, з м'яким gold-відблиском тільки в light темі (dark —
// плаский, без градієнта позаду тексту). Home лишає свій GreetingHero.
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="cabinet-page-header">
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
