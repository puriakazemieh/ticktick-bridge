import test from "node:test";
import assert from "node:assert/strict";
import {
  computeWeeklyReviewRange,
  computeWeeklyReviewMetrics,
  planMoveOverdueAction,
  planClearWeeklyAction,
  planNextWeekAction
} from "../src/core/weekly-review.js";

test("computeWeeklyReviewRange aligns week to Saturday through Friday", () => {
  // 2026-10-14 is Wednesday
  const range = computeWeeklyReviewRange("2026-10-14");
  
  assert.equal(range.start, "2026-10-10"); // Saturday
  assert.equal(range.end, "2026-10-16");   // Friday
  assert.equal(range.days.length, 7);
  assert.equal(range.days[0], "2026-10-10");
  assert.equal(range.days[6], "2026-10-16");

  // Offset -1 week (previous Saturday-Friday)
  const prev = computeWeeklyReviewRange("2026-10-14", -1);
  assert.equal(prev.start, "2026-10-03"); // Prior Saturday
  assert.equal(prev.end, "2026-10-09");   // Prior Friday

  // Offset +1 week (next Saturday-Friday)
  const next = computeWeeklyReviewRange("2026-10-14", 1);
  assert.equal(next.start, "2026-10-17"); // Next Saturday
  assert.equal(next.end, "2026-10-23");   // Next Friday
});

test("computeWeeklyReviewMetrics calculates reproducible metrics from fixed cache fixture", () => {
  const weekRange = { start: "2026-10-10", end: "2026-10-16" };
  const today = "2026-10-14"; // Wednesday in current week

  const fixtureTasks = [
    // 1. Completed in this week
    {
      id: "t1",
      title: "Completed Task 1",
      status: 2,
      completedTime: "2026-10-12T14:00:00+0330",
      tags: ["work", "dev"]
    },
    {
      id: "t2",
      title: "Completed Task 2",
      status: 2,
      dueDate: "2026-10-11T00:00:00+0330",
      tags: ["work"]
    },
    // Completed in past week (should NOT be counted in this week's completed)
    {
      id: "t-past-done",
      title: "Past Done",
      status: 2,
      completedTime: "2026-10-05T12:00:00+0330"
    },
    // 2. Active scheduled in this week (due 2026-10-15)
    {
      id: "t3",
      title: "Active Scheduled Task",
      status: 0,
      dueDate: "2026-10-15T00:00:00+0330",
      tags: ["work", "urgent"]
    },
    // 3. Active scheduled spanning across week (moved / range)
    {
      id: "t4",
      title: "Multi-day Task",
      status: 0,
      startDate: "2026-10-12T00:00:00+0330",
      dueDate: "2026-10-16T00:00:00+0330",
      tags: ["planning"]
    },
    // 4. Overdue task (due 2026-10-08, before today 2026-10-14)
    {
      id: "t5",
      title: "Overdue Task",
      status: 0,
      dueDate: "2026-10-08T00:00:00+0330",
      tags: ["urgent"]
    },
    // 5. Unscheduled backlog (no dates)
    {
      id: "t6",
      title: "Backlog Task",
      status: 0,
      tags: ["ideas"]
    }
  ];

  const metrics = computeWeeklyReviewMetrics(fixtureTasks, weekRange, { today });

  // Verification of exact counts
  assert.equal(metrics.summary.completedCount, 2);
  assert.equal(metrics.summary.scheduledCount, 2); // t3 and t4
  assert.equal(metrics.summary.overdueCount, 1);   // t5
  assert.equal(metrics.summary.movedCount, 1);     // t4 (startDate !== dueDate)
  assert.equal(metrics.summary.unscheduledCount, 1); // t6
  assert.equal(metrics.summary.totalReviewed, 4);   // 2 completed + 2 scheduled
  assert.equal(metrics.summary.completionRate, 50); // 2/4 = 50%

  // Verification of most used tags
  // Tag counts:
  // t1: work (1), dev (1)
  // t2: work (2)
  // t3: work (3), urgent (1)
  // t4: planning (1)
  // t5: urgent (2)
  // Expected: work: 3, urgent: 2, dev: 1, planning: 1
  assert.equal(metrics.mostUsedTags[0].tag, "work");
  assert.equal(metrics.mostUsedTags[0].count, 3);
  assert.equal(metrics.mostUsedTags[1].tag, "urgent");
  assert.equal(metrics.mostUsedTags[1].count, 2);
});

test("preview action builders format valid operations for bounded queue execution", () => {
  const overdueTasks = [{ id: "t1", title: "Overdue 1" }, { id: "t2", title: "Overdue 2" }];
  const movePlan = planMoveOverdueAction(overdueTasks, "2026-10-14");
  assert.equal(movePlan.operationType, "schedule-date");
  assert.equal(movePlan.parameters.targetDay, "2026-10-14");
  assert.equal(movePlan.tasks.length, 2);

  const scheduledTasks = [{ id: "t3", title: "Task 3" }];
  const clearPlan = planClearWeeklyAction(scheduledTasks);
  assert.equal(clearPlan.operationType, "clear-date");
  assert.equal(clearPlan.tasks.length, 1);

  const backlogTasks = [{ id: "t4", title: "Backlog 4" }];
  const nextWeekPlan = planNextWeekAction(backlogTasks, "2026-10-17");
  assert.equal(nextWeekPlan.operationType, "schedule-date");
  assert.equal(nextWeekPlan.parameters.targetDay, "2026-10-17");
  assert.equal(nextWeekPlan.tasks.length, 1);
});
