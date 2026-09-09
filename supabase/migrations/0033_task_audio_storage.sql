-- ============================================================================
-- Supabase Storage bucket для аудіофайлів, завантажених вчителем напряму з
-- комп'ютера (замість вставки зовнішнього посилання на Google Drive) —
-- усуває корінь непередбачуваності стороннього сервісу, задокументованої
-- дослідженням цієї сесії (403 через кукі акаунта студента/вчителя,
-- нестабільна поведінка redirect-ланцюжка в браузерному медіа-пайплайні).
--
-- Публічний bucket (public = true) — файли віддаються за стабільним URL
-- без автентифікації для читання, той самий рівень довіри, що вже
-- прийнятий для gdrive/youtube посилань сьогодні (це не персональні дані).
-- RLS на storage.objects обмежує лише ЗАПИС до is_teacher() — читання
-- лишається відкритим (окрема permissive-політика, той самий принцип
-- дозволяючих політик, що вже в task_groups_select/task_groups_write,
-- 0031_task_groups.sql).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('task-audio', 'task-audio', true)
on conflict (id) do nothing;

create policy "task_audio_select" on storage.objects for select
  using (bucket_id = 'task-audio');

-- "for all" (не окремо insert/update/delete — CREATE POLICY дозволяє лише
-- один тип команди на політику, ALL охоплює всі за раз) — і select тут теж
-- технічно дозволений is_teacher(), але це не звужує доступ: permissive-
-- політики для одного типу команди комбінуються через OR, тож select
-- лишається відкритим завдяки task_audio_select вище незалежно від цієї.
create policy "task_audio_write" on storage.objects for all
  using (bucket_id = 'task-audio' and public.is_teacher())
  with check (bucket_id = 'task-audio' and public.is_teacher());
