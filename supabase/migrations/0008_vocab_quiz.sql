-- Замінює тип 'repetition' (картки слово->переклад) на 'vocab_quiz'
-- (вікторина з вибором перекладу серед 4 варіантів, дистрактори — з тієї ж
-- обраної лексики). Поведінка повністю інша, тому перейменовуємо тип, а не
-- розширюємо старий.
--
-- 'vocab_quiz' config: { sceneIds: string[] } — id сцен курсу, з чиїх
-- scenes.dialogue[].vocab тягнеться лексика (об'єднаний пул слів і
-- дистракторів). На відміну від старого 'repetition', джерело лексики більше
-- не обов'язково та сама сцена, де лежить саме завдання.

alter table public.tasks drop constraint if exists tasks_type_check;

-- Існуючі repetition-завдання мігруємо в vocab_quiz з джерелом = та сама
-- сцена, де вони й були (task.scene_id) — щоб нічого не зламалось для вже
-- наповненого контенту. Рядки без scene_id (не мали б існувати за логікою
-- застосунку, але constraint цього не забороняв) отримують порожній sceneIds
-- замість падіння нижчого ALTER TABLE ADD CONSTRAINT.
update public.tasks
set
  type = 'vocab_quiz',
  config = config || jsonb_build_object(
    'sceneIds',
    case when scene_id is not null then jsonb_build_array(scene_id) else '[]'::jsonb end
  )
where type = 'repetition';

alter table public.tasks add constraint tasks_type_check
  check (
    type in (
      'game', 'open_answer', 'listening', 'error_correction', 'vocab_quiz',
      'embed', 'link',
      'essay_check', 'ai_examiner',
      'fill_blank', 'multiple_choice', 'true_false', 'matching',
      'reorder', 'drag_drop',
      'sort_columns', 'flip_cards'
    )
  );
