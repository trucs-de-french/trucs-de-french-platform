-- Новий тип завдання 'word_choice' ("Вибір правильної форми") — список
-- речень, у кожному одна група варіантів (напр. "Il [attends/attend/
-- attendent] le bus?"), студент або обирає правильний, або викреслює
-- зайві (режим на рівні всього завдання). Назва рядка провизорна — легко
-- перейменувати цим же способом (drop+add constraint), якщо оберете іншу.
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
      'word_choice'
    )
  );
