-- ============================================================================
-- Розширення copy_task (0025) новим необов'язковим призначенням — копія В
-- ТОМУ САМОМУ БЛОЦІ (task_group_id), без пікера: кнопка "Копіювати" на
-- сторінці блоку (GroupMemberDragList) викликає це з фіксованим
-- task_group_id, минаючи вибір scene/material/DELF. p_task_group_id
-- default null — стара поведінка (сцена/матеріал/DELF-тест) не змінюється,
-- усі наявні виклики лишаються сумісними без змін.
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
    -- Копія всередині блоку — власна незалежна послідовність order_index,
    -- той самий скоуп, що task-order.ts (task_group_id ігнорує
    -- scene_id/material_id батьківського контексту блоку).
    select coalesce(max(order_index), 0) + 1 into v_order_index
    from public.tasks
    where task_group_id = p_task_group_id;
  else
    -- order_index рахується в межах ЦІЛЬОВОГО скоупу (той самий scene_id/
    -- material_id, що вже застосований у createTask/moveTask) — "is not
    -- distinct from" замість "=", бо scene_id/material_id можуть бути null.
    select coalesce(max(order_index), 0) + 1 into v_order_index
    from public.tasks
    where product_id = v_task.product_id
      and scene_id is not distinct from p_scene_id
      and material_id is not distinct from p_material_id;
  end if;

  insert into public.tasks (
    product_id, scene_id, material_id, task_group_id, type, title, order_index,
    config, image_url, audio_url, delf_section, delf_test_number
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
    case when p_task_group_id is null then p_delf_test_number else null end
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
