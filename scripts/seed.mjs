// Наповнює базу тестовими даними для перевірки UI.
// Запуск: node --env-file=.env.local scripts/seed.mjs
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { data: product, error: productError } = await supabase
    .from("products")
    .insert({
      type: "film",
      title: "Intouchables — тестова сцена",
      description: "Демо-курс для перевірки сторінки сцени",
      is_published: true,
    })
    .select()
    .single();
  if (productError) throw productError;

  const { data: scene, error: sceneError } = await supabase
    .from("scenes")
    .insert({
      product_id: product.id,
      order_index: 1,
      title: "Перша зустріч",
      video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      video_provider: "youtube",
      dialogue: [
        {
          speaker: "Philippe",
          text: "Bonjour, vous êtes en retard.",
          vocab: [{ word: "en retard", translation: "запізно" }],
        },
        {
          speaker: "Driss",
          text: "Je suis désolé, il y avait des embouteillages.",
          vocab: [
            { word: "désolé", translation: "вибачте" },
            { word: "embouteillages", translation: "затори" },
          ],
        },
      ],
    })
    .select()
    .single();
  if (sceneError) throw sceneError;

  const { error: linksError } = await supabase.from("scene_links").insert([
    {
      scene_id: scene.id,
      platform: "quizlet",
      url: "https://quizlet.com/",
      label: "Quizlet: лексика сцени",
      order_index: 1,
    },
    {
      scene_id: scene.id,
      platform: "wordwall",
      url: "https://wordwall.net/",
      label: "Wordwall: гра 1",
      order_index: 2,
    },
    {
      scene_id: scene.id,
      platform: "wordwall",
      url: "https://wordwall.net/",
      label: "Wordwall: гра 2",
      order_index: 3,
    },
  ]);
  if (linksError) throw linksError;

  const { data: gameTask, error: gameTaskError } = await supabase
    .from("tasks")
    .insert({
      product_id: product.id,
      scene_id: scene.id,
      type: "game",
      title: "Match the words",
      order_index: 1,
    })
    .select()
    .single();
  if (gameTaskError) throw gameTaskError;

  const { error: gameError } = await supabase.from("games").insert({
    task_id: gameTask.id,
    provider: "wordwall",
    embed_url: "https://wordwall.net/",
    game_type: "match",
  });
  if (gameError) throw gameError;

  const { error: repetitionTaskError } = await supabase.from("tasks").insert({
    product_id: product.id,
    scene_id: scene.id,
    type: "repetition",
    title: "Повторення лексики сцени",
    order_index: 2,
  });
  if (repetitionTaskError) throw repetitionTaskError;

  const { data: delfProduct, error: delfProductError } = await supabase
    .from("products")
    .insert({
      type: "delf",
      title: "DELF B1 — підготовка",
      description: "Демо-курс для перевірки AI-перевірки відкритих відповідей",
      is_published: true,
    })
    .select()
    .single();
  if (delfProductError) throw delfProductError;

  const { error: openAnswerTaskError } = await supabase.from("tasks").insert({
    product_id: delfProduct.id,
    type: "open_answer",
    title: "Décrivez votre ville natale en 5 phrases.",
    config: {
      prompt: "Décrivez votre ville natale en 5 phrases.",
      criteria: "Граматична правильність, зв'язність, відповідність темі.",
    },
  });
  if (openAnswerTaskError) throw openAnswerTaskError;

  console.log("Тестові дані додано:");
  console.log("- Film product:", product.id);
  console.log("- Scene:", scene.id);
  console.log("- DELF product:", delfProduct.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
