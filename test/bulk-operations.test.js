import test from "node:test";
import assert from "node:assert/strict";
import {
  computeBulkTaskMutation,
  createBulkOperationManifest,
  runBoundedQueue,
  formatBulkOutcomeReport
} from "../src/core/bulk-operations.js";

test("computeBulkTaskMutation computes project change payload", () => {
  const task = { id: "t1", projectId: "p1", title: "Task 1" };
  const mutation = computeBulkTaskMutation(task, "project", { projectId: "p2" });
  assert.deepEqual(mutation, {
    id: "t1",
    projectId: "p2",
    columnId: null
  });
});

test("computeBulkTaskMutation computes tag addition and removal without duplicates", () => {
  const task = { id: "t1", projectId: "p1", tags: ["work"] };
  
  const add = computeBulkTaskMutation(task, "tag-add", { tag: "urgent" });
  assert.deepEqual(add.tags, ["work", "urgent"]);

  // Duplicate add is a no-op (returns null)
  const dup = computeBulkTaskMutation(task, "tag-add", { tag: "work" });
  assert.equal(dup, null);

  // Remove tag
  const rem = computeBulkTaskMutation(task, "tag-remove", { tag: "work" });
  assert.deepEqual(rem.tags, []);
});

test("computeBulkTaskMutation computes priority changes", () => {
  const task = { id: "t1", projectId: "p1", priority: 1 };
  const mutation = computeBulkTaskMutation(task, "priority", { priority: 5 });
  assert.equal(mutation.priority, 5);
});

test("computeBulkTaskMutation computes date scheduling and date clearing", () => {
  const task = { id: "t1", projectId: "p1", dueDate: "2026-10-01T00:00:00+0330" };

  // Schedule date
  const scheduled = computeBulkTaskMutation(task, "schedule-date", {
    targetDay: "2026-10-15"
  });
  assert.equal(scheduled.dueDate, "2026-10-15T00:00:00+0330");
  assert.equal(scheduled.isAllDay, true);

  // Clear date
  const cleared = computeBulkTaskMutation(task, "clear-date");
  assert.equal(cleared.dueDate, null);
  assert.equal(cleared.startDate, null);
});

test("computeBulkTaskMutation computes completion, reopen, and delete", () => {
  const task = { id: "t1", projectId: "p1", status: 0 };

  const comp = computeBulkTaskMutation(task, "complete");
  assert.equal(comp.status, 2);

  const reop = computeBulkTaskMutation({ ...task, status: 2 }, "reopen");
  assert.equal(reop.status, 0);

  const del = computeBulkTaskMutation(task, "delete");
  assert.equal(del.isDelete, true);
});

test("createBulkOperationManifest excludes sensitive fields and accurately captures before states", () => {
  const tasks = [
    { id: "1", title: "Task 1", priority: 1, tags: ["a"] },
    { id: "2", title: "Task 2", priority: 3, tags: ["b"] }
  ];
  const manifest = createBulkOperationManifest(tasks, "priority", {
    priority: 5,
    apiToken: "super-secret-token",
    sessionCookie: "secret-cookie"
  });

  assert.equal(manifest.totalCount, 2);
  assert.equal(manifest.operationType, "priority");
  assert.equal(manifest.parameters.priority, 5);
  // Ensure secrets were stripped
  assert.equal(manifest.parameters.apiToken, undefined);
  assert.equal(manifest.parameters.sessionCookie, undefined);
  assert.equal(manifest.targets[0].before.priority, 1);
  assert.equal(manifest.targets[1].before.priority, 3);
});

test("runBoundedQueue executes tasks with bounded concurrency and handles partial failures", async () => {
  const items = [
    { id: "1", title: "Success 1" },
    { id: "2", title: "Fail 2" },
    { id: "3", title: "Success 3" }
  ];

  let inFlight = 0;
  let maxInFlight = 0;

  const results = await runBoundedQueue(items, async (item) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise(r => setTimeout(r, 10));
    inFlight--;
    if (item.id === "2") {
      throw new Error("Simulated API failure on task 2");
    }
    return { updated: true };
  }, 2);

  assert.equal(results.length, 3);
  assert.equal(results[0].success, true);
  assert.equal(results[1].success, false);
  assert.equal(results[1].error, "Simulated API failure on task 2");
  assert.equal(results[2].success, true);
  assert.ok(maxInFlight <= 2); // concurrency strictly bounded
});

test("formatBulkOutcomeReport compiles clean summary and per-item results", () => {
  const manifest = {
    manifestId: "m1",
    operationType: "delete",
    parameters: {},
    timestamp: "2026-10-01T10:00:00Z",
    totalCount: 2
  };
  const queueResults = [
    { success: true, item: { id: "1", title: "Task 1", before: { status: 0 } }, result: { deleted: true } },
    { success: false, item: { id: "2", title: "Task 2", before: { status: 0 } }, error: "Forbidden" }
  ];

  const report = formatBulkOutcomeReport(manifest, queueResults);
  assert.equal(report.manifestId, "m1");
  assert.equal(report.total, 2);
  assert.equal(report.succeeded, 1);
  assert.equal(report.failed, 1);
  assert.equal(report.items[0].id, "1");
  assert.equal(report.items[0].success, true);
  assert.equal(report.items[1].id, "2");
  assert.equal(report.items[1].success, false);
  assert.equal(report.items[1].error, "Forbidden");
});
