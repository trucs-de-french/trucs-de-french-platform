// Спільні дата-хелпери для кабінетних агрегатів (Home, Progress) — винесено
// з home-data.ts, щоб Progress-сторінка рахувала "сьогодні"/"цей
// тиждень"/streak ТОЧНО тими самими функціями, а не копією формули, яка
// могла б розійтись із Home. Межі дня/тижня — завжди Europe/Kyiv, не TZ
// сервера (звичайні числові Date-обчислення велись би в UTC і зсували
// межу для студентів у Києві).
export const KYIV_TZ = "Europe/Kyiv";

// YYYY-MM-DD у Europe/Kyiv для довільного моменту — "en-CA" дає готовий
// ISO-порядок полів без ручного форматування.
export function kyivDateString(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: KYIV_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// 0=понеділок..6=неділя за календарем Europe/Kyiv.
export function kyivWeekdayIndex(date: Date): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: KYIV_TZ, weekday: "short" }).format(date);
  const order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const idx = order.indexOf(short);
  return idx === -1 ? 0 : idx;
}

// Подальша арифметика — лише над КАЛЕНДАРНИМИ датами (рядок YYYY-MM-DD),
// тож опівнічний UTC-якір безпечний: нас цікавить лише зсув у ДНЯХ.
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function startOfWeekKyiv(now: Date): string {
  const today = kyivDateString(now);
  return addDays(today, -kyivWeekdayIndex(now));
}

export function computeStreakDays(activityDates: Set<string>, todayStr: string): number {
  let cursor = activityDates.has(todayStr) ? todayStr : addDays(todayStr, -1);
  let streak = 0;
  while (activityDates.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

// Найдовший колись досягнутий ряд поспіль-днів із набору дат активності —
// на відміну від computeStreakDays (лише ПОТОЧНИЙ, прив'язаний до today),
// тут рахується максимум по ВСІЙ історії (досягнення "7 днів поспіль").
export function longestStreak(activityDates: Set<string>): number {
  const sorted = [...activityDates].sort();
  let best = 0;
  let current = 0;
  let prev: string | null = null;
  for (const day of sorted) {
    if (prev !== null && addDays(prev, 1) === day) {
      current += 1;
    } else {
      current = 1;
    }
    best = Math.max(best, current);
    prev = day;
  }
  return best;
}
