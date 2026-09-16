-- 5-й core-блок сцени "Вокабуляр" — агрегована, редагована таблиця слів
-- словника з усіх реплік dialogue фіксованого блоку "Скрипт" (scenes.dialogue,
-- НЕ додаткові script-блоки scene_content_blocks). Сам вокабуляр не має
-- власного стовпця/таблиці — живе в dialogue, який і так копіюється разом
-- зі сценою (duplicate_scene не потребує змін, ref_id лишається null, як для
-- script/link/task).

alter table public.scene_blocks drop constraint if exists scene_blocks_block_type_check;
alter table public.scene_blocks add constraint scene_blocks_block_type_check
  check (block_type in ('video', 'script', 'link', 'task', 'vocab', 'content'));

-- scene_blocks_scene_type_idx (0037: where block_type <> 'content') уже
-- покриває 'vocab' автоматично — інваріант "рівно один на сцену" й так
-- застосовується до будь-якого не-'content' типу.

-- Бекфіл: для кожної сцени без рядка 'vocab' додаємо його в КІНЕЦЬ поточного
-- порядку (max(position)+1) — той самий прийом, що вже в 0037 для 'content'.
with start_position as (
  select scene_id, coalesce(max(position) + 1, 0) as position
  from public.scene_blocks
  group by scene_id
)
insert into public.scene_blocks (scene_id, block_type, position)
select s.id, 'vocab', coalesce(sp.position, 0)
from public.scenes s
left join start_position sp on sp.scene_id = s.id
where not exists (
  select 1 from public.scene_blocks b where b.scene_id = s.id and b.block_type = 'vocab'
);
