import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPreviewCourseId, isVisibleToEnrolledStudent } from "@/lib/course-preview";
import { PreviewBanner, PreviewBlocked } from "@/components/preview-banner";
import { DelfModeTabs } from "../../delf-mode-tabs";
import { DelfTestTasks } from "../../delf-test-tasks";

export default async function DelfTestPage({
  params,
}: {
  params: Promise<{ productId: string; testNumber: string }>;
}) {
  const { productId, testNumber: testNumberRaw } = await params;
  const testNumber = Number(testNumberRaw);

  if (!Number.isInteger(testNumber) || testNumber < 1) {
    notFound();
  }

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, title, level, type, is_published, archived_at")
    .eq("id", productId)
    .single();

  if (!product || product.type !== "delf") {
    notFound();
  }

  const previewCourseId = await getPreviewCourseId();
  const isPreviewing = previewCourseId === productId;
  const previewBlocked = isPreviewing && !isVisibleToEnrolledStudent(product);

  if (previewBlocked) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Link href={`/courses/${productId}`} className="text-sm underline">
          ← До тестів
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {product.title} — Тест {testNumber}
        </h1>
        <PreviewBlocked productId={productId} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href={`/courses/${productId}`} className="text-sm underline">
        ← До тестів
      </Link>
      {isPreviewing && <PreviewBanner productId={productId} />}
      <h1 className="mt-2 text-2xl font-semibold">
        {product.title} — Тест {testNumber}
      </h1>

      <DelfModeTabs
        level={product.level}
        entrainementContent={<DelfTestTasks productId={productId} testNumber={testNumber} />}
      />
    </main>
  );
}
