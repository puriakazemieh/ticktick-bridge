import test from "node:test";
import assert from "node:assert/strict";
import { monthRange, planningBuckets, taskDateRange, taskOccursOnCalendarDay, tasksForCalendarDay, weekRange } from "../src/core/calendar-range.js";

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
  assert.deepEqual(tasksForCalendarDay(tasks, "2026-03-22").map(task => task.id), ["r"]);
});

test("calendar expands date ranges and recurring occurrences without duplicating one-off tasks", () => {
  const ranged = { id: "range", startDate: "2026-10-24", dueDate: "2026-10-27", status: 0 };
  const weekly = { id: "weekly", dueDate: "2026-10-24", status: 0, repeatFlag: "RRULE:FREQ=WEEKLY;BYDAY=SA,MO" };
  const dated = { id: "dated", dueDate: "2026-10-24", status: 0 };
  assert.equal(taskOccursOnCalendarDay(ranged, "2026-10-26"), true);
  assert.equal(taskOccursOnCalendarDay(ranged, "2026-10-28"), false);
  assert.equal(taskOccursOnCalendarDay(weekly, "2026-10-26"), true);
  assert.equal(taskOccursOnCalendarDay(weekly, "2026-10-25"), false);
  assert.equal(taskOccursOnCalendarDay(dated, "2026-10-25"), false);
  assert.deepEqual(taskDateRange(ranged), { start: "2026-10-24", end: "2026-10-27" });
  assert.deepEqual(taskDateRange({ ...weekly, startDate: "2026-10-24", dueDate: "2026-10-27" }), { start: "2026-10-24", end: "2026-10-27" });
});

test("calendar display sorting supports TickTick order, priority, time, and title", () => {
  const tasks = [
    { id: "late", title: "ب", dueDate: "2026-10-24T15:00:00+03:30", priority: 1, sortOrder: 3 },
    { id: "high", title: "ج", dueDate: "2026-10-24T09:00:00+03:30", priority: 5, sortOrder: 2 },
    { id: "first", title: "الف", dueDate: "2026-10-24", priority: 0, sortOrder: 1 },
  ];
  assert.deepEqual(tasksForCalendarDay(tasks, "2026-10-24").map(task => task.id), ["first", "high", "late"]);
  assert.deepEqual(tasksForCalendarDay(tasks, "2026-10-24", "Asia/Tehran", false, "priority").map(task => task.id), ["high", "late", "first"]);
  assert.deepEqual(tasksForCalendarDay(tasks, "2026-10-24", "Asia/Tehran", false, "time").map(task => task.id), ["first", "high", "late"]);
  assert.deepEqual(tasksForCalendarDay(tasks, "2026-10-24", "Asia/Tehran", false, "title").map(task => task.id), ["first", "late", "high"]);
});
