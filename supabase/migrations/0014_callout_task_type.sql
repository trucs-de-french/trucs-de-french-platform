-- Новий тип завдання 'callout' — текстовий інформаційний блок (на кшталт
-- Notion callout), НЕ вправа з перевіркою. config: { style, content } —
-- style: 'none'|'info'|'tip'|'warning'|'success'|'special', content —
-- санітизований HTML (TipTap), санітизація на межі збереження й на межі
-- рендеру (isomorphic-dompurify), не в базі.
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
      'callout'
    )
  );
