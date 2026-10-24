import test from "node:test";
import assert from "node:assert/strict";
import { diffTask } from "../src/core/task-diff.js";

const base = { title: "A", completed: false, projectId: "p", priority: 0, tags: [], startDate: null, dueDate: null, isAllDay: true, repeatFlag: "", description: "" };
test("diff distinguishes local-only, remote-only, equality, and conflicts", () => {
  const local = { ...base, title: "Local" };
  const remote = { ...base, priority: 3 };
  const result = diffTask(base, local, remote);
  assert.deepEqual(result.localOnly, ["title"]); assert.deepEqual(result.remoteOnly, ["priority"]); assert.ok(result.equal.includes("projectId")); assert.equal(result.conflicts.length, 0);
  const conflict = diffTask(base, local, { ...base, title: "Remote" });
  assert.equal(conflict.conflicts[0].field, "title");
});
test("missing remote is quarantined and recurring completion stays an occurrence", () => {
  assert.equal(diffTask(base, base, null).quarantine, "remote-missing");
  const result = diffTask(base, base, { ...base, status: 1, repeatFlag: "RRULE:FREQ=DAILY" });
  assert.equal(result.recurringRemoteCompletion, true);
});
