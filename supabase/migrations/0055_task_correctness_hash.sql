-- ============================================================================
-- task_correctness_hash — заміна md5(tasks.config::text) (0054) на хеш лише
-- тих полів config, що впливають на ПРАВИЛЬНІСТЬ відповіді (елементи,
-- відповіді/прапорці correct, пари, порядок там, де порядок сам є
-- відповіддю). Мета: косметична правка (instructions/subInstructions,
-- points, hintsReducePoints/hintsEnabled, liveFeedback, display, картинки/
-- аудіо-прикраси, підписи колонок/рядків) більше НЕ скидає
-- mistake_corrections — скидається лише тоді, коли те, що насправді
-- перевіряється, справді змінилось.
--
-- Канонічність: jsonb сам нормалізує порядок КЛЮЧІВ об'єкта на рівні
-- зберігання (jsonb::text для рівних об'єктів завжди дає той самий текст,
-- незалежно від порядку, в якому їх побудовано) — jsonb_build_object нижче
-- підходить без додаткової сортування ключів. Порядок ЕЛЕМЕНТІВ масиву
-- jsonb ЗБЕРІГАЄ — тож там, де порядок елементів сам кодує відповідь
-- (letter_gaps/letter_rearrangement — позиційні answer.letters/words;
-- chronological_order.items; sequences[].items усередині reorder) масив
-- свідомо НЕ пересортовується. Там, де елементи адресуються за id і порядок
-- для перевірки байдужий (items/sentences/statements/pairs/questions/rows/
-- верхній рівень sequences у reorder) — агрегуємо з ORDER BY за ключем, щоб
-- перетягування елемента в адмінці (без зміни змісту) не скидало прогрес.
--
-- Для типів, де немає явного списку полів нижче (essay_check/word_search/
-- crossword/karaoke/flip_cards/callout/phonetics/vocab_quiz — жоден із них
-- практично не викликає ці RPC: error-review.ts їх або виключає, або вони
-- не мають автоматичної перевірки) і для старої "пласкої" форми конфігу
-- (легасі multiple_choice/reorder/drag_drop/open_answer без items/
-- sequences/sentences/questions-масиву — getXxx-нормалізатори в
-- sanitize.ts/grade.ts зводять її до нової форми на льоту, самого масиву
-- в config рядка нема) — fallback: хеш усього config, як і було в 0054.
-- Це безпечний (не хибно-негативний) фолбек: гірше, ніж потрібно, ловить
-- косметичні зміни для цих рідких/непідтримних випадків, але ніколи не
-- пропускає реальну зміну відповіді.
--
-- Відкат: drop function public.task_correctness_hash(text, jsonb);
--         (RPC get_mistake_correction_state/save_mistake_correction
--          повертаються до md5(t.config::text) — попередній CREATE OR
--          REPLACE з 0054 лишається в історії міграцій).
-- ============================================================================

create or replace function public.task_correctness_hash(p_task_type text, p_config jsonb)
returns text
language plpgsql
immutable
as $$
declare
  v_payload jsonb;
