-- scene_blocks: єдиний спільний порядок усіх блоків сцени (відео, скрипт,
-- посилання Quizlet/Wordwall, вправи) — незалежно від того, в якій вони
-- таблиці. Це РЕЄСТР порядку, не сам контент: video_url/dialogue й далі
-- живуть у scenes, посилання — в scene_links, вправи — в tasks. ref_id —
-- поліморфне посилання (null для 'video'/'script', бо вони єдині на сцену;
-- id рядка в scene_links або tasks для 'link'/'task').
--
-- Існуючий tasks.order_index (і стрілки ↑/↓ у адмінці) НЕ прибирається —
-- лишається окремим, швидшим способом міняти вправи місцями між собою;
-- scene_blocks.position — ширший механізм для довільного порядку між УСІМА
-- типами блоків через drag-and-drop. Обидва мають лишатись синхронізованими
-- (це буде оновлено в moveTask на наступному кроці, не в цій міграції).

create table public.scene_blocks (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes (id) on delete cascade,
  block_type text not null check (block_type in ('video', 'script', 'link', 'task')),
  ref_id uuid,
  position integer not null default 0
);

-- Захист від дублікатів: 'video'/'script' — не більше одного блоку такого
-- типу на сцену (ref_id null, тому звичайний unique(scene_id, block_type,
-- ref_id) тут не спрацював би — null завжди вважається унікальним);
-- 'link'/'task' — не більше одного блоку на конкретний ref_id.
create unique index scene_blocks_singleton_type_idx
  on public.scene_blocks (scene_id, block_type)
  where ref_id is null;
create unique index scene_blocks_ref_idx
  on public.scene_blocks (scene_id, block_type, ref_id)
  where ref_id is not null;

alter table public.scene_blocks enable row level security;

create policy "scene_blocks_select" on public.scene_blocks for select
  using (
    public.is_teacher()
    or exists (
      select 1 from public.scenes s
      join public.enrollments e on e.product_id = s.product_id
      where s.id = scene_blocks.scene_id
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
  );
create policy "scene_blocks_write" on public.scene_blocks for all
  using (public.is_teacher()) with check (public.is_teacher());

-- Бекфіл: для кожної існуючої сцени відтворюємо ТОЧНО той порядок, який
-- зараз і так видно на сторінці (жорстко закодований у JSX) — відео (якщо
-- є) -> скрипт -> посилання за їхнім order_index -> вправи за їхнім
-- order_index. Нічого в старих таблицях не змінюється й не видаляється.
with ranked as (
  select
    id as scene_id,
    'video'::text as block_type,
    null::uuid as ref_id,
    0 as group_order,
    0 as sub_order
  from public.scenes
  where video_url is not null

  union all

  select id, 'script', null, 1, 0
  from public.scenes

  union all

  select scene_id, 'link', id, 2, order_index
  from public.scene_links

  union all

  select scene_id, 'task', id, 3, order_index
  from public.tasks
  where scene_id is not null
)
insert into public.scene_blocks (scene_id, block_type, ref_id, position)
select
  scene_id,
  block_type,
  ref_id,
  row_number() over (partition by scene_id order by group_order, sub_order) - 1 as position
from ranked;
