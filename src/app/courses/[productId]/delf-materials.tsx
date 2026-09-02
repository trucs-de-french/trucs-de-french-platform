import { createClient } from "@/lib/supabase/server";

type Material = { id: string; title: string | null; file_url: string };

export async function DelfMaterials({ productId }: { productId: string }) {
  const supabase = await createClient();
  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, file_url")
    .eq("product_id", productId)
    .is("scene_id", null)
    .eq("file_type", "pdf")
    .order("uploaded_at", { ascending: false })
    .returns<Material[]>();

  if (!materials || materials.length === 0) {
    return (
      <p className="mt-4 text-neutral-500 dark:text-neutral-400">Матеріалів поки немає.</p>
    );
  }

  return (
    <ul className="mt-4 flex flex-col gap-2">
      {materials.map((m) => (
        <li key={m.id}>
          <a
            href={m.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-md border p-3 font-medium hover:bg-neutral-50 hover:underline dark:hover:bg-neutral-800"
          >
            {m.title || m.file_url}
          </a>
        </li>
      ))}
    </ul>
  );
}
