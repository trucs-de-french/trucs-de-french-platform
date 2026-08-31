-- Резервує назви майбутніх типів завдань для курсу DELF. Логіка НЕ реалізована —
-- лише розширення допустимих значень tasks.type, щоб не переробляти міграцію
-- пізніше, коли дійде черга до реалізації.
--
-- 'essay_check' — перевірка есе/офіційного листа через Gemini за критеріями DELF.
-- 'ai_examiner' — усна розмова з AI-екзаменатором:
--   Speech-to-Text (мовлення студента) -> Gemini (репліка екзаменатора) -> Google Cloud TTS (озвучення).
--
-- Обидва заблоковані тим самим Gemini-ключем (див. src/lib/delf/check-answer.ts),
-- ai_examiner додатково потребуватиме GOOGLE_STT_API_KEY (Google Cloud
-- Speech-to-Text), який ще не підключено.

alter table public.tasks drop constraint if exists tasks_type_check;

alter table public.tasks add constraint tasks_type_check
  check (
    type in (
      'game', 'open_answer', 'listening', 'error_correction', 'repetition',
      'embed', 'link',
      'essay_check', 'ai_examiner'
    )
  );
