-- Візуальний статус "опубліковано/чернетка" на рівні ОКРЕМОГО DELF-тесту —
-- для адмінської сітки тестів (кольорові плитки). Свідомо НЕ впливає на
-- реальний доступ студентів — це й далі керується лише products.is_published,
-- як і раніше; ця таблиця лише пам'ятає, що вчитель сам позначив як
-- "готове". Тому й немає select-політики для студентів (лише is_teacher()).
--
-- Немає жодного тригера, що створює рядок автоматично при появі задачі під
-- новим delf_test_number — рядок з'являється лише коли вчитель явно тисне
-- "Опублікувати"/"Зняти з публікації" (toggleTestPublish, upsert). Відсутній
-- рядок трактується кодом як чернетка (is_published = false за замовчуванням
-- по суті), окрім тестів, що вже існували ДО цієї міграції — вони одразу
-- отримують is_published = true нижче (бекфіл), бо вони й так уже живі для
-- студентів через products.is_published — без цього кроку всі наявні тести
-- миттю показались би "чернеткою" одразу після розгортання, хоча реальна
-- видимість для студентів ніяк не змінилась.
create table public.delf_tests (
  product_id uuid not null references public.products (id) on delete cascade,
  test_number int not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (product_id, test_number)
);

alter table public.delf_tests enable row level security;

create policy "delf_tests_select" on public.delf_tests for select
  using (public.is_teacher());

create policy "delf_tests_write" on public.delf_tests for all
  using (public.is_teacher()) with check (public.is_teacher());

insert into public.delf_tests (product_id, test_number, is_published)
select distinct product_id, delf_test_number, true
from (
  select product_id, delf_test_number from public.tasks
  where delf_test_number is not null
  union
  select product_id, delf_test_number from public.task_groups
  where delf_test_number is not null
) existing_tests
on conflict (product_id, test_number) do nothing;
