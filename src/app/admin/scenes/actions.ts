"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/lib/action-state";

// ЧЕКЛИСТ: перед тим як додавати нову мутуючу дію в цей файл (чи в
// tasks/actions.ts), визнач, до якого з 4 сценаріїв вона належить —
// найчастіша причина "зберіглось у базу, але не видно без F5" саме тут:
//
// 1. Дія лишає користувача на ТІЙ САМІЙ сторінці inline (useActionState +
//    SaveForm, без навігації, напр. updateSceneTitle/addLink) ->
//    revalidatePath(цейСамийШлях). НЕ redirect() — зламає inline
//    "Збережено ✓" і форсує зайву навігацію.
// 2. Дія веде користувача через redirect() НА ТУ САМУ сторінку (звичайна
//    <form>, без useActionState, напр. moveTask/deleteLink) ->
//    достатньо redirect(цейСамийШлях) — сама навігація дає свіжі дані.
// 3. Дія веде через redirect() НА ІНШУ сторінку (напр. duplicateScene ->
//    сторінка нової сцени, createTask -> сторінка сцени) -> ОБОВ'ЯЗКОВО
//    ще й revalidatePath(старийСписок) ПЕРЕД redirect() — інакше сторінка,
//    куди користувач згодом поверне ся (кнопкою "назад"), може віддати
//    застарілий Router Cache.
// 4. Дія викликається НАПРЯМУ з клієнтського компонента (не через <form>,
//    напр. reorderSceneBlocks/reorderTasks/reorderLinks) -> ні redirect(),
//    ні revalidatePath() не допоможуть (клієнтський useState їх не бачить)
//    -> повертай {ok, error}, клієнт сам оновлює/відкочує локальний стан.
//
// І окремо, незалежно від сценарію: завжди перевіряй error і кількість
// РЕАЛЬНО змінених рядків (.select("id") + перевірка .length) після кожного
// .update()/.insert()/.delete() — RLS мовчки блокує запис (0 рядків, без
// помилки), а не кидає виняток.
export async function createScene(productId: string) {
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("scenes")
    .select("order_index")
    .eq("product_id", productId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: scene, error } = await supabase
    .from("scenes")
    .insert({
      product_id: productId,
      title: "Нова сцена",
      order_index: (last?.order_index ?? 0) + 1,
      dialogue: [],
    })
    .select()
    .single();

  if (error || !scene) throw error;

  // 'script'/'link'/'task' — фіксовані групи, що існують завжди, навіть
  // порожні (щоб їх можна було перетягувати ще до наповнення). 'video' не
  // створюємо тут — нова сцена завжди без video_url, ця група з'являється
  // синхронно з полем у updateSceneVideo.
  const { error: blocksError } = await supabase.from("scene_blocks").insert([
    { scene_id: scene.id, block_type: "script", position: 0 },
    { scene_id: scene.id, block_type: "link", position: 1 },
    { scene_id: scene.id, block_type: "task", position: 2 },
  ]);
  if (blocksError) throw blocksError;

  // Той самий сценарій 3 з чеклиста вище: redirect() веде на сторінку
  // НОВОЇ сцени, а не назад на список — без revalidatePath список курсу
  // лишиться закешованим без нової сцени до наступного F5.
  revalidatePath(`/admin/courses/${productId}`);

  redirect(`/admin/courses/${productId}/scenes/${scene.id}`);
}

// Розбито на 3 незалежні дії (title/video/dialogue) замість однієї
// updateScene — щоб "Відео" і "Скрипт" могли бути окремими, незалежно
// перетягуваними групами scene_blocks у Кроці 3, кожна зі своєю формою.
// Supabase .update({...}) — часткове оновлення (SET лише зазначених
// колонок), тож розділення форм саме по собі нічого не ламає для інших полів.

