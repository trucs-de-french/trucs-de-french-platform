-- scene_content_blocks: довільна кількість ДОДАТКОВИХ блоків контенту
-- (текст/аудіо/відео/embed) на сцені — окремо від фіксованих Відео/Скрипт/
-- Практика/Завдання (scene_blocks, 0009). Той самий принцип, що вже задачі
-- на кшталт "Крок 1/2/3": КРОК 1 тут — без інтеграції в спільне
-- впорядкування scene_blocks.position (жодних змін у scene_blocks у цій
-- міграції) — нові блоки завжди рендеряться в кінці сторінки, за
-- created_at. Повна drag-інтеграція в scene_blocks — окремий наступний
-- захід (Крок 2), коли й буде сенс чіпати вже робочу таблицю/індекси.
--
-- Форма полів (content_type/content_text/media_url/media_provider) свідомо
-- та сама, що в task_groups (0031) — але це НЕ той самий домен: task_groups
-- завжди прив'язаний до набору задач і не рендериться студенту взагалі, якщо
-- немає жодної задачі-члена; ці блоки — самостійний контент без задач.
-- Тому окрема таблиця, а не розширення task_groups.
create table public.scene_content_blocks (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes (id) on delete cascade,
  content_type text not null check (content_type in ('text', 'audio', 'video', 'embed')),
  content_text text,
  media_url text,
  media_provider text,
  title text,
  created_at timestamptz not null default now()
);

alter table public.scene_content_blocks enable row level security;

-- Той самий принцип, що scene_blocks_select/scene_blocks_write (0009) — цей
-- домен навмисно узгоджений із сусідом scene_blocks, а не з суворішою
-- task_groups_select (яка додатково перевіряє is_published/archived_at) —
-- обидві таблиці описують структуру сторінки сцени, а не задачі.
create policy "scene_content_blocks_select" on public.scene_content_blocks for select
  using (
    public.is_teacher()
    or exists (
      select 1 from public.scenes s
      join public.enrollments e on e.product_id = s.product_id
      where s.id = scene_content_blocks.scene_id
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
  );
create policy "scene_content_blocks_write" on public.scene_content_blocks for all
  using (public.is_teacher()) with check (public.is_teacher());