begin
  if p_config is null then
    return md5('null');
  end if;

  v_payload := case p_task_type
    when 'fill_blank' then
      jsonb_build_object('template', p_config->'template')

    when 'letter_gaps' then
      case when jsonb_typeof(p_config->'words') = 'array' then
        jsonb_build_object('words', (
          select coalesce(jsonb_agg(jsonb_build_object('word', w->>'word', 'hiddenIndices', w->'hiddenIndices')), '[]'::jsonb)
          from jsonb_array_elements(p_config->'words') w
        ))
      else p_config end

    when 'letter_rearrangement' then
      case when jsonb_typeof(p_config->'words') = 'array' then
        jsonb_build_object('words', (
          select coalesce(jsonb_agg(jsonb_build_object('word', w->>'word')), '[]'::jsonb)
          from jsonb_array_elements(p_config->'words') w
        ))
      else p_config end

    when 'open_answer' then
      case when jsonb_typeof(p_config->'questions') = 'array' then
        jsonb_build_object('questions', (
          select coalesce(jsonb_agg(jsonb_build_object('id', q->>'id', 'answers', q->'answers') order by q->>'id'), '[]'::jsonb)
          from jsonb_array_elements(p_config->'questions') q
        ))
      else p_config end

    when 'multiple_choice' then
      case when jsonb_typeof(p_config->'items') = 'array' then
        jsonb_build_object('items', (
          select coalesce(jsonb_agg(
            jsonb_build_object('id', item->>'id', 'options', (
              select coalesce(jsonb_agg(jsonb_build_object('id', o->>'id', 'correct', o->'correct') order by o->>'id'), '[]'::jsonb)
              from jsonb_array_elements(item->'options') o
            )) order by item->>'id'
          ), '[]'::jsonb)
          from jsonb_array_elements(p_config->'items') item
        ))
      else p_config end

    when 'word_choice' then
      case when jsonb_typeof(p_config->'sentences') = 'array' then
        jsonb_build_object('mode', p_config->'mode', 'sentences', (
          select coalesce(jsonb_agg(
            jsonb_build_object('id', s->>'id', 'options', (
              select coalesce(jsonb_agg(jsonb_build_object('id', o->>'id', 'correct', o->'correct') order by o->>'id'), '[]'::jsonb)
              from jsonb_array_elements(s->'options') o
            )) order by s->>'id'
          ), '[]'::jsonb)
          from jsonb_array_elements(p_config->'sentences') s
        ))
      else p_config end

    when 'true_false' then
      case when jsonb_typeof(p_config->'statements') = 'array' then
        jsonb_build_object('statements', (
          select coalesce(jsonb_agg(jsonb_build_object('id', s->>'id', 'answer', s->'answer') order by s->>'id'), '[]'::jsonb)
          from jsonb_array_elements(p_config->'statements') s
        ))
      else p_config end

    when 'matching' then
      case when jsonb_typeof(p_config->'pairs') = 'array' then
        jsonb_build_object('pairs', (
          select coalesce(jsonb_agg(jsonb_build_object('left', p->>'left', 'right', p->>'right') order by p->>'left', p->>'right'), '[]'::jsonb)
          from jsonb_array_elements(p_config->'pairs') p
        ))
      else p_config end

    when 'listening' then
      case when jsonb_typeof(p_config->'questions') = 'array' then
        jsonb_build_object('questions', (
          select coalesce(jsonb_agg(
            jsonb_build_object('id', q->>'id', 'options', (
              select coalesce(jsonb_agg(jsonb_build_object('id', o->>'id', 'correct', o->'correct') order by o->>'id'), '[]'::jsonb)
              from jsonb_array_elements(q->'options') o
            )) order by q->>'id'
          ), '[]'::jsonb)
          from jsonb_array_elements(p_config->'questions') q
        ))
      else p_config end

    -- reorder: ВЕРХНІЙ рівень sequences сортується за id (сама послідовність
    -- адресується за id, порядок послідовностей одна щодо одної байдужий),
    -- але items ВСЕРЕДИНІ кожної послідовності НЕ сортуються — там позиція
    -- в масиві і є правильним порядком (gradeReorder звіряє за індексом).
    when 'reorder' then
      case when jsonb_typeof(p_config->'sequences') = 'array' then
        jsonb_build_object('sequences', (
          select coalesce(jsonb_agg(jsonb_build_object('id', sq->>'id', 'items', sq->'items') order by sq->>'id'), '[]'::jsonb)
          from jsonb_array_elements(p_config->'sequences') sq
        ))
      else p_config end

    when 'drag_drop' then
      case when jsonb_typeof(p_config->'sentences') = 'array' then
        jsonb_build_object('sentences', (
          select coalesce(jsonb_agg(jsonb_build_object('id', s->>'id', 'template', s->>'template') order by s->>'id'), '[]'::jsonb)
          from jsonb_array_elements(p_config->'sentences') s
        ))
      else p_config end

    when 'sort_columns' then
      case when jsonb_typeof(p_config->'items') = 'array' and jsonb_typeof(p_config->'columns') = 'array' then
        jsonb_build_object(
          'columns', (select coalesce(jsonb_agg(c->>'id' order by c->>'id'), '[]'::jsonb) from jsonb_array_elements(p_config->'columns') c),
          'items', (select coalesce(jsonb_agg(jsonb_build_object('id', i->>'id', 'columnId', i->>'columnId') order by i->>'id'), '[]'::jsonb) from jsonb_array_elements(p_config->'items') i)
        )
      else p_config end

    when 'table_fill' then
      case when jsonb_typeof(p_config->'rows') = 'array' then
        jsonb_build_object('rows', (
          select coalesce(jsonb_agg(
            jsonb_build_object('id', r->>'id', 'left', r->>'left', 'right', r->>'right', 'leftHidden', r->'leftHidden', 'rightHidden', r->'rightHidden')
            order by r->>'id'
          ), '[]'::jsonb)
          from jsonb_array_elements(p_config->'rows') r
        ))
      else p_config end

    when 'checkbox_grid' then
      case when jsonb_typeof(p_config->'rows') = 'array' and jsonb_typeof(p_config->'columns') = 'array' then
        jsonb_build_object(
          'columns', (select coalesce(jsonb_agg(c->>'id' order by c->>'id'), '[]'::jsonb) from jsonb_array_elements(p_config->'columns') c),
          'rows', (select coalesce(jsonb_agg(jsonb_build_object('id', r->>'id', 'correctColumnIds', r->'correctColumnIds') order by r->>'id'), '[]'::jsonb) from jsonb_array_elements(p_config->'rows') r)
        )
      else p_config end

    when 'image_match' then
      case when jsonb_typeof(p_config->'items') = 'array' then
        jsonb_build_object('items', (
          select coalesce(jsonb_agg(jsonb_build_object('id', i->>'id', 'name', i->>'name') order by i->>'id'), '[]'::jsonb)
          from jsonb_array_elements(p_config->'items') i
        ))
      else p_config end

    -- chronological_order: ids НЕ сортуються — порядок масиву сам кодує
    -- correctPosition (gradeChronologicalOrder: index+1), студентська
    -- відповідь матчиться за id, тож потрібні ОБИДВА — id і позиція.
    when 'chronological_order' then
      case when jsonb_typeof(p_config->'items') = 'array' then
        jsonb_build_object('items', (
          select coalesce(jsonb_agg(jsonb_build_object('id', i->>'id')), '[]'::jsonb)
          from jsonb_array_elements(p_config->'items') i
        ))
      else p_config end

    else p_config
  end;

  return md5(v_payload::text);
