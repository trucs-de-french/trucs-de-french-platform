-- ============================================================================
-- "Копіювати задачу" (copy_task, тіло оновлене 0034) і "Копіювати сцену"
-- (duplicate_scene, тіло оновлене 0057) не копіювали points_visible (0028)
-- у новий рядок tasks — копія завжди отримувала дефолт колонки (false),
-- навіть якщо в оригінала "Показувати бали студенту заздалегідь" було
-- увімкнено. CREATE OR REPLACE обох функцій, сигнатури/security/тіло —
-- без змін, лише points_visible додано в insert/select списки колонок
-- tasks (в duplicate_scene — у ВІДБОХ insert-ах: задачі верхнього рівня
-- сцени й задачі-члени task_groups). Жодних GRANT-рядків раніше не було
-- (0049) — тут теж немає, нічого й не прибирається.
-- ============================================================================

create or replace function public.copy_task(
  p_task_id uuid,
  p_scene_id uuid default null,
  p_material_id uuid default null,
  p_delf_section text default null,
  p_delf_test_number integer default null,
  p_task_group_id uuid default null
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_task record;
  v_new_task_id uuid;
  v_order_index integer;
begin
  select * into v_task from public.tasks where id = p_task_id;
  if v_task.id is null then
    raise exception 'Завдання не знайдено';
  end if;

  if p_task_group_id is not null then
    select coalesce(max(order_index), 0) + 1 into v_order_index
    from public.tasks
    where task_group_id = p_task_group_id;
  else
    select coalesce(max(order_index), 0) + 1 into v_order_index
    from public.tasks
    where product_id = v_task.product_id
      and scene_id is not distinct from p_scene_id
      and material_id is not distinct from p_material_id
      and delf_section is not distinct from p_delf_section
      and delf_test_number is not distinct from p_delf_test_number;
  end if;

  insert into public.tasks (
    product_id, scene_id, material_id, task_group_id, type, title, order_index,
    config, image_url, audio_url, delf_section, delf_test_number, points_visible
  )
  values (
    v_task.product_id,
    case when p_task_group_id is null then p_scene_id else null end,
    case when p_task_group_id is null then p_material_id else null end,
    p_task_group_id,
    v_task.type,
    v_task.title || ' (копія)', v_order_index, v_task.config,
    v_task.image_url, v_task.audio_url,
    case when p_task_group_id is null then p_delf_section else null end,
    case when p_task_group_id is null then p_delf_test_number else null end,
    v_task.points_visible
  )
  returning id into v_new_task_id;

  if v_task.type = 'game' then
    insert into public.games (task_id, provider, embed_url, game_type)
    select v_new_task_id, provider, embed_url, game_type
    from public.games
    where task_id = v_task.id;
  end if;

  return v_new_task_id;
end;
$$;

create or replace function public.duplicate_scene(p_scene_id uuid)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_new_scene_id uuid;
  v_product_id uuid;
  v_order_index integer;
  v_task record;
  v_new_task_id uuid;
  v_group record;
  v_new_group_id uuid;
  v_content_block record;
  v_new_content_block_id uuid;
begin
  select product_id into v_product_id from public.scenes where id = p_scene_id;
  if v_product_id is null then
    raise exception 'Сцену не знайдено';
  end if;

  select coalesce(max(order_index), 0) + 1 into v_order_index
  from public.scenes
  where product_id = v_product_id;

  insert into public.scenes (product_id, order_index, title, video_url, video_provider, subtitles, dialogue)
  select product_id, v_order_index, title || ' (копія)', video_url, video_provider, subtitles, dialogue
  from public.scenes
  where id = p_scene_id
  returning id into v_new_scene_id;

  create temporary table if not exists tmp_group_id_map (old_id uuid primary key, new_id uuid not null);
  truncate tmp_group_id_map;
  create temporary table if not exists tmp_content_block_id_map (old_id uuid primary key, new_id uuid not null);
  truncate tmp_content_block_id_map;

  for v_content_block in
    select * from public.scene_content_blocks where scene_id = p_scene_id
  loop
    insert into public.scene_content_blocks (
      scene_id, content_type, content_text, media_url, media_provider, subtitles, title, dialogue
    )
    values (
      v_new_scene_id, v_content_block.content_type, v_content_block.content_text,
      v_content_block.media_url, v_content_block.media_provider, v_content_block.subtitles,
      v_content_block.title, v_content_block.dialogue
    )
    returning id into v_new_content_block_id;

    insert into tmp_content_block_id_map values (v_content_block.id, v_new_content_block_id);
  end loop;

  for v_group in
    select * from public.task_groups where scene_id = p_scene_id or scene_content_block_id in (
      select old_id from tmp_content_block_id_map
    )
  loop
    insert into public.task_groups (
      product_id, scene_id, scene_content_block_id, content_type, content_text, media_url,
      media_provider, subtitles, points_mode, flat_points, title, order_index
    )
    values (
      v_group.product_id,
      case when v_group.scene_id is not null then v_new_scene_id else null end,
      (select new_id from tmp_content_block_id_map where old_id = v_group.scene_content_block_id),
      v_group.content_type, v_group.content_text,
      v_group.media_url, v_group.media_provider, v_group.subtitles, v_group.points_mode, v_group.flat_points,
      v_group.title, v_group.order_index
    )
    returning id into v_new_group_id;

    insert into tmp_group_id_map values (v_group.id, v_new_group_id);
  end loop;

  insert into public.scene_links (scene_id, platform, url, label, order_index, content_block_id)
  select
    v_new_scene_id, platform, url, label, order_index,
    (select new_id from tmp_content_block_id_map where old_id = scene_links.content_block_id)
  from public.scene_links
  where scene_id = p_scene_id;

  -- Задачі верхнього рівня сцени — points_visible додано в insert/select.
  for v_task in
    select * from public.tasks where scene_id = p_scene_id order by order_index
  loop
    insert into public.tasks (
      product_id, scene_id, task_group_id, type, title, order_index, config, image_url, audio_url,
      points_visible
    )
    values (
      v_task.product_id, v_new_scene_id,
      (select new_id from tmp_group_id_map where old_id = v_task.task_group_id),
      v_task.type, v_task.title, v_task.order_index, v_task.config, v_task.image_url, v_task.audio_url,
      v_task.points_visible
    )
    returning id into v_new_task_id;

    if v_task.type = 'game' then
      insert into public.games (task_id, provider, embed_url, game_type)
      select v_new_task_id, provider, embed_url, game_type
      from public.games
      where task_id = v_task.id;
    end if;
  end loop;

  -- Задачі-члени task_groups — те саме доповнення points_visible.
  for v_group in
    select old_id, new_id from tmp_group_id_map
  loop
    for v_task in
      select * from public.tasks where task_group_id = v_group.old_id order by order_index
    loop
      insert into public.tasks (
        product_id, task_group_id, type, title, order_index, config, image_url, audio_url, points_visible
      )
      values (
        v_task.product_id, v_group.new_id,
        v_task.type, v_task.title, v_task.order_index, v_task.config, v_task.image_url, v_task.audio_url,
        v_task.points_visible
      )
      returning id into v_new_task_id;

      if v_task.type = 'game' then
        insert into public.games (task_id, provider, embed_url, game_type)
        select v_new_task_id, provider, embed_url, game_type
        from public.games
        where task_id = v_task.id;
      end if;
    end loop;
  end loop;

  insert into public.scene_blocks (scene_id, block_type, position, ref_id)
  select
    v_new_scene_id, block_type, position,
    (select new_id from tmp_content_block_id_map where old_id = scene_blocks.ref_id)
  from public.scene_blocks
  where scene_id = p_scene_id;

  return v_new_scene_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Перевірка ПІСЛЯ застосування (лише SELECT, нічого не змінює):
-- 1. Візьми будь-яку задачу з points_visible = true (або тимчасово
--    увімкни "Показувати бали студенту заздалегідь" на якійсь задачі).
-- 2. Задублюй її через "Копіювати задачу" (copyTask) АБО продублюй цілу
--    сцену, якій вона належить, через "Копіювати сцену" (duplicate_scene).
-- 3. Виконай:
--
-- select id, title, points_visible
-- from public.tasks
-- where title like '%(копія)' or scene_id = '<new_scene_id_тут>'
-- order by created_at desc
-- limit 5;
--
-- Очікується: у копії points_visible = true, той самий, що в оригіналі.
-- ----------------------------------------------------------------------------
