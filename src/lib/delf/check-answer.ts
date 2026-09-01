import {
  CRITERIA,
  CRITERION_LABELS,
  capLevel,
  detectLengthAnomaly,
  getLevelGrid,
  levelToPoints,
  maxLevelForCriterion,
  type CriterionKey,
  type CriterionLevel,
  type DelfLevel,
  type LevelGrid,
  type TopicAnomaly,
} from "./evaluation-grids";
import type { EssayFormulaireField } from "@/lib/exercises/types";

export type EssayErrorCategory = "Grammaire" | "Lexique" | "Orthographe" | "Cohérence" | "Registre";

export type EssayError = {
  original: string;
  fix: string;
  category: EssayErrorCategory;
  rule: string;
  explanation: string;
};

export type CheckAnswerResult = {
  criteria: Record<CriterionKey, number>;
  errors: EssayError[];
  advice: string;
  /** = advice, підтримка src/lib/exercises/summarize-mistake.ts (шукає f.feedback) */
  feedback: string;
  totalScore: number;
  maxScore: number;
  anomalyFlags: string[];
  correct: boolean;
};

type CheckEssayInput = {
  prompt: string;
  criteria: string;
  studentAnswer: string;
  level: DelfLevel;
  exerciseNumber?: 1 | 2;
};

export type FormulaireFieldResult = {
  id: string;
  label: string;
  studentValue: string;
  correct: boolean;
  comment?: string;
};

export type CheckFormulaireResult = {
  fields: FormulaireFieldResult[];
  totalScore: number;
  maxScore: number;
  feedback: string;
  correct: boolean;
};

type CheckFormulaireInput = {
  instructions?: string;
  fields: EssayFormulaireField[];
  studentAnswer: Record<string, string>;
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

// Бал, з якого спроба вважається "correct" для progress/mistakes —
// внутрішній поріг платформи (НЕ офіційний прохідний бал DELF-сертифікації,
// той рахується інакше й по сукупності 4 навичок). 50% від maxScore цього
// конкретного завдання.
const PASSING_RATIO = 0.5;

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(systemPrompt: string, userContent: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY не налаштований");
  }

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
  });

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(GEMINI_ENDPOINT, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body,
    });

    if (res.ok) {
      const data = await res.json();
      const parts = data?.candidates?.[0]?.content?.parts ?? [];
      const text = parts.map((part: { text?: string }) => part.text ?? "").join("");
      if (!text) {
        throw new Error("Gemini повернув порожню відповідь");
      }
      return text;
    }

    if (res.status === 429 || res.status === 503) {
      lastError = new Error(`Gemini API ${res.status}: ${await res.text()}`);
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      throw lastError;
    }

    throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
  }

  throw lastError ?? new Error("Gemini API: невідома помилка");
}

function descriptorBlock(grid: LevelGrid): string {
  return CRITERIA.map((key) => {
    const d = grid.descriptors[key];
    return `### ${CRITERION_LABELS[key]} (ключ "${key}")
- Нижче цільового рівня: ${d.below}
- На цільовому рівні: ${d.atTarget}
- Вище цільового рівня: ${d.above}`;
  }).join("\n\n");
}

