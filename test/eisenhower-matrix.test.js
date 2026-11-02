import test from "node:test";
import assert from "node:assert/strict";
import {
  QUADRANTS,
  QUADRANT_IDS,
  isTaskUrgent,
  isTaskImportant,
  partitionEisenhowerMatrix,
  computeQuadrantDropMutation
} from "../src/core/eisenhower-matrix.js";

test("isTaskUrgent detects overdue and near-term tasks", () => {
  const today = "2026-11-02";

  // Task due today is urgent
  assert.equal(isTaskUrgent({ dueDate: "2026-11-02T10:00:00+0330" }, today), true);

  // Task overdue is urgent
  assert.equal(isTaskUrgent({ dueDate: "2026-11-01T00:00:00+0330" }, today), true);

  // Task due in 1 day (within default threshold 2 days) is urgent
  assert.equal(isTaskUrgent({ dueDate: "2026-11-03T18:00:00+0330" }, today), true);
  assert.equal(isTaskUrgent({ dueDate: "2026-11-04T00:00:00+0330" }, today), true);

  // Task due in 5 days is NOT urgent
  assert.equal(isTaskUrgent({ dueDate: "2026-11-07T00:00:00+0330" }, today), false);

  // Unscheduled task (no due or start date) is NOT urgent
  assert.equal(isTaskUrgent({ title: "Backlog item" }, today), false);
  assert.equal(isTaskUrgent(null, today), false);
});

test("isTaskImportant checks priority and tags", () => {
  // High priority (5) is important
  assert.equal(isTaskImportant({ priority: 5 }), true);

  // Medium priority (3) is important
  assert.equal(isTaskImportant({ priority: 3 }), true);

  // Low (1) or None (0) priority is NOT important unless tagged
  assert.equal(isTaskImportant({ priority: 1 }), false);
  assert.equal(isTaskImportant({ priority: 0 }), false);

  // Persian and English tags for importance
  assert.equal(isTaskImportant({ priority: 0, tags: ["مهم"] }), true);
  assert.equal(isTaskImportant({ priority: 1, tags: ["#important", "work"] }), true);
  assert.equal(isTaskImportant({ priority: 0, tags: ["critical"] }), true);
  assert.equal(isTaskImportant({ priority: 0, tags: ["random"] }), false);

  assert.equal(isTaskImportant(null), false);
});

test("partitionEisenhowerMatrix partitions tasks into Q1, Q2, Q3, Q4", () => {
  const today = "2026-11-02";

  const tasks = [
    // Q1: Urgent & Important
    {
      id: "t1",
      title: "Fix production bug",
      priority: 5,
      dueDate: "2026-11-02T12:00:00+0330",
      status: 0
    },
    // Q2: Important & Not Urgent
    {
      id: "t2",
      title: "Quarterly strategy",
      priority: 5,
      dueDate: "2026-11-15T00:00:00+0330",
      status: 0
    },
    // Q3: Urgent & Not Important
    {
      id: "t3",
      title: "Reply to quick email",
      priority: 1,
      dueDate: "2026-11-02T09:00:00+0330",
      status: 0
    },
    // Q4: Neither Urgent nor Important (Backlog / Low priority unscheduled)
    {
      id: "t4",
      title: "Clean bookmarks",
      priority: 0,
      dueDate: null,
      status: 0
    },
    // Completed task should be separated
    {
      id: "t5",
      title: "Done yesterday",
      priority: 5,
      dueDate: "2026-11-01T00:00:00+0330",
      status: 2
    }
  ];

  const result = partitionEisenhowerMatrix(tasks, { today, timeZone: "Asia/Tehran" });

  assert.equal(result.q1.length, 1);
  assert.equal(result.q1[0].id, "t1");

  assert.equal(result.q2.length, 1);
  assert.equal(result.q2[0].id, "t2");

  assert.equal(result.q3.length, 1);
  assert.equal(result.q3[0].id, "t3");

  assert.equal(result.q4.length, 1);
  assert.equal(result.q4[0].id, "t4");

  assert.equal(result.completed.length, 1);
  assert.equal(result.completed[0].id, "t5");

  assert.equal(result.counts.totalOpen, 4);
  assert.equal(result.counts.q1, 1);
  assert.equal(result.counts.q2, 1);
  assert.equal(result.counts.q3, 1);
  assert.equal(result.counts.q4, 1);
});

test("computeQuadrantDropMutation calculates appropriate mutations for each quadrant", () => {
  const today = "2026-11-02";
  const task = {
    id: "task-100",
    projectId: "inbox-proj",
    priority: 0,
    dueDate: null
  };

  // Dropping into Q1 sets priority 5 and due today
  const mQ1 = computeQuadrantDropMutation(task, "q1", today);
  assert.equal(mQ1.id, "task-100");
  assert.equal(mQ1.priority, 5);
  assert.ok(mQ1.dueDate.startsWith("2026-11-02"));

  // Dropping into Q2 sets priority 5 and future date (> 2 days)
  const mQ2 = computeQuadrantDropMutation(task, "q2", today);
  assert.equal(mQ2.priority, 5);
  assert.ok(mQ2.dueDate.startsWith("2026-11-05"));

  // Dropping into Q3 sets priority 1 and due today
  const mQ3 = computeQuadrantDropMutation(task, "q3", today);
  assert.equal(mQ3.priority, 1);
  assert.ok(mQ3.dueDate.startsWith("2026-11-02"));

  // Dropping into Q4 clears date and resets priority to 0
  const mQ4 = computeQuadrantDropMutation({ ...task, priority: 5, dueDate: "2026-11-02T00:00:00+0330" }, "q4", today);
  assert.equal(mQ4.priority, 0);
  assert.equal(mQ4.dueDate, null);
  assert.equal(mQ4.startDate, null);

  // Invalid target returns null
  assert.equal(computeQuadrantDropMutation(task, "invalid", today), null);
  assert.equal(computeQuadrantDropMutation(null, "q1", today), null);
});
