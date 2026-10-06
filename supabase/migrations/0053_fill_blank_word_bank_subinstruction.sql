-- ============================================================================
-- fill_blank з банком слів — старий дефолт subInstructions ("Впишіть
-- пропущені слова.") записувався в tasks.config буквально (конструктор,
-- task-config-fields.tsx) ДО того, як з'явився окремий варіант для вправ із
-- банком слів (FILL_BLANK_WORD_BANK_SUBINSTRUCTION, default-instructions.ts:
-- "Впишіть слова в пропуски самостійно. Використані викреслюйте зі списку.").
-- Для вже наявних fill_blank-задач із банком слів, де вчителька НЕ
-- редагувала це поле вручну (текст після trim буквально дорівнює старому
-- дефолту), новий текст ніколи не покажеться студенту — fill-blank.tsx бере
-- значення з config.subInstructions, якщо воно задане, і дефолт лише як
-- fallback. Цей UPDATE переносить такі задачі на новий текст.
--
-- ПЕРЕД застосуванням цього файлу виконайте в Supabase SQL Editor (лише
-- читання) і надішліть результат:
--
-- select count(*) as rows_to_update
-- from public.tasks
-- where type = 'fill_blank'
--   and jsonb_array_length(coalesce(config->'wordBank', '[]'::jsonb)) > 0
--   and trim(config->>'subInstructions') in (
--     'Впишіть пропущені слова.',
--     '<p>Впишіть пропущені слова.</p>'
--   );
--
-- select id, title, config->>'subInstructions' as sub_instructions
-- from public.tasks
-- where type = 'fill_blank'
--   and jsonb_array_length(coalesce(config->'wordBank', '[]'::jsonb)) > 0
--   and trim(config->>'subInstructions') in (
--     'Впишіть пропущені слова.',
--     '<p>Впишіть пропущені слова.</p>'
--   )
-- limit 5;
--
-- Два варіанти в IN — TipTap (InstructionsRichTextField) огортає текст у
-- <p>...</p>, щойно редактор хоч раз викликав onUpdate (навіть без реальної
-- зміни); якщо поле ніколи не торкались після автозаповнення — значення
-- лишається "голим" текстом без тегів. Обидва випадки — буквально старий
-- дефолт, не власний текст вчительки.
--
-- Цей файл НЕ застосовано мною (лише підготовлений) — щоб застосувати
-- (сам UPDATE нижче), виконайте після SELECT вище.
-- ============================================================================

update public.tasks
set config = jsonb_set(
  config,
  array['subInstructions'],
  to_jsonb('Впишіть слова в пропуски самостійно. Використані викреслюйте зі списку.'::text),
  true
)
where type = 'fill_blank'
  and jsonb_array_length(coalesce(config->'wordBank', '[]'::jsonb)) > 0
  and trim(config->>'subInstructions') in (
    'Впишіть пропущені слова.',
    '<p>Впишіть пропущені слова.</p>'
  );
