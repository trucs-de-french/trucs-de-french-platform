alter table public.profiles
  add column if not exists learning_goals text[] not null default '{}',
  add column if not exists french_level text,
  add column if not exists french_level_source text,
  add column if not exists french_level_set_at timestamptz;
alter table public.profiles
  add constraint profiles_french_level_check check (french_level is null or french_level in ('A0','A1','A2','B1','B2','C1C2')),
  add constraint profiles_french_level_source_check check (french_level_source is null or french_level_source in ('self','test')),
  add constraint profiles_learning_goals_check check (learning_goals <@ array['self','travel','work','move','exam','kids']::text[]);
