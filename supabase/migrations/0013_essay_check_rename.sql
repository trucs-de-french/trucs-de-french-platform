-- Перейменовує існуючі "open_answer" (AI-перевірка есе через Gemini,
-- config.prompt/config.criteria) на вже зарезервований 'essay_check'
-- (див. 0003_reserve_delf_ai_task_types.sql), щоб звільнити назву
-- 'open_answer' під новий тип — звичайна відкрита відповідь з автоматичною
-- текстовою перевіркою (без AI, за списком прийнятних варіантів, як у
-- fill_blank). Обидва значення вже дозволені в tasks_type_check — зміна
-- constraint не потрібна, лише дані.
update public.tasks set type = 'essay_check' where type = 'open_answer';
