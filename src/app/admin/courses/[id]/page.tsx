import Link from "next/link";
import { Copy, Trash2 } from "lucide-react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  updateProduct,
  togglePublish,
  toggleArchive,
  startStudentPreview,
  deleteProductPermanently,
} from "../actions";
import { createScene } from "@/app/admin/scenes/actions";
import { deleteMaterial } from "@/app/admin/materials/actions";
import { SaveForm } from "@/components/save-form";
import { SubmitButton } from "@/components/submit-button";
import { FileUpload } from "@/components/file-upload";
import { ConfirmForm } from "@/components/confirm-form";
import { GoToTestForm } from "./go-to-test-form";
import { SceneDragList } from "./scene-drag-list";
import { H2_TEXT, BREADCRUMB_LINK, LABEL_TEXT, HINT_TEXT } from "@/lib/typography-styles";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  BUTTON_WARNING,
  BUTTON_DANGER,
  BUTTON_PREVIEW,
} from "@/lib/button-styles";
import { INPUT_BORDER } from "@/lib/input-styles";

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

  // Флет-список задач замінено сіткою тестів (Крок 3) — DELF-контент тепер
  // живе на окремих сторінках /tests/[testNumber] (Крок 2), тут потрібні
  // лише к-сть задач/блоків на кожен номер тесту, не самі рядки. Той самий
  // принцип, що вже в студентському DelfTestGrid — жодної окремої таблиці
  // "тестів", номер існує лише як delf_test_number на задачах/блоках.
  // .is("task_group_id", null) на tasks — самостійні задачі тесту, БЕЗ
  // членів блоків (ті мають delf_test_number=null на собі, успадковують
  // номер від групи, і тому й так не потрапили б у цей підрахунок).
  const { data: delfTasks } = !isFilm
    ? await supabase
        .from("tasks")
        .select("delf_test_number")
        .eq("product_id", id)
        .is("scene_id", null)
        .is("material_id", null)
        .is("task_group_id", null)
        .not("delf_test_number", "is", null)
    : { data: null };

  const { data: delfTaskGroups } = !isFilm
    ? await supabase
        .from("task_groups")
        .select("delf_test_number")
        .eq("product_id", id)
        .is("scene_id", null)
        .is("material_id", null)
        .not("delf_test_number", "is", null)
    : { data: null };

  const taskCountByTest = new Map<number, number>();
  for (const row of delfTasks ?? []) {
    const n = row.delf_test_number as number;
    taskCountByTest.set(n, (taskCountByTest.get(n) ?? 0) + 1);
  }
  const groupCountByTest = new Map<number, number>();
  for (const row of delfTaskGroups ?? []) {
    const n = row.delf_test_number as number;
    groupCountByTest.set(n, (groupCountByTest.get(n) ?? 0) + 1);
  }
  const testNumbers = [
    ...new Set([...taskCountByTest.keys(), ...groupCountByTest.keys()]),
  ].sort((a, b) => a - b);
  // Наступний вільний номер у діапазоні 1-30 — null, якщо всі зайняті
  // (доповнює ручне введення в GoToTestForm, не єдиний спосіб додати тест).
  let nextFreeTestNumber: number | null = null;
  for (let n = 1; n <= 30; n++) {
    if (!testNumbers.includes(n)) {
      nextFreeTestNumber = n;
      break;
    }
  }

  // Суто візуальний статус для плиток сітки (0035_delf_test_published.sql)
  // — відсутній рядок трактується як чернетка, ніколи як "заблоковано";
  // "заблоковано" визначається окремо, лише відсутністю в testNumbers.
  const { data: publishedTests } = !isFilm
    ? await supabase
        .from("delf_tests")
        .select("test_number")
        .eq("product_id", id)
        .eq("is_published", true)
    : { data: null };
  const publishedTestNumbers = new Set((publishedTests ?? []).map((r) => r.test_number));

  const { data: materials } = !isFilm
    ? await supabase
        .from("materials")
        .select("id, title, file_url, category")
        .eq("product_id", id)
        .is("scene_id", null)
        .order("uploaded_at", { ascending: false })
    : { data: null };

  return (
    <div>
      <Link href="/admin/courses" className={BREADCRUMB_LINK}>
        ← До списку курсів
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-2xl font-bold">{product.title}</h1>
          {product.archived_at && (
            <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
              Архівовано
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <form action={startStudentPreview.bind(null, product.id, undefined)}>
            <SubmitButton pendingChildren="..." className={BUTTON_PREVIEW}>
              Переглянути як студент
            </SubmitButton>
          </form>
          <form action={togglePublish.bind(null, product.id, !product.is_published)}>
            <SubmitButton
              pendingChildren="..."
              className={product.is_published ? BUTTON_WARNING : BUTTON_PRIMARY}
            >
              {product.is_published ? "Зняти з публікації" : "Опублікувати"}
            </SubmitButton>
          </form>
          <form action={toggleArchive.bind(null, product.id, !product.archived_at)}>
            <SubmitButton
              pendingChildren="..."
              className={product.archived_at ? BUTTON_SECONDARY : BUTTON_WARNING}
            >
              {product.archived_at ? "Відновити курс" : "Архівувати"}
            </SubmitButton>
          </form>
          {product.archived_at && (
            <ConfirmForm
              action={deleteProductPermanently.bind(null, product.id)}
              message="Курс і весь вміст (сцени, тести, матеріали, завдання) буде видалено назавжди. Це незворотно. Ви впевнені?"
            >
              <SubmitButton pendingChildren="..." className={BUTTON_DANGER}>
                Видалити назавжди
              </SubmitButton>
            </ConfirmForm>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {error}
        </p>
      )}

      <SaveForm action={updateProduct.bind(null, product.id)} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1 rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
          <p className="mb-2 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">
            Основна інформація
          </p>
          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>Назва</label>
            <input
              name="title"
              defaultValue={product.title}
              required
              className={`${INPUT_BORDER} px-3 py-2`}
            />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <label className={LABEL_TEXT}>Опис</label>
            <textarea
              name="description"
              defaultValue={product.description ?? ""}
              rows={3}
              className={`${INPUT_BORDER} px-3 py-2`}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1 rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
          <p className="mb-2 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">
            Ціна та обкладинка
          </p>
          <div className="flex flex-col gap-1">
            <label className={LABEL_TEXT}>Ціна (грн)</label>
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={product.price}
              className={`${INPUT_BORDER} px-3 py-2`}
            />
          </div>
          <div className="mt-3 flex flex-col gap-1">
            <label className={LABEL_TEXT}>Обкладинка (URL)</label>
            <input
              name="cover_image_url"
              type="url"
              defaultValue={product.cover_image_url ?? ""}
              className={`${INPUT_BORDER} px-3 py-2`}
            />
            <label className={`mt-1 ${LABEL_TEXT}`}>
              Або завантажити картинку (перекриє URL вище, якщо вибрано)
            </label>
            <FileUpload kind="image" name="cover_image_file_url" />
          </div>
        </div>

        {product.type === "delf" && (
          <div className="flex flex-col gap-1 rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
            <p className="mb-2 text-xs font-medium uppercase text-neutral-500 dark:text-neutral-400">
              Рівень DELF
            </p>
            <select
              name="level"
              required
              defaultValue={product.level ?? "A1"}
              className={`${INPUT_BORDER} px-3 py-2`}
            >
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
            <h2 className={H2_TEXT}>Сцени</h2>
            <form action={createScene.bind(null, product.id)}>
              <SubmitButton
                pendingChildren="Створюю..."
                className={BUTTON_SECONDARY}
              >
                + Нова сцена
              </SubmitButton>
            </form>
          </div>

          <div className="mt-3">
            <SceneDragList
              key={scenes?.map((s) => s.id).join(",") ?? ""}
              productId={product.id}
              initialScenes={scenes ?? []}
            />
          </div>
        </section>
      ) : (
        <>
          <section id="tests" className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className={H2_TEXT}>Тести</h2>
              <div className="flex items-center gap-2">
                <GoToTestForm productId={product.id} />
                {nextFreeTestNumber && (
                  <Link
                    href={`/admin/courses/${product.id}/tests/${nextFreeTestNumber}`}
                    className={BUTTON_SECONDARY}
                  >
                    + Новий тест ({nextFreeTestNumber})
                  </Link>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-6 gap-2 sm:grid-cols-10">
              {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => {
                const exists = testNumbers.includes(n);
                const published = publishedTestNumbers.has(n);
                const taskCount = taskCountByTest.get(n) ?? 0;
                const groupCount = groupCountByTest.get(n) ?? 0;
                return (
                  <Link
                    key={n}
                    href={`/admin/courses/${product.id}/tests/${n}`}
                    title={
                      !exists
                        ? `Тест ${n} — ще не створено`
                        : `Тест ${n} — ${taskCount} задач${groupCount > 0 ? `, ${groupCount} блоків` : ""} (${published ? "опубліковано" : "чернетка"})`
                    }
                    className={`flex aspect-square items-center justify-center rounded-md text-sm font-medium ${
                      !exists
                        ? "bg-neutral-100 text-neutral-400 hover:bg-neutral-200 dark:bg-neutral-900 dark:text-neutral-600 dark:hover:bg-neutral-800"
                        : published
                          ? "bg-accent text-white hover:opacity-90"
                          : "bg-brand text-white hover:opacity-90"
                    }`}
                  >
                    {n}
                  </Link>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-accent" /> Опубліковано
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-brand" /> Чернетка
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-neutral-100 dark:bg-neutral-900" /> Заблоковано
                (ще не відкрито)
              </span>
            </div>
          </section>

          <section id="materials" className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className={H2_TEXT}>Матеріали</h2>
              <Link
                href={`/admin/courses/${product.id}/materials/new`}
                className={BUTTON_SECONDARY}
              >
                + Новий матеріал
              </Link>
            </div>

            <ul className="mt-3 flex flex-col gap-2">
              {materials?.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between rounded-md border bg-white p-3 dark:bg-neutral-800"
                >
                  <div>
                    <span className={`uppercase ${HINT_TEXT}`}>
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
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/admin/courses/${product.id}/materials/${m.id}/copy`}
                      aria-label="Копіювати матеріал"
                      title="Копіювати"
                      className="rounded p-1.5 text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-200"
                    >
                      <Copy size={16} />
                    </Link>
                    <form action={deleteMaterial.bind(null, m.id, product.id)}>
                      <SubmitButton
                        pendingChildren="…"
                        aria-label="Видалити матеріал"
                        title="Видалити"
                        className="rounded p-1.5 text-neutral-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400"
                      >
                        <Trash2 size={16} />
                      </SubmitButton>
                    </form>
                  </div>
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
