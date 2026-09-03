-- ============================================================================
-- Матеріали: від простого списку PDF-посилань до статей+вправ.
--
-- file_url/file_type були NOT NULL з початкової схеми — суперечило вимозі
-- "матеріал може бути лише статтею, без PDF". Послаблюємо до nullable.
-- content — TipTap HTML статті, та сама санітизація (sanitizeCalloutHtml),
-- що вже для callout.
--
-- tasks.material_id — вправи, вбудовані САМЕ в цей матеріал (не посилання на
-- існуючі задачі курсу). product_id лишається обов'язковим і копіюється з
-- material.product_id, як і зараз копіюється зі scene для scene-задач.
-- ============================================================================

alter table public.materials alter column file_url drop not null;
alter table public.materials alter column file_type drop not null;
alter table public.materials add column content text;

alter table public.tasks add column material_id uuid
  references public.materials (id) on delete cascade;
