import test from "node:test";
import assert from "node:assert/strict";
import { formatPersianDate } from "../src/core/persian-date.js";

test("formats TickTick dates using the Persian calendar", () => {
  assert.match(formatPersianDate("2026-10-24T00:00:00+03:30"), /۱۴۰۵/);
  assert.equal(formatPersianDate(null), "بدون تاریخ");
});
