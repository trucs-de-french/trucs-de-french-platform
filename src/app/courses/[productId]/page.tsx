import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DelfCourseTabs } from "./delf-course-tabs";
import { DelfTestGrid } from "./delf-test-grid";
import { DelfMaterials } from "./delf-materials";
import { DelfRecommendations } from "./delf-recommendations";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;
  const supabase = await createClient();

  const { data: product } = await supabase
    .from("products")
    .select("id, title, description, type, level")
    .eq("id", productId)
    .single();

  if (!product) {
    notFound();
  }

  if (product.type === "delf") {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-semibold">{product.title}</h1>
        {product.description && (
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">{product.description}</p>
        )}
        <DelfCourseTabs
          testsContent={<DelfTestGrid productId={productId} />}
          materialsContent={<DelfMaterials productId={productId} />}
          recommendationsContent={<DelfRecommendations productId={productId} />}
        />
      </main>
    );
  }

  const { data: scenes } = await supabase
    .from("scenes")
    .select("id, title")
    .eq("product_id", productId)
    .order("order_index");

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">{product.title}</h1>
      {product.description && (
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">{product.description}</p>
      )}

      <ul className="mt-6 flex flex-col gap-2">
        {scenes?.map((scene) => (
          <li key={scene.id}>
            <Link
              href={`/courses/${productId}/scenes/${scene.id}`}
              className="block rounded-md border p-4 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              {scene.title}
            </Link>
          </li>
        ))}
      </ul>

      {(!scenes || scenes.length === 0) && (
        <p className="mt-6 text-neutral-500 dark:text-neutral-400">
          У цьому курсі поки немає сцен, або у вас немає до нього доступу.
        </p>
      )}
    </main>
  );
}
