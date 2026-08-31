-- Копіювання сцени одним атомарним викликом (RPC), а не серією окремих
-- INSERT з JS — якщо будь-який крок впаде, уся функція відкочується разом
-- (виклик функції виконується в межах однієї транзакції), тож "сирітської"
-- напівскопійованої сцени лишитись не може. security invoker (не definer) —
-- функція виконується з правами того, хто її викликає, тож RLS-політики
-- (is_teacher()) на scenes/scene_links/tasks/games/scene_blocks спрацьовують
-- як завжди, без потреби дублювати перевірку ролі тут.
--
-- vocab_quiz.config (зокрема sceneIds) копіюється ДОСЛІВНО, без переписування
-- — лексика фізично лежить у dialogue тих сцен, на які посилається config, і
-- ці сцени можуть бути геть іншими, ніж та, що копіюється.
--
-- tasks копіюються циклом (а не масовим INSERT ... SELECT ... RETURNING),
-- бо для type='game' потрібен НОВИЙ task_id, щоб скопіювати відповідний
-- рядок games (1:1 підтип) — масовий INSERT не дає надійної відповідності
-- "який новий рядок відповідає якому старому".
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

  insert into public.scene_links (scene_id, platform, url, label, order_index)
  select v_new_scene_id, platform, url, label, order_index
  from public.scene_links
  where scene_id = p_scene_id;

  for v_task in
    select * from public.tasks where scene_id = p_scene_id order by order_index
  loop
    insert into public.tasks (
      product_id, scene_id, type, title, order_index, config, image_url, audio_url
    )
    values (
      v_task.product_id, v_new_scene_id, v_task.type, v_task.title,
      v_task.order_index, v_task.config, v_task.image_url, v_task.audio_url
    )
    returning id into v_new_task_id;

    if v_task.type = 'game' then
      insert into public.games (task_id, provider, embed_url, game_type)
      select v_new_task_id, provider, embed_url, game_type
      from public.games
      where task_id = v_task.id;
    end if;
  end loop;

  insert into public.scene_blocks (scene_id, block_type, position)
  select v_new_scene_id, block_type, position
  from public.scene_blocks
  where scene_id = p_scene_id;

  return v_new_scene_id;
end;
$$;
