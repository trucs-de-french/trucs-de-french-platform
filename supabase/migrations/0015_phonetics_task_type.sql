-- Новий тип завдання 'phonetics' — довідковий (не auto-graded) список
-- реплік/фраз із фонетичною транскрипцією й опційним аудіо/відео на кожну.
-- config: { instructions?, items: [{ text, transcription, mediaUrl? }] } —
-- як і flip_cards/callout, повна конфігурація й публічна — одне й те саме,
-- немає правильної відповіді, sanitize не потрібен.
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
      'phonetics'
    )
  );
