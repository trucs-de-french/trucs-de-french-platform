-- Новий тип завдання 'word_search' ("Філворд") — студент шукає задані
-- слова в сітці літер, виділяючи послідовність клітинок по прямій лінії
-- (горизонталь/вертикаль). Сітка генерується один раз в адмінці (не на
-- кожен рендер) і зберігається в config разом із координатами слів.
-- Назва рядка провизорна — легко перейменувати цим же способом
-- (drop+add constraint), якщо оберете іншу.
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
      'word_search'
    )
  );
