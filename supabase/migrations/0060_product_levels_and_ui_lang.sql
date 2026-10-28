-- ============================================================================
-- Множинні CEFR-рівні та мова інтерфейсу завдань — для ВСІХ типів продуктів
-- (film / delf / grammar), не лише DELF.
--
-- products.level (одне значення, лише для DELF, 0018_delf_tracks.sql)
-- ЛИШАЄТЬСЯ без змін — його constraint і весь існуючий DELF-код
-- (api/delf/check, courses/[productId]/tests/*), що читає це поле, далі
-- працюють як раніше. levels — новий, окремий, множинний список, видимий
-- і редагований в адмінці для всіх типів курсів; ui_lang — мова кнопок/
-- підказок у завданнях цього продукту (студентська плюмбінг — окремий крок).
-- ============================================================================

alter table public.products
  add column levels text[] not null default '{}'::text[]
  constraint products_levels_check
  check (levels <@ array['A1', 'A2', 'B1', 'B2', 'C1', 'C2']::text[]);

alter table public.products
  add column ui_lang text not null default 'uk'
  constraint products_ui_lang_check check (ui_lang in ('uk', 'fr'));

-- Бекфіл: DELF-продукти, що вже мають одиничний level, одразу показують
-- те саме значення в новому мультиселекті рівнів.
update public.products
set levels = array[level]
where level is not null and levels = '{}'::text[];
