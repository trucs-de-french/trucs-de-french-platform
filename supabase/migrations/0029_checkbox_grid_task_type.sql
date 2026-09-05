-- Новий тип завдання 'checkbox_grid' ("Таблиця вибору") — довільна кількість
-- рядків (твердження/питання) і колонок (кастомні підписи); студент
-- позначає чекбоксами будь-яку кількість клітинок в одному рядку одночасно;
-- часткове зарахування по клітинці (score), бали — по рядку, як у table_fill.
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
      'checkbox_grid'
    )
  );
