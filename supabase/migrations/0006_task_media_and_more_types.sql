-- Універсальні опційні медіа-поля на рівні task (не всередині config) —
-- показуються над змістом будь-якого завдання, незалежно від типу.
alter table public.tasks add column if not exists image_url text;
alter table public.tasks add column if not exists audio_url text;

-- Нові типи:
-- 'sort_columns' config: { instructions?, columns: [{id, label}],
--                           items: [{id, text, columnId}] }
-- 'flip_cards'   config: { instructions?, cards: [{front, back, image_url?, audio_url?}] }
--                — самостійний тип, без автоперевірки, наповнюється вручну
--                (на відміну від 'repetition', який бере лексику зі scene.dialogue).
--
-- 'download' окремим типом НЕ додається — реалізовано як config.download
-- на вже наявному типі 'link'.

alter table public.tasks drop constraint if exists tasks_type_check;

alter table public.tasks add constraint tasks_type_check
  check (
    type in (
      'game', 'open_answer', 'listening', 'error_correction', 'repetition',
      'embed', 'link',
      'essay_check', 'ai_examiner',
      'fill_blank', 'multiple_choice', 'true_false', 'matching',
      'reorder', 'drag_drop',
      'sort_columns', 'flip_cards'
    )
  );
