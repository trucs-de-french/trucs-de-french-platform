-- Крок 2 з 2: інтеграція scene_content_blocks (0036) у спільне
-- впорядкування scene_blocks.position — той самий реєстр, що вже
-- впорядковує Відео/Скрипт/Практика/Завдання, тепер приймає й довільну
-- кількість рядків типу 'content'. На відміну від 0009/0010 (де кожен
-- фіксований тип — рівно один рядок на сцену), 'content' — єдиний тип, що
-- МОЖЕ повторюватись: ref_id відрізняє конкретний екземпляр.

alter table public.scene_blocks add column ref_id uuid
  references public.scene_content_blocks (id) on delete cascade;

-- Той самий приём, що вже в 0002/0003/... (drop constraint if exists +
-- add constraint із тим самим авто-згенерованим ім'ям <table>_<column>_check).
alter table public.scene_blocks drop constraint if exists scene_blocks_block_type_check;
alter table public.scene_blocks add constraint scene_blocks_block_type_check
  check (block_type in ('video', 'script', 'link', 'task', 'content'));

-- scene_blocks_scene_type_idx (0010) — звичайний UNIQUE(scene_id,
-- block_type) — заблокував би другий рядок 'content' на ту саму сцену.
-- Звужуємо його до фіксованих 4 типів (де інваріант "рівно один на сцену"
-- і далі чинний), і додаємо окремий unique на ref_id (не null) — не даємо
-- одному й тому ж scene_content_blocks-рядку зареєструватись у scene_blocks
-- двічі.
drop index if exists public.scene_blocks_scene_type_idx;
create unique index scene_blocks_scene_type_idx
  on public.scene_blocks (scene_id, block_type)
  where block_type <> 'content';
create unique index scene_blocks_ref_idx
  on public.scene_blocks (ref_id)
  where ref_id is not null;

-- Бекфіл: якщо на момент застосування цієї міграції вже існують
-- scene_content_blocks без відповідного рядка в scene_blocks (створені між
-- 0036 і цією міграцією, ще до появи коду вставки в createSceneContentBlock),
-- реєструємо їх у кінці порядку своєї сцени — max(position)+1, той самий
-- принцип, що вже в updateSceneVideo (scenes/actions.ts). row_number() —
-- НЕ просто max+1 для кожного рядка окремо: якщо в однієї сцени бракує
-- ДВОХ блоків, некорельований max() дав би їм ОДНАКОВУ позицію (жоден із
-- них ще не вставлений, поки рахується підзапит для іншого) — той самий
-- прийом, що вже в 0009_scene_blocks.sql.
with missing as (
  select
    b.scene_id,
    b.id,
    row_number() over (partition by b.scene_id order by b.created_at) as rn
  from public.scene_content_blocks b
  where not exists (
    select 1 from public.scene_blocks sb where sb.ref_id = b.id
  )
),
start_position as (
  select scene_id, coalesce(max(position) + 1, 0) as position
  from public.scene_blocks
  group by scene_id
)
insert into public.scene_blocks (scene_id, block_type, ref_id, position)
select
  m.scene_id,
  'content',
  m.id,
  coalesce(sp.position, 0) + m.rn - 1
from missing m
left join start_position sp on sp.scene_id = m.scene_id;
