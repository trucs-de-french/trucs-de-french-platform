// Спільний низькорівневий виклик Gemini (нативний ендпоінт, x-goog-api-key
// у заголовку — перевірений робочим патерн, НЕ ?key= query-параметр і НЕ
// OpenAI-сумісна обгортка). Винесено з check-answer.ts, коли з'явився другий
// реальний виклик (remedial-exercises.ts) — дублювати retry/backoff-логіку
// вдруге не було сенсу.

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callGeminiJSON(
  systemPrompt: string,
  userContent: string,
  temperature = 0.4
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY не налаштований");
  }

  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: userContent }] }],
    generationConfig: { responseMimeType: "application/json", temperature },
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
