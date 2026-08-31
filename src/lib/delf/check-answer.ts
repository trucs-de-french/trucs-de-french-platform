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

// ЗАГЛУШКА: реальна AI-перевірка через Gemini тимчасово вимкнена.
// Причина (за станом на серпень 2026, з боку користувача): для цього акаунту
// Google видає лише ключі нового формату ("AQ...."), які не приймаються
// стандартним REST-викликом generateContent, що очікує ключ формату "AIzaSy...".
//
// Коли ключ буде вирішено, замінити тіло функції нижче на щось на кшталт:
//
//   const res = await fetch(
//     `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
//     {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//         contents: [{ parts: [{ text: buildGradingPrompt(input) }] }],
//         generationConfig: { responseMimeType: "application/json" },
//       }),
//     }
//   );
//   const data = await res.json();
//   // розпарсити текст відповіді моделі в CheckAnswerResult (JSON) і повернути.
//
// GEMINI_API_KEY читати лише тут, на сервері — ніколи не передавати на клієнт.
// Перед інтеграцією звірити з актуальною документацією Gemini API формат
// автентифікації для нового типу ключів (мої дані станом на січень 2026 ще
// описують формат AIzaSy...).
export async function checkEssayAnswer(
  input: CheckOpenAnswerInput
): Promise<CheckAnswerResult> {
  void input;

  return {
    correct: false,
    feedback: "AI-перевірка тимчасово недоступна, очікує на технічне рішення.",
  };
}
