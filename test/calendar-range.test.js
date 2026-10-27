import test from "node:test";
import assert from "node:assert/strict";
import { isSamePersianMonth, monthRange, persianMonthRange, planningBuckets, recurringTaskOccursOnDay, shiftPersianMonth, taskDateRange, taskOccursOnCalendarDay, tasksForCalendarDay, weekRange } from "../src/core/calendar-range.js";

test("calendar ranges begin on configurable weekday and month always has 42 cells", () => {
  assert.deepEqual(weekRange("2026-03-21", 1), ["2026-03-16", "2026-03-17", "2026-03-18", "2026-03-19", "2026-03-20", "2026-03-21", "2026-03-22"]);
  const month = monthRange("2026-03-21", 1);
  assert.equal(month.length, 42); assert.equal(month[0], "2026-02-23");
});
test("Persian month range starts at the first Jalali day and shifts by Jalali months", () => {
  const month = persianMonthRange("2026-10-24", 6);
  assert.equal(isSamePersianMonth("2026-10-24", month.find(day => new Intl.DateTimeFormat("en-US-u-ca-persian", { timeZone: "UTC", day: "numeric" }).format(new Date(`${day}T12:00:00Z`)) === "1")), true);
  assert.equal(isSamePersianMonth("2026-10-24", shiftPersianMonth("2026-10-24", 1)), false);
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

test("calendar shows a recurring task only on TickTick's next unfinished due day", () => {
  const recurring = {
    id: "habit-like-task",
    status: 0,
    // Saturday and Sunday occurrences were completed; TickTick advanced this
    // active task to Monday even though its repeat rule also matches them.
    dueDate: "2026-10-26",
    repeatFlag: "RRULE:FREQ=WEEKLY;WKST=SA;BYDAY=SA,SU,MO,TU,WE",
  };
  assert.equal(taskOccursOnCalendarDay(recurring, "2026-10-24"), false);
  assert.equal(taskOccursOnCalendarDay(recurring, "2026-10-25"), false);
  assert.equal(taskOccursOnCalendarDay(recurring, "2026-10-26"), true);
  assert.equal(taskOccursOnCalendarDay(recurring, "2026-10-27"), false);
});
test("optional recurring expansion shows only future rule occurrences", () => {
  const recurring = { id: "repeat", status: 0, dueDate: "2026-10-26", repeatFlag: "RRULE:FREQ=WEEKLY;BYDAY=MO,WE" };
  assert.equal(recurringTaskOccursOnDay(recurring, "2026-10-25"), false);
  assert.equal(recurringTaskOccursOnDay(recurring, "2026-10-26"), true);
  assert.equal(recurringTaskOccursOnDay(recurring, "2026-10-28"), true);
});

test("calendar expands date ranges but keeps recurring cards on their next due day", () => {
  const ranged = { id: "range", startDate: "2026-10-24", dueDate: "2026-10-27", status: 0 };
  const weekly = { id: "weekly", dueDate: "2026-10-24", status: 0, repeatFlag: "RRULE:FREQ=WEEKLY;BYDAY=SA,MO" };
  const dated = { id: "dated", dueDate: "2026-10-24", status: 0 };
  assert.equal(taskOccursOnCalendarDay(ranged, "2026-10-26"), true);
  assert.equal(taskOccursOnCalendarDay(ranged, "2026-10-28"), false);
  assert.equal(taskOccursOnCalendarDay(weekly, "2026-10-26"), false);
  assert.equal(taskOccursOnCalendarDay(weekly, "2026-10-25"), false);
  assert.equal(taskOccursOnCalendarDay(dated, "2026-10-25"), false);
  assert.deepEqual(taskDateRange(ranged), { start: "2026-10-24", end: "2026-10-27" });
  assert.deepEqual(taskDateRange({ ...weekly, startDate: "2026-10-24", dueDate: "2026-10-27" }), { start: "2026-10-24", end: "2026-10-27" });
  // TickTick can advance a recurring range's due date while retaining an old
  // start date. An exact multiple of a week must still yield one visible bar.
  assert.deepEqual(taskDateRange({ id: "weekly-range", startDate: "2026-10-17", dueDate: "2026-10-31", status: 0, repeatFlag: "RRULE:FREQ=WEEKLY" }), { start: "2026-10-25", end: "2026-10-31" });
  // TickTick's all-day Tehran range is an exclusive end boundary. Its
  // Saturday–Friday UI range arrives as midnight Saturday through midnight
  // the following Saturday, and must not begin one day late in Obsidian.
  assert.deepEqual(taskDateRange({
    id: "persian-weekly-range",
    startDate: "2026-10-30T20:30:00.000+0000",
    dueDate: "2026-11-06T20:30:00.000+0000",
    status: 0,
    isAllDay: true,
    repeatFlag: "RRULE:FREQ=WEEKLY;WKST=SA",
  }), { start: "2026-10-31", end: "2026-11-06" });
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
