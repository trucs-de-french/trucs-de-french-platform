-- ============================================================================
-- French Cinema Platform — початкова схема БД
-- Виконати в Supabase Dashboard -> SQL Editor (або через supabase db push)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- profiles: розширення auth.users (роль викладач/студент, ім'я)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'student' check (role in ('student', 'teacher')),
  full_name text,
  created_at timestamptz not null default now()
);

-- автоматично створює профіль при реєстрації нового користувача
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- helper-функція для RLS-політик (security definer, щоб уникнути рекурсії по profiles)
create function public.is_teacher()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'teacher'
  );
$$;

-- ----------------------------------------------------------------------------
-- products: курси (по фільмах/серіалах АБО DELF)
-- ----------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('film', 'delf')),
  title text not null,
  description text,
  cover_image_url text,
  price numeric(10, 2) not null default 0,
  currency text not null default 'UAH',
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- scenes: сцени фільму/серіалу (тільки для products.type = 'film')
-- dialogue: [{ "speaker": "...", "text": "...", "vocab": [{ "word": "...", "translation": "...", "note": "..." }] }]
-- ----------------------------------------------------------------------------
create table public.scenes (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  order_index integer not null default 0,
  title text not null,
  video_url text,
  video_provider text check (video_provider in ('youtube', 'gdrive')),
  dialogue jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- scene_links: посилання-іконки на Quizlet/Wordwall (кілька на сцену)
-- ----------------------------------------------------------------------------
create table public.scene_links (
  id uuid primary key default gen_random_uuid(),
  scene_id uuid not null references public.scenes (id) on delete cascade,
  platform text not null check (platform in ('quizlet', 'wordwall')),
  url text not null,
  label text,
  order_index integer not null default 0
);

-- ----------------------------------------------------------------------------
-- tasks: ЗАГАЛЬНА категорія вправ/завдань (ігри, DELF-питання, повторення,
-- робота над помилками тощо). scene_id nullable — DELF-завдання не прив'язані
-- до сцени фільму.
-- config: довільні налаштування залежно від type, напр. для 'open_answer' —
-- { "prompt": "...", "criteria": "..." } для перевірки Gemini.
-- ----------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  scene_id uuid references public.scenes (id) on delete cascade,
  type text not null check (
    type in ('game', 'open_answer', 'listening', 'error_correction', 'repetition')
  ),
  title text not null,
  order_index integer not null default 0,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- games: ПІДТИП tasks (1:1, task_id — і первинний, і зовнішній ключ).
-- Використовується, коли tasks.type = 'game'.
-- ----------------------------------------------------------------------------
create table public.games (
  task_id uuid primary key references public.tasks (id) on delete cascade,
  provider text not null check (provider in ('wordwall', 'quizlet', 'internal')),
  embed_url text,
  game_type text
);

-- ----------------------------------------------------------------------------
-- materials: додаткові матеріали (pdf/зображення/аудіо), файли — в Supabase Storage
-- ----------------------------------------------------------------------------
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  scene_id uuid references public.scenes (id) on delete cascade,
  file_url text not null,
  file_type text not null check (file_type in ('pdf', 'image', 'audio')),
  title text,
  uploaded_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- enrollments: куплені курси. payment_provider='manual' — зараз викладач
-- активує доступ вручну; 'wayforpay' — зарезервовано під майбутню інтеграцію.
-- ----------------------------------------------------------------------------
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'pending', 'revoked')),
  payment_provider text not null default 'manual' check (payment_provider in ('manual', 'wayforpay')),
  payment_id text,
  amount numeric(10, 2),
  currency text default 'UAH',
  purchased_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- ----------------------------------------------------------------------------
-- progress: прогрес студента по кожному task (незалежно від типу)
-- ----------------------------------------------------------------------------
create table public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  status text not null default 'not_started' check (
    status in ('not_started', 'in_progress', 'completed')
  ),
  score numeric,
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  unique (user_id, task_id)
);

-- ----------------------------------------------------------------------------
-- mistakes: робота над помилками. ai_feedback — відповідь Gemini для DELF-завдань.
-- ----------------------------------------------------------------------------
create table public.mistakes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  student_answer text,
  correct_answer text,
  ai_feedback jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.scenes enable row level security;
alter table public.scene_links enable row level security;
alter table public.tasks enable row level security;
alter table public.games enable row level security;
alter table public.materials enable row level security;
alter table public.enrollments enable row level security;
alter table public.progress enable row level security;
alter table public.mistakes enable row level security;

-- profiles
create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or public.is_teacher());
create policy "profiles_update_own" on public.profiles for update
  using (id = auth.uid());

-- products: опубліковані видно всім залогиненим, викладач бачить і редагує все
create policy "products_select" on public.products for select
  using (is_published = true or public.is_teacher());
create policy "products_write" on public.products for all
  using (public.is_teacher()) with check (public.is_teacher());

-- scenes / scene_links / tasks / games / materials:
-- викладач має повний доступ; студент бачить, тільки якщо має активний enrollment
create policy "scenes_select" on public.scenes for select
  using (
    public.is_teacher()
    or exists (
      select 1 from public.enrollments e
      where e.product_id = scenes.product_id
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
  );
create policy "scenes_write" on public.scenes for all
  using (public.is_teacher()) with check (public.is_teacher());

create policy "scene_links_select" on public.scene_links for select
  using (
    public.is_teacher()
    or exists (
      select 1 from public.scenes s
      join public.enrollments e on e.product_id = s.product_id
      where s.id = scene_links.scene_id
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
  );
create policy "scene_links_write" on public.scene_links for all
  using (public.is_teacher()) with check (public.is_teacher());

create policy "tasks_select" on public.tasks for select
  using (
    public.is_teacher()
    or exists (
      select 1 from public.enrollments e
      where e.product_id = tasks.product_id
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
  );
create policy "tasks_write" on public.tasks for all
  using (public.is_teacher()) with check (public.is_teacher());

create policy "games_select" on public.games for select
  using (
    public.is_teacher()
    or exists (
      select 1 from public.tasks t
      join public.enrollments e on e.product_id = t.product_id
      where t.id = games.task_id
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
  );
create policy "games_write" on public.games for all
  using (public.is_teacher()) with check (public.is_teacher());

create policy "materials_select" on public.materials for select
  using (
    public.is_teacher()
    or exists (
      select 1 from public.enrollments e
      where e.product_id = materials.product_id
        and e.user_id = auth.uid()
        and e.status = 'active'
    )
  );
create policy "materials_write" on public.materials for all
  using (public.is_teacher()) with check (public.is_teacher());

-- enrollments: студент бачить лише свої; створює/змінює лише викладач
-- (майбутній webhook від WayForPay працюватиме через service_role, минаючи RLS)
create policy "enrollments_select" on public.enrollments for select
  using (user_id = auth.uid() or public.is_teacher());
create policy "enrollments_write" on public.enrollments for all
  using (public.is_teacher()) with check (public.is_teacher());

-- progress: студент керує лише своїм прогресом, викладач бачить усе
create policy "progress_select" on public.progress for select
  using (user_id = auth.uid() or public.is_teacher());
create policy "progress_upsert" on public.progress for insert
  with check (user_id = auth.uid());
create policy "progress_update" on public.progress for update
  using (user_id = auth.uid());

-- mistakes: аналогічно progress
create policy "mistakes_select" on public.mistakes for select
  using (user_id = auth.uid() or public.is_teacher());
create policy "mistakes_insert" on public.mistakes for insert
  with check (user_id = auth.uid());
