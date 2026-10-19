@AGENTS.md

## Робота з базою даних
- НЕ використовувати SUPABASE service-role ключ і не створювати сесій/токенів від імені користувача для діагностики чи будь-яких інших цілей.
- Запити через anon-ключ під RLS повертають 0 рядків — це не означає, що даних немає.
- Коли потрібні дані з БД — підготуй SQL-запит (лише читання) і попроси користувача виконати його в Supabase SQL Editor і надіслати результат.
- Зміни схеми — лише через файли міграцій у supabase/migrations/, які користувач застосовує вручну; показувати SQL міграції ДО зміни коду, що від неї залежить.
- Нові таблиці в схемі public (з 30 жовтня Supabase не видає доступ до Data API автоматично): у ТІЙ САМІЙ міграції, що створює таблицю: `alter table public.<таблиця> enable row level security;`; RLS-політики під реальні потреби; `grant select, insert, update, delete on public.<таблиця> to authenticated;`; те саме `to service_role;`; `grant select ... to anon` лише якщо таблицю мають читати неавторизовані відвідувачі; для нових sequence — `grant usage`. SQL такої міграції показувати мені ДО зміни коду.

## Коміти
- Перед кожним комітом показати `git status` і перевірити нові невідстежувані файли (??): якщо закомічений код їх імпортує — вони мають потрапити в той самий коміт, інакше збірка на Netlify впаде (локально вона проходить, бо файл лежить на диску).
- Після коміту, перед push, перевірити, що збірка проходить на чистому стані репозиторію: `git stash -u` (сховати незакомічене), `npm run build`, потім `git stash pop`. Якщо збірка впала — повідомити, не пушити.

## Економія ресурсів
- Не запускай субагентів і фонових агентів без прямого прохання; розвідку роби сам. Не створюй порожніх субагентів, не використовуй ScheduleWakeup і sleep-цикли: якщо результат не готовий, зупинись і повідом.
- Читай лише файли, названі в задачі, та знайдені точковим grep; не перечитуй файл, який уже читав; не переглядай усю кодову базу.
- Не читай і не виводь файли .env* (лише перевіряй наявність змінних без значень).
- Команди з довгим виводом скорочуй (`| head -40` / `| tail -40`); `git diff` — спершу `--stat`; `git log` — з `-10`.
- `npx tsc --noEmit` після змін; `npm run build` лише перед комітом чи для великих змін. Не комітити і не пушити без прямого прохання.
- Звіт до 10 рядків: що змінено, що перевірити вручну, відкриті питання. Без таблиць, якщо не просили.
- "Розвідка" без змін лише коли прямо написано "спершу розвідка".
- Велику задачу запропонуй розбити на частини.

## Project

Trucs de French — French learning platform (films, series, songs, DELF prep). Student UI is Ukrainian; French exercise text stays as authored. Light and dark themes, both must always work. Stack: Next.js App Router + TypeScript, Tailwind v4, Supabase (Postgres + RLS + Storage), deployed on Netlify, media on Cloudflare R2.

## Commands

