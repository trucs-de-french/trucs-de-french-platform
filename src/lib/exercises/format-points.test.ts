// Немає тестового фреймворку в проєкті (package.json) — просте assert-
// скрипт, запускається вручну: npx tsx src/lib/exercises/format-points.test.ts
import { formatPoints, formatPointsCount } from "./format-points";

let failures = 0;
function assertEqual(actual: string, expected: string, label: string) {
  if (actual !== expected) {
    failures++;
    console.error(`FAIL ${label}: expected "${expected}", got "${actual}"`);
  } else {
    console.log(`ok   ${label}: "${actual}"`);
  }
}

assertEqual(formatPoints(0, 1), "0 з 1 бала", "formatPoints(0,1)");
assertEqual(formatPoints(1, 2), "1 з 2 балів", "formatPoints(1,2)");
assertEqual(formatPoints(3, 5), "3 з 5 балів", "formatPoints(3,5)");
assertEqual(formatPoints(4, 4), "4 з 4 балів", "formatPoints(4,4)");
assertEqual(formatPoints(1, 21), "1 з 21 бала", "formatPoints(1,21)");
assertEqual(formatPoints(5, 11), "5 з 11 балів", "formatPoints(5,11)");
assertEqual(formatPoints(1, 2.5), "1 з 2.5 бала", "formatPoints(1,2.5) non-integer possible");

assertEqual(formatPointsCount(1), "1 бал", "formatPointsCount(1)");
assertEqual(formatPointsCount(2), "2 бали", "formatPointsCount(2)");
assertEqual(formatPointsCount(5), "5 балів", "formatPointsCount(5)");
assertEqual(formatPointsCount(11), "11 балів", "formatPointsCount(11)");
assertEqual(formatPointsCount(22), "22 бали", "formatPointsCount(22)");

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll formatPoints/formatPointsCount assertions passed");