function buildEssaySystemPrompt(grid: LevelGrid): string {
  return `Ти — екзаменатор DELF, який оцінює письмову продукцію студента за офіційною сіткою France Éducation International (реформа 2023 р.) для рівня ${grid.level}${grid.exerciseNumber ? ` (Exercice ${grid.exerciseNumber})` : ""}.

Для КОЖНОГО з 5 критеріїв визнач рівень продуктивності студента — "below" (нижче цільового рівня), "atTarget" (на цільовому рівні) або "above" (вище цільового рівня) — керуючись ЛИШЕ дескрипторами нижче. Якщо для критерію взагалі немає що оцінити (текст не дає жодного матеріалу саме для цього критерію) — постав "zero".

${descriptorBlock(grid)}

Також визнач, чи застосовується котрась із тематичних аномалій (не рахуй довжину тексту — це вже перевірено окремо):
- "horsSujetThematique" — текст не відповідає темі завдання (consigne).
- "horsSujetDiscursif" — текст написаний не в тому жанрі/типі, який вимагає завдання (напр. есе замість листа).
- "horsSujetComplet" — і тема, і тип тексту не відповідають завданню.
Якщо жодна не застосовується — поверни порожній масив.

Додатково знайди КОНКРЕТНІ мовні помилки в тексті студента: для кожної — точна фраза з тексту (original), виправлений варіант (fix), категорія ("Grammaire" | "Lexique" | "Orthographe" | "Cohérence" | "Registre"), коротке правило (rule) і пояснення чому це помилка (explanation), українською мовою.

Наостанок дай 2-3 речення загальних порад з покращення (advice), українською мовою.

Поверни ЛИШЕ JSON (без markdown) такої форми:
{
  "criteriaLevels": {
    "realisationTache": "below" | "atTarget" | "above" | "zero",
    "coherenceCohesion": "below" | "atTarget" | "above" | "zero",
    "adequationSociolinguistique": "below" | "atTarget" | "above" | "zero",
    "lexique": "below" | "atTarget" | "above" | "zero",
    "morphosyntaxe": "below" | "atTarget" | "above" | "zero"
  },
  "anomalyFlags": [],
  "errors": [{"original": "...", "fix": "...", "category": "...", "rule": "...", "explanation": "..."}],
  "advice": "..."
}`;
}

function buildEssayUserContent(input: CheckEssayInput): string {
  return `Завдання (consigne): ${input.prompt}

Додаткові критерії від викладача: ${input.criteria}

Текст студента:
${input.studentAnswer}`;
}

const VALID_LEVELS: CriterionLevel[] = ["zero", "below", "atTarget", "above"];
const VALID_ANOMALIES: TopicAnomaly[] = ["horsSujetThematique", "horsSujetDiscursif", "horsSujetComplet"];
const VALID_CATEGORIES: EssayErrorCategory[] = [
  "Grammaire",
  "Lexique",
  "Orthographe",
  "Cohérence",
  "Registre",
];

function zeroResult(grid: LevelGrid, message: string, anomalyFlag: string): CheckAnswerResult {
  const criteria = Object.fromEntries(CRITERIA.map((key) => [key, 0])) as Record<CriterionKey, number>;
  return {
    criteria,
    errors: [],
    advice: message,
    feedback: message,
    totalScore: 0,
    maxScore: grid.maxScore,
    anomalyFlags: [anomalyFlag],
    correct: false,
  };
}

export async function checkEssayAnswer(input: CheckEssayInput): Promise<CheckAnswerResult> {
  const grid = getLevelGrid(input.level, input.exerciseNumber);
  const wordCount = countWords(input.studentAnswer);
  const lengthAnomaly = detectLengthAnomaly(wordCount, grid);

  if (lengthAnomaly === "empty") {
    return zeroResult(grid, "Текст порожній — 0 балів за завдання.", "empty");
  }
  if (lengthAnomaly === "insufficientLength") {
    return zeroResult(
      grid,
      `Текст закороткий (${wordCount} слів, мінімум ${grid.minWords}) — 0 балів за завдання.`,
      "insufficientLength"
    );
  }

  try {
    const text = await callGemini(buildEssaySystemPrompt(grid), buildEssayUserContent(input));
    const parsed = JSON.parse(text) as {
      criteriaLevels?: Record<string, string>;
      anomalyFlags?: string[];
      errors?: Partial<EssayError>[];
      advice?: string;
    };

    const rawLevels = parsed.criteriaLevels ?? {};
    const anomalyFlags = (parsed.anomalyFlags ?? []).filter((a): a is TopicAnomaly =>
      VALID_ANOMALIES.includes(a as TopicAnomaly)
    );

    const criteria = {} as Record<CriterionKey, number>;
    for (const key of CRITERIA) {
      const rawLevel = rawLevels[key];
      const level: CriterionLevel = VALID_LEVELS.includes(rawLevel as CriterionLevel)
        ? (rawLevel as CriterionLevel)
        : "zero";
      const cap = maxLevelForCriterion(key, anomalyFlags);
      const cappedLevel = capLevel(level, cap);
      criteria[key] = levelToPoints(cappedLevel, grid);
    }

    const errors: EssayError[] = (parsed.errors ?? [])
      .filter(
        (e): e is EssayError =>
          typeof e.original === "string" &&
          typeof e.fix === "string" &&
          typeof e.explanation === "string" &&
          typeof e.rule === "string" &&
          VALID_CATEGORIES.includes(e.category as EssayErrorCategory)
      )
      .map((e) => ({
        original: e.original,
        fix: e.fix,
        category: e.category,
        rule: e.rule,
        explanation: e.explanation,
      }));

    const advice = typeof parsed.advice === "string" ? parsed.advice : "";
    const totalScore = CRITERIA.reduce((sum, key) => sum + criteria[key], 0);

    return {
      criteria,
      errors,
      advice,
      feedback: advice,
      totalScore,
      maxScore: grid.maxScore,
      anomalyFlags,
      correct: totalScore / grid.maxScore >= PASSING_RATIO,
    };
  } catch (error) {
    console.error("checkEssayAnswer: помилка перевірки через Gemini", error);
    const message = "Не вдалося перевірити відповідь автоматично. Спробуйте ще раз пізніше.";
    const criteria = Object.fromEntries(CRITERIA.map((key) => [key, 0])) as Record<CriterionKey, number>;
    return {
      criteria,
      errors: [],
      advice: message,
      feedback: message,
      totalScore: 0,
      maxScore: grid.maxScore,
      anomalyFlags: [],
      correct: false,
    };
  }
}

