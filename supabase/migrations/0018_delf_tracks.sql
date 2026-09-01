-- ============================================================================
-- Треки курсів (Кіно / DELF / Граматика) + секція/режим DELF-задач.
--
-- 'grammar' додається в CHECK ЗАРАЗ, щоб не блокувати додавання граматичного
-- треку пізніше без нової міграції — UI для нього поки НЕ реалізується.
-- ============================================================================

alter table public.products drop constraint if exists products_type_check;
alter table public.products add constraint products_type_check
  check (type in ('film', 'delf', 'grammar'));

-- level — лише для DELF-продуктів (один продукт на рівень A1-B2), null для
-- film/grammar.
alter table public.products add column level text
  constraint products_level_check check (level in ('A1', 'A2', 'B1', 'B2'));
alter table public.products add constraint products_level_only_for_delf
  check (level is null or type = 'delf');

-- delf_section/delf_mode — теги на tasks, що належать DELF-продуктам;
-- дозволяють тому самому task-редактору в адмінці авторити як Entraînement,
-- так і Examen контент, розрізнений по секції іспиту (CO/CE/PE/PO). Null
-- для tasks, що належать film/grammar продуктам.
alter table public.tasks add column delf_section text
  constraint tasks_delf_section_check check (delf_section in ('CO', 'CE', 'PE', 'PO'));
alter table public.tasks add column delf_mode text
  constraint tasks_delf_mode_check check (delf_mode in ('entrainement', 'examen'));
