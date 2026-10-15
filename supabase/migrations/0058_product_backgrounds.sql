-- Декоративний фон студентських сторінок сцени — ОДИН на курс (products),
-- застосовується до УСІХ сцен цього курсу (не до scenes, бо вибір свідомо
-- курсовий, не посценний). desktop — landscape-шар position:fixed позаду
-- центральної колонки контенту; mobile — банер нагорі сторінки в portrait,
-- що прокручується з вмістом і переходить у fill_color; fill_color — суцільна
-- заливка (portrait без банера, чи просто як акцент під desktop-картинкою).
-- Усі три nullable — курс без жодного з них виглядає точно як сьогодні.
alter table public.products add column if not exists background_desktop_url text;
alter table public.products add column if not exists background_mobile_url text;
alter table public.products add column if not exists background_fill_color text;

-- RLS/гранти не змінюються: products_select (0001_init.sql) уже дозволяє
-- студенту читати РЯДОК products (is_published=true), без колонкових
-- обмежень — нові nullable-колонки автоматично доступні так само, як
-- cover_image_url. products існує з 0001, до правила "з 30 жовтня" про
-- grant на нові таблиці public-схеми — воно не стосується нових КОЛОНОК
-- існуючої таблиці.
--
-- Функції дублювання products у репозиторії НЕ знайдено (на відміну від
-- duplicate_scene) — курси не копіюються ні через SQL-функцію, ні через
-- адмін-дію, тож нічого додатково розширювати не потрібно.
