-- ============================================================================
-- Налаштування кабінету студента (/cabinet/settings): фото/маскот профілю,
-- сповіщення, бакет Storage під аватари.
--
-- profiles: add column if not exists + inline check, той самий підхід, що
-- ui_lang (0064) / exam_type/exam_date/weekly_goal_scenes (0065) — RLS
-- "profiles_update_own" (0062) вже дозволяє власнику рядка оновлювати будь-
-- яку колонку, крім role, тож нічого окремо правити в RLS таблиці profiles
-- не треба.
--
-- CHECK avatar_url/avatar_mascot: максимум одне з двох одночасно (фото й
-- маскот — взаємовиключні, UI сам чистить інше поле при виборі, це лише
-- захист на рівні БД від прямого запису в обхід UI).
--
-- Storage bucket "avatars": публічне читання (аватари — не персональні
-- дані в сенсі приватності, та й URL і так піде в публічний <img> у
-- сайдбарі), запис лише у власну підпапку {user_id}/ — той самий принцип
-- storage.foldername(name), що й "власна папка користувача" в типових
-- Supabase-рецептах. file_size_limit/allowed_mime_types — на рівні самого
-- бакета (друга лінія захисту понад клієнтську валідацію 2 МБ/jpeg-png-webp
-- у avatar-upload.ts).
--
-- Відкат:
--   drop policy "avatars_select" on storage.objects;
--   drop policy "avatars_insert_own" on storage.objects;
--   drop policy "avatars_update_own" on storage.objects;
--   drop policy "avatars_delete_own" on storage.objects;
--   delete from storage.buckets where id = 'avatars';
--   alter table public.profiles drop column if exists avatar_url;
--   alter table public.profiles drop column if exists avatar_mascot;
--   alter table public.profiles drop column if exists notification_prefs;
-- ============================================================================

alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles
  add column if not exists avatar_mascot text;

alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{"review":true,"weekly_goal":true,"news":false}'::jsonb;

alter table public.profiles
  drop constraint if exists profiles_avatar_url_or_mascot_check;

alter table public.profiles
  add constraint profiles_avatar_url_or_mascot_check
  check (avatar_url is null or avatar_mascot is null);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars_select" on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars_insert_own" on storage.objects for insert
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_update_own" on storage.objects for update
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars_delete_own" on storage.objects for delete
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
