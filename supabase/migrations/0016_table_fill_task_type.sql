-- Новий тип завдання 'table_fill' — таблиця з двома колонками (довільні
-- назви), де вчитель сам фіксує, які клітинки кожного рядка показуються як
-- текст, а які — порожні поля для введення студентом (auto-graded, кілька
-- допустимих варіантів через той самий '|'-синтаксис, що у fill_blank).
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
      'table_fill'
    )
  );
