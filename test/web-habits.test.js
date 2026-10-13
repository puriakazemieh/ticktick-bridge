import test from "node:test";
import assert from "node:assert/strict";
import { normalizeWebSessionCookie, parseWebHabitCheckins } from "../src/core/ticktick-web-habits.js";

test("parses current habit check-ins from the TickTick web response", () => {
  const checkins = parseWebHabitCheckins({ checkins: { habit_1: [{ checkinStamp: 20261004, value: 2, goal: 2, status: 2 }] } });
  assert.deepEqual(checkins.get("habit_1"), [{ stamp: 20261004, value: 2, goal: 2, status: 2 }]);
});

test("accepts a copied Cookie header without keeping its header label", () => {
  assert.equal(normalizeWebSessionCookie("Cookie: t=session-value; other=value"), "t=session-value; other=value");
});
