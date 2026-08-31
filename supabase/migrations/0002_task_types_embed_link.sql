-- Додає типи завдань 'embed' (вбудований iframe) і 'link' (кнопка-посилання).
-- config для 'embed': { "url": "...", "height": 480 }
-- config для 'link':  { "url": "...", "label": "...", "platform": "youtube" | "wordwall" | "genially" | "custom" }

alter table public.tasks drop constraint if exists tasks_type_check;

alter table public.tasks add constraint tasks_type_check
  check (
    type in (
      'game', 'open_answer', 'listening', 'error_correction', 'repetition',
      'embed', 'link'
    )
  );
