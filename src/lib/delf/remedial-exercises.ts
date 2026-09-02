import { callGeminiJSON } from "./gemini-client";
import type { EssayError, EssayErrorCategory } from "./check-answer";

export type RemedialFillBlank = {
  instructions?: string;
  template: string;
};

export type RemedialCategoryExercises = {
  category: EssayErrorCategory;
  review: string;
  exercises: RemedialFillBlank[];
};

const VALID_CATEGORIES: EssayErrorCategory[] = [
  "Grammaire",
  "Lexique",
  "Orthographe",
  "Cohérence",
  "Registre",
];

// ОДИН виклик Gemini на все есе (не по виклику на категорію) — свідоме
// рішення для контролю вартості: есе з 4 категоріями помилок все одно дає
// рівно 2 виклики Gemini за весь checkEssayAnswer(), а не 5.
function buildSystemPrompt(): string {
  return `Ти — викладач французької, який готує вправи на закріплення одразу після перевірки есе студента DELF.

Тобі дають список конкретних мовних помилок студента (фраза з тексту, виправлення, категорія, правило, пояснення). Для КОЖНОЇ категорії, що зустрічається у списку:

1. Напиши короткий (3-5 речень) огляд граматичного чи лексичного правила, яке пояснює, чому виникають саме такі помилки — українською мовою.
2. Створи 1-2 вправи "заповніть пропуск" (fill_blank), КОЖНА приблизно на 10 речень французькою, що тренують САМЕ це правило — НЕ речення з тексту студента, а нові приклади на ту саму тему. Кожна вправа — один рядок template, де кожен пропуск позначений {{правильна_відповідь}} (якщо прийнятних варіантів кілька — через "|", напр. {{vais|vais bien}}); ~10 пропусків на вправу, по одному на речення.

Поверни ЛИШЕ JSON (без markdown) такої форми:
{
  "categories": [
    {
      "category": "Grammaire" | "Lexique" | "Orthographe" | "Cohérence" | "Registre",
      "review": "...",
      "exercises": [
        { "instructions": "коротка інструкція українською", "template": "Je {{vais}} au cinéma. ..." }
      ]
    }
  ]
}`;
}

function buildUserContent(errors: EssayError[]): string {
  return errors
    .map((e, i) => `${i + 1}. [${e.category}] "${e.original}" → "${e.fix}" — ${e.rule} ${e.explanation}`)
    .join("\n");
}

export async function generateRemedialExercises(
  errors: EssayError[]
): Promise<RemedialCategoryExercises[]> {
  if (errors.length === 0) return [];

  try {
    const text = await callGeminiJSON(buildSystemPrompt(), buildUserContent(errors));
    const parsed = JSON.parse(text) as {
      categories?: {
        category?: string;
        review?: string;
        exercises?: { instructions?: string; template?: string }[];
      }[];
    };

    return (parsed.categories ?? [])
      .filter(
        (c): c is { category: string; review: string; exercises: { instructions?: string; template: string }[] } =>
          typeof c.category === "string" &&
          VALID_CATEGORIES.includes(c.category as EssayErrorCategory) &&
          typeof c.review === "string" &&
          c.review.length > 0 &&
          Array.isArray(c.exercises) &&
          c.exercises.some((ex) => typeof ex?.template === "string" && ex.template.length > 0)
      )
      .map((c) => ({
        category: c.category as EssayErrorCategory,
        review: c.review,
        exercises: c.exercises
          .filter((ex) => typeof ex.template === "string" && ex.template.length > 0)
          .slice(0, 2)
          .map((ex) => ({ instructions: ex.instructions, template: ex.template })),
      }));
  } catch (error) {
    console.error("generateRemedialExercises: помилка генерації через Gemini", error);
    return [];
  }
}
