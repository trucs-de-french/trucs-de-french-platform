// Спільний заголовок картки кабінету — золота риска-акцент під текстом
// (.cabinet-card-title/::after, globals.css), ОДНЕ місце для стилю, що
// раніше кожна картка повторювала окремим "font-body text-lg/xl font-
// semibold text-[var(--cabinet-ink)]" класом без риски. НЕ для h1
// сторінки, модалок, тултіпів чи дрібних лейблів полів — лише для
// заголовка картки/блоку кабінету (Home/Settings/Progress).
export function CardTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h3 className={`cabinet-card-title ${className}`.trim()}>{children}</h3>;
}
