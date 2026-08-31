-- Додає 4 інтерактивні типи завдань з автоперевіркою на сервері.
--
-- 'fill_blank'       config: { template: "Je {{vais|vais bien}} au cinéma." }
--                    правильні варіанти прямо в {{...}} через "|"
-- 'multiple_choice'  config: { question, display: "buttons"|"dropdown",
--                               options: [{ id, text, correct }] }
-- 'true_false'       config: { statements: [{ id, text, answer: boolean }] }
-- 'matching'         config: { pairs: [{ left, right }] }
--
-- Студенту завжди йде "очищена" версія config (без правильних відповідей) —
-- див. src/lib/exercises/sanitize.ts. Перевірка відбувається виключно на
-- сервері через /api/exercises/check, який підвантажує повний config напряму
-- з бази — клієнту в цьому питанні довіри немає.

alter table public.tasks drop constraint if exists tasks_type_check;

alter table public.tasks add constraint tasks_type_check
  check (
    type in (
      'game', 'open_answer', 'listening', 'error_correction', 'repetition',
      'embed', 'link',
      'essay_check', 'ai_examiner',
      'fill_blank', 'multiple_choice', 'true_false', 'matching'
    )
  );