end;
$$;

revoke all on function public.task_correctness_hash(text, jsonb) from public;
grant execute on function public.task_correctness_hash(text, jsonb) to authenticated, anon, service_role;

create or replace function public.get_mistake_correction_state(
  p_user_id uuid,
  p_task_id uuid
)
returns table (corrected_item_ids text[], failed_attempts jsonb)
language sql
stable
security invoker
as $$
  select coalesce(mc.corrected_item_ids, '{}'::text[]),
         coalesce(mc.failed_attempts, '{}'::jsonb)
  from (select public.task_correctness_hash(t.type, t.config) as h from public.tasks t where t.id = p_task_id) cur
  left join public.mistake_corrections mc
    on mc.user_id = p_user_id
   and mc.task_id = p_task_id
   and mc.config_hash = cur.h;
$$;

create or replace function public.save_mistake_correction(
  p_user_id uuid,
  p_task_id uuid,
  p_corrected_item_ids text[],
  p_failed_attempts jsonb
)
returns void
language plpgsql
security invoker
as $$
declare
  v_hash text;
begin
  select public.task_correctness_hash(t.type, t.config) into v_hash from public.tasks t where t.id = p_task_id;
  if v_hash is null then
    raise exception 'task % not found', p_task_id;
  end if;

  insert into public.mistake_corrections
    (user_id, task_id, config_hash, corrected_item_ids, failed_attempts, updated_at)
  values
    (p_user_id, p_task_id, v_hash,
     coalesce(p_corrected_item_ids, '{}'::text[]),
     coalesce(p_failed_attempts, '{}'::jsonb),
     now())
  on conflict (user_id, task_id) do update
    set config_hash = excluded.config_hash,
        corrected_item_ids = excluded.corrected_item_ids,
        failed_attempts = excluded.failed_attempts,
        updated_at = now();
end;
$$;

-- Перерахунок наявних рядків mistake_corrections за новою формулою — щоб
-- після деплою жоден студент не втратив прогрес лише через те, що formula
-- змінилась (а не тому, що завдання справді правили). Перераховуються ЛИШЕ
-- рядки, що були АКТУАЛЬНИМИ за старою формулою (mc.config_hash =
-- md5(t.config::text) — тобто config із часу запису не змінювався взагалі):
-- для них новий хеш просто замінює старий, без втрати стану. Застарілі
-- рядки (де md5(config::text) уже не збігався — завдання справді змінили
-- після запису виправлень) цим UPDATE не чіпаються: лишаються зі старим
-- хешем, який і за новою формулою не збігається з поточним (бо формула
-- змінилась лише в тому, ЯКІ поля беруться, а не в тому, що config
-- реально відрізняється) — тобто лишаються скинутими. Це НАМІРЕНА
-- поведінка: ця міграція виправляє лише саму формулу хешування наперед, а
-- не "воскрешає" виправлення, застарілі ще за старою логікою 0054.
update public.mistake_corrections mc
set config_hash = public.task_correctness_hash(t.type, t.config)
from public.tasks t
where t.id = mc.task_id
  and mc.config_hash = md5(t.config::text)
  and mc.config_hash is distinct from public.task_correctness_hash(t.type, t.config);

notify pgrst, 'reload schema';
