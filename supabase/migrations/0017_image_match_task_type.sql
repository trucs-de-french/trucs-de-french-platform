-- Новий тип завдання 'image_match' — кілька зображень, під кожним порожня
-- зона для перетягування; банк перемішаних назв, рівно одна правильна назва
-- на зображення (auto-graded, перевикористовує useTilePlacement).
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
      'image_match'
    )
  );
