import test from "node:test";
import assert from "node:assert/strict";
import { monthRange, planningBuckets, tasksForCalendarDay, weekRange } from "../src/core/calendar-range.js";

test("calendar ranges begin on configurable weekday and month always has 42 cells", () => {
  assert.deepEqual(weekRange("2026-03-21", 1), ["2026-03-16", "2026-03-17", "2026-03-18", "2026-03-19", "2026-03-20", "2026-03-21", "2026-03-22"]);
  const month = monthRange("2026-03-21", 1);
  assert.equal(month.length, 42); assert.equal(month[0], "2026-02-23");
});
test("calendar separates all-day, timed, overdue, recurring, and completed tasks", () => {
  const tasks = [
    { id: "a", title: "all", dueDate: "2026-03-21", status: 0, isAllDay: true },
    { id: "t", title: "time", dueDate: "2026-03-21T11:30:00+03:30", status: 0, isAllDay: false },
    { id: "o", title: "late", dueDate: "2026-03-20", status: 0 },
    { id: "r", title: "repeat", dueDate: "2026-03-21", status: 0, repeatFlag: "RRULE:FREQ=DAILY" },
    { id: "c", title: "done", dueDate: "2026-03-21", status: 2 },
  ];
  const buckets = planningBuckets(tasks, "2026-03-21");
  assert.equal(buckets.allDay.length, 2); assert.equal(buckets.timed[0].id, "t"); assert.equal(buckets.overdue[0].id, "o"); assert.equal(buckets.recurring[0].id, "r");
  assert.deepEqual(tasksForCalendarDay(tasks, "2026-03-21").map(task => task.id), ["a", "r", "t"]);
  assert.deepEqual(tasksForCalendarDay(tasks, "2026-03-22").map(task => task.id), []);
});
