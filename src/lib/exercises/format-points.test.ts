// Немає тестового фреймворку в проєкті (package.json) — просте assert-
// скрипт, запускається вручну: npx tsx src/lib/exercises/format-points.test.ts
import { formatPoints, formatPointsCount, formatScore } from "./format-points";

let failures = 0;
function assertEqual(actual: string, expected: string, label: string) {
  if (actual !== expected) {
    failures++;
    console.error(`FAIL ${label}: expected "${expected}", got "${actual}"`);
  } else {
    console.log(`ok   ${label}: "${actual}"`);
  }
}

assertEqual(formatScore(2.7), "2,5", "formatScore(2.7)");
assertEqual(formatScore(2.8), "3", "formatScore(2.8)");
assertEqual(formatScore(5.714285714), "5,5", "formatScore(5.714285714)");
assertEqual(formatScore(24.664285714), "24,5", "formatScore(24.664285714)");
assertEqual(formatScore(8.75), "9", "formatScore(8.75)");
assertEqual(formatScore(10.2), "10", "formatScore(10.2)");
assertEqual(formatScore(12), "12", "formatScore(12)");

assertEqual(formatPoints(0, 1), "0 з 1 бала", "formatPoints(0,1)");
assertEqual(formatPoints(1, 2), "1 з 2 балів", "formatPoints(1,2)");
assertEqual(formatPoints(3, 5), "3 з 5 балів", "formatPoints(3,5)");
assertEqual(formatPoints(4, 4), "4 з 4 балів", "formatPoints(4,4)");
assertEqual(formatPoints(1, 21), "1 з 21 бала", "formatPoints(1,21)");
assertEqual(formatPoints(5, 11), "5 з 11 балів", "formatPoints(5,11)");
assertEqual(formatPoints(1, 2.5), "1 з 2,5 бала", "formatPoints(1,2.5) half possible");
assertEqual(formatPoints(24.664285714, 30), "24,5 з 30 балів", "formatPoints long float tail");
assertEqual(formatPoints(5.714285714, 8), "5,5 з 8 балів", "formatPoints block chip tail");
assertEqual(formatPoints(1, 7.96), "1 з 8 балів", "formatPoints(1,7.96) rounds possible to integer");

assertEqual(formatPointsCount(1), "1 бал", "formatPointsCount(1)");
assertEqual(formatPointsCount(2), "2 бали", "formatPointsCount(2)");
assertEqual(formatPointsCount(5), "5 балів", "formatPointsCount(5)");
assertEqual(formatPointsCount(11), "11 балів", "formatPointsCount(11)");
assertEqual(formatPointsCount(22), "22 бали", "formatPointsCount(22)");
assertEqual(formatPointsCount(2.5), "2,5 бала", "formatPointsCount(2.5)");
assertEqual(formatPointsCount(0.5), "0,5 бала", "formatPointsCount(0.5)");

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll formatPoints/formatPointsCount assertions passed");
