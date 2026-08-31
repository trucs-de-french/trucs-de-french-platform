-- 0010 видалила стовпець ref_id, а разом з ним Postgres автоматично й
-- каскадно видалив scene_blocks_singleton_type_idx (партціальний unique
-- index, чий WHERE ref_id is null посилався саме на цей стовпець — за
-- документованою поведінкою ALTER TABLE ... DROP COLUMN: "Indexes and table
-- constraints involving the column will be automatically dropped as well").
-- У новій моделі (без ref_id) той самий інваріант — рівно один рядок на
-- (scene_id, block_type) — вже не потребує предиката, звичайний unique.
create unique index if not exists scene_blocks_scene_type_idx
  on public.scene_blocks (scene_id, block_type);
