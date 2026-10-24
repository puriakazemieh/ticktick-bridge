import test from "node:test";
import assert from "node:assert/strict";
import { mergeTaskDetails, taskDescription } from "../src/core/task-description.js";

test("reads note text from every supported TickTick field", () => {
  assert.equal(taskDescription({ description: "یادداشت کامل" }), "یادداشت کامل");
  assert.equal(taskDescription({ content: "", note: "متن Note" }), "متن Note");
});

test("does not erase cached Note text with an empty project-task read", () => {
  const task = mergeTaskDetails({ id: "n1", content: "متن کامل" }, { id: "n1", content: "", title: "Note" });
  assert.equal(taskDescription(task), "متن کامل");
});
