import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_BOARD_VIEW_ID,
  COMPLETED_BOARD_VIEW_ID,
  HIGH_PRIORITY_BOARD_VIEW_ID,
  INBOX_BOARD_VIEW_ID,
  OVERDUE_BOARD_VIEW_ID,
  RECURRING_BOARD_VIEW_ID,
  TODAY_BOARD_VIEW_ID,
  UNSCHEDULED_BOARD_VIEW_ID,
  UPCOMING_BOARD_VIEW_ID,
  boardColumns,
  normalizeProjectData,
  sidebarTree,
  virtualBoardData,
  virtualBoardEntries,
} from "../src/core/project-board.js";

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

test("virtual board exposes deterministic cache selectors for all smart views", () => {
  const tasks = [
    { id: "t1", title: "تسک امروز", dueDate: "2026-11-02", priority: 5, status: 0, projectId: "p1" },
    { id: "t2", title: "تسک فردا", dueDate: "2026-11-03", priority: 3, status: 0, projectId: "p1" },
    { id: "t3", title: "تسک عقب‌افتاده", dueDate: "2026-11-01", priority: 1, status: 0, projectId: "p2" },
    { id: "t4", title: "تسک بدون تاریخ", priority: 0, status: 0, projectId: "p2" },
    { id: "t5", title: "تسک تکراری", repeatFlag: "RRULE:FREQ=DAILY", status: 0, projectId: "p1" },
    { id: "t6", title: "تسک اینباکس", isInbox: true, status: 0 },
    { id: "t7", title: "تسک تکمیل شده", dueDate: "2026-11-02", status: 2, projectId: "p1" },
  ];
  const options = { todayKey: "2026-11-02", timeZone: "Asia/Tehran" };
  const entries = virtualBoardEntries(tasks, options);

  assert.equal(entries.today.count, 1);
  assert.equal(entries.upcoming.count, 1);
  assert.equal(entries.overdue.count, 1);
  assert.equal(entries.unscheduled.count, 3); // t4, t5, t6 have no dates
  assert.equal(entries.recurring.count, 1);
  assert.equal(entries.inbox.count, 1);
  assert.equal(entries.highPriority.count, 1);
  assert.equal(entries.completed.count, 1);

  // Check smartViews list contains all 8 expected entries in order
  assert.deepEqual(entries.smartViews.map(view => view.key), [
    "recurring", "unscheduled", "today", "upcoming", "overdue", "inbox", "highPriority", "completed"
  ]);

  // Today view data
  const todayBoard = virtualBoardData(TODAY_BOARD_VIEW_ID, tasks, [{ id: "p1", name: "پروژه ۱" }], options);
  assert.equal(todayBoard.project.name, "امروز");
  assert.equal(todayBoard.tasks.length, 1);
  assert.equal(todayBoard.tasks[0].id, "t1");

  // Overdue view data
  const overdueBoard = virtualBoardData(OVERDUE_BOARD_VIEW_ID, tasks, [{ id: "p2", name: "پروژه ۲" }], options);
  assert.equal(overdueBoard.project.name, "عقب‌افتاده");
  assert.equal(overdueBoard.tasks.length, 1);
  assert.equal(overdueBoard.tasks[0].id, "t3");

  // High Priority view data
  const hpBoard = virtualBoardData(HIGH_PRIORITY_BOARD_VIEW_ID, tasks, [], options);
  assert.equal(hpBoard.project.name, "اولویت بالا");
  assert.equal(hpBoard.tasks.length, 1);
  assert.equal(hpBoard.tasks[0].id, "t1");

  // Completed view data and column rendering
  const completedBoard = virtualBoardData(COMPLETED_BOARD_VIEW_ID, tasks, [{ id: "p1", name: "پروژه ۱" }], options);
  assert.equal(completedBoard.project.name, "تکمیل‌شده‌ها");
  assert.equal(completedBoard.tasks.length, 1);
  assert.equal(completedBoard.tasks[0].id, "t7");
  const completedCols = boardColumns(completedBoard);
  assert.equal(completedCols[0].count, 1);
});

