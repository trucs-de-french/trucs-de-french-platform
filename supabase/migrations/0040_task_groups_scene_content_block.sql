-- Дозволяє БУДЬ-ЯКОМУ scene_content_block (текст/аудіо/відео/embed/скрипт/
-- практика, 0036-0038) опційно мати прикріплений набір вправ — той самий
-- механізм, що вже дає task_groups для "Завдання", як 4-й, мутуально-
-- виключний варіант батьківства (на додачу до вже наявних scene_id/
-- material_id/delf_section+delf_test_number). Свідомо НЕ scene_id: такий
-- task_group НЕ повинен потрапляти у флет-список "Завдання" (той список
-- фільтрується саме по scene_id) — інакше вправи показувались би двічі
-- (і в картці content-блоку, і окремою карткою в "Завданнях").
--
-- Власні content_type/content_text/media_url такого task_group лишаються
-- незаповненими (заглушка 'text' з порожнім content_text) — фактичний
-- вміст уже показує сам scene_content_block; TaskGroupBlock/task-group-
-- fields.tsx і так трактують порожній вміст як "нічого не показувати"
-- (falsy-guard на кожній гілці content_type), тож рендериться лише
-- задачі+бали, без дублювання.
--
-- 1:1 (щонайбільше один прикріплений task_group на блок) — звідси unique
-- partial index, а не просто nullable FK.
alter table public.task_groups add column scene_content_block_id uuid
  references public.scene_content_blocks (id) on delete cascade;

create unique index task_groups_scene_content_block_idx
  on public.task_groups (scene_content_block_id)
  where scene_content_block_id is not null;
