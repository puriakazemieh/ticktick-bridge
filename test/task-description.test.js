import test from "node:test";
import assert from "node:assert/strict";
import { mergeTaskDetails, reconcileOpenTasks, taskDescription } from "../src/core/task-description.js";

test("reads note text from every supported TickTick field", () => {
  assert.equal(taskDescription({ description: "یادداشت کامل" }), "یادداشت کامل");
  assert.equal(taskDescription({ content: "", note: "متن Note" }), "متن Note");
});

test("does not erase cached Note text with an empty project-task read", () => {
  const task = mergeTaskDetails({ id: "n1", content: "متن کامل" }, { id: "n1", content: "", title: "Note" });
  assert.equal(taskDescription(task), "متن کامل");
});

test("clears stale structural hierarchy and column when fresh task omits them", () => {
  const cached = { id: "t1", title: "Task 1", parentId: "p1", columnId: "col1", childIds: ["c1"], completedTime: "2026-01-01" };
  const fresh = { id: "t1", title: "Task 1", status: 0 };
  const merged = mergeTaskDetails(cached, fresh);
  assert.equal(merged.parentId, undefined);
  assert.equal(merged.columnId, undefined);
  assert.equal(merged.childIds, undefined);
  assert.equal(merged.completedTime, undefined);
});

test("full task snapshot removes completed and deleted cached tasks while retaining note details", () => {
  const cached = [
    { id: "done", status: 0, title: "Old completed task" },
    { id: "deleted", status: 0, title: "Old deleted task" },
    { id: "note", status: 0, title: "Note", content: "Full text" },
  ];
  const fresh = [
    { id: "done", status: 2, title: "Old completed task" },
    { id: "note", status: 0, title: "Note", content: "" },
    { id: "new", status: 0, title: "New task" },
  ];
  assert.deepEqual(reconcileOpenTasks(cached, fresh).map(task => task.id), ["note", "new"]);
  assert.equal(reconcileOpenTasks(cached, fresh)[0].content, "Full text");
  assert.deepEqual(reconcileOpenTasks(cached, []), []);
  assert.deepEqual(reconcileOpenTasks(cached, null).map(task => task.id), ["done", "deleted", "note"]);
});
