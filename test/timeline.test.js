import test from "node:test";
import assert from "node:assert/strict";
import {
  daysBetween,
  taskTimelineRange,
  computeTimelineBounds,
  generateTimelineGrid,
  packTimelineLanes,
  computeBarGridPlacement,
  getTimelineTaskTone,
  shiftTimelineEndpoints,
  partitionTimelineTasks
} from "../src/core/timeline.js";

test("daysBetween calculates whole day delta accurately", () => {
  assert.equal(daysBetween("2026-10-01", "2026-10-05"), 4);
  assert.equal(daysBetween("2026-10-05", "2026-10-01"), -4);
  assert.equal(daysBetween("2026-10-01", "2026-10-01"), 0);
});

test("taskTimelineRange extracts start and due dates properly", () => {
  const rangeTask = {
    id: "t1",
    title: "Range Task",
    startDate: "2026-10-01T00:00:00+0330",
    dueDate: "2026-10-05T00:00:00+0330",
    isAllDay: true
  };
  const range = taskTimelineRange(rangeTask);
  assert.ok(range);
  assert.equal(range.start, "2026-10-01");
  assert.equal(range.isRange, true);

  const singleDayTask = {
    id: "t2",
    title: "Point Task",
    dueDate: "2026-10-03T10:00:00+0330"
  };
  const single = taskTimelineRange(singleDayTask);
  assert.ok(single);
  assert.equal(single.start, "2026-10-03");
  assert.equal(single.end, "2026-10-03");
  assert.equal(single.isRange, false);

  const unscheduled = { id: "t3", title: "Backlog" };
  assert.equal(taskTimelineRange(unscheduled), null);
});

test("computeTimelineBounds calculates padded boundaries encompassing all tasks", () => {
  const tasks = [
    { id: "1", startDate: "2026-10-05T00:00:00+0330", dueDate: "2026-10-10T00:00:00+0330" },
    { id: "2", dueDate: "2026-10-20T00:00:00+0330" }
  ];
  const bounds = computeTimelineBounds(tasks, { marginDays: 2 });
  assert.equal(bounds.startDate, "2026-10-03");
  assert.equal(bounds.endDate, "2026-10-22");
  assert.equal(bounds.totalDays, 20);
});

test("generateTimelineGrid generates day, week, and month columns", () => {
  const dayGrid = generateTimelineGrid("2026-10-01", "2026-10-07", "day");
  assert.equal(dayGrid.zoom, "day");
  assert.equal(dayGrid.columns.length, 7);
  assert.equal(dayGrid.columns[0].date, "2026-10-01");

  const weekGrid = generateTimelineGrid("2026-10-01", "2026-10-14", "week", 6);
  assert.equal(weekGrid.zoom, "week");
  assert.ok(weekGrid.columns.length >= 2);

  const monthGrid = generateTimelineGrid("2026-10-01", "2026-11-15", "month");
  assert.equal(monthGrid.zoom, "month");
  assert.equal(monthGrid.columns.length, 2);
  assert.equal(monthGrid.columns[0].label, "2026-10");
  assert.equal(monthGrid.columns[1].label, "2026-11");
});

test("packTimelineLanes packs overlapping items into separate lanes without collision", () => {
  const items = [
    { task: { id: "1" }, range: { start: "2026-10-01", end: "2026-10-05" } },
    { task: { id: "2" }, range: { start: "2026-10-03", end: "2026-10-08" } }, // overlaps with 1
    { task: { id: "3" }, range: { start: "2026-10-06", end: "2026-10-10" } }, // can reuse lane 0 after 1
    { task: { id: "4" }, range: { start: "2026-10-07", end: "2026-10-09" } }, // overlaps with 2 & 3 -> lane 2
  ];

  const result = packTimelineLanes(items);
  assert.equal(result.totalLanes, 3);
  const byId = Object.fromEntries(result.assignments.map(a => [a.task.id, a.laneIndex]));
  assert.equal(byId["1"], 0);
  assert.equal(byId["2"], 1);
  assert.equal(byId["3"], 0); // reuses lane 0 because 2026-10-06 > 2026-10-05
  assert.equal(byId["4"], 2);
});

