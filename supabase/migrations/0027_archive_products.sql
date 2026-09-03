-- ----------------------------------------------------------------------------
-- Архівування курсів: soft-delete замість DELETE-каскаду. archived_at = null —
-- курс активний; проставлена дата — курс приховано зі студентських списків і
-- прямого доступу, дані (сцени/тести/матеріали/завдання) фізично лишаються.
-- ----------------------------------------------------------------------------
alter table public.products add column archived_at timestamptz;

-- products: опублікований і не архівований видно всім залогиненим, викладач
-- бачить і редагує все незалежно від статусу.
drop policy if exists "products_select" on public.products;
create policy "products_select" on public.products for select
  using ((is_published = true and archived_at is null) or public.is_teacher());

-- scenes / scene_links / tasks / games / materials: до цієї міграції
-- enrollment-перевірка не зважала на products.is_published/archived_at
-- взагалі — студент із прямим посиланням на сцену/тест/матеріал бачив вміст
-- навіть неопублікованого чи (щойно доданого) архівованого курсу, обходячи
-- захист на рівні products_select. Тепер підзапит явно перевіряє обидва
-- поля продукту-власника.
drop policy if exists "scenes_select" on public.scenes;
create policy "scenes_select" on public.scenes for select
  using (
    public.is_teacher()
    or exists (
      select 1 from public.enrollments e
      join public.products p on p.id = e.product_id
      where e.product_id = scenes.product_id
        and e.user_id = auth.uid()
        and e.status = 'active'
        and p.is_published = true
        and p.archived_at is null
    )
  );

drop policy if exists "scene_links_select" on public.scene_links;
create policy "scene_links_select" on public.scene_links for select
  using (
    public.is_teacher()
    or exists (
      select 1 from public.scenes s
      join public.enrollments e on e.product_id = s.product_id
      join public.products p on p.id = s.product_id
      where s.id = scene_links.scene_id
        and e.user_id = auth.uid()
        and e.status = 'active'
        and p.is_published = true
        and p.archived_at is null
    )
  );

drop policy if exists "tasks_select" on public.tasks;
create policy "tasks_select" on public.tasks for select
  using (
    public.is_teacher()
    or exists (
      select 1 from public.enrollments e
      join public.products p on p.id = e.product_id
      where e.product_id = tasks.product_id
        and e.user_id = auth.uid()
        and e.status = 'active'
        and p.is_published = true
        and p.archived_at is null
    )
  );

drop policy if exists "games_select" on public.games;
create policy "games_select" on public.games for select
  using (
    public.is_teacher()
    or exists (
      select 1 from public.tasks t
      join public.enrollments e on e.product_id = t.product_id
      join public.products p on p.id = t.product_id
      where t.id = games.task_id
        and e.user_id = auth.uid()
        and e.status = 'active'
        and p.is_published = true
        and p.archived_at is null
    )
  );

drop policy if exists "materials_select" on public.materials;
create policy "materials_select" on public.materials for select
  using (
    public.is_teacher()
    or exists (
      select 1 from public.enrollments e
      join public.products p on p.id = e.product_id
      where e.product_id = materials.product_id
        and e.user_id = auth.uid()
        and e.status = 'active'
        and p.is_published = true
        and p.archived_at is null
    )
  );
