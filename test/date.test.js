import test from "node:test";
import assert from "node:assert/strict";
import { isHabitScheduledForDay, isScheduledForDay, jalaliDateKeyToGregorian, toDateKey, todayInZone } from "../src/core/date.js";

test("includes an active task inside its TickTick date range", () => {
  assert.equal(isScheduledForDay({ status: 0, startDate: "2026-10-03T00:00:00+0330", dueDate: "2026-10-05T00:00:00+0330" }, "2026-10-04"), true);
});

test("keeps overdue tasks visible and excludes future tasks", () => {
  assert.equal(isScheduledForDay({ status: 0, dueDate: "2026-10-02T00:00:00+0330" }, "2026-10-03"), true);
  assert.equal(isScheduledForDay({ status: 0, dueDate: "2026-10-04T00:00:00+0330" }, "2026-10-03"), false);
});

test("uses the configured timezone for today", () => {
  assert.equal(todayInZone("Asia/Tehran", new Date("2026-10-02T21:30:00.000Z")), "2026-10-03");
});

test("converts TickTick's UTC all-day timestamps to the Tehran calendar day", () => {
  assert.equal(toDateKey("2026-10-02T20:30:00.000+0000", "Asia/Tehran"), "2026-10-03");
});

test("only shows weekly habits on their configured weekdays", () => {
  assert.equal(isHabitScheduledForDay({ status: 0, repeatRule: "RRULE:FREQ=WEEKLY;BYDAY=SA,MO" }, "2026-10-03"), true);
  assert.equal(isHabitScheduledForDay({ status: 0, repeatRule: "RRULE:FREQ=WEEKLY;BYDAY=SA,MO" }, "2026-10-04"), false);
});

test("maps the vault's Jalali daily-note date to TickTick's Gregorian day", () => {
  assert.equal(jalaliDateKeyToGregorian("1405-07-11"), "2026-10-03");
  assert.equal(jalaliDateKeyToGregorian("1405-07-12"), "2026-10-04");
});
