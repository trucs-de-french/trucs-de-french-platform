-- Новий тип завдання 'letter_gaps' ("Пропущені літери") — вчитель клікає
-- окремі символи в слові, щоб позначити їх прихованими; студент вписує
-- кожен прихований символ в окремий однолітерний input; зарахування —
-- усе-або-нічого на всю вправу, як у fill_blank.
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
      'letter_gaps'
    )
  );
