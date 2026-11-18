// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що word-training-session.test.ts.
// Запуск вручну: npx tsx src/components/cabinet/nav-items.test.ts
import { CABINET_PRIMARY_NAV, isNavItemActive } from "./nav-items";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

// "Головна" (/cabinet) — активна лише на точному шляху, НЕ на жодній
// підсторінці кабінету (інакше вона підсвічувалась би завжди, бо всі
// підсторінки кабінету починаються на "/cabinet").
assert(isNavItemActive("/cabinet", "/cabinet") === true, "home active on exact /cabinet");
assert(isNavItemActive("/cabinet", "/cabinet/library") === false, "home NOT active on /cabinet/library");
assert(isNavItemActive("/cabinet", "/cabinet/mistakes") === false, "home NOT active on /cabinet/mistakes");
assert(isNavItemActive("/cabinet", "/cabinet/dictionary/train/play") === false, "home NOT active on a dictionary subpage");

// "Мій словник" (/cabinet/dictionary) — активний і на вкладеному
// /cabinet/dictionary/train/play.
assert(isNavItemActive("/cabinet/dictionary", "/cabinet/dictionary") === true, "dictionary active on its own page");
assert(isNavItemActive("/cabinet/dictionary", "/cabinet/dictionary/train/play") === true, "dictionary active on train/play subpage");

// "Робота над помилками" (/cabinet/mistakes) — активний на точному шляху і
// на /cabinet/mistakes/[sceneId].
assert(isNavItemActive("/cabinet/mistakes", "/cabinet/mistakes") === true, "mistakes active on list page");
assert(isNavItemActive("/cabinet/mistakes", "/cabinet/mistakes/scene-123") === true, "mistakes active on per-scene page");

// Пункти меню не перетинаються префіксами одне з одним — для жодного
// реального шляху кабінету не підсвічується більше одного пункту.
const samplePaths = [
  "/cabinet",
  "/cabinet/library",
  "/cabinet/library/some-product",
  "/cabinet/dictionary",
  "/cabinet/dictionary/train/play",
  "/cabinet/progress",
  "/cabinet/mistakes",
  "/cabinet/mistakes/scene-123",
];
for (const path of samplePaths) {
  const activeCount = CABINET_PRIMARY_NAV.filter((item) => isNavItemActive(item.href, path)).length;
  assert(activeCount === 1, `exactly one nav item active for ${path} (got ${activeCount})`);
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
} else {
  console.log("All nav-items tests passed.");
}
