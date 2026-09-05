-- Новий тип завдання 'chronological_order' ("Хронологічний порядок") —
-- набір елементів (картинки АБО текстові твердження, один режим на всю
-- вправу) показується студенту перемішаним з літерами A/B/C..., студент
-- вписує число-позицію для кожного; часткове зарахування по елементу.
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
      'chronological_order'
    )
  );
