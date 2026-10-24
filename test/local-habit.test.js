import test from "node:test";
import assert from "node:assert/strict";
import { localHabitForDay, parseLocalHabit } from "../src/core/local-habit.js";
test("parses a Persian counter habit and its read-only history", () => {
  const habit = parseLocalHabit("---\nname: آب خوردن\ncadence: weekly\ndays: شنبه,دوشنبه\ngoal: 8\nunit: لیوان\nsection: سلامتی\n---\n- [x] 2026-10-03: 8", "برنامه‌ریزی/Habits/آب.md");
  assert.equal(habit.name, "آب خوردن"); assert.equal(habit.goal, 8); assert.equal(habit.history[0].completed, true); assert.equal(localHabitForDay(habit, "2026-10-03").checkin.status, 2);
});
test("malformed or unsupported local metadata requires mapping rather than guesses", () => {
  assert.equal(parseLocalHabit("بدون frontmatter", "x.md").needsMapping, true);
  assert.equal(parseLocalHabit("---\nname: تست\ncadence: monthly\ncustom: value\n---", "x.md").needsMapping, true);
});
