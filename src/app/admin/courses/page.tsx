import { cookies } from "next/headers";
import Link from "next/link";
import { Film, GraduationCap, BookOpen, ChevronRight, Trash2, type LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { toggleArchive, deleteProductPermanently } from "./actions";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmForm } from "@/components/confirm-form";
import { AdminShell } from "@/components/admin/admin-shell";
import { PageHeader } from "@/components/cabinet/page-header";
import { THEME_COOKIE, parseThemeCookieValue } from "@/lib/theme-cookie";
import { getAdminSidebarProfile } from "@/lib/admin/admin-profile";

const TYPE_ICON: Record<string, LucideIcon> = {
  film: Film,
  delf: GraduationCap,
};

const TYPE_LABEL: Record<string, string> = {
  film: "Фільм/серіал",
  delf: "DELF",
};

export default async function AdminCoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const showArchived = archived === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const profile = user
    ? await getAdminSidebarProfile(supabase, user.id)
    : { fullName: null, avatarUrl: null, avatarMascot: null };

  const [activeQuery, archivedQuery] = await Promise.all([
    supabase
      .from("products")
      .select("id, title, type, is_published, price, archived_at")
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("products")
      .select("id, title, type, is_published, price, archived_at")
      .not("archived_at", "is", null)
      .order("created_at", { ascending: false }),
  ]);
  const activeProducts = activeQuery.data ?? [];
  const archivedProducts = archivedQuery.data ?? [];
  const products = showArchived ? archivedProducts : activeProducts;

  const cookieStore = await cookies();
  const initialIsDark = parseThemeCookieValue(cookieStore.get(THEME_COOKIE)?.value);

  return (
    <AdminShell
      initialIsDark={initialIsDark}
      fullName={profile.fullName}
      avatarUrl={profile.avatarUrl}
      avatarMascot={profile.avatarMascot}
    >
      <PageHeader
        title="Курси"
        subtitle="Каталог продуктів платформи"
        actions={
          <Link href="/admin/courses/new" className="admin-primary-pill">
            + Новий курс
          </Link>
        }
      />

      <div className="achievements-chip-row" style={{ marginBottom: 20 }}>
        <Link
          href="/admin/courses"
          className={`achievements-chip ${!showArchived ? "achievements-chip--active" : ""}`}
        >
          Активні
          <span className="achievements-chip-count">{activeProducts.length}</span>
        </Link>
        <Link
          href="/admin/courses?archived=1"
          className={`achievements-chip ${showArchived ? "achievements-chip--active" : ""}`}
        >
          Архівні
          <span className="achievements-chip-count">{archivedProducts.length}</span>
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {products.map((p) => {
          const Icon = TYPE_ICON[p.type] ?? BookOpen;
          return (
            <div key={p.id} className="admin-course-card">
              <Link href={`/admin/courses/${p.id}`} className="admin-course-card-link">
                <span className="admin-course-card-icon">
                  <Icon size={24} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="admin-course-card-title">{p.title}</span>
                  <span className="admin-course-card-subtitle">
                    {TYPE_LABEL[p.type] ?? p.type} · {p.price} грн
                  </span>
                </span>
                <span className={`admin-status-pill ${p.is_published ? "admin-status-pill--published" : "admin-status-pill--draft"}`}>
                  {p.is_published ? "Опубліковано" : "Чернетка"}
                </span>
                <ChevronRight size={20} className="admin-course-card-chevron" aria-hidden="true" />
              </Link>
              {showArchived && (
                <div className="admin-course-card-actions">
                  <form action={toggleArchive.bind(null, p.id, false)}>
                    <SubmitButton pendingChildren="..." className="achievements-admin-pill-outline">
                      Відновити
                    </SubmitButton>
                  </form>
                  <ConfirmForm
                    action={deleteProductPermanently.bind(null, p.id)}
                    message="Курс і весь вміст (сцени, тести, матеріали, завдання) буде видалено назавжди. Це незворотно. Ви впевнені?"
                  >
                    <SubmitButton
                      pendingChildren="…"
                      aria-label="Видалити курс назавжди"
                      title="Видалити назавжди"
                      className="admin-course-card-delete"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </SubmitButton>
                  </ConfirmForm>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {products.length === 0 && (
        <p className="mt-6 text-sm text-[var(--cabinet-muted)]">
          {showArchived ? "Архівних курсів немає." : "Курсів ще немає."}
        </p>
      )}
    </AdminShell>
  );
}
