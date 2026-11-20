import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { normalizeUiLang } from "@/lib/ui/product-lang";
import { t } from "@/lib/i18n/t";
import { LangProvider } from "@/lib/i18n/context";
import { loadSceneErrorReviewEntries } from "@/lib/cabinet/scene-error-review";
import { ErrorReviewBlock } from "@/components/exercises/error-review-block";
import { ExerciseErrorBoundary } from "@/components/exercises/exercise-error-boundary";
import { CabinetMobileHeader } from "@/components/cabinet/mobile-header";
import { PageHeader } from "@/components/cabinet/page-header";
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
      <PageHeader
        title={scene.title}
        subtitle={courseTitle}
        backHref="/cabinet/mistakes"
        backLabel={t(lang, "cabinet.nav.mistakes")}
      />

      {/* Та сама ширина/центрування, що <main className="mx-auto w-full
          max-w-3xl p-6"> сторінки сцени (scenes/[sceneId]/page.tsx) — без
          цього вправи в ErrorReviewBlock рахують свою ширину (плитки
          letter_rearrangement/matching/table_fill/image_match тощо) від
          повної ширини .cabinet-panel (без max-width), а не 768px сторінки
          сцени, і виглядають значно більшими. GlassBlock+EXERCISE_STACK
          тепер рендерить САМ ErrorReviewBlock (openMode="scene" нижче) —
          і для списку карток, і для відкритої задачі (сцена-вигляд,
          плашка типу + панель, як на сторінці сцени) потрібна РІВНО одна
          панель без вкладеності, а яка саме це панель — залежить від
          клієнтського expandedTaskId-стану, якого тут, на сервері, ще
          немає. */}
      <div className="mx-auto w-full max-w-3xl">
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
