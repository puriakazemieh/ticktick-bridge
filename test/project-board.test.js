import test from "node:test";
import assert from "node:assert/strict";
import { boardColumns, normalizeProjectData, sidebarTree } from "../src/core/project-board.js";
test("board normalizes flat data and synthesizes a display-only Tasks column", () => {
  const data = normalizeProjectData({ tasks: [{ id: "1", title: "کار فارسی", priority: 5, status: 0 }] }, { id: "p", name: "شخصی", color: "#f00" });
  const columns = boardColumns(data); assert.equal(columns[0].name, "Tasks"); assert.equal(columns[0].groups[0].name, "High"); assert.equal(data.tasks[0].projectName, "شخصی");
});
test("sidebar uses supported group fields but remains flat without them", () => {
  const tree = sidebarTree([{ id: "a", name: "کار", folderName: "پوشه" }, { id: "b", name: "شخصی" }], [{ projectId: "a", status: 0 }]);
  assert.equal(tree.find(group => group.name === "").projects[0].name, "شخصی"); assert.equal(tree.find(group => group.name === "پوشه").projects[0].openCount, 1);
});
test("sidebar follows the requested TickTick list and folder order", () => {
  const tree = sidebarTree([
    { id: "archive", name: "آرشیو", folderName: "لیست ها" }, { id: "store", name: "فروشگاه", folderName: "کار" },
    { id: "personal", name: "شخصی" }, { id: "planning", name: "برنامه ریزی", folderName: "کار" },
    { id: "action", name: "اقدام" }, { id: "someday", name: "شاید یه روزی", folderName: "لیست ها" },
    { id: "ticktick", name: "توسن تکو", folderName: "کار" }, { id: "finance", name: "مدیریت مالی", folderName: "کار" },
  ]);
  assert.deepEqual(tree.map(group => group.name), ["", "کار", "لیست ها"]);
  assert.deepEqual(tree.flatMap(group => group.projects.map(project => project.name)), ["اقدام", "شخصی", "برنامه ریزی", "مدیریت مالی", "فروشگاه", "توسن تکو", "شاید یه روزی", "آرشیو"]);
});
test("board honors remote columns, missing column IDs, and completed visibility", () => {
  const data = normalizeProjectData({ project: { id: "p" }, columns: [{ id: "c", name: "انجام" }], tasks: [{ id: "1", columnId: "c", priority: 3, status: 0 }, { id: "2", columnId: "c", status: 2 }] });
  assert.equal(boardColumns(data)[0].count, 1); assert.equal(boardColumns(data, true)[0].groups.at(-1).name, "Completed");
});
