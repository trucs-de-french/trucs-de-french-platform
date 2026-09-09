import type {
  MultipleChoiceConfig,
  ListeningConfig,
  ReorderConfig,
  ChronologicalOrderConfig,
} from "@/lib/exercises/types";

// Крок 1 фічі "перенос сумісних даних при зміні типу задачі" — інфраструктура
// + 3 найчистіші пари (research: групи A/B/G). Решта пар (sort_columns/
// checkbox_grid, matching/table_fill, fill_blank/drag_drop, flip_cards/
// phonetics) — свідомо НЕ тут, чекають Кроку 2, коли ця інфраструктура вже
// перевірена на практиці.
//
// Дані переносяться на КЛІЄНТІ, у момент зміни типу (не в buildConfig на
// сервері) — на момент сабміту форми старі поля вже фізично відсутні в DOM
// (кожен тип рендериться під власною mutually-exclusive умовою, старий
// підкомпонент розмонтовується одразу при зміні селектора). Кожен
// трансформ повертає { config, warning? } — warning ненульовий лише коли
// перенос ЧАСТКОВИЙ (щось реально відкидається), щоб вчитель бачив це, а
// не здогадувався.

export type LinkEmbedFields = {
  url?: string;
  label?: string;
  platform?: string;
  download?: boolean;
  height?: number;
};

export type TransformResult<T> = { config: Partial<T>; warning?: string };

// Група A: "питання з варіантами" — items/questions структурно ідентичні
// (той самий options[] з {id,text,correct,imageUrl?}), лише різні імена
// полів. audioUrl (лише в listening) не переноситься в жоден бік — у
// multiple_choice йому нема аналога, лишається порожнім, як і для щойно
// створеного listening.
function multipleChoiceToListening(mc: MultipleChoiceConfig): TransformResult<ListeningConfig> {
  return {
    config: {
      instructions: mc.instructions,
      subInstructions: mc.subInstructions,
      questions: (mc.items ?? []).map((item) => ({
        id: item.id,
        question: item.sentence,
        options: item.options,
        points: item.points,
      })),
    },
  };
}

function listeningToMultipleChoice(l: ListeningConfig): TransformResult<MultipleChoiceConfig> {
  return {
    config: {
      instructions: l.instructions,
      subInstructions: l.subInstructions,
      display: "buttons",
      items: (l.questions ?? []).map((q) => ({
        id: q.id,
        sentence: q.question,
        options: q.options,
        points: q.points,
      })),
    },
  };
}

// Група B: "впорядкування" — обидва кодують правильність через ПОРЯДОК
// масиву, а не окреме поле. reorder вкладений (кілька послідовностей),
// chronological_order плаский (одна) — перенос розгортає/згортає один
// рівень вкладеності.
function reorderToChronological(r: ReorderConfig): TransformResult<ChronologicalOrderConfig> {
  const [first, ...rest] = r.sequences ?? [];
  if (!first) {
    return {
      config: { instructions: r.instructions, subInstructions: r.subInstructions, mode: "text", items: [] },
    };
  }
  return {
    config: {
      instructions: r.instructions,
      subInstructions: r.subInstructions,
      mode: "text",
      items: first.items.map((text) => ({ id: crypto.randomUUID(), content: text, points: first.points })),
    },
    warning:
      rest.length > 0
        ? `Перенесено лише першу послідовність — ще ${rest.length} відкинуто (chronological_order підтримує лише одну).`
        : undefined,
  };
}

function chronologicalToReorder(c: ChronologicalOrderConfig): TransformResult<ReorderConfig> {
  const items = c.items ?? [];
  return {
    config: {
      instructions: c.instructions,
      subInstructions: c.subInstructions,
      sequences: [
        { id: crypto.randomUUID(), items: items.map((it) => it.content), points: items[0]?.points },
      ],
    },
    warning:
      c.mode === "image"
        ? "Елементи були зображеннями (URL) — перенесено як звичайний текст, перевірте відображення."
        : undefined,
  };
}

// Група G: "посилання/вбудований контент" — уже фактично один слабо
// типізований набір полів (LinkEmbedConfig), url спільний, решта просто не
// має аналога в іншому типі.
function linkToEmbed(l: LinkEmbedFields): TransformResult<LinkEmbedFields> {
  return {
    config: { url: l.url },
    warning:
      l.label || l.platform || l.download
        ? "Текст кнопки, платформу й прапорець завантаження не перенесено — embed їх не підтримує."
        : undefined,
  };
}

function embedToLink(e: LinkEmbedFields): TransformResult<LinkEmbedFields> {
  return { config: { url: e.url } };
}

type Transform = (value: never) => TransformResult<unknown>;

const TRANSFORMS: Record<string, Record<string, Transform>> = {
  multiple_choice: { listening: multipleChoiceToListening as Transform },
  listening: { multiple_choice: listeningToMultipleChoice as Transform },
  reorder: { chronological_order: reorderToChronological as Transform },
  chronological_order: { reorder: chronologicalToReorder as Transform },
  link: { embed: linkToEmbed as Transform },
  embed: { link: embedToLink as Transform },
};

export function getTypeTransform(fromType: string, toType: string): Transform | undefined {
  return TRANSFORMS[fromType]?.[toType];
}
