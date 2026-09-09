import type {
  MultipleChoiceConfig,
  ListeningConfig,
  ReorderConfig,
  ChronologicalOrderConfig,
  SortColumnsConfig,
  CheckboxGridConfig,
  MatchingConfig,
  TableFillConfig,
  FillBlankConfig,
  DragDropConfig,
  FlipCardsConfig,
  PhoneticsConfig,
} from "@/lib/exercises/types";

// Крок 1 (multiple_choice/listening, reorder/chronological_order, link/
// embed — групи A/B/G) + Крок 2 (sort_columns/checkbox_grid, matching/
// table_fill, fill_blank/drag_drop, flip_cards/phonetics — групи C/D/E/F)
// фічі "перенос сумісних даних при зміні типу задачі" — повний набір
// сумісних пар із дослідження перед стартом.
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

// Група C: "стовпці/категорії" — обидва мають columns[]{id,label}, різниця
// лише в items/rows: sort_columns — один правильний стовпець на елемент,
// checkbox_grid — декілька (мультивибір).
function sortColumnsToCheckboxGrid(s: SortColumnsConfig): TransformResult<CheckboxGridConfig> {
  return {
    config: {
      instructions: s.instructions,
      subInstructions: s.subInstructions,
      columns: s.columns,
      rows: (s.items ?? []).map((item) => ({
        id: item.id,
        label: item.text,
        correctColumnIds: item.columnId ? [item.columnId] : [],
        points: item.points,
      })),
    },
  };
}

function checkboxGridToSortColumns(c: CheckboxGridConfig): TransformResult<SortColumnsConfig> {
  const rows = c.rows ?? [];
  const multiSelectCount = rows.filter((r) => r.correctColumnIds.length > 1).length;
  return {
    config: {
      instructions: c.instructions,
      subInstructions: c.subInstructions,
      columns: c.columns,
      items: rows.map((row) => ({
        id: row.id,
        text: row.label,
        columnId: row.correctColumnIds[0] ?? "",
        points: row.points,
      })),
    },
    warning:
      multiSelectCount > 0
        ? `${multiSelectCount} ${multiSelectCount === 1 ? "рядок мав" : "рядків мали"} кілька позначених стовпців — sort_columns підтримує лише один, лишено перший.`
        : undefined,
  };
}

// Група D: "пари ліворуч/праворуч" — обидва мають left/right. table_fill
// додає leftHidden/rightHidden і назви колонок — matching завжди показує
// обидві сторони, тож ці поля не мають аналога.
function matchingToTableFill(m: MatchingConfig): TransformResult<TableFillConfig> {
  return {
    config: {
      instructions: m.instructions,
      subInstructions: m.subInstructions,
      columnLabels: ["Французька", "Переклад"],
      rows: (m.pairs ?? []).map((p) => ({
        id: p.id ?? crypto.randomUUID(),
        left: p.left,
        right: p.right,
        leftHidden: false,
        rightHidden: true,
        points: p.points,
      })),
    },
  };
}

function tableFillToMatching(t: TableFillConfig): TransformResult<MatchingConfig> {
  return {
    config: {
      instructions: t.instructions,
      subInstructions: t.subInstructions,
      pairs: (t.rows ?? []).map((row) => ({
        id: row.id,
        left: row.left,
        right: row.right,
        points: row.points,
      })),
    },
    warning:
      "Приховані клітинки й назви колонок не перенесено — у форматі з'єднання пар обидві сторони завжди видно студенту.",
  };
}

// Група E: "шаблон(и) із пропусками" — той самий синтаксис {{a|b}}.
// fill_blank — одна вправа-шаблон, drag_drop — кілька речень зі спільним
// банком слів; wordBank fill_blank (лише підказка) стає РЕАЛЬНИМ банком
// drag_drop (функціональна частина вправи) і навпаки.
function fillBlankToDragDrop(f: FillBlankConfig): TransformResult<DragDropConfig> {
  return {
    config: {
      instructions: f.instructions,
      subInstructions: f.subInstructions,
      sentences: [{ id: crypto.randomUUID(), template: f.template ?? "", points: f.points }],
      bank: f.wordBank ?? [],
    },
  };
}

function dragDropToFillBlank(d: DragDropConfig): TransformResult<FillBlankConfig> {
  const [first, ...rest] = d.sentences ?? [];
  return {
    config: {
      instructions: d.instructions,
      subInstructions: d.subInstructions,
      template: first?.template ?? "",
      points: first?.points,
      wordBank: d.bank,
    },
    warning:
      rest.length > 0
        ? `Перенесено лише перше речення — ще ${rest.length} відкинуто (fill_blank підтримує лише один шаблон).`
        : undefined,
  };
}

// Група F: "довідковий контент, термін + пара" — front/back ↔
// text/transcription. image_url і audio_url flip_cards згортаються в один
// mediaUrl phonetics (і навпаки — неоднозначно, яке саме поле це було).
function flipCardsToPhonetics(f: FlipCardsConfig): TransformResult<PhoneticsConfig> {
  const cards = f.cards ?? [];
  const bothMediaCount = cards.filter((c) => c.image_url && c.audio_url).length;
  return {
    config: {
      instructions: f.instructions,
      subInstructions: f.subInstructions,
      items: cards.map((c) => ({
        text: c.front,
        transcription: c.back,
        mediaUrl: c.audio_url || c.image_url || "",
      })),
    },
    warning:
      bothMediaCount > 0
        ? `${bothMediaCount} ${bothMediaCount === 1 ? "картка мала" : "карток мали"} і картинку, і аудіо — phonetics підтримує лише одне медіа-поле, картинку відкинуто.`
        : undefined,
  };
}

function phoneticsToFlipCards(p: PhoneticsConfig): TransformResult<FlipCardsConfig> {
  return {
    config: {
      instructions: p.instructions,
      subInstructions: p.subInstructions,
      cards: (p.items ?? []).map((it) => ({
        front: it.text,
        back: it.transcription,
        image_url: "",
        audio_url: it.mediaUrl ?? "",
      })),
    },
    warning: (p.items ?? []).some((it) => it.mediaUrl)
      ? "Медіа перенесено в поле аудіо — якщо це насправді картинка, перенесіть URL вручну в поле картинки."
      : undefined,
  };
}

type Transform = (value: never) => TransformResult<unknown>;

const TRANSFORMS: Record<string, Record<string, Transform>> = {
  multiple_choice: { listening: multipleChoiceToListening as Transform },
  listening: { multiple_choice: listeningToMultipleChoice as Transform },
  reorder: { chronological_order: reorderToChronological as Transform },
  chronological_order: { reorder: chronologicalToReorder as Transform },
  link: { embed: linkToEmbed as Transform },
  embed: { link: embedToLink as Transform },
  sort_columns: { checkbox_grid: sortColumnsToCheckboxGrid as Transform },
  checkbox_grid: { sort_columns: checkboxGridToSortColumns as Transform },
  matching: { table_fill: matchingToTableFill as Transform },
  table_fill: { matching: tableFillToMatching as Transform },
  fill_blank: { drag_drop: fillBlankToDragDrop as Transform },
  drag_drop: { fill_blank: dragDropToFillBlank as Transform },
  flip_cards: { phonetics: flipCardsToPhonetics as Transform },
  phonetics: { flip_cards: phoneticsToFlipCards as Transform },
};

export function getTypeTransform(fromType: string, toType: string): Transform | undefined {
  return TRANSFORMS[fromType]?.[toType];
}
