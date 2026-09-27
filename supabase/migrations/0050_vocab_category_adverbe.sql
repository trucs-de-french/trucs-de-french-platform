-- Категорії вокабуляру (VocabItem.partOfSpeech, src/lib/vocab-categories.ts)
-- не мають CHECK/enum у БД — vocab живе всередині scenes.dialogue (jsonb),
-- partOfSpeech там вільний рядок. Ця міграція лише ПЕРЕЙМЕНОВУЄ вже
-- збережене значення "adverbe_locution" -> "adverbe" (стара категорія
-- "Adverbes / Locutions" ділиться на "Adverbes" і нову порожню "Locutions" —
-- слова, що фактично сталі вирази, вчителька вручну переставить у
-- "Locutions" після цієї міграції, дивлячись на список нижче/зі свого
-- SQL-запиту). Код (vocab-categories.ts: normalizePartOfSpeech) уже вміє
-- читати обидва ключі ДО цієї міграції, тож порядок "спершу код, потім
-- міграція" безпечний в обидва боки.
--
-- ЗАСТОСОВУВАТИ ВРУЧНУ в Supabase SQL Editor. Ніякого ALTER TABLE/CHECK тут
-- немає, тому ризику 23514 немає в принципі.

-- 1) Резервна копія — лише сцени, що реально містять старий ключ.
create table if not exists public.scenes_dialogue_backup_0050 as
select id, dialogue
from public.scenes
where dialogue::text like '%adverbe_locution%';

-- 2) Перейменування значення, з ЯВНИМ збереженням порядку реплік
-- (line.ordinality) і порядку слів у vocab (vocab_item.ordinality) на обох
-- рівнях jsonb_agg. Торкається лише рядків, що містять "adverbe_locution"
-- (WHERE у підзапиті rebuilt) — інші сцени навіть не потрапляють у join.
update public.scenes s
set dialogue = rebuilt.dialogue
from (
  select
    sc.id,
    jsonb_agg(
      case
        when line.value->'vocab' @> '[{"partOfSpeech": "adverbe_locution"}]'::jsonb
          then jsonb_set(
            line.value,
            '{vocab}',
            coalesce(
              (
                select jsonb_agg(
                  case
                    when vocab_item.value->>'partOfSpeech' = 'adverbe_locution'
                      then jsonb_set(vocab_item.value, '{partOfSpeech}', '"adverbe"'::jsonb)
                    else vocab_item.value
                  end
                  order by vocab_item.ordinality
                )
                from jsonb_array_elements(coalesce(line.value->'vocab', '[]'::jsonb))
                  with ordinality as vocab_item
              ),
              '[]'::jsonb
            )
          )
        else line.value
      end
      order by line.ordinality
    ) as dialogue
  from public.scenes sc,
    jsonb_array_elements(sc.dialogue) with ordinality as line
  where sc.dialogue::text like '%adverbe_locution%'
  group by sc.id
) as rebuilt
where s.id = rebuilt.id;

-- 3) Перевірка (лише читання) — виконати ПІСЛЯ update вище.

-- 3a) Має повернути 0.
select count(*) as remaining_adverbe_locution
from public.scenes s,
  jsonb_array_elements(s.dialogue) as line,
  jsonb_array_elements(coalesce(line->'vocab', '[]'::jsonb)) as vocab_item
where vocab_item->>'partOfSpeech' = 'adverbe_locution';

-- 3b) lines_before і lines_after мають збігатися для КОЖНОЇ сцени
-- (перейменувалось лише значення всередині vocab, кількість реплік і
-- порядок не мали змінитися).
select
  b.id as scene_id,
  jsonb_array_length(b.dialogue) as lines_before,
  jsonb_array_length(s.dialogue) as lines_after
from public.scenes_dialogue_backup_0050 b
join public.scenes s on s.id = b.id
order by b.id;