test("computeBarGridPlacement calculates 1-indexed CSS grid column spans", () => {
  const placement = computeBarGridPlacement(
    { start: "2026-10-03", end: "2026-10-06" },
    "2026-10-01",
    10
  );
  assert.equal(placement.colStart, 3);
  assert.equal(placement.colEnd, 7);
  assert.equal(placement.colSpan, 4);
  assert.equal(placement.gridColumn, "3 / span 4");
});

test("getTimelineTaskTone respects project, tag, priority, and uniform color modes", () => {
  const task = {
    id: "t1",
    title: "Test",
    priority: 5,
    projectColor: "#10b981",
    tags: ["feature"],
    projectName: "Work"
  };

  assert.equal(getTimelineTaskTone(task, "uniform"), "var(--interactive-accent)");
  assert.equal(getTimelineTaskTone(task, "priority"), "var(--color-red)");
  assert.equal(getTimelineTaskTone(task, "project"), "#10b981");
  assert.ok(getTimelineTaskTone(task, "tag").startsWith("#"));
});

test("shiftTimelineEndpoints shifts both endpoints when edge is both", () => {
  const task = {
    id: "t1",
    title: "Movable",
    startDate: "2026-10-01T00:00:00+0330",
    dueDate: "2026-10-05T00:00:00+0330",
    isAllDay: true
  };

  const moved = shiftTimelineEndpoints(task, 3, "both");
  assert.equal(moved.startDate, "2026-10-04T00:00:00+0330");
  assert.equal(moved.dueDate, "2026-10-08T00:00:00+0330");
});

test("shiftTimelineEndpoints resizes start endpoint and clamps to due date", () => {
  const task = {
    id: "t1",
    title: "Resizable Start",
    startDate: "2026-10-02T00:00:00+0330",
    dueDate: "2026-10-06T00:00:00+0330",
    isAllDay: true
  };

  // Valid shift
  const moved = shiftTimelineEndpoints(task, -2, "start");
  assert.equal(moved.startDate, "2026-09-30T00:00:00+0330");
  assert.equal(moved.dueDate, "2026-10-06T00:00:00+0330");

  // Attempt to shift start past due date -> should clamp to dueDate
  const clamped = shiftTimelineEndpoints(task, 10, "start");
  assert.equal(clamped.startDate, "2026-10-06T00:00:00+0330");
  assert.equal(clamped.dueDate, "2026-10-06T00:00:00+0330");
});

test("shiftTimelineEndpoints resizes due endpoint and clamps to start date", () => {
  const task = {
    id: "t1",
    title: "Resizable Due",
    startDate: "2026-10-02T00:00:00+0330",
    dueDate: "2026-10-06T00:00:00+0330",
    isAllDay: true
  };

  // Valid shift
  const moved = shiftTimelineEndpoints(task, 2, "due");
  assert.equal(moved.startDate, "2026-10-02T00:00:00+0330");
  assert.equal(moved.dueDate, "2026-10-08T00:00:00+0330");

  // Attempt to shift due earlier than start date -> should clamp to startDate
  const clamped = shiftTimelineEndpoints(task, -10, "due");
  assert.equal(clamped.startDate, "2026-10-02T00:00:00+0330");
  assert.equal(clamped.dueDate, "2026-10-02T00:00:00+0330");
});

test("partitionTimelineTasks separates range, point, and backlog tasks", () => {
  const tasks = [
    { id: "1", startDate: "2026-10-01T00:00:00+0330", dueDate: "2026-10-05T00:00:00+0330" },
    { id: "2", dueDate: "2026-10-04T00:00:00+0330" },
    { id: "3", title: "Unscheduled" },
    { id: "4", status: 2, dueDate: "2026-10-02T00:00:00+0330" } // completed
  ];

  const partitioned = partitionTimelineTasks(tasks, {}, { showCompleted: false });
  assert.equal(partitioned.rangeTasks.length, 1);
  assert.equal(partitioned.rangeTasks[0].task.id, "1");
  assert.equal(partitioned.pointTasks.length, 1);
  assert.equal(partitioned.pointTasks[0].task.id, "2");
  assert.equal(partitioned.backlogTasks.length, 1);
  assert.equal(partitioned.backlogTasks[0].id, "3");
});
