import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sanitizeCalloutHtml } from "@/lib/sanitize-callout-html";
import { STYLE_CLASSES, STYLE_ICONS } from "@/components/exercises/callout";
import type { CalloutStyle } from "@/lib/exercises/types";
import { getPreviewCourseId, isVisibleToEnrolledStudent } from "@/lib/course-preview";
import { PreviewBanner, PreviewBlocked } from "@/components/preview-banner";
import { ExerciseBlock, type ExerciseTask } from "../../exercise-block";

export default async function MaterialPage({
  params,
}: {
  params: Promise<{ productId: string; materialId: string }>;
}) {
  const { productId, materialId } = await params;
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("materials")
    .select("id, product_id, title, file_url, content, style, category")
    .eq("id", materialId)
    .single();

  if (!material || material.product_id !== productId) {
    notFound();
  }

  const previewCourseId = await getPreviewCourseId();
  const isPreviewing = previewCourseId === productId;
  let previewBlocked = false;
  if (isPreviewing) {
    const { data: previewProduct } = await supabase
      .from("products")
      .select("is_published, archived_at")
      .eq("id", productId)
      .single();
    previewBlocked = !previewProduct || !isVisibleToEnrolledStudent(previewProduct);
  }

  if (previewBlocked) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Link href={`/courses/${productId}?tab=materials`} className="text-sm underline">
          ← До матеріалів
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{material.title ?? "Матеріал"}</h1>
        <PreviewBlocked productId={productId} />
      </main>
    );
  }

  // Категорійна різниця лише у вправах: "Рекомендації DELF" — без вправ,
  // "Загальні рекомендації" — з вправами. PDF показується для обох
  // категорій (і для нетегованих "Інше"), якщо file_url заповнений.
  const showExercises = material.category !== "delf_guide";

  const { data: exercises } = showExercises
    ? await supabase
        .from("tasks")
        .select("id, type, title, config, image_url, audio_url, games(embed_url, provider)")
        .eq("material_id", materialId)
        .order("order_index")
        .returns<ExerciseTask[]>()
    : { data: null };

  const style = (material.style as CalloutStyle) ?? "none";
  // Друга (визначальна для показу) санітизація — на межі рендеру, той самий
  // принцип, що в CalloutExercise, незалежно від того, що вже мало бути
  // санітизовано при збереженні.
  const safeHtml = material.content ? sanitizeCalloutHtml(material.content) : null;
  const hasPdf = !!material.file_url;
  const hasExercises = showExercises && !!exercises && exercises.length > 0;

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href={`/courses/${productId}?tab=materials`} className="text-sm underline">
        ← До матеріалів
      </Link>

      {isPreviewing && <PreviewBanner productId={productId} />}

      <h1 className="mt-2 text-2xl font-semibold">{material.title ?? "Матеріал"}</h1>

      {safeHtml && (
        <div className={`mt-4 flex gap-2 rounded-md border-2 p-3 ${STYLE_CLASSES[style]}`}>
          <span aria-hidden className="shrink-0">
            {STYLE_ICONS[style]}
          </span>
          <div className="rich-text" dangerouslySetInnerHTML={{ __html: safeHtml }} />
        </div>
      )}

      {hasPdf && (
        <a
          href={material.file_url!}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
        >
          Завантажити PDF
        </a>
      )}

      {hasExercises && (
        <section className="mt-6">
          <h2 className="text-lg font-medium">Вправи</h2>
          <ul className="mt-2 flex flex-col gap-3">
            {exercises!.map((task) => (
              <li key={task.id} className={task.type === "callout" ? "" : "rounded-md border p-3"}>
                <ExerciseBlock task={task} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {!safeHtml && !hasPdf && !hasExercises && (
        <p className="mt-4 text-neutral-500 dark:text-neutral-400">
          Цей матеріал поки порожній.
        </p>
      )}
    </main>
  );
}
