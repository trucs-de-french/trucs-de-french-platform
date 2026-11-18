// Немає тестового фреймворку в проєкті (package.json) — простий assert-
// скрипт, той самий принцип, що word-training-session.test.ts.
// Запуск вручну: npx tsx src/lib/cabinet/mistakes-overview.test.ts
import {
  buildMistakesOverview,
  type MistakeTaskRow,
  type MistakeSceneRow,
  type MistakeProductRow,
} from "./mistakes-overview";

let failures = 0;
function assert(condition: boolean, label: string) {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${label}`);
  }
}

const products: MistakeProductRow[] = [{ id: "p1", title: "Amélie" }];
const scenes: MistakeSceneRow[] = [
  { id: "s1", title: "Scène 1", productId: "p1", orderIndex: 0 },
  { id: "s2", title: "Scène 2", productId: "p1", orderIndex: 1 },
];

function mcTask(id: string, sceneId: string, orderIndex: number): MistakeTaskRow {
  return {
    id,
    type: "multiple_choice",
    title: `MC ${id}`,
    config: { items: [{ id: "i1" }, { id: "i2" }] },
    sceneId,
    productId: "p1",
    orderIndex,
  };
}

function mcDetail(wrongIds: string[]) {
  return {
    items: [
      { id: "i1", options: [{ correct: true, selected: wrongIds.includes("i1") ? false : true }] },
      { id: "i2", options: [{ correct: true, selected: wrongIds.includes("i2") ? false : true }] },
    ],
  };
}

// 1. Sort scenes by totalUnresolved desc; ties by scene order.
{
  const tasks = [mcTask("t1", "s1", 0), mcTask("t2", "s2", 0)];
  const overview = buildMistakesOverview({
    mistakeRows: [
      { taskId: "t1", createdAt: "2026-01-01", detail: mcDetail(["i1"]) },
      { taskId: "t2", createdAt: "2026-01-01", detail: mcDetail(["i1", "i2"]) },
    ],
    tasks,
    scenes,
    products,
    progress: [],
    correctionStates: [],
  });
  assert(overview.scenes.length === 2, "two scenes present");
  assert(overview.scenes[0]?.sceneId === "s2", "scene with more unresolved sorts first");
  assert(overview.scenes[0]?.totalUnresolved === 2, "s2 total unresolved = 2");
  assert(overview.scenes[1]?.totalUnresolved === 1, "s1 total unresolved = 1");
  assert(overview.totalMistakes === 3, "overall totalMistakes = 3");
  assert(overview.scenesCount === 2, "overall scenesCount = 2");
}

// 1b. Tie-break by scene order when totals equal.
{
  const tasks = [mcTask("t1", "s1", 0), mcTask("t2", "s2", 0)];
  const overview = buildMistakesOverview({
    mistakeRows: [
      { taskId: "t1", createdAt: "2026-01-01", detail: mcDetail(["i1"]) },
      { taskId: "t2", createdAt: "2026-01-01", detail: mcDetail(["i1"]) },
    ],
    tasks,
    scenes,
    products,
    progress: [],
    correctionStates: [],
  });
  assert(overview.scenes[0]?.sceneId === "s1", "equal totals: earlier scene order wins tie-break");
}

// 2. Unsupported task type (e.g. open_answer) excluded entirely.
{
  const tasks: MistakeTaskRow[] = [
    { ...mcTask("t1", "s1", 0), type: "open_answer" },
  ];
  const overview = buildMistakesOverview({
    mistakeRows: [{ taskId: "t1", createdAt: "2026-01-01", detail: mcDetail(["i1"]) }],
    tasks,
    scenes,
    products,
    progress: [],
    correctionStates: [],
  });
  assert(overview.scenes.length === 0, "open_answer (unsupported) produces no scene group");
}

// 3. Corrected items (matching config_hash) are excluded from the count.
{
  const tasks = [mcTask("t1", "s1", 0)];
  const overview = buildMistakesOverview({
    mistakeRows: [{ taskId: "t1", createdAt: "2026-01-01", detail: mcDetail(["i1", "i2"]) }],
    tasks,
    scenes,
    products,
    progress: [],
    correctionStates: [{ taskId: "t1", correctedItemIds: ["i1"], failedAttempts: {} }],
  });
  assert(overview.scenes[0]?.tasks[0]?.unresolvedCount === 1, "one corrected item excluded, one remains");
}

// 4. Everything corrected -> task drops out entirely (status "done").
{
  const tasks = [mcTask("t1", "s1", 0)];
  const overview = buildMistakesOverview({
    mistakeRows: [{ taskId: "t1", createdAt: "2026-01-01", detail: mcDetail(["i1"]) }],
    tasks,
    scenes,
    products,
    progress: [],
    correctionStates: [{ taskId: "t1", correctedItemIds: ["i1"], failedAttempts: {} }],
  });
  assert(overview.scenes.length === 0, "fully corrected task disappears from the list");
}

// 5. config_hash mismatch -> server-side RPC resets to empty state; caller
//    passes no correctionStates row for that task -> nothing counted as
//    corrected (same as never-corrected).
{
  const tasks = [mcTask("t1", "s1", 0)];
  const overview = buildMistakesOverview({
    mistakeRows: [{ taskId: "t1", createdAt: "2026-01-01", detail: mcDetail(["i1", "i2"]) }],
    tasks,
    scenes,
    products,
    progress: [],
    correctionStates: [], // simulates hash mismatch / never-saved state
  });
  assert(overview.scenes[0]?.tasks[0]?.unresolvedCount === 2, "hash-mismatch reset: nothing treated as corrected");
}

// 6. score === 100 on the latest attempt -> task excluded even if old mistake rows exist.
{
  const tasks = [mcTask("t1", "s1", 0)];
  const overview = buildMistakesOverview({
    mistakeRows: [{ taskId: "t1", createdAt: "2026-01-01", detail: mcDetail(["i1"]) }],
    tasks,
    scenes,
    products,
    progress: [{ taskId: "t1", score: 100 }],
    correctionStates: [],
  });
  assert(overview.scenes.length === 0, "latest score 100 excludes the task");
}

// 7. Task without scene_id (DELF product task) is excluded.
{
  const tasks: MistakeTaskRow[] = [{ ...mcTask("t1", "s1", 0), sceneId: null }];
  const overview = buildMistakesOverview({
    mistakeRows: [{ taskId: "t1", createdAt: "2026-01-01", detail: mcDetail(["i1"]) }],
    tasks,
    scenes,
    products,
    progress: [],
    correctionStates: [],
  });
  assert(overview.scenes.length === 0, "scene-less (DELF) task excluded");
}

// 8. Empty input -> empty overview, no crash.
{
  const overview = buildMistakesOverview({
    mistakeRows: [],
    tasks: [],
    scenes: [],
    products: [],
    progress: [],
    correctionStates: [],
  });
  assert(overview.scenes.length === 0 && overview.totalMistakes === 0 && overview.scenesCount === 0, "empty input -> empty overview");
}

// 9. Tasks within a scene sort by task order_index, not insertion order.
{
  const tasks = [mcTask("t2", "s1", 2), mcTask("t1", "s1", 1)];
  const overview = buildMistakesOverview({
    mistakeRows: [
      { taskId: "t2", createdAt: "2026-01-01", detail: mcDetail(["i1"]) },
      { taskId: "t1", createdAt: "2026-01-01", detail: mcDetail(["i1"]) },
    ],
    tasks,
    scenes,
    products,
    progress: [],
    correctionStates: [],
  });
  const ids = overview.scenes[0]?.tasks.map((t) => t.taskId);
  assert(JSON.stringify(ids) === JSON.stringify(["t1", "t2"]), "tasks sorted by order_index within scene");
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed.`);
  process.exit(1);
} else {
  console.log("All mistakes-overview tests passed.");
}
