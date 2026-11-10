import { CabinetMobileHeader } from "./mobile-header";
import { PageHeader } from "./page-header";

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
      <PageHeader title={title} subtitle={subtitle} />

      {children}

      <div className="cabinet-stub-card">{comingSoonLabel}</div>
    </div>
  );
}
