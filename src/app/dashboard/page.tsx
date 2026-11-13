import { redirect } from "next/navigation";

// Стара сторінка кабінету — лишена як compatibility route для старих
// закладок/посилань, сам кабінет тепер /cabinet. Компоненти старого
// дизайну (course-tabs.tsx) свідомо НЕ видалені цим комітом.
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      query.set(key, value);
    } else if (Array.isArray(value) && value.length > 0) {
      query.set(key, value[0]);
    }
  }
  const qs = query.toString();
  redirect(qs ? `/cabinet?${qs}` : "/cabinet");
}
