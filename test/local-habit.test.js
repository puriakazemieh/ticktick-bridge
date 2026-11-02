import test from "node:test";
import assert from "node:assert/strict";
import {
  extractHabitTitle,
  filterHabitsBySource,
  isLocalHabit,
  localHabitForDay,
  parseLocalHabit,
  parseYamlFrontmatter,
  previewHabitMigration
} from "../src/core/local-habit.js";
import { LocalHabitProvider } from "../src/core/habit-provider.js";

const REPETITION_HABIT = `---
habit: true
type: repetition
target: 2
unit: مرحله
startDate: 2026-09-14
records:
  2026-09-16: 5
  2026-09-19: 1
icon: 🇩🇪
group: زبان
useGroupColor: true
tags:
  - عادت
  - زبان
---

# تمرین آلمانی (10 لغت و پرزنتیشن)

این فایل توسط افزونه Habits مدیریت می‌شود.
`;

const BINARY_HABIT = `---
habit: true
type: binary
startDate: 2026-09-14
records:
  2026-09-19: 1
  2026-10-03: 1
icon: 📖
group: بهبود فردی
tags:
  - عادت
---

# مطالعه کتاب
`;

const UNSUPPORTED_HABIT = `---
habit: true
type: counter
target: 10
customField: unknownValue
records:
  2026-10-01: 7
---

# عادت با فیلد سفارشی
`;

test("isLocalHabit detects habit frontmatter accurately", () => {
  assert.equal(isLocalHabit(REPETITION_HABIT), true);
  assert.equal(isLocalHabit(BINARY_HABIT), true);
  assert.equal(isLocalHabit("# Regular Note\nJust content"), false);
  assert.equal(isLocalHabit(""), false);
  assert.equal(isLocalHabit(null), false);
});

test("parseLocalHabit parses repetition habits with Persian labels and records", () => {
  const habit = parseLocalHabit(REPETITION_HABIT, { path: "Habits/german.md" });
  assert.ok(habit);
  assert.equal(habit.name, "تمرین آلمانی (10 لغت و پرزنتیشن)");
  assert.equal(habit.type, "repetition");
  assert.equal(habit.goal, 2);
  assert.equal(habit.unit, "مرحله");
  assert.equal(habit.icon, "🇩🇪");
  assert.equal(habit.sectionName, "زبان");
  assert.deepEqual(habit.tags, ["عادت", "زبان"]);
  assert.equal(habit.records["2026-09-16"], 5);
  assert.equal(habit.records["2026-09-19"], 1);
  assert.equal(habit.source, "local");
  assert.equal(habit.needsMapping, false);
});

test("parseLocalHabit parses binary habits defaulting target to 1", () => {
  const habit = parseLocalHabit(BINARY_HABIT, { path: "Habits/reading.md" });
  assert.ok(habit);
  assert.equal(habit.name, "مطالعه کتاب");
  assert.equal(habit.type, "binary");
  assert.equal(habit.goal, 1);
  assert.equal(habit.target, 1);
  assert.equal(habit.sectionName, "بهبود فردی");
  assert.equal(habit.needsMapping, false);
});

test("parseLocalHabit reports unsupported fields and unmapped types rather than guessing", () => {
  const habit = parseLocalHabit(UNSUPPORTED_HABIT);
  assert.ok(habit);
  assert.equal(habit.needsMapping, true);
  assert.equal(habit.unsupported.customField, "unknownValue");
  assert.equal(habit.type, "counter");
});

test("parseLocalHabit handles malformed frontmatter and non-habit content safely", () => {
  assert.equal(parseLocalHabit("Not frontmatter"), null);
  assert.equal(parseLocalHabit("---\ntitle: No Habit\n---\nBody"), null);
  assert.equal(parseLocalHabit(null), null);
});

test("localHabitForDay computes checkin status and values for specific days", () => {
  const habit = parseLocalHabit(REPETITION_HABIT);
  const day1 = localHabitForDay(habit, "2026-09-16");
  assert.equal(day1.checkin.value, 5);
  assert.equal(day1.checkin.goal, 2);
  assert.equal(day1.checkin.status, 2); // completed

  const day2 = localHabitForDay(habit, "2026-09-19");
  assert.equal(day2.checkin.value, 1);
  assert.equal(day2.checkin.status, 1); // in-progress

  const day3 = localHabitForDay(habit, "2026-10-01");
  assert.equal(day3.checkin.value, 0);
  assert.equal(day3.checkin.status, 0); // not started
});

test("previewHabitMigration generates safe preview and blocks remote writes", () => {
  const habit = parseLocalHabit(REPETITION_HABIT, { path: "Habits/german.md" });
  const preview = previewHabitMigration(habit);

  assert.ok(preview);
  assert.equal(preview.name, "تمرین آلمانی (10 لغت و پرزنتیشن)");
  assert.equal(preview.targetPayload.goal, 2);
  assert.equal(preview.targetPayload.unit, "مرحله");
  assert.equal(preview.isBlocked, true);
  assert.ok(preview.blockReason.includes("مسدود"));
  assert.ok(preview.losses.length > 0);
});

test("LocalHabitProvider returns daily habits with source local", async () => {
  const parsed = parseLocalHabit(REPETITION_HABIT);
  const provider = new LocalHabitProvider({
    listHabits: async () => [parsed]
  });

  const dayHabits = await provider.listForDay("2026-09-16");
  assert.equal(dayHabits.length, 1);
  assert.equal(dayHabits[0].source, "local");
  assert.equal(dayHabits[0].checkin.status, 2);
});

test("filterHabitsBySource separates local, ticktick, and linked records", () => {
  const habits = [
    { id: "1", name: "مطالعه کتاب", source: "local" },
    { id: "2", name: "مطالعه کتاب", source: "ticktick" },
    { id: "3", name: "ورزش", source: "linked" }
  ];

  assert.equal(filterHabitsBySource(habits, "all").length, 3);
  assert.equal(filterHabitsBySource(habits, "local").length, 1);
  assert.equal(filterHabitsBySource(habits, "local")[0].id, "1");
  assert.equal(filterHabitsBySource(habits, "ticktick").length, 1);
  assert.equal(filterHabitsBySource(habits, "ticktick")[0].id, "2");
  assert.equal(filterHabitsBySource(habits, "linked").length, 1);
  assert.equal(filterHabitsBySource(habits, "linked")[0].id, "3");
});

test("identically named local and remote habits remain independent without auto-merging", () => {
  const localHabit = parseLocalHabit(BINARY_HABIT, { path: "Habits/reading.md" });
  const remoteHabit = {
    id: "tt-reading",
    name: "مطالعه کتاب",
    source: "ticktick",
    goal: 1,
    checkin: { stamp: 20261003, value: 0, status: 0 }
  };

  const dayLocal = localHabitForDay(localHabit, "2026-10-03");
  assert.notEqual(dayLocal.id, remoteHabit.id);
  assert.equal(dayLocal.source, "local");
  assert.equal(remoteHabit.source, "ticktick");
  assert.equal(dayLocal.checkin.status, 2); // local completed
  assert.equal(remoteHabit.checkin.status, 0); // remote not completed
});
