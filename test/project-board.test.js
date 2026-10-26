import test from "node:test";
import assert from "node:assert/strict";
import { ALL_BOARD_VIEW_ID, boardColumns, INBOX_BOARD_VIEW_ID, normalizeProjectData, RECURRING_BOARD_VIEW_ID, sidebarTree, virtualBoardData, virtualBoardEntries } from "../src/core/project-board.js";
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
test("virtual board entries expose recurring tasks and cached tags by project", () => {
  const tasks = [
    { id: "1", projectId: "p1", projectName: "کار", repeatFlag: "RRULE:FREQ=DAILY", tags: ["فوری", "خانه"], status: 0 },
    { id: "2", projectId: "p2", projectName: "شخصی", tags: ["فوری"], status: 0 },
    { id: "3", projectId: "p1", tags: ["خانه"], status: 2 },
  ];
  const entries = virtualBoardEntries(tasks);
  assert.equal(entries.recurring.count, 1);
  assert.deepEqual(entries.tags, [{ id: "ticktick:view:tag:%D8%AE%D8%A7%D9%86%D9%87", name: "خانه", count: 1 }, { id: "ticktick:view:tag:%D9%81%D9%88%D8%B1%DB%8C", name: "فوری", count: 2 }]);
  const board = virtualBoardData(RECURRING_BOARD_VIEW_ID, tasks, [{ id: "p1", name: "کار" }, { id: "p2", name: "شخصی" }]);
  assert.equal(board.project.name, "تکرارشونده‌ها");
  assert.deepEqual(board.columns.map(column => column.name), ["کار"]);
  assert.equal(board.tasks[0].columnId, "p1");
});
test("all-list and inbox views are local virtual boards and keep pinned cards first", () => {
  const tasks = [
    { id: "inbox", title: "ورودی", projectId: "inbox", status: 0 },
    { id: "pinned", title: "مهم", projectId: "p", status: 0, pinned: true },
    { id: "note", title: "یادداشت", projectId: "p", status: 0, kind: "NOTE" },
  ];
  const entries = virtualBoardEntries(tasks);
  assert.equal(entries.all.count, 3); assert.equal(entries.inbox.count, 1);
  assert.equal(virtualBoardData(INBOX_BOARD_VIEW_ID, tasks, []).project.name, "ورودی");
  const all = virtualBoardData(ALL_BOARD_VIEW_ID, tasks, [{ id: "p", name: "کار" }]);
  assert.equal(all.project.name, "همهٔ لیست‌ها");
  assert.equal(boardColumns(normalizeProjectData({ columns: [{ id: "c", name: "کار" }], tasks: [{ ...tasks[1], columnId: "c" }, { ...tasks[2], columnId: "c" }] }))[0].groups[0].name, "Pinned");
});
test("inbox view recognises TickTick's account-specific inbox project id", () => {
  const tasks = [{ id: "i", projectId: "inbox115250281", isInbox: true, status: 0, title: "یادداشت" }];
  assert.equal(virtualBoardEntries(tasks).inbox.count, 1);
  assert.equal(virtualBoardData(INBOX_BOARD_VIEW_ID, tasks, []).tasks[0].projectId, "inbox115250281");
});
