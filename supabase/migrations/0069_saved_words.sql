-- ============================================================================
-- "Мій словник" (/cabinet/dictionary) — слова, які студент зберіг собі під
-- час навчання (зі скрипту сцени зараз; з mini-reader історій і вручну —
-- пізніше, тому source_type уже має 'story'/'manual').
--
-- СНІМОК, не посилання: word/translation/part_of_speech/note/image_url/
-- context_* копіюються в момент збереження. source_id/product_id/vocab_id
-- лишаються лише для трасування (побудувати лінк назад на сцену) — якщо
-- вчителька потім відредагує чи видалить цей vocab-запис у
-- scenes.dialogue, збережене студентом слово не повинно зникнути чи
-- змінитись. Саме тому на source_id/product_id НЕМАЄ foreign key: сцена чи
-- курс можуть бути видалені, рядок словника студента лишається.
--
-- word_key — нормалізований дублікат word (normalizeWordForMatch у
-- src/lib/vocab-match.ts: trim+lowercase+уніфікація апострофа), рахується
-- в коді (saveWord), не в SQL, щоб лишатись ОДНИМ джерелом правди з
-- наявною логікою зіставлення слів у скрипті/відео.
--
-- Відкат:
--   drop table public.saved_words;
-- ============================================================================

create table public.saved_words (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  source_type text not null default 'scene' check (source_type in ('scene', 'story', 'manual')),
  source_id uuid,
  product_id uuid,
  source_title text,
  vocab_id text,
  word text not null check (char_length(word) between 1 and 80),
  word_key text not null,
  translation text check (translation is null or char_length(translation) <= 200),
  translation_source text not null default 'none' check (translation_source in ('teacher', 'own', 'ai', 'none')),
  part_of_speech text,
  note text check (note is null or char_length(note) <= 400),
  image_url text,
  context_fr text check (context_fr is null or char_length(context_fr) <= 600),
  context_uk text check (context_uk is null or char_length(context_uk) <= 600)
);

create unique index saved_words_user_source_word_key
  on public.saved_words (user_id, source_type, coalesce(source_id::text, ''), word_key);
create index saved_words_user_created_idx
  on public.saved_words (user_id, created_at desc);

comment on table public.saved_words is
  'Снімок слова на момент збереження студентом (/cabinet/dictionary) — редагування чи видалення вчителькою відповідного vocab-запису в scenes.dialogue не змінює й не видаляє вже збережений рядок.';

alter table public.saved_words enable row level security;

create policy "saved_words_select_own" on public.saved_words for select
  using (user_id = auth.uid() or public.is_teacher());

create policy "saved_words_insert_own" on public.saved_words for insert
  with check (user_id = auth.uid());

create policy "saved_words_update_own" on public.saved_words for update
  using (user_id = auth.uid());

create policy "saved_words_delete_own" on public.saved_words for delete
  using (user_id = auth.uid());

grant select, insert, update, delete on public.saved_words to authenticated;
grant select, insert, update, delete on public.saved_words to service_role;

notify pgrst, 'reload schema';
