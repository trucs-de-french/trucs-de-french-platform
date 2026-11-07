import type { UiLang } from "@/lib/ui/product-lang";

const LOCALE_BY_LANG: Record<UiLang, string> = { uk: "uk-UA", fr: "fr-FR", en: "en-US" };

function kyivDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv" }).format(date);
}

export function CalendarCard({ lang, activeDays }: { lang: UiLang; activeDays: string[] }) {
  const locale = LOCALE_BY_LANG[lang];
  const now = new Date();
  const todayStr = kyivDateString(now);
  const [year, month] = todayStr.split("-").map(Number);

  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  // getUTCDay(): 0=Sunday..6=Saturday -> зсув до понеділка-першого.
  const firstWeekday = (firstOfMonth.getUTCDay() + 6) % 7;

  const activeSet = new Set(activeDays);
  const cells: { day: number | null; dateStr: string | null }[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ day: null, dateStr: null });
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ day, dateStr });
  }

  const monthLabel = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    firstOfMonth
  );
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => {
    // Monday 2024-01-01 — безпечний якір для короткого weekday-лейбла.
    const d = new Date(Date.UTC(2024, 0, 1 + i));
    return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d);
  });

  return (
    <div className="cabinet-card flex flex-col gap-3 p-5">
      <h3 className="font-body text-lg font-semibold capitalize text-[var(--cabinet-ink)]">
        {monthLabel}
      </h3>
      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdayLabels.map((label, i) => (
          <div key={i} className="text-[10px] font-semibold uppercase text-[var(--cabinet-muted)]">
            {label}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell.day) return <div key={i} />;
          const isToday = cell.dateStr === todayStr;
          const hasActivity = cell.dateStr && activeSet.has(cell.dateStr);
          return (
            <div key={i} className="flex flex-col items-center gap-0.5 py-1">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                  isToday ? "text-[var(--cabinet-on-gold)]" : "text-[var(--cabinet-ink)]"
                }`}
                style={isToday ? { background: "linear-gradient(135deg, #f6dc8e, #e0aa3e)" } : undefined}
              >
                {cell.day}
              </span>
              <span
                className={`h-1 w-1 rounded-full ${hasActivity ? "" : "opacity-0"}`}
                style={{ background: "#e0aa3e" }}
                aria-hidden="true"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
