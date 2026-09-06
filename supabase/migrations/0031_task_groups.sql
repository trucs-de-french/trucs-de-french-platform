-- task_groups: "блок" — кілька різних задач (multiple_choice, true_false
-- тощо) під одним спільним контекстом/медіа (текст/аудіо/відео/embed), за
-- зразком реальних DELF-тестів (один аудіозапис + кілька різних питань до
-- нього). Внутрішня назва свідомо НЕ "block"/"blocks" — це вже зайнято
-- поліморфним реєстром порядку сторінки сцени (scene_blocks,
-- 0009_scene_blocks.sql: video/script/link/task), геть іншим механізмом без
-- спільного контенту чи балів. "Блок" лишається лише адмінською назвою.
--
-- Батьківство дзеркалить те саме, що вже в tasks (scene_id/material_id/
-- delf_section+delf_test_number, взаємовиключно, без CHECK-обмеження на
-- рівні БД — так само, як і в tasks сьогодні, перевіряється формою) — блок
-- може належати сцені фільму, матеріалу, або DELF-тесту нарівні з окремими
-- задачами. order_index — позиція серед сусідів (задач і блоків) У ТОМУ Ж
-- батьківському контексті.
--
-- Задачі всередині блоку (tasks.task_group_id) успадковують контекст від
-- групи — їхні власні scene_id/material_id/delf_section/delf_test_number
-- лишаються null (не дублюються з групи), а order_index скоупиться в межах
-- самого task_group_id (власна внутрішня послідовність, незалежна від
-- сусідніх задач/блоків поза групою).
--
-- points_mode/flat_points — режим підсумку балів, НЕ чіпає власні points
-- полів кожної задачі всередині (ті лишаються в config кожної задачі як і
-- раніше) — просто перемикає, який розрахунок показується студенту:
-- 'sum' (за замовчуванням) — сума pointsEarned/pointsPossible усіх задач
-- блоку; 'flat' — flat_points, зароблено пропорційно середньому score% усіх
-- задач блоку. Перемикання режиму не видаляє й не ховає points на задачах.
create table public.task_groups (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  scene_id uuid references public.scenes (id) on delete cascade,
  material_id uuid references public.materials (id) on delete cascade,
  delf_section text,
  delf_test_number int,
  content_type text not null check (content_type in ('text', 'audio', 'video', 'embed')),
  content_text text,
  media_url text,
  media_provider text,
  points_mode text not null default 'sum' check (points_mode in ('sum', 'flat')),
  flat_points numeric,
  title text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.tasks add column task_group_id uuid
  references public.task_groups (id) on delete cascade;

alter table public.task_groups enable row level security;

-- Те саме правило, що tasks_select (0027_archive_products.sql) — вчитель
-- бачить усе, студент лише активний enrollment на неархівований
-- опублікований продукт.
create policy "task_groups_select" on public.task_groups for select
  using (
    public.is_teacher()
    or exists (
      select 1 from public.enrollments e
      join public.products p on p.id = e.product_id
      where e.product_id = task_groups.product_id
        and e.user_id = auth.uid()
        and e.status = 'active'
        and p.is_published = true
        and p.archived_at is null
    )
  );

create policy "task_groups_write" on public.task_groups for all
  using (public.is_teacher()) with check (public.is_teacher());
