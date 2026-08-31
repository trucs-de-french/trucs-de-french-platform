export type CheckAnswerResult = {
  correct: boolean;
  feedback: string;
  score?: number;
};

type CheckOpenAnswerInput = {
  prompt: string;
  criteria: string;
  studentAnswer: string;
};

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const SYSTEM_PROMPT = `Ти — екзаменатор DELF, який перевіряє письмову відповідь студента-франкомовника.
Оціни відповідь студента за завданням і критеріями, наданими нижче.
Поверни ЛИШЕ JSON-об'єкт (без markdown, без пояснень поза JSON) такої форми:
{"correct": boolean, "feedback": "текст фідбеку українською мовою для студента", "score": number від 0 до 100}
"correct" — true, якщо відповідь загалом відповідає завданню і критеріям (навіть з дрібними помилками), false — якщо ні.
"feedback" — конкретний, доброзичливий коментар: що вийшло добре, що варто виправити (граматика, лексика, структура, відповідність темі).`;

function buildUserContent(input: CheckOpenAnswerInput): string {
  return `Завдання: ${input.prompt}

Критерії перевірки: ${input.criteria}

Відповідь студента:
${input.studentAnswer}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGemini(input: CheckOpenAnswerInput): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY не налаштований");
  }

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: buildUserContent(input) }] }],
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

export async function checkEssayAnswer(
  input: CheckOpenAnswerInput
): Promise<CheckAnswerResult> {
  try {
    const text = await callGemini(input);
    const parsed = JSON.parse(text) as Partial<CheckAnswerResult>;

    if (typeof parsed.correct !== "boolean" || typeof parsed.feedback !== "string") {
      throw new Error("Gemini повернув відповідь у неочікуваному форматі");
    }

    return {
      correct: parsed.correct,
      feedback: parsed.feedback,
      score: typeof parsed.score === "number" ? parsed.score : undefined,
    };
  } catch (error) {
    console.error("checkEssayAnswer: помилка перевірки через Gemini", error);
    return {
      correct: false,
      feedback: "Не вдалося перевірити відповідь автоматично. Спробуйте ще раз пізніше.",
    };
  }
}
