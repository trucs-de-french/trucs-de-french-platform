-- Новий тип завдання 'crossword' ("Кросворд") — автогенерований кросворд
-- із перетинними словами (на відміну від word_search, де слова розкидані
-- окремо в сітці шуму). Генерація — один раз в адмінці (crossword-fields.tsx),
-- як і для word_search, не на кожен рендер.
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
      'crossword'
    )
  );
