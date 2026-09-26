import { sanitizeCalloutHtml } from "@/lib/sanitize-callout-html";
import { sanitizeInstructionsHtml } from "@/lib/sanitize-instructions-html";
import { detectPlatform } from "@/lib/platform";
import { sanitizeWordForGrid } from "./grid-word";
import { computeAutoHiddenIndices, type LetterHideMode } from "./letter-hide";
import type {
  FlipCard,
  LetterGapsWord,
  LetterRearrangementWord,
  WordSearchWord,
  CrosswordWord,
  MatchingPair,
  TableFillRow,
} from "./types";

// Перенесено з admin/tasks/actions.ts (buildConfig) — той самий FormData ->
// config маппінг, один-в-один, без жодної зміни поведінки. Живе тут (без
// "use server"/"use client"), бо потрібен і серверній дії (createTask/
// updateTask), і клієнтському прев'ю автоназви (task-config-fields.tsx) —
// раніше клієнт мав власну звужену копію (buildTitlePreviewConfig), що
// ризикувала розійтись зі справжньою логікою збереження.
//
// sanitizeInstructionsHtml/sanitizeCalloutHtml — обгортки над sanitize-html,
// уже ізоморфні (використовувались і на сервері, і в клієнтських
// *-fields.tsx для швидкого фідбеку задовго до цього перенесення).
export function buildTaskConfig(type: string, formData: FormData): Record<string, unknown> {
  switch (type) {
    case "essay_check": {
      const level = (formData.get("essay_level") as string) || "B1";
      const exerciseNumberRaw = formData.get("essay_exercise_number") as string | null;
      const exerciseNumber = exerciseNumberRaw ? (Number(exerciseNumberRaw) as 1 | 2) : undefined;

      if (level === "A1" && exerciseNumber === 1) {
        return {
          level,
          exerciseNumber,
          instructions: (formData.get("essay_formulaire_instructions") as string) || "",
          fields: parseJsonField(formData.get("essay_formulaire_fields")),
        };
      }

      return {
        prompt: (formData.get("prompt") as string) || "",
        criteria: (formData.get("criteria") as string) || "",
        level,
        exerciseNumber,
      };
    }
    case "open_answer": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("open_answer_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("open_answer_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        questions: parseJsonField(formData.get("open_answer_questions")),
      };
    }
    case "embed":
      return {
        url: (formData.get("embed_url") as string) || "",
        height: Number(formData.get("embed_height")) || 480,
      };
    case "link": {
      const url = (formData.get("link_url") as string) || "";
      const rawPlatform = (formData.get("link_platform") as string) || "auto";
      return {
        url,
        label: (formData.get("link_label") as string) || "",
        platform: rawPlatform === "auto" ? detectPlatform(url) : rawPlatform,
        download: formData.get("link_download") === "true",
      };
    }
    case "fill_blank": {
      const wordBank = parseJsonField(formData.get("fill_blank_word_bank")) as string[];
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("fill_blank_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("fill_blank_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        template: (formData.get("fill_blank_template") as string) || "",
        points: Number(formData.get("fill_blank_points")) || 1,
        // Порожній банк -> wordBank взагалі відсутній у config, а не "[]" —
        // студентський рендер уже й так коректно ховає порожній масив
        // (config.wordBank?.length), але так конфіг чистіший для читання.
        ...(wordBank.length > 0 ? { wordBank } : {}),
      };
    }

    case "letter_gaps": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("letter_gaps_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("letter_gaps_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        words: parseJsonField(formData.get("letter_gaps_words")),
        points: Number(formData.get("letter_gaps_points")) || 1,
      };
    }
    case "letter_rearrangement": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("letter_rearrangement_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml(
          (formData.get("letter_rearrangement_instructions") as string) || ""
        ),
        ...(subInstructions ? { subInstructions } : {}),
        words: parseJsonField(formData.get("letter_rearrangement_words")),
        points: Number(formData.get("letter_rearrangement_points")) || 1,
      };
    }
    case "multiple_choice": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("mc_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("mc_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        display: (formData.get("mc_display") as string) || "buttons",
        items: parseJsonField(formData.get("mc_items")),
      };
    }
    case "word_choice": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("word_choice_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml(
          (formData.get("word_choice_instructions") as string) || ""
        ),
        ...(subInstructions ? { subInstructions } : {}),
        mode: (formData.get("word_choice_mode") as string) || "select",
        sentences: parseJsonField(formData.get("word_choice_sentences")),
        points: Number(formData.get("word_choice_points")) || 1,
      };
    }
    case "word_search": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("word_search_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml(
          (formData.get("word_search_instructions") as string) || ""
        ),
        ...(subInstructions ? { subInstructions } : {}),
        // Сітку й розміщення вже згенерувала й перевірила адмінка
        // (word-search-fields.tsx) — сервер лише зберігає готовий
        // результат, не перегенеровує.
        words: parseJsonField(formData.get("word_search_words")),
        grid: parseJsonField(formData.get("word_search_grid")),
        placements: parseJsonField(formData.get("word_search_placements")),
        points: Number(formData.get("word_search_points")) || 1,
      };
    }
    case "crossword": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("crossword_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml(
          (formData.get("crossword_instructions") as string) || ""
        ),
        ...(subInstructions ? { subInstructions } : {}),
        // Розкладку вже згенерувала й перевірила адмінка
        // (crossword-fields.tsx) — сервер лише зберігає готовий результат,
        // не перегенеровує. Немає окремого поля "grid" (на відміну від
        // word_search) — форма й літери відновлюються з placements там, де
        // вони потрібні (sanitizeCrossword/gradeCrossword).
        words: parseJsonField(formData.get("crossword_words")),
        placements: parseJsonField(formData.get("crossword_placements")),
        gridWidth: Number(formData.get("crossword_grid_width")) || 0,
        gridHeight: Number(formData.get("crossword_grid_height")) || 0,
        points: Number(formData.get("crossword_points")) || 1,
      };
    }
    case "true_false": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("tf_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("tf_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        statements: parseJsonField(formData.get("tf_statements")),
      };
    }
    case "matching": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("matching_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("matching_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        pairs: parseJsonField(formData.get("matching_pairs")),
      };
    }
    case "listening": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("listening_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("listening_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        audioUrl: (formData.get("listening_audio_url") as string) || "",
        questions: parseJsonField(formData.get("listening_questions")),
      };
    }
    case "reorder": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("reorder_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("reorder_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        sequences: parseJsonField(formData.get("reorder_sequences")),
      };
    }
    case "drag_drop": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("drag_drop_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("drag_drop_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        sentences: parseJsonField(formData.get("drag_drop_sentences")),
        bank: parseJsonField(formData.get("drag_drop_bank")),
      };
    }
    case "sort_columns": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("sort_columns_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml(
          (formData.get("sort_columns_instructions") as string) || ""
        ),
        ...(subInstructions ? { subInstructions } : {}),
        columns: parseJsonField(formData.get("sort_columns_columns")),
        items: parseJsonField(formData.get("sort_columns_items")),
      };
    }
    case "flip_cards": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("flip_cards_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml(
          (formData.get("flip_cards_instructions") as string) || ""
        ),
        ...(subInstructions ? { subInstructions } : {}),
        cards: parseJsonField(formData.get("flip_cards_cards")),
        mode: (formData.get("flip_cards_mode") as string) || "manual",
        revealSide: (formData.get("flip_cards_reveal_side") as string) || "front",
      };
    }
    case "callout":
      // Основна санітизація — саме тут, на межі збереження в базу
      // (клієнтська санітизація в CalloutFields — лише для швидкого
      // відгуку, їй не можна довіряти як єдиному захисту).
      return {
        style: (formData.get("callout_style") as string) || "none",
        content: sanitizeCalloutHtml((formData.get("callout_content") as string) || ""),
      };
    case "phonetics": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("phonetics_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml((formData.get("phonetics_instructions") as string) || ""),
        ...(subInstructions ? { subInstructions } : {}),
        items: parseJsonField(formData.get("phonetics_items")),
      };
    }
    case "table_fill": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("table_fill_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml(
          (formData.get("table_fill_instructions") as string) || ""
        ),
        ...(subInstructions ? { subInstructions } : {}),
        columnLabels: parseJsonField(formData.get("table_fill_column_labels")),
        rows: parseJsonField(formData.get("table_fill_rows")),
      };
    }
    case "image_match": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("image_match_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml(
          (formData.get("image_match_instructions") as string) || ""
        ),
        ...(subInstructions ? { subInstructions } : {}),
        items: parseJsonField(formData.get("image_match_items")),
      };
    }
    case "checkbox_grid": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("checkbox_grid_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml(
          (formData.get("checkbox_grid_instructions") as string) || ""
        ),
        ...(subInstructions ? { subInstructions } : {}),
        columns: parseJsonField(formData.get("checkbox_grid_columns")),
        rows: parseJsonField(formData.get("checkbox_grid_rows")),
      };
    }
    case "chronological_order": {
      const subInstructions = sanitizeInstructionsHtml(
        (formData.get("chronological_order_sub_instructions") as string) || ""
      );
      return {
        instructions: sanitizeInstructionsHtml(
          (formData.get("chronological_order_instructions") as string) || ""
        ),
        ...(subInstructions ? { subInstructions } : {}),
        mode: (formData.get("chronological_order_mode") as string) || "image",
        items: parseJsonField(formData.get("chronological_order_items")),
      };
    }
    case "vocab_quiz":
      return {
        sceneIds: parseJsonField(formData.get("vocab_quiz_scene_ids")),
      };
    default:
      return {};
  }
}

