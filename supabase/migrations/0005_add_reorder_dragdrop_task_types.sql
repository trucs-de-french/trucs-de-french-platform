-- Додає типи 'reorder' (розкладіть у правильному порядку) і 'drag_drop'
-- (перетягніть слова з банку в пропуски).
--
-- 'reorder'   config: { instructions?, items: string[] } — items у ПРАВИЛЬНОМУ
--             порядку; студенту показується перемішаний список.
-- 'drag_drop' config: { instructions?, template: string, bank: string[] } —
--             template як у fill_blank ({{слово}}), але з одним варіантом
--             на пропуск (бо це фіксоване слово з банку, не вільний ввід).

alter table public.tasks drop constraint if exists tasks_type_check;

alter table public.tasks add constraint tasks_type_check
  check (
    type in (
      'game', 'open_answer', 'listening', 'error_correction', 'repetition',
      'embed', 'link',
      'essay_check', 'ai_examiner',
      'fill_blank', 'multiple_choice', 'true_false', 'matching',
      'reorder', 'drag_drop'
    )
  );
