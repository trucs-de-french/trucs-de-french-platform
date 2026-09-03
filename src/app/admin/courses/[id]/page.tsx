import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProduct, togglePublish } from "../actions";
import {
  createScene,
  deleteScene,
  duplicateScene,
  moveScene,
} from "@/app/admin/scenes/actions";
import { deleteTask, moveTask } from "@/app/admin/tasks/actions";
import { deleteMaterial } from "@/app/admin/materials/actions";
import { SaveForm } from "@/components/save-form";
import { SubmitButton } from "@/components/submit-button";

export default async function AdminCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: product } = await supabase.from("products").select("*").eq("id", id).single();
  if (!product) notFound();

  const isFilm = product.type === "film";

  const { data: scenes } = isFilm
    ? await supabase
        .from("scenes")
        .select("id, title, order_index")
        .eq("product_id", id)
        .order("order_index")
    : { data: null };

  const { data: tasks } = !isFilm
    ? await supabase
        .from("tasks")
        .select("id, type, title, order_index, delf_section, delf_test_number")
        .eq("product_id", id)
        .is("scene_id", null)
        .is("material_id", null)
        .order("order_index")
    : { data: null };

  const { data: materials } = !isFilm
    ? await supabase
        .from("materials")
        .select("id, title, file_url, category")
        .eq("product_id", id)
        .is("scene_id", null)
        .eq("file_type", "pdf")
        .order("uploaded_at", { ascending: false })
    : { data: null };

  return (
    <div>
      <Link href="/admin/courses" className="text-sm underline">
        ← До списку курсів
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{product.title}</h1>
        <form action={togglePublish.bind(null, product.id, !product.is_published)}>
          <SubmitButton
            pendingChildren="..."
            className={
              product.is_published
                ? "rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
                : "rounded-md bg-black px-3 py-1.5 text-sm text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            }
          >
            {product.is_published ? "Зняти з публікації" : "Опублікувати"}
          </SubmitButton>
        </form>
      </div>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <SaveForm
        action={updateProduct.bind(null, product.id)}
        className="mt-4 flex flex-col gap-4 rounded-md border p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Назва</label>
          <input
            name="title"
            defaultValue={product.title}
            required
            className="rounded-md border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Опис</label>
          <textarea
            name="description"
            defaultValue={product.description ?? ""}
            rows={3}
            className="rounded-md border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Ціна (грн)</label>
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={product.price}
            className="rounded-md border px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Обкладинка (URL)</label>
          <input
            name="cover_image_url"
            type="url"
            defaultValue={product.cover_image_url ?? ""}
            className="rounded-md border px-3 py-2"
          />
        </div>

        {product.type === "delf" && (
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Рівень DELF</label>
            <select name="level" required defaultValue={product.level ?? "A1"} className="rounded-md border px-3 py-2">
              <option value="A1">A1</option>
              <option value="A2">A2</option>
              <option value="B1">B1</option>
              <option value="B2">B2</option>
            </select>
          </div>
        )}
      </SaveForm>

      {isFilm ? (
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Сцени</h2>
            <form action={createScene.bind(null, product.id)}>
              <SubmitButton
                pendingChildren="Створюю..."
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                + Нова сцена
              </SubmitButton>
            </form>
          </div>

          <ul className="mt-3 flex flex-col gap-2">
            {scenes?.map((scene, i) => (
              <li
                key={scene.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <Link
                  href={`/admin/courses/${product.id}/scenes/${scene.id}`}
                  className="font-medium hover:underline"
                >
                  {scene.title}
                </Link>
                <div className="flex items-center gap-1">
                  <form action={moveScene.bind(null, scene.id, "up")}>
                    <SubmitButton
                      disabled={i === 0}
                      className="rounded border px-2 py-1 text-xs disabled:opacity-30 dark:hover:bg-neutral-800"
                    >
                      ↑
                    </SubmitButton>
                  </form>
                  <form action={moveScene.bind(null, scene.id, "down")}>
                    <SubmitButton
                      disabled={i === scenes.length - 1}
                      className="rounded border px-2 py-1 text-xs disabled:opacity-30 dark:hover:bg-neutral-800"
                    >
                      ↓
                    </SubmitButton>
                  </form>
                  <form action={duplicateScene.bind(null, scene.id)}>
                    <SubmitButton
                      pendingChildren="Копіюю..."
                      className="rounded border px-2 py-1 text-xs hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    >
                      Копіювати
                    </SubmitButton>
                  </form>
                  <form action={deleteScene.bind(null, scene.id)}>
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
          {(!scenes || scenes.length === 0) && (
            <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">Сцен ще немає.</p>
          )}
        </section>
      ) : (
        <>
          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Завдання</h2>
              <Link
                href={`/admin/courses/${product.id}/tasks/new`}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                + Нове завдання
              </Link>
            </div>

            <ul className="mt-3 flex flex-col gap-2">
              {tasks?.map((task, i) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <span className="text-xs uppercase text-neutral-500 dark:text-neutral-400">
                      {task.type}
                      {task.delf_test_number && ` · Тест ${task.delf_test_number}`}
                      {task.delf_section && ` · ${task.delf_section}`}
                    </span>
                    <Link
                      href={`/admin/courses/${product.id}/tasks/${task.id}`}
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
                        disabled={i === tasks.length - 1}
                        className="rounded border px-2 py-1 text-xs disabled:opacity-30 dark:hover:bg-neutral-800"
                      >
                        ↓
                      </SubmitButton>
                    </form>
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
            {(!tasks || tasks.length === 0) && (
              <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">Завдань ще немає.</p>
            )}
          </section>

          <section className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Матеріали</h2>
              <Link
                href={`/admin/courses/${product.id}/materials/new`}
                className="rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                + Новий матеріал
              </Link>
            </div>

            <ul className="mt-3 flex flex-col gap-2">
              {materials?.map((m) => (
                <li key={m.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <span className="text-xs uppercase text-neutral-500 dark:text-neutral-400">
                      {m.category === "delf_guide"
                        ? "Рекомендації DELF"
                        : m.category === "general_tip"
                          ? "Загальні рекомендації"
                          : "Без категорії"}
                    </span>
                    <Link
                      href={`/admin/courses/${product.id}/materials/${m.id}`}
                      className="block font-medium hover:underline"
                    >
                      {m.title || m.file_url || "Без назви"}
                    </Link>
                  </div>
                  <form action={deleteMaterial.bind(null, m.id, product.id)}>
                    <SubmitButton
                      pendingChildren="..."
                      className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
                    >
                      Видалити
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
            {(!materials || materials.length === 0) && (
              <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">Матеріалів ще немає.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
