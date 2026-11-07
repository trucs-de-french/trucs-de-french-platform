import { CabinetMobileHeader } from "./mobile-header";

// Спільний каркас сторінки-заглушки кабінету — заголовок + підзаголовок +
// картка "Скоро", й окремий named-slot (children) під майбутні віджети,
// щоб було видно, куди саме прийде реальний контент пізніше.
export function CabinetPageStub({
  title,
  subtitle,
  comingSoonLabel,
  children,
}: {
  title: string;
  subtitle: string;
  comingSoonLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <CabinetMobileHeader />
      <h1 className="font-body text-2xl font-semibold text-[var(--cabinet-ink)] sm:text-3xl">
        {title}
      </h1>
      <p className="mt-1 text-sm text-[var(--cabinet-muted)]">{subtitle}</p>

      {children}

      <div className="cabinet-stub-card">{comingSoonLabel}</div>
    </div>
  );
}
