-- duplicate_scene (0012, виправлена 0039) знову відстає: task_groups тепер
-- може мати scene_content_block_id (0040), а 0039 копіювала task_groups
-- ДО scene_content_blocks і явним списком стовпців без scene_content_block_id
-- — прикріплений до content-блоку набір вправ при копіюванні сцени втратив
-- би зв'язок (лишався б з scene_content_block_id=null, тобто взагалі не
-- прикріпленим до жодного блоку копії).
--
-- Виправлення: міняємо порядок (scene_content_blocks копіюються ПЕРШИМИ,
-- щоб tmp_content_block_id_map уже була готова) і додаємо
-- scene_content_block_id в INSERT task_groups, резолвлений через ту саму
-- мапу, що вже використовується для scene_links.content_block_id/
-- scene_blocks.ref_id.
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

  insert into public.scenes (product_id, order_index, title, video_url, video_provider, dialogue)
  select product_id, v_order_index, title || ' (копія)', video_url, video_provider, dialogue
  from public.scenes
  where id = p_scene_id
  returning id into v_new_scene_id;

  create temporary table if not exists tmp_group_id_map (old_id uuid primary key, new_id uuid not null);
  truncate tmp_group_id_map;
  create temporary table if not exists tmp_content_block_id_map (old_id uuid primary key, new_id uuid not null);
  truncate tmp_content_block_id_map;

  -- scene_content_blocks (Крок 1/2) — ПЕРШИМИ: task_groups нижче може
  -- посилатись на них через scene_content_block_id (0040).
  for v_content_block in
    select * from public.scene_content_blocks where scene_id = p_scene_id
  loop
    insert into public.scene_content_blocks (
      scene_id, content_type, content_text, media_url, media_provider, title, dialogue
    )
    values (
      v_new_scene_id, v_content_block.content_type, v_content_block.content_text,
      v_content_block.media_url, v_content_block.media_provider, v_content_block.title,
      v_content_block.dialogue
    )
    returning id into v_new_content_block_id;

    insert into tmp_content_block_id_map values (v_content_block.id, v_new_content_block_id);
  end loop;

  -- task_groups сцени, включно з прикріпленими до content-блоків (0040,
  -- scene_id null, scene_content_block_id заповнений) — резолвиться через
  -- мапу, побудовану вище; для звичайних груп (scene_id заповнений) підзапит
  -- просто дає null, бо scene_content_block_id у них і так null.
  for v_group in
    select * from public.task_groups where scene_id = p_scene_id or scene_content_block_id in (
      select old_id from tmp_content_block_id_map
    )
  loop
    insert into public.task_groups (
      product_id, scene_id, scene_content_block_id, content_type, content_text, media_url,
      media_provider, points_mode, flat_points, title, order_index
    )
    values (
      v_group.product_id,
      case when v_group.scene_id is not null then v_new_scene_id else null end,
      (select new_id from tmp_content_block_id_map where old_id = v_group.scene_content_block_id),
      v_group.content_type, v_group.content_text,
      v_group.media_url, v_group.media_provider, v_group.points_mode, v_group.flat_points,
      v_group.title, v_group.order_index
    )
    returning id into v_new_group_id;

    insert into tmp_group_id_map values (v_group.id, v_new_group_id);
  end loop;

  -- content_block_id null (фіксована Практика) лишається null — підзапит на
  -- порожній map просто не знаходить рядка.
  insert into public.scene_links (scene_id, platform, url, label, order_index, content_block_id)
  select
    v_new_scene_id, platform, url, label, order_index,
    (select new_id from tmp_content_block_id_map where old_id = scene_links.content_block_id)
  from public.scene_links
  where scene_id = p_scene_id;

  -- Задачі верхнього рівня сцени (scene_id = p_scene_id, task_group_id
  -- завжди null за інваріантом моделі — підзапит просто резолвиться в null).
  for v_task in
    select * from public.tasks where scene_id = p_scene_id order by order_index
  loop
    insert into public.tasks (
      product_id, scene_id, task_group_id, type, title, order_index, config, image_url, audio_url
    )
    values (
      v_task.product_id, v_new_scene_id,
      (select new_id from tmp_group_id_map where old_id = v_task.task_group_id),
      v_task.type, v_task.title, v_task.order_index, v_task.config, v_task.image_url, v_task.audio_url
    )
    returning id into v_new_task_id;

    if v_task.type = 'game' then
      insert into public.games (task_id, provider, embed_url, game_type)
      select v_new_task_id, provider, embed_url, game_type
      from public.games
      where task_id = v_task.id;
    end if;
  end loop;

  -- Задачі-члени УСІХ скопійованих task_groups (і scene_id-, і
  -- scene_content_block_id-прив'язаних) — не покриваються циклом вище (він
  -- фільтрує scene_id на самій задачі), окремий прохід по кожному рядку в
  -- tmp_group_id_map.
  for v_group in
    select old_id, new_id from tmp_group_id_map
  loop
    for v_task in
      select * from public.tasks where task_group_id = v_group.old_id order by order_index
    loop
      insert into public.tasks (
        product_id, task_group_id, type, title, order_index, config, image_url, audio_url
      )
      values (
        v_task.product_id, v_group.new_id,
        v_task.type, v_task.title, v_task.order_index, v_task.config, v_task.image_url, v_task.audio_url
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

  -- ref_id null (video/script/link/task — фіксовані 4) лишається null.
  insert into public.scene_blocks (scene_id, block_type, position, ref_id)
  select
    v_new_scene_id, block_type, position,
    (select new_id from tmp_content_block_id_map where old_id = scene_blocks.ref_id)
  from public.scene_blocks
  where scene_id = p_scene_id;

  return v_new_scene_id;
end;
$$;
