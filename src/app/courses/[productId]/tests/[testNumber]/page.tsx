import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
    .select("id, title, level, type")
    .eq("id", productId)
    .single();

  if (!product || product.type !== "delf") {
    notFound();
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href={`/courses/${productId}`} className="text-sm underline">
        ← До тестів
      </Link>
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
