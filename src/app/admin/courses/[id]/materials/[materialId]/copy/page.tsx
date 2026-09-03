import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { copyMaterial } from "@/app/admin/materials/actions";
import { SubmitButton } from "@/components/submit-button";

export default async function CopyMaterialPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; materialId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: productId, materialId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: material }, { data: products }] = await Promise.all([
    supabase.from("materials").select("id, title").eq("id", materialId).single(),
    // Матеріали показуються в адмінці лише для DELF-продуктів — так само
    // обмежуємо вибір призначення.
    supabase.from("products").select("id, title, level").eq("type", "delf").order("title"),
  ]);

  if (!material) notFound();

  return (
    <div>
      <Link href={`/admin/courses/${productId}#materials`} className="text-sm underline">
        ← До матеріалів
      </Link>
      <h1 className="mt-2 text-2xl font-bold">
        Копіювати матеріал «{material.title ?? "Без назви"}»
      </h1>
      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
        Оригінал лишиться незмінним — створюється копія разом з усіма прив&apos;язаними вправами.
      </p>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <form
        action={copyMaterial.bind(null, materialId)}
        className="mt-4 flex flex-col gap-4 rounded-md border p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">Курс</label>
          <select
            name="target_product_id"
            defaultValue={productId}
            required
            className="rounded-md border px-2 py-1.5 text-sm"
          >
            {products?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
                {p.level ? ` (${p.level})` : ""}
              </option>
            ))}
          </select>
        </div>

        <SubmitButton
          pendingChildren="Копіюю..."
          className="self-start rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-neutral-800 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
        >
          Копіювати
        </SubmitButton>
      </form>
    </div>
  );
}
