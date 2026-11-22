import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { t } from "@/lib/i18n/t";
import { LangProvider } from "@/lib/i18n/context";
import { loadSceneErrorReviewEntries } from "@/lib/cabinet/scene-error-review";
import { ErrorReviewBlock } from "@/components/exercises/error-review-block";
import { ExerciseErrorBoundary } from "@/components/exercises/exercise-error-boundary";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import type { Profile } from "@/lib/supabase/profile";

// "Робота над помилками", крок 2 — та сама картка виправлення (ErrorReviewBlock),
// що на сторінці сцени, доступна тут НЕЗАЛЕЖНО від того, чи вчителька додала
// до сцени завдання типу error_correction (на сторінці сцени блок монтується
// лише за наявності такого завдання — для сцен без нього "Виправити" раніше
// вело в нікуди). Дані — loadSceneErrorReviewEntries (scene-error-review.ts),
// та сама модель, що сторінка сцени (buildErrorReviewEntry/RPC без змін).
export default async function CabinetMistakesScenePage({
  params,
  searchParams,
}: {
  params: Promise<{ sceneId: string }>;
  searchParams: Promise<{ task?: string }>;
}) {
  const { sceneId } = await params;
  const { task: fixTaskId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null; // guarded by cabinet/layout.tsx — не повинно трапитись
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ui_lang")
    .eq("id", user.id)
    .single<Pick<Profile, "ui_lang">>();
  const lang = normalizeUiLang(profile?.ui_lang);

  const { scene, courseTitle, entries, emptyState } = await loadSceneErrorReviewEntries(supabase, user.id, sceneId);

  // RLS (scenes_select) уже відфільтрувала недоступні/чужі сцени до null —
  // та сама поведінка, що сторінка сцени показує notFound() для такого
  // випадку.
  if (!scene) {
    notFound();
  }

  const hasRemaining = entries.some((e) => e.status !== "done");

  return (
    <div>
      <CabinetMobileHeader />

      {/* Редизайн навігації (аудит: старий круглий бек-лінк жив у
          PageHeader, повношириннім <header> ПОЗА цією обгорткою — на
          широкому екрані .cabinet-panel (flex:1, без max-width) ширший за
          max-w-3xl, тож PageHeader лишався притиснутим до краю панелі,
          а цей центрований max-w-3xl-блок — відсунутим ВСЕРЕДИНУ; звідси
          й різні ліві краї title/pill проти плашки/панелі нижче і проти
          старої кнопки "До списку вправ" усередині ErrorReviewBlock,
          теж у ЦІЙ-таки обгортці). PageHeader (спільний компонент,
          page-header.tsx) тут більше НЕ використовується — пілюля+заголовок
          тепер пряма частина ЦІЄЇ самої max-w-3xl-обгортки, що й
          плашка/чипи/панель нижче, тож усі чотири мають РІВНО один лівий
          край і одну ширину контейнера. */}
      <div className="mx-auto w-full max-w-3xl">
        <Link
          href="/cabinet/mistakes"
          aria-label={t(lang, "cabinet.mistakes.scene.backToMistakes")}
          className="mistakes-scene-back-pill"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t(lang, "cabinet.mistakes.scene.backToMistakes")}
        </Link>
        <div className="mt-3 mb-6">
          <h1 className="cabinet-page-title">{scene.title}</h1>
          {courseTitle && <p className="cabinet-page-subtitle">{courseTitle}</p>}
        </div>

        {hasRemaining ? (
          <LangProvider lang={lang}>
            <ExerciseErrorBoundary>
              <ErrorReviewBlock
                entries={entries}
                emptyState={emptyState}
                initialExpandedTaskId={fixTaskId ?? null}
                openMode="scene"
              />
            </ExerciseErrorBoundary>
          </LangProvider>
        ) : (
          <div className="mistakes-empty-card">
            <CheckCircle2 size={28} aria-hidden="true" className="mistakes-empty-icon" />
            <p className="mistakes-empty-title">{t(lang, "cabinet.mistakes.scene.emptyTitle")}</p>
            <p className="mistakes-empty-text">{t(lang, "cabinet.mistakes.scene.emptyText")}</p>
            <Link href="/cabinet/mistakes" className="mistakes-empty-btn">
              {t(lang, "cabinet.mistakes.scene.backToList")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
