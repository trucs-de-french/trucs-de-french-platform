-- ============================================================================
-- Виправлення copy_task (0025, розширено 0032) — гілка order_index для
-- сцени/матеріалу/DELF-вільного контексту раніше скоупилась ЛИШЕ по
-- scene_id/material_id, ігноруючи delf_section/delf_test_number повністю.
-- Для DELF-задач (де scene_id і material_id завжди null) це означало, що
-- копія в конкретний тест отримувала order_index = max+1 серед УСІХ
-- DELF-задач продукту (усіх 30 тестів разом), а не лише цільового тесту —
-- та сама прогалина, що вже виправлена для create/move в task-order.ts.
--
-- Для сцен/матеріалів поведінка НЕ змінюється: p_delf_section/
-- p_delf_test_number там завжди null з обох боків ("is not distinct from"
-- null=null істинне), тож новий фільтр — чистий no-op у цьому випадку.
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
    -- scene_id/material_id/delf_section/delf_test_number батьківського
    -- контексту блоку).
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