export async function updateSceneTitle(
  sceneId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("scenes")
    .update({ title: formData.get("title") as string })
    .eq("id", sceneId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateSceneVideo(
  sceneId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();

  const videoUrl = (formData.get("video_url") as string) || null;

  const { error } = await supabase
    .from("scenes")
    .update({
      video_url: videoUrl,
      video_provider: (formData.get("video_provider") as string) || null,
    })
    .eq("id", sceneId);

  if (error) return { ok: false, error: error.message };

  // 'video' — єдина з 4 груп scene_blocks, чиє існування залежить від того,
  // чи заповнене поле (на відміну від 'script'/'link'/'task', які існують
  // завжди) — синхронізуємо появу/зникнення рядка з тим, чи є video_url.
  const { data: videoBlock } = await supabase
    .from("scene_blocks")
    .select("id")
    .eq("scene_id", sceneId)
    .eq("block_type", "video")
    .maybeSingle();

  if (videoUrl && !videoBlock) {
    const { data: maxRow } = await supabase
      .from("scene_blocks")
      .select("position")
      .eq("scene_id", sceneId)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    await supabase.from("scene_blocks").insert({
      scene_id: sceneId,
      block_type: "video",
      position: (maxRow?.position ?? -1) + 1,
    });
  } else if (!videoUrl && videoBlock) {
    await supabase.from("scene_blocks").delete().eq("id", videoBlock.id);
  }

  return { ok: true };
}

export async function updateSceneDialogue(
  sceneId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();

  let dialogue: unknown = [];
  try {
    dialogue = JSON.parse((formData.get("dialogue") as string) || "[]");
  } catch {
    dialogue = [];
  }

  const { error } = await supabase.from("scenes").update({ dialogue }).eq("id", sceneId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Порядок УСЕРЕДИНІ групи 'link'/'task' і надалі керує їхніми власними
// order_index — ця дія переписує лише позиції самих 4 груп між собою.
// Персистить тільки ті типи, для яких рядок scene_blocks уже реально існує
// (для щойно перетягнутої, але ще не збереженої групи 'video' без video_url
// оновлення просто нічого не торкнеться — рядок з'явиться при першому
// збереженні URL, з дефолтною позицією в кінці) — це очікувано й не логуємо
// як помилку. АЛЕ якщо 0 рядків оновилось для 'script'/'link'/'task' (які
// мають існувати завжди) — це ознака реальної проблеми (напр. RLS мовчки
// відхилив запис), тому логуємо і повертаємо помилку клієнту, замість
// мовчки "губити" зміну, як робив попередній варіант без перевірки .error.
export async function reorderSceneBlocks(
  sceneId: string,
  orderedTypes: string[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const results = await Promise.all(
    orderedTypes.map(async (type, index) => {
      const { data, error } = await supabase
        .from("scene_blocks")
        .update({ position: index })
        .eq("scene_id", sceneId)
        .eq("block_type", type)
        .select("id");
      return { type, error, affected: data?.length ?? 0 };
    })
  );

  const dbError = results.find((r) => r.error)?.error;
  if (dbError) {
    console.error(
      `reorderSceneBlocks: помилка запису для сцени ${sceneId}:`,
      dbError.message
    );
    return { ok: false, error: dbError.message };
  }

  const unexpectedlyMissing = results.filter((r) => r.type !== "video" && r.affected === 0);
  if (unexpectedlyMissing.length > 0) {
    console.error(
      `reorderSceneBlocks: 0 рядків оновлено для сцени ${sceneId}, типи: ${unexpectedlyMissing
        .map((r) => r.type)
        .join(", ")} — RLS міг мовчки відхилити запис (перевір роль поточного користувача) або рядок scene_blocks відсутній.`
    );
    return { ok: false, error: "Не вдалося зберегти порядок частини груп" };
  }

  return { ok: true };
}

export async function deleteScene(sceneId: string) {
  const supabase = await createClient();
  const { data: scene } = await supabase
    .from("scenes")
    .select("product_id")
    .eq("id", sceneId)
    .single();
  if (!scene) return;

  const { data: deleted, error } = await supabase
    .from("scenes")
    .delete()
    .eq("id", sceneId)
    .select("id");

  if (error || !deleted?.length) {
    redirect(
      `/admin/courses/${scene.product_id}?error=${encodeURIComponent(
        error?.message ?? "Не вдалося видалити сцену"
      )}`
    );
  }

  redirect(`/admin/courses/${scene.product_id}`);
}

// Копіювання сцени — атомарний виклик RPC-функції duplicate_scene (одна
// транзакція, без ризику "сирітської" напівскопійованої сцени при збої
// посередині). Деталі: supabase/migrations/0012_duplicate_scene.sql.
export async function duplicateScene(sceneId: string) {
  const supabase = await createClient();
  const { data: scene } = await supabase
    .from("scenes")
    .select("product_id")
    .eq("id", sceneId)
    .single();
  if (!scene) return;

  const { data: newSceneId, error } = await supabase.rpc("duplicate_scene", {
    p_scene_id: sceneId,
  });

  if (error || !newSceneId) {
    redirect(
      `/admin/courses/${scene.product_id}?error=${encodeURIComponent(
        error?.message ?? "Не вдалося скопіювати сцену"
      )}`
    );
  }

  // Сценарій 2 з чеклиста вище: redirect веде на ТУ САМУ сторінку (список
  // сцен), звідки й викликана дія — користувач лишається бачити список із
  // новою копією, а не переходить усередину неї. Окремий revalidatePath тут
  // не потрібен — сам redirect на цей шлях уже дає свіжі дані.
  redirect(`/admin/courses/${scene.product_id}`);
}

export async function moveScene(sceneId: string, direction: "up" | "down") {
  const supabase = await createClient();

  const { data: scene } = await supabase
    .from("scenes")
    .select("id, product_id, order_index")
    .eq("id", sceneId)
    .single();
  if (!scene) return;

  const query = supabase
    .from("scenes")
    .select("id, order_index")
    .eq("product_id", scene.product_id);

  const { data: neighbor } =
    direction === "up"
      ? await query
          .lt("order_index", scene.order_index)
          .order("order_index", { ascending: false })
          .limit(1)
          .maybeSingle()
      : await query
          .gt("order_index", scene.order_index)
          .order("order_index", { ascending: true })
          .limit(1)
          .maybeSingle();

  if (!neighbor) return;

  const { data: updated1, error: error1 } = await supabase
    .from("scenes")
    .update({ order_index: neighbor.order_index })
    .eq("id", scene.id)
    .select("id");
  const { data: updated2, error: error2 } = await supabase
    .from("scenes")
    .update({ order_index: scene.order_index })
    .eq("id", neighbor.id)
    .select("id");

  const error = error1 ?? error2;
  if (error || !updated1?.length || !updated2?.length) {
    redirect(
      `/admin/courses/${scene.product_id}?error=${encodeURIComponent(
        error?.message ?? "Не вдалося змінити порядок сцен"
      )}`
    );
  }

  redirect(`/admin/courses/${scene.product_id}`);
}

export async function addLink(
  sceneId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("scene_links")
    .select("order_index")
    .eq("scene_id", sceneId)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: scene } = await supabase
    .from("scenes")
    .select("product_id")
    .eq("id", sceneId)
    .single();

  const { error } = await supabase.from("scene_links").insert({
    scene_id: sceneId,
    platform: formData.get("platform") as string,
    url: formData.get("url") as string,
    label: (formData.get("label") as string) || null,
    order_index: (last?.order_index ?? 0) + 1,
  });

  if (error) return { ok: false, error: error.message };

  // addLink лишається на тій самій сторінці (useActionState/SaveForm, без
  // навігації) — на відміну від moveTask/moveScene/deleteLink, тут не
  // підходить redirect() (він скинув би inline-стан "Додано ✓" і форсував
  // би повну навігацію); revalidatePath() оновлює RSC-дерево поточного
  // маршруту в тій самій відповіді, без навігації.
  if (scene) {
    revalidatePath(`/admin/courses/${scene.product_id}/scenes/${sceneId}`);
  }
  return { ok: true };
}

export async function deleteLink(linkId: string) {
  const supabase = await createClient();
  const { data: link } = await supabase
    .from("scene_links")
    .select("scene_id, scenes(product_id)")
    .eq("id", linkId)
    .single<{ scene_id: string; scenes: { product_id: string } | null }>();
  if (!link) return;

  const backPath = `/admin/courses/${link.scenes?.product_id}/scenes/${link.scene_id}`;

  const { data: deleted, error } = await supabase
    .from("scene_links")
    .delete()
    .eq("id", linkId)
    .select("id");

  if (error || !deleted?.length) {
    redirect(
      `${backPath}?error=${encodeURIComponent(error?.message ?? "Не вдалося видалити посилання")}`
    );
  }

  redirect(backPath);
}

// Drag-and-drop усередині групи "Практика" — той самий патерн, що й
// reorderTasks: викликається напряму з клієнта (не через <form>), тому
// повертає {ok, error} замість редіректу, з перевіркою error і кількості
// реально змінених рядків на кожному UPDATE.
export async function reorderLinks(
  sceneId: string,
  orderedLinkIds: string[]
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient();

  const results = await Promise.all(
    orderedLinkIds.map(async (linkId, index) => {
      const { data, error } = await supabase
        .from("scene_links")
        .update({ order_index: index })
        .eq("id", linkId)
        .eq("scene_id", sceneId)
        .select("id");
      return { linkId, error, affected: data?.length ?? 0 };
    })
  );

  const dbError = results.find((r) => r.error)?.error;
  if (dbError) {
    console.error(`reorderLinks: помилка запису для сцени ${sceneId}:`, dbError.message);
    return { ok: false, error: dbError.message };
  }

  const missing = results.filter((r) => r.affected === 0);
  if (missing.length > 0) {
    console.error(
      `reorderLinks: 0 рядків оновлено для посилань ${missing
        .map((r) => r.linkId)
        .join(", ")} у сцені ${sceneId}.`
    );
    return { ok: false, error: "Не вдалося зберегти порядок частини посилань" };
  }

  return { ok: true };
}
