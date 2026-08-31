-- Переводить scene_blocks (0009) з моделі "по рядку на кожен окремий
-- link/task" на модель "по одному рядку на кожну з 4 фіксованих груп сцени"
-- (video/script/link/task). Порядок УСЕРЕДИНІ групи 'link'/'task' і надалі
-- керується їхніми власними order_index (scene_links.order_index /
-- tasks.order_index) — scene_blocks тепер відповідає лише за порядок самих
-- 4 груп між собою. ref_id відповідно більше не потрібен.

-- 1) Консолідуємо 'link'-рядки -> лишаємо рівно один на сцену (з
--    найменшим position, тай-брейк за id для детермінованості).
with ranked as (
  select id, row_number() over (partition by scene_id order by position, id) as rn
  from public.scene_blocks
  where block_type = 'link'
)
delete from public.scene_blocks
where id in (select id from ranked where rn > 1);

-- 2) Те саме для 'task'-рядків.
with ranked as (
  select id, row_number() over (partition by scene_id order by position, id) as rn
  from public.scene_blocks
  where block_type = 'task'
)
delete from public.scene_blocks
where id in (select id from ranked where rn > 1);

-- 3) Обнуляємо ref_id на рядках, що лишились (готуємось видалити стовпець).
update public.scene_blocks set ref_id = null where ref_id is not null;

-- 4) Добудовуємо групи 'link'/'task' для сцен, де їх узагалі не було жодного
--    рядка в 0009 (стара модель створювала рядок тільки за наявності хоч
--    одного link/task; тепер групи мають існувати завжди, навіть порожні).
insert into public.scene_blocks (scene_id, block_type, position)
select s.id, 'link',
  coalesce((select max(position) + 1 from public.scene_blocks sb where sb.scene_id = s.id), 0)
from public.scenes s
where not exists (
  select 1 from public.scene_blocks sb where sb.scene_id = s.id and sb.block_type = 'link'
);

insert into public.scene_blocks (scene_id, block_type, position)
select s.id, 'task',
  coalesce((select max(position) + 1 from public.scene_blocks sb where sb.scene_id = s.id), 0)
from public.scenes s
where not exists (
  select 1 from public.scene_blocks sb where sb.scene_id = s.id and sb.block_type = 'task'
);

-- 5) ref_id більше ніколи не заповнюється -- прибираємо стовпець і
--    застарілий unique index, який його стосувався. Index на (scene_id,
--    block_type) where ref_id is null лишається -- він і так уже гарантує
--    рівно один рядок на групу на сцену, що є точним інваріантом нової моделі.
drop index if exists public.scene_blocks_ref_idx;
alter table public.scene_blocks drop column ref_id;
