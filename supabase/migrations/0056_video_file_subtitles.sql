-- Джерело відео "file" (пряме посилання на mp4 — завантажений у R2 файл чи
-- власний URL) для відео-блоків: scene_content_blocks.media_provider і
-- task_groups.media_provider лишаються plain text БЕЗ CHECK-обмеження
-- (0036/0031) — новий варіант "file" не потребує зміни constraint, лише
-- нове необов'язкове поле: субтитри FR/UA (WebVTT) для власного VideoPlayer.
-- jsonb-масив [{ lang: "fr"|"uk", url }] — null/відсутнє поле = "без
-- субтитрів", старі рядки (youtube/gdrive) лишаються робочими без змін.
alter table public.scene_content_blocks add column subtitles jsonb;
alter table public.task_groups add column subtitles jsonb;
