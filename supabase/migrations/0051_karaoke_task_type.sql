-- Новий тип завдання 'karaoke' ("Караоке") — відео (YouTube) + текст пісні/
-- скрипту з пропусками, синхронізований за часом. Список типів нижче — ТОЧНО
-- поточний живий CHECK (перевірено запитом pg_get_constraintdef проти
-- production-БД), плюс 'karaoke' у кінці — нічого іншого не додано й не
-- прибрано.
alter table public.tasks drop constraint if exists tasks_type_check;

alter table public.tasks add constraint tasks_type_check
  check (
    type in (
      'game', 'open_answer', 'listening', 'error_correction', 'vocab_quiz',
      'embed', 'link',
      'essay_check', 'ai_examiner',
      'fill_blank', 'multiple_choice', 'true_false', 'matching',
      'reorder', 'drag_drop',
      'sort_columns', 'flip_cards',
      'callout',
      'phonetics',
      'table_fill',
      'image_match',
      'checkbox_grid',
      'chronological_order',
      'letter_gaps',
      'letter_rearrangement',
      'word_choice',
      'word_search',
      'crossword',
      'karaoke'
    )
  );
