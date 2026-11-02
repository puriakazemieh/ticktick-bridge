import test from "node:test";
import assert from "node:assert/strict";
import {
  createSavedView,
  duplicateSavedView,
  filterAndSortTasks,
  fuzzyMatchesText,
  matchesTaskFilter,
  normalizeSearchText,
  sortTasks,
  updateSavedView
} from "../src/core/task-filter.js";

const SAMPLE_TASKS = [
  {
    id: "t1",
    title: "توسعه سامانه توسن‌تکنو",
    content: "پیاده‌سازی ماژول پرداخت",
    projectId: "p-tosan",
    projectName: "توسن‌تکنو",
    tags: ["فوری", "بک‌اند"],
    priority: 5,
    status: 0,
    dueDate: "2026-11-05",
    sortOrder: 1
  },
  {
    id: "t2",
    title: "بررسی تسک توسن تكنو با كاف عربي",
    content: "تست حروف عربی",
    projectId: "p-tosan",
    projectName: "توسن‌تکنو",
    tags: ["عادی"],
    priority: 3,
    status: 0,
    dueDate: "2026-11-06",
    sortOrder: 2
  },
  {
    id: "t3",
    title: "مطالعه کتاب زبان آلمانی",
    content: "فصل ۳ گرامر",
    projectId: "p-personal",
    projectName: "شخصی",
    tags: ["فوری", "زبان"],
    priority: 5,
    status: 0,
    dueDate: "2026-11-02",
    sortOrder: 3
  },
  {
    id: "t4",
    title: "خرید وسایل خانه",
    content: "فهرست خرید",
    projectId: "p-personal",
    projectName: "شخصی",
    tags: ["خرید"],
    priority: 0,
    status: 2, // completed
    dueDate: "2026-10-30",
    sortOrder: 4
  }
];

test("normalizeSearchText and fuzzyMatchesText normalize Persian/Arabic characters and diacritics", () => {
  assert.equal(normalizeSearchText("تَسْکِ فَوْری"), "تسک فوری");
  assert.equal(normalizeSearchText("توسن‌تكنو"), "توسن تکنو"); // Arabic Kaf and half-space
  assert.equal(normalizeSearchText("علي"), "علی"); // Arabic Yeh

  assert.equal(fuzzyMatchesText("توسن تکنو", "توسن‌تکنو"), true);
  assert.equal(fuzzyMatchesText("توسن‌تكنو", "سامانه توسن تکنو"), true);
  assert.equal(fuzzyMatchesText("كتاب", "مطالعه کتاب زبان"), true);
  assert.equal(fuzzyMatchesText("ناموجود", "سامانه توسن"), false);
});

test("matchesTaskFilter enforces OR within projects and tags, and AND between them", () => {
  // 1. Projects OR
  const projectFilter = { projects: ["p-tosan"] };
  assert.equal(matchesTaskFilter(SAMPLE_TASKS[0], projectFilter), true);
  assert.equal(matchesTaskFilter(SAMPLE_TASKS[2], projectFilter), false);

  // 2. Tags OR
  const tagFilter = { tags: ["فوری", "خرید"] };
  assert.equal(matchesTaskFilter(SAMPLE_TASKS[0], tagFilter), true); // has فوری
  assert.equal(matchesTaskFilter(SAMPLE_TASKS[1], tagFilter), false); // has عادی
  assert.equal(matchesTaskFilter(SAMPLE_TASKS[3], tagFilter), true); // has خرید

  // 3. AND between Project and Tag: "توسن‌تکنو + #فوری"
  const combinedFilter = {
    projects: ["p-tosan"],
    tags: ["فوری"]
  };
  assert.equal(matchesTaskFilter(SAMPLE_TASKS[0], combinedFilter), true); // tosan + فوری
  assert.equal(matchesTaskFilter(SAMPLE_TASKS[1], combinedFilter), false); // tosan but not فوری
  assert.equal(matchesTaskFilter(SAMPLE_TASKS[2], combinedFilter), false); // فوری but not tosan
});

test("matchesTaskFilter checks priority, status, and date range", () => {
  const priorityFilter = { priorities: [5] };
  assert.equal(matchesTaskFilter(SAMPLE_TASKS[0], priorityFilter), true);
  assert.equal(matchesTaskFilter(SAMPLE_TASKS[1], priorityFilter), false);

  const statusFilter = { statuses: [2] }; // completed only
  assert.equal(matchesTaskFilter(SAMPLE_TASKS[0], statusFilter), false);
  assert.equal(matchesTaskFilter(SAMPLE_TASKS[3], statusFilter), true);

  const dateFilter = {
    dateRange: { start: "2026-11-01", end: "2026-11-05" }
  };
  assert.equal(matchesTaskFilter(SAMPLE_TASKS[0], dateFilter), true); // 2026-11-05
  assert.equal(matchesTaskFilter(SAMPLE_TASKS[1], dateFilter), false); // 2026-11-06 (after end)
  assert.equal(matchesTaskFilter(SAMPLE_TASKS[2], dateFilter), true); // 2026-11-02
  assert.equal(matchesTaskFilter(SAMPLE_TASKS[3], dateFilter), false); // 2026-10-30 (before start)
});

test("filterAndSortTasks applies search, filters, and custom sorting", () => {
  const filter = {
    searchText: "توسن",
    statuses: [0],
    sort: "priority"
  };
  const results = filterAndSortTasks(SAMPLE_TASKS, filter);
  assert.equal(results.length, 2);
  assert.equal(results[0].id, "t1"); // priority 5 first
  assert.equal(results[1].id, "t2"); // priority 3 second
});

test("createSavedView, updateSavedView, and duplicateSavedView manage saved views cleanly", () => {
  const initial = createSavedView("توسن فوری", {
    projects: ["p-tosan"],
    tags: ["فوری"],
    priorities: [5],
    sort: "date"
  });

  assert.ok(initial.id);
  assert.equal(initial.name, "توسن فوری");
  assert.deepEqual(initial.filter.projects, ["p-tosan"]);
  assert.deepEqual(initial.filter.tags, ["فوری"]);
  assert.equal(initial.filter.sort, "date");

  // Update
  const updated = updateSavedView(initial, {
    name: "توسن و پروژه‌های فوری",
    filter: { priorities: [3, 5] }
  });
  assert.equal(updated.name, "توسن و پروژه‌های فوری");
  assert.deepEqual(updated.filter.priorities, [3, 5]);

  // Duplicate
  const duplicated = duplicateSavedView(updated, "توسن و پروژه‌های فوری (کپی)");
  assert.notEqual(duplicated.id, updated.id);
  assert.equal(duplicated.name, "توسن و پروژه‌های فوری (کپی)");
  assert.deepEqual(duplicated.filter, updated.filter);
});

test("shared filter yields deterministic task IDs across different surfaces", () => {
  const sharedFilter = {
    projects: ["p-tosan", "p-personal"],
    tags: ["فوری"],
    statuses: [0]
  };

  const boardMatches = filterAndSortTasks(SAMPLE_TASKS, sharedFilter).map(t => t.id);
  const weekMatches = filterAndSortTasks(SAMPLE_TASKS, sharedFilter).map(t => t.id);
  const monthMatches = filterAndSortTasks(SAMPLE_TASKS, sharedFilter).map(t => t.id);

  assert.deepEqual(boardMatches, ["t1", "t3"]);
  assert.deepEqual(weekMatches, ["t1", "t3"]);
  assert.deepEqual(monthMatches, ["t1", "t3"]);
});
