import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateMaterial, deleteMaterial } from "@/app/admin/materials/actions";
import { deleteTask, moveTask } from "@/app/admin/tasks/actions";
import { SaveForm } from "@/components/save-form";
import { SubmitButton } from "@/components/submit-button";
import { MaterialArticleFields } from "../material-article-fields";

export default async function EditMaterialPage({
  params,
}: {
  params: Promise<{ id: string; materialId: string }>;
}) {
  const { id: productId, materialId } = await params;
  const supabase = await createClient();

  const { data: material } = await supabase
    .from("materials")
    .select("id, title, file_url, category, content, style")
    .eq("id", materialId)
    .single();

  if (!material) notFound();

  // Секція "Вправи" — лише для general_tip (за задумом delf_guide вправ не
  // має взагалі, не просто показує порожній список).
  const { data: exercises } =
    material.category === "general_tip"
      ? await supabase
          .from("tasks")
          .select("id, type, title, order_index")
          .eq("material_id", materialId)
          .order("order_index")
      : { data: null };

  return (
    <div>
      <h1 className="text-2xl font-bold">Редагування матеріалу</h1>

      <SaveForm
        action={updateMaterial.bind(null, material.id)}
        className="mt-4 flex flex-col gap-4 rounded-md border p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">Назва</label>
          <input
            name="title"
            defaultValue={material.title ?? ""}
            required
            className="rounded-md border px-3 py-2 text-base font-medium"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">Категорія</label>
          <select
            name="category"
            defaultValue={material.category ?? ""}
            className="rounded-md border px-2 py-1.5 text-sm"
          >
            <option value="">— Без категорії —</option>
            <option value="delf_guide">Рекомендації DELF (як здати іспит)</option>
            <option value="general_tip">Загальні рекомендації (типові помилки)</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-neutral-500 dark:text-neutral-400">
            Посилання на PDF (URL, необов&apos;язково)
          </label>
          <input
            name="file_url"
            type="url"
            defaultValue={material.file_url ?? ""}
            className="rounded-md border px-2 py-1.5 text-sm"
          />
        </div>

        <MaterialArticleFields initialContent={material.content} initialStyle={material.style} />
      </SaveForm>

      {material.category === "general_tip" && (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Вправи</h2>
            <Link
              href={`/admin/courses/${productId}/tasks/new?materialId=${material.id}`}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              + Нове завдання
            </Link>
          </div>

          <ul className="mt-3 flex flex-col gap-2">
            {exercises?.map((task, i) => (
              <li key={task.id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <span className="text-xs uppercase text-neutral-500 dark:text-neutral-400">
                    {task.type}
                  </span>
                  <Link
                    href={`/admin/courses/${productId}/tasks/${task.id}`}
                    className="block font-medium hover:underline"
                  >
                    {task.title}
                  </Link>
                </div>
                <div className="flex items-center gap-1">
                  <form action={moveTask.bind(null, task.id, "up")}>
                    <SubmitButton
                      disabled={i === 0}
                      className="rounded border px-2 py-1 text-xs disabled:opacity-30 dark:hover:bg-neutral-800"
                    >
                      ↑
                    </SubmitButton>
                  </form>
                  <form action={moveTask.bind(null, task.id, "down")}>
                    <SubmitButton
                      disabled={i === exercises.length - 1}
                      className="rounded border px-2 py-1 text-xs disabled:opacity-30 dark:hover:bg-neutral-800"
                    >
                      ↓
                    </SubmitButton>
                  </form>
                  <Link
                    href={`/admin/courses/${productId}/tasks/${task.id}/copy`}
                    className="rounded border px-2 py-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    Копіювати
                  </Link>
                  <form action={deleteTask.bind(null, task.id)}>
                    <SubmitButton
                      pendingChildren="..."
                      className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
                    >
                      Видалити
                    </SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
          {(!exercises || exercises.length === 0) && (
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
              Вправ ще немає.
            </p>
          )}
        </section>
      )}

      <form action={deleteMaterial.bind(null, material.id, productId)} className="mt-3">
        <SubmitButton
          pendingChildren="Видаляю..."
          className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
        >
          Видалити матеріал
        </SubmitButton>
      </form>
    </div>
  );
}