test("virtual board supports dynamic grouping by project, priority, date, and tag", () => {
  const tasks = [
    { id: "1", title: "تسک ۱", priority: 5, dueDate: "2026-11-02", tags: ["فوری"], projectId: "p1", projectName: "کار", status: 0 },
    { id: "2", title: "تسک ۲", priority: 3, dueDate: "2026-11-03", tags: ["خانه"], projectId: "p2", projectName: "شخصی", status: 0 },
    { id: "3", title: "تسک ۳", priority: 0, tags: [], projectId: "p1", projectName: "کار", status: 0 },
  ];
  const projects = [{ id: "p1", name: "کار" }, { id: "p2", name: "شخصی" }];
  const baseOptions = { todayKey: "2026-11-02", timeZone: "Asia/Tehran" };

  // 1. Group by Priority
  const priorityBoard = virtualBoardData(ALL_BOARD_VIEW_ID, tasks, projects, { ...baseOptions, grouping: "priority" });
  assert.equal(priorityBoard.columns.length, 4);
  assert.deepEqual(priorityBoard.columns.map(c => c.name), ["اولویت بالا", "اولویت متوسط", "اولویت پایین", "بدون اولویت"]);
  const pCols = boardColumns(priorityBoard);
  assert.equal(pCols.find(c => c.id === "p-high").count, 1);
  assert.equal(pCols.find(c => c.id === "p-medium").count, 1);
  assert.equal(pCols.find(c => c.id === "p-none").count, 1);

  // 2. Group by Date
  const dateBoard = virtualBoardData(ALL_BOARD_VIEW_ID, tasks, projects, { ...baseOptions, grouping: "date" });
  assert.ok(dateBoard.columns.some(c => c.name === "امروز"));
  assert.ok(dateBoard.columns.some(c => c.name === "فردا"));
  assert.ok(dateBoard.columns.some(c => c.name === "بدون تاریخ"));

  // 3. Group by Tag
  const tagBoard = virtualBoardData(ALL_BOARD_VIEW_ID, tasks, projects, { ...baseOptions, grouping: "tag" });
  assert.ok(tagBoard.columns.some(c => c.name === "#فوری"));
  assert.ok(tagBoard.columns.some(c => c.name === "#خانه"));
  assert.ok(tagBoard.columns.some(c => c.name === "بدون برچسب"));

  // 4. Group by Project (default)
  const projBoard = virtualBoardData(ALL_BOARD_VIEW_ID, tasks, projects, { ...baseOptions, grouping: "project" });
  assert.deepEqual(projBoard.columns.map(c => c.name), ["کار", "شخصی"]);
});

test("tag virtual board groups by project and exposes target project ids for task creation", () => {
  const tasks = [
    { id: "101", title: "تسک اسپرینت فروشگاه", tags: ["اسپرینت", "راسته"], projectId: "proj_store", projectName: "فروشگاه", status: 0 },
    { id: "102", title: "تسک اسپرینت دیگر", tags: ["اسپرینت"], projectId: "proj_store", projectName: "فروشگاه", status: 0 },
  ];
  const projects = [
    { id: "proj_store", name: "فروشگاه" },
    { id: "proj_finance", name: "مدیریت مالی" },
  ];
  const tagViewId = `ticktick:view:tag:${encodeURIComponent("اسپرینت")}`;
  const tagBoard = virtualBoardData(tagViewId, tasks, projects);

  assert.equal(tagBoard.project.name, "#اسپرینت");
  assert.equal(tagBoard.project.virtual, true);
  assert.equal(tagBoard.columns.length, 1);
  assert.equal(tagBoard.columns[0].id, "proj_store");
  assert.equal(tagBoard.columns[0].name, "فروشگاه");
  assert.equal(tagBoard.columns[0].synthetic, true);

  const columns = boardColumns(tagBoard);
  assert.equal(columns.length, 1);
  assert.equal(columns[0].id, "proj_store");
  assert.equal(columns[0].count, 2);
});

test("smart view Today groups by project and exposes target columns correctly", () => {
  const tasks = [
    { id: "t1", title: "تسک اقدام", dueDate: "2026-11-15", projectId: "proj_action", projectName: "اقدام", status: 0 },
    { id: "t2", title: "تسک برنامه ریزی", dueDate: "2026-11-15", projectId: "proj_plan", projectName: "برنامه ریزی", status: 0 },
  ];
  const projects = [
    { id: "proj_action", name: "اقدام" },
    { id: "proj_plan", name: "برنامه ریزی" },
  ];
  const board = virtualBoardData(TODAY_BOARD_VIEW_ID, tasks, projects, { todayKey: "2026-11-15", timeZone: "Asia/Tehran" });

  assert.equal(board.project.name, "امروز");
  assert.equal(board.project.virtual, true);
  assert.equal(board.columns.length, 2);
  assert.deepEqual(board.columns.map(c => c.name), ["اقدام", "برنامه ریزی"]);
  assert.deepEqual(board.columns.map(c => c.id), ["proj_action", "proj_plan"]);

  const columns = boardColumns(board);
  assert.equal(columns.length, 2);
  assert.equal(columns[0].name, "اقدام");
  assert.equal(columns[0].count, 1);
  assert.equal(columns[1].name, "برنامه ریزی");
  assert.equal(columns[1].count, 1);
});
