import test from "node:test";
import assert from "node:assert/strict";
import {
  timeStringToMinutes,
  minutesToTimeString,
  extractTaskTimeRange,
  computeDayTimeSlots,
  computeTimeSlotDropMutation,
  computeResizeBlockMutation,
  findCurrentActiveBlock
} from "../src/core/timeblocking.js";

test("timeStringToMinutes and minutesToTimeString conversion", () => {
  assert.equal(timeStringToMinutes("09:30"), 570);
  assert.equal(timeStringToMinutes("2026-11-02T14:15:00+0330"), 855);
  assert.equal(timeStringToMinutes("00:00"), 0);
  assert.equal(timeStringToMinutes("invalid"), null);
  assert.equal(timeStringToMinutes(null), null);

  assert.equal(minutesToTimeString(570), "09:30");
  assert.equal(minutesToTimeString(855), "14:15");
  assert.equal(minutesToTimeString(0), "00:00");
  assert.equal(minutesToTimeString(1439), "23:59");
});

test("extractTaskTimeRange extracts timed tasks accurately", () => {
  const targetDay = "2026-11-02";

  // Task with explicit start and due
  const t1 = {
    startDate: "2026-11-02T10:00:00+0330",
    dueDate: "2026-11-02T11:30:00+0330",
    isAllDay: false
  };
  const r1 = extractTaskTimeRange(t1, targetDay);
  assert.notEqual(r1, null);
  assert.equal(r1.startMinutes, 600); // 10:00
  assert.equal(r1.endMinutes, 690);   // 11:30
  assert.equal(r1.durationMinutes, 90);
  assert.equal(r1.startTime, "10:00");
  assert.equal(r1.endTime, "11:30");

  // Task with only due time
  const t2 = {
    dueDate: "2026-11-02T16:00:00+0330",
    isAllDay: false
  };
  const r2 = extractTaskTimeRange(t2, targetDay, { defaultDurationMinutes: 60 });
  assert.notEqual(r2, null);
  assert.equal(r2.endMinutes, 960);   // 16:00
  assert.equal(r2.startMinutes, 900); // 15:00
  assert.equal(r2.durationMinutes, 60);

  // Task with allDay true returns null
  const t3 = {
    dueDate: "2026-11-02T12:00:00+0330",
    isAllDay: true
  };
  assert.equal(extractTaskTimeRange(t3, targetDay), null);

  // Task on another day returns null
  const t4 = {
    dueDate: "2026-11-05T12:00:00+0330",
    isAllDay: false
  };
  assert.equal(extractTaskTimeRange(t4, targetDay), null);
});

test("computeDayTimeSlots computes vertical grid slots, untimed, and lane packing", () => {
  const targetDay = "2026-11-02";
  const tasks = [
    // Overdue task
    {
      id: "t-overdue",
      title: "Overdue task",
      dueDate: "2026-11-01T12:00:00+0330",
      status: 0
    },
    // Timed task 1: 09:00 - 10:00
    {
      id: "t1",
      title: "Deep work",
      startDate: "2026-11-02T09:00:00+0330",
      dueDate: "2026-11-02T10:00:00+0330",
      status: 0
    },
    // Overlapping timed task 2: 09:30 - 10:30
    {
      id: "t2",
      title: "Quick sync",
      startDate: "2026-11-02T09:30:00+0330",
      dueDate: "2026-11-02T10:30:00+0330",
      status: 0
    },
    // Untimed task for today
    {
      id: "t-untimed",
      title: "Untimed task",
      dueDate: "2026-11-02T00:00:00+0330",
      isAllDay: true,
      status: 0
    }
  ];

  const result = computeDayTimeSlots(tasks, targetDay, {
    startHour: 8,
    endHour: 20,
    slotMinutes: 30
  });

  assert.equal(result.overdue.length, 1);
  assert.equal(result.overdue[0].id, "t-overdue");

  assert.equal(result.untimed.length, 1);
  assert.equal(result.untimed[0].id, "t-untimed");

  assert.equal(result.timed.length, 2);

  // t1: 09:00 is slot 3 (since 08:00 is slot 1, 08:30 is slot 2)
  const item1 = result.timed.find(i => i.task.id === "t1");
  assert.equal(item1.rowStart, 3);
  assert.equal(item1.rowSpan, 2); // 60 mins = 2 x 30m slots

  // Overlap packing: t1 and t2 should have different lane indices and totalLanes = 2
  const item2 = result.timed.find(i => i.task.id === "t2");
  assert.notEqual(item1.laneIndex, item2.laneIndex);
  assert.equal(item1.totalLanes, 2);
  assert.equal(item2.totalLanes, 2);
});

test("computeTimeSlotDropMutation and computeResizeBlockMutation", () => {
  const targetDay = "2026-11-02";
  const task = {
    id: "task-55",
    projectId: "proj-1",
    title: "Write documentation"
  };

  const dropMutation = computeTimeSlotDropMutation(task, targetDay, 14, 30, 60);
  assert.equal(dropMutation.id, "task-55");
  assert.equal(dropMutation.isAllDay, false);
  assert.ok(dropMutation.startDate.startsWith("2026-11-02T14:30:00"));
  assert.ok(dropMutation.dueDate.startsWith("2026-11-02T15:30:00"));

  const resized = computeResizeBlockMutation(
    { ...task, startDate: dropMutation.startDate, dueDate: dropMutation.dueDate },
    targetDay,
    90
  );
  assert.ok(resized.startDate.startsWith("2026-11-02T14:30:00"));
  assert.ok(resized.dueDate.startsWith("2026-11-02T16:00:00"));
});

test("findCurrentActiveBlock finds current task", () => {
  const items = [
    { task: { id: "t1" }, effectiveStart: 600, effectiveEnd: 660 }, // 10:00 - 11:00
    { task: { id: "t2" }, effectiveStart: 660, effectiveEnd: 720 }  // 11:00 - 12:00
  ];

  // At 10:30 (630 min), t1 is active
  assert.equal(findCurrentActiveBlock(items, 630)?.task.id, "t1");

  // At 11:15 (675 min), t2 is active
  assert.equal(findCurrentActiveBlock(items, 675)?.task.id, "t2");

  // At 09:00 (540 min), no task active
  assert.equal(findCurrentActiveBlock(items, 540), null);
});
