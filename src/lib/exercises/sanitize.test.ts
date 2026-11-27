// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що error-review.test.ts.
// Запуск вручну: npx tsx src/lib/exercises/sanitize.test.ts
import { filterWordBank, sanitizeChronologicalOrder, sanitizeReorder } from "./sanitize";
import type { ReorderConfig } from "./types";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

// --- filterWordBank (fill_blank wordBank / drag_drop bank — задача "pool
// shows only what's needed": remove one bank occurrence per excluded
// blank/sentence, keep genuine distractors and still-needed words) -----

{
  // Duplicates: bank has two "chien", only one blank needs it excluded —
  // exactly one copy removed, one remains.
  const out = filterWordBank(["chien", "chien", "chat"], [["chien"]]);
  assert(
    out.length === 2 && out.filter((w) => w === "chien").length === 1 && out.includes("chat"),
    "duplicates: only as many copies removed as excluded entries, the rest stays"
  );
}

{
  // Case differences: excluded variant "Chien" (as parsed from a
  // capitalised marker) must still match a lowercase bank entry.
  const out = filterWordBank(["chien", "chat"], [["Chien"]]);
  assert(!out.includes("chien") && out.includes("chat"), "case-insensitive match removes the right word");
}

{
  // Trimmed: stray whitespace in either side must not block the match.
  const out = filterWordBank([" chien ", "chat"], [["chien"]]);
  assert(out.length === 1 && out[0] === "chat", "trimmed match removes a word with surrounding whitespace");
}

{
  // Accepted variants: a blank accepts "chien" OR "chiot" — the bank only
  // has "chiot" (the second variant) — it must still be removed by
  // matching ANY of the blank's variants, not just the first.
  const out = filterWordBank(["chiot", "chat"], [["chien", "chiot"]]);
  assert(out.length === 1 && out[0] === "chat", "matches any accepted variant of the excluded blank, not only the first");
}

{
  // A solved/excluded word that also happens to be a genuine distractor:
  // bank has two "chien" (one is the real answer being excluded, one is
  // an unrelated distractor the teacher added) — only one is removed.
  const out = filterWordBank(["chien", "chien", "souris"], [["chien"]]);
  assert(
    out.filter((w) => w === "chien").length === 1,
    "a word that is both a solved answer and a coincidental distractor loses only one copy"
  );
}

{
  // Still-needed word untouched: two blanks need "chien" (one excluded,
  // one still part of the active practice) — removing the excluded one
  // must never remove the copy the still-needed blank relies on.
  const out = filterWordBank(["chien", "chien"], [["chien"]]);
  assert(out.length === 1 && out[0] === "chien", "the still-needed copy of a duplicated word survives");
}

{
  // Empty excluded list (confirmedSolvedBlankIds' fallback case, or a
  // drag_drop task where nothing is excluded) — bank returned unchanged,
  // same array values and order.
  const bank = ["chien", "chat", "souris"];
  const out = filterWordBank(bank, []);
  assert(out.join(",") === bank.join(","), "empty excluded list leaves the bank untouched (fallback case)");
}

{
  // No match found for an excluded entry (e.g. the teacher never put
  // that word in the bank at all) — nothing crashes, nothing else is
  // removed.
  const out = filterWordBank(["chat"], [["chien"]]);
  assert(out.length === 1 && out[0] === "chat", "an excluded variant with no bank match removes nothing");
}

{
  const out = filterWordBank([], [["chien"]]);
  assert(out.length === 0, "an empty bank stays empty");
}

// --- sanitizeChronologicalOrder (задача "chronological_order picture task
// shows raw image URL as text after switching mistakes chips" — сам баг був
// у error-review-block.tsx, не в санітайзері, але регресія-перевірка, що
// санітайзер і далі не плутає image/text/mixed, лишається доречною) --------

{
  // mode:"image" — content лишається URL-ом, text (якщо раптом заданий)
  // теж копіюється незмінно (саме поле не читається компонентом у цьому
  // режимі, але санітайзер не має його відкидати/перезаписувати).
  const out = sanitizeChronologicalOrder({
    mode: "image",
    items: [{ id: "a", content: "https://images.trucsdefrench.com/pic.jpeg", points: 2 }],
  });
  const item = out.items[0];
  assert(out.mode === "image", "mode:image sanitizer output keeps mode as image");
  assert(item.content === "https://images.trucsdefrench.com/pic.jpeg", "mode:image item keeps its URL in content, not replaced by text");
}

{
  // mode:"text" — content лишається реченням, не плутається з URL-подібним
  // кейсом вище (той самий тип поля content для обох режимів, розрізнення
  // лише через config.mode).
  const out = sanitizeChronologicalOrder({
    mode: "text",
    items: [{ id: "a", content: "Le cochon : « Groin groin… »", points: 1 }],
  });
  assert(out.mode === "text", "mode:text sanitizer output keeps mode as text");
  assert(out.items[0].content === "Le cochon : « Groin groin… »", "mode:text item keeps its sentence in content");
}

{
  // mode:"mixed" — content (URL) і text (підпис) обидва зберігаються
  // окремо, жодне не перезаписує інше.
  const out = sanitizeChronologicalOrder({
    mode: "mixed",
    items: [{ id: "a", content: "https://images.trucsdefrench.com/pic.jpeg", text: "Le chat", points: 1 }],
  });
  const item = out.items[0];
  assert(out.mode === "mixed", "mode:mixed sanitizer output keeps mode as mixed");
  assert(item.content === "https://images.trucsdefrench.com/pic.jpeg", "mode:mixed item keeps its image URL in content");
  assert(item.text === "Le chat", "mode:mixed item keeps its caption in text, separate from content");
}

// --- sanitizeReorder (задача "dead admin option liveFeedback" /
// "correct order reaching the client before a check") -------------------

{
  // Легасі config, збережений ДО видалення liveFeedback — ключ і досі
  // лежить у JSON (жодної БД-миграції не було, навмисно), sanitizeReorder
  // більше не читає його: парситься й рендериться (тут — produces output)
  // без помилки, і correctOrder НІКОЛИ не потрапляє в публічний вихід,
  // незалежно від значення застарілого ключа.
  const legacyConfig = {
    liveFeedback: true,
    sequences: [{ id: "s1", items: ["Je", "mange", "une", "pomme"] }],
  } as unknown as ReorderConfig;
  const out = sanitizeReorder(legacyConfig);
  assert(out.sequences.length === 1, "legacy config with a stray liveFeedback key still sanitizes to one sequence, no crash");
  assert(
    !("correctOrder" in out.sequences[0]),
    "correctOrder is never emitted, even for a legacy config whose liveFeedback was true"
  );
  assert(!("liveFeedback" in out), "liveFeedback itself is never echoed back in the public config either");
  assert(
    out.sequences[0].items.length === 4 && out.sequences[0].items.every((w) => legacyConfig.sequences[0].items.includes(w)),
    "the shuffled items are still exactly the same 4 words, just reordered"
  );
}

{
  // Та сама гарантія для config БЕЗ liveFeedback узагалі (сучасний
  // формат, після видалення поля зі схеми) — correctOrder і тут
  // відсутній.
  const modernConfig: ReorderConfig = { sequences: [{ id: "s1", items: ["Il", "pleut"] }] };
  const out = sanitizeReorder(modernConfig);
  assert(!("correctOrder" in out.sequences[0]), "no liveFeedback field at all -> still no correctOrder leak");
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
}
console.log("All sanitize tests passed.");
