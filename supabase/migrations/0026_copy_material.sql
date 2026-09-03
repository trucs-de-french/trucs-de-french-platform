-- ============================================================================
-- Копіювання матеріалу РАЗОМ з усіма прив'язаними вправами (material_id),
-- з можливістю обрати інший продукт (курс) призначення — на відміну від
-- copy_task, матеріал це радше довідковий контент, не прив'язаний жорстко
-- до конкретного курсу. Той самий атомарний RPC-патерн, що duplicate_scene
-- (0012) і copy_task (0025): якщо крок впаде, транзакція відкочується.
-- security invoker — RLS (is_teacher()) спрацьовує як завжди.
--
-- " (копія)" — лише на самому матеріалі, як і duplicate_scene додає суфікс
-- лише сцені, а не її дочірнім задачам; вправи всередині матеріалу так само
-- копіюються з незмінними назвами.
-- ============================================================================

create or replace function public.copy_material(
  p_material_id uuid,
  p_target_product_id uuid
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_new_material_id uuid;
  v_task record;
  v_new_task_id uuid;
begin
  insert into public.materials (product_id, title, category, file_url, file_type, content, style)
  select p_target_product_id, title || ' (копія)', category, file_url, file_type, content, style
  from public.materials
  where id = p_material_id
  returning id into v_new_material_id;

  if v_new_material_id is null then
    raise exception 'Матеріал не знайдено';
  end if;

  for v_task in
    select * from public.tasks where material_id = p_material_id order by order_index
  loop
    insert into public.tasks (
      product_id, material_id, type, title, order_index, config, image_url, audio_url,
      delf_section, delf_test_number
    )
    values (
      p_target_product_id, v_new_material_id, v_task.type, v_task.title,
      v_task.order_index, v_task.config, v_task.image_url, v_task.audio_url,
      v_task.delf_section, v_task.delf_test_number
    )
    returning id into v_new_task_id;

    if v_task.type = 'game' then
      insert into public.games (task_id, provider, embed_url, game_type)
      select v_new_task_id, provider, embed_url, game_type
      from public.games
      where task_id = v_task.id;
    end if;
  end loop;

  return v_new_material_id;
end;
$$;
