-- ============================================================================
-- profiles.ui_lang — персональна мова інтерфейсу кабінету студента (на
-- відміну від products.ui_lang, 0060/0061, яка задає мову самих завдань
-- продукту і не чіпається тут). Додатково, без зміни існуючих рядків.
--
-- RLS: існуюча "profiles_update_own" (0062_profiles_role_update_guard.sql)
-- вже дозволяє власнику рядка оновлювати БУДЬ-ЯКІ колонки, крім role —
-- with check порівнює лише new.role = current_user_role(), інші колонки
-- (full_name, тепер ui_lang) ним не обмежені. Тож нова колонка одразу
-- оновлювана власником без додаткових правок policy чи guard-функції.
-- ============================================================================

alter table public.profiles
  add column if not exists ui_lang text not null default 'uk'
  check (ui_lang in ('uk', 'fr', 'en'));

notify pgrst, 'reload schema';
