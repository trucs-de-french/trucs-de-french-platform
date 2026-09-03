-- ============================================================================
-- Копіювання задачі з можливістю вибрати ІНШОГО власника (сцена/DELF-тест/
-- матеріал) — на відміну від дублювання на місці, це перенесення в інше
-- місце платформи зі збереженням оригіналу. Той самий атомарний RPC-патерн,
-- що вже duplicate_scene (0012): якщо будь-який крок впаде, уся транзакція
-- відкочується, не лишається "сирітського" рядка. security invoker — RLS
-- (is_teacher()) спрацьовує як завжди, без дублювання перевірки ролі тут.
-- ============================================================================

create or replace function public.copy_task(
  p_task_id uuid,
  p_scene_id uuid default null,
  p_material_id uuid default null,
  p_delf_section text default null,
  p_delf_test_number integer default null
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

  -- order_index рахується в межах ЦІЛЬОВОГО скоупу (той самий scene_id/
  -- material_id, що вже застосований у createTask/moveTask) — "is not
  -- distinct from" замість "=", бо scene_id/material_id можуть бути null.
  select coalesce(max(order_index), 0) + 1 into v_order_index
  from public.tasks
  where product_id = v_task.product_id
    and scene_id is not distinct from p_scene_id
    and material_id is not distinct from p_material_id;

  insert into public.tasks (
    product_id, scene_id, material_id, type, title, order_index, config,
    image_url, audio_url, delf_section, delf_test_number
  )
  values (
    v_task.product_id, p_scene_id, p_material_id, v_task.type,
    v_task.title || ' (копія)', v_order_index, v_task.config,
    v_task.image_url, v_task.audio_url, p_delf_section, p_delf_test_number
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
