-- Дозволяє посилання "Практики" на самостійно завантажені HTML-ігри
-- (task-html-games R2 bucket) — власний URL, не Quizlet/Wordwall.
alter table public.scene_links drop constraint if exists scene_links_platform_check;
alter table public.scene_links add constraint scene_links_platform_check
  check (platform in ('quizlet', 'wordwall', 'custom'));