- `npm run dev` — dev server (never kill ports 3000/3001; they're long-running owner sessions).
- `npx tsc --noEmit` — typecheck, run after every change.
- `npm run lint` — ESLint (flat config, `eslint-config-next`).
- `npm run build` — Next build; run before a commit or for large changes only (see "Економія ресурсів" above).

## Working rules

- Never push — the owner pushes manually.
- One commit per stage, English message, trailers:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_015XzotHTJQuqAMxvHbnF4pE`
- Never stop the dev servers on ports 3000/3001.
- Playwright is not a project dependency. For throwaway visual verification: `npm install --no-save playwright` (or use the existing Chrome MCP browser tools first), write scripts/harness pages inside the repo (ESM needs this — a script run from outside the project root fails module resolution), then delete everything — confirm zero diff in `package.json`/lockfile and no stray route before committing.
- Supabase migrations are SQL files under `supabase/migrations/`, applied manually by the owner — never run migrations yourself. See "Робота з базою даних" above for RLS/grant requirements on new tables.

## Design tokens (`src/app/globals.css`, `--glass-*` custom properties)

Light theme: panel `#fdf8ea`, inset `#f6efd9`, gold border `#d9b765` (1.5px, radius 16px), cards white with border `#dcbd6e`, ink text `#1a1640`, Ukrainian/secondary text `#55546b`, indigo button gradient `#5a55e6 → #3b36c4`, gold "lamp" gradient `#f6dc8e → #e0aa3e`. Fonts: `--font-heading` (Nunito, headings/UI), `--font-body` (Lora, body text).

Dark theme equivalents: panel `rgba(10,16,48,.82)`, bar `rgba(10,16,48,.92)`, cards/items `rgba(255,255,255,.06)`, gold accent `#f6dc8e` (replaces ink/indigo as the accent color).

Rule: every new element needs a dark-mode equivalent — never ship a light-only style.

## Shared components (reuse, don't duplicate CSS)

- **Result system** — `task-result.tsx`: `TaskResult` (points pill + French status chip `À revoir`/`Presque`/`Parfait` + collapsible "correct answers" toggle), `TaskResultPairRows`/`AnswerRows`/`GapRows`/`OrderRows`/`ImageWordRows`/`CrosswordRows` (per-type correct-answer tile layouts), `RowScorePill` (compact "earned/possible" pill for grid/table rows). Use `TaskResult` for any gradable exercise's result row; pick the matching `TaskResult*Rows` helper instead of inventing a new tile layout.
- **Task header** — `task-panel-header.tsx`: `TaskInstructionLine` (FR/UK instruction row) and the panel header block (instruction + points/hint pills + divider). Reuse for any new exercise panel header.
- **Block navigation** — `block-navigation.tsx`: block tabs + "Блок N з M" pagination above the panel.
- **Word pool** — `.word-pool*` classes in `globals.css` (used by `image-match.tsx`, `fill-blank.tsx`, `drag-drop.tsx`): sticky draggable-word bank, horizontal scroll on mobile, wrapped grid with max-height scroll from `sm:` up.
- **Matching board** — `matching-board.tsx`: shared left/right column + connecting-dot/line layout for `matching.tsx`'s three render paths (≤10 pairs, blocked >10, practice). Owns dot coordinates (`getBoundingClientRect` + `ResizeObserver`) and SVG line drawing; callers only pass pairing state.
- **Answer/legend tiles** — `answer-card-style.ts` (`ANSWER_CARD_BASE`/`ANSWER_CARD_DEFAULT` for flip-cards' big gradient-edge cards; `ANSWER_CHIP_BASE`/`DEFAULT` for the smaller flat-chip style used by matching/listening/multiple_choice/vocab_quiz/sort_columns/chronological_order/image_match), `legend-tile-style.ts` (`LEGEND_TILE_BASE` — fixed-column legend tiles for word-search/crossword image clues), `tile-styles.ts` (shared reorder/drag_drop tile look).
- **Lamp badge** — the gold hint-lightbulb pill (`#f6dc8e → #e0aa3e` gradient) in the task header; see `task-panel-header.tsx` / `hint-bulb.tsx`.

## Exercise types

Labels and file mapping live in `src/lib/exercises/task-type-meta.ts` (`TASK_TYPE_LABELS`) — that file is the single source of truth; treat the table below as a snapshot of it.

| type | student-facing label (UK) | file | toggle? |
|---|---|---|---|
| fill_blank | Заповніть пропуск | fill-blank.tsx | yes |
| letter_gaps | Пропущені літери | letter-gaps.tsx | yes |
| letter_rearrangement | Переставити літери | letter-rearrangement.tsx | no |
| multiple_choice | Оберіть правильний варіант | multiple-choice.tsx | no |
| word_choice | Вибір правильної форми | word-choice.tsx | yes |
| word_search | Філворд | word-search.tsx | no |
| crossword | Кросворд | crossword.tsx | yes |
| true_false | Оберіть Vrai чи Faux | true-false.tsx | no |
| matching | З'єднайте елементи | matching.tsx | yes |
| listening | Аудіювання | listening.tsx | no |
| reorder | Розкладіть у правильному порядку | reorder.tsx | yes |
| drag_drop | Перетягніть слова | drag-drop.tsx | yes |
| sort_columns | Розкладіть по колонках | sort-columns.tsx | no |
| open_answer | Відкрита відповідь (автоперевірка) | open-answer-check.tsx | yes |
| table_fill | Заповніть таблицю | table-fill.tsx | yes |
| image_match | Перетягніть назви під картинки | image-match.tsx | yes |
| checkbox_grid | Таблиця вибору | checkbox-grid.tsx | no |
| chronological_order | Хронологічний порядок | chronological-order.tsx | yes |
| karaoke | Караоке | karaoke.tsx | no |

No toggle where the correct answer is already shown in place (selected/highlighted option, filled grid cell). Non-gradable content types (not routed through `exercise-card.tsx`): `vocab_quiz` (vocab-quiz.tsx), `flip_cards` (flip-cards.tsx), `phonetics` (phonetics.tsx), `essay_check` (essay-check.tsx, AI-graded), `callout` (callout.tsx), plus `embed`/`link`/`game`/`error_correction`/`ai_examiner`.

## UI rules

- Student-facing text: Ukrainian. French exercise content: as authored, untranslated.
- Responsive breakpoint: `768px` on viewport width (not container queries) — matches the `md:` Tailwind breakpoint used throughout.
- No percentages in student-facing UI (e.g. no "Результат: 72%") — use points pills (`N/M`) and the French status chip instead.
- French status labels (`À revoir`, `Presque`, `Parfait`) — no "!" and no checkmarks in the label text; Ukrainian meaning goes in `aria-label`/`title` (`Є помилки`, `Майже`, `Усе правильно`), defined in `src/lib/exercises/default-task-labels.ts`.

## Known quirks

- The repo has lived in iCloud Drive, which can stall `git` with duplicate `.git/index` files. Fix: move the stuck index aside, then `git read-tree HEAD` to rebuild it.