function parseJsonField(value: FormDataEntryValue | null): unknown[] {
  try {
    const parsed = JSON.parse((value as string) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Типи, що вміють будувати конфігурацію зі слів словника (buildConfigFromVocab
// нижче) — той самий список і порядок, що в майстрі "Створити вправи зі
// словника" (bulk-from-vocab) для чекбоксів кроку 2 й порядку order_index
// створюваних задач. vocab_quiz свідомо відсутній — його конфіг посилається
// на СЦЕНИ (sceneIds), не на окремі слова, вибір конкретних слів на нього
// не впливає.
export const BULK_VOCAB_TASK_TYPES = [
  "flip_cards",
  "matching",
  "letter_gaps",
  "letter_rearrangement",
  "word_search",
  "crossword",
  "table_fill",
] as const;
export type BulkVocabTaskType = (typeof BULK_VOCAB_TASK_TYPES)[number];

// ---------------------------------------------------------------------------
// Імпорт лексики -> нові елементи типу — ОДНЕ джерело правди для звичайного
// імпорту (ImportVocabPanel через importWords у *-fields.tsx) і для
// масового створювача "Створити вправи зі словника" (bulk-from-vocab). Кожен
// консьюмер сам вирішує, куди саме додати повернені елементи (importWords —
// у кінець наявного масиву; масовий створювач — як ЄДИНИЙ вміст нової
// задачі) — ця функція лише мапить word/translation/imageUrl/audioUrl у
// форму елемента, специфічну для типу.
//
// На відміну від звичайного importWords (де hiddenIndices завжди [], а
// points узагалі не встановлюється — вчителька донастроює вручну ПІСЛЯ
// імпорту), тут це так само за замовчуванням: options не обов'язковий,
// коли не передано — поведінка ІДЕНТИЧНА тому, що вже робив кожен
// importWords (лише тепер ще й переносить imageUrl/audioUrl, де в елемента
// є таке поле — нова поведінка, додана свідомо для обох консьюмерів).
export type VocabWordInput = {
  word: string;
  translation: string;
  imageUrl?: string;
  audioUrl?: string;
};

export type VocabImportOptions = {
  // matching/table_fill — бали на пару/рядок; undefined (за замовчуванням)
  // -> поле points узагалі не встановлюється (як і раніше, резолвиться в 1
  // на етапі оцінювання/показу, sanitize.ts).
  pointsPerElement?: number;
  crosswordClueStyle?: "short" | "long";
  // Задано -> hiddenIndices рахується одразу (computeAutoHiddenIndices,
  // letter-hide.ts) для КОЖНОГО слова, замість порожнього масиву. Звичайний
  // імпорт (ImportVocabPanel через *-fields.tsx) цей параметр не передає —
  // там приховування й далі окрема ручна дія ПІСЛЯ імпорту (кнопки
  // "Приховати автоматично" в letter-gaps-fields.tsx), не частина самого
  // імпорту. Масовий створювач (bulk-from-vocab) передає режим, обраний
  // вчителькою в майстрі, одразу.
  letterHideMode?: LetterHideMode;
};

export function buildConfigFromVocab(
  type: string,
  words: VocabWordInput[],
  options: VocabImportOptions = {}
): Record<string, unknown> {
  switch (type) {
    case "flip_cards": {
      const cards: FlipCard[] = words.map((w) => ({
        front: w.word,
        back: w.translation,
        image_url: w.imageUrl || undefined,
        audio_url: w.audioUrl || undefined,
      }));
      return { cards, mode: "manual", revealSide: "front" };
    }
    case "matching": {
      const pairs: MatchingPair[] = words.map((w) => ({
        id: crypto.randomUUID(),
        left: w.word,
        right: w.translation,
        points: options.pointsPerElement,
      }));
      return { pairs };
    }
    case "letter_gaps": {
      // hiddenIndices — [] за замовчуванням (звичайний імпорт: приховування
      // окрема ручна дія ПІСЛЯ), або одразу пораховані через
      // computeAutoHiddenIndices, якщо викликач (bulk-from-vocab) передав
      // options.letterHideMode.
      const importedWords: LetterGapsWord[] = words.map((w) => ({
        word: w.word,
        hiddenIndices: options.letterHideMode ? computeAutoHiddenIndices(w.word, options.letterHideMode) : [],
        hintType: "definition",
        hintText: w.translation,
        imageUrl: w.imageUrl || undefined,
        audioUrl: w.audioUrl || undefined,
      }));
      return { words: importedWords };
    }
    case "letter_rearrangement": {
      const importedWords: LetterRearrangementWord[] = words.map((w) => ({
        word: w.word,
        hintType: "definition",
        hintText: w.translation,
        imageUrl: w.imageUrl || undefined,
        audioUrl: w.audioUrl || undefined,
      }));
      return { words: importedWords };
    }
    case "word_search": {
      // word лишається ОРИГІНАЛОМ ("grand-mère") — легенда (word-search.tsx)
      // показує саме його. Прибирання пробілів/апострофів/дефісів для
      // розміщення в сітці — усередині generateWordSearchGrid
      // (word-search-grid.ts, sanitizeWordForGrid), не тут: тут лише
      // фільтруємо слово, що ПІСЛЯ такого прибирання не лишило б жодної
      // літери (вкрай рідкісний вхід на кшталт "-" саме по собі) — розмістити
      // в сітці все одно було б нічого.
      const importedWords: WordSearchWord[] = words
        .filter((w) => sanitizeWordForGrid(w.word).length > 0)
        .map((w) => ({
          word: w.word,
          translation: w.translation,
          imageUrl: w.imageUrl || undefined,
          audioUrl: w.audioUrl || undefined,
        }));
      return { words: importedWords };
    }
    case "crossword": {
      // Той самий принцип, що word_search вище — word лишається оригіналом
      // для підказки/легенди, sanitizeWordForGrid застосовується лише
      // всередині generateCrosswordGrid (crossword-grid.ts).
      const importedWords: CrosswordWord[] = words
        .filter((w) => sanitizeWordForGrid(w.word).length > 0)
        .map((w) => ({
          word: w.word,
          clue: w.translation,
          clueStyle: options.crosswordClueStyle ?? "short",
          imageUrl: w.imageUrl || undefined,
          audioUrl: w.audioUrl || undefined,
        }));
      return { words: importedWords };
    }
    case "table_fill": {
      const rows: TableFillRow[] = words.map((w) => ({
        id: crypto.randomUUID(),
        left: w.word,
        right: w.translation,
        leftHidden: false,
        rightHidden: true,
        points: options.pointsPerElement,
      }));
      return { rows };
    }
    default:
      return {};
  }
}
