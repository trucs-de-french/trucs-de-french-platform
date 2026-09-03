import { createClient } from "@/lib/supabase/server";

type Material = { id: string; title: string | null; file_url: string; category: string | null };

const SECTIONS: { category: "delf_guide" | "general_tip"; label: string }[] = [
  { category: "delf_guide", label: "Рекомендації DELF" },
  { category: "general_tip", label: "Загальні рекомендації" },
];

function MaterialList({ materials }: { materials: Material[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-2">
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

export async function DelfMaterials({ productId }: { productId: string }) {
  const supabase = await createClient();
  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, file_url, category")
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

  const uncategorized = materials.filter((m) => m.category !== "delf_guide" && m.category !== "general_tip");

  return (
    <div className="mt-4 flex flex-col gap-6">
      {SECTIONS.map(({ category, label }) => {
        const list = materials.filter((m) => m.category === category);
        if (list.length === 0) return null;
        return (
          <section key={category}>
            <h2 className="text-lg font-medium">{label}</h2>
            <MaterialList materials={list} />
          </section>
        );
      })}

      {uncategorized.length > 0 && (
        <section>
          <h2 className="text-lg font-medium">Інше</h2>
          <MaterialList materials={uncategorized} />
        </section>
      )}
    </div>
  );
}