function buildFormulaireSystemPrompt(): string {
  return `Ти перевіряєш формуляр DELF A1 Exercice 1 — коротку фактологічну форму (не есе). Тобі дають перелік полів консигни з їхніми підписами та відповіді студента.

Для КОЖНОГО поля визнач, чи відповідь коректно й доречно заповнює це поле (правильний тип інформації, розбірливо французькою — граматика/орфографія тут не оцінюється так суворо, як в есе; головне — поле по суті заповнене). Дай короткий коментар лише якщо поле НЕ зараховано.

Поверни ЛИШЕ JSON (без markdown):
{"fields": [{"id": "...", "correct": boolean, "comment": "..."}]}`;
}

function buildFormulaireUserContent(input: CheckFormulaireInput): string {
  const rows = input.fields
    .map((f) => `- id="${f.id}", поле "${f.label}", відповідь студента: "${input.studentAnswer[f.id] ?? ""}"`)
    .join("\n");
  return `${input.instructions ? `Інструкція: ${input.instructions}\n\n` : ""}Поля консигни:\n${rows}`;
}

export async function checkFormulaireAnswer(
  input: CheckFormulaireInput
): Promise<CheckFormulaireResult> {
  const maxScore = input.fields.length;
  const allEmpty = input.fields.every((f) => !(input.studentAnswer[f.id] ?? "").trim());

  if (allEmpty) {
    return {
      fields: input.fields.map((f) => ({
        id: f.id,
        label: f.label,
        studentValue: "",
        correct: false,
      })),
      totalScore: 0,
      maxScore,
      feedback: "Формуляр порожній — 0 балів.",
      correct: false,
    };
  }

  try {
    const text = await callGemini(buildFormulaireSystemPrompt(), buildFormulaireUserContent(input));
    const parsed = JSON.parse(text) as {
      fields?: { id?: string; correct?: boolean; comment?: string }[];
    };
    const byId = new Map((parsed.fields ?? []).map((f) => [f.id, f]));

    const fields: FormulaireFieldResult[] = input.fields.map((f) => {
      const graded = byId.get(f.id);
      return {
        id: f.id,
        label: f.label,
        studentValue: input.studentAnswer[f.id] ?? "",
        correct: graded?.correct === true,
        comment: typeof graded?.comment === "string" ? graded.comment : undefined,
      };
    });

    const totalScore = fields.filter((f) => f.correct).length;

    return {
      fields,
      totalScore,
      maxScore,
      feedback: `${totalScore}/${maxScore} полів заповнено коректно.`,
      correct: maxScore > 0 && totalScore / maxScore >= PASSING_RATIO,
    };
  } catch (error) {
    console.error("checkFormulaireAnswer: помилка перевірки через Gemini", error);
    return {
      fields: input.fields.map((f) => ({
        id: f.id,
        label: f.label,
        studentValue: input.studentAnswer[f.id] ?? "",
        correct: false,
      })),
      totalScore: 0,
      maxScore,
      feedback: "Не вдалося перевірити відповідь автоматично. Спробуйте ще раз пізніше.",
      correct: false,
    };
  }
}
