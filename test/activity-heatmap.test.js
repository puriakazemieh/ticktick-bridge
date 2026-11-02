import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeHabitStamp,
  calculateHeatmapLevel,
  computeAnnualHeatmapData
} from "../src/core/activity-heatmap.js";

test("normalizeHabitStamp normalizes stamps to YYYY-MM-DD", () => {
  assert.equal(normalizeHabitStamp(20261102), "2026-11-02");
  assert.equal(normalizeHabitStamp("20261102"), "2026-11-02");
  assert.equal(normalizeHabitStamp("2026-11-02"), "2026-11-02");
  assert.equal(normalizeHabitStamp(null), null);
});

test("calculateHeatmapLevel assigns appropriate levels 0..4", () => {
  assert.equal(calculateHeatmapLevel(0), 0);
  assert.equal(calculateHeatmapLevel(1), 1);
  assert.equal(calculateHeatmapLevel(2), 1);
  assert.equal(calculateHeatmapLevel(3), 2);
  assert.equal(calculateHeatmapLevel(5), 2);
  assert.equal(calculateHeatmapLevel(6), 3);
  assert.equal(calculateHeatmapLevel(9), 3);
  assert.equal(calculateHeatmapLevel(10), 4);
  assert.equal(calculateHeatmapLevel(25), 4);
});

test("computeAnnualHeatmapData calculates streaks, metrics and 52 weeks correctly", () => {
  const today = "2026-11-02"; // Monday

  const tasks = [
    // Completed today
    { id: "t1", title: "Task 1", status: 2, completedTime: "2026-11-02T10:00:00+0330" },
    { id: "t2", title: "Task 2", status: 2, completedTime: "2026-11-02T14:00:00+0330" },
    // Completed yesterday
    { id: "t3", title: "Task 3", status: 2, completedTime: "2026-11-01T10:00:00+0330" },
    // Uncompleted task (should be excluded)
    { id: "t4", title: "Open task", status: 0, dueDate: "2026-11-02T00:00:00+0330" }
  ];

  const habits = [
    { id: "h1", name: "ورزش روزانه" }
  ];

  const habitCheckins = {
    h1: [
      { stamp: "2026-11-02", status: 2, value: 1, goal: 1 },
      { stamp: "2026-11-01", status: 2, value: 1, goal: 1 },
      { stamp: "2026-10-31", status: 2, value: 1, goal: 1 }
    ]
  };

  const data = computeAnnualHeatmapData(tasks, habitCheckins, habits, {
    today,
    weeksCount: 52,
    timeZone: "Asia/Tehran"
  });

  assert.equal(data.weeksCount, 52);
  assert.equal(data.weeks.length, 52);
  // Each week must have exactly 7 days
  assert.equal(data.weeks[0].days.length, 7);
  assert.equal(data.weeks[51].days.length, 7);

  // Summary counts
  assert.equal(data.summary.totalTasksCompleted, 3);
  assert.equal(data.summary.totalHabitsCompleted, 3);
  assert.equal(data.summary.totalActivities, 6);

  // Consecutive streak: 2026-10-31 (Sat), 2026-11-01 (Sun), 2026-11-02 (Mon) -> 3 days!
  assert.equal(data.summary.currentStreak, 3);
  assert.ok(data.summary.longestStreak >= 3);
  assert.equal(data.summary.activeDaysCount, 3);
});
