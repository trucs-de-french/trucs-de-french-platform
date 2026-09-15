-- Розширення scene_content_blocks (0036) двома новими типами — 'script' і
-- 'links' — дозволяють кілька незалежних додаткових блоків Скрипта/Практики
-- на одній сцені, на додачу до вже фіксованих. Жодних нових shell-таблиць:
-- обидва типи реєструються через уже наявний scene_content_blocks/
-- scene_blocks.ref_id реєстр, той самий принцип, що text/audio/video/embed.
--
-- 'script' — фактичний вміст (dialogue) лежить ПРЯМО на рядку
-- scene_content_blocks (нова колонка), та сама форма, що scenes.dialogue —
-- це самодостатній jsonb-блоб, не рядки з FK, тож нової таблиці не треба.
-- content_text/media_url лишаються null для цього типу.
--
-- 'links' — сам рядок scene_content_blocks лише "оболонка"/заголовок
-- блоку; фактичні посилання — окремі рядки scene_links із новим
-- content_block_id (нижче). Фіксована Практика сцени (scene_links без
-- content_block_id) лишається абсолютно незайманою.
alter table public.scene_content_blocks add column dialogue jsonb;

alter table public.scene_content_blocks drop constraint if exists scene_content_blocks_content_type_check;
alter table public.scene_content_blocks add constraint scene_content_blocks_content_type_check
  check (content_type in ('text', 'audio', 'video', 'embed', 'script', 'links'));

alter table public.scene_links add column content_block_id uuid
  references public.scene_content_blocks (id) on delete cascade;
