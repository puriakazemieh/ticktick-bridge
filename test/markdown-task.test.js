import test from "node:test";
import assert from "node:assert/strict";
import { attachTaskBinding, lineLocator, locateLine, parseTaskBinding, serializeTaskBinding } from "../src/core/task-binding.js";
import { parseMarkdownTask, scanMarkdownTasks } from "../src/core/markdown-task.js";

test("modern bindings preserve Persian text, tokens, and CRLF", () => {
  const line = "  - [ ] برنامه‌ریزی 📅 2026-10-25 #ticktick 🟣\r\n";
  const bound = attachTaskBinding(line, { id: "task_1", projectId: "project_1" });
  assert.ok(bound.endsWith("\r\n"));
  assert.equal(parseTaskBinding(bound).projectId, "project_1");
  assert.match(bound, /برنامه‌ریزی/);
  assert.match(bound, /🟣/);
});
test("legacy marker remains readable", () => {
  const task = parseMarkdownTask("- [x] کار قدیمی #ticktick %%[ticktick_id:: old-1]%%", "a.md");
  assert.equal(task.id, "old-1"); assert.equal(task.binding.legacy, true); assert.equal(task.completed, true);
});
test("scan keeps unbound tagged tasks and line numbers", () => {
  const tasks = scanMarkdownTasks("- [ ] تکراری #ticktick\n- [ ] تکراری #ticktick", "a.md");
  assert.equal(tasks.length, 2); assert.equal(tasks[1].lineNumber, 1); assert.equal(tasks[0].id, null);
});
test("line locator does not guess between duplicate lines", () => {
  const lines = ["x", "- [ ] same", "y", "- [ ] same", "z"];
  assert.equal(locateLine(lines, lineLocator(lines, 1)), 1);
  assert.equal(locateLine(["- [ ] same", "- [ ] same"], { line: 9, before: "", value: "- [ ] same", after: "" }), null);
  assert.match(serializeTaskBinding({ id: "a", projectId: "b" }), /v=1/);
});
