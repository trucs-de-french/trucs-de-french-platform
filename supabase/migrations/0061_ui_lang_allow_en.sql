alter table public.products drop constraint products_ui_lang_check;
alter table public.products add constraint products_ui_lang_check check (ui_lang in ('uk', 'fr', 'en'));
