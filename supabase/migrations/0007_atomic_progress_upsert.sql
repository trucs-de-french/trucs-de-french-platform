-- Атомарний upsert прогресу — усуває race condition при паралельних/швидких
-- повторних сабмітах (раніше attempts рахувався в коді: SELECT поточного
-- значення -> UPSERT з +1, обчисленим у застосунку; два одночасні запити
-- могли прочитати те саме значення й загубити один інкремент).
--
-- INSERT ... ON CONFLICT DO UPDATE в одному SQL-виразі атомарний на рівні
-- Postgres (рядкове блокування під час upsert), тому інкремент більше
-- неможливо загубити незалежно від паралелізму викликів.
--
-- security invoker (за замовчуванням) — функція виконується з правами того,
-- хто її викликає, тож RLS-політики public.progress (user_id = auth.uid())
-- застосовуються так само, як і раніше при прямому upsert.
create or replace function public.record_task_attempt(
  p_user_id uuid,
  p_task_id uuid,
  p_score numeric
)
returns void
language sql
security invoker
as $$
  insert into public.progress (user_id, task_id, status, score, attempts, last_attempt_at)
  values (p_user_id, p_task_id, 'completed', p_score, 1, now())
  on conflict (user_id, task_id)
  do update set
    status = 'completed',
    score = excluded.score,
    attempts = public.progress.attempts + 1,
    last_attempt_at = now();
$$;
