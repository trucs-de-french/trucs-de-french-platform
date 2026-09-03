-- ============================================================================
-- materials.category — розділення вкладки "Матеріали" на дві підсекції:
-- 'delf_guide' (як здати кожну компетенцію/як проходить іспит) і
-- 'general_tip' (типові помилки — теми, на які посилається
-- essay_check.materialRecommendation). Nullable — існуючі матеріали без
-- категорії показуються в окремому блоці "Інше", не мовчазним дефолтом в
-- одну з двох секцій.
-- ============================================================================

alter table public.materials add column category text
  constraint materials_category_check check (category in ('delf_guide', 'general_tip'));
