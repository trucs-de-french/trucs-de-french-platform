import { createClient } from "@/lib/supabase/server";
import { MaterialSection } from "./material-section";

type Material = { id: string; title: string | null; file_url: string | null; category: string | null };

const SECTIONS: { category: "delf_guide" | "general_tip"; label: string }[] = [
  { category: "delf_guide", label: "Рекомендації DELF" },
  { category: "general_tip", label: "Загальні рекомендації" },
];

export async function DelfMaterials({ productId }: { productId: string }) {
  const supabase = await createClient();
  const { data: materials } = await supabase
    .from("materials")
    .select("id, title, file_url, category")
    .eq("product_id", productId)
    .is("scene_id", null)
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
          <MaterialSection key={category} label={label} materials={list} productId={productId} />
        );
      })}

      {uncategorized.length > 0 && (
        <MaterialSection label="Інше" materials={uncategorized} productId={productId} />
      )}
    </div>
  );
}
