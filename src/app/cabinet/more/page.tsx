import Link from "next/link";
import { RotateCcw, SlidersHorizontal, ShieldCheck, LogOut } from "lucide-react";
import { t } from "@/lib/i18n/t";
import { getCabinetProfile } from "@/lib/supabase/profile";
import { signOut } from "@/app/login/actions";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { LanguagePills } from "@/components/cabinet/language-pills";

// Мобільна "Ще" — пункти, що не влізли в нижній tab bar (5 вкладок):
// Mistakes review, Settings, мова, Admin (лише вчитель), Sign out — великі
// рядки, той самий сенс, що пункти sidebar на десктопі.
export default async function CabinetMorePage() {
  const { lang, isTeacher } = await getCabinetProfile();

  return (
    <div>
      <CabinetMobileHeader />
      <h1 className="font-body text-2xl font-semibold text-[var(--cabinet-ink)]">
        {t(lang, "cabinet.nav.more")}
      </h1>

      <div className="mt-4 flex flex-col gap-2">
        <MoreRow href="/cabinet/mistakes" icon={RotateCcw} label={t(lang, "cabinet.nav.mistakes")} />
        <MoreRow href="/cabinet/settings" icon={SlidersHorizontal} label={t(lang, "cabinet.nav.settings")} />

        {isTeacher && (
          <MoreRow href="/admin/courses" icon={ShieldCheck} label={t(lang, "cabinet.nav.admin")} />
        )}

        <div className="rounded-2xl border-[1.5px] border-[var(--cabinet-line)] px-4 py-4">
          <p className="mb-2 text-xs font-semibold text-[var(--cabinet-muted)]">
            {t(lang, "cabinet.nav.language")}
          </p>
          <LanguagePills current={lang} />
        </div>

        <form action={signOut}>
          <button
            type="submit"
            className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border-[1.5px] border-[var(--cabinet-line)] px-4 text-left font-heading text-sm font-bold text-[var(--cabinet-ink)]"
          >
            <LogOut size={20} aria-hidden="true" />
            {t(lang, "cabinet.nav.signOut")}
          </button>
        </form>
      </div>
    </div>
  );
}

function MoreRow({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof RotateCcw;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[56px] items-center gap-3 rounded-2xl border-[1.5px] border-[var(--cabinet-line)] px-4 font-heading text-sm font-bold text-[var(--cabinet-ink)]"
    >
      <Icon size={20} aria-hidden="true" />
      {label}
    </Link>
  );
}
