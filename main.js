"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/core/project-board.js
var project_board_exports = {};
__export(project_board_exports, {
  ALL_BOARD_VIEW_ID: () => ALL_BOARD_VIEW_ID,
  INBOX_BOARD_VIEW_ID: () => INBOX_BOARD_VIEW_ID,
  RECURRING_BOARD_VIEW_ID: () => RECURRING_BOARD_VIEW_ID,
  boardColumns: () => boardColumns,
  normalizeProjectData: () => normalizeProjectData,
  sidebarTree: () => sidebarTree,
  virtualBoardData: () => virtualBoardData,
  virtualBoardEntries: () => virtualBoardEntries
});
function normalizeProjectData(document = {}, fallbackProject = {}) {
  const project = { ...fallbackProject, ...document.project ?? {}, id: document.project?.id ?? fallbackProject.id ?? document.projectId, name: document.project?.name ?? fallbackProject.name ?? "\u0628\u062F\u0648\u0646 \u0646\u0627\u0645" };
  const columns = (document.columns ?? []).map((column, index) => ({ id: String(column.id ?? ""), name: String(column.name ?? `\u0633\u062A\u0648\u0646 ${index + 1}`), sortOrder: Number(column.sortOrder ?? index) }));
  const names = new Map(columns.map((column) => [column.id, column.name]));
  const tasks = (document.tasks ?? []).map((task) => ({ ...task, projectId: task.projectId ?? project.id, projectName: project.name, projectColor: project.color, columnId: task.columnId ?? "", columnName: names.get(String(task.columnId ?? "")) ?? "Tasks" }));
  return { project, columns, tasks };
}
function sidebarTree(projects, tasks = []) {
  const groups = /* @__PURE__ */ new Map();
  for (const [index, project] of (projects ?? []).entries()) {
    const group = String(project.groupName ?? project.folderName ?? "");
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push({ ...project, sidebarIndex: index, openCount: tasks.filter((task) => String(task.projectId) === String(project.id) && Number(task.status ?? 0) === 0).length });
  }
  const key = (value) => String(value ?? "").replace(/ي/g, "\u06CC").replace(/ك/g, "\u06A9").replace(/[\s‌]+/g, "").trim();
  const groupRank = (name) => ({ "": 0, "\u06A9\u0627\u0631": 10, "\u0644\u06CC\u0633\u062A\u0647\u0627": 20 })[key(name)] ?? 50;
  const projectRank = (name) => ({ "\u0627\u0642\u062F\u0627\u0645": 0, "\u0634\u062E\u0635\u06CC": 1, "\u0628\u0631\u0646\u0627\u0645\u0647\u0631\u06CC\u0632\u06CC": 10, "\u0645\u062F\u06CC\u0631\u06CC\u062A\u0645\u0627\u0644\u06CC": 11, "\u0641\u0631\u0648\u0634\u06AF\u0627\u0647": 12, "\u062A\u0648\u0633\u0646\u062A\u06A9\u0648": 13, "\u0634\u0627\u06CC\u062F\u06CC\u0647\u0631\u0648\u0632\u06CC": 20, "\u0622\u0631\u0634\u06CC\u0648": 21 })[key(name)] ?? 100;
  const remoteOrder = (project) => Number(project.sortOrder ?? project.order ?? Number.NaN);
  const compareProjects = (left, right) => {
    const rank = projectRank(left.name) - projectRank(right.name);
    if (rank) return rank;
    const leftOrder = remoteOrder(left);
    const rightOrder = remoteOrder(right);
    if (Number.isFinite(leftOrder) && Number.isFinite(rightOrder) && leftOrder !== rightOrder) return leftOrder - rightOrder;
    return left.sidebarIndex - right.sidebarIndex;
  };
  return [...groups.entries()].map(([name, items], index) => ({ name, index, projects: items.sort(compareProjects) })).sort((left, right) => groupRank(left.name) - groupRank(right.name) || left.index - right.index).map(({ name, projects: projects2 }) => ({ name, projects: projects2 }));
}
function virtualBoardEntries(tasks = []) {
  const open = tasks.filter((task) => Number(task?.status ?? 0) === 0);
  const tags = /* @__PURE__ */ new Map();
  for (const task of open) {
    for (const tag of Array.isArray(task.tags) ? task.tags : []) {
      const name = String(tag ?? "").trim();
      if (name) tags.set(name, (tags.get(name) ?? 0) + 1);
    }
  }
  return {
    all: { id: ALL_BOARD_VIEW_ID, name: "\u0647\u0645\u0647\u0654 \u0644\u06CC\u0633\u062A\u200C\u0647\u0627", count: open.length },
    inbox: { id: INBOX_BOARD_VIEW_ID, name: "\u0648\u0631\u0648\u062F\u06CC", count: open.filter((task) => Boolean(task.isInbox) || String(task.projectId ?? "").toLowerCase() === "inbox" || !task.projectId).length },
    recurring: { id: RECURRING_BOARD_VIEW_ID, name: "\u062A\u06A9\u0631\u0627\u0631\u0634\u0648\u0646\u062F\u0647\u200C\u0647\u0627", count: open.filter((task) => Boolean(task.repeatFlag)).length },
    tags: [...tags.entries()].sort(([left], [right]) => left.localeCompare(right, "fa")).map(([name, count]) => ({ id: `${TAG_BOARD_VIEW_PREFIX}${encodeURIComponent(name)}`, name, count }))
  };
}
function virtualBoardData(selection, tasks = [], projects = []) {
  const entries = virtualBoardEntries(tasks);
  let name = "";
  let matching = [];
  if (selection === ALL_BOARD_VIEW_ID) {
    name = entries.all.name;
    matching = tasks;
  } else if (selection === INBOX_BOARD_VIEW_ID) {
    name = entries.inbox.name;
    matching = tasks.filter((task) => Boolean(task.isInbox) || String(task.projectId ?? "").toLowerCase() === "inbox" || !task.projectId);
  } else if (selection === RECURRING_BOARD_VIEW_ID) {
    name = entries.recurring.name;
    matching = tasks.filter((task) => Boolean(task.repeatFlag));
  } else if (String(selection ?? "").startsWith(TAG_BOARD_VIEW_PREFIX)) {
    const tag = decodeURIComponent(String(selection).slice(TAG_BOARD_VIEW_PREFIX.length));
    const entry = entries.tags.find((item) => item.name === tag);
    if (!entry) return null;
    name = `#${tag}`;
    matching = tasks.filter((task) => (task.tags ?? []).some((value) => String(value) === tag));
  } else return null;
  const usedProjectIds = new Set(matching.map((task) => String(task.projectId ?? "")));
  const columns = projects.filter((project) => usedProjectIds.has(String(project.id))).map((project, index) => ({
    id: String(project.id),
    name: String(project.name ?? "\u0628\u062F\u0648\u0646 \u067E\u0631\u0648\u0698\u0647"),
    color: project.color,
    sortOrder: index,
    synthetic: true
  }));
  const known = new Set(columns.map((column) => column.id));
  for (const task of matching) {
    const projectId = String(task.projectId ?? "");
    if (known.has(projectId)) continue;
    known.add(projectId);
    columns.push({ id: projectId, name: projectId.toLowerCase() === "inbox" || !projectId ? "\u0648\u0631\u0648\u062F\u06CC" : String(task.projectName ?? "\u0628\u062F\u0648\u0646 \u067E\u0631\u0648\u0698\u0647"), sortOrder: columns.length, synthetic: true });
  }
  return {
    project: { id: selection, name, virtual: true },
    columns,
    tasks: matching.map((task) => ({ ...task, columnId: String(task.projectId ?? "") }))
  };
}
function boardColumns(data, showCompleted = false) {
  const columns = data.columns.length ? data.columns : [{ id: "", name: "Tasks", synthetic: true, sortOrder: 0 }];
  return columns.map((column) => {
    const matching = data.tasks.filter((task) => String(task.columnId ?? "") === String(column.id) && (showCompleted || Number(task.status ?? 0) === 0));
    const ordered = matching.slice().sort((a, b) => Number(isPinned(b)) - Number(isPinned(a)) || Number(a.sortOrder ?? a.order ?? 0) - Number(b.sortOrder ?? b.order ?? 0) || String(a.title).localeCompare(String(b.title), "fa"));
    const groups = ["Pinned", "High", "Medium", "Low", "No priority", ...showCompleted ? ["Completed"] : []].map((name) => ({ name, tasks: ordered.filter((task) => {
      if (name === "Pinned") return isPinned(task);
      if (isPinned(task)) return false;
      return Number(task.status ?? 0) !== 0 ? name === "Completed" : groupName(task.priority) === name;
    }) })).filter((group) => group.tasks.length);
    return { ...column, count: matching.length, groups };
  });
}
var RECURRING_BOARD_VIEW_ID, ALL_BOARD_VIEW_ID, INBOX_BOARD_VIEW_ID, TAG_BOARD_VIEW_PREFIX, isPinned, groupName;
var init_project_board = __esm({
  "src/core/project-board.js"() {
    "use strict";
    RECURRING_BOARD_VIEW_ID = "ticktick:view:recurring";
    ALL_BOARD_VIEW_ID = "ticktick:view:all";
    INBOX_BOARD_VIEW_ID = "ticktick:view:inbox";
    TAG_BOARD_VIEW_PREFIX = "ticktick:view:tag:";
    isPinned = (task) => Boolean(task?.pinned ?? task?.isPinned ?? task?.pin ?? task?.pinnedTime ?? task?.pinnedAt ?? task?.pinTime);
    groupName = (priority) => ({ 5: "High", 3: "Medium", 1: "Low" })[Number(priority)] ?? "No priority";
  }
});

// src/obsidian/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TickTickBridgePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian20 = require("obsidian");

// src/core/date.js
function toDateKey(value, timeZone = "Asia/Tehran") {
  if (!value) return null;
  const raw = String(value);
  const dateOnly = raw.match(/^(\d{4}-\d{2}-\d{2})$/)?.[1];
  if (dateOnly) return dateOnly;
  const instant = new Date(raw);
  if (!Number.isNaN(instant.getTime())) return todayInZone(timeZone, instant);
  return raw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
}
function todayInZone(timeZone = "Asia/Tehran", now = /* @__PURE__ */ new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  const value = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value: value2 }) => [type, value2]));
  return `${value.year}-${value.month}-${value.day}`;
}
function jalaliDateKeyToGregorian(value) {
  const match = String(value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const monthDays = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
  const offset = monthDays.slice(0, month - 1).reduce((total, count) => total + count, 0) + day - 1;
  const approximate = new Date(Date.UTC(year + 621, 2, 21 + offset, 12));
  const formatter = new Intl.DateTimeFormat("en-US-u-ca-persian", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" });
  for (let adjustment = -4; adjustment <= 4; adjustment++) {
    const candidate = new Date(approximate);
    candidate.setUTCDate(candidate.getUTCDate() + adjustment);
    const parts = Object.fromEntries(formatter.formatToParts(candidate).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    if (parts.year === year && parts.month === month && parts.day === day) return candidate.toISOString().slice(0, 10);
  }
  return null;
}
function isScheduledForDay(task, day) {
  if (task.status !== void 0 && task.status !== 0) return false;
  const due = toDateKey(task.dueDate, task.timeZone || "Asia/Tehran");
  const start = toDateKey(task.startDate, task.timeZone || "Asia/Tehran");
  if (!due) return false;
  if (start && day >= start && day <= due) return true;
  return due <= day;
}
function toHabitStamp(day) {
  const key = toDateKey(day);
  if (!key) throw new Error("A YYYY-MM-DD date is required for a habit check-in.");
  return Number(key.replaceAll("-", ""));
}
function isHabitScheduledForDay(habit, day) {
  if (habit.status !== void 0 && habit.status !== 0) return false;
  const stamp = toHabitStamp(day);
  if ((habit.exDates ?? []).map(Number).includes(stamp)) return false;
  const rule = String(habit.repeatRule ?? "RRULE:FREQ=DAILY").toUpperCase();
  if (!rule.includes("FREQ=WEEKLY")) return true;
  const byDay = rule.match(/BYDAY=([^;]+)/)?.[1]?.split(",") ?? [];
  if (!byDay.length) return true;
  const jsDay = (/* @__PURE__ */ new Date(`${day}T12:00:00`)).getDay();
  return byDay.includes(["SU", "MO", "TU", "WE", "TH", "FR", "SA"][jsDay]);
}

// src/core/ticktick-client.js
var TickTickApiError = class extends Error {
  constructor(message, { status, body, retryAfter } = {}) {
    super(message);
    this.name = "TickTickApiError";
    this.status = status;
    this.body = body;
    this.retryAfter = retryAfter;
  }
};
async function fetchTransport(url, init) {
  const response = await fetch(url, init);
  return { status: response.status, text: await response.text() };
}
function parseBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
function requestFailureMessage(status) {
  if (status === 400) return "TickTick \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u0631\u0627 \u0646\u067E\u0630\u06CC\u0631\u0641\u062A. \u062F\u0627\u062F\u0647\u0654 \u062A\u0633\u06A9 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646.";
  if (status === 401 || status === 403) return "\u062F\u0633\u062A\u0631\u0633\u06CC TickTick \u0631\u062F \u0634\u062F. API Token \u0631\u0627 \u062F\u0631 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A TickTick Bridge \u062F\u0648\u0628\u0627\u0631\u0647 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646.";
  if (status === 404) return "\u0631\u06A9\u0648\u0631\u062F \u0645\u0648\u0631\u062F\u0646\u0638\u0631 \u062F\u06CC\u06AF\u0631 \u062F\u0631 TickTick \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F \u06CC\u0627 \u062F\u0633\u062A\u0631\u0633\u06CC \u0622\u0646 \u062A\u063A\u06CC\u06CC\u0631 \u06A9\u0631\u062F\u0647 \u0627\u0633\u062A.";
  if (status === 409) return "\u0627\u06CC\u0646 \u062A\u063A\u06CC\u06CC\u0631 \u0628\u0627 \u0646\u0633\u062E\u0647\u0654 \u062C\u062F\u06CC\u062F\u062A\u0631 TickTick \u062A\u062F\u0627\u062E\u0644 \u062F\u0627\u0631\u062F.";
  if (status === 429) return "TickTick \u062F\u0631\u062E\u0648\u0627\u0633\u062A\u200C\u0647\u0627 \u0631\u0627 \u0645\u0648\u0642\u062A\u0627\u064B \u0645\u062D\u062F\u0648\u062F \u06A9\u0631\u062F\u0647 \u0627\u0633\u062A\u061B \u062A\u063A\u06CC\u06CC\u0631 \u0645\u062D\u0644\u06CC \u062D\u0641\u0638 \u0634\u062F \u0648 \u06A9\u0645\u06CC \u0628\u0639\u062F \u062F\u0648\u0628\u0627\u0631\u0647 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F.";
  if (status >= 500) return "\u0633\u0631\u0648\u06CC\u0633 TickTick \u0645\u0648\u0642\u062A\u0627\u064B \u067E\u0627\u0633\u062E\u200C\u06AF\u0648 \u0646\u06CC\u0633\u062A\u061B \u06A9\u0645\u06CC \u0628\u0639\u062F \u062F\u0648\u0628\u0627\u0631\u0647 \u062A\u0644\u0627\u0634 \u06A9\u0646.";
  return "\u0627\u0631\u062A\u0628\u0627\u0637 \u0628\u0627 TickTick \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.";
}
var TickTickClient = class {
  constructor({ token, transport = fetchTransport, baseUrl = "https://api.ticktick.com/open/v1" }) {
    if (!token?.trim()) throw new Error("TickTick API token is required.");
    this.token = token.trim();
    this.transport = transport;
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }
  async request(path, { method = "GET", body } = {}) {
    const response = await this.transport(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json"
      },
      body: body === void 0 ? void 0 : JSON.stringify(body)
    });
    const parsed = parseBody(response.text);
    if (response.status < 200 || response.status >= 300) {
      const retryAfterHeader = response.headers?.["retry-after"] ?? response.headers?.["Retry-After"];
      const retryAfter = Number(retryAfterHeader);
      throw new TickTickApiError(requestFailureMessage(response.status), { status: response.status, body: parsed, retryAfter: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : void 0 });
    }
    return parsed;
  }
  listProjects() {
    return this.request("/project");
  }
  getProject(projectId) {
    return this.request(`/project/${encodeURIComponent(projectId)}`);
  }
  createProject(project) {
    return this.request("/project", { method: "POST", body: project });
  }
  updateProject(project) {
    if (!project?.id) throw new Error("Project id is required for update.");
    const body = Object.fromEntries(Object.entries({ name: project.name, color: project.color, sortOrder: project.sortOrder, viewMode: project.viewMode, kind: project.kind }).filter(([, value]) => value !== void 0 && value !== null));
    return this.request(`/project/${encodeURIComponent(project.id)}`, { method: "POST", body });
  }
  deleteProject(projectId) {
    return this.request(`/project/${encodeURIComponent(projectId)}`, { method: "DELETE" });
  }
  getProjectData(projectId) {
    return this.request(`/project/${encodeURIComponent(projectId)}/data`);
  }
  async projectBoard(project) {
    const data = await this.getProjectData(project.id);
    const { normalizeProjectData: normalizeProjectData2 } = await Promise.resolve().then(() => (init_project_board(), project_board_exports));
    return normalizeProjectData2(data, project);
  }
  getTask(projectId, taskId) {
    return this.request(`/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(taskId)}`);
  }
  createTask(task) {
    return this.request("/task", { method: "POST", body: task });
  }
  updateTask(task) {
    if (!task?.id) throw new Error("Task id is required for update.");
    return this.request(`/task/${encodeURIComponent(task.id)}`, { method: "POST", body: task });
  }
  deleteTask(projectId, taskId) {
    return this.request(`/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(taskId)}`, { method: "DELETE" });
  }
  /** TickTick advances recurring tasks itself; never calculate the next date locally. */
  completeTask(projectId, taskId) {
    return this.request(`/project/${encodeURIComponent(projectId)}/task/${encodeURIComponent(taskId)}/complete`, { method: "POST" });
  }
  listHabits() {
    return this.request("/habit");
  }
  listHabitSections() {
    return this.request("/habit/sections");
  }
  getHabit(habitId) {
    return this.request(`/habit/${encodeURIComponent(habitId)}`);
  }
  getHabitCheckins(habitIds, fromDay, toDay) {
    const params = new URLSearchParams({
      habitIds: habitIds.join(","),
      from: String(toHabitStamp(fromDay)),
      to: String(toHabitStamp(toDay))
    });
    return this.request(`/habit/checkins?${params}`);
  }
  /**
   * @param {string} habitId
   * @param {string} day
   * @param {{ value?: number, goal?: number, status?: number }} [options]
   */
  checkInHabit(habitId, day, { value = 1, goal = 1, status = void 0 } = {}) {
    const body = { stamp: toHabitStamp(day), value, goal };
    if (status !== void 0 && status !== null) body.status = status;
    return this.request(`/habit/${encodeURIComponent(habitId)}/checkin`, {
      method: "POST",
      body
    });
  }
  async listOpenTasks() {
    const projects = await this.listProjects();
    const collections = await Promise.all(projects.map(async (project) => {
      const data = await this.getProjectData(project.id);
      return (data.tasks ?? []).map((task) => ({ ...task, projectName: project.name }));
    }));
    return collections.flat().filter((task) => task.status === 0);
  }
  async tasksForDay(day) {
    const tasks = await this.listOpenTasks();
    return tasks.filter((task) => isScheduledForDay(task, day));
  }
  async listRecurringTasks() {
    const tasks = await this.listOpenTasks();
    return tasks.filter((task) => Boolean(task.repeatFlag)).sort((left, right) => String(left.dueDate ?? "9999-12-31").localeCompare(String(right.dueDate ?? "9999-12-31")) || String(left.title ?? "").localeCompare(String(right.title ?? ""), "fa"));
  }
  async habitsForDay(day) {
    const [habits, sections] = await Promise.all([this.listHabits(), this.listHabitSections()]);
    const sectionNames = new Map(sections.map((section) => [section.id, section.name]));
    const active = habits.filter((habit) => isHabitScheduledForDay(habit, day));
    if (!active.length) return [];
    const checkinDocuments = await this.getHabitCheckins(active.map((habit) => habit.id), day, day);
    const values = new Map((checkinDocuments ?? []).flatMap((document) => (document.checkins ?? []).filter((checkin) => Number(checkin.stamp) === toHabitStamp(day)).map((checkin) => [document.habitId, checkin])));
    return active.map((habit) => ({ ...habit, sectionName: sectionNames.get(habit.sectionId) ?? "\u0628\u062F\u0648\u0646 \u062F\u0633\u062A\u0647", checkin: values.get(habit.id) ?? null }));
  }
  async habitsWithHistory(day, days = 28) {
    const [habits, sections] = await Promise.all([this.listHabits(), this.listHabitSections()]);
    const sectionNames = new Map(sections.map((section) => [section.id, section.name]));
    const start = /* @__PURE__ */ new Date(`${day}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() - Math.max(0, days - 1));
    const fromDay = start.toISOString().slice(0, 10);
    const documents = await this.getHabitCheckins(habits.map((habit) => habit.id), fromDay, day);
    const checkins = new Map((documents ?? []).flatMap((document) => (document.checkins ?? []).map((checkin) => [`${document.habitId}:${checkin.stamp}`, checkin])));
    const dates = Array.from({ length: days }, (_, index) => {
      const value = /* @__PURE__ */ new Date(`${fromDay}T12:00:00Z`);
      value.setUTCDate(value.getUTCDate() + index);
      return value.toISOString().slice(0, 10);
    });
    return habits.map((habit) => {
      const goal = Math.max(1, Number(habit.goal ?? 1));
      const history = dates.filter((date) => isHabitScheduledForDay(habit, date)).map((date) => {
        const checkin2 = checkins.get(`${habit.id}:${toHabitStamp(date)}`) ?? null;
        const value = Number(checkin2?.value ?? 0);
        return { date, value, completed: checkin2?.status === 2 || value >= goal };
      });
      const checkin = checkins.get(`${habit.id}:${toHabitStamp(day)}`) ?? null;
      return { ...habit, sectionName: sectionNames.get(habit.sectionId) ?? "\u0628\u062F\u0648\u0646 \u062F\u0633\u062A\u0647", checkin, history };
    });
  }
};

// src/core/ticktick-web-habits.js
function parseWebHabitCheckins(payload) {
  const output = /* @__PURE__ */ new Map();
  const collections = payload && typeof payload === "object" ? payload.checkins : null;
  if (!collections || typeof collections !== "object") return output;
  for (const [habitId, entries] of Object.entries(collections)) {
    output.set(habitId, Array.isArray(entries) ? entries.map((entry) => ({
      stamp: Number(entry?.checkinStamp ?? entry?.stamp),
      value: Number(entry?.value ?? 0),
      goal: Number(entry?.goal ?? 1),
      status: Number(entry?.status ?? 0)
    })).filter((entry) => Number.isFinite(entry.stamp)) : []);
  }
  return output;
}
function normalizeWebSessionCookie(value) {
  return String(value ?? "").replace(/^\s*cookie\s*:\s*/i, "").trim();
}

// src/core/managed-storage.js
var ROOT = ".ticktick";
function utcDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("A valid capture time is required.");
  return date;
}
function dateKey(value) {
  return utcDate(value).toISOString().slice(0, 10);
}
function safeTimestamp(value) {
  return utcDate(value).toISOString().replace(/[:.]/g, "-");
}
function safeSegment(value, fallback) {
  const result = String(value ?? fallback).trim().replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return result || fallback;
}
function managedRoot() {
  return ROOT;
}
function backupPath(capturedAt, purpose) {
  return `${ROOT}/backups/${dateKey(capturedAt)}/${safeTimestamp(capturedAt)}-${safeSegment(purpose, "snapshot")}.json`;
}
function reportPath(capturedAt, operation) {
  return `${ROOT}/reports/${safeTimestamp(capturedAt)}-${safeSegment(operation, "operation")}.json`;
}
function journalPath(operationId) {
  return `${ROOT}/journal/${safeSegment(operationId, "operation")}.json`;
}
function privateCachePath() {
  return `${ROOT}/cache/full-cache.json`;
}
function publicManagedMetadata(value) {
  if (Array.isArray(value)) return value.map(publicManagedMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).flatMap(([key, nested]) => /token|cookie|authorization|password|secret|headers?|content|desc|body|raw/i.test(key) ? [] : [[key, publicManagedMetadata(nested)]]));
}
function parseManagedBackupPath(path) {
  const match = /^\.ticktick\/backups\/(\d{4}-\d{2}-\d{2})\/[^/]+\.json$/.exec(String(path));
  if (!match || Number.isNaN((/* @__PURE__ */ new Date(`${match[1]}T00:00:00.000Z`)).getTime())) return null;
  return { path: String(path), date: match[1] };
}
function selectExpiredBackups(entries, now, keepCalendarDays = 10) {
  const keep = Math.max(1, Math.floor(keepCalendarDays));
  const current = utcDate(now);
  const retained = new Set(Array.from({ length: keep }, (_, index) => {
    const day = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() - index));
    return day.toISOString().slice(0, 10);
  }));
  return entries.filter((entry) => {
    const parsed = parseManagedBackupPath(typeof entry === "string" ? entry : entry?.path);
    return parsed && !retained.has(parsed.date);
  });
}

// src/obsidian/managed-storage.ts
var ManagedStorage = class {
  adapter;
  constructor(adapter) {
    this.adapter = adapter;
  }
  managedPath(path, area) {
    const value = String(path);
    const prefix = `${managedRoot()}/`;
    const expected = area ? `${managedRoot()}/${area}/` : prefix;
    if (value.includes("\\") || !value.startsWith(expected) || value.split("/").some((part) => !part || part === "." || part === "..")) throw new Error("Invalid managed storage path.");
    return value;
  }
  async ensure(path) {
    const pieces = path.split("/");
    let current = "";
    for (const piece of pieces) {
      current = current ? `${current}/${piece}` : piece;
      if (!await this.adapter.exists(current)) await this.adapter.mkdir(current);
    }
  }
  async writeJson(path, value, preservePrivateContent = false) {
    path = this.managedPath(path);
    await this.ensure(path.split("/").slice(0, -1).join("/"));
    const serialized = JSON.stringify(preservePrivateContent ? value : publicManagedMetadata(value));
    const temporary = `${path}.tmp-${Date.now()}`;
    await this.adapter.write(temporary, serialized);
    try {
      if (this.adapter.rename) {
        try {
          await this.adapter.rename(temporary, path);
        } catch {
          if (!await this.adapter.exists(path)) throw new Error("rename failed");
          const prior = await this.adapter.read(path);
          const preserved = `${path}.previous-${Date.now()}`;
          await this.adapter.write(preserved, prior);
          try {
            await this.adapter.remove(path);
            await this.adapter.rename(temporary, path);
            await this.adapter.remove(preserved);
          } catch {
            if (!await this.adapter.exists(path)) await this.adapter.write(path, prior);
            throw new Error("replacement failed");
          }
        }
      } else {
        await this.adapter.write(path, serialized);
        await this.adapter.remove(temporary);
      }
    } catch {
      try {
        if (await this.adapter.exists(temporary)) await this.adapter.remove(temporary);
      } catch {
      }
      throw new Error("Managed storage write failed.");
    }
  }
  async writeSnapshot(purpose, payload, capturedAt = /* @__PURE__ */ new Date()) {
    const path = backupPath(capturedAt, purpose);
    await this.writeJson(path, { schemaVersion: 1, capturedAt: capturedAt.toISOString(), purpose, metadata: publicManagedMetadata(payload) });
    return path;
  }
  /** Private runtime cache: hidden from ordinary reports/snapshots and written
   * atomically. It intentionally never enters the ten-day backup history. */
  async writePrivateCache(cache) {
    await this.writeJson(privateCachePath(), cache, true);
  }
  async readPrivateCache() {
    const path = this.managedPath(privateCachePath(), "cache");
    if (!await this.adapter.exists(path)) return null;
    try {
      return JSON.parse(await this.adapter.read(path));
    } catch {
      return null;
    }
  }
  async readSnapshot(path) {
    path = this.managedPath(path, "backups");
    if (!/^\.ticktick\/backups\/\d{4}-\d{2}-\d{2}\/.+\.json$/.test(path)) throw new Error("Invalid managed snapshot path.");
    return JSON.parse(await this.adapter.read(path));
  }
  async writeReport(operation, report, capturedAt = /* @__PURE__ */ new Date()) {
    const path = reportPath(capturedAt, operation);
    await this.writeJson(path, { schemaVersion: 1, capturedAt: capturedAt.toISOString(), operation, metadata: publicManagedMetadata(report) });
    return path;
  }
  async readReport(path) {
    path = this.managedPath(path, "reports");
    if (!/^\.ticktick\/reports\/.+\.json$/.test(path)) throw new Error("Invalid managed report path.");
    return JSON.parse(await this.adapter.read(path));
  }
  async latestReport() {
    const root = `${managedRoot()}/reports`;
    if (!await this.adapter.exists(root)) return null;
    const paths = (await this.adapter.list(root)).files.filter((path) => /^\.ticktick\/reports\/.+\.json$/.test(path)).sort();
    return paths.length ? { path: paths.at(-1), report: await this.readReport(paths.at(-1)) } : null;
  }
  async persistJournal(operationId, journal) {
    const path = journalPath(operationId);
    await this.writeJson(path, { schemaVersion: 1, operationId, metadata: publicManagedMetadata(journal) });
    return path;
  }
  async readJournal(operationId) {
    const path = this.managedPath(journalPath(operationId), "journal");
    if (!await this.adapter.exists(path)) return null;
    return JSON.parse(await this.adapter.read(path));
  }
  async removeJournal(operationId) {
    const path = journalPath(operationId);
    if (await this.adapter.exists(path)) await this.adapter.remove(path);
  }
  async listManagedBackups() {
    const root = `${managedRoot()}/backups`;
    if (!await this.adapter.exists(root)) return [];
    const result = [];
    for (const folder of (await this.adapter.list(root)).folders) result.push(...(await this.adapter.list(folder)).files.filter((file) => /^\.ticktick\/backups\/\d{4}-\d{2}-\d{2}\/.+\.json$/.test(file)));
    return result;
  }
  async pruneEligibleManagedBackups(now = /* @__PURE__ */ new Date(), keepCalendarDays = 10) {
    const expired = selectExpiredBackups(await this.listManagedBackups(), now, keepCalendarDays);
    await Promise.all(expired.map((entry) => this.adapter.remove(typeof entry === "string" ? entry : entry.path)));
    return expired;
  }
  async legacyRootBackups() {
    const files = (await this.adapter.list("")).files.filter((path) => /^ticktick-backup-[^/]+\.csv$/i.test(path));
    return Promise.all(files.map(async (path) => ({ path, size: (await this.adapter.stat(path))?.size ?? 0 })));
  }
  async migrateLegacyRootBackups() {
    const sources = await this.legacyRootBackups();
    const destinationFolder = `${managedRoot()}/backups/legacy-root`;
    await this.ensure(destinationFolder);
    const migrated = [];
    for (const source of sources) {
      const name = source.path.split("/").pop();
      const target = `${destinationFolder}/${name}`;
      try {
        await this.adapter.write(target, await this.adapter.read(source.path));
        if ((await this.adapter.stat(target))?.size !== source.size) throw new Error("byte length mismatch");
        await this.adapter.remove(source.path);
        migrated.push(source.path);
      } catch {
        try {
          if (await this.adapter.exists(target) && (await this.adapter.stat(target))?.size !== source.size) await this.adapter.remove(target);
        } catch {
        }
      }
    }
    return { sources, migrated };
  }
};

// src/obsidian/markdown-sync.ts
var import_obsidian = require("obsidian");

// src/core/task-binding.js
var modernPattern = /\s*<!--\s*ticktick-bridge:task\s+id=([A-Za-z0-9_-]+)\s+project=([A-Za-z0-9_-]+)\s+v=(\d+)(?:\s+kind=([A-Za-z0-9_-]+))?\s*-->/i;
var legacyPattern = /%%\[ticktick_id::\s*([\w-]+)\]%%/;
function safeIdentity(value, field) {
  const result = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]+$/.test(result)) throw new Error(`Invalid TickTick ${field}.`);
  return result;
}
function parseTaskBinding(line) {
  const modern = String(line).match(modernPattern);
  if (modern) return { id: modern[1], projectId: modern[2], version: Number(modern[3]), kind: modern[4] ?? "task", legacy: false };
  const legacy = String(line).match(legacyPattern);
  return legacy ? { id: legacy[1], projectId: null, version: 0, kind: "task", legacy: true } : null;
}
function serializeTaskBinding({ id, projectId, version = 1, kind = "task" }) {
  return `<!-- ticktick-bridge:task id=${safeIdentity(id, "task id")} project=${safeIdentity(projectId, "project id")} v=${Number(version) || 1} kind=${safeIdentity(kind, "kind")} -->`;
}
function attachTaskBinding(line, binding) {
  const ending = String(line).match(/\r?\n$/)?.[0] ?? "";
  const body = String(line).slice(0, String(line).length - ending.length).replace(modernPattern, "").replace(/[ \t]+$/, "");
  return `${body}${body ? " " : ""}${serializeTaskBinding(binding)}${ending}`;
}
function removeTaskBinding(line) {
  return String(line).replace(modernPattern, "").replace(/[ \t]+(?=\r?\n?$)/, "");
}
function lineLocator(lines, line) {
  return { line, before: String(lines[line - 1] ?? "").trim(), value: String(lines[line] ?? "").trim(), after: String(lines[line + 1] ?? "").trim() };
}
function locateLine(lines, locator) {
  if (locator && String(lines[locator.line] ?? "").trim() === locator.value) return locator.line;
  const matches = lines.map((value, index) => ({ value: String(value).trim(), index })).filter((entry) => entry.value === locator?.value && String(lines[entry.index - 1] ?? "").trim() === locator.before && String(lines[entry.index + 1] ?? "").trim() === locator.after);
  return matches.length === 1 ? matches[0].index : null;
}

// src/core/task-diff.js
var fields = ["title", "completed", "projectId", "priority", "tags", "startDate", "dueDate", "isAllDay", "repeatFlag", "description"];
function valueFor(task, field) {
  if (field === "completed") return task?.status !== void 0 ? Number(task.status) !== 0 : Boolean(task?.completed);
  if (field === "description") return String(task?.description ?? task?.desc ?? "");
  if (field === "tags") return [...task?.tags ?? []].map(String).sort();
  return task?.[field] ?? null;
}
function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function normalizedTask(task = {}) {
  return Object.fromEntries(fields.map((field) => [field, valueFor(task, field)]));
}
function diffTask(base, local, remote) {
  if (!remote) return { localOnly: [], remoteOnly: [], equal: [], conflicts: [], quarantine: "remote-missing", merged: normalizedTask(local) };
  const result = { localOnly: [], remoteOnly: [], equal: [], conflicts: [], quarantine: null, merged: {} };
  for (const field of fields) {
    const original = valueFor(base, field);
    const localValue = valueFor(local, field);
    const remoteValue = valueFor(remote, field);
    const localChanged = !same(original, localValue);
    const remoteChanged = !same(original, remoteValue);
    if (localChanged && remoteChanged && !same(localValue, remoteValue)) result.conflicts.push({ field, base: original, local: localValue, remote: remoteValue });
    else if (localChanged && !remoteChanged) {
      result.localOnly.push(field);
      result.merged[field] = localValue;
    } else if (!localChanged && remoteChanged) {
      result.remoteOnly.push(field);
      result.merged[field] = remoteValue;
    } else {
      result.equal.push(field);
      result.merged[field] = localValue;
    }
  }
  if (Boolean(remote.repeatFlag) && result.remoteOnly.includes("completed")) result.recurringRemoteCompletion = true;
  return result;
}

// src/core/markdown-task.js
var taskPattern = /^(\s*[-*+]\s+\[([ xX])\]\s+)(.*)$/;
function parseMarkdownTask(line, sourcePath, lineNumber = 0) {
  const task = String(line).match(taskPattern);
  if (!task) return null;
  const binding = parseTaskBinding(line);
  const text = task[3].replace(/%%\[ticktick_id::\s*[\w-]+\]%%/, "").replace(/\s*<!--\s*ticktick-bridge:task\b[^>]*-->/i, "").replace(/(?:📅|🛫|✅)\s*\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?/g, "").replace(/🔁[^#📅🛫✅]*$/, "").replace(/#ticktick\b/gi, "").trim();
  return { id: binding?.id ?? null, binding, sourcePath, lineNumber, title: text, completed: task[2].toLowerCase() === "x", raw: String(line), prefix: task[1] };
}

// src/obsidian/markdown-sync.ts
var STATE_ID = "markdown-sync-state";
var emptyState = () => ({ bindings: {}, pending: {}, conflicts: [] });
var keyFor = (path, id) => `${path}:${id}`;
var tagPattern = (tag) => new RegExp(`(^|\\s)#${tag.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}(?=\\s|$)`, "i");
var MarkdownSync = class {
  constructor(app, storage, getClient, getSettings, projectForNewTask) {
    this.app = app;
    this.storage = storage;
    this.getClient = getClient;
    this.getSettings = getSettings;
    this.projectForNewTask = projectForNewTask;
  }
  state = emptyState();
  loaded = false;
  previewActions = [];
  async initialize() {
    await this.load();
  }
  async load() {
    if (this.loaded) return;
    const saved = await this.storage.readJournal(STATE_ID);
    this.state = saved?.metadata && typeof saved.metadata === "object" ? { ...emptyState(), ...saved.metadata } : emptyState();
    this.loaded = true;
  }
  async save() {
    await this.storage.persistJournal(STATE_ID, this.state);
  }
  taskTag(line) {
    return tagPattern(this.getSettings().checkboxImportTag.trim().replace(/^#/, "") || "ticktick").test(line);
  }
  async preview(files = this.app.vault.getMarkdownFiles()) {
    await this.load();
    const actions = [];
    const seen = /* @__PURE__ */ new Set();
    for (const file of files) {
      const source = await this.app.vault.read(file);
      const lines = source.split(/\r?\n/);
      for (let line = 0; line < lines.length; line++) {
        const local = parseMarkdownTask(lines[line], file.path, line);
        if (!local || !this.taskTag(lines[line])) continue;
        const binding = parseTaskBinding(lines[line]);
        if (!binding) {
          actions.push({ type: "create", path: file.path, line, message: "\u0686\u06A9\u200C\u0628\u0627\u06A9\u0633 \u062C\u062F\u06CC\u062F", task: local });
          continue;
        }
        const identity = `${binding.projectId ?? "legacy"}:${binding.id}`;
        if (seen.has(identity)) {
          actions.push({ type: "quarantine", path: file.path, line, message: "\u0634\u0646\u0627\u0633\u0647\u0654 TickTick \u062A\u06A9\u0631\u0627\u0631\u06CC \u0627\u0633\u062A.", task: local, binding });
          continue;
        }
        seen.add(identity);
        let remote = null;
        try {
          remote = binding.projectId ? await this.getClient().getTask(binding.projectId, binding.id) : await this.findLegacyTask(binding.id);
        } catch {
          actions.push({ type: "quarantine", path: file.path, line, message: "\u0648\u0638\u06CC\u0641\u0647\u0654 \u0631\u0627\u0647\u200C\u062F\u0648\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F \u06CC\u0627 \u0642\u0627\u0628\u0644\u200C\u062E\u0648\u0627\u0646\u062F\u0646 \u0646\u06CC\u0633\u062A.", task: local, binding });
          continue;
        }
        if (!remote?.id) {
          actions.push({ type: "quarantine", path: file.path, line, message: "\u067E\u0627\u0633\u062E TickTick \u0647\u0648\u06CC\u062A \u0645\u0639\u062A\u0628\u0631\u06CC \u0646\u062F\u0627\u0631\u062F.", task: local, binding });
          continue;
        }
        const stateKey = keyFor(file.path, binding.id);
        const baseline = this.state.bindings[stateKey]?.baseline ?? normalizedTask(remote);
        const result = diffTask(baseline, { ...local, projectId: binding.projectId }, remote);
        if (result.conflicts.length) actions.push({ type: "conflict", path: file.path, line, message: "\u062A\u0639\u0627\u0631\u0636 \u0647\u0645\u200C\u0632\u0645\u0627\u0646", task: local, remote, binding, diff: result });
        else if (result.localOnly.length) actions.push({ type: "push", path: file.path, line, message: result.localOnly.join(", "), task: local, remote, binding, diff: result });
        else if (result.remoteOnly.length) actions.push({ type: "pull", path: file.path, line, message: result.remoteOnly.join(", "), task: local, remote, binding, diff: result });
        else this.state.bindings[stateKey] = { locator: lineLocator(lines, line), baseline: normalizedTask(remote), projectId: remote.projectId ?? binding.projectId };
      }
    }
    this.previewActions = actions;
    this.state.conflicts = actions.filter((action) => action.type === "conflict" || action.type === "quarantine");
    await this.save();
    return this.summary(actions);
  }
  async findLegacyTask(id) {
    const projects = await this.getClient().listProjects();
    for (const project of projects ?? []) {
      const data = await this.getClient().getProjectData(project.id);
      const task = (data.tasks ?? []).find((item) => item.id === id);
      if (task) return { ...task, projectId: project.id };
    }
    return null;
  }
  summary(actions) {
    return { actions, create: actions.filter((x) => x.type === "create").length, push: actions.filter((x) => x.type === "push").length, pull: actions.filter((x) => x.type === "pull").length, conflict: actions.filter((x) => x.type === "conflict").length, quarantine: actions.filter((x) => x.type === "quarantine").length };
  }
  async apply() {
    await this.load();
    const preview = await this.preview();
    const actions = this.previewActions.filter((action) => action.type === "create" || action.type === "push" || action.type === "pull");
    if (!actions.length) return { ...preview, applied: 0 };
    await this.storage.writeSnapshot("markdown-sync", { actionCount: actions.length, paths: [...new Set(actions.map((a) => a.path))] });
    let applied = 0;
    for (const action of actions) {
      try {
        await this.applyAction(action);
        applied++;
      } catch (error) {
        this.state.conflicts.push({ ...action, type: "quarantine", message: error instanceof Error ? error.message : "\u0639\u0645\u0644\u06CC\u0627\u062A \u0646\u0627\u0645\u0634\u062E\u0635" });
      }
    }
    await this.save();
    await this.storage.writeReport("markdown-sync", { applied, conflicts: this.state.conflicts.length, actionCount: actions.length });
    return { ...preview, applied };
  }
  async applyAction(action) {
    const file = this.app.vault.getAbstractFileByPath(action.path);
    if (!(file instanceof import_obsidian.TFile)) throw new Error("\u0641\u0627\u06CC\u0644 Markdown \u062C\u0627\u0628\u0647\u200C\u062C\u0627 \u06CC\u0627 \u062D\u0630\u0641 \u0634\u062F\u0647 \u0627\u0633\u062A.");
    const original = await this.app.vault.read(file);
    const newline = original.includes("\r\n") ? "\r\n" : "\n";
    const lines = original.split(/\r?\n/);
    const line = locateLine(lines, lineLocator(lines, action.line));
    if (line === null) throw new Error("\u062E\u0637 \u0648\u0638\u06CC\u0641\u0647 \u062A\u063A\u06CC\u06CC\u0631 \u06A9\u0631\u062F\u0647 \u0648 \u0628\u0647\u200C\u0634\u06A9\u0644 \u0627\u0645\u0646 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
    if (action.type === "create") {
      const projectId = await this.projectForNewTask();
      const local = parseMarkdownTask(lines[line], action.path, line);
      const pendingId = `${action.path}:${line}:${Date.now()}`;
      this.state.pending[pendingId] = { phase: "prepared", path: action.path, locator: lineLocator(lines, line), createdAt: (/* @__PURE__ */ new Date()).toISOString() };
      await this.save();
      const remote2 = await this.getClient().createTask({ title: local.title, projectId, timeZone: this.getSettings().timeZone, isAllDay: true });
      if (!remote2?.id || !remote2?.projectId) {
        this.state.pending[pendingId].phase = "ambiguous";
        await this.save();
        throw new Error("\u0627\u06CC\u062C\u0627\u062F TickTick \u0647\u0648\u06CC\u062A \u0642\u0627\u0628\u0644\u200C\u062A\u0623\u06CC\u06CC\u062F \u0628\u0631\u0646\u06AF\u0631\u062F\u0627\u0646\u062F\u061B \u062F\u0648\u0628\u0627\u0631\u0647 \u062A\u0644\u0627\u0634 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F.");
      }
      lines[line] = attachTaskBinding(lines[line], { id: remote2.id, projectId: remote2.projectId });
      await this.app.vault.modify(file, lines.join(newline));
      this.state.bindings[keyFor(action.path, remote2.id)] = { locator: lineLocator(lines, line), baseline: normalizedTask(remote2), projectId: remote2.projectId };
      delete this.state.pending[pendingId];
      return;
    }
    const binding = action.binding;
    const remote = await this.getClient().getTask(binding.projectId, binding.id);
    if (!remote?.id) throw new Error("\u0648\u0638\u06CC\u0641\u0647\u0654 TickTick \u067E\u06CC\u0634 \u0627\u0632 \u0646\u0648\u0634\u062A\u0646 \u062F\u0648\u0628\u0627\u0631\u0647 \u062E\u0648\u0627\u0646\u062F\u0647 \u0646\u0634\u062F.");
    if (action.type === "push") {
      if (action.diff.localOnly.includes("completed")) await this.getClient().completeTask(binding.projectId, binding.id);
      const changed = action.diff.localOnly.filter((field) => field !== "completed");
      if (changed.length) await this.getClient().updateTask({ ...remote, title: action.task.title, projectId: binding.projectId });
      this.state.bindings[keyFor(action.path, binding.id)] = { locator: lineLocator(lines, line), baseline: normalizedTask({ ...remote, title: action.task.title, completed: action.task.completed }), projectId: binding.projectId };
    } else {
      const next = action.diff.merged;
      let updated = lines[line];
      if (action.diff.remoteOnly.includes("title") && action.task?.title) updated = updated.replace(action.task.title, String(next.title));
      if (action.diff.remoteOnly.includes("completed") && !action.diff.recurringRemoteCompletion) updated = updated.replace(/(\s*[-*+]\s+\[)[ xX](\])/, `$1${next.completed ? "x" : " "}$2`);
      lines[line] = updated;
      await this.app.vault.modify(file, lines.join(newline));
      this.state.bindings[keyFor(action.path, binding.id)] = { locator: lineLocator(lines, line), baseline: normalizedTask(remote), projectId: binding.projectId };
    }
  }
  async conflicts() {
    await this.load();
    return this.state.conflicts;
  }
  bindingForTask(taskId) {
    const entry = Object.entries(this.state.bindings).find(([key]) => key.endsWith(`:${taskId}`));
    return entry ? { key: entry[0], ...entry[1] } : null;
  }
  async rescheduleBoundTask(taskId, targetDay) {
    await this.load();
    const binding = this.bindingForTask(taskId);
    if (!binding?.projectId) throw new Error("\u0627\u06CC\u0646 task \u0628\u0647 \u06CC\u06A9 \u062E\u0637 Markdown \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0645\u062A\u0635\u0644 \u0646\u06CC\u0633\u062A.");
    await this.storage.writeSnapshot("calendar-reschedule", { taskId, projectId: binding.projectId, targetDay });
    const remote = await this.getClient().getTask(binding.projectId, taskId);
    if (!remote?.id) throw new Error("\u0648\u0638\u06CC\u0641\u0647\u0654 TickTick \u067E\u06CC\u0634 \u0627\u0632 \u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u062F\u0648\u0628\u0627\u0631\u0647 \u062E\u0648\u0627\u0646\u062F\u0647 \u0646\u0634\u062F.");
    if (remote.repeatFlag) throw new Error("\u0628\u0631\u0627\u06CC \u062A\u0633\u06A9 \u062A\u06A9\u0631\u0627\u0631\u0634\u0648\u0646\u062F\u0647\u060C \u0633\u0631\u06CC \u0631\u0627 \u0627\u0632 \u0648\u06CC\u0631\u0627\u06CC\u0634\u06AF\u0631 TickTick \u062A\u063A\u06CC\u06CC\u0631 \u0628\u062F\u0647\u061B occurrence \u0645\u062D\u0644\u06CC \u0633\u0627\u062E\u062A\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.");
    const oldStart = String(remote.startDate ?? "").slice(0, 10);
    const oldDue = String(remote.dueDate ?? "").slice(0, 10);
    const duration = oldStart && oldDue ? Math.max(0, Math.round((Date.parse(`${oldDue}T12:00:00Z`) - Date.parse(`${oldStart}T12:00:00Z`)) / 864e5)) : 0;
    const dueDate = duration ? /* @__PURE__ */ new Date(`${targetDay}T12:00:00Z`) : null;
    if (dueDate) dueDate.setUTCDate(dueDate.getUTCDate() + duration);
    const next = { ...remote, startDate: `${targetDay}T00:00:00+03:30`, dueDate: `${dueDate ? dueDate.toISOString().slice(0, 10) : targetDay}T00:00:00+03:30`, isAllDay: true };
    await this.getClient().updateTask(next);
    this.state.bindings[binding.key] = { ...binding, baseline: normalizedTask(next) };
    await this.save();
    await this.storage.writeReport("calendar-reschedule", { taskId, projectId: binding.projectId, oldStart, oldDue, targetDay });
    return next;
  }
  async completeBoundTask(taskId) {
    await this.load();
    const binding = this.bindingForTask(taskId);
    if (!binding?.projectId) throw new Error("\u0627\u06CC\u0646 task \u0628\u0647 \u06CC\u06A9 \u062E\u0637 Markdown \u062A\u0623\u06CC\u06CC\u062F\u0634\u062F\u0647 \u0645\u062A\u0635\u0644 \u0646\u06CC\u0633\u062A.");
    await this.storage.writeSnapshot("board-complete", { taskId, projectId: binding.projectId });
    const remote = await this.getClient().getTask(binding.projectId, taskId);
    if (!remote?.id) throw new Error("\u0648\u0638\u06CC\u0641\u0647\u0654 TickTick \u067E\u06CC\u0634 \u0627\u0632 \u062A\u06A9\u0645\u06CC\u0644 \u062F\u0648\u0628\u0627\u0631\u0647 \u062E\u0648\u0627\u0646\u062F\u0647 \u0646\u0634\u062F.");
    await this.getClient().completeTask(binding.projectId, taskId);
    this.state.bindings[binding.key] = { ...binding, baseline: normalizedTask({ ...remote, completed: true }) };
    await this.save();
    await this.storage.writeReport("board-complete", { taskId, projectId: binding.projectId });
  }
  async resolve(conflict, choice) {
    await this.load();
    if (choice === "unbind") {
      const file = this.app.vault.getAbstractFileByPath(conflict.path);
      if (file instanceof import_obsidian.TFile) {
        const text = await this.app.vault.read(file);
        const lines = text.split(/\r?\n/);
        const line = locateLine(lines, lineLocator(lines, conflict.line));
        if (line !== null) await this.app.vault.modify(file, lines.map((value, index) => index === line ? removeTaskBinding(value) : value).join(text.includes("\r\n") ? "\r\n" : "\n"));
      }
    }
    if ((choice === "local" || choice === "remote") && conflict.binding && conflict.task && conflict.remote) {
      const file = this.app.vault.getAbstractFileByPath(conflict.path);
      const fresh = await this.getClient().getTask(conflict.binding.projectId, conflict.binding.id);
      if (!fresh?.id) throw new Error("\u0648\u0638\u06CC\u0641\u0647\u0654 TickTick \u0628\u0631\u0627\u06CC \u062D\u0644 \u062A\u0639\u0627\u0631\u0636 \u062F\u0648\u0628\u0627\u0631\u0647 \u062E\u0648\u0627\u0646\u062F\u0647 \u0646\u0634\u062F.");
      if (choice === "local") {
        if (conflict.task.completed && Number(fresh.status) === 0) await this.getClient().completeTask(conflict.binding.projectId, conflict.binding.id);
        await this.getClient().updateTask({ ...fresh, title: conflict.task.title, projectId: conflict.binding.projectId, status: conflict.task.completed ? 2 : 0 });
        this.state.bindings[keyFor(conflict.path, conflict.binding.id)] = { baseline: normalizedTask({ ...fresh, title: conflict.task.title, completed: conflict.task.completed }), projectId: conflict.binding.projectId };
      } else if (file instanceof import_obsidian.TFile) {
        const text = await this.app.vault.read(file);
        const lines = text.split(/\r?\n/);
        const line = locateLine(lines, lineLocator(lines, conflict.line));
        if (line === null) throw new Error("\u062E\u0637 Markdown \u0628\u0631\u0627\u06CC \u062D\u0644 \u062A\u0639\u0627\u0631\u0636 \u0627\u0645\u0646 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
        let updated = lines[line].replace(conflict.task.title, String(fresh.title ?? conflict.task.title));
        updated = updated.replace(/(\s*[-*+]\s+\[)[ xX](\])/, `$1${Number(fresh.status) !== 0 ? "x" : " "}$2`);
        lines[line] = updated;
        await this.app.vault.modify(file, lines.join(text.includes("\r\n") ? "\r\n" : "\n"));
        this.state.bindings[keyFor(conflict.path, conflict.binding.id)] = { baseline: normalizedTask(fresh), projectId: conflict.binding.projectId };
      }
    }
    if (choice !== "merge" && choice !== "skip") this.state.conflicts = this.state.conflicts.filter((item) => item !== conflict);
    await this.save();
    await this.storage.writeReport("markdown-sync-conflict", { choice, path: conflict.path, line: conflict.line, fields: conflict.diff?.conflicts?.map((item) => item.field) ?? [] });
  }
  async repairLegacyBindings() {
    const result = await this.preview();
    return { repaired: 0, ...result };
  }
};

// src/obsidian/conflict-modal.ts
var import_obsidian2 = require("obsidian");
var MarkdownConflictModal = class extends import_obsidian2.Modal {
  constructor(app, conflict) {
    super(app);
    this.conflict = conflict;
  }
  resolveChoice;
  openAndWait() {
    this.open();
    return new Promise((resolve) => {
      this.resolveChoice = resolve;
    });
  }
  onOpen() {
    this.titleEl.setText("\u062A\u0639\u0627\u0631\u0636 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC Markdown \u0648 TickTick");
    this.contentEl.createEl("p", { text: `${this.conflict.path}:${this.conflict.line + 1} \u2014 ${this.conflict.message}` });
    for (const item of this.conflict.diff?.conflicts ?? []) this.contentEl.createEl("pre", { text: `${item.field}
Obsidian: ${JSON.stringify(item.local)}
TickTick: ${JSON.stringify(item.remote)}` });
    const choose = (choice) => {
      this.resolveChoice(choice);
      this.close();
    };
    new import_obsidian2.Setting(this.contentEl).addButton((button) => button.setButtonText("\u0646\u06AF\u0647\u200C\u062F\u0627\u0634\u062A\u0646 Obsidian").setCta().onClick(() => choose("local"))).addButton((button) => button.setButtonText("\u0646\u06AF\u0647\u200C\u062F\u0627\u0634\u062A\u0646 TickTick").onClick(() => choose("remote")));
    new import_obsidian2.Setting(this.contentEl).addButton((button) => button.setButtonText("\u062A\u0631\u06A9\u06CC\u0628 \u0641\u06CC\u0644\u062F\u0647\u0627\u06CC \u0628\u06CC\u200C\u062A\u0639\u0627\u0631\u0636").onClick(() => choose("merge"))).addButton((button) => button.setButtonText("\u0628\u0631\u062F\u0627\u0634\u062A\u0646 binding").onClick(() => choose("unbind"))).addButton((button) => button.setButtonText("\u0631\u062F \u06A9\u0631\u062F\u0646").onClick(() => choose("skip")));
  }
  onClose() {
    this.contentEl.empty();
  }
};
var PendingMutationConflictModal = class extends import_obsidian2.Modal {
  constructor(app, operations, resolve) {
    super(app);
    this.operations = operations;
    this.resolve = resolve;
  }
  onOpen() {
    this.titleEl.setText("\u062A\u063A\u06CC\u06CC\u0631\u0647\u0627\u06CC \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC");
    this.contentEl.createEl("p", { text: "\u0627\u06CC\u0646 \u062A\u063A\u06CC\u06CC\u0631\u0647\u0627 \u0628\u0647\u200C\u0635\u0648\u0631\u062A \u0645\u062D\u0644\u06CC \u062D\u0641\u0638 \u0634\u062F\u0647\u200C\u0627\u0646\u062F\u060C \u0627\u0645\u0627 TickTick \u0622\u0646\u200C\u0647\u0627 \u0631\u0627 \u062F\u0631 \u0622\u062E\u0631\u06CC\u0646 \u0627\u0631\u0633\u0627\u0644 \u0646\u067E\u0630\u06CC\u0631\u0641\u062A\u0647 \u0627\u0633\u062A." });
    if (!this.operations.length) {
      this.contentEl.createEl("p", { text: "\u062A\u0639\u0627\u0631\u0636\u06CC \u0628\u0631\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A \u0628\u0627\u0642\u06CC \u0646\u0645\u0627\u0646\u062F\u0647 \u0627\u0633\u062A." });
      return;
    }
    for (const operation of this.operations) {
      const payload = operation.payload ?? {};
      const card = this.contentEl.createDiv({ cls: "ticktick-conflict-card" });
      card.createEl("strong", { text: String(payload.title ?? payload.id ?? "\u062A\u063A\u06CC\u06CC\u0631 \u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646") });
      card.createEl("small", { text: `\u0639\u0645\u0644\u06CC\u0627\u062A: ${operation.type} \xB7 \u062B\u0628\u062A \u0645\u062D\u0644\u06CC: ${new Date(operation.queuedAt ?? Date.now()).toLocaleString("fa-IR")}` });
      const controls = card.createDiv({ cls: "modal-button-container" });
      controls.createEl("button", { text: "\u062A\u0644\u0627\u0634 \u062F\u0648\u0628\u0627\u0631\u0647", cls: "mod-cta" }).addEventListener("click", async () => {
        await this.resolve(operation, "retry");
        this.close();
      });
      controls.createEl("button", { text: "\u062D\u0630\u0641 \u062A\u063A\u06CC\u06CC\u0631 \u0645\u062D\u0644\u06CC" }).addEventListener("click", async () => {
        await this.resolve(operation, "discard");
        this.close();
      });
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/obsidian/planning-calendar.ts
var import_obsidian6 = require("obsidian");

// src/obsidian/habit-card.ts
var import_obsidian4 = require("obsidian");

// src/obsidian/helpers.ts
var import_obsidian3 = require("obsidian");

// src/core/checklist.js
function normalizeChecklist(items) {
  return (Array.isArray(items) ? items : []).map((item, index) => ({ id: item?.id ? String(item.id) : null, title: String(item?.title ?? item?.content ?? "").trim(), completed: item?.completed !== void 0 ? Boolean(item.completed) : Number(item?.status ?? 0) !== 0, sortOrder: Number(item?.sortOrder ?? index), unknown: Object.fromEntries(Object.entries(item ?? {}).filter(([key]) => !["id", "title", "content", "status", "sortOrder", "completed", "completedTime", "startDate", "dueDate", "isAllDay", "timeZone"].includes(key))) })).sort((a, b) => a.sortOrder - b.sortOrder);
}
function checklistSummary(items) {
  const normalized = normalizeChecklist(items);
  return { total: normalized.length, completed: normalized.filter((item) => item.completed).length };
}

// src/obsidian/helpers.ts
function currentPlatformName() {
  if (import_obsidian3.Platform.isWin) return "Windows";
  if (import_obsidian3.Platform.isMacOS) return "macOS";
  if (import_obsidian3.Platform.isLinux) return "Linux";
  return "Unknown";
}
function appendChecklistSummary(parent, task, enabled) {
  const summary = checklistSummary(task.items);
  if (!summary.total) return;
  const detail = parent.createEl("details", { cls: "ticktick-checklist-readonly" });
  detail.createEl("summary", { text: `Checklist: ${summary.completed}/${summary.total}${enabled ? " \xB7 \u0641\u0642\u0637 \u062E\u0648\u0627\u0646\u062F\u0646\u06CC" : " \xB7 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644"}` });
  for (const item of task.items ?? []) {
    detail.createEl("div", { text: `${Number(item.status ?? 0) !== 0 ? "\u2611" : "\u2610"} ${String(item.title ?? item.content ?? "")}` });
  }
}
function formatTaskDate(dueDate, today) {
  if (!dueDate) return "\u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E";
  if (dueDate === today) return "\u0627\u0645\u0631\u0648\u0632";
  const date = /* @__PURE__ */ new Date(`${dueDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dueDate;
  const label = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric" }).format(date);
  return dueDate < today ? `\u0639\u0642\u0628\u200C\u0627\u0641\u062A\u0627\u062F\u0647 \xB7 ${label}` : label;
}
function formatTaskSchedule(startDate, dueDate, today) {
  if (!startDate || !dueDate || startDate === dueDate) return formatTaskDate(dueDate, today);
  const format = (dateKey2) => {
    const value = /* @__PURE__ */ new Date(`${dateKey2}T12:00:00`);
    return Number.isNaN(value.getTime()) ? dateKey2 : new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "numeric", day: "numeric" }).format(value);
  };
  return `\u0627\u0632 ${format(startDate)} \u062A\u0627 ${format(dueDate)}`;
}
function formatRecurringTaskSchedule(startDate, dueDate, today) {
  if (!startDate || !dueDate || startDate === dueDate) return formatTaskSchedule(startDate, dueDate, today);
  const weekday = (dateKey2) => new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long" }).format(/* @__PURE__ */ new Date(`${dateKey2}T12:00:00`));
  return `\u0627\u0632 ${weekday(startDate)} \u062A\u0627 ${weekday(dueDate)}`;
}
function cleanTaskDescription(value) {
  return String(value ?? "").replace(/^\s*\[[^\]]+\]\(obsidian:\/\/[^)]+\)\s*$/gim, "").replace(/obsidian:\/\/[^\s<\])]+/gi, "").replace(/^\s*-{10,}\s*$/gm, "").replace(/\n{3,}/g, "\n\n").trim();
}
function cleanTaskTitle(value) {
  return String(value ?? "").replace(/\s*\[[^\]]+\]\(obsidian:\/\/[^)]+\)\s*/gi, " ").trim();
}
function habitDashboardSection(habit) {
  return String(habit.sectionName ?? "\u0628\u062F\u0648\u0646 \u062F\u0633\u062A\u0647");
}
function habitDashboardCadence(habit) {
  const values = [habit.tags, habit.tagNames, habit.tag].flatMap((value) => Array.isArray(value) ? value : value == null ? [] : [value]).map((value) => String(value).trim().toLocaleLowerCase("fa"));
  if (values.some((value) => value === "\u0631\u0648\u0632\u0627\u0646\u0647" || value === "daily")) return "\u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0631\u0648\u0632\u0627\u0646\u0647";
  if (values.some((value) => value === "\u0647\u0641\u062A\u06AF\u06CC" || value === "weekly")) return "\u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0647\u0641\u062A\u06AF\u06CC";
  return String(habit.repeatRule ?? "").toUpperCase().includes("FREQ=WEEKLY") ? "\u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0647\u0641\u062A\u06AF\u06CC" : "\u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0631\u0648\u0632\u0627\u0646\u0647";
}
function habitDashboardGroup(habit) {
  return `${habitDashboardCadence(habit)}\0${habitDashboardSection(habit)}`;
}
function habitDashboardGroupLabel(group) {
  const [cadence, section] = group.split("\0");
  return section ? `${cadence} \xB7 ${section}` : cadence;
}
function habitStreak(history) {
  let total = 0;
  for (const entry of history.slice().reverse()) {
    if (!entry.completed) break;
    total++;
  }
  return total;
}
function parseRecurringDays(repeatFlag, dateKey2) {
  const rule = String(repeatFlag ?? "").toUpperCase();
  const match = rule.match(/BYDAY=([^;]+)/);
  const map = { "SA": "\u0634\u0646\u0628\u0647", "SU": "\u06CC\u06A9\u0634\u0646\u0628\u0647", "MO": "\u062F\u0648\u0634\u0646\u0628\u0647", "TU": "\u0633\u0647\u200C\u0634\u0646\u0628\u0647", "WE": "\u0686\u0647\u0627\u0631\u0634\u0646\u0628\u0647", "TH": "\u067E\u0646\u062C\u200C\u0634\u0646\u0628\u0647", "FR": "\u062C\u0645\u0639\u0647" };
  const order = ["SA", "SU", "MO", "TU", "WE", "TH", "FR"];
  const jsDayMap = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
  let days = [];
  if (match) {
    days = match[1].split(",");
  } else if (rule.includes("FREQ=WEEKLY") && dateKey2) {
    const d = /* @__PURE__ */ new Date(`${dateKey2}T12:00:00`);
    if (!Number.isNaN(d.getTime())) {
      days = [jsDayMap[d.getDay()]];
    }
  }
  if (days.length > 0) {
    days.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    if (days.length === 7) return "\u0647\u0631 \u0631\u0648\u0632";
    const mapped = days.map((d) => map[d]).filter(Boolean);
    if (days.length >= 2 && days.join(",") === order.slice(order.indexOf(days[0]), order.indexOf(days[0]) + days.length).join(",")) {
      return `\u0627\u0632 ${mapped[0]} \u062A\u0627 ${mapped[mapped.length - 1]}`;
    }
    return mapped.map((d) => d + "\u200C\u0647\u0627").join("\u060C ");
  }
  if (rule.includes("FREQ=DAILY")) return "\u0647\u0631 \u0631\u0648\u0632";
  if (rule.includes("FREQ=WEEKLY")) return "\u0647\u0631 \u0647\u0641\u062A\u0647";
  if (rule.includes("FREQ=MONTHLY")) return "\u0645\u0627\u0647\u0627\u0646\u0647";
  if (rule.includes("FREQ=YEARLY")) return "\u0633\u0627\u0644\u0627\u0646\u0647";
  return "";
}
function recurringKind(repeatFlag) {
  const rule = String(repeatFlag ?? "").toUpperCase();
  if (rule.includes("FREQ=WEEKLY")) return "weekly";
  if (rule.includes("FREQ=MONTHLY")) return "monthly";
  if (rule.includes("FREQ=YEARLY")) return "yearly";
  if (rule.includes("FREQ=DAILY")) return "daily";
  return "other";
}
function recurringTaskKind(task) {
  const tagValues = [task.tags, task.tagNames, task.tag].flatMap((value) => Array.isArray(value) ? value : value == null ? [] : [value]).map((value) => String(value).trim().replace(/^#/, "").toLocaleLowerCase("fa"));
  const taggedKind = (name, kind) => tagValues.includes(name) || new RegExp(`(?:^|\\s)#${name}(?=\\s|$)`, "iu").test(`${task.title ?? ""}
${task.content ?? ""}
${task.desc ?? ""}`) ? kind : null;
  return taggedKind("\u0631\u0648\u0632\u0627\u0646\u0647", "daily") ?? taggedKind("\u0647\u0641\u062A\u06AF\u06CC", "weekly") ?? taggedKind("\u0645\u0627\u0647\u0627\u0646\u0647", "monthly") ?? taggedKind("\u0633\u0627\u0644\u0627\u0646\u0647", "yearly") ?? recurringKind(task.repeatFlag);
}
function shiftIsoDay(day, amount) {
  const value = /* @__PURE__ */ new Date(`${day}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}
function normalizeCache(value) {
  const candidate = value;
  if (!candidate || typeof candidate !== "object") {
    return { savedAt: "", tasks: [], projects: [], projectBoards: {}, habits: [], habitCheckins: {}, pending: [], conflicts: [], rateLimitedUntil: 0 };
  }
  return {
    savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : "",
    tasks: Array.isArray(candidate.tasks) ? candidate.tasks : [],
    projects: Array.isArray(candidate.projects) ? candidate.projects : [],
    projectBoards: candidate.projectBoards && typeof candidate.projectBoards === "object" ? candidate.projectBoards : {},
    habits: Array.isArray(candidate.habits) ? candidate.habits : [],
    habitCheckins: candidate.habitCheckins && typeof candidate.habitCheckins === "object" ? candidate.habitCheckins : {},
    pending: Array.isArray(candidate.pending) ? candidate.pending : [],
    conflicts: Array.isArray(candidate.conflicts) ? candidate.conflicts : [],
    rateLimitedUntil: Math.max(0, Number(candidate.rateLimitedUntil ?? 0))
  };
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function nextWeekday(day, weekday, forceNextWeek) {
  const current = (/* @__PURE__ */ new Date(`${day}T12:00:00Z`)).getUTCDay();
  let offset = (weekday - current + 7) % 7;
  if (forceNextWeek || offset === 0) offset += 7;
  return shiftIsoDay(day, offset);
}
function checkboxSchedule(source, today) {
  const rules = [
    { pattern: /#امروز(?=\s|$)/giu, due: () => today },
    { pattern: /#فردا(?=\s|$)/giu, due: () => shiftIsoDay(today, 1) },
    { pattern: /#پس(?:[-_‌\s])?فردا(?=\s|$)/giu, due: () => shiftIsoDay(today, 2) },
    { pattern: /#این(?:[-_‌\s])?هفته(?=\s|$)/giu, due: () => nextWeekday(today, 5, false) },
    { pattern: /#هفته(?:[-_‌\s])?بعد(?=\s|$)/giu, due: () => nextWeekday(today, 6, true) },
    {
      pattern: /#ماه(?:[-_‌\s])?بعد(?=\s|$)/giu,
      due: () => {
        const date = /* @__PURE__ */ new Date(`${today}T12:00:00Z`);
        date.setUTCMonth(date.getUTCMonth() + 1, 1);
        return date.toISOString().slice(0, 10);
      }
    }
  ];
  const weekdays = { "\u0634\u0646\u0628\u0647": 6, "\u06CC\u06A9\u0634\u0646\u0628\u0647": 0, "\u062F\u0648\u0634\u0646\u0628\u0647": 1, "\u0633\u0647\u200C\u0634\u0646\u0628\u0647": 2, "\u0686\u0647\u0627\u0631\u0634\u0646\u0628\u0647": 3, "\u067E\u0646\u062C\u0634\u0646\u0628\u0647": 4, "\u062C\u0645\u0639\u0647": 5 };
  for (const [name, weekday] of Object.entries(weekdays)) {
    rules.push({ pattern: new RegExp(`#${name}(?=\\s|$)`, "giu"), due: () => nextWeekday(today, weekday, false) });
  }
  for (const rule of rules) {
    if (rule.pattern.test(source)) {
      return { dueDate: rule.due(), title: source.replace(rule.pattern, "").replace(/\s+/g, " ").trim() };
    }
  }
  return { dueDate: "", title: source.replace(/\s+/g, " ").trim() };
}
function isHabitScheduledForCachedDay(habit, day) {
  return isHabitScheduledForDay(habit, day);
}
function dailyNoteDateFromPath(path) {
  const match = path.match(/(?:^|[\\/])(1[34]\d{2}-\d{2}-\d{2})\.md$/);
  return match ? jalaliDateKeyToGregorian(match[1]) ?? void 0 : void 0;
}
async function addDescriptionToggle(app, component, body, actions, task) {
  const description = cleanTaskDescription(task.desc || task.content);
  const button = actions.createEl("button", { cls: "mod-icon", attr: { "aria-label": "\u062A\u0648\u0636\u06CC\u062D\u0627\u062A" } });
  (0, import_obsidian3.setIcon)(button, "file-text");
  const panel = body.createDiv({ cls: "ticktick-bridge-description" });
  panel.addClass("is-hidden");
  await import_obsidian3.MarkdownRenderer.render(app, description || "\u062A\u0648\u0636\u06CC\u062D\u06CC \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u062A\u0633\u06A9 \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.", panel, "", component);
  button.addEventListener("click", () => panel.classList.toggle("is-hidden"));
}
function reminderTrigger(time) {
  const [hours, minutes] = time.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return "";
  return `TRIGGER:P0DT${hours}H${minutes}M0S`;
}
function reminderTimeFromTask(task) {
  for (const reminder of Array.isArray(task.reminders) ? task.reminders : []) {
    const match = String(reminder).match(/P0?DT(\d+)H(\d+)M/i);
    if (match) return `${match[1].padStart(2, "0")}:${match[2].padStart(2, "0")}`;
  }
  return "";
}
function toTaskPayload(draft, timeZone) {
  const { projectName, dueDate, reminderTime, reminders: _reminders, ...task } = draft;
  const day = String(dueDate ?? "").slice(0, 10);
  return {
    ...task,
    title: String(task.title ?? "").trim(),
    desc: String(task.desc || task.content || "").trim(),
    content: "",
    projectId: task.projectId,
    dueDate: day ? `${day}T00:00:00+0330` : null,
    startDate: task.startDate ?? null,
    timeZone,
    isAllDay: true,
    reminders: reminderTime ? [reminderTrigger(reminderTime)] : [],
    repeatFlag: String(task.repeatFlag ?? "").trim() || null
  };
}
function publicCacheMetadata(cache) {
  const task = (item) => ({ id: item?.id, projectId: item?.projectId, title: item?.title, status: item?.status, dueDate: item?.dueDate, startDate: item?.startDate });
  const habit = (item) => ({ id: item?.id, name: item?.name, status: item?.status, sectionId: item?.sectionId, sectionName: item?.sectionName });
  return { savedAt: cache.savedAt, tasks: cache.tasks.map(task), habits: cache.habits.map(habit), pendingCount: cache.pending.length, conflictCount: cache.conflicts.length };
}

// src/obsidian/habit-card.ts
function habitCategoryTone(category) {
  const cat = String(category).toLowerCase();
  if (/زبان|انگلیسی|کتاب|مطالعه|learn|english|language|book|read/.test(cat)) {
    return "var(--tb-habit-language, #eab308)";
  }
  if (/سلامت|ورزش|بدنسازی|تمرین|fitness|sport|health|workout|run|gym/.test(cat)) {
    return "var(--tb-habit-health, #10b981)";
  }
  if (/شخصی|خواب|آب|water|drink|sleep|routine|نوشیدن|استراحت/.test(cat)) {
    return "var(--tb-habit-personal, #3b82f6)";
  }
  if (/کار|توسعه|پروژه|کد|work|dev|code|productiv|برنامه‌نویسی/.test(cat)) {
    return "var(--tb-habit-work, #8b5cf6)";
  }
  if (/ذهن|مدیتیشن|آرامش|mind|meditat|calm|تمرکز/.test(cat)) {
    return "var(--tb-habit-mind, #06b6d4)";
  }
  return "var(--interactive-accent)";
}
function resolveHabitGlyph(habit) {
  const iconStr = String(habit.iconRes ?? habit.icon ?? "").toLowerCase();
  const nameStr = String(habit.name ?? "").toLowerCase();
  const combined = `${iconStr} ${nameStr}`;
  if (/language|book|read|learn|کتاب|مطالعه|زبان|انگلیسی/.test(combined)) return "\u{1F4DA}";
  if (/sport|run|fitness|exercise|gym|ورزش|دویدن|تمرین|بدنسازی/.test(combined)) return "\u{1F3C3}";
  if (/meditat|mind|calm|ذهن|مدیتیشن|آرامش|تمرکز/.test(combined)) return "\u{1F9D8}";
  if (/water|drink|آب|نوشیدن/.test(combined)) return "\u{1F4A7}";
  if (/sleep|خواب|استراحت/.test(combined)) return "\u{1F319}";
  if (/music|listen|پادکست|موسیقی|اهنگ|audio/.test(combined)) return "\u{1F3A7}";
  if (/write|note|نویسندگی|نوشتن|یادداشت|قلم/.test(combined)) return "\u270D\uFE0F";
  if (/code|dev|work|برنامه‌نویسی|کد|کار|توسعه/.test(combined)) return "\u{1F4BB}";
  return "\u26A1";
}
function renderUnifiedHabitCard(parent, options) {
  const { habit, day, variant = "dashboard", onCheckIn, onOpenDetails } = options;
  const goal = Math.max(1, Number(habit.checkin?.goal ?? habit.goal ?? habit.target ?? 1));
  const currentValue = Number(habit.checkin?.value ?? 0);
  const completed = Number(habit.checkin?.status ?? 0) === 2 || currentValue >= goal;
  const progress = Math.min(1, Math.max(0, currentValue / goal));
  const sectionName = habit.sectionName || habitDashboardSection(habit);
  const tone = habitCategoryTone(sectionName || habit.name || "");
  const isPlanner = variant === "planner";
  const card = parent.createDiv({
    cls: `ticktick-habit-card ${isPlanner ? "is-planner-row" : "is-card"} ${completed ? "is-done is-success" : ""}`,
    attr: {
      role: "button",
      tabindex: "0",
      "aria-label": `\u0639\u0627\u062F\u062A: ${habit.name}`
    }
  });
  card.style.setProperty("--card-tone", tone);
  card.dataset.habitId = String(habit.id);
  const progressRing = card.createEl("button", {
    cls: `ticktick-habit-progress ${completed ? "is-complete" : ""}`,
    attr: {
      type: "button",
      "aria-label": completed ? `\u0644\u063A\u0648 \u062B\u0628\u062A ${habit.name}` : `\u062B\u0628\u062A \u06CC\u06A9 \u0645\u0631\u062D\u0644\u0647 \u0627\u0632 ${habit.name}`,
      title: completed ? "\u0628\u0631\u0627\u06CC \u0644\u063A\u0648 \u06A9\u0644\u06CC\u06A9 \u06A9\u0646\u06CC\u062F" : "\u0628\u0631\u0627\u06CC \u062B\u0628\u062A \u06CC\u06A9 \u0645\u0631\u062D\u0644\u0647 \u06A9\u0644\u06CC\u06A9 \u06A9\u0646\u06CC\u062F"
    }
  });
  progressRing.style.setProperty("--ticktick-progress", `${Math.round(progress * 360)}deg`);
  const glyphSpan = progressRing.createSpan({
    cls: "ticktick-habit-glyph",
    text: completed ? "\u2713" : resolveHabitGlyph(habit)
  });
  const body = card.createDiv({ cls: "ticktick-habit-body" });
  body.createDiv({ cls: "ticktick-habit-title", text: String(habit.name ?? "\u0639\u0627\u062F\u062A") });
  const meta = body.createDiv({ cls: "ticktick-habit-meta" });
  if (sectionName && sectionName !== "\u0628\u062F\u0648\u0646 \u062F\u0633\u062A\u0647" && !isPlanner) {
    meta.createSpan({ cls: "ticktick-habit-tag", text: sectionName });
  }
  const progressText = goal > 1 ? `${currentValue}/${goal} ${habit.unit ?? "\u0645\u0631\u062D\u0644\u0647"}` : completed ? "\u0627\u0646\u062C\u0627\u0645 \u0634\u062F" : "\u0622\u0645\u0627\u062F\u0647 \u062B\u0628\u062A";
  meta.createSpan({
    cls: `ticktick-habit-count ${completed ? "is-done" : ""}`,
    text: progressText
  });
  if (options.streak && options.streak > 1 && !isPlanner) {
    meta.createSpan({ cls: "ticktick-habit-streak-pill", text: `\u{1F525} ${options.streak}` });
  }
  if (options.showHistoryDots && habit.history?.length) {
    const dotsWrap = card.createDiv({ cls: "ticktick-habit-history-dots" });
    for (const entry of habit.history) {
      dotsWrap.createSpan({
        cls: `ticktick-habit-dot ${entry.completed ? "is-complete" : "is-missed"}`,
        attr: { title: `${entry.date}: ${entry.completed ? "\u0627\u0646\u062C\u0627\u0645 \u0634\u062F" : "\u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F"}` }
      });
    }
  }
  const handleCardClick = () => {
    if (onOpenDetails) {
      onOpenDetails(habit, day);
    } else {
      void onCheckIn(habit, day);
    }
  };
  card.addEventListener("click", handleCardClick);
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCardClick();
    }
  });
  progressRing.addEventListener("click", async (event) => {
    event.preventDefault();
    event.stopPropagation();
    progressRing.disabled = true;
    glyphSpan.addClass("is-checking");
    try {
      await onCheckIn(habit, day);
    } catch (error) {
      new import_obsidian4.Notice(error instanceof Error ? error.message : "\u062B\u0628\u062A \u0639\u0627\u062F\u062A \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    } finally {
      glyphSpan.removeClass("is-checking");
      progressRing.disabled = false;
    }
  });
  return card;
}

// src/core/calendar-range.js
function shiftCalendarDay(day, amount) {
  const date = /* @__PURE__ */ new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
function weekdayIndex(day) {
  return (/* @__PURE__ */ new Date(`${day}T12:00:00.000Z`)).getUTCDay();
}
function weekRange(day, firstWeekday = 6) {
  const offset = (weekdayIndex(day) - firstWeekday + 7) % 7;
  const start = shiftCalendarDay(day, -offset);
  return Array.from({ length: 7 }, (_, index) => shiftCalendarDay(start, index));
}
function monthRange(day, firstWeekday = 6) {
  const monthStart = `${String(day).slice(0, 7)}-01`;
  const offset = (weekdayIndex(monthStart) - firstWeekday + 7) % 7;
  const start = shiftCalendarDay(monthStart, -offset);
  return Array.from({ length: 42 }, (_, index) => shiftCalendarDay(start, index));
}
function persianParts(day) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US-u-ca-persian", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(/* @__PURE__ */ new Date(`${day}T12:00:00Z`)).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return { year: parts.year, month: parts.month, day: parts.day };
}
function pad(value) {
  return String(value).padStart(2, "0");
}
function persianMonthStart(year, month) {
  return jalaliDateKeyToGregorian(`${year}-${pad(month)}-01`);
}
function shiftedPersianMonth(year, month, amount) {
  const index = year * 12 + (month - 1) + amount;
  return { year: Math.floor(index / 12), month: index % 12 + 1 };
}
function isSamePersianMonth(day, referenceDay) {
  const left = persianParts(day);
  const right = persianParts(referenceDay);
  return left.year === right.year && left.month === right.month;
}
function persianMonthRange(day, firstWeekday = 6) {
  const current = persianParts(day);
  const monthStart = persianMonthStart(current.year, current.month);
  if (!monthStart) return monthRange(day, firstWeekday);
  const next = shiftedPersianMonth(current.year, current.month, 1);
  const nextStart = persianMonthStart(next.year, next.month);
  const last = nextStart ? shiftCalendarDay(nextStart, -1) : shiftCalendarDay(monthStart, 30);
  const offset = (weekdayIndex(monthStart) - firstWeekday + 7) % 7;
  const start = shiftCalendarDay(monthStart, -offset);
  const needed = Math.ceil((dayNumber(last) - dayNumber(start) + 1) / 7) * 7;
  return Array.from({ length: Math.max(35, needed) }, (_, index) => shiftCalendarDay(start, index));
}
function shiftPersianMonth(day, amount) {
  const current = persianParts(day);
  const target = shiftedPersianMonth(current.year, current.month, amount);
  const start = persianMonthStart(target.year, target.month);
  const following = shiftedPersianMonth(target.year, target.month, 1);
  const nextStart = persianMonthStart(following.year, following.month);
  if (!start || !nextStart) return shiftCalendarDay(day, amount * 30);
  const length = dayNumber(nextStart) - dayNumber(start);
  return shiftCalendarDay(start, Math.min(current.day, length) - 1);
}
function taskDay(task, timeZone) {
  return toDateKey(task.dueDate, task.timeZone || timeZone) ?? toDateKey(task.startDate, task.timeZone || timeZone);
}
function isMidnightInZone(value, timeZone) {
  if (!value || !String(value).includes("T")) return false;
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return false;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(instant).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return parts.hour === "00" && parts.minute === "00";
}
function taskDateRange(task, timeZone = "Asia/Tehran") {
  const zone = task?.timeZone || timeZone;
  let start = toDateKey(task?.startDate, zone);
  let end = toDateKey(task?.dueDate, zone);
  if (start && end && start < end && task?.isAllDay !== false && isMidnightInZone(task?.startDate, zone) && isMidnightInZone(task?.dueDate, zone)) {
    end = shiftCalendarDay(end, -1);
  }
  if (start && end && start < end && task?.repeatFlag) {
    const rule = ruleParts(task);
    const frequency = rule.FREQ ?? "";
    const interval = Math.max(1, Number(rule.INTERVAL ?? 1));
    const period = frequency === "WEEKLY" ? interval * 7 : frequency === "DAILY" ? interval : 0;
    const span = dayNumber(end) - dayNumber(start);
    if (period > 0 && span >= period) {
      const currentSpan = span % period || Math.max(1, period - 1);
      start = shiftCalendarDay(end, -currentSpan);
    }
  }
  return start && end && start < end ? { start, end } : null;
}
function taskTime(task) {
  return String(task.startDate ?? task.dueDate ?? "").match(/T(\d{2}:\d{2})/)?.[1] ?? "";
}
function dayNumber(day) {
  return Math.floor(Date.parse(`${day}T12:00:00Z`) / 864e5);
}
function ruleParts(task) {
  const source = String(task.repeatFlag ?? "").toUpperCase().replace(/^RRULE:/, "");
  return Object.fromEntries(source.split(";").map((part) => part.split("=", 2)).filter(([key, value]) => key && value));
}
function ruleDate(value) {
  const match = String(value ?? "").match(/^(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}
function weekdayCode(day) {
  return ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][weekdayIndex(day)];
}
function excluded(task, day) {
  const values = [task.exDates, task.exDate, task.exdate].flatMap((value) => Array.isArray(value) ? value : value == null ? [] : String(value).split(","));
  return values.some((value) => ruleDate(value) === day || String(value).replaceAll("-", "").slice(0, 8) === day.replaceAll("-", ""));
}
function taskOccursOnCalendarDay(task, day, timeZone = "Asia/Tehran", showCompleted = false) {
  if (Number(task?.status ?? 0) !== 0) return showCompleted && taskDay(task, timeZone) === day;
  const due = toDateKey(task?.dueDate, task?.timeZone || timeZone);
  const start = toDateKey(task?.startDate, task?.timeZone || timeZone);
  const anchor = start ?? due;
  if (!anchor) return false;
  if (!task?.repeatFlag) return start && due ? day >= start && day <= due : day === anchor;
  if (due) return day === due;
  if (day < anchor || excluded(task, day)) return false;
  const rule = ruleParts(task);
  const frequency = rule.FREQ ?? "DAILY";
  const interval = Math.max(1, Number(rule.INTERVAL ?? 1));
  const until = ruleDate(rule.UNTIL);
  if (until && day > until) return false;
  const distance = dayNumber(day) - dayNumber(anchor);
  if (frequency === "DAILY") return distance % interval === 0;
  if (frequency === "WEEKLY") {
    const weeks = Math.floor(distance / 7);
    if (weeks % interval) return false;
    const days = rule.BYDAY ? rule.BYDAY.split(",").map((value2) => value2.replace(/^[-+]?\d+/, "")) : [weekdayCode(anchor)];
    return days.includes(weekdayCode(day));
  }
  const value = /* @__PURE__ */ new Date(`${day}T12:00:00Z`);
  const base = /* @__PURE__ */ new Date(`${anchor}T12:00:00Z`);
  if (frequency === "MONTHLY") {
    const months = (value.getUTCFullYear() - base.getUTCFullYear()) * 12 + value.getUTCMonth() - base.getUTCMonth();
    const dates = (rule.BYMONTHDAY ?? String(base.getUTCDate())).split(",").map(Number);
    return months >= 0 && months % interval === 0 && dates.includes(value.getUTCDate());
  }
  if (frequency === "YEARLY") return value.getUTCFullYear() >= base.getUTCFullYear() && (value.getUTCFullYear() - base.getUTCFullYear()) % interval === 0 && value.getUTCMonth() === base.getUTCMonth() && value.getUTCDate() === base.getUTCDate();
  return day === anchor;
}
function recurringTaskOccursOnDay(task, day, timeZone = "Asia/Tehran") {
  if (Number(task?.status ?? 0) !== 0 || !task?.repeatFlag || excluded(task, day)) return false;
  const due = toDateKey(task?.dueDate, task?.timeZone || timeZone);
  const start = toDateKey(task?.startDate, task?.timeZone || timeZone);
  const anchor = start ?? due;
  if (!anchor || day < anchor) return false;
  const rule = ruleParts(task);
  const frequency = rule.FREQ ?? "DAILY";
  const interval = Math.max(1, Number(rule.INTERVAL ?? 1));
  const until = ruleDate(rule.UNTIL);
  if (until && day > until) return false;
  const distance = dayNumber(day) - dayNumber(anchor);
  if (frequency === "DAILY") return distance % interval === 0;
  if (frequency === "WEEKLY") {
    const weeks = Math.floor(distance / 7);
    if (weeks % interval) return false;
    const days = rule.BYDAY ? rule.BYDAY.split(",").map((value2) => value2.replace(/^[-+]?\d+/, "")) : [weekdayCode(anchor)];
    return days.includes(weekdayCode(day));
  }
  const value = /* @__PURE__ */ new Date(`${day}T12:00:00Z`);
  const base = /* @__PURE__ */ new Date(`${anchor}T12:00:00Z`);
  if (frequency === "MONTHLY") {
    const months = (value.getUTCFullYear() - base.getUTCFullYear()) * 12 + value.getUTCMonth() - base.getUTCMonth();
    const dates = (rule.BYMONTHDAY ?? String(base.getUTCDate())).split(",").map(Number);
    return months >= 0 && months % interval === 0 && dates.includes(value.getUTCDate());
  }
  if (frequency === "YEARLY") return value.getUTCFullYear() >= base.getUTCFullYear() && (value.getUTCFullYear() - base.getUTCFullYear()) % interval === 0 && value.getUTCMonth() === base.getUTCMonth() && value.getUTCDate() === base.getUTCDate();
  return day === anchor;
}
function sortPlanningTasks(tasks, mode = "ticktick") {
  const byTickTick = (left, right) => Number(left.sortOrder ?? left.order ?? 0) - Number(right.sortOrder ?? right.order ?? 0) || taskTime(left).localeCompare(taskTime(right)) || Number(right.priority ?? 0) - Number(left.priority ?? 0) || String(left.title ?? "").localeCompare(String(right.title ?? ""), "fa");
  return [...tasks].sort((left, right) => {
    if (mode === "priority") {
      const priority = Number(right.priority ?? 0) - Number(left.priority ?? 0);
      if (priority) return priority;
    } else if (mode === "time") {
      const time = taskTime(left).localeCompare(taskTime(right));
      if (time) return time;
    } else if (mode === "title") {
      const title = String(left.title ?? "").localeCompare(String(right.title ?? ""), "fa");
      if (title) return title;
    }
    return byTickTick(left, right);
  });
}
function tasksForCalendarDay(tasks, day, timeZone = "Asia/Tehran", showCompleted = false, sortMode = "ticktick") {
  return sortPlanningTasks((tasks ?? []).filter((task) => taskOccursOnCalendarDay(task, day, timeZone, showCompleted)), sortMode);
}

// src/obsidian/task-details-modal.ts
var import_obsidian5 = require("obsidian");

// src/obsidian/task-priority.ts
function taskPriority(input) {
  const value = Number(input ?? 0);
  if (value >= 5) return { value: 5, label: "\u0628\u0627\u0644\u0627", icon: "\u{1F534}", className: "is-high" };
  if (value >= 3) return { value: 3, label: "\u0645\u062A\u0648\u0633\u0637", icon: "\u{1F7E0}", className: "is-medium" };
  if (value >= 1) return { value: 1, label: "\u06A9\u0645", icon: "\u{1F535}", className: "is-low" };
  return { value: 0, label: "\u0628\u062F\u0648\u0646 \u0627\u0648\u0644\u0648\u06CC\u062A", icon: "\u26AA", className: "is-none" };
}

// src/core/task-description.js
var textFields = ["desc", "content", "description", "note", "text", "body"];
function taskDescription(task) {
  for (const field of textFields) {
    const value = task?.[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
function mergeTaskDetails(cached = {}, fresh = {}) {
  const merged = { ...cached, ...fresh };
  if (taskDescription(fresh) || !taskDescription(cached)) return merged;
  for (const field of textFields) {
    if ((!merged[field] || typeof merged[field] !== "string") && typeof cached[field] === "string" && cached[field].trim()) merged[field] = cached[field];
  }
  return merged;
}

// src/core/persian-date.js
function formatPersianDate(value, timeZone = "Asia/Tehran") {
  const day = toDateKey(value, timeZone);
  if (!day) return "\u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" }).format(/* @__PURE__ */ new Date(`${day}T12:00:00Z`));
}

// src/obsidian/task-details-modal.ts
function repeatSummary(flag) {
  const rule = String(flag ?? "").toUpperCase().replace(/^RRULE:/, "");
  if (!rule) return "";
  const fields2 = Object.fromEntries(rule.split(";").map((part) => part.split("=", 2)).filter(([key, value]) => key && value));
  const labels = { MO: "\u062F\u0648\u0634\u0646\u0628\u0647", TU: "\u0633\u0647\u200C\u0634\u0646\u0628\u0647", WE: "\u0686\u0647\u0627\u0631\u0634\u0646\u0628\u0647", TH: "\u067E\u0646\u062C\u0634\u0646\u0628\u0647", FR: "\u062C\u0645\u0639\u0647", SA: "\u0634\u0646\u0628\u0647", SU: "\u06CC\u06A9\u0634\u0646\u0628\u0647" };
  const days = String(fields2.BYDAY ?? "").split(",").map((day) => labels[day.replace(/^[-+]?\d+/, "")]).filter(Boolean);
  if (days.length) return `\u{1F501} \u062A\u06A9\u0631\u0627\u0631: ${days.join("\u060C ")}`;
  return { DAILY: "\u{1F501} \u0647\u0631 \u0631\u0648\u0632", WEEKLY: "\u{1F501} \u0647\u0631 \u0647\u0641\u062A\u0647", MONTHLY: "\u{1F501} \u0647\u0631 \u0645\u0627\u0647", YEARLY: "\u{1F501} \u0647\u0631 \u0633\u0627\u0644" }[fields2.FREQ] ?? "\u{1F501} \u062A\u06A9\u0631\u0627\u0631\u0634\u0648\u0646\u062F\u0647";
}
var TaskDetailsModal = class extends import_obsidian5.Modal {
  constructor(app, task, actions = {}) {
    super(app);
    this.task = task;
    this.actions = actions;
  }
  markdownComponent = new import_obsidian5.Component();
  onOpen() {
    this.modalEl.addClass("ticktick-task-details-modal");
    this.markdownComponent.load();
    this.render();
  }
  async loadAndRender() {
    this.contentEl.empty();
    this.titleEl.setText("\u062C\u0632\u0626\u06CC\u0627\u062A \u062A\u0633\u06A9");
    if (this.actions.load) {
      this.contentEl.createDiv({ cls: "ticktick-task-details-loading", text: "\u062F\u0631 \u062D\u0627\u0644 \u062F\u0631\u06CC\u0627\u0641\u062A \u062C\u0632\u0626\u06CC\u0627\u062A \u06A9\u0627\u0645\u0644 \u0627\u0632 TickTick\u2026" });
      try {
        const fresh = await this.actions.load(this.task);
        if (fresh?.id) this.task = mergeTaskDetails(this.task, fresh);
      } catch {
      }
    }
    this.render();
  }
  render() {
    this.contentEl.empty();
    this.titleEl.setText(String(this.task.title ?? "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646"));
    const meta = this.contentEl.createDiv({ cls: "ticktick-task-details-meta" });
    const priority = taskPriority(this.task.priority);
    for (const value of [this.task.projectName, this.task.dueDate ? `\u{1F4C5} ${formatPersianDate(this.task.dueDate, this.task.timeZone)}` : "\u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E", `${priority.icon} \u0627\u0648\u0644\u0648\u06CC\u062A ${priority.label}`, repeatSummary(this.task.repeatFlag)]) if (value) meta.createSpan({ text: String(value) });
    const description = taskDescription(this.task);
    const descriptionBox = this.contentEl.createDiv({ cls: "ticktick-task-details-description" });
    descriptionBox.createEl("strong", { text: "\u062A\u0648\u0636\u06CC\u062D\u0627\u062A" });
    const descriptionContent = descriptionBox.createDiv({ cls: "markdown-rendered" });
    if (description) void import_obsidian5.MarkdownRenderer.render(this.app, description, descriptionContent, "", this.markdownComponent);
    else descriptionContent.setText("\u062A\u0648\u0636\u06CC\u062D\u06CC \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u062A\u0633\u06A9 \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.");
    const items = normalizeChecklist(this.task.items);
    if (items.length) {
      const box = this.contentEl.createDiv({ cls: "ticktick-task-details-checklist" });
      const summary = checklistSummary(items);
      box.createEl("strong", { text: `Checklist \xB7 ${summary.completed}/${summary.total}` });
      for (const item of items) box.createDiv({ text: `${item.completed ? "\u2611" : "\u2610"} ${item.title}` });
    }
    const actions = this.contentEl.createDiv({ cls: "ticktick-task-details-actions" });
    if (this.actions.complete) actions.createEl("button", { text: "\u062A\u06A9\u0645\u06CC\u0644 \u062A\u0633\u06A9", cls: "mod-cta" }).addEventListener("click", async () => {
      try {
        await this.actions.complete?.();
        this.close();
      } catch (error) {
        new import_obsidian5.Notice(error instanceof Error ? error.message : "\u062A\u06A9\u0645\u06CC\u0644 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      }
    });
    if (this.actions.edit) actions.createEl("button", { text: "\u0648\u06CC\u0631\u0627\u06CC\u0634" }).addEventListener("click", async () => {
      try {
        await this.actions.edit?.(this.task);
        await this.actions.changed?.();
        this.close();
      } catch (error) {
        new import_obsidian5.Notice(error instanceof Error ? error.message : "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      }
    });
    if (this.actions.load) actions.createEl("button", { text: "\u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u062C\u0632\u0626\u06CC\u0627\u062A" }).addEventListener("click", () => void this.loadAndRender());
  }
  onClose() {
    this.markdownComponent.unload();
    this.contentEl.empty();
  }
};

// src/obsidian/horizontal-scroll.ts
function enhanceHorizontalScroll(element) {
  let pointerId = null;
  let originX = 0;
  let originY = 0;
  let originLeft = 0;
  let moved = false;
  const interactive = [
    "button",
    "input",
    "select",
    "textarea",
    "a",
    "label",
    "[role='button']",
    ".ticktick-planner-task",
    ".ticktick-planner-month-task",
    ".ticktick-planner-range-task",
    ".ticktick-overflow-task",
    ".ticktick-project-card",
    ".ticktick-planner-day-header",
    ".ticktick-planner-month-header",
    ".ticktick-month-task-title",
    ".ticktick-task-title",
    ".ticktick-range-title",
    ".ticktick-overflow-task-title",
    ".ticktick-project-card-title"
  ].join(", ");
  element.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || element.scrollWidth <= element.clientWidth) return;
    if (event.pointerType !== "touch" && event.target instanceof HTMLElement && event.target.closest(interactive)) return;
    pointerId = event.pointerId;
    originX = event.clientX;
    originY = event.clientY;
    originLeft = element.scrollLeft;
    moved = false;
  });
  element.addEventListener("pointermove", (event) => {
    if (pointerId !== event.pointerId) return;
    const distance = event.clientX - originX;
    const verticalDistance = event.clientY - originY;
    if (!moved && Math.abs(distance) > 6 && Math.abs(distance) > Math.abs(verticalDistance)) {
      moved = true;
      element.addClass("is-horizontal-dragging");
      try {
        element.setPointerCapture(event.pointerId);
      } catch {
      }
    }
    if (moved) {
      element.scrollLeft = originLeft - distance;
      event.preventDefault();
      event.stopPropagation();
    }
  });
  const release = (event) => {
    if (pointerId !== event.pointerId) return;
    if (element.hasPointerCapture(event.pointerId)) {
      try {
        element.releasePointerCapture(event.pointerId);
      } catch {
      }
    }
    pointerId = null;
    element.removeClass("is-horizontal-dragging");
    setTimeout(() => {
      moved = false;
    }, 60);
  };
  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);
  element.addEventListener("touchmove", (event) => {
    if (!moved || event.touches.length !== 1) return;
    event.preventDefault();
    event.stopPropagation();
  }, { passive: false });
  element.addEventListener("click", (event) => {
    if (moved) {
      event.preventDefault();
      event.stopPropagation();
      moved = false;
    }
  }, { capture: true });
  element.addEventListener("wheel", (event) => {
    if (!event.shiftKey || element.scrollWidth <= element.clientWidth) return;
    const isRtl = getComputedStyle(element).direction === "rtl";
    let delta = 0;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      delta = event.deltaX;
    } else {
      delta = isRtl ? -event.deltaY : event.deltaY;
    }
    element.scrollLeft += delta;
    event.preventDefault();
  }, { passive: false });
}
function scrollToStart(element) {
  const align = () => {
    const isRtl = getComputedStyle(element).direction === "rtl";
    if (!isRtl) {
      element.scrollLeft = 0;
      return;
    }
    element.scrollLeft = 0;
    if (element.scrollLeft === 0 && element.scrollWidth > element.clientWidth) {
      element.scrollLeft = 1;
      if (element.scrollLeft > 0) {
        element.scrollLeft = element.scrollWidth - element.clientWidth;
      } else {
        element.scrollLeft = 0;
      }
    }
  };
  align();
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(align);
  }
}

// src/obsidian/planning-calendar.ts
function habitGlyph(habit) {
  const value = String(habit?.iconRes ?? habit?.icon ?? "").toLowerCase();
  if (/language|book|read|learn/.test(value)) return "\u{1F4DA}";
  if (/sport|run|fitness|exercise/.test(value)) return "\u{1F3C3}";
  if (/meditat|mind|sleep/.test(value)) return "\u{1F9D8}";
  if (/water|drink/.test(value)) return "\u{1F4A7}";
  if (/music|listen/.test(value)) return "\u{1F3B5}";
  if (/write|note/.test(value)) return "\u270D\uFE0F";
  return "\u2713";
}
function formatTaskTime(task, timeZone) {
  if (task.isAllDay) return null;
  const raw = task.startDate ?? task.dueDate;
  if (!raw || !String(raw).includes("T")) return null;
  try {
    const d = new Date(raw);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("fa-IR", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  } catch {
    const m = String(raw).match(/T(\d{2}:\d{2})/);
    return m ? m[1] : null;
  }
}
var PlannerMultiSelectModal = class extends import_obsidian6.Modal {
  constructor(app, label, values, selected, prefix = "") {
    super(app);
    this.label = label;
    this.values = values;
    this.selected = selected;
    this.prefix = prefix;
  }
  answer;
  openAndWait() {
    this.open();
    return new Promise((resolve) => {
      this.onClose = () => {
        this.contentEl.empty();
        resolve(this.answer);
      };
    });
  }
  onOpen() {
    this.modalEl.addClass("ticktick-filter-modal-dialog");
    this.titleEl.setText(`\u0641\u06CC\u0644\u062A\u0631 ${this.label}`);
    const choices = new Set(this.selected);
    const searchBox = this.contentEl.createDiv({ cls: "ticktick-filter-search-box" });
    const searchInput = searchBox.createEl("input", {
      type: "search",
      placeholder: `\u062C\u0633\u062A\u062C\u0648 \u062F\u0631 ${this.label}\u2026`,
      cls: "ticktick-filter-search-input"
    });
    const list = this.contentEl.createDiv({ cls: "ticktick-planner-filter-modal" });
    const renderList = (filterText = "") => {
      list.empty();
      const filtered = this.values.filter((v) => !filterText || v.toLowerCase().includes(filterText.toLowerCase()));
      if (!filtered.length) {
        list.createDiv({ cls: "ticktick-filter-empty", text: "\u0645\u0648\u0631\u062F\u06CC \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F" });
        return;
      }
      for (const value of filtered) {
        const row = list.createEl("label", { cls: "ticktick-filter-item" });
        const check = row.createEl("input", { type: "checkbox", cls: "ticktick-filter-checkbox" });
        check.checked = choices.has(value);
        row.createSpan({ cls: "ticktick-filter-item-text", text: `${this.prefix}${value}` });
        check.addEventListener("change", () => {
          check.checked ? choices.add(value) : choices.delete(value);
        });
      }
    };
    searchInput.addEventListener("input", () => renderList(searchInput.value.trim()));
    renderList();
    const actions = this.contentEl.createDiv({ cls: "modal-button-container ticktick-filter-actions" });
    const selectAllBtn = actions.createEl("button", { text: "\u0627\u0646\u062A\u062E\u0627\u0628 \u0647\u0645\u0647", cls: "ticktick-filter-quick-btn" });
    selectAllBtn.addEventListener("click", () => {
      this.values.forEach((v) => choices.add(v));
      renderList(searchInput.value.trim());
    });
    const clearBtn = actions.createEl("button", { text: "\u062D\u0630\u0641 \u0647\u0645\u0647", cls: "ticktick-filter-quick-btn" });
    clearBtn.addEventListener("click", () => {
      choices.clear();
      renderList(searchInput.value.trim());
    });
    actions.createEl("button", { text: "\u0644\u063A\u0648" }).addEventListener("click", () => this.close());
    actions.createEl("button", { text: "\u0627\u0639\u0645\u0627\u0644 \u0641\u06CC\u0644\u062A\u0631", cls: "mod-cta" }).addEventListener("click", () => {
      this.answer = choices;
      this.close();
    });
  }
};
var TaskOverflowModal = class extends import_obsidian6.Modal {
  constructor(app, tasks, complete, load, edit, changed, dayLabel) {
    super(app);
    this.tasks = tasks;
    this.complete = complete;
    this.load = load;
    this.edit = edit;
    this.changed = changed;
    this.dayLabel = dayLabel;
  }
  onOpen() {
    this.modalEl.addClass("ticktick-overflow-modal");
    this.titleEl.setText(this.dayLabel ? `\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC ${this.dayLabel}` : "\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u06CC\u0646 \u0631\u0648\u0632");
    const container = this.contentEl.createDiv({ cls: "ticktick-overflow-list" });
    for (const task of this.tasks) {
      const priority = taskPriority(task.priority);
      const isCompleted = Number(task.status ?? 0) !== 0;
      const tone = task.projectColor || (Number(task.priority) === 5 ? "var(--color-red)" : Number(task.priority) === 3 ? "var(--color-orange)" : Number(task.priority) === 1 ? "var(--color-blue)" : "var(--interactive-accent)");
      const row = container.createDiv({
        cls: `ticktick-overflow-task priority-${priority.value} ${isCompleted ? "is-completed" : ""}`,
        attr: { role: "button", tabindex: "0" }
      });
      row.style.setProperty("--ticktick-task-tone", tone);
      const openDetails = () => new TaskDetailsModal(this.app, task, {
        complete: async () => {
          await this.complete(task);
        },
        load: this.load,
        edit: this.edit,
        changed: this.changed
      }).open();
      row.addEventListener("click", openDetails);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetails();
        }
      });
      const check = row.createEl("input", { type: "checkbox", cls: "ticktick-overflow-check", attr: { "aria-label": `\u062A\u06A9\u0645\u06CC\u0644 ${task.title}` } });
      check.checked = isCompleted;
      check.disabled = isCompleted;
      check.addEventListener("click", (e) => e.stopPropagation());
      const main = row.createDiv({ cls: "ticktick-overflow-task-main" });
      const titleEl = main.createDiv({
        text: String(task.title ?? "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646"),
        cls: "ticktick-overflow-task-title"
      });
      titleEl.addEventListener("click", (event) => {
        event.stopPropagation();
        openDetails();
      });
      if (task.projectName) {
        main.createSpan({ cls: "ticktick-overflow-task-project", text: task.projectName });
      }
      check.addEventListener("change", async () => {
        check.disabled = true;
        try {
          await this.complete(task);
          task.status = 2;
          await this.changed();
          new import_obsidian6.Notice("\u062A\u0633\u06A9 \u062A\u06A9\u0645\u06CC\u0644 \u0648 \u0647\u0645\u06AF\u0627\u0645 \u0634\u062F.");
        } catch (error) {
          check.checked = false;
          check.disabled = false;
          new import_obsidian6.Notice(error instanceof Error ? error.message : "\u062A\u06A9\u0645\u06CC\u0644 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
        }
      });
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var HabitDetailsModal = class extends import_obsidian6.Modal {
  constructor(app, habit, host, day) {
    super(app);
    this.habit = habit;
    this.host = host;
    this.month = day;
    this.selectedDay = day;
    this.history = new Map((Array.isArray(habit?.history) ? habit.history : []).filter((entry) => entry?.date).map((entry) => [String(entry.date), entry]));
    if (habit?.checkin) this.history.set(day, { date: day, value: Number(habit.checkin.value ?? 0), completed: Number(habit.checkin.status ?? 0) === 2 });
  }
  month;
  selectedDay;
  history = /* @__PURE__ */ new Map();
  saving = false;
  onOpen() {
    this.modalEl.addClass("ticktick-habit-details-modal");
    this.loadMonth();
  }
  monthDays() {
    return persianMonthRange(this.month, this.host.firstWeekday).filter((day) => isSamePersianMonth(day, this.month));
  }
  loadMonth() {
    const days = this.monthDays();
    const entries = this.host.habitHistory(String(this.habit.id), days[0], days.at(-1));
    this.history = new Map(entries.map((entry) => [entry.date, entry]));
    this.render();
  }
  selectedEntry() {
    return this.history.get(this.selectedDay) ?? { date: this.selectedDay, value: 0, completed: false };
  }
  render() {
    this.contentEl.empty();
    this.titleEl.setText(String(this.habit.name ?? "\u0639\u0627\u062F\u062A"));
    const goal = Math.max(1, Number(this.habit.goal ?? this.habit.target ?? 1));
    const selected = this.selectedEntry();
    const value = Number(selected.value ?? 0);
    const shell = this.contentEl.createDiv({ cls: "ticktick-habit-detail-shell" });
    const summary = shell.createDiv({ cls: "ticktick-habit-detail-summary" });
    summary.createDiv({ cls: "ticktick-habit-detail-icon", text: habitGlyph(this.habit) });
    const identity = summary.createDiv({ cls: "ticktick-habit-detail-identity" });
    identity.createEl("strong", { text: String(this.habit.name ?? "\u0639\u0627\u062F\u062A") });
    identity.createSpan({ text: this.habit.sectionName ?? "TickTick" });
    const progress = summary.createDiv({ cls: "ticktick-habit-detail-progress" });
    progress.createEl("strong", { text: `${value}/${goal}` });
    progress.createSpan({ text: this.habit.unit || (goal > 1 ? "\u0645\u0631\u062D\u0644\u0647" : "\u062B\u0628\u062A") });
    const description = String(this.habit.description ?? this.habit.desc ?? this.habit.content ?? this.habit.notes ?? "").trim();
    if (description) {
      const box = shell.createDiv({ cls: "ticktick-habit-detail-description" });
      box.createEl("strong", { text: "\u062A\u0648\u0636\u06CC\u062D\u0627\u062A" });
      box.createDiv({ text: description });
    }
    const stage = shell.createDiv({ cls: "ticktick-habit-stage-control" });
    stage.createSpan({ text: `\u062B\u0628\u062A ${new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long" }).format(/* @__PURE__ */ new Date(`${this.selectedDay}T12:00:00Z`))}` });
    const controls = stage.createDiv({ cls: "ticktick-habit-stage-buttons" });
    const decrease = controls.createEl("button", { text: "\u2212", attr: { type: "button", "aria-label": "\u06A9\u0645\u200C\u06A9\u0631\u062F\u0646 \u06CC\u06A9 \u0645\u0631\u062D\u0644\u0647" } });
    const count = controls.createEl("span", { text: `${value} \u0627\u0632 ${goal}` });
    const increase = controls.createEl("button", { text: "+", cls: "mod-cta", attr: { type: "button", "aria-label": "\u0627\u0641\u0632\u0648\u062F\u0646 \u06CC\u06A9 \u0645\u0631\u062D\u0644\u0647" } });
    decrease.disabled = value <= 0 || this.saving;
    increase.disabled = value >= goal || this.saving;
    const setValue = async (next2) => {
      this.saving = true;
      decrease.disabled = increase.disabled = true;
      try {
        await this.host.setHabitProgress(this.habit, this.selectedDay, next2, goal);
        this.history.set(this.selectedDay, { date: this.selectedDay, value: next2, completed: next2 >= goal });
        new import_obsidian6.Notice(next2 >= goal ? "\u0639\u0627\u062F\u062A \u06A9\u0627\u0645\u0644 \u0648 \u0647\u0645\u06AF\u0627\u0645 \u0634\u062F." : `\u067E\u06CC\u0634\u0631\u0641\u062A \u0639\u0627\u062F\u062A: ${next2}/${goal}`);
      } catch (error) {
        new import_obsidian6.Notice(error instanceof Error ? error.message : "\u062B\u0628\u062A \u0639\u0627\u062F\u062A \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      }
      this.saving = false;
      this.render();
    };
    decrease.addEventListener("click", () => void setValue(value - 1));
    increase.addEventListener("click", () => void setValue(value + 1));
    count.setAttribute("aria-live", "polite");
    const calendar = shell.createDiv({ cls: "ticktick-habit-detail-calendar" });
    const nav = calendar.createDiv({ cls: "ticktick-habit-calendar-nav" });
    const previous = nav.createEl("button", { text: "\u2039", attr: { type: "button", "aria-label": "\u0645\u0627\u0647 \u0642\u0628\u0644" } });
    nav.createEl("strong", { text: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long" }).format(/* @__PURE__ */ new Date(`${this.month}T12:00:00Z`)) });
    const next = nav.createEl("button", { text: "\u203A", attr: { type: "button", "aria-label": "\u0645\u0627\u0647 \u0628\u0639\u062F" } });
    previous.addEventListener("click", () => {
      this.month = shiftPersianMonth(this.month, -1);
      this.loadMonth();
    });
    next.addEventListener("click", () => {
      this.month = shiftPersianMonth(this.month, 1);
      this.loadMonth();
    });
    const weekday = calendar.createDiv({ cls: "ticktick-habit-calendar-weekdays" });
    for (const label of ["\u0634", "\u06CC", "\u062F", "\u0633", "\u0686", "\u067E", "\u062C"]) weekday.createSpan({ text: label });
    const grid = calendar.createDiv({ cls: "ticktick-habit-history-calendar" });
    const days = this.monthDays();
    const firstOffset = ((/* @__PURE__ */ new Date(`${days[0]}T12:00:00Z`)).getUTCDay() - this.host.firstWeekday + 7) % 7;
    for (let index = 0; index < firstOffset; index++) grid.createSpan({ cls: "ticktick-habit-history-blank" });
    for (const dayKey of days) {
      const entry = this.history.get(dayKey);
      const done = Boolean(entry?.completed);
      const scheduled = this.habit.repeatRule ? this.host.habits(dayKey).some((habit) => String(habit.id) === String(this.habit.id)) : true;
      const day = grid.createEl("button", { cls: `ticktick-habit-history-day ${done ? "is-complete" : ""} ${scheduled ? "is-scheduled" : "is-unscheduled"} ${dayKey === this.selectedDay ? "is-selected" : ""}`, text: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric" }).format(/* @__PURE__ */ new Date(`${dayKey}T12:00:00Z`)), attr: { type: "button", title: `${dayKey}${done ? " \xB7 \u0627\u0646\u062C\u0627\u0645 \u0634\u062F\u0647" : scheduled ? " \xB7 \u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F\u0647" : " \xB7 \u0628\u062F\u0648\u0646 \u0628\u0631\u0646\u0627\u0645\u0647"}` } });
      day.disabled = !scheduled || this.saving;
      day.addEventListener("click", () => {
        this.selectedDay = dayKey;
        const dayValue = Number(entry?.value ?? 0);
        if (dayValue >= goal) void setValue(0);
        else void setValue(Math.min(goal, dayValue + Math.max(1, Number(this.habit.step ?? 1))));
      });
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var PlanningCalendar = class {
  constructor(element, host) {
    this.element = element;
    this.host = host;
    this.day = todayInZone(host.timeZone);
    this.showHabits = host.showHabits();
  }
  mode = "week";
  day;
  projects = /* @__PURE__ */ new Set();
  tags = /* @__PURE__ */ new Set();
  sortMode = "ticktick";
  colorMode = "project";
  showHabits = false;
  showHabitsForAllDays = false;
  showAllRecurring = false;
  draggingTaskId = "";
  draggingSourceDay = "";
  displayedHabitIds = /* @__PURE__ */ new Set();
  lastRenderedDay;
  savedGridScrollLeft = 0;
  async render() {
    const scrollHost = this.element.closest(".view-content, .workspace-leaf-content") ?? this.element.parentElement;
    const scrollTop = scrollHost?.scrollTop ?? 0;
    const scrollLeft = scrollHost?.scrollLeft ?? 0;
    const existingGrid = this.element.querySelector(".ticktick-planner-days, .ticktick-planner-month");
    this.savedGridScrollLeft = existingGrid?.scrollLeft ?? 0;
    this.displayedHabitIds.clear();
    this.element.empty();
    this.element.addClass("ticktick-planner");
    const root = this.element.createDiv({ cls: "ticktick-planner-root" });
    const controls = root.createDiv({ cls: "ticktick-planner-controls" });
    const modesContainer = controls.createDiv({ cls: "ticktick-planner-modes" });
    for (const [mode, label, icon] of [["day", "\u0631\u0648\u0632", "calendar"], ["week", "\u0647\u0641\u062A\u0647", "calendar-days"], ["month", "\u0645\u0627\u0647", "calendar-range"]]) {
      const button = modesContainer.createEl("button", {
        cls: `ticktick-planner-mode-btn ${this.mode === mode ? "is-active" : ""}`,
        attr: { type: "button" }
      });
      const iconSpan = button.createSpan({ cls: "ticktick-mode-icon" });
      (0, import_obsidian6.setIcon)(iconSpan, icon);
      button.createSpan({ text: label });
      button.addEventListener("click", () => {
        this.mode = mode;
        void this.render();
      });
    }
    const nav = controls.createDiv({ cls: "ticktick-planner-nav" });
    const step = this.mode === "week" ? 7 : 1;
    const prevBtn = nav.createEl("button", {
      cls: "ticktick-nav-btn mod-icon",
      text: "\u2039",
      attr: { type: "button", "aria-label": "\u0642\u0628\u0644\u06CC" }
    });
    prevBtn.addEventListener("click", () => {
      this.day = this.mode === "month" ? shiftPersianMonth(this.day, -1) : shiftCalendarDay(this.day, -step);
      void this.render();
    });
    const todayBtn = nav.createEl("button", {
      cls: "ticktick-nav-today-btn",
      text: "\u0627\u0645\u0631\u0648\u0632",
      attr: { type: "button" }
    });
    todayBtn.addEventListener("click", () => {
      this.day = todayInZone(this.host.timeZone);
      void this.render();
    });
    const nextBtn = nav.createEl("button", {
      cls: "ticktick-nav-btn mod-icon",
      text: "\u203A",
      attr: { type: "button", "aria-label": "\u0628\u0639\u062F\u06CC" }
    });
    nextBtn.addEventListener("click", () => {
      this.day = this.mode === "month" ? shiftPersianMonth(this.day, 1) : shiftCalendarDay(this.day, step);
      void this.render();
    });
    const titleFormatter = new Intl.DateTimeFormat("fa-IR-u-ca-persian", this.mode === "month" ? { year: "numeric", month: "long" } : this.mode === "week" ? { year: "numeric", month: "long" } : { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    nav.createEl("span", {
      cls: "ticktick-planner-date-title",
      text: titleFormatter.format(/* @__PURE__ */ new Date(`${this.day}T12:00:00Z`))
    });
    const actionsGroup = controls.createDiv({ cls: "ticktick-planner-actions" });
    const addBtn = actionsGroup.createEl("button", {
      cls: "ticktick-planner-add-btn mod-cta",
      attr: { type: "button" }
    });
    const addIcon = addBtn.createSpan({ cls: "ticktick-btn-icon" });
    (0, import_obsidian6.setIcon)(addIcon, "plus");
    addBtn.createSpan({ text: "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9" });
    addBtn.addEventListener("click", () => void this.addTask(this.day));
    const refreshBtn = actionsGroup.createEl("button", {
      cls: "ticktick-planner-sync-btn",
      attr: { type: "button", "aria-label": "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC" }
    });
    const syncIcon = refreshBtn.createSpan({ cls: "ticktick-btn-icon" });
    (0, import_obsidian6.setIcon)(syncIcon, "refresh-cw");
    refreshBtn.createSpan({ text: "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC" });
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      refreshBtn.addClass("is-syncing");
      try {
        await this.host.refresh();
        await this.render();
      } catch (error) {
        new import_obsidian6.Notice(error instanceof Error ? error.message : "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.removeClass("is-syncing");
      }
    });
    this.renderFilters(root);
    const tasks = this.filteredTasks();
    if (!tasks.length) {
      const emptyBox = root.createDiv({ cls: "ticktick-planner-empty" });
      emptyBox.createEl("p", { text: "\u062A\u0633\u06A9\u06CC \u0628\u0631\u0627\u06CC \u0646\u0645\u0627\u06CC\u0634 \u062F\u0631 \u0627\u06CC\u0646 \u0628\u0627\u0632\u0647 \u06CC\u0627 \u0641\u06CC\u0644\u062A\u0631 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F." });
      emptyBox.createEl("small", { text: "\u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u06CC\u062F \u0628\u0627 \u062F\u06A9\u0645\u0647\u0654 \xAB\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9\xBB \u0628\u0631\u0646\u0627\u0645\u0647 \u062C\u062F\u06CC\u062F\u06CC \u0628\u0633\u0627\u0632\u06CC\u062F." });
    }
    if (this.mode === "month") {
      this.renderMonth(root, tasks);
    } else {
      this.renderDays(root, this.mode === "week" ? weekRange(this.day, this.host.firstWeekday) : [this.day], tasks);
    }
    if (scrollHost && (scrollTop || scrollLeft)) {
      requestAnimationFrame(() => {
        if (scrollTop) scrollHost.scrollTop = scrollTop;
        if (scrollLeft) scrollHost.scrollLeft = scrollLeft;
      });
    }
    const newGrid = this.element.querySelector(".ticktick-planner-days, .ticktick-planner-month");
    if (newGrid && this.savedGridScrollLeft > 0) {
      requestAnimationFrame(() => {
        newGrid.scrollLeft = this.savedGridScrollLeft;
      });
    }
    this.lastRenderedDay = this.day;
  }
  renderFilters(root) {
    const filters = root.createDiv({ cls: "ticktick-planner-filters" });
    const tasks = this.host.tasks();
    const habitsBtn = filters.createEl("button", {
      cls: `ticktick-filter-chip ${this.showHabits ? "is-filtered" : ""}`,
      attr: { type: "button", "aria-pressed": String(this.showHabits) }
    });
    const habitsIcon = habitsBtn.createSpan({ cls: "ticktick-chip-icon" });
    (0, import_obsidian6.setIcon)(habitsIcon, "activity");
    habitsBtn.createSpan({ text: this.showHabits ? "\u0639\u0627\u062F\u062A\u200C\u0647\u0627: \u0631\u0648\u0634\u0646" : "\u0646\u0645\u0627\u06CC\u0634 \u0639\u0627\u062F\u062A\u200C\u0647\u0627" });
    habitsBtn.addEventListener("click", () => {
      this.showHabits = !this.showHabits;
      void this.host.setShowHabits(this.showHabits).then(() => this.render());
    });
    if (this.showHabits) {
      const scopeBtn = filters.createEl("button", { cls: "ticktick-filter-chip", attr: { type: "button" } });
      (0, import_obsidian6.setIcon)(scopeBtn.createSpan({ cls: "ticktick-chip-icon" }), "calendar-days");
      scopeBtn.createSpan({ text: this.showHabitsForAllDays ? "\u0639\u0627\u062F\u062A\u200C\u0647\u0627: \u0647\u0645\u0647\u0654 \u0631\u0648\u0632\u0647\u0627" : "\u0639\u0627\u062F\u062A\u200C\u0647\u0627: \u0641\u0642\u0637 \u0631\u0648\u0632 \u0627\u0646\u062A\u062E\u0627\u0628\u06CC" });
      scopeBtn.addEventListener("click", () => {
        this.showHabitsForAllDays = !this.showHabitsForAllDays;
        void this.render();
      });
    }
    const recurringBtn = filters.createEl("button", { cls: `ticktick-filter-chip ${this.showAllRecurring ? "is-filtered" : ""}`, attr: { type: "button" } });
    (0, import_obsidian6.setIcon)(recurringBtn.createSpan({ cls: "ticktick-chip-icon" }), "repeat-2");
    recurringBtn.createSpan({ text: this.showAllRecurring ? "\u062A\u06A9\u0631\u0627\u0631\u0634\u0648\u0646\u062F\u0647\u200C\u0647\u0627: \u0647\u0645\u0647\u0654 \u0631\u062E\u062F\u0627\u062F\u0647\u0627" : "\u062A\u06A9\u0631\u0627\u0631\u0634\u0648\u0646\u062F\u0647\u200C\u0647\u0627: \u0631\u062E\u062F\u0627\u062F \u0628\u0639\u062F\u06CC" });
    recurringBtn.addEventListener("click", () => {
      this.showAllRecurring = !this.showAllRecurring;
      void this.render();
    });
    const sortLabels = {
      ticktick: "\u062A\u0631\u062A\u06CC\u0628 TickTick",
      time: "\u0633\u0627\u0639\u062A",
      priority: "\u0627\u0648\u0644\u0648\u06CC\u062A",
      title: "\u0639\u0646\u0648\u0627\u0646"
    };
    const sortBtn = filters.createDiv({
      cls: "ticktick-filter-select-wrapper",
      attr: { role: "button", tabindex: "0", "aria-label": "\u0645\u0631\u062A\u0628\u200C\u0633\u0627\u0632\u06CC \u062A\u0633\u06A9\u200C\u0647\u0627" }
    });
    const sortIcon = sortBtn.createSpan({ cls: "ticktick-select-icon" });
    (0, import_obsidian6.setIcon)(sortIcon, "arrow-up-down");
    sortBtn.createSpan({
      cls: "ticktick-filter-select-label",
      text: `\u0645\u0631\u062A\u0628\u200C\u0633\u0627\u0632\u06CC: ${sortLabels[this.sortMode] ?? "\u062A\u0631\u062A\u06CC\u0628 TickTick"}`
    });
    const sortChevron = sortBtn.createSpan({ cls: "ticktick-select-chevron" });
    (0, import_obsidian6.setIcon)(sortChevron, "chevron-down");
    const openSortMenu = (event) => {
      const menu = new import_obsidian6.Menu();
      for (const [value, label] of [["ticktick", "\u062A\u0631\u062A\u06CC\u0628 TickTick"], ["time", "\u0633\u0627\u0639\u062A"], ["priority", "\u0627\u0648\u0644\u0648\u06CC\u062A"], ["title", "\u0639\u0646\u0648\u0627\u0646"]]) {
        menu.addItem((item) => {
          item.setTitle(label).setChecked(this.sortMode === value).onClick(() => {
            this.sortMode = value;
            void this.render();
          });
        });
      }
      if (event instanceof MouseEvent) {
        menu.showAtMouseEvent(event);
      } else {
        const rect = sortBtn.getBoundingClientRect();
        menu.showAtPosition({ x: rect.right, y: rect.bottom });
      }
    };
    sortBtn.addEventListener("click", openSortMenu);
    sortBtn.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openSortMenu(event);
      }
    });
    const colorLabels = {
      project: "\u0631\u0646\u06AF: \u067E\u0631\u0648\u0698\u0647",
      tag: "\u0631\u0646\u06AF: \u0628\u0631\u0686\u0633\u0628",
      priority: "\u0631\u0646\u06AF: \u0627\u0648\u0644\u0648\u06CC\u062A",
      uniform: "\u0631\u0646\u06AF: \u06CC\u06A9\u062F\u0633\u062A"
    };
    const colorBtn = filters.createDiv({
      cls: "ticktick-filter-select-wrapper",
      attr: { role: "button", tabindex: "0", "aria-label": "\u0631\u0646\u06AF\u200C\u0628\u0646\u062F\u06CC \u062A\u0633\u06A9\u200C\u0647\u0627" }
    });
    const colorIcon = colorBtn.createSpan({ cls: "ticktick-select-icon" });
    (0, import_obsidian6.setIcon)(colorIcon, "palette");
    colorBtn.createSpan({
      cls: "ticktick-filter-select-label",
      text: colorLabels[this.colorMode] ?? "\u0631\u0646\u06AF: \u067E\u0631\u0648\u0698\u0647"
    });
    const colorChevron = colorBtn.createSpan({ cls: "ticktick-select-chevron" });
    (0, import_obsidian6.setIcon)(colorChevron, "chevron-down");
    const openColorMenu = (event) => {
      const menu = new import_obsidian6.Menu();
      for (const [value, label] of [["project", "\u0631\u0646\u06AF: \u067E\u0631\u0648\u0698\u0647"], ["tag", "\u0631\u0646\u06AF: \u0628\u0631\u0686\u0633\u0628"], ["priority", "\u0631\u0646\u06AF: \u0627\u0648\u0644\u0648\u06CC\u062A"], ["uniform", "\u0631\u0646\u06AF: \u06CC\u06A9\u062F\u0633\u062A"]]) {
        menu.addItem((item) => {
          item.setTitle(label).setChecked(this.colorMode === value).onClick(() => {
            this.colorMode = value;
            void this.render();
          });
        });
      }
      if (event instanceof MouseEvent) {
        menu.showAtMouseEvent(event);
      } else {
        const rect = colorBtn.getBoundingClientRect();
        menu.showAtPosition({ x: rect.right, y: rect.bottom });
      }
    };
    colorBtn.addEventListener("click", openColorMenu);
    colorBtn.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openColorMenu(event);
      }
    });
    const projects = [...new Set(tasks.map((task) => String(task.projectName ?? task.projectId ?? "\u0648\u0631\u0648\u062F\u06CC")))].sort((left, right) => left.localeCompare(right, "fa"));
    const projectBtn = filters.createEl("button", {
      cls: `ticktick-filter-chip ${this.projects.size ? "is-filtered" : ""}`,
      attr: { type: "button" }
    });
    const folderIcon = projectBtn.createSpan({ cls: "ticktick-chip-icon" });
    (0, import_obsidian6.setIcon)(folderIcon, "folder");
    projectBtn.createSpan({ text: this.projects.size ? `\u067E\u0631\u0648\u0698\u0647 (${this.projects.size})` : "\u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627" });
    projectBtn.addEventListener("click", async () => {
      const value = await new PlannerMultiSelectModal(this.host.app, "\u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627", projects, this.projects).openAndWait();
      if (value) {
        this.projects = value;
        await this.render();
      }
    });
    const tags = [...new Set(tasks.flatMap((task) => task.tags ?? []).map(String))].sort((left, right) => left.localeCompare(right, "fa"));
    const tagBtn = filters.createEl("button", {
      cls: `ticktick-filter-chip ${this.tags.size ? "is-filtered" : ""}`,
      attr: { type: "button" }
    });
    const tagIcon = tagBtn.createSpan({ cls: "ticktick-chip-icon" });
    (0, import_obsidian6.setIcon)(tagIcon, "tag");
    tagBtn.createSpan({ text: this.tags.size ? `\u0628\u0631\u0686\u0633\u0628 (${this.tags.size})` : "\u0628\u0631\u0686\u0633\u0628\u200C\u0647\u0627" });
    tagBtn.addEventListener("click", async () => {
      const value = await new PlannerMultiSelectModal(this.host.app, "\u0628\u0631\u0686\u0633\u0628\u200C\u0647\u0627", tags, this.tags, "#").openAndWait();
      if (value) {
        this.tags = value;
        await this.render();
      }
    });
    if (this.projects.size || this.tags.size) {
      const clear = filters.createEl("button", {
        cls: "ticktick-filter-clear-btn",
        attr: { type: "button", "aria-label": "\u067E\u0627\u06A9\u200C\u06A9\u0631\u062F\u0646 \u0641\u06CC\u0644\u062A\u0631\u0647\u0627" }
      });
      const clearIcon = clear.createSpan({ cls: "ticktick-chip-icon" });
      (0, import_obsidian6.setIcon)(clearIcon, "x");
      clear.createSpan({ text: "\u067E\u0627\u06A9\u200C\u06A9\u0631\u062F\u0646 \u0641\u06CC\u0644\u062A\u0631\u0647\u0627" });
      clear.addEventListener("click", () => {
        this.projects.clear();
        this.tags.clear();
        void this.render();
      });
    }
  }
  filteredTasks() {
    return this.host.tasks().filter(
      (task) => (!this.projects.size || this.projects.has(String(task.projectName ?? task.projectId ?? "\u0648\u0631\u0648\u062F\u06CC"))) && (!this.tags.size || (task.tags ?? []).some((tag) => this.tags.has(String(tag))))
    );
  }
  renderDays(root, days, tasks) {
    const today = todayInZone(this.host.timeZone);
    const grid = root.createDiv({ cls: `ticktick-planner-days ticktick-planner-days-${days.length}` });
    enhanceHorizontalScroll(grid);
    scrollToStart(grid);
    this.bindCalendarDrop(grid, tasks);
    const showRangeBars = days.length > 1;
    const shell = grid.createDiv({ cls: "ticktick-planner-days-shell" });
    const headers = shell.createDiv({ cls: "ticktick-planner-days-headers" });
    for (const day of days) {
      const isToday = day === today;
      const header = headers.createDiv({ cls: `ticktick-planner-day-header ${isToday ? "is-today" : ""}`, attr: { "data-day": day } });
      const dayTop = header.createDiv({ cls: "ticktick-planner-day-top" });
      const weekdayName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long" }).format(/* @__PURE__ */ new Date(`${day}T12:00:00Z`));
      dayTop.createSpan({ cls: "ticktick-planner-day-name", text: weekdayName });
      if (isToday) {
        dayTop.createSpan({ cls: "ticktick-today-pill", text: "\u0627\u0645\u0631\u0648\u0632" });
      }
      const dayDateWrapper = header.createDiv({ cls: "ticktick-planner-day-date-wrap" });
      const dayNumber2 = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric" }).format(/* @__PURE__ */ new Date(`${day}T12:00:00Z`));
      const monthName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "short" }).format(/* @__PURE__ */ new Date(`${day}T12:00:00Z`));
      dayDateWrapper.createSpan({ cls: `ticktick-day-num-badge ${isToday ? "is-today-badge" : ""}`, text: dayNumber2 });
      dayDateWrapper.createSpan({ cls: "ticktick-month-name", text: monthName });
      const items = this.itemsForDay(tasks, day);
      const dayBottom = header.createDiv({ cls: "ticktick-planner-day-bottom" });
      dayBottom.createSpan({ cls: "ticktick-planner-counter", text: `${items.length} \u062A\u0633\u06A9` });
      const add = dayBottom.createEl("button", {
        cls: "ticktick-planner-add",
        attr: { type: "button", "aria-label": `\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u062F\u0631 ${day}` }
      });
      (0, import_obsidian6.setIcon)(add, "plus");
      add.createSpan({ text: "\u0627\u0641\u0632\u0648\u062F\u0646" });
      add.addEventListener("click", () => void this.addTask(day));
    }
    const body = shell.createDiv({ cls: "ticktick-planner-days-body" });
    if (showRangeBars) this.renderRangeLanes(body, days, tasks, "ticktick-planner-range-lanes");
    const columns = body.createDiv({ cls: "ticktick-planner-day-columns" });
    for (const day of days) {
      const isToday = day === today;
      const column = columns.createDiv({ cls: `ticktick-planner-day ${isToday ? "is-today" : ""}`, attr: { "data-day": day } });
      const items = this.itemsForDay(tasks, day);
      column.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        column.addClass("is-drag-over");
      });
      column.addEventListener("dragleave", () => {
        column.removeClass("is-drag-over");
      });
      column.addEventListener("drop", (event) => {
        event.preventDefault();
        column.removeClass("is-drag-over");
        const task = this.draggedTask(event, tasks);
        if (task) void this.dropTask(task, day);
      });
      const singleDayTasks = items.filter((item) => !showRangeBars || !taskDateRange(item, this.host.timeZone));
      if (!singleDayTasks.length) {
        const emptyHint = column.createDiv({ cls: "ticktick-planner-day-empty" });
        emptyHint.createSpan({ text: "\u062A\u0633\u06A9\u06CC \u0646\u06CC\u0633\u062A" });
      } else {
        for (const task of singleDayTasks) this.renderTask(column, task);
      }
      if (this.showHabitsForAllDays || day === this.day) this.renderHabits(column, day);
    }
  }
  renderMonth(root, tasks) {
    const today = todayInZone(this.host.timeZone);
    const grid = root.createDiv({ cls: "ticktick-planner-month" });
    enhanceHorizontalScroll(grid);
    scrollToStart(grid);
    this.bindCalendarDrop(grid, tasks);
    const days = persianMonthRange(this.day, this.host.firstWeekday);
    const weekdayBar = grid.createDiv({ cls: "ticktick-planner-month-weekdays-bar" });
    const sampleWeek = days.slice(0, 7);
    for (const sampleDay of sampleWeek) {
      const weekdayName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long" }).format(/* @__PURE__ */ new Date(`${sampleDay}T12:00:00Z`));
      weekdayBar.createDiv({ cls: "ticktick-planner-month-weekday-cell", text: weekdayName });
    }
    for (let index = 0; index < days.length; index += 7) {
      const weekDays = days.slice(index, index + 7);
      const week = grid.createDiv({ cls: "ticktick-planner-month-week" });
      const headers = week.createDiv({ cls: "ticktick-planner-month-headers" });
      for (const day of weekDays) {
        const isToday = day === today;
        const isOutside = !isSamePersianMonth(day, this.day);
        const header = headers.createDiv({
          cls: `ticktick-planner-month-header ${isOutside ? "is-outside" : ""} ${isToday ? "is-today" : ""}`,
          attr: { "data-day": day }
        });
        const numWrapper = header.createDiv({ cls: "ticktick-month-num-wrap" });
        const dayNum = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric" }).format(/* @__PURE__ */ new Date(`${day}T12:00:00Z`));
        numWrapper.createSpan({ cls: `ticktick-day-num-badge ${isToday ? "is-today-badge" : ""}`, text: dayNum });
        const items = this.itemsForDay(tasks, day);
        if (items.length) {
          header.createSpan({ cls: "ticktick-planner-counter", text: String(items.length) });
        }
        const add = header.createEl("button", {
          cls: "ticktick-planner-add mod-icon",
          attr: { type: "button", "aria-label": `\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u062F\u0631 ${day}` }
        });
        (0, import_obsidian6.setIcon)(add, "plus");
        add.addEventListener("click", (e) => {
          e.stopPropagation();
          void this.addTask(day);
        });
      }
      const body = week.createDiv({ cls: "ticktick-planner-month-body" });
      this.renderRangeLanes(body, weekDays, tasks, "ticktick-planner-month-range-lanes");
      const cells = body.createDiv({ cls: "ticktick-planner-month-cells" });
      for (const day of weekDays) {
        const isToday = day === today;
        const isOutside = !isSamePersianMonth(day, this.day);
        const cell = cells.createDiv({
          cls: `ticktick-planner-month-cell ${isOutside ? "is-outside" : ""} ${isToday ? "is-today" : ""}`,
          attr: { "data-day": day }
        });
        const items = tasksForCalendarDay(tasks, day, this.host.timeZone, this.host.showCompleted, this.sortMode);
        cell.addEventListener("dragover", (event) => {
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
          cell.addClass("is-drag-over");
        });
        cell.addEventListener("dragleave", () => {
          cell.removeClass("is-drag-over");
        });
        cell.addEventListener("drop", (event) => {
          event.preventDefault();
          cell.removeClass("is-drag-over");
          const task = this.draggedTask(event, tasks);
          if (task) void this.dropTask(task, day);
        });
        const cards = items.filter((item) => !taskDateRange(item, this.host.timeZone));
        for (const task of cards.slice(0, 3)) this.renderMonthTask(cell, task);
        if (cards.length > 3) {
          const more = cell.createEl("button", {
            cls: "ticktick-planner-overflow",
            text: `+${cards.length - 3} \u062A\u0633\u06A9 \u062F\u06CC\u06AF\u0631`,
            attr: { type: "button", "aria-label": "\u0646\u0645\u0627\u06CC\u0634 \u0647\u0645\u0647\u0654 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0631\u0648\u0632" }
          });
          const dayLabel = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", day: "numeric", month: "long" }).format(/* @__PURE__ */ new Date(`${day}T12:00:00Z`));
          more.addEventListener("click", () => new TaskOverflowModal(
            this.host.app,
            cards,
            (task) => this.completeTask(task),
            (task) => this.host.load(task),
            (task) => this.host.edit(task),
            async () => {
              await this.host.refresh();
              await this.render();
            },
            dayLabel
          ).open());
        }
        if (this.showHabitsForAllDays || day === this.day) this.renderHabits(cell, day, true);
      }
    }
  }
  renderRangeLanes(parent, days, tasks, cls) {
    const rangeTasks = tasks.filter((task) => {
      if (Number(task.status ?? 0) !== 0 && !this.host.showCompleted) return false;
      const range = taskDateRange(task, this.host.timeZone);
      return range && range.end >= days[0] && range.start <= days.at(-1);
    });
    if (!rangeTasks.length) return;
    const lanes = parent.createDiv({ cls });
    for (const task of rangeTasks) {
      const range = taskDateRange(task, this.host.timeZone);
      const first = Math.max(0, days.findIndex((day) => day >= range.start));
      const last = Math.max(first, (() => {
        const index = days.findIndex((day) => day > range.end);
        return index < 0 ? days.length - 1 : index - 1;
      })());
      const priority = taskPriority(task.priority);
      const isCompleted = Number(task.status ?? 0) !== 0;
      const tone = this.taskTone(task);
      const bar = lanes.createDiv({
        cls: `ticktick-planner-range-task priority-${priority.value} ${isCompleted ? "is-completed" : ""}`,
        attr: {
          title: `\u0628\u0627\u0632\u0647\u0654 ${range.start} \u062A\u0627 ${range.end} \xB7 ${task.title}`,
          role: "button",
          tabindex: "0"
        }
      });
      bar.style.gridColumn = `${first + 1} / ${last + 2}`;
      bar.style.setProperty("--ticktick-task-tone", tone);
      const openDetails = () => new TaskDetailsModal(this.host.app, task, {
        complete: () => this.completeTask(task),
        load: (item) => this.host.load(item),
        edit: (item) => this.host.edit(item),
        changed: async () => {
          await this.host.refresh();
          await this.render();
        }
      }).open();
      bar.addEventListener("click", openDetails);
      bar.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetails();
        }
      });
      const check = bar.createEl("input", { type: "checkbox", cls: "ticktick-range-check", attr: { "aria-label": `\u062A\u06A9\u0645\u06CC\u0644 ${task.title}` } });
      check.checked = isCompleted;
      check.disabled = isCompleted;
      check.addEventListener("click", (e) => e.stopPropagation());
      check.addEventListener("change", () => void this.completeTask(task, check));
      const rangeIcon = bar.createSpan({ cls: "ticktick-range-indicator mod-icon", attr: { "aria-hidden": "true" } });
      (0, import_obsidian6.setIcon)(rangeIcon, "calendar-range");
      const titleEl = bar.createDiv({
        cls: "ticktick-range-title",
        text: String(task.title ?? "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646")
      });
      titleEl.addEventListener("click", (event) => {
        event.stopPropagation();
        openDetails();
      });
      bar.draggable = true;
      bar.addEventListener("dragstart", (event) => {
        bar.addClass("is-dragging");
        this.beginTaskDrag(task, event, bar);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer?.setData("text/ticktick-task", String(task.id));
        event.dataTransfer?.setData("text/plain", String(task.id));
      });
      bar.addEventListener("dragend", () => {
        bar.removeClass("is-dragging");
        this.clearTaskDrag();
      });
    }
  }
  itemsForDay(tasks, day) {
    const normal = tasksForCalendarDay(tasks, day, this.host.timeZone, this.host.showCompleted, this.sortMode);
    if (!this.showAllRecurring) return normal;
    const known = new Set(normal.map((task) => String(task.id)));
    const extras = tasks.filter((task) => !known.has(String(task.id)) && recurringTaskOccursOnDay(task, day, this.host.timeZone));
    return sortPlanningTasks([...normal, ...extras], this.sortMode);
  }
  /** Habits live beside the date they belong to, but remain opt-in so a busy
   * calendar can stay task-only.  They are resolved from the local mirror and
   * therefore do not add a TickTick request while rendering. */
  renderHabits(parent, day, compact = false) {
    if (!this.showHabits) return;
    const habits = this.host.habits(day).filter((habit) => {
      if (!this.showHabitsForAllDays) return true;
      const goal = Math.max(1, Number(habit.checkin?.goal ?? habit.goal ?? habit.target ?? 1));
      const complete = Number(habit.checkin?.status ?? 0) === 2 || Number(habit.checkin?.value ?? 0) >= goal;
      const id = String(habit.id);
      if (complete || this.displayedHabitIds.has(id)) return false;
      this.displayedHabitIds.add(id);
      return true;
    });
    if (!habits.length) return;
    const section = parent.createDiv({ cls: `ticktick-planner-habits ${compact ? "is-compact" : ""}` });
    section.createDiv({ cls: "ticktick-planner-habits-label", text: "\u0639\u0627\u062F\u062A\u200C\u0647\u0627" });
    for (const habit of habits) {
      renderUnifiedHabitCard(section, {
        habit,
        day,
        variant: "planner",
        onCheckIn: async (h, d) => {
          const goal = Math.max(1, Number(h.checkin?.goal ?? h.goal ?? h.target ?? 1));
          const current = Number(h.checkin?.value ?? 0);
          const complete = Number(h.checkin?.status ?? 0) === 2 || current >= goal;
          await this.host.checkInHabit(h, d);
          new import_obsidian6.Notice(complete ? "\u062B\u0628\u062A \u0639\u0627\u062F\u062A \u0628\u0631\u062F\u0627\u0634\u062A\u0647 \u0634\u062F." : current + 1 >= goal ? "\u0639\u0627\u062F\u062A \u06A9\u0627\u0645\u0644 \u0648 \u0647\u0645\u06AF\u0627\u0645 \u0634\u062F." : `\u06CC\u06A9 \u0645\u0631\u062D\u0644\u0647 \u062B\u0628\u062A \u0634\u062F: ${current + 1}/${goal}`);
          await this.render();
        },
        onOpenDetails: (h, d) => {
          new HabitDetailsModal(this.host.app, this.host.habitWithHistory(String(h.id), d) ?? h, this.host, d).open();
        }
      });
    }
  }
  renderTask(parent, task) {
    const bound = this.host.binding(task);
    const priority = taskPriority(task.priority);
    const isCompleted = Number(task.status ?? 0) !== 0;
    const tone = this.taskTone(task);
    const card = parent.createDiv({
      cls: `ticktick-planner-task priority-${priority.value} ${bound ? "is-bound" : ""} ${isCompleted ? "is-completed" : ""}`,
      attr: {
        title: `${String(task.title ?? "")}${task.projectName ? ` \xB7 ${task.projectName}` : ""}${bound ? " \xB7 (\u0628\u0631\u0627\u06CC \u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u0628\u06A9\u0634)" : ""}`,
        role: "button",
        tabindex: "0"
      }
    });
    card.dataset.taskId = String(task.id);
    card.style.setProperty("--ticktick-task-tone", tone);
    const openDetails = () => new TaskDetailsModal(this.host.app, task, {
      complete: () => this.completeTask(task),
      load: (item) => this.host.load(item),
      edit: (item) => this.host.edit(item),
      changed: async () => {
        await this.host.refresh();
        await this.render();
      }
    }).open();
    card.addEventListener("click", openDetails);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetails();
      }
    });
    if (bound) {
      const grip = card.createSpan({ cls: "ticktick-task-grip mod-icon", attr: { "aria-hidden": "true" } });
      (0, import_obsidian6.setIcon)(grip, "grip-vertical");
      grip.addEventListener("click", (event) => event.stopPropagation());
    }
    const check = card.createEl("input", { type: "checkbox", cls: "ticktick-task-check", attr: { "aria-label": `\u062A\u06A9\u0645\u06CC\u0644 ${task.title}` } });
    check.checked = isCompleted;
    check.disabled = isCompleted;
    check.addEventListener("click", (event) => event.stopPropagation());
    check.addEventListener("change", () => void this.completeTask(task, check));
    const content = card.createDiv({ cls: "ticktick-task-content" });
    const timeStr = formatTaskTime(task, this.host.timeZone);
    if (timeStr || priority.value > 0 || task.projectName) {
      const metaRow = content.createDiv({ cls: "ticktick-task-meta-row" });
      if (task.projectName) {
        metaRow.createSpan({ cls: "ticktick-task-project-chip", text: task.projectName });
      }
      if (timeStr) {
        const timeBadge = metaRow.createSpan({ cls: "ticktick-task-time-badge" });
        const clockIcon = timeBadge.createSpan({ cls: "ticktick-time-icon" });
        (0, import_obsidian6.setIcon)(clockIcon, "clock");
        timeBadge.createSpan({ text: timeStr });
      }
      if (priority.value > 0) {
        metaRow.createSpan({ cls: `ticktick-task-priority-dot ${priority.className}`, attr: { title: `\u0627\u0648\u0644\u0648\u06CC\u062A: ${priority.label}` } });
      }
    }
    const titleEl = content.createDiv({
      cls: "ticktick-task-title",
      text: String(task.title ?? "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646")
    });
    titleEl.addEventListener("click", (event) => {
      event.stopPropagation();
      openDetails();
    });
    card.draggable = true;
    card.addEventListener("dragstart", (event) => {
      card.addClass("is-dragging");
      this.beginTaskDrag(task, event, card);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer?.setData("text/ticktick-task", String(task.id));
      event.dataTransfer?.setData("text/plain", String(task.id));
    });
    card.addEventListener("dragend", () => {
      card.removeClass("is-dragging");
      this.clearTaskDrag();
    });
  }
  renderMonthTask(parent, task) {
    const bound = this.host.binding(task);
    const priority = taskPriority(task.priority);
    const isCompleted = Number(task.status ?? 0) !== 0;
    const tone = this.taskTone(task);
    const card = parent.createDiv({
      cls: `ticktick-planner-month-task priority-${priority.value} ${bound ? "is-bound" : ""} ${isCompleted ? "is-completed" : ""}`,
      attr: {
        title: `${task.title}${task.projectName ? ` \xB7 ${task.projectName}` : ""}`,
        role: "button",
        tabindex: "0"
      }
    });
    card.dataset.taskId = String(task.id);
    card.style.setProperty("--ticktick-task-tone", tone);
    const openDetails = () => new TaskDetailsModal(this.host.app, task, {
      complete: () => this.completeTask(task),
      load: (item) => this.host.load(item),
      edit: (item) => this.host.edit(item),
      changed: async () => {
        await this.host.refresh();
        await this.render();
      }
    }).open();
    card.addEventListener("click", openDetails);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetails();
      }
    });
    const check = card.createEl("input", { type: "checkbox", cls: "ticktick-month-check", attr: { "aria-label": `\u062A\u06A9\u0645\u06CC\u0644 ${task.title}` } });
    check.checked = isCompleted;
    check.disabled = isCompleted;
    check.addEventListener("click", (event) => event.stopPropagation());
    check.addEventListener("change", () => void this.completeTask(task, check));
    const timeStr = formatTaskTime(task, this.host.timeZone);
    if (timeStr) {
      card.createSpan({ cls: "ticktick-month-time", text: timeStr });
    }
    const titleEl = card.createDiv({
      cls: "ticktick-month-task-title",
      text: String(task.title ?? "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646")
    });
    titleEl.addEventListener("click", (event) => {
      event.stopPropagation();
      openDetails();
    });
    card.draggable = true;
    card.addEventListener("dragstart", (event) => {
      card.addClass("is-dragging");
      this.beginTaskDrag(task, event, card);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer?.setData("text/ticktick-task", String(task.id));
      event.dataTransfer?.setData("text/plain", String(task.id));
    });
    card.addEventListener("dragend", () => {
      card.removeClass("is-dragging");
      this.clearTaskDrag();
    });
  }
  taskTone(task) {
    if (this.colorMode === "uniform") return "var(--interactive-accent)";
    if (this.colorMode === "priority") {
      return Number(task.priority) === 5 ? "var(--color-red)" : Number(task.priority) === 3 ? "var(--color-orange)" : Number(task.priority) === 1 ? "var(--color-blue)" : "var(--text-muted)";
    }
    const seed = this.colorMode === "tag" ? String(task.tags?.[0] ?? task.projectName ?? task.projectId ?? "") : String(task.projectName ?? task.projectId ?? "");
    const projectColor = String(task.projectColor ?? "").trim();
    if (this.colorMode === "project" && /^#[0-9a-f]{3,8}$/i.test(projectColor)) return projectColor;
    const palette = ["#7c6cff", "#4aa3df", "#2a9d8f", "#e76f51", "#d36ba6", "#d49a2a", "#5a9b68"];
    const hash = [...seed].reduce((value, char) => value * 31 + char.charCodeAt(0) >>> 0, 0);
    return palette[hash % palette.length];
  }
  async completeTask(task, checkbox) {
    if (checkbox) {
      checkbox.disabled = true;
      checkbox.checked = true;
    }
    const card = checkbox?.closest(".ticktick-planner-task, .ticktick-planner-month-task") || this.element.querySelector(`[data-task-id="${task.id}"]`);
    if (card) {
      card.addClass("is-completed");
      if (!this.host.showCompleted) {
        card.addClass("is-leaving");
      }
    }
    try {
      await this.host.complete(task);
      task.status = 2;
      new import_obsidian6.Notice("\u062A\u0633\u06A9 \u062A\u06A9\u0645\u06CC\u0644 \u0648 \u0647\u0645\u06AF\u0627\u0645 \u0634\u062F.");
      if (card && !this.host.showCompleted) {
        setTimeout(() => card.remove(), 220);
      }
    } catch (error) {
      if (checkbox) {
        checkbox.checked = false;
        checkbox.disabled = false;
      }
      if (card) {
        card.removeClass("is-completed");
        card.removeClass("is-leaving");
      }
      new import_obsidian6.Notice(error instanceof Error ? error.message : "\u062A\u06A9\u0645\u06CC\u0644 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    }
  }
  async addTask(day) {
    try {
      const created = await this.host.create({ dueDate: day });
      if (!created) return;
      new import_obsidian6.Notice("\u062A\u0633\u06A9 \u062F\u0631 TickTick \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.");
      await this.host.refresh();
      await this.render();
    } catch (error) {
      new import_obsidian6.Notice(error instanceof Error ? error.message : "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    }
  }
  async dropTask(task, target, visualSourceDay) {
    const currentRange = taskDateRange(task, this.host.timeZone);
    const currentDay = currentRange?.start ?? String(task.dueDate ?? task.startDate ?? "").slice(0, 10);
    if (!currentDay) return;
    const offset = visualSourceDay ? Math.round((Date.parse(`${target}T12:00:00Z`) - Date.parse(`${visualSourceDay}T12:00:00Z`)) / 864e5) : Math.round((Date.parse(`${target}T12:00:00Z`) - Date.parse(`${currentDay}T12:00:00Z`)) / 864e5);
    if (!offset) return;
    const taskTarget = shiftCalendarDay(currentDay, offset);
    try {
      await this.host.reschedule(task, taskTarget);
      new import_obsidian6.Notice(currentRange ? "\u0628\u0627\u0632\u0647\u0654 \u0632\u0645\u0627\u0646\u06CC \u062A\u0633\u06A9 \u062C\u0627\u0628\u0647\u200C\u062C\u0627 \u0648 \u0647\u0645\u06AF\u0627\u0645 \u0634\u062F." : "\u062A\u0627\u0631\u06CC\u062E \u062A\u0633\u06A9 \u062C\u0627\u0628\u0647\u200C\u062C\u0627 \u0648 \u0647\u0645\u06AF\u0627\u0645 \u0634\u062F.");
      await this.render();
    } catch (error) {
      new import_obsidian6.Notice(error instanceof Error ? error.message : "\u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    }
  }
  draggedTask(event, tasks) {
    const id = event.dataTransfer?.getData("text/ticktick-task") || event.dataTransfer?.getData("text/plain") || this.draggingTaskId;
    return tasks.find((item) => String(item.id) === String(id));
  }
  /** Capture drops before a theme, card, or embedded Obsidian view can stop
   * propagation. Cells still keep their local listeners for visual feedback. */
  bindCalendarDrop(surface, tasks) {
    const targetDay = (event) => this.visualDropDay(surface, event);
    surface.addEventListener("dragover", (event) => {
      const day = targetDay(event);
      if (!day) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      surface.querySelectorAll(".is-drag-over").forEach((item) => item.removeClass("is-drag-over"));
      surface.querySelector(`[data-day="${day}"]`)?.addClass("is-drag-over");
    }, true);
    surface.addEventListener("drop", (event) => {
      const day = targetDay(event);
      if (!day) return;
      event.preventDefault();
      event.stopPropagation();
      surface.querySelectorAll(".is-drag-over").forEach((item) => item.removeClass("is-drag-over"));
      const task = this.draggedTask(event, tasks);
      const sourceDay = this.draggingSourceDay;
      if (task) void this.dropTask(task, day, sourceDay);
      else new import_obsidian6.Notice("\u062A\u0633\u06A9\u0650 \u062F\u0631 \u062D\u0627\u0644 \u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F\u061B \u062F\u0648\u0628\u0627\u0631\u0647 \u062A\u0644\u0627\u0634 \u06A9\u0646.");
    }, true);
  }
  /** Resolve the destination from the visible date header instead of the DOM
   * ancestry of a card. Range lanes and RTL grids can otherwise make a card
   * appear over a neighbouring day while retaining another column's parent. */
  visualDropDay(surface, event) {
    const x = event.clientX, y = event.clientY;
    if (Number.isFinite(x) && x > 0 && Number.isFinite(y) && y > 0) {
      const targets = surface.querySelectorAll(
        ".ticktick-planner-day[data-day], .ticktick-planner-month-cell[data-day], .ticktick-planner-day-header[data-day], .ticktick-planner-month-header[data-day]"
      );
      for (const target of targets) {
        const rect = target.getBoundingClientRect();
        if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return target.dataset.day;
      }
    }
    return event.target instanceof Element ? event.target.closest("[data-day]")?.dataset.day : void 0;
  }
  beginTaskDrag(task, event, card) {
    this.draggingTaskId = String(task.id);
    const surface = card.closest(".ticktick-planner-days, .ticktick-planner-month");
    this.draggingSourceDay = surface ? this.visualDropDay(surface, event) ?? "" : "";
  }
  clearTaskDrag() {
    this.draggingTaskId = "";
    this.draggingSourceDay = "";
  }
};

// src/obsidian/project-board.ts
var import_obsidian8 = require("obsidian");
init_project_board();

// src/obsidian/project-editor-modal.ts
var import_obsidian7 = require("obsidian");
var ProjectEditorModal = class extends import_obsidian7.Modal {
  constructor(app, initial = {}) {
    super(app);
    this.initial = initial;
  }
  resolveResult;
  result = new Promise((resolve) => this.resolveResult = resolve);
  finished = false;
  finish(value) {
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(value);
      this.close();
    }
  }
  onOpen() {
    this.modalEl.addClass("ticktick-project-editor-modal");
    this.titleEl.setText(this.initial.name ? "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0644\u06CC\u0633\u062A TickTick" : "\u0633\u0627\u062E\u062A \u0644\u06CC\u0633\u062A TickTick");
    let name = String(this.initial.name ?? "");
    let color = String(this.initial.color ?? "#4772fa");
    let viewMode = String(this.initial.viewMode ?? "list");
    const kind = String(this.initial.kind ?? "TASK").toUpperCase() === "NOTE" ? "NOTE" : "TASK";
    new import_obsidian7.Setting(this.contentEl).setName("\u0646\u0627\u0645 \u0644\u06CC\u0633\u062A").addText((input) => {
      input.setValue(name).onChange((value) => name = value);
      input.inputEl.dir = "rtl";
      input.inputEl.focus();
    });
    new import_obsidian7.Setting(this.contentEl).setName("\u0631\u0646\u06AF").setDesc("\u06A9\u062F \u0631\u0646\u06AF \u0645\u0627\u0646\u0646\u062F #4772fa").addText((input) => {
      input.setValue(color).onChange((value) => color = value.trim());
      input.inputEl.dir = "ltr";
    });
    new import_obsidian7.Setting(this.contentEl).setName("\u0646\u0645\u0627\u06CC\u0634").addDropdown((dropdown) => dropdown.addOption("list", "\u0641\u0647\u0631\u0633\u062A").addOption("kanban", "\u06A9\u0627\u0646\u0628\u0627\u0646").addOption("timeline", "Timeline").setValue(viewMode).onChange((value) => viewMode = value));
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "\u0627\u0646\u0635\u0631\u0627\u0641" }).addEventListener("click", () => this.finish(null));
    actions.createEl("button", { text: "\u0630\u062E\u06CC\u0631\u0647", cls: "mod-cta" }).addEventListener("click", () => {
      if (!name.trim()) {
        new import_obsidian7.Notice("\u0646\u0627\u0645 \u0644\u06CC\u0633\u062A \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646.");
        return;
      }
      if (color && !/^#[0-9a-f]{6}$/i.test(color)) {
        new import_obsidian7.Notice("\u0631\u0646\u06AF \u0628\u0627\u06CC\u062F \u0645\u0627\u0646\u0646\u062F #4772fa \u0628\u0627\u0634\u062F.");
        return;
      }
      this.finish({ name: name.trim(), color, viewMode, kind, sortOrder: this.initial.sortOrder });
    });
  }
  onClose() {
    this.contentEl.empty();
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(null);
    }
  }
  openAndWait() {
    this.open();
    return this.result;
  }
};

// src/obsidian/project-board.ts
var HABIT_BOARD_VIEW_ID = "ticktick:view:habits";
var ProjectBoard = class {
  constructor(element, host) {
    this.element = element;
    this.host = host;
  }
  selected = "";
  collapsed = /* @__PURE__ */ new Set();
  initialized = false;
  sortMode = "ticktick";
  sidebarCollapsed = false;
  lastSelectedProject = null;
  savedColumnsScrollLeft = 0;
  async render() {
    if (!this.initialized) {
      const saved = this.host.preferences();
      this.selected = saved.selected;
      this.collapsed = new Set(saved.collapsed);
      this.sidebarCollapsed = saved.sidebarPreferenceInitialized ? Boolean(saved.sidebarCollapsed) : true;
      this.initialized = true;
      if (!saved.sidebarPreferenceInitialized) void this.host.savePreferences({ selected: this.selected, collapsed: [...this.collapsed], sidebarCollapsed: true, sidebarPreferenceInitialized: true });
    }
    const existingCols = this.element.querySelector(".ticktick-project-columns");
    this.savedColumnsScrollLeft = existingCols?.scrollLeft ?? 0;
    this.element.empty();
    this.element.addClass("ticktick-project-board");
    const root = this.element.createDiv({ cls: "ticktick-project-board-root" });
    try {
      const projects = await this.host.projects();
      if (!this.selected || this.selected === "ticktick:view:all") this.selected = String(projects[0]?.id ?? INBOX_BOARD_VIEW_ID);
      const rail = root.createDiv({ cls: `ticktick-project-rail ${this.sidebarCollapsed ? "is-collapsed" : ""}` });
      root.toggleClass("is-rail-collapsed", this.sidebarCollapsed);
      const railHeader = rail.createDiv({ cls: "ticktick-rail-header" });
      const headerIcon = railHeader.createSpan({ cls: "ticktick-rail-icon" });
      (0, import_obsidian8.setIcon)(headerIcon, "folders");
      railHeader.createSpan({ text: "\u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627 \u0648 \u0644\u06CC\u0633\u062A\u200C\u0647\u0627" });
      const collapseBtn = railHeader.createEl("button", { cls: "ticktick-rail-collapse", attr: { type: "button", "aria-label": this.sidebarCollapsed ? "\u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u0641\u0647\u0631\u0633\u062A" : "\u062C\u0645\u0639 \u06A9\u0631\u062F\u0646 \u0641\u0647\u0631\u0633\u062A" } });
      (0, import_obsidian8.setIcon)(collapseBtn, this.sidebarCollapsed ? "panel-right-open" : "panel-right-close");
      collapseBtn.addEventListener("click", () => {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        void this.persistAndRender();
      });
      if (this.sidebarCollapsed) {
        rail.createEl("button", { cls: "ticktick-rail-expand-label", text: "\u0644\u06CC\u0633\u062A\u200C\u0647\u0627", attr: { type: "button" } }).addEventListener("click", () => {
          this.sidebarCollapsed = false;
          void this.persistAndRender();
        });
      } else {
        const virtual = virtualBoardEntries(this.host.tasks());
        const inbox = rail.createEl("button", { cls: `ticktick-project-row ${this.selected === INBOX_BOARD_VIEW_ID ? "is-selected" : ""}`, attr: { type: "button", "aria-label": `\u0648\u0631\u0648\u062F\u06CC\u060C ${virtual.inbox.count} \u062A\u0633\u06A9 \u0628\u0627\u0632` } });
        const inboxIcon = inbox.createSpan({ cls: "ticktick-project-row-icon" });
        (0, import_obsidian8.setIcon)(inboxIcon, "inbox");
        inbox.createSpan({ cls: "ticktick-project-name", text: "\u0648\u0631\u0648\u062F\u06CC" });
        inbox.createSpan({ cls: "ticktick-project-count", text: String(virtual.inbox.count) });
        inbox.addEventListener("click", () => {
          this.selected = INBOX_BOARD_VIEW_ID;
          void this.persistAndRender();
        });
        const habits = rail.createEl("button", { cls: `ticktick-project-row ${this.selected === HABIT_BOARD_VIEW_ID ? "is-selected" : ""}`, attr: { type: "button", "aria-label": `\u0639\u0627\u062F\u062A\u200C\u0647\u0627\u060C ${this.host.habits().length} \u0639\u0627\u062F\u062A` } });
        const habitsIcon = habits.createSpan({ cls: "ticktick-project-row-icon" });
        (0, import_obsidian8.setIcon)(habitsIcon, "activity");
        habits.createSpan({ cls: "ticktick-project-name", text: "\u0639\u0627\u062F\u062A\u200C\u0647\u0627" });
        habits.createSpan({ cls: "ticktick-project-count", text: String(this.host.habits().length) });
        habits.addEventListener("click", () => {
          this.selected = HABIT_BOARD_VIEW_ID;
          void this.persistAndRender();
        });
        const viewHeading = rail.createEl("button", {
          cls: `ticktick-project-group ${this.collapsed.has("virtual-views") ? "is-collapsed" : ""}`,
          attr: { type: "button" }
        });
        const viewChevron = viewHeading.createSpan({ cls: "ticktick-group-chevron" });
        (0, import_obsidian8.setIcon)(viewChevron, this.collapsed.has("virtual-views") ? "chevron-left" : "chevron-down");
        viewHeading.createSpan({ cls: "ticktick-group-title", text: "\u0646\u0645\u0627\u06CC\u0634\u200C\u0647\u0627" });
        viewHeading.addEventListener("click", () => {
          this.collapsed.has("virtual-views") ? this.collapsed.delete("virtual-views") : this.collapsed.add("virtual-views");
          void this.persistAndRender();
        });
        if (!this.collapsed.has("virtual-views")) {
          const recurring = rail.createEl("button", {
            cls: `ticktick-project-row ${this.selected === RECURRING_BOARD_VIEW_ID ? "is-selected" : ""}`,
            attr: { type: "button", "aria-label": `\u062A\u06A9\u0631\u0627\u0631\u0634\u0648\u0646\u062F\u0647\u200C\u0647\u0627\u060C ${virtual.recurring.count} \u062A\u0633\u06A9 \u0628\u0627\u0632` }
          });
          const recurringIcon = recurring.createSpan({ cls: "ticktick-project-row-icon" });
          (0, import_obsidian8.setIcon)(recurringIcon, "repeat-2");
          recurring.createSpan({ cls: "ticktick-project-name", text: virtual.recurring.name });
          recurring.createSpan({ cls: "ticktick-project-count", text: String(virtual.recurring.count) });
          recurring.addEventListener("click", () => {
            this.selected = RECURRING_BOARD_VIEW_ID;
            void this.persistAndRender();
          });
        }
        const tagHeading = rail.createEl("button", {
          cls: `ticktick-project-group ${this.collapsed.has("virtual-tags") ? "is-collapsed" : ""}`,
          attr: { type: "button" }
        });
        const tagChevron = tagHeading.createSpan({ cls: "ticktick-group-chevron" });
        (0, import_obsidian8.setIcon)(tagChevron, this.collapsed.has("virtual-tags") ? "chevron-left" : "chevron-down");
        tagHeading.createSpan({ cls: "ticktick-group-title", text: "\u0628\u0631\u0686\u0633\u0628\u200C\u0647\u0627" });
        tagHeading.addEventListener("click", () => {
          this.collapsed.has("virtual-tags") ? this.collapsed.delete("virtual-tags") : this.collapsed.add("virtual-tags");
          void this.persistAndRender();
        });
        if (!this.collapsed.has("virtual-tags")) {
          for (const tag of virtual.tags) {
            const row = rail.createEl("button", {
              cls: `ticktick-project-row ticktick-tag-view-row ${this.selected === tag.id ? "is-selected" : ""}`,
              attr: { type: "button", "aria-label": `\u0628\u0631\u0686\u0633\u0628 ${tag.name}\u060C ${tag.count} \u062A\u0633\u06A9 \u0628\u0627\u0632` }
            });
            const tagIcon = row.createSpan({ cls: "ticktick-project-row-icon" });
            (0, import_obsidian8.setIcon)(tagIcon, "tag");
            row.createSpan({ cls: "ticktick-project-name", text: `#${tag.name}` });
            row.createSpan({ cls: "ticktick-project-count", text: String(tag.count) });
            row.addEventListener("click", () => {
              this.selected = tag.id;
              void this.persistAndRender();
            });
          }
        }
        for (const group of sidebarTree(projects, this.host.tasks())) {
          const key = group.name || "flat";
          const groupHeading = rail.createEl("button", {
            cls: `ticktick-project-group ${this.collapsed.has(key) ? "is-collapsed" : ""}`,
            attr: { type: "button" }
          });
          const groupChevron = groupHeading.createSpan({ cls: "ticktick-group-chevron" });
          (0, import_obsidian8.setIcon)(groupChevron, this.collapsed.has(key) ? "chevron-left" : "chevron-down");
          groupHeading.createSpan({ cls: "ticktick-group-title", text: group.name || "\u0644\u06CC\u0633\u062A\u200C\u0647\u0627" });
          groupHeading.addEventListener("click", () => {
            this.collapsed.has(key) ? this.collapsed.delete(key) : this.collapsed.add(key);
            void this.persistAndRender();
          });
          if (this.collapsed.has(key)) continue;
          for (const project2 of group.projects) {
            const row = rail.createEl("button", {
              cls: `ticktick-project-row ${this.selected === String(project2.id) ? "is-selected" : ""}`,
              attr: { type: "button", "aria-label": `${project2.name}\u060C ${project2.openCount} \u062A\u0633\u06A9 \u0628\u0627\u0632` }
            });
            const dot = row.createSpan({ cls: "ticktick-project-dot" });
            dot.style.setProperty("--project-color", project2.color ?? "var(--interactive-accent)");
            row.createSpan({ cls: "ticktick-project-name", text: project2.name });
            row.createSpan({ cls: "ticktick-project-count", text: String(project2.openCount) });
            row.addEventListener("click", () => {
              this.selected = String(project2.id);
              void this.persistAndRender();
            });
          }
        }
        const newProjectBtn = rail.createEl("button", {
          cls: "ticktick-new-project-btn",
          attr: { type: "button" }
        });
        const plusIcon = newProjectBtn.createSpan({ cls: "ticktick-btn-icon" });
        (0, import_obsidian8.setIcon)(plusIcon, "folder-plus");
        newProjectBtn.createSpan({ text: "+ \u0644\u06CC\u0633\u062A \u062C\u062F\u06CC\u062F\u2026" });
        newProjectBtn.addEventListener("click", async () => {
          const draft = await new ProjectEditorModal(this.host.app).openAndWait();
          if (!draft) return;
          newProjectBtn.disabled = true;
          try {
            const project2 = await this.host.createProject(draft);
            this.selected = String(project2?.id ?? "");
            await this.host.refresh();
            await this.persistAndRender();
            new import_obsidian8.Notice("\u0644\u06CC\u0633\u062A \u062F\u0631 TickTick \u0633\u0627\u062E\u062A\u0647 \u0634\u062F.");
          } catch (error) {
            new import_obsidian8.Notice(error instanceof Error ? error.message : "\u0633\u0627\u062E\u062A \u0644\u06CC\u0633\u062A \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          } finally {
            newProjectBtn.disabled = false;
          }
        });
      }
      const main = root.createDiv({ cls: "ticktick-project-main" });
      if (this.selected === HABIT_BOARD_VIEW_ID) {
        this.renderHabitBoard(main);
        return;
      }
      const project = projects.find((item) => String(item.id) === this.selected);
      const virtualData = virtualBoardData(this.selected, this.host.tasks(), projects);
      const displayProject = virtualData?.project ?? project;
      if (!displayProject) {
        const emptyState2 = main.createDiv({ cls: "ticktick-board-empty" });
        const emptyIcon = emptyState2.createSpan({ cls: "ticktick-empty-icon" });
        (0, import_obsidian8.setIcon)(emptyIcon, "folder-open");
        emptyState2.createEl("h3", { text: "\u06CC\u06A9 \u0644\u06CC\u0633\u062A \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646\u06CC\u062F" });
        emptyState2.createEl("p", { text: "\u0628\u0631\u0627\u06CC \u0645\u0634\u0627\u0647\u062F\u0647 \u06A9\u0627\u0631\u062A\u200C\u0647\u0627\u060C \u06CC\u06A9\u06CC \u0627\u0632 \u0644\u06CC\u0633\u062A\u200C\u0647\u0627\u06CC \u0646\u0648\u0627\u0631 \u06A9\u0646\u0627\u0631\u06CC \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u0641\u0631\u0645\u0627\u06CC\u06CC\u062F." });
        return;
      }
      const projectHeader = main.createDiv({ cls: "ticktick-project-header" });
      const headerInfo = projectHeader.createDiv({ cls: "ticktick-project-header-info" });
      if (displayProject.color) {
        const pDot = headerInfo.createSpan({ cls: "ticktick-header-dot" });
        pDot.style.setProperty("--project-color", displayProject.color);
      }
      headerInfo.createEl("h2", { cls: "ticktick-project-title", text: displayProject.name });
      headerInfo.createSpan({
        cls: "ticktick-project-badge",
        text: `${virtualData ? virtualData.tasks.filter((task) => Number(task.status ?? 0) === 0).length : project?.openCount ?? 0} \u062A\u0633\u06A9 \u0628\u0627\u0632`
      });
      const toolbar = projectHeader.createDiv({ cls: "ticktick-project-toolbar" });
      if (project) {
        const addTaskBtn = toolbar.createEl("button", {
          cls: "ticktick-toolbar-btn ticktick-toolbar-btn-cta",
          attr: { type: "button", "aria-label": "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u062C\u062F\u06CC\u062F" }
        });
        const addIcon = addTaskBtn.createSpan({ cls: "ticktick-btn-icon" });
        (0, import_obsidian8.setIcon)(addIcon, "plus");
        addTaskBtn.createSpan({ cls: "ticktick-toolbar-btn-text", text: "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9" });
        addTaskBtn.addEventListener("click", async () => {
          addTaskBtn.disabled = true;
          try {
            const created = await this.host.createTask({ projectId: project.id });
            if (!created) return;
            await this.host.refresh();
            await this.render();
            new import_obsidian8.Notice("\u062A\u0633\u06A9 \u062F\u0631 \u0627\u06CC\u0646 \u0644\u06CC\u0633\u062A \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.");
          } catch (error) {
            new import_obsidian8.Notice(error instanceof Error ? error.message : "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          } finally {
            addTaskBtn.disabled = false;
          }
        });
      }
      const sortLabels = {
        ticktick: "\u062A\u0631\u062A\u06CC\u0628 TickTick",
        time: "\u062A\u0627\u0631\u06CC\u062E/\u0633\u0627\u0639\u062A",
        priority: "\u0627\u0648\u0644\u0648\u06CC\u062A",
        title: "\u0639\u0646\u0648\u0627\u0646"
      };
      const sortBtn = toolbar.createDiv({
        cls: "ticktick-filter-select-wrapper",
        attr: { role: "button", tabindex: "0", "aria-label": "\u0645\u0631\u062A\u0628\u200C\u0633\u0627\u0632\u06CC \u06A9\u0627\u0631\u062A\u200C\u0647\u0627\u06CC \u0628\u0631\u062F" }
      });
      const sortIcon = sortBtn.createSpan({ cls: "ticktick-select-icon" });
      (0, import_obsidian8.setIcon)(sortIcon, "arrow-up-down");
      sortBtn.createSpan({
        cls: "ticktick-filter-select-label",
        text: `\u0645\u0631\u062A\u0628\u200C\u0633\u0627\u0632\u06CC: ${sortLabels[this.sortMode] ?? "\u062A\u0631\u062A\u06CC\u0628 TickTick"}`
      });
      const sortChevron = sortBtn.createSpan({ cls: "ticktick-select-chevron" });
      (0, import_obsidian8.setIcon)(sortChevron, "chevron-down");
      const openSortMenu = (event) => {
        const menu = new import_obsidian8.Menu();
        for (const [value, label] of [["ticktick", "\u062A\u0631\u062A\u06CC\u0628 TickTick"], ["time", "\u062A\u0627\u0631\u06CC\u062E/\u0633\u0627\u0639\u062A"], ["priority", "\u0627\u0648\u0644\u0648\u06CC\u062A"], ["title", "\u0639\u0646\u0648\u0627\u0646"]]) {
          menu.addItem((item) => {
            item.setTitle(label).setChecked(this.sortMode === value).onClick(() => {
              this.sortMode = value;
              void this.render();
            });
          });
        }
        if (event instanceof MouseEvent) {
          menu.showAtMouseEvent(event);
        } else {
          const rect = sortBtn.getBoundingClientRect();
          menu.showAtPosition({ x: rect.right, y: rect.bottom });
        }
      };
      sortBtn.addEventListener("click", openSortMenu);
      sortBtn.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openSortMenu(event);
        }
      });
      const refreshBtn = toolbar.createEl("button", {
        cls: "ticktick-toolbar-btn",
        attr: { type: "button", "aria-label": "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0648 \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC" }
      });
      const refreshIcon = refreshBtn.createSpan({ cls: "ticktick-btn-icon" });
      (0, import_obsidian8.setIcon)(refreshIcon, "refresh-cw");
      refreshBtn.createSpan({ cls: "ticktick-toolbar-btn-text", text: "\u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC" });
      refreshBtn.addEventListener("click", async () => {
        refreshBtn.disabled = true;
        refreshIcon.addClass("is-syncing");
        try {
          await this.host.refresh();
          await this.render();
        } catch (error) {
          new import_obsidian8.Notice(error instanceof Error ? error.message : "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
        } finally {
          refreshBtn.disabled = false;
          refreshIcon.removeClass("is-syncing");
        }
      });
      if (project) {
        const editBtn = toolbar.createEl("button", {
          cls: "ticktick-toolbar-btn",
          attr: { type: "button", "aria-label": "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0644\u06CC\u0633\u062A" }
        });
        const editIcon = editBtn.createSpan({ cls: "ticktick-btn-icon" });
        (0, import_obsidian8.setIcon)(editIcon, "pencil");
        editBtn.createSpan({ cls: "ticktick-toolbar-btn-text", text: "\u0648\u06CC\u0631\u0627\u06CC\u0634" });
        editBtn.addEventListener("click", async () => {
          const draft = await new ProjectEditorModal(this.host.app, project).openAndWait();
          if (!draft) return;
          editBtn.disabled = true;
          try {
            await this.host.updateProject({ ...project, ...draft });
            await this.host.refresh();
            await this.render();
            new import_obsidian8.Notice("\u0644\u06CC\u0633\u062A \u062F\u0631 TickTick \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u062F.");
          } catch (error) {
            new import_obsidian8.Notice(error instanceof Error ? error.message : "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0644\u06CC\u0633\u062A \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          } finally {
            editBtn.disabled = false;
          }
        });
        const deleteBtn = toolbar.createEl("button", {
          cls: "ticktick-toolbar-btn ticktick-toolbar-btn-danger",
          attr: { type: "button", "aria-label": "\u062D\u0630\u0641 \u0644\u06CC\u0633\u062A" }
        });
        const deleteIcon = deleteBtn.createSpan({ cls: "ticktick-btn-icon" });
        (0, import_obsidian8.setIcon)(deleteIcon, "trash-2");
        deleteBtn.createSpan({ cls: "ticktick-toolbar-btn-text", text: "\u062D\u0630\u0641" });
        deleteBtn.addEventListener("click", async () => {
          if (!window.confirm(`\u0644\u06CC\u0633\u062A \xAB${project.name}\xBB \u0648 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0622\u0646 \u062F\u0631 TickTick \u062D\u0630\u0641 \u0634\u0648\u062F\u061F`)) return;
          deleteBtn.disabled = true;
          try {
            await this.host.deleteProject(String(project.id));
            this.selected = "";
            await this.host.refresh();
            await this.persistAndRender();
            new import_obsidian8.Notice("\u0644\u06CC\u0633\u062A \u0627\u0632 TickTick \u062D\u0630\u0641 \u0634\u062F.");
          } catch (error) {
            deleteBtn.disabled = false;
            new import_obsidian8.Notice(error instanceof Error ? error.message : "\u062D\u0630\u0641 \u0644\u06CC\u0633\u062A \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
      }
      const data = virtualData ?? await this.host.board(project);
      if (!data) return;
      const columns = main.createDiv({ cls: "ticktick-project-columns" });
      enhanceHorizontalScroll(columns);
      if (this.lastSelectedProject === this.selected && this.savedColumnsScrollLeft > 0) {
        columns.scrollLeft = this.savedColumnsScrollLeft;
      } else {
        scrollToStart(columns);
      }
      this.lastSelectedProject = this.selected;
      for (const column of boardColumns(data, this.host.showCompleted())) {
        const shell = columns.createDiv({ cls: "ticktick-project-column" });
        shell.dataset.columnId = String(column.id);
        const colHeader = shell.createDiv({ cls: "ticktick-column-header" });
        colHeader.createEl("strong", { cls: "ticktick-column-name", text: column.name });
        colHeader.createSpan({ cls: "ticktick-column-count", text: String(column.count) });
        const movableColumn = Boolean(project) && !column.synthetic;
        if (movableColumn) {
          const addToColumn = colHeader.createEl("button", { cls: "ticktick-column-add mod-icon", attr: { type: "button", "aria-label": `\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0628\u0647 \u0633\u062A\u0648\u0646 ${column.name}`, title: "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0628\u0647 \u0627\u06CC\u0646 \u0633\u062A\u0648\u0646" } });
          (0, import_obsidian8.setIcon)(addToColumn, "plus");
          addToColumn.addEventListener("click", async (event) => {
            event.stopPropagation();
            addToColumn.disabled = true;
            try {
              await this.host.createTask({ projectId: project.id, columnId: column.id });
              new import_obsidian8.Notice(`\u062A\u0633\u06A9 \u062C\u062F\u06CC\u062F \u0628\u0647 \u0633\u062A\u0648\u0646 \xAB${column.name}\xBB \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.`);
              await this.render();
            } catch (error) {
              new import_obsidian8.Notice(error instanceof Error ? error.message : "\u0633\u0627\u062E\u062A \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
            } finally {
              addToColumn.disabled = false;
            }
          });
        }
        if (column.synthetic) {
          shell.createEl("small", { cls: "ticktick-column-hint", text: "\u0633\u062A\u0648\u0646 \u0646\u0645\u0627\u06CC\u0634\u06CC\u061B \u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062A" });
        }
        shell.addEventListener("dragover", (event) => {
          if (!movableColumn) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          shell.addClass("is-drag-over");
        });
        shell.addEventListener("dragleave", (event) => {
          if (!shell.contains(event.relatedTarget)) shell.removeClass("is-drag-over");
        });
        shell.addEventListener("drop", (event) => {
          event.preventDefault();
          shell.removeClass("is-drag-over");
          if (!movableColumn) {
            new import_obsidian8.Notice("\u0627\u06CC\u0646 \u0633\u062A\u0648\u0646 \u0646\u0645\u0627\u06CC\u0634\u06CC \u0627\u0633\u062A \u0648 \u0645\u0642\u0635\u062F \u0627\u0646\u062A\u0642\u0627\u0644 \u0646\u06CC\u0633\u062A.");
            return;
          }
          const id = event.dataTransfer?.getData("text/ticktick-board-task");
          const task = data.tasks.find((item) => String(item.id) === id);
          if (!task || String(task.columnId ?? "") === String(column.id)) return;
          const cardEl = this.element.querySelector(`[data-task-id="${task.id}"]`);
          const sourceCol = cardEl?.closest(".ticktick-project-column");
          const oldColumnId = task.columnId;
          if (cardEl && listWrap) {
            listWrap.appendChild(cardEl);
            const srcBadge = sourceCol?.querySelector(".ticktick-column-count");
            if (srcBadge) {
              const count = parseInt(srcBadge.textContent || "0", 10);
              if (count > 0) srcBadge.textContent = String(count - 1);
            }
            const tgtBadge = shell.querySelector(".ticktick-column-count");
            if (tgtBadge) {
              const count = parseInt(tgtBadge.textContent || "0", 10);
              tgtBadge.textContent = String(count + 1);
            }
          }
          task.columnId = String(column.id);
          void this.moveTask(task, String(column.id), cardEl, sourceCol, oldColumnId);
        });
        const listWrap = shell.createDiv({ cls: "ticktick-column-cards" });
        for (const group of column.groups) {
          if (group.name) {
            listWrap.createEl("h4", { cls: "ticktick-group-heading", text: group.name });
          }
          for (const task of sortPlanningTasks(group.tasks, this.sortMode)) {
            this.card(listWrap, task, displayProject.color, Boolean(project));
          }
        }
      }
    } catch (error) {
      root.createEl("p", { text: error instanceof Error ? error.message : "\u062F\u0627\u062F\u0647\u0654 \u067E\u0631\u0648\u0698\u0647 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A." });
    }
  }
  async persistAndRender() {
    await this.host.savePreferences({ selected: this.selected, collapsed: [...this.collapsed], sidebarCollapsed: this.sidebarCollapsed, sidebarPreferenceInitialized: true });
    await this.render();
  }
  renderHabitBoard(main) {
    const habits = this.host.habits();
    const header = main.createDiv({ cls: "ticktick-project-header" });
    const info = header.createDiv({ cls: "ticktick-project-header-info" });
    info.createEl("h2", { cls: "ticktick-project-title", text: "\u0639\u0627\u062F\u062A\u200C\u0647\u0627" });
    info.createSpan({ cls: "ticktick-project-badge", text: `${habits.length} \u0639\u0627\u062F\u062A` });
    const cards = main.createDiv({ cls: "ticktick-habit-board-cards" });
    if (!habits.length) {
      cards.createDiv({ cls: "ticktick-board-empty", text: "\u0639\u0627\u062F\u062A\u06CC \u062F\u0631 \u06A9\u0634 \u0645\u062D\u0644\u06CC \u0646\u06CC\u0633\u062A\u061B \u06CC\u06A9 \u0628\u0627\u0631 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u06A9\u0646\u06CC\u062F." });
      return;
    }
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: this.host.timeZone }).format(/* @__PURE__ */ new Date());
    for (const habit of habits) {
      const goal = Math.max(1, Number(habit.goal ?? habit.target ?? 1));
      const entry = this.host.habitHistory(String(habit.id), today, today)[0] ?? {};
      const value = Number(entry.value ?? 0);
      const completed = entry.completed || value >= goal;
      const habitWithCheckin = {
        ...habit,
        checkin: {
          value,
          goal,
          status: completed ? 2 : 0,
          ...habit.checkin
        }
      };
      renderUnifiedHabitCard(cards, {
        habit: habitWithCheckin,
        day: today,
        variant: "board",
        onCheckIn: async (h, d) => {
          await this.host.checkInHabit(h, d);
          await this.render();
        },
        onOpenDetails: (h, d) => {
          new HabitDetailsModal(this.host.app, habit, {
            firstWeekday: this.host.firstWeekday,
            habits: (day) => this.host.habits().filter((item) => String(item.id) === String(habit.id) || false),
            habitHistory: this.host.habitHistory,
            setHabitProgress: this.host.setHabitProgress
          }, d).open();
        }
      });
    }
  }
  card(parent, task, projectColor, movable = true) {
    const bound = this.host.binding(task);
    const priority = taskPriority(task.priority);
    const isNote = String(task.kind ?? task.type ?? task.taskType ?? "").toUpperCase() === "NOTE";
    const isPinned2 = Boolean(task.pinned ?? task.isPinned ?? task.pin ?? task.pinnedTime ?? task.pinnedAt ?? task.pinTime);
    const isCompleted = Number(task.status ?? 0) !== 0;
    const tone = projectColor || (Number(task.priority) === 5 ? "var(--color-red, #e74c3c)" : Number(task.priority) === 3 ? "var(--color-orange, #e67e22)" : Number(task.priority) === 1 ? "var(--color-blue, #3498db)" : "var(--interactive-accent)");
    const card = parent.createDiv({
      cls: `ticktick-project-card priority-${priority.value} ${isCompleted ? "is-completed" : ""} ${isNote ? "is-note" : ""}`,
      attr: {
        role: "button",
        tabindex: "0",
        "aria-label": `\u062C\u0632\u0626\u06CC\u0627\u062A ${task.title}`,
        title: "\u0628\u0631\u0627\u06CC \u062F\u06CC\u062F\u0646 \u062C\u0632\u0626\u06CC\u0627\u062A \u06A9\u0644\u06CC\u06A9 \u06A9\u0646\u06CC\u062F"
      }
    });
    card.dataset.taskId = String(task.id);
    card.draggable = movable;
    card.style.setProperty("--ticktick-task-tone", tone);
    card.addEventListener("dragstart", (event) => {
      if (!movable) return;
      card.addClass("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer?.setData("text/ticktick-board-task", String(task.id));
    });
    card.addEventListener("dragend", () => card.removeClass("is-dragging"));
    const top = card.createDiv({ cls: "ticktick-project-card-top" });
    const check = isNote ? null : top.createEl("input", {
      type: "checkbox",
      cls: "ticktick-project-check",
      attr: { "aria-label": `\u062A\u06A9\u0645\u06CC\u0644 ${task.title}` }
    });
    if (check) {
      check.checked = isCompleted;
      check.disabled = isCompleted;
      check.setAttribute("draggable", "false");
    }
    if (isNote) {
      const noteIcon = top.createSpan({ cls: "ticktick-project-note-icon", attr: { title: "\u06CC\u0627\u062F\u062F\u0627\u0634\u062A TickTick" } });
      (0, import_obsidian8.setIcon)(noteIcon, "file-text");
    }
    const titleEl = top.createDiv({
      cls: "ticktick-project-card-title",
      text: String(task.title ?? "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646")
    });
    titleEl.addEventListener("click", (event) => {
      event.stopPropagation();
      details();
    });
    if (priority.value > 0) {
      top.createSpan({
        cls: `ticktick-project-priority ${priority.className}`,
        text: priority.label,
        attr: { title: `\u0627\u0648\u0644\u0648\u06CC\u062A: ${priority.label}` }
      });
    }
    if (isPinned2) {
      const pin = top.createSpan({ cls: "ticktick-project-pin", attr: { title: "\u067E\u06CC\u0646\u200C\u0634\u062F\u0647" } });
      (0, import_obsidian8.setIcon)(pin, "pin");
    }
    const description = taskDescription(task);
    if (description) {
      card.createEl("small", { cls: "ticktick-project-card-desc", text: description.slice(0, 110) });
    }
    const hasDueDate = Boolean(task.dueDate);
    const hasRepeat = Boolean(task.repeatFlag);
    const tags = task.tags ?? [];
    if (hasDueDate || hasRepeat || tags.length > 0 || bound) {
      const meta = card.createDiv({ cls: "ticktick-project-card-meta" });
      if (hasDueDate) {
        const dueChip = meta.createSpan({ cls: "ticktick-meta-chip" });
        const dueIcon = dueChip.createSpan({ cls: "ticktick-meta-icon" });
        (0, import_obsidian8.setIcon)(dueIcon, "calendar");
        dueChip.createSpan({ text: formatPersianDate(task.dueDate, task.timeZone) });
      }
      if (hasRepeat) {
        const repChip = meta.createSpan({ cls: "ticktick-meta-chip" });
        const repIcon = repChip.createSpan({ cls: "ticktick-meta-icon" });
        (0, import_obsidian8.setIcon)(repIcon, "repeat");
        repChip.createSpan({ text: "\u062A\u06A9\u0631\u0627\u0631" });
      }
      for (const tag of tags) {
        const tagChip = meta.createSpan({ cls: "ticktick-meta-chip ticktick-tag-chip" });
        tagChip.createSpan({ text: `#${tag}` });
      }
      if (bound) {
        const mdChip = meta.createSpan({ cls: "ticktick-meta-chip ticktick-bound-chip" });
        const mdIcon = mdChip.createSpan({ cls: "ticktick-meta-icon" });
        (0, import_obsidian8.setIcon)(mdIcon, "file-text");
        mdChip.createSpan({ text: "Markdown" });
      }
    }
    const details = () => new TaskDetailsModal(this.host.app, task, {
      complete: async () => {
        await this.host.complete(task);
        await this.render();
      },
      load: (item) => this.host.load(item),
      edit: (item) => this.host.edit(item),
      changed: async () => {
        await this.host.refresh();
        await this.render();
      }
    }).open();
    card.addEventListener("click", details);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        details();
      }
    });
    check?.addEventListener("mousedown", (event) => event.stopPropagation());
    check?.addEventListener("click", (event) => event.stopPropagation());
    check?.addEventListener("change", async () => {
      check.disabled = true;
      card.addClass("is-completed");
      const hideCompleted = !this.host.showCompleted();
      if (hideCompleted) {
        card.addClass("is-leaving");
      }
      try {
        await this.host.complete(task);
        task.status = 2;
        new import_obsidian8.Notice(bound ? "\u062A\u0633\u06A9 \u062F\u0631 \u0641\u0627\u06CC\u0644 \u0645\u0627\u0631\u06A9\u200C\u062F\u0627\u0648\u0646 \u0648 TickTick \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F." : "\u062A\u0633\u06A9 \u062F\u0631 TickTick \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F.");
        if (hideCompleted) {
          setTimeout(() => {
            const col = card.closest(".ticktick-project-column");
            const badge = col?.querySelector(".ticktick-column-count");
            card.remove();
            if (badge) {
              const current = parseInt(badge.textContent || "0", 10);
              if (current > 0) badge.textContent = String(current - 1);
            }
          }, 220);
        }
      } catch (error) {
        card.removeClass("is-completed");
        card.removeClass("is-leaving");
        check.checked = false;
        check.disabled = false;
        new import_obsidian8.Notice(error instanceof Error ? error.message : "\u062A\u06A9\u0645\u06CC\u0644 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      }
    });
  }
  async moveTask(task, columnId, optimisticCard, sourceCol, oldColumnId) {
    try {
      await this.host.moveToColumn(task, columnId);
      new import_obsidian8.Notice("\u062A\u0633\u06A9 \u0628\u0647 \u0633\u062A\u0648\u0646 \u062C\u062F\u06CC\u062F \u0645\u0646\u062A\u0642\u0644 \u0648 \u0628\u0627 TickTick \u0647\u0645\u06AF\u0627\u0645 \u0634\u062F.");
    } catch (error) {
      if (optimisticCard && sourceCol) {
        const srcList = sourceCol.querySelector(".ticktick-column-cards");
        srcList?.appendChild(optimisticCard);
        task.columnId = oldColumnId;
      }
      new import_obsidian8.Notice(error instanceof Error ? error.message : "\u0627\u0646\u062A\u0642\u0627\u0644 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    }
  }
};

// src/obsidian/note-import.ts
var import_obsidian9 = require("obsidian");

// src/core/ticktick-note.js
function normalizeTickTickNote(record, project = {}) {
  if (!record || String(record.kind ?? "").toUpperCase() !== "NOTE") return null;
  const id = String(record.id ?? "").trim();
  const title = String(record.title ?? "").trim();
  if (!id || !title) return null;
  return { id, title, projectId: String(record.projectId ?? project.id ?? ""), projectName: String(record.projectName ?? project.name ?? ""), kind: "NOTE", content: String(record.content ?? record.desc ?? ""), modifiedTime: record.modifiedTime ?? record.modifiedAt ?? null, tags: Array.isArray(record.tags) ? record.tags.map(String) : [] };
}
function noteFileName(note) {
  return `${String(note.title).replace(/[\\/:*?"<>|]/g, "-").trim().slice(0, 80) || "TickTick Note"}-${note.id}.md`;
}
function noteMarkdown(note, importedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  return `---
ticktickNoteId: ${note.id}
ticktickProjectId: ${note.projectId}
ticktickKind: NOTE
ticktickImportedAt: ${importedAt}
---

<!-- ticktick-bridge:note:start -->
${note.content}
<!-- ticktick-bridge:note:end -->
`;
}

// src/obsidian/note-import.ts
var NoteImport = class {
  constructor(app, storage, destination) {
    this.app = app;
    this.storage = storage;
    this.destination = destination;
  }
  preview(records) {
    const folder = this.destination().replace(/^\/+|\/+$/g, "") || "TickTick Notes";
    return (records ?? []).map((record) => normalizeTickTickNote(record)).filter((note) => Boolean(note)).map((note) => ({ note, path: `${folder}/${noteFileName(note)}`, selected: false, collision: Boolean(this.app.vault.getAbstractFileByPath(`${folder}/${noteFileName(note)}`)) }));
  }
  async apply(rows) {
    const selected = rows.filter((row) => row.selected);
    await this.storage.writeSnapshot("ticktick-notes-import", { count: selected.length, paths: selected.map((row) => row.path) });
    const created = [];
    const skipped = [];
    for (const row of selected) {
      if (this.app.vault.getAbstractFileByPath(row.path)) {
        skipped.push(row.path);
        continue;
      }
      const folder = row.path.split("/").slice(0, -1).join("/");
      if (folder && !this.app.vault.getAbstractFileByPath(folder)) await this.app.vault.createFolder(folder);
      await this.app.vault.create(row.path, noteMarkdown(row.note));
      created.push(row.path);
    }
    await this.storage.writeReport("ticktick-notes-import", { createdCount: created.length, skippedCount: skipped.length, paths: created });
    return { created, skipped };
  }
};
var NoteImportModal = class extends import_obsidian9.Modal {
  constructor(app, importer, records) {
    super(app);
    this.importer = importer;
    this.records = records;
  }
  async onOpen() {
    this.titleEl.setText("\u0627\u0646\u062A\u0642\u0627\u0644 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC TickTick Notes");
    const rows = this.importer.preview(this.records);
    if (!rows.length) {
      this.contentEl.createEl("p", { text: "Note \u0628\u0627 kind: NOTE \u062F\u0631 cache \u0641\u0639\u0644\u06CC \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F." });
      return;
    }
    this.contentEl.createEl("p", { text: "\u0641\u0642\u0637 \u0645\u0648\u0627\u0631\u062F \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647 \u0627\u06CC\u062C\u0627\u062F \u0645\u06CC\u200C\u0634\u0648\u0646\u062F\u061B \u0641\u0627\u06CC\u0644 \u0645\u0648\u062C\u0648\u062F \u0647\u0631\u06AF\u0632 overwrite \u0646\u0645\u06CC\u200C\u0634\u0648\u062F." });
    for (const row of rows) new import_obsidian9.Setting(this.contentEl).setName(row.note.title).setDesc(`${row.note.projectName || "\u0628\u062F\u0648\u0646 \u067E\u0631\u0648\u0698\u0647"}${row.collision ? " \xB7 \u0641\u0627\u06CC\u0644 \u0647\u0645\u200C\u0646\u0627\u0645 \u0645\u0648\u062C\u0648\u062F \u0627\u0633\u062A \u0648 \u0631\u062F \u0645\u06CC\u200C\u0634\u0648\u062F" : ""}`).addToggle((toggle) => toggle.setValue(false).setDisabled(row.collision).onChange((value) => row.selected = value));
    new import_obsidian9.Setting(this.contentEl).addButton((button) => button.setButtonText("\u0627\u0646\u062A\u0642\u0627\u0644 \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647\u200C\u0647\u0627").setCta().onClick(async () => {
      button.setDisabled(true);
      try {
        const result = await this.importer.apply(rows);
        new import_obsidian9.Notice(`${result.created.length} \u0641\u0627\u06CC\u0644 \u0627\u06CC\u062C\u0627\u062F \u0634\u062F\u061B ${result.skipped.length} \u0645\u0648\u0631\u062F \u0631\u062F \u0634\u062F.`);
        this.close();
      } catch (error) {
        button.setDisabled(false);
        new import_obsidian9.Notice(error instanceof Error ? error.message : "\u0627\u0646\u062A\u0642\u0627\u0644 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      }
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/obsidian/main.ts
init_project_board();

// src/obsidian/constants.ts
var VIEW_TYPE = "ticktick-bridge-today";
var HABIT_VIEW_TYPE = "ticktick-bridge-habits";
var PLANNER_VIEW_TYPE = "ticktick-bridge-planner";
var PROJECT_BOARD_VIEW_TYPE = "ticktick-bridge-project-board";
var CONTROL_VIEW_TYPE = "ticktick-bridge-control";
var DEFAULT_SETTINGS = {
  apiToken: "",
  webSessionToken: "",
  webSessionCookie: "",
  webSessionDeviceId: "",
  timeZone: "Asia/Tehran",
  dailyNoteFolder: "Journal",
  syncIntervalMinutes: 0,
  syncIntervalSeconds: 30,
  checkboxImportTag: "ticktick",
  scheduledCheckboxProjectId: "",
  showRibbonIcons: false,
  plannerFirstWeekday: 6,
  plannerShowCompleted: false,
  plannerShowHabits: false,
  ticktickNotesFolder: "TickTick Notes",
  experimentalChecklistReadOnly: true,
  boardLastProjectId: "",
  boardCollapsedGroups: [],
  boardSidebarCollapsed: true,
  boardSidebarPreferenceInitialized: false
};

// src/obsidian/modals/task-editor-modal.ts
var import_obsidian10 = require("obsidian");
var TaskEditorModal = class extends import_obsidian10.Modal {
  constructor(app, projects, initial) {
    super(app);
    this.projects = projects;
    this.initial = initial;
  }
  resolveResult;
  result = new Promise((resolve) => this.resolveResult = resolve);
  finished = false;
  comp = new import_obsidian10.Component();
  finish(value) {
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(value);
      this.close();
    }
  }
  onOpen() {
    this.modalEl.addClass("ticktick-modal");
    const { contentEl } = this;
    contentEl.addClass("ticktick-task-editor-modal");
    const header = contentEl.createDiv({ cls: "ticktick-editor-header" });
    header.createEl("h2", { text: this.initial.id ? "\u270F\uFE0F \u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u0633\u06A9" : "\u2728 \u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9" });
    header.createEl("p", { cls: "ticktick-task-editor-subtitle", text: "\u062A\u063A\u06CC\u06CC\u0631\u0627\u062A \u0645\u0633\u062A\u0642\u06CC\u0645\u0627\u064B \u062F\u0631 TickTick \u0630\u062E\u06CC\u0631\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F." });
    contentEl.createDiv({ cls: "ticktick-editor-divider" });
    const fields2 = contentEl.createDiv({ cls: "ticktick-editor-fields" });
    let title = String(this.initial.title ?? "");
    let description = taskDescription(this.initial);
    let projectId = String(this.initial.projectId ?? this.projects[0]?.id ?? "");
    let dueDate = toDateKey(String(this.initial.dueDate ?? ""), String(this.initial.timeZone ?? "Asia/Tehran")) ?? "";
    let reminderTime = reminderTimeFromTask(this.initial);
    new import_obsidian10.Setting(fields2).setName("\u{1F4DD} \u0639\u0646\u0648\u0627\u0646").addText((input) => {
      input.setValue(title).onChange((value) => title = value);
      input.inputEl.dir = "rtl";
      input.inputEl.addClass("ticktick-input-full-width");
    });
    const selectedProjectName = () => this.projects.find((project) => project.id === projectId)?.name ?? "\u0627\u0646\u062A\u062E\u0627\u0628 \u067E\u0631\u0648\u0698\u0647";
    new import_obsidian10.Setting(fields2).setName("\u{1F4C2} \u067E\u0631\u0648\u0698\u0647").setDesc("\u0628\u0631\u0627\u06CC \u0627\u0646\u062A\u062E\u0627\u0628 \u067E\u0631\u0648\u0698\u0647 \u06A9\u0644\u06CC\u06A9 \u06A9\u0646.").addButton((button) => {
      button.setButtonText(selectedProjectName());
      button.buttonEl.addClass("ticktick-project-picker");
      button.buttonEl.addEventListener("click", (event) => {
        const menu = new import_obsidian10.Menu();
        this.projects.forEach((project) => menu.addItem((item) => item.setTitle(project.name).setChecked(project.id === projectId).onClick(() => {
          projectId = project.id;
          button.setButtonText(selectedProjectName());
        })));
        menu.showAtMouseEvent(event);
      });
    });
    new import_obsidian10.Setting(fields2).setName("\u{1F4C5} \u062A\u0627\u0631\u06CC\u062E").setDesc("\u0628\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u062A\u0627\u0631\u06CC\u062E\u060C \u062A\u0642\u0648\u06CC\u0645 \u0633\u06CC\u0633\u062A\u0645 \u0628\u0627\u0632 \u0645\u06CC\u200C\u0634\u0648\u062F.").addText((input) => {
      input.inputEl.type = "date";
      input.setValue(dueDate).onChange((value) => dueDate = value);
      input.inputEl.dir = "ltr";
    });
    new import_obsidian10.Setting(fields2).setName("\u23F0 \u06CC\u0627\u062F\u0622\u0648\u0631\u06CC").setDesc("\u0627\u062E\u062A\u06CC\u0627\u0631\u06CC\u061B \u062F\u0631 \u0633\u0627\u0639\u062A \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647 \u062F\u0631 \u0647\u0645\u0627\u0646 \u0631\u0648\u0632 \u06CC\u0627\u062F\u0622\u0648\u0631\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F.").addText((input) => {
      input.inputEl.type = "time";
      input.setValue(reminderTime).onChange((value) => reminderTime = value);
      input.inputEl.dir = "ltr";
    });
    const descSection = fields2.createDiv({ cls: "ticktick-desc-section" });
    const descHeader = descSection.createDiv({ cls: "ticktick-desc-header" });
    const descHeaderInfo = descHeader.createDiv({ cls: "ticktick-desc-header-info" });
    descHeaderInfo.createSpan({ text: "\u{1F4CB} \u062A\u0648\u0636\u06CC\u062D\u0627\u062A (Markdown)", cls: "ticktick-desc-label" });
    const tabsWrap = descHeader.createDiv({ cls: "ticktick-desc-tabs" });
    const previewTabBtn = tabsWrap.createEl("button", {
      cls: "ticktick-tab-btn",
      text: "\u{1F441}\uFE0F \u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634"
    });
    const editTabBtn = tabsWrap.createEl("button", {
      cls: "ticktick-tab-btn",
      text: "\u270F\uFE0F \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0645\u062A\u0646"
    });
    const descContainer = descSection.createDiv({ cls: "ticktick-desc-container" });
    const previewEl = descContainer.createDiv({ cls: "ticktick-desc-preview" });
    const descTextarea = descContainer.createEl("textarea", {
      cls: "ticktick-desc-textarea",
      placeholder: "\u062A\u0648\u0636\u06CC\u062D\u0627\u062A \u0648 \u06CC\u0627\u062F\u062F\u0627\u0634\u062A\u200C\u0647\u0627\u06CC \u062A\u0633\u06A9 \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646... (\u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC \u06A9\u0627\u0645\u0644 \u0627\u0632 Markdown)"
    });
    descTextarea.value = description;
    descTextarea.oninput = () => {
      description = descTextarea.value;
    };
    const renderPreview = async () => {
      previewEl.empty();
      const content = description.trim() || "*\u0647\u0646\u0648\u0632 \u062A\u0648\u0636\u06CC\u062D\u06CC \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u062A\u0633\u06A9 \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A. \u0628\u0631\u0627\u06CC \u0646\u0648\u0634\u062A\u0646\u060C \u0631\u0648\u06CC \u062F\u06A9\u0645\u0647 \xAB\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0645\u062A\u0646\xBB \u062F\u0631 \u0628\u0627\u0644\u0627 \u06A9\u0644\u06CC\u06A9 \u06A9\u0646\u06CC\u062F.*";
      await import_obsidian10.MarkdownRenderer.render(this.app, content, previewEl, "", this.comp);
    };
    const setTab = (tab) => {
      if (tab === "preview") {
        previewTabBtn.addClass("is-active");
        editTabBtn.removeClass("is-active");
        previewEl.removeClass("is-hidden");
        descTextarea.addClass("is-hidden");
        description = descTextarea.value;
        void renderPreview();
      } else {
        editTabBtn.addClass("is-active");
        previewTabBtn.removeClass("is-active");
        previewEl.addClass("is-hidden");
        descTextarea.removeClass("is-hidden");
        descTextarea.focus();
      }
    };
    previewTabBtn.onclick = (e) => {
      e.preventDefault();
      setTab("preview");
    };
    editTabBtn.onclick = (e) => {
      e.preventDefault();
      setTab("edit");
    };
    const initialTab = description.trim() ? "preview" : "edit";
    setTab(initialTab);
    const actions = contentEl.createDiv({ cls: "ticktick-editor-actions" });
    actions.createEl("button", { text: "\u274C \u0627\u0646\u0635\u0631\u0627\u0641" }).addEventListener("click", () => this.finish(null));
    actions.createEl("button", { text: "\u{1F4BE} \u0630\u062E\u06CC\u0631\u0647", cls: "mod-cta" }).addEventListener("click", () => {
      description = descTextarea.value;
      if (!title.trim() || !projectId) return new import_obsidian10.Notice("\u0639\u0646\u0648\u0627\u0646 \u0648 \u067E\u0631\u0648\u0698\u0647 \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646.");
      if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return new import_obsidian10.Notice("\u062A\u0627\u0631\u06CC\u062E \u0628\u0627\u06CC\u062F \u0628\u0647 \u0634\u06A9\u0644 YYYY-MM-DD \u0628\u0627\u0634\u062F.");
      this.finish({ ...this.initial, title: title.trim(), desc: description.trim(), projectId, dueDate, reminderTime });
    });
  }
  onClose() {
    this.comp.unload();
    this.contentEl.empty();
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(null);
    }
  }
  openAndWait() {
    this.open();
    return this.result;
  }
};
var DeleteConfirmationModal = class extends import_obsidian10.Modal {
  constructor(app, title) {
    super(app);
    this.title = title;
  }
  resolveResult;
  result = new Promise((resolve) => this.resolveResult = resolve);
  finished = false;
  finish(value) {
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(value);
      this.close();
    }
  }
  onOpen() {
    this.contentEl.createEl("h2", { text: "\u062D\u0630\u0641 \u062A\u0633\u06A9" });
    this.contentEl.createEl("p", { text: `\u062A\u0633\u06A9 \xAB${this.title}\xBB \u0627\u0632 TickTick \u062D\u0630\u0641 \u0634\u0648\u062F\u061F` });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "\u0627\u0646\u0635\u0631\u0627\u0641" }).addEventListener("click", () => this.finish(false));
    actions.createEl("button", { text: "\u062D\u0630\u0641", cls: "mod-warning" }).addEventListener("click", () => this.finish(true));
  }
  onClose() {
    this.contentEl.empty();
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(false);
    }
  }
  openAndWait() {
    this.open();
    return this.result;
  }
};
function openTaskEditor(app, projects, initial) {
  const allProjects = [{ id: "inbox", name: "\u0635\u0646\u062F\u0648\u0642 \u0648\u0631\u0648\u062F\u06CC" }, ...projects.filter((p) => p.id !== "inbox")];
  return new TaskEditorModal(app, allProjects, initial).openAndWait();
}
function confirmDelete(app, title) {
  return new DeleteConfirmationModal(app, title).openAndWait();
}

// src/obsidian/store.ts
var BridgeEventBus = class {
  listeners = /* @__PURE__ */ new Map();
  on(event, listener) {
    let handlers = this.listeners.get(event);
    if (!handlers) {
      handlers = /* @__PURE__ */ new Set();
      this.listeners.set(event, handlers);
    }
    handlers.add(listener);
    return () => this.off(event, listener);
  }
  off(event, listener) {
    this.listeners.get(event)?.delete(listener);
  }
  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[TickTickBridge] Error in event listener for "${event}":`, err);
        }
      }
    }
  }
  clear() {
    this.listeners.clear();
  }
};
var bridgeEvents = new BridgeEventBus();

// src/obsidian/views/today-tasks-view.ts
var import_obsidian11 = require("obsidian");
var TodayTasksView = class extends import_obsidian11.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return VIEW_TYPE;
  }
  getDisplayText() {
    return "\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632";
  }
  getIcon() {
    return "check-square";
  }
  async onOpen() {
    await this.render();
  }
  async render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ticktick-today-tasks-panel");
    const header = contentEl.createDiv({ cls: "ticktick-panel-header" });
    header.addClass("ticktick-today-header");
    header.createEl("h2", { text: "\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632" });
    const currentPersianDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(/* @__PURE__ */ new Date(`${todayInZone(this.plugin.settings.timeZone)}T12:00:00Z`));
    header.createSpan({ cls: "ticktick-panel-subtitle", text: currentPersianDate });
    const refresh = header.createEl("button", { text: "\u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC" });
    refresh.addEventListener("click", async () => {
      refresh.disabled = true;
      try {
        await this.render();
      } finally {
        refresh.disabled = false;
      }
    });
    try {
      const client = this.plugin.client();
      const day = todayInZone(this.plugin.settings.timeZone);
      const toolbar = contentEl.createDiv({ cls: "ticktick-bridge-toolbar" });
      const addButton = toolbar.createEl("button", { text: "+ \u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9", cls: "mod-cta" });
      addButton.addEventListener("click", async () => {
        addButton.disabled = true;
        try {
          const projects = await client.listProjects();
          const draft = await openTaskEditor(this.app, projects, { dueDate: day });
          if (!draft) return;
          await this.plugin.createTask(toTaskPayload(draft, this.plugin.settings.timeZone));
          new import_obsidian11.Notice("\u062A\u0633\u06A9 \u0628\u0647 TickTick \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.");
          await this.render();
        } catch (error) {
          new import_obsidian11.Notice(error instanceof Error ? error.message : "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
        } finally {
          addButton.disabled = false;
        }
      });
      const tasks = await this.plugin.tasksForDay(day);
      if (!tasks.length) contentEl.createEl("p", { text: "\u062A\u0633\u06A9\u06CC \u0628\u0631\u0627\u06CC \u0627\u0645\u0631\u0648\u0632 \u06CC\u0627 \u0642\u0628\u0644 \u0627\u0632 \u0622\u0646 \u0646\u06CC\u0633\u062A." });
      for (const task of tasks) {
        const row = contentEl.createDiv({ cls: "ticktick-bridge-task" });
        const check = row.createEl("input", { type: "checkbox" });
        const body = row.createDiv({ cls: "ticktick-bridge-task-body" });
        body.createSpan({ text: task.title });
        appendChecklistSummary(body, task, this.plugin.settings.experimentalChecklistReadOnly);
        body.createEl("small", { text: task.projectName ? ` \xB7 ${task.projectName}` : "" });
        const actions = row.createDiv({ cls: "ticktick-bridge-actions" });
        await addDescriptionToggle(this.app, this, body, actions, task);
        const edit = actions.createEl("button", { cls: "mod-icon", attr: { "aria-label": "\u0648\u06CC\u0631\u0627\u06CC\u0634" } });
        (0, import_obsidian11.setIcon)(edit, "pencil");
        const remove = actions.createEl("button", { cls: "mod-warning mod-icon", attr: { "aria-label": "\u062D\u0630\u0641" } });
        (0, import_obsidian11.setIcon)(remove, "trash-2");
        check.addEventListener("change", async () => {
          check.disabled = true;
          try {
            await this.plugin.completeTask(task);
            new import_obsidian11.Notice("\u0646\u0648\u0628\u062A \u062A\u0633\u06A9 \u062F\u0631 TickTick \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F.");
            await this.render();
          } catch (error) {
            check.checked = false;
            check.disabled = false;
            new import_obsidian11.Notice(error instanceof Error ? error.message : "\u062A\u06A9\u0645\u06CC\u0644 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
        edit.addEventListener("click", async () => {
          try {
            const projects = await client.listProjects();
            const draft = await openTaskEditor(this.app, projects, task);
            if (!draft) return;
            await this.plugin.updateTask(toTaskPayload({ ...task, ...draft }, this.plugin.settings.timeZone));
            new import_obsidian11.Notice("\u062A\u0633\u06A9 \u062F\u0631 TickTick \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u062F.");
            await this.render();
          } catch (error) {
            new import_obsidian11.Notice(error instanceof Error ? error.message : "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
        remove.addEventListener("click", async () => {
          const accepted = await confirmDelete(this.app, task.title);
          if (!accepted) return;
          try {
            await this.plugin.deleteTask(task);
            new import_obsidian11.Notice("\u062A\u0633\u06A9 \u0627\u0632 TickTick \u062D\u0630\u0641 \u0634\u062F.");
            await this.render();
          } catch (error) {
            new import_obsidian11.Notice(error instanceof Error ? error.message : "\u062D\u0630\u0641 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
      }
    } catch (error) {
      contentEl.createEl("p", { text: error instanceof Error ? error.message : "\u0627\u062A\u0635\u0627\u0644 TickTick \u0622\u0645\u0627\u062F\u0647 \u0646\u06CC\u0633\u062A." });
    }
  }
};

// src/obsidian/views/today-habits-view.ts
var import_obsidian12 = require("obsidian");
var TodayHabitsView = class extends import_obsidian12.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return HABIT_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632";
  }
  getIcon() {
    return "activity";
  }
  async onOpen() {
    await this.render();
  }
  async render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ticktick-today-habits-panel");
    contentEl.createEl("h2", { text: "\u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632" });
    const refresh = contentEl.createEl("button", { text: "\u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC" });
    refresh.addEventListener("click", async () => {
      refresh.disabled = true;
      try {
        await this.render();
      } finally {
        refresh.disabled = false;
      }
    });
    const panel = contentEl.createDiv({ cls: "ticktick-bridge-habit-panel" });
    await this.plugin.renderHabitBlock(panel, true);
  }
};

// src/obsidian/views/planning-view.ts
var import_obsidian13 = require("obsidian");
var PlanningView = class extends import_obsidian13.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  planner;
  getViewType() {
    return PLANNER_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u062A\u0642\u0648\u06CC\u0645 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC TickTick";
  }
  getIcon() {
    return "calendar-days";
  }
  async onOpen() {
    await this.render();
  }
  async render() {
    this.contentEl.addClass("ticktick-planner-panel");
    this.planner ??= new PlanningCalendar(this.contentEl, this.plugin.plannerHost());
    await this.planner.render();
  }
};

// src/obsidian/views/project-board-view.ts
var import_obsidian14 = require("obsidian");
var ProjectBoardView = class extends import_obsidian14.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  board;
  getViewType() {
    return PROJECT_BOARD_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u0628\u0631\u062F \u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627\u06CC TickTick";
  }
  getIcon() {
    return "kanban-square";
  }
  async onOpen() {
    await this.render();
  }
  async render() {
    this.contentEl.addClass("ticktick-project-board-panel");
    this.board ??= new ProjectBoard(this.contentEl, this.plugin.projectBoardHost());
    await this.board.render();
  }
};

// src/obsidian/views/ticktick-control-view.ts
var import_obsidian15 = require("obsidian");
var TickTickControlView = class extends import_obsidian15.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  screen = "sync";
  getViewType() {
    return CONTROL_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u0645\u0631\u06A9\u0632 \u06A9\u0646\u062A\u0631\u0644 TickTick";
  }
  getIcon() {
    return "sliders-horizontal";
  }
  getState() {
    return { screen: this.screen };
  }
  async setState(state) {
    this.screen = state?.screen ?? "sync";
    await this.render();
  }
  async onOpen() {
    await this.render();
  }
  async render() {
    this.contentEl.empty();
    this.contentEl.addClass("ticktick-control-page");
    const nav = this.contentEl.createDiv({ cls: "ticktick-control-nav" });
    const choices = [
      ["sync", "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC", "arrow-down-up"],
      ["notes", "TickTick Notes", "file-text"],
      ["checklists", "Checklist", "list-checks"],
      ["reports", "\u06AF\u0632\u0627\u0631\u0634\u200C\u0647\u0627", "bar-chart-2"]
    ];
    for (const [screen, label, iconName] of choices) {
      const button = nav.createEl("button", {
        cls: `ticktick-control-tab ${this.screen === screen ? "is-active" : ""}`,
        attr: { type: "button" }
      });
      const icon = button.createSpan({ cls: "ticktick-tab-icon" });
      (0, import_obsidian15.setIcon)(icon, iconName);
      button.createSpan({ text: label });
      button.addEventListener("click", () => {
        this.screen = screen;
        void this.render();
      });
    }
    const card = this.contentEl.createDiv({ cls: "ticktick-control-card" });
    if (this.screen === "sync") {
      const header = card.createDiv({ cls: "ticktick-control-header" });
      const hIcon = header.createSpan({ cls: "ticktick-header-icon" });
      (0, import_obsidian15.setIcon)(hIcon, "arrow-down-up");
      header.createEl("h2", { text: "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0648 \u062A\u0639\u0627\u0631\u0636\u200C\u0647\u0627" });
      card.createEl("p", {
        cls: "ticktick-control-desc",
        text: "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u06A9\u0627\u0645\u0644 \u0647\u0645\u0647\u0654 \u0644\u06CC\u0633\u062A\u200C\u0647\u0627 \u0648 \u0631\u06A9\u0648\u0631\u062F\u0647\u0627 \u0631\u0627 \u0628\u062F\u0648\u0646 \u0641\u06CC\u0644\u062A\u0631 \u062A\u0627\u0631\u06CC\u062E \u062F\u0631\u06CC\u0627\u0641\u062A \u0648 \u0645\u062D\u0644\u06CC cache \u0645\u06CC\u200C\u06A9\u0646\u062F. Preview \u0647\u06CC\u0686 \u062A\u063A\u06CC\u06CC\u0631\u06CC \u0646\u0645\u06CC\u200C\u0646\u0648\u06CC\u0633\u062F\u061B Apply \u0641\u0642\u0637 \u067E\u0633 \u0627\u0632 \u0627\u0646\u062A\u062E\u0627\u0628 \u0634\u0645\u0627 \u0627\u062C\u0631\u0627 \u0645\u06CC\u200C\u0634\u0648\u062F."
      });
      if (this.plugin.cacheConflictCount()) {
        card.createEl("p", { cls: "ticktick-control-desc", text: `${this.plugin.cacheConflictCount()} \u062A\u063A\u06CC\u06CC\u0631 \u0645\u062D\u0644\u06CC \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u062A\u0635\u0645\u06CC\u0645 \u0627\u0633\u062A\u061B \u0627\u0632 \u062F\u06A9\u0645\u0647\u0654 \xAB\u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u062A\u0639\u0627\u0631\u0636\u200C\u0647\u0627\xBB \u0628\u0631\u0627\u06CC \u062F\u06CC\u062F\u0646 \u0648 \u0645\u062F\u06CC\u0631\u06CC\u062A \u0622\u0646\u200C\u0647\u0627 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0646.` });
      }
      const actions = card.createDiv({ cls: "ticktick-control-actions" });
      this.button(actions, "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u06A9\u0627\u0645\u0644 TickTick", "refresh-cw", async () => this.plugin.syncNow(), true);
      this.button(actions, "Preview Markdown", "file-search", async () => this.plugin.previewMarkdownSync());
      this.button(actions, "Apply Preview", "upload-cloud", async () => this.plugin.applyMarkdownSync());
      this.button(actions, "\u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u062A\u0639\u0627\u0631\u0636\u200C\u0647\u0627", "git-pull-request", async () => this.plugin.openMarkdownSyncConflicts(), false, true);
    } else if (this.screen === "notes") {
      const header = card.createDiv({ cls: "ticktick-control-header" });
      const hIcon = header.createSpan({ cls: "ticktick-header-icon" });
      (0, import_obsidian15.setIcon)(hIcon, "file-text");
      header.createEl("h2", { text: "\u0627\u0646\u062A\u0642\u0627\u0644 \u0627\u0646\u062A\u062E\u0627\u0628\u06CC TickTick Notes" });
      card.createEl("p", {
        cls: "ticktick-control-desc",
        text: "\u0641\u0642\u0637 Note\u0647\u0627\u06CC \u062F\u0627\u0631\u0627\u06CC kind: NOTE \u067E\u0633 \u0627\u0632 \u0627\u0646\u062A\u062E\u0627\u0628 \u0634\u0645\u0627 \u0648\u0627\u0631\u062F \u0641\u0648\u0644\u062F\u0631 TickTick Notes \u0645\u06CC\u200C\u0634\u0648\u0646\u062F\u061B \u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC \u0645\u0648\u062C\u0648\u062F overwrite \u0646\u0645\u06CC\u200C\u0634\u0648\u0646\u062F."
      });
      const actions = card.createDiv({ cls: "ticktick-control-actions" });
      this.button(actions, "\u0627\u0646\u062A\u062E\u0627\u0628 \u0648 \u0627\u0646\u062A\u0642\u0627\u0644 Note\u0647\u0627", "file-text", async () => this.plugin.previewTickTickNotes(), true);
    } else if (this.screen === "checklists") {
      const header = card.createDiv({ cls: "ticktick-control-header" });
      const hIcon = header.createSpan({ cls: "ticktick-header-icon" });
      (0, import_obsidian15.setIcon)(hIcon, "list-checks");
      header.createEl("h2", { text: "Checklist \u0648 Subtask" });
      card.createEl("p", {
        cls: "ticktick-control-desc",
        text: "Checklist\u0647\u0627 \u062F\u0631 \u06A9\u0627\u0631\u062A task \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F \u0627\u0645\u0627 \u0641\u0639\u0644\u0627\u064B \u0641\u0642\u0637\u200C\u062E\u0648\u0627\u0646\u062F\u0646\u06CC\u200C\u0627\u0646\u062F\u061B \u0648\u06CC\u0631\u0627\u06CC\u0634 child item \u062A\u0627 \u062A\u0623\u06CC\u06CC\u062F \u0631\u0633\u0645\u06CC API TickTick \u0641\u0639\u0627\u0644 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F."
      });
      const actions = card.createDiv({ cls: "ticktick-control-actions" });
      this.button(actions, "\u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632", "calendar-check", async () => this.plugin.openTodayView(), true);
    } else {
      const header = card.createDiv({ cls: "ticktick-control-header" });
      const hIcon = header.createSpan({ cls: "ticktick-header-icon" });
      (0, import_obsidian15.setIcon)(hIcon, "bar-chart-2");
      header.createEl("h2", { text: "\u06AF\u0632\u0627\u0631\u0634\u200C\u0647\u0627 \u0648 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u200C\u06AF\u06CC\u0631\u06CC" });
      const latest = await this.plugin.latestManagedReport();
      if (latest?.path) {
        const badgeRow = card.createDiv({ cls: "ticktick-report-badge-row" });
        badgeRow.createSpan({ cls: "ticktick-report-badge", text: `\u0622\u062E\u0631\u06CC\u0646 \u06AF\u0632\u0627\u0631\u0634: ${latest.path}` });
      } else {
        card.createEl("p", { cls: "ticktick-control-desc", text: "\u0647\u0646\u0648\u0632 \u06AF\u0632\u0627\u0631\u0634\u06CC \u0627\u06CC\u062C\u0627\u062F \u0646\u0634\u062F\u0647 \u0627\u0633\u062A." });
      }
      if (latest?.report) {
        const pre = card.createEl("pre", { cls: "ticktick-report-pre" });
        pre.setText(JSON.stringify(latest.report, null, 2));
      }
    }
  }
  button(parent, label, iconName, action, cta = false, danger = false) {
    const button = parent.createEl("button", {
      cls: `ticktick-control-btn ${cta ? "mod-cta" : ""} ${danger ? "mod-danger" : ""}`,
      attr: { type: "button" }
    });
    const btnIcon = button.createSpan({ cls: "ticktick-btn-icon" });
    (0, import_obsidian15.setIcon)(btnIcon, iconName);
    button.createSpan({ text: label });
    button.addEventListener("click", async () => {
      button.disabled = true;
      btnIcon.addClass("is-spinning");
      try {
        await action();
      } catch (error) {
        new import_obsidian15.Notice(error instanceof Error ? error.message : "\u0639\u0645\u0644\u06CC\u0627\u062A \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      } finally {
        button.disabled = false;
        btnIcon.removeClass("is-spinning");
      }
    });
  }
};

// src/obsidian/settings.ts
var import_obsidian19 = require("obsidian");

// src/obsidian/modals/web-login-modal.ts
var import_obsidian16 = require("obsidian");
var TickTickWebLoginModal = class extends import_obsidian16.Modal {
  resolveResult;
  result = new Promise((resolve) => this.resolveResult = resolve);
  submitted = false;
  onOpen() {
    this.contentEl.addClass("ticktick-login-modal");
    this.contentEl.createEl("h2", { text: "\u0648\u0631\u0648\u062F \u0645\u0633\u062A\u0642\u06CC\u0645 \u0628\u0647 TickTick" });
    this.contentEl.createEl("p", { text: "\u0631\u0645\u0632 \u0641\u0642\u0637 \u0628\u0631\u0627\u06CC \u062F\u0631\u06CC\u0627\u0641\u062A \u0646\u0634\u0633\u062A TickTick \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u062F\u0631 Obsidian \u0630\u062E\u06CC\u0631\u0647 \u0646\u062E\u0648\u0627\u0647\u062F \u0634\u062F." });
    let username = "";
    let password = "";
    new import_obsidian16.Setting(this.contentEl).setName("\u0627\u06CC\u0645\u06CC\u0644 \u06CC\u0627 \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC").addText((input) => {
      input.inputEl.autocomplete = "username";
      input.inputEl.addClass("ticktick-input-full-width");
      input.onChange((value) => username = value);
    });
    new import_obsidian16.Setting(this.contentEl).setName("\u0631\u0645\u0632 \u0639\u0628\u0648\u0631").addText((input) => {
      input.inputEl.type = "password";
      input.inputEl.autocomplete = "current-password";
      input.inputEl.addClass("ticktick-input-full-width");
      input.onChange((value) => password = value);
    });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "\u0627\u0646\u0635\u0631\u0627\u0641" }).addEventListener("click", () => this.finish(null));
    actions.createEl("button", { text: "\u0648\u0631\u0648\u062F \u0648 \u0627\u062A\u0635\u0627\u0644", cls: "mod-cta" }).addEventListener("click", () => {
      if (!username.trim() || !password) {
        new import_obsidian16.Notice("\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646.");
        return;
      }
      this.finish({ username, password });
    });
  }
  finish(value) {
    if (this.submitted) return;
    this.submitted = true;
    this.resolveResult(value);
    this.close();
  }
  onClose() {
    this.contentEl.empty();
    if (!this.submitted) {
      this.submitted = true;
      this.resolveResult(null);
    }
  }
  openAndWait() {
    this.open();
    return this.result;
  }
};

// src/obsidian/modals/legacy-backup-migration-modal.ts
var import_obsidian17 = require("obsidian");
var LegacyBackupMigrationModal = class extends import_obsidian17.Modal {
  constructor(app, count, size) {
    super(app);
    this.count = count;
    this.size = size;
  }
  resolveResult;
  result = new Promise((resolve) => this.resolveResult = resolve);
  finished = false;
  onOpen() {
    this.contentEl.createEl("h2", { text: "\u0627\u0646\u062A\u0642\u0627\u0644 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u200C\u0647\u0627\u06CC \u0642\u062F\u06CC\u0645\u06CC" });
    this.contentEl.createEl("p", { text: `${this.count} \u0641\u0627\u06CC\u0644 \u0628\u0627 \u0645\u062C\u0645\u0648\u0639 ${this.size.toLocaleString()} \u0628\u0627\u06CC\u062A \u067E\u06CC\u062F\u0627 \u0634\u062F. \u0647\u0631 \u0641\u0627\u06CC\u0644 \u0627\u0628\u062A\u062F\u0627 \u0628\u0647 .ticktick/backups/legacy-root/ \u06A9\u067E\u06CC \u0648 \u0637\u0648\u0644 \u0628\u0627\u06CC\u062A \u0622\u0646 \u0628\u0631\u0631\u0633\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F\u061B \u0641\u0642\u0637 \u0633\u067E\u0633 \u0646\u0633\u062E\u0647\u0654 \u0631\u06CC\u0634\u0647 \u062D\u0630\u0641 \u062E\u0648\u0627\u0647\u062F \u0634\u062F.` });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "\u0627\u0646\u0635\u0631\u0627\u0641" }).addEventListener("click", () => this.finish(false));
    actions.createEl("button", { text: "\u0627\u0646\u062A\u0642\u0627\u0644", cls: "mod-warning" }).addEventListener("click", () => this.finish(true));
  }
  finish(value) {
    if (this.finished) return;
    this.finished = true;
    this.resolveResult(value);
    this.close();
  }
  onClose() {
    this.contentEl.empty();
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(false);
    }
  }
  openAndWait() {
    this.open();
    return this.result;
  }
};

// src/obsidian/modals/managed-report-modal.ts
var import_obsidian18 = require("obsidian");
var ManagedReportModal = class extends import_obsidian18.Modal {
  constructor(app, latest) {
    super(app);
    this.latest = latest;
  }
  onOpen() {
    this.contentEl.createEl("h2", { text: "\u0622\u062E\u0631\u06CC\u0646 \u06AF\u0632\u0627\u0631\u0634 \u0645\u062F\u06CC\u0631\u06CC\u062A\u200C\u0634\u062F\u0647" });
    if (!this.latest) {
      this.contentEl.createEl("p", { text: "\u0647\u0646\u0648\u0632 \u06AF\u0632\u0627\u0631\u0634\u06CC \u062F\u0631 .ticktick/reports/ \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A." });
      return;
    }
    this.contentEl.createEl("p", { text: this.latest.path });
    this.contentEl.createEl("pre", { text: JSON.stringify(this.latest.report, null, 2) });
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/obsidian/settings.ts
var TickTickBridgeSettings = class extends import_obsidian19.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian19.Setting(containerEl).setName("\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0627\u062A\u0635\u0627\u0644 \u0648 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC").setHeading();
    const cachedAt = this.plugin.cacheSnapshotTime();
    new import_obsidian19.Setting(containerEl).setName("\u0646\u0633\u062E\u0647\u0654 \u0645\u062D\u0644\u06CC \u062F\u0627\u062F\u0647\u200C\u0647\u0627").setDesc(cachedAt ? `\u0622\u062E\u0631\u06CC\u0646 \u062F\u0631\u06CC\u0627\u0641\u062A: ${cachedAt} \u2014 \u067E\u0646\u0644\u200C\u0647\u0627 \u0627\u0628\u062A\u062F\u0627 \u0627\u0632 \u0627\u06CC\u0646 \u0646\u0633\u062E\u0647\u0654 \u0633\u0631\u06CC\u0639 \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F.` : "\u0647\u0646\u0648\u0632 \u0646\u0633\u062E\u0647\u0654 \u0645\u062D\u0644\u06CC \u0633\u0627\u062E\u062A\u0647 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A. \u06CC\u06A9\u200C\u0628\u0627\u0631 \xAB\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0627\u0644\u0622\u0646\xBB \u0631\u0627 \u0628\u0632\u0646.");
    new import_obsidian19.Setting(containerEl).setName("\u0645\u0631\u06A9\u0632 \u0633\u0627\u062F\u0647\u0654 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC").setDesc("\u06CC\u06A9 \u0635\u0641\u062D\u0647\u0654 \u06A9\u0627\u0645\u0644 \u0628\u0631\u0627\u06CC sync \u0639\u0627\u062F\u06CC\u060C preview/apply Markdown \u0648 \u062D\u0644 \u062A\u0639\u0627\u0631\u0636\u200C\u0647\u0627.").addButton((button) => button.setButtonText("\u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u0645\u0631\u06A9\u0632 Sync").setCta().onClick(() => void this.plugin.openControlPage("sync")));
    if (this.plugin.cacheConflictCount()) new import_obsidian19.Setting(containerEl).setName("\u062A\u062F\u0627\u062E\u0644\u200C\u0647\u0627\u06CC \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC").setDesc(`${this.plugin.cacheConflictCount()} \u062A\u063A\u06CC\u06CC\u0631 \u0622\u0641\u0644\u0627\u06CC\u0646 \u062F\u0631 TickTick \u0642\u0627\u0628\u0644 \u0627\u0639\u0645\u0627\u0644 \u0646\u0628\u0648\u062F \u0648 \u0628\u0631\u0627\u06CC \u062C\u0644\u0648\u06AF\u06CC\u0631\u06CC \u0627\u0632 \u0628\u0627\u0632\u0646\u0648\u06CC\u0633\u06CC \u062F\u0627\u062F\u0647\u0654 \u062C\u062F\u06CC\u062F\u060C \u0646\u06AF\u0647 \u062F\u0627\u0634\u062A\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A.`);
    new import_obsidian19.Setting(containerEl).setName("\u0641\u0636\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A\u200C\u0634\u062F\u0647\u0654 TickTick").setDesc(`/.ticktick/ \u2014 \u0646\u0633\u062E\u0647\u200C\u0647\u0627\u06CC \u067E\u0634\u062A\u06CC\u0628\u0627\u0646 \u062A\u0627 \u06F1\u06F0 \u0631\u0648\u0632 \u062A\u0642\u0648\u06CC\u0645\u06CC UTC \u0646\u06AF\u0647 \u062F\u0627\u0634\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F. \u0622\u062E\u0631\u06CC\u0646 \u06AF\u0632\u0627\u0631\u0634: ${this.plugin.managedStorageReport()}`);
    new import_obsidian19.Setting(containerEl).setName("\u0622\u062E\u0631\u06CC\u0646 \u06AF\u0632\u0627\u0631\u0634 \u0645\u062F\u06CC\u0631\u06CC\u062A\u200C\u0634\u062F\u0647").setDesc("\u0622\u062E\u0631\u06CC\u0646 \u06AF\u0632\u0627\u0631\u0634 \u063A\u06CC\u0631\u0645\u062D\u0631\u0645\u0627\u0646\u0647\u0654 \u0639\u0645\u0644\u06CC\u0627\u062A \u0630\u062E\u06CC\u0631\u0647\u200C\u0634\u062F\u0647 \u062F\u0631 .ticktick/reports/ \u0631\u0627 \u0646\u0645\u0627\u06CC\u0634 \u0645\u06CC\u200C\u062F\u0647\u062F.").addButton((button) => button.setButtonText("\u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u06AF\u0632\u0627\u0631\u0634 \u0622\u062E\u0631").onClick(async () => {
      button.setDisabled(true);
      try {
        new ManagedReportModal(this.app, await this.plugin.latestManagedReport()).open();
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian19.Setting(containerEl).setName("\u0627\u0646\u062A\u0642\u0627\u0644 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u200C\u0647\u0627\u06CC \u0642\u062F\u06CC\u0645\u06CC \u0631\u06CC\u0634\u0647\u0654 Vault").setDesc("\u0641\u0642\u0637 \u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC \u062F\u0642\u06CC\u0642 ticktick-backup-*.csv \u0631\u0627 \u067E\u0633 \u0627\u0632 \u062A\u0623\u06CC\u06CC\u062F \u0648 \u0628\u0631\u0631\u0633\u06CC \u0637\u0648\u0644 \u0628\u0627\u06CC\u062A \u06A9\u067E\u06CC \u0645\u06CC\u200C\u06A9\u0646\u062F.").addButton((button) => button.setButtonText("Move legacy root backups").onClick(async () => {
      button.setDisabled(true);
      try {
        const files = await this.plugin.previewLegacyRootBackups();
        const size = files.reduce((total, file) => total + file.size, 0);
        if (!files.length) {
          new import_obsidian19.Notice("\u067E\u0634\u062A\u06CC\u0628\u0627\u0646 \u0642\u062F\u06CC\u0645\u06CC \u062F\u0631 \u0631\u06CC\u0634\u0647\u0654 Vault \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
          return;
        }
        const confirmed = await new LegacyBackupMigrationModal(this.app, files.length, size).openAndWait();
        if (!confirmed) return;
        const result = await this.plugin.migrateLegacyRootBackups();
        new import_obsidian19.Notice(`${result.migrated.length} \u0627\u0632 ${result.sources.length} \u067E\u0634\u062A\u06CC\u0628\u0627\u0646 \u0642\u062F\u06CC\u0645\u06CC \u0645\u0646\u062A\u0642\u0644 \u0634\u062F.`);
        this.display();
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian19.Setting(containerEl).setName("API Token").setDesc("\u062A\u0648\u06A9\u0646 \u0634\u062E\u0635\u06CC TickTick\u061B \u0641\u0642\u0637 \u062F\u0631 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0627\u0641\u0632\u0648\u0646\u0647 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F.").addText((input) => {
      input.inputEl.type = "password";
      input.setValue(this.plugin.settings.apiToken).onChange(async (value) => {
        this.plugin.settings.apiToken = value.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian19.Setting(containerEl).setName("\u062A\u06AF \u0686\u06A9\u200C\u0628\u0627\u06A9\u0633 TickTick").setDesc("\u0686\u06A9\u200C\u0628\u0627\u06A9\u0633\u200C\u0647\u0627\u06CC \u062F\u0627\u0631\u0627\u06CC \u0627\u06CC\u0646 \u062A\u06AF \u0627\u0628\u062A\u062F\u0627 \u0641\u0642\u0637 \u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F\u061B \u0633\u067E\u0633 \u0628\u0627 \u0641\u0631\u0645\u0627\u0646 \u0627\u0639\u0645\u0627\u0644\u060C binding \u0627\u0645\u0646 TickTick \u0645\u06CC\u200C\u06AF\u06CC\u0631\u0646\u062F.").addText((input) => {
      input.setValue(this.plugin.settings.checkboxImportTag).onChange(async (value) => {
        this.plugin.settings.checkboxImportTag = value.trim().replace(/^#/, "") || "ticktick";
        await this.plugin.saveSettings();
      });
    }).addButton((button) => button.setButtonText("\u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 \u0647\u0645\u0647\u0654 \u06CC\u0627\u062F\u062F\u0627\u0634\u062A\u200C\u0647\u0627").onClick(async () => {
      button.setDisabled(true);
      try {
        await this.plugin.importAllTaggedCheckboxes();
      } finally {
        button.setDisabled(false);
      }
    })).addButton((button) => button.setButtonText("\u0627\u0639\u0645\u0627\u0644 \u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634").setCta().onClick(async () => {
      button.setDisabled(true);
      try {
        await this.plugin.applyMarkdownSync();
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian19.Setting(containerEl).setName("Checklist \u0648 Subtask \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC").setDesc("\u0641\u0639\u0644\u0627\u064B \u0641\u0642\u0637 \u062E\u0648\u0627\u0646\u062F\u0646\u06CC \u0627\u0633\u062A\u061B API \u0631\u0633\u0645\u06CC \u0628\u0631\u0627\u06CC \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0627\u0645\u0646 child item \u062A\u0623\u06CC\u06CC\u062F \u0646\u0634\u062F\u0647 \u0648 \u0647\u06CC\u0686 checkbox\u0627\u06CC \u062F\u0631 \u0627\u06CC\u0646 \u0628\u062E\u0634 \u0686\u06CC\u0632\u06CC \u0631\u0627 \u062A\u063A\u06CC\u06CC\u0631 \u0646\u0645\u06CC\u200C\u062F\u0647\u062F.").addToggle((toggle) => toggle.setValue(this.plugin.settings.experimentalChecklistReadOnly).setDisabled(true));
    new import_obsidian19.Setting(containerEl).setName("\u0627\u0646\u062A\u0642\u0627\u0644 TickTick Notes").setDesc("\u0641\u0642\u0637 Note\u0647\u0627\u06CC \u062F\u0627\u0631\u0627\u06CC kind: NOTE \u0631\u0627 \u067E\u0633 \u0627\u0632 \u0627\u0646\u062A\u062E\u0627\u0628 \u0634\u0645\u0627 \u062F\u0631 \u0641\u0648\u0644\u062F\u0631 \u0642\u0627\u0628\u0644\u200C\u0645\u0634\u0627\u0647\u062F\u0647 \u0648\u0627\u0631\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u06CC\u06A9\u200C\u0637\u0631\u0641\u0647 \u0648 \u0628\u062F\u0648\u0646 overwrite.").addText((input) => input.setValue(this.plugin.settings.ticktickNotesFolder).onChange(async (value) => {
      this.plugin.settings.ticktickNotesFolder = value.trim().replace(/^\/+|\/+$/g, "") || "TickTick Notes";
      await this.plugin.saveSettings();
    })).addButton((button) => button.setButtonText("\u0627\u0646\u062A\u062E\u0627\u0628 Note\u0647\u0627").onClick(() => void this.plugin.previewTickTickNotes()));
    new import_obsidian19.Setting(containerEl).setName("\u0648\u0631\u0648\u062F \u0645\u0633\u062A\u0642\u0644 \u0628\u0631\u0627\u06CC \u0639\u0627\u062F\u062A\u200C\u0647\u0627").setDesc("\u0645\u0633\u062A\u0642\u06CC\u0645 \u0648\u0627\u0631\u062F TickTick \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0646\u0634\u0633\u062A \u0644\u0627\u0632\u0645 \u0631\u0627 \u062F\u0631 \u062E\u0648\u062F Bridge \u0646\u06AF\u0647 \u0645\u06CC\u200C\u062F\u0627\u0631\u062F. \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648 \u0631\u0645\u0632 \u0630\u062E\u06CC\u0631\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u0646\u062F.").addButton((button) => button.setButtonText("\u0648\u0631\u0648\u062F \u0628\u0647 TickTick").setCta().onClick(async () => {
      const credentials = await new TickTickWebLoginModal(this.app).openAndWait();
      if (!credentials) return;
      button.setDisabled(true);
      try {
        await this.plugin.loginToTickTickWeb(credentials.username, credentials.password);
        new import_obsidian19.Notice("\u0648\u0631\u0648\u062F \u0645\u0633\u062A\u0642\u0644 TickTick \u0627\u0646\u062C\u0627\u0645 \u0634\u062F. \u062D\u0627\u0644\u0627 \u0627\u062A\u0635\u0627\u0644 \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06CC\u0627 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u06A9\u0646.");
        this.display();
      } catch (error) {
        new import_obsidian19.Notice(error instanceof Error ? error.message : "\u0648\u0631\u0648\u062F \u0628\u0647 TickTick \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian19.Setting(containerEl).setName("\u0627\u062A\u0635\u0627\u0644 \u0622\u0633\u0627\u0646 \u0627\u0632 TickTickSync").setDesc("\u0646\u0634\u0633\u062A \u0641\u0639\u0627\u0644 TickTickSync \u0631\u0627 \u0648\u0627\u0631\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F \u062A\u0627 \u0686\u06A9\u200C\u0627\u06CC\u0646 \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0641\u0648\u0631\u06CC \u0648 \u062F\u0642\u06CC\u0642 \u062E\u0648\u0627\u0646\u062F\u0647 \u0634\u0648\u0646\u062F. \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u062E\u0648\u0627\u0646\u062F\u0647\u060C \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u06CC\u0627 \u0630\u062E\u06CC\u0631\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.").addButton((button) => button.setButtonText("\u0648\u0627\u0631\u062F \u06A9\u0631\u062F\u0646 \u0627\u062A\u0635\u0627\u0644 TickTickSync").setCta().onClick(async () => {
      button.setDisabled(true);
      try {
        const result = await this.plugin.importTickTickSyncSession();
        new import_obsidian19.Notice(result.hasCookie ? "\u0627\u062A\u0635\u0627\u0644 TickTickSync \u0648\u0627\u0631\u062F \u0634\u062F." : "\u0627\u062A\u0635\u0627\u0644 TickTickSync \u0648\u0627\u0631\u062F \u0634\u062F\u061B \u062F\u0631 \u0635\u0648\u0631\u062A \u062E\u0637\u0627 \u06CC\u06A9\u200C\u0628\u0627\u0631 \u0627\u0641\u0632\u0648\u0646\u0647\u0654 \u0642\u062F\u06CC\u0645\u06CC \u0631\u0627 \u0628\u0627\u0632 \u06A9\u0646 \u0648 \u062F\u0648\u0628\u0627\u0631\u0647 \u0627\u0645\u062A\u062D\u0627\u0646 \u06A9\u0646.");
        this.display();
      } catch (error) {
        new import_obsidian19.Notice(error instanceof Error ? error.message : "\u0648\u0627\u0631\u062F \u06A9\u0631\u062F\u0646 \u0627\u062A\u0635\u0627\u0644 TickTickSync \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian19.Setting(containerEl).setName("Cookie \u062A\u06A9\u0645\u06CC\u0644\u06CC \u0648\u0628 (\u0627\u062E\u062A\u06CC\u0627\u0631\u06CC)").setDesc("\u0641\u0642\u0637 \u0627\u06AF\u0631 \u0627\u062A\u0635\u0627\u0644 \u062E\u0648\u062F\u06A9\u0627\u0631 \u062C\u0648\u0627\u0628 \u0646\u062F\u0627\u062F\u060C Cookie \u0646\u0634\u0633\u062A \u0648\u0628 TickTick \u0631\u0627 \u0627\u06CC\u0646\u062C\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646. \u0627\u06CC\u0646 \u0645\u0642\u062F\u0627\u0631 \u0645\u0627\u0646\u0646\u062F \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0627\u0633\u062A.").addText((input) => {
      input.inputEl.type = "password";
      input.inputEl.addClass("ticktick-input-cookie");
      input.setValue(this.plugin.settings.webSessionCookie).onChange(async (value) => {
        this.plugin.settings.webSessionCookie = normalizeWebSessionCookie(value);
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian19.Setting(containerEl).setName("\u0628\u0631\u0631\u0633\u06CC \u0627\u062A\u0635\u0627\u0644 \u0648\u0628 \u0639\u0627\u062F\u062A\u200C\u0647\u0627").setDesc("\u0686\u06A9\u200C\u0627\u06CC\u0646\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632 \u0631\u0627 \u0645\u0633\u062A\u0642\u06CC\u0645\u0627\u064B \u0627\u0632 \u0633\u0631\u0648\u06CC\u0633 \u0648\u0628 TickTick \u0645\u06CC\u200C\u062E\u0648\u0627\u0646\u062F.").addButton((button) => button.setButtonText("\u0627\u062A\u0635\u0627\u0644 \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646").onClick(async () => {
      button.setDisabled(true);
      try {
        const habits = await this.plugin.client().listHabits();
        const checkins = await this.plugin.webHabitCheckins(habits.map((habit) => habit.id), todayInZone(this.plugin.settings.timeZone));
        if (!checkins) throw new Error("\u0646\u0634\u0633\u062A \u0648\u0628 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A \u06CC\u0627 TickTick \u067E\u0627\u0633\u062E \u0646\u062F\u0627\u062F.");
        const count = [...checkins.values()].flat().filter((entry) => entry.status === 2).length;
        new import_obsidian19.Notice(`\u0627\u062A\u0635\u0627\u0644 \u0648\u0628 \u0628\u0631\u0642\u0631\u0627\u0631 \u0627\u0633\u062A: ${count} \u0686\u06A9\u200C\u0627\u06CC\u0646 \u0627\u0645\u0631\u0648\u0632 \u062E\u0648\u0627\u0646\u062F\u0647 \u0634\u062F.`);
      } catch (error) {
        new import_obsidian19.Notice(error instanceof Error ? error.message : "\u0627\u062A\u0635\u0627\u0644 \u0648\u0628 \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian19.Setting(containerEl).setName("\u0628\u0631\u0631\u0633\u06CC \u0627\u062A\u0635\u0627\u0644").setDesc("\u0628\u0627 \u062A\u0648\u06A9\u0646 \u0648\u0627\u0631\u062F\u0634\u062F\u0647\u060C \u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627 \u0648 \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0631\u0627 \u0627\u0632 TickTick \u0645\u06CC\u200C\u062E\u0648\u0627\u0646\u062F.").addButton((button) => button.setButtonText("\u0627\u062A\u0635\u0627\u0644 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646").onClick(async () => {
      button.setDisabled(true);
      try {
        const client = this.plugin.client();
        const [projects, habits] = await Promise.all([client.listProjects(), client.listHabits()]);
        new import_obsidian19.Notice(`\u0627\u062A\u0635\u0627\u0644 \u0628\u0631\u0642\u0631\u0627\u0631 \u0627\u0633\u062A: ${projects.length} \u067E\u0631\u0648\u0698\u0647 \u0648 ${habits.length} \u0639\u0627\u062F\u062A \u067E\u06CC\u062F\u0627 \u0634\u062F.`);
      } catch (error) {
        new import_obsidian19.Notice(error instanceof Error ? error.message : "\u0627\u062A\u0635\u0627\u0644 \u0628\u0647 TickTick \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian19.Setting(containerEl).setName("\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u062E\u0648\u062F\u06A9\u0627\u0631").setDesc("\u0641\u0627\u0635\u0644\u0647\u0654 \u0632\u0645\u0627\u0646\u06CC \u0628\u0631 \u062D\u0633\u0628 \u062B\u0627\u0646\u06CC\u0647 (\u067E\u06CC\u0634\u200C\u0641\u0631\u0636 \u0648 \u062D\u062F\u0627\u0642\u0644: \u06F3\u06F0 \u062B\u0627\u0646\u06CC\u0647). \u0635\u0641\u0631 \u06CC\u0639\u0646\u06CC \u062E\u0627\u0645\u0648\u0634. sync \u0628\u0639\u062F\u06CC \u0641\u0642\u0637 \u067E\u0633 \u0627\u0632 \u067E\u0627\u06CC\u0627\u0646 sync \u0642\u0628\u0644\u06CC \u0648 \u06AF\u0630\u0634\u062A \u0627\u06CC\u0646 \u0645\u062F\u062A \u0622\u063A\u0627\u0632 \u0645\u06CC\u200C\u0634\u0648\u062F.").addText((input) => {
      input.inputEl.type = "number";
      input.inputEl.min = "0";
      input.setValue(String(this.plugin.settings.syncIntervalSeconds || this.plugin.settings.syncIntervalMinutes * 60)).onChange(async (value) => {
        const requested = Math.floor(Number(value) || 0);
        const seconds = requested > 0 ? Math.max(30, requested) : 0;
        this.plugin.settings.syncIntervalSeconds = seconds;
        this.plugin.settings.syncIntervalMinutes = 0;
        await this.plugin.saveSettings();
        this.plugin.configureAutomaticSync();
      });
    });
    new import_obsidian19.Setting(containerEl).setName("\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u062F\u0633\u062A\u06CC").setDesc("\u0646\u0633\u062E\u0647\u0654 \u0645\u062D\u0644\u06CC \u062A\u0633\u06A9\u200C\u0647\u0627\u060C \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0648 \u062A\u0627\u0631\u06CC\u062E\u0686\u0647\u0654 \u06F9\u06F0 \u0631\u0648\u0632 \u0627\u062E\u06CC\u0631 \u0631\u0627 \u0647\u0645\u06CC\u0646 \u062D\u0627\u0644\u0627 \u0627\u0632 TickTick \u062A\u0627\u0632\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F.").addButton((button) => button.setButtonText("\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0627\u0644\u0622\u0646").onClick(async () => {
      button.setDisabled(true);
      try {
        await this.plugin.syncNow();
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian19.Setting(containerEl).setName("\u062A\u0642\u0648\u06CC\u0645 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC").setDesc("\u0647\u0641\u062A\u0647 \u0648 \u0634\u0628\u06A9\u0647\u0654 \u0645\u0627\u0647 \u0647\u0645\u06CC\u0634\u0647 \u0627\u0632 \u0634\u0646\u0628\u0647 \u0634\u0631\u0648\u0639 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F \u0648 \u062A\u0633\u06A9 \u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647 \u0628\u0647\u200C\u0635\u0648\u0631\u062A \u067E\u06CC\u0634\u200C\u0641\u0631\u0636 \u067E\u0646\u0647\u0627\u0646 \u0627\u0633\u062A.").addToggle((toggle) => toggle.setValue(this.plugin.settings.plannerShowCompleted).setTooltip("\u0646\u0645\u0627\u06CC\u0634 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647 \u062F\u0631 \u062A\u0642\u0648\u06CC\u0645").onChange(async (value) => {
      this.plugin.settings.plannerShowCompleted = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian19.Setting(containerEl).setName("\u0622\u06CC\u06A9\u0648\u0646\u200C\u0647\u0627\u06CC \u0627\u0636\u0627\u0641\u06CC \u0646\u0648\u0627\u0631 \u06A9\u0646\u0627\u0631\u06CC").setDesc("\u0622\u06CC\u06A9\u0648\u0646 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0647\u0645\u06CC\u0634\u0647 \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F. \u0628\u0627 \u0631\u0648\u0634\u0646\u200C\u06A9\u0631\u062F\u0646 \u0627\u06CC\u0646 \u06AF\u0632\u06CC\u0646\u0647\u060C \u0645\u06CC\u0627\u0646\u0628\u0631 \u062A\u0633\u06A9\u200C\u0647\u0627 \u0648 \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0647\u0645 \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F.").addToggle((toggle) => toggle.setValue(this.plugin.settings.showRibbonIcons).onChange(async (value) => {
      this.plugin.settings.showRibbonIcons = value;
      await this.plugin.saveSettings();
      this.plugin.configureRibbonIcons();
    }));
    new import_obsidian19.Setting(containerEl).setName("Time zone").addText((input) => input.setValue(this.plugin.settings.timeZone).onChange(async (value) => {
      this.plugin.settings.timeZone = value || "Asia/Tehran";
      await this.plugin.saveSettings();
    }));
    new import_obsidian19.Setting(containerEl).setName("Daily notes folder").addText((input) => input.setValue(this.plugin.settings.dailyNoteFolder).onChange(async (value) => {
      this.plugin.settings.dailyNoteFolder = value;
      await this.plugin.saveSettings();
    }));
  }
};

// src/obsidian/main.ts
var TickTickBridgePlugin = class extends import_obsidian20.Plugin {
  settings = DEFAULT_SETTINGS;
  cache = { savedAt: "", tasks: [], projects: [], projectBoards: {}, habits: [], habitCheckins: {}, pending: [], conflicts: [], rateLimitedUntil: 0 };
  habitCheckinCache = /* @__PURE__ */ new Map();
  syncTimer = null;
  ribbonIcons = [];
  syncRibbonIcon = null;
  panelMenuRibbonIcon = null;
  taskBlocks = /* @__PURE__ */ new Map();
  habitBlocks = /* @__PURE__ */ new Map();
  // Keep the rendered Markdown blocks in place when a background sync did
  // not actually change their data.  Replacing a code block recreates its DOM
  // tree, which also discards transient UI state and can move the preview's
  // scroll position.
  taskBlockSignatures = /* @__PURE__ */ new Map();
  habitBlockSignatures = /* @__PURE__ */ new Map();
  dashboardStates = /* @__PURE__ */ new Map();
  checkboxImportTimers = /* @__PURE__ */ new Map();
  syncInProgress = false;
  rateLimitedUntil = 0;
  managedStorage;
  markdownSync;
  noteImport;
  lastManagedReport = "\u0647\u0646\u0648\u0632 \u06AF\u0632\u0627\u0631\u0634\u06CC \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.";
  async onload() {
    this.managedStorage = new ManagedStorage(this.app.vault.adapter);
    const savedSettings = await this.loadData();
    const legacySettings = savedSettings ?? {};
    const {
      projectRoot: _legacyProjectRoot,
      projectDependencies: _legacyProjectDependencies,
      projectTaskCatalog: _legacyProjectTaskCatalog,
      cache: savedCache,
      localHabitFolder: _legacyLocalHabitFolder,
      ...activeSettings
    } = legacySettings;
    this.settings = { ...DEFAULT_SETTINGS, ...activeSettings };
    if (this.settings.plannerFirstWeekday !== 6) this.settings.plannerFirstWeekday = 6;
    const privateCache = await this.managedStorage.readPrivateCache();
    this.cache = normalizeCache(privateCache ?? savedCache);
    this.rateLimitedUntil = Math.max(0, Number(this.cache.rateLimitedUntil ?? 0));
    this.markdownSync = new MarkdownSync(this.app, this.managedStorage, () => this.client(), () => this.settings, () => this.scheduledCheckboxProjectId());
    await this.markdownSync.initialize();
    this.noteImport = new NoteImport(this.app, this.managedStorage, () => this.settings.ticktickNotesFolder);
    if (!privateCache || "projectRoot" in legacySettings || "projectDependencies" in legacySettings || "projectTaskCatalog" in legacySettings) await this.saveSettings();
    this.app.workspace.onLayoutReady(() => {
      this.app.workspace.getLeavesOfType("ticktick-bridge-projects").forEach((leaf) => leaf.detach());
    });
    this.addSettingTab(new TickTickBridgeSettings(this.app, this));
    this.registerView(VIEW_TYPE, (leaf) => new TodayTasksView(leaf, this));
    this.registerView(HABIT_VIEW_TYPE, (leaf) => new TodayHabitsView(leaf, this));
    this.registerView(PLANNER_VIEW_TYPE, (leaf) => new PlanningView(leaf, this));
    this.registerView(PROJECT_BOARD_VIEW_TYPE, (leaf) => new ProjectBoardView(leaf, this));
    this.registerView(CONTROL_VIEW_TYPE, (leaf) => new TickTickControlView(leaf, this));
    this.registerMarkdownCodeBlockProcessor("ticktick-today", async (_source, element, context) => {
      const day = dailyNoteDateFromPath(context.sourcePath);
      this.taskBlocks.set(element, day);
      await this.renderTodayBlock(element, day);
    });
    this.registerMarkdownCodeBlockProcessor("ticktick-habits", async (_source, element, context) => {
      const dashboard = context.sourcePath.includes("\u062F\u0627\u0634\u0628\u0648\u0631\u062F \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC");
      const day = dailyNoteDateFromPath(context.sourcePath);
      this.habitBlocks.set(element, { dashboard, day });
      await this.renderHabitBlock(element, dashboard, day);
    });
    this.registerMarkdownCodeBlockProcessor("ticktick-recurring", async (_source, element) => this.renderRecurringBlock(element));
    this.registerMarkdownCodeBlockProcessor("ticktick-planner", async (_source, element) => {
      const planner = new PlanningCalendar(element, this.plannerHost());
      await planner.render();
    });
    this.registerMarkdownCodeBlockProcessor("ticktick-board", async (_source, element) => {
      await new ProjectBoard(element, this.projectBoardHost()).render();
    });
    this.configurePanelMenuRibbonIcon();
    this.configureSyncRibbonIcon();
    this.configureRibbonIcons();
    this.addCommand({ id: "open-today-tasks", name: "Open today's TickTick tasks", callback: () => this.openTodayView() });
    this.addCommand({ id: "open-today-habits", name: "Open today's TickTick habits", callback: () => this.openHabitView() });
    this.addCommand({ id: "open-ticktick-sync-center", name: "Open TickTick sync center", callback: () => this.openControlPage("sync") });
    this.addCommand({ id: "preview-ticktick-notes", name: "Preview TickTick Notes import", callback: () => this.openControlPage("notes") });
    this.addCommand({ id: "open-weekly-planner", name: "Open TickTick weekly planner", callback: () => this.openPlannerView() });
    this.addCommand({ id: "open-project-board", name: "Open TickTick project board", callback: () => this.openProjectBoardView() });
    this.addCommand({ id: "refresh-project-board", name: "Refresh TickTick project board", callback: () => this.syncNow() });
    this.addCommand({ id: "sync-now", name: "Sync TickTick now", callback: () => this.syncNow() });
    this.addCommand({ id: "preview-markdown-sync", name: "Preview Markdown \u2194 TickTick sync", callback: () => this.previewMarkdownSync() });
    this.addCommand({ id: "apply-markdown-sync", name: "Apply Markdown \u2194 TickTick sync preview", callback: () => this.applyMarkdownSync() });
    this.addCommand({ id: "open-markdown-sync-conflicts", name: "Open Markdown sync conflicts", callback: () => this.openMarkdownSyncConflicts() });
    this.addCommand({ id: "repair-markdown-bindings", name: "Repair legacy Markdown bindings", callback: () => this.repairMarkdownBindings() });
    this.addCommand({ id: "import-ticktick-checkboxes", name: "Preview #ticktick checkboxes", callback: () => this.previewMarkdownSync() });
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file instanceof import_obsidian20.TFile && file.extension === "md") this.queueTaggedCheckboxImport(file);
    }));
    this.configureAutomaticSync();
    this.app.workspace.onLayoutReady(() => void this.syncNow({ quiet: true }));
  }
  async createPrewriteSnapshot(purpose, payload) {
    const path = await this.managedStorage.writeSnapshot(purpose, payload);
    try {
      await this.managedStorage.pruneEligibleManagedBackups();
    } catch {
    }
    return path;
  }
  async saveSettings() {
    await this.managedStorage.writePrivateCache(this.cache);
    await this.createPrewriteSnapshot("cache", publicCacheMetadata(this.cache));
    await this.saveData({ ...this.settings, cache: publicCacheMetadata(this.cache) });
  }
  async previewLegacyRootBackups() {
    return this.managedStorage.legacyRootBackups();
  }
  async migrateLegacyRootBackups() {
    const result = await this.managedStorage.migrateLegacyRootBackups();
    this.lastManagedReport = `\u0627\u0646\u062A\u0642\u0627\u0644 \u0631\u06CC\u0634\u0647: ${result.migrated.length} \u0627\u0632 ${result.sources.length} \u0641\u0627\u06CC\u0644.`;
    try {
      await this.managedStorage.writeReport("legacy-migration", { sourceCount: result.sources.length, migratedCount: result.migrated.length });
    } catch {
    }
    return result;
  }
  managedStorageReport() {
    return this.lastManagedReport;
  }
  async latestManagedReport() {
    return this.managedStorage.latestReport();
  }
  queueTaggedCheckboxImport(file) {
    const previous = this.checkboxImportTimers.get(file.path);
    if (previous) window.clearTimeout(previous);
    this.checkboxImportTimers.set(file.path, window.setTimeout(() => {
      this.checkboxImportTimers.delete(file.path);
      void this.previewMarkdownSync(true, [file]);
    }, 700));
  }
  async importAllTaggedCheckboxes() {
    await this.previewMarkdownSync();
  }
  async previewMarkdownSync(quiet = false, files) {
    const result = await this.markdownSync.preview(files);
    if (!quiet) new import_obsidian20.Notice(`\u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 Markdown sync: \u0627\u06CC\u062C\u0627\u062F ${result.create}\u060C \u0627\u0631\u0633\u0627\u0644 ${result.push}\u060C \u062F\u0631\u06CC\u0627\u0641\u062A ${result.pull}\u060C \u062A\u0639\u0627\u0631\u0636 ${result.conflict}\u060C \u0642\u0631\u0646\u0637\u06CC\u0646\u0647 ${result.quarantine}.`);
    return result;
  }
  async applyMarkdownSync() {
    const result = await this.markdownSync.apply();
    new import_obsidian20.Notice(`\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0627\u0639\u0645\u0627\u0644 \u0634\u062F: ${result.applied} \u062A\u063A\u06CC\u06CC\u0631. \u062A\u0639\u0627\u0631\u0636/\u0642\u0631\u0646\u0637\u06CC\u0646\u0647: ${result.conflict + result.quarantine}.`);
    return result;
  }
  async openMarkdownSyncConflicts() {
    const conflicts = await this.markdownSync.conflicts();
    if (conflicts.length) {
      const actionable = conflicts.find((conflict) => conflict.diff?.conflicts?.length);
      if (actionable) {
        const choice = await new MarkdownConflictModal(this.app, actionable).openAndWait();
        await this.markdownSync.resolve(actionable, choice);
        new import_obsidian20.Notice("\u0627\u0646\u062A\u062E\u0627\u0628 \u0634\u0645\u0627 \u062B\u0628\u062A \u0634\u062F\u061B \u06AF\u0632\u0627\u0631\u0634 \u062F\u0631 /.ticktick/reports/ \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.");
      } else new import_obsidian20.Notice(`${conflicts.length} \u0645\u0648\u0631\u062F Markdown \u062F\u0631 \u0642\u0631\u0646\u0637\u06CC\u0646\u0647 \u0627\u0633\u062A\u061B \u062C\u0632\u0626\u06CC\u0627\u062A \u062F\u0631 \u06AF\u0632\u0627\u0631\u0634 /.ticktick/reports/ \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A.`);
    }
    if (this.cache.conflicts.length) new PendingMutationConflictModal(this.app, this.cache.conflicts, (operation, choice) => this.resolveQueuedConflict(operation, choice)).open();
    else if (!conflicts.length) new import_obsidian20.Notice("\u062A\u0639\u0627\u0631\u0636\u06CC \u0628\u0631\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.");
    return conflicts;
  }
  async resolveQueuedConflict(operation, choice) {
    this.cache.conflicts = this.cache.conflicts.filter((item) => item.id !== operation.id);
    if (choice === "retry") this.cache.pending.push({ ...operation, queuedAt: (/* @__PURE__ */ new Date()).toISOString() });
    await this.saveSettings();
    await this.refreshLocalSurfaces();
    new import_obsidian20.Notice(choice === "retry" ? "\u062A\u063A\u06CC\u06CC\u0631 \u062F\u0648\u0628\u0627\u0631\u0647 \u0628\u0647 \u0635\u0641 \u0627\u0645\u0646 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0631\u0641\u062A." : "\u062A\u063A\u06CC\u06CC\u0631 \u0645\u062D\u0644\u06CC \u0627\u0632 \u0635\u0641 \u062A\u0639\u0627\u0631\u0636 \u062D\u0630\u0641 \u0634\u062F.");
  }
  async repairMarkdownBindings() {
    const result = await this.markdownSync.repairLegacyBindings();
    new import_obsidian20.Notice(`\u0627\u0633\u06A9\u0646 binding \u0642\u062F\u06CC\u0645\u06CC \u062A\u0645\u0627\u0645 \u0634\u062F\u061B ${result.quarantine} \u0645\u0648\u0631\u062F \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC \u062F\u0633\u062A\u06CC \u0627\u0633\u062A.`);
    return result;
  }
  async previewTickTickNotes() {
    const rows = this.noteImport.preview(this.cache.tasks);
    if (rows.length) new NoteImportModal(this.app, this.noteImport, this.cache.tasks).open();
    else new import_obsidian20.Notice("Note \u0642\u0627\u0628\u0644\u200C\u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u0627 kind: NOTE \u062F\u0631 cache \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
    return rows;
  }
  async importSelectedTickTickNotes(rows) {
    return this.noteImport.apply(rows);
  }
  plannerHost() {
    return {
      app: this.app,
      timeZone: this.settings.timeZone,
      firstWeekday: 6,
      showCompleted: this.settings.plannerShowCompleted,
      tasks: () => this.cache.tasks,
      // This host is called by an explicit toolbar action. Let the central
      // sync layer report an honest success/fallback/error notification.
      refresh: async () => {
        await this.syncNow();
      },
      reschedule: async (task, day) => this.rescheduleTaskFromPlanner(task, day),
      complete: async (task) => this.markdownSync.bindingForTask(String(task.id)) ? this.markdownSync.completeBoundTask(String(task.id)) : this.completeTask(task),
      binding: (task) => this.markdownSync.bindingForTask(String(task.id)),
      load: async (task) => this.loadTaskDetails(task),
      edit: async (task) => this.editTaskFromSurface(task),
      create: async (initial) => this.createTaskFromSurface(initial),
      habits: (day) => this.cachedHabitsForDay(day),
      checkInHabit: async (habit, day) => {
        const goal = Math.max(1, Number(habit.checkin?.goal ?? habit.goal ?? habit.target ?? 1));
        const current = Number(habit.checkin?.value ?? 0);
        const next = current >= goal ? 0 : Math.min(goal, current + Math.max(1, Number(habit.step ?? 1)));
        return this.checkInHabit(String(habit.id), day, { value: next, goal, status: next >= goal ? 2 : void 0 });
      },
      habitWithHistory: (habitId, day) => this.cachedHabitsWithHistory(day, 28).find((habit) => String(habit.id) === habitId),
      // Details panels are cache-only. The normal sync pipeline refreshes this
      // mirror; opening a habit must never create a second web request.
      habitHistory: (habitId, from, to) => this.cachedHabitHistoryRange(habitId, from, to),
      setHabitProgress: async (habit, day, value, goal) => this.checkInHabit(String(habit.id), day, { value: Math.max(0, value), goal: Math.max(1, goal), status: value >= goal ? 2 : void 0 }),
      loadHabit: async (habit) => this.loadHabitDetails(habit),
      showHabits: () => this.settings.plannerShowHabits,
      setShowHabits: async (value) => {
        this.settings.plannerShowHabits = value;
        await this.saveSettings();
      }
    };
  }
  projectBoardHost() {
    return {
      app: this.app,
      timeZone: this.settings.timeZone,
      firstWeekday: 6,
      projects: async () => this.cache.projects.length ? this.cache.projects : this.client().listProjects(),
      createProject: (project) => this.client().createProject(project),
      updateProject: (project) => this.client().updateProject(project),
      deleteProject: (projectId) => this.client().deleteProject(projectId),
      createTask: (initial) => this.createTaskFromSurface(initial),
      tasks: () => this.cache.tasks,
      habits: () => this.cache.habits,
      checkInHabit: async (habit, day) => {
        const goal = Math.max(1, Number(habit.checkin?.goal ?? habit.goal ?? habit.target ?? 1));
        const current = Number(habit.checkin?.value ?? 0);
        const next = current >= goal ? 0 : Math.min(goal, current + Math.max(1, Number(habit.step ?? 1)));
        return this.checkInHabit(String(habit.id), day, { value: next, goal, status: next >= goal ? 2 : void 0 });
      },
      habitHistory: (habitId, from, to) => this.cachedHabitHistoryRange(habitId, from, to),
      setHabitProgress: async (habit, day, value, goal) => this.checkInHabit(String(habit.id), day, { value: Math.max(0, value), goal: Math.max(1, goal), status: value >= goal ? 2 : void 0 }),
      board: async (project) => (project ? this.cache.projectBoards[String(project.id)] : void 0) ?? this.client().projectBoard(project),
      // This host is called by an explicit toolbar action. Let the central
      // sync layer report an honest success/fallback/error notification.
      refresh: async () => {
        await this.syncNow();
      },
      complete: async (task) => this.markdownSync.bindingForTask(String(task.id)) ? this.markdownSync.completeBoundTask(String(task.id)) : this.completeTask(task),
      binding: (task) => this.markdownSync.bindingForTask(String(task.id)),
      load: async (task) => this.loadTaskDetails(task),
      edit: async (task) => this.editTaskFromSurface(task),
      moveToColumn: async (task, columnId) => this.moveTaskToBoardColumn(task, columnId),
      showCompleted: () => this.settings.plannerShowCompleted,
      preferences: () => ({ selected: this.settings.boardLastProjectId, collapsed: this.settings.boardCollapsedGroups, sidebarCollapsed: this.settings.boardSidebarCollapsed, sidebarPreferenceInitialized: this.settings.boardSidebarPreferenceInitialized }),
      savePreferences: async (value) => {
        this.settings.boardLastProjectId = value.selected;
        this.settings.boardCollapsedGroups = value.collapsed;
        this.settings.boardSidebarCollapsed = value.sidebarCollapsed;
        this.settings.boardSidebarPreferenceInitialized = value.sidebarPreferenceInitialized ?? true;
        await this.saveSettings();
      }
    };
  }
  async importTaggedCheckboxes(file, quiet = false) {
    const tag = this.settings.checkboxImportTag.trim().replace(/^#/, "") || "ticktick";
    const tagPattern2 = new RegExp(`(^|\\s)#${escapeRegExp(tag)}(?=\\s|$)`, "i");
    const markerPattern = /\s*<!--\s*ticktick-bridge:([^\s>]+)\s*-->/i;
    const original = await this.app.vault.read(file);
    const lines = original.split(/\r?\n/);
    let changed = false;
    let imported = 0;
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      const task = line.match(/^(\s*(?:[-*+] |\d+\. )\[ \]\s+)(.+)$/);
      if (!task || !tagPattern2.test(task[2]) || markerPattern.test(task[2])) continue;
      const scheduled = checkboxSchedule(task[2].replace(tagPattern2, "$1"), todayInZone(this.settings.timeZone));
      const title = scheduled.title;
      if (!title) continue;
      const marker = crypto.randomUUID();
      const projectId = scheduled.dueDate ? await this.scheduledCheckboxProjectId() : "inbox";
      const payload = toTaskPayload({ title, projectId, dueDate: scheduled.dueDate }, this.settings.timeZone);
      await this.createTask(payload);
      lines[index] = `${line} <!-- ticktick-bridge:${marker} -->`;
      changed = true;
      imported++;
    }
    if (changed) await this.app.vault.modify(file, lines.join("\n"));
    if (imported && !quiet) new import_obsidian20.Notice(`${imported} \u0686\u06A9\u200C\u0628\u0627\u06A9\u0633 \u0628\u0647 TickTick \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.`);
    return imported;
  }
  async scheduledCheckboxProjectId() {
    if (this.settings.scheduledCheckboxProjectId) return this.settings.scheduledCheckboxProjectId;
    const cached = this.cache.tasks.find((task) => String(task.projectName ?? "").trim() === "\u0627\u0642\u062F\u0627\u0645" && task.projectId);
    if (cached?.projectId) return cached.projectId;
    const projects = await this.client().listProjects();
    const action = projects.find((project) => String(project.name ?? "").trim() === "\u0627\u0642\u062F\u0627\u0645");
    if (!action?.id) throw new Error("\u0644\u06CC\u0633\u062A \xAB\u0627\u0642\u062F\u0627\u0645\xBB \u062F\u0631 TickTick \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
    this.settings.scheduledCheckboxProjectId = action.id;
    await this.saveSettings();
    return action.id;
  }
  configureAutomaticSync() {
    if (this.syncTimer !== null) window.clearTimeout(this.syncTimer);
    this.syncTimer = null;
    const seconds = Number(this.settings.syncIntervalSeconds);
    const legacyMinutes = Number(this.settings.syncIntervalMinutes);
    const delay = Number.isFinite(seconds) && seconds >= 30 ? seconds * 1e3 : Number.isFinite(legacyMinutes) && legacyMinutes >= 1 ? legacyMinutes * 6e4 : 0;
    if (!delay) return;
    this.syncTimer = window.setTimeout(async () => {
      this.syncTimer = null;
      try {
        await this.syncNow({ quiet: true, scheduled: true });
      } finally {
        this.configureAutomaticSync();
      }
    }, delay);
  }
  configureRibbonIcons() {
    this.ribbonIcons.forEach((icon) => icon.remove());
    this.ribbonIcons = [];
    if (!this.settings.showRibbonIcons) return;
    this.ribbonIcons.push(
      this.addRibbonIcon("check-square", "TickTick Bridge: \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632", () => this.openTodayView()),
      this.addRibbonIcon("activity", "TickTick Bridge: \u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632", () => this.openHabitView())
    );
  }
  configureSyncRibbonIcon() {
    this.syncRibbonIcon?.remove();
    this.syncRibbonIcon = this.addRibbonIcon("arrow-down-up", "TickTick Bridge: \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0628\u0627 TickTick", () => void this.syncNow());
    this.syncRibbonIcon.addClass("ticktick-bridge-sync-ribbon");
    this.setSyncRibbonState(false);
  }
  configurePanelMenuRibbonIcon() {
    this.panelMenuRibbonIcon?.remove();
    this.panelMenuRibbonIcon = this.addRibbonIcon("layout-dashboard", "TickTick Bridge: \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u067E\u0646\u0644\u200C\u0647\u0627", (event) => this.showPanelMenu(event));
    this.panelMenuRibbonIcon.addClass("ticktick-bridge-panel-menu-ribbon");
  }
  showPanelMenu(event) {
    const menu = new import_obsidian20.Menu();
    menu.addItem((item) => item.setTitle("\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632").setIcon("check-square").onClick(() => void this.openTodayView()));
    menu.addItem((item) => item.setTitle("\u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632").setIcon("activity").onClick(() => void this.openHabitView()));
    menu.addItem((item) => item.setTitle("\u062A\u0642\u0648\u06CC\u0645 \u0648 \u0628\u0631\u0646\u0627\u0645\u0647\u0654 \u0647\u0641\u062A\u06AF\u06CC").setIcon("calendar-days").onClick(() => void this.openPlannerView()));
    menu.addItem((item) => item.setTitle("\u0628\u0631\u062F \u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627").setIcon("kanban-square").onClick(() => void this.openProjectBoardView()));
    menu.addSeparator();
    menu.addItem((item) => item.setTitle("\u0645\u0631\u06A9\u0632 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0648 \u062A\u0639\u0627\u0631\u0636\u200C\u0647\u0627").setIcon("arrow-down-up").onClick(() => void this.openControlPage("sync")));
    menu.addItem((item) => item.setTitle("\u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 \u0627\u0646\u062A\u0642\u0627\u0644 TickTick Notes").setIcon("file-down").onClick(() => void this.openControlPage("notes")));
    menu.addItem((item) => item.setTitle("Checklist\u0647\u0627\u06CC task (\u0641\u0642\u0637\u200C\u062E\u0648\u0627\u0646\u062F\u0646\u06CC)").setIcon("list-checks").onClick(() => void this.openControlPage("checklists")));
    menu.addItem((item) => item.setTitle("\u0622\u062E\u0631\u06CC\u0646 \u06AF\u0632\u0627\u0631\u0634 \u0648 backup").setIcon("shield-check").onClick(() => void this.openControlPage("reports")));
    menu.showAtMouseEvent(event);
  }
  setSyncRibbonState(syncing) {
    if (!this.syncRibbonIcon) return;
    (0, import_obsidian20.setIcon)(this.syncRibbonIcon, syncing ? "loader-circle" : "arrow-down-up");
    this.syncRibbonIcon.toggleClass("is-syncing", syncing);
    this.syncRibbonIcon.setAttribute("aria-label", syncing ? "TickTick Bridge: \u062F\u0631 \u062D\u0627\u0644 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC\u2026" : "TickTick Bridge: \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0628\u0627 TickTick");
  }
  async syncNow({ quiet = false, scheduled = false } = {}) {
    if (this.syncInProgress) {
      if (!quiet) new import_obsidian20.Notice("\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC TickTick \u0647\u0645\u06CC\u0646 \u062D\u0627\u0644\u0627 \u062F\u0631 \u062D\u0627\u0644 \u0627\u0646\u062C\u0627\u0645 \u0627\u0633\u062A.");
      return;
    }
    if (Date.now() < this.rateLimitedUntil) {
      if (!quiet) new import_obsidian20.Notice(`TickTick \u0645\u0648\u0642\u062A\u0627\u064B \u062F\u0631\u062E\u0648\u0627\u0633\u062A\u200C\u0647\u0627 \u0631\u0627 \u0645\u062D\u062F\u0648\u062F \u06A9\u0631\u062F\u0647 \u0627\u0633\u062A. \u0627\u0631\u0633\u0627\u0644 \u062A\u063A\u06CC\u06CC\u0631\u0647\u0627\u06CC \u0635\u0641\u200C\u0634\u062F\u0647 \u062D\u062F\u0648\u062F ${this.rateLimitWaitSeconds()} \u062B\u0627\u0646\u06CC\u0647\u0654 \u062F\u06CC\u06AF\u0631 \u062F\u0648\u0628\u0627\u0631\u0647 \u062A\u0644\u0627\u0634 \u0645\u06CC\u200C\u0634\u0648\u062F.`);
      return;
    }
    this.syncInProgress = true;
    this.setSyncRibbonState(true);
    try {
      const day = todayInZone(this.settings.timeZone);
      const pendingFlushed = await this.flushPendingMutations();
      if (!pendingFlushed) {
        if (!quiet) new import_obsidian20.Notice("\u062A\u063A\u06CC\u06CC\u0631\u0647\u0627 \u062F\u0631 \u0635\u0641 \u0627\u0645\u0646 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0645\u0627\u0646\u062F\u0646\u062F\u061B TickTick \u0641\u0639\u0644\u0627\u064B \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062A\u0627\u0632\u0647 \u0646\u0645\u06CC\u200C\u067E\u0630\u06CC\u0631\u062F.");
        return;
      }
      const refreshed = await this.refreshCacheFromTickTick(day, !scheduled);
      const tasks = this.cachedTasksForDay(day);
      const habits = this.cachedHabitsForDay(day);
      await this.refreshLocalSurfaces();
      if (!quiet && refreshed.remote) {
        const notes = this.cache.tasks.filter((task) => String(task.kind ?? "").toUpperCase() === "NOTE").length;
        new import_obsidian20.Notice(`\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u06A9\u0627\u0645\u0644 \u0634\u062F: ${this.cache.projects.length} \u0644\u06CC\u0633\u062A\u060C ${this.cache.tasks.length} \u0631\u06A9\u0648\u0631\u062F (${notes} Note) \u0648 ${habits.length} \u0639\u0627\u062F\u062A \u0627\u0645\u0631\u0648\u0632.`);
      } else if (!quiet) {
        new import_obsidian20.Notice("\u0646\u0633\u062E\u0647\u0654 \u0645\u062D\u0644\u06CC \u0622\u0645\u0627\u062F\u0647 \u0627\u0633\u062A\u061B TickTick \u062F\u0627\u062F\u0647\u0654 \u062A\u0627\u0632\u0647\u200C\u0627\u06CC \u0628\u0631\u0646\u06AF\u0631\u062F\u0627\u0646\u062F. \u0627\u062A\u0635\u0627\u0644 \u0648\u0628 \u0631\u0627 \u062F\u0631 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646.");
      }
    } catch (error) {
      if (this.isRateLimitError(error)) {
        this.deferForRateLimit(error);
        await this.saveSettings();
      }
      if (!quiet) new import_obsidian20.Notice(error instanceof Error ? error.message : "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC TickTick \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    } finally {
      this.setSyncRibbonState(false);
      this.syncInProgress = false;
      if (!scheduled) this.configureAutomaticSync();
    }
  }
  hasCache() {
    return Boolean(this.cache.savedAt);
  }
  /** Re-render every open local surface after a cache mutation. This deliberately
   * performs no TickTick request, so a drag in week/month is immediately
   * reflected in daily-note blocks, boards and other open views. */
  async refreshLocalSurfaces() {
    this.habitCheckinCache.clear();
    for (const [element, day] of this.taskBlocks) {
      if (!element.isConnected) {
        this.taskBlocks.delete(element);
        this.taskBlockSignatures.delete(element);
        continue;
      }
      const signature = this.taskBlockSignature(day);
      if (this.taskBlockSignatures.get(element) !== signature) {
        await this.renderTodayBlock(element, day);
        this.taskBlockSignatures.set(element, signature);
      }
    }
    for (const [element, context] of this.habitBlocks) {
      if (!element.isConnected) {
        this.habitBlocks.delete(element);
        this.habitBlockSignatures.delete(element);
        this.dashboardStates.delete(element);
        continue;
      }
      const signature = this.habitBlockSignature(element, context);
      if (this.habitBlockSignatures.get(element) !== signature) {
        await this.renderHabitBlock(element, context.dashboard, context.day);
        this.habitBlockSignatures.set(element, signature);
      }
    }
    for (const type of [VIEW_TYPE, HABIT_VIEW_TYPE, PLANNER_VIEW_TYPE, PROJECT_BOARD_VIEW_TYPE]) {
      for (const leaf of this.app.workspace.getLeavesOfType(type)) {
        const view = leaf.view;
        if (typeof view.render === "function") await view.render();
      }
    }
  }
  taskBlockSignature(day) {
    const targetDay = day ?? todayInZone(this.settings.timeZone);
    return JSON.stringify(this.cachedTasksForDay(targetDay));
  }
  habitBlockSignature(element, context) {
    const today = todayInZone(this.settings.timeZone);
    const state = context.dashboard ? this.dashboardStates.get(element) ?? { day: context.day ?? today, mode: "day" } : null;
    const day = state?.day ?? context.day ?? today;
    const historyDays = state?.mode === "week" ? 7 : state?.mode === "month" ? 30 : state?.mode === "stats" ? 28 : 1;
    const habits = context.dashboard ? this.cachedHabitsWithHistory(day, historyDays) : this.cachedHabitsForDay(day);
    return JSON.stringify({ day, mode: state?.mode, habits });
  }
  cacheSnapshotTime() {
    if (!this.cache.savedAt) return "";
    const value = new Date(this.cache.savedAt);
    return Number.isNaN(value.getTime()) ? "" : new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeStyle: "short" }).format(value);
  }
  cacheConflictCount() {
    return this.cache.conflicts.length;
  }
  async refreshCacheFromTickTick(today, hydrateHabits = false) {
    const client = this.client();
    const cacheAvailable = this.hasCache();
    const webTasks = await this.webOpenTasks();
    const projects = cacheAvailable ? this.cache.projects : await client.listProjects();
    let habits = !cacheAvailable || hydrateHabits ? await client.listHabits() : this.cache.habits;
    const sections = cacheAvailable ? [] : await client.listHabitSections();
    const projectBoards = {};
    const taskIndex = /* @__PURE__ */ new Map();
    for (const task of this.cache.tasks) {
      const key = `${String(task?.projectId ?? "")}:${String(task?.id ?? "")}`;
      if (task?.id) taskIndex.set(key, task);
    }
    for (const project of projects) {
      const projectId = String(project.id);
      const cachedBoard = this.cache.projectBoards[projectId];
      if (!cachedBoard) continue;
      const board = { ...cachedBoard, project: { ...cachedBoard.project, ...project } };
      projectBoards[projectId] = board;
      for (const task of board.tasks ?? []) {
        const key = `${String(task?.projectId ?? projectId)}:${String(task?.id ?? "")}`;
        if (task?.id) taskIndex.set(key, mergeTaskDetails(task, taskIndex.get(key)));
      }
    }
    const missingProject = projects.find((project) => !projectBoards[String(project.id)]);
    if (missingProject) {
      const board = normalizeProjectData(await client.getProjectData(missingProject.id), missingProject);
      projectBoards[String(board.project.id)] = board;
      for (const task of board.tasks) {
        const key = `${String(task?.projectId ?? missingProject.id)}:${String(task?.id ?? "")}`;
        taskIndex.set(key, mergeTaskDetails(taskIndex.get(key), task));
      }
    }
    if (!projectBoards.inbox && !this.cache.tasks.some((task) => String(task?.projectId ?? "").toLowerCase() === "inbox")) {
      try {
        const inbox = normalizeProjectData(await client.getProjectData("inbox"), { id: "inbox", name: "\u0648\u0631\u0648\u062F\u06CC" });
        inbox.tasks = inbox.tasks.map((task) => ({ ...task, isInbox: true, projectName: "\u0648\u0631\u0648\u062F\u06CC" }));
        projectBoards.inbox = inbox;
        for (const task of inbox.tasks) taskIndex.set(`${String(task.projectId ?? "inbox")}:${String(task.id ?? "")}`, task);
      } catch {
      }
    }
    for (const task of webTasks ?? []) {
      const projectId = String(task.projectId ?? "");
      const key = `${projectId}:${task.id}`;
      const prior = taskIndex.get(key);
      taskIndex.set(key, prior ? mergeTaskDetails(prior, task) : task);
    }
    const tasks = [...taskIndex.values()];
    for (const [projectId, board] of Object.entries(projectBoards)) {
      const prior = new Map((board.tasks ?? []).map((task) => [String(task.id), task]));
      board.tasks = tasks.filter((task) => projectId === "inbox" ? Boolean(task.isInbox) : String(task?.projectId ?? "") === projectId).map((task) => mergeTaskDetails(prior.get(String(task.id)), task));
    }
    const activeHabits = habits.filter((habit) => habit.status === void 0 || habit.status === 0);
    const fromDay = shiftIsoDay(today, -90);
    const officialDocuments = !cacheAvailable && activeHabits.length ? await client.getHabitCheckins(activeHabits.map((habit) => habit.id), fromDay, today) : [];
    const checkins = { ...this.cache.habitCheckins };
    for (const document of officialDocuments ?? []) {
      const habitId = String(document?.habitId ?? "");
      if (!habitId) continue;
      checkins[habitId] = (document.checkins ?? []).map((entry) => ({ stamp: Number(entry.stamp), value: Number(entry.value ?? 0), goal: Number(entry.goal ?? 1), status: Number(entry.status ?? 0) }));
    }
    const webCheckins = await this.webHabitCheckins(activeHabits.map((habit) => habit.id), today, 91);
    if (webCheckins) for (const [habitId, entries] of webCheckins) checkins[habitId] = entries;
    if (webCheckins) {
      habits = habits.map((habit) => {
        const recent = (webCheckins.get(String(habit.id)) ?? []).at(-1);
        const goal = Number(recent?.goal ?? 0);
        return goal > 0 ? { ...habit, goal } : habit;
      });
    }
    const sectionNames = new Map(sections.map((section) => [section.id, section.name]));
    this.cache = {
      savedAt: (/* @__PURE__ */ new Date()).toISOString(),
      tasks,
      projects,
      projectBoards,
      habits: activeHabits.map((habit) => ({ ...habit, sectionName: sectionNames.get(habit.sectionId) ?? habit.sectionName ?? "\u0628\u062F\u0648\u0646 \u062F\u0633\u062A\u0647" })),
      habitCheckins: checkins,
      pending: this.cache.pending,
      conflicts: this.cache.conflicts,
      rateLimitedUntil: 0
    };
    this.rateLimitedUntil = 0;
    await this.saveSettings();
    bridgeEvents.emit("sync:complete", { timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    return { remote: webTasks !== null || webCheckins !== null || !cacheAvailable };
  }
  async runMutation(type, payload, originElement) {
    const operation = { id: crypto.randomUUID(), type, payload, queuedAt: (/* @__PURE__ */ new Date()).toISOString() };
    const execute = async () => {
      const client = this.client();
      if (type === "create") return client.createTask(payload);
      if (type === "update") return client.updateTask(payload);
      if (type === "complete") {
        const p2 = payload;
        return client.completeTask(String(p2.projectId ?? ""), String(p2.id ?? ""));
      }
      if (type === "delete") {
        const p2 = payload;
        return client.deleteTask(String(p2.projectId ?? ""), String(p2.id ?? ""));
      }
      const p = payload;
      return client.checkInHabit(p.habitId, p.day, p.checkin);
    };
    const applyLocal = () => {
      if (type === "create") {
        const p = payload;
        const task = {
          id: `offline-${operation.id}`,
          projectId: String(p.projectId ?? ""),
          title: String(p.title ?? "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646"),
          status: 0,
          ...p
        };
        this.cache.tasks.push(task);
        const board = this.cache.projectBoards[task.projectId];
        if (board) board.tasks = [...board.tasks ?? [], task];
        bridgeEvents.emit("task:created", { task });
      }
      if (type === "update") {
        const updatePayload = payload;
        this.cache.tasks = this.cache.tasks.map((task) => task.id === updatePayload.id ? { ...task, ...updatePayload } : task);
        for (const board of Object.values(this.cache.projectBoards)) board.tasks = (board.tasks ?? []).map((task) => task.id === updatePayload.id ? { ...task, ...updatePayload } : task);
        bridgeEvents.emit("task:updated", { task: updatePayload });
      }
      if (type === "complete" || type === "delete") {
        const targetId = payload.id;
        this.cache.tasks = this.cache.tasks.filter((task) => task.id !== targetId);
        for (const board of Object.values(this.cache.projectBoards)) board.tasks = (board.tasks ?? []).filter((task) => task.id !== targetId);
        if (type === "complete" && targetId) {
          bridgeEvents.emit("task:completed", { taskId: targetId });
        } else if (type === "delete" && targetId) {
          bridgeEvents.emit("task:deleted", { taskId: targetId });
        }
      }
      if (type === "habit") {
        const habitPayload = payload;
        const stamp = Number(String(habitPayload.day).replaceAll("-", ""));
        const previous = this.cache.habitCheckins[habitPayload.habitId] ?? [];
        this.cache.habitCheckins[habitPayload.habitId] = [...previous.filter((entry) => entry.stamp !== stamp), { stamp, value: 0, goal: 1, status: 0, ...habitPayload.checkin }];
        bridgeEvents.emit("habit:checkin", {
          habitId: habitPayload.habitId,
          day: habitPayload.day,
          value: Number(habitPayload.checkin?.value ?? 0),
          goal: Number(habitPayload.checkin?.goal ?? 1),
          status: Number(habitPayload.checkin?.status ?? 0)
        });
      }
      bridgeEvents.emit("state:changed", void 0);
    };
    if (!navigator.onLine) {
      this.cache.pending.push(operation);
      applyLocal();
      await this.saveSettings();
      await this.refreshLocalSurfaces();
      new import_obsidian20.Notice("\u0622\u0641\u0644\u0627\u06CC\u0646 \u0647\u0633\u062A\u06CC\u061B \u062A\u063A\u06CC\u06CC\u0631 \u062F\u0631 \u0635\u0641 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.");
      return { queued: true };
    }
    if (Date.now() < this.rateLimitedUntil) {
      this.cache.pending.push(operation);
      applyLocal();
      await this.saveSettings();
      await this.refreshLocalSurfaces();
      new import_obsidian20.Notice(`TickTick \u0645\u0648\u0642\u062A\u0627\u064B \u0645\u062D\u062F\u0648\u062F\u06CC\u062A \u06AF\u0630\u0627\u0634\u062A\u0647 \u0627\u0633\u062A\u061B \u062A\u063A\u06CC\u06CC\u0631 \u0645\u062D\u0644\u06CC \u062D\u0641\u0638 \u0634\u062F \u0648 \u062D\u062F\u0648\u062F ${this.rateLimitWaitSeconds()} \u062B\u0627\u0646\u06CC\u0647\u0654 \u062F\u06CC\u06AF\u0631 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0627\u0631\u0633\u0627\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F.`);
      return { queued: true };
    }
    try {
      const result = await execute();
      applyLocal();
      await this.saveSettings();
      await this.refreshLocalSurfaces();
      return { queued: false, result };
    } catch (error) {
      const status = Number(error?.status ?? 0);
      if (status === 429) this.deferForRateLimit(error);
      else if (status > 0 && status < 500) throw error;
      this.cache.pending.push(operation);
      applyLocal();
      await this.saveSettings();
      await this.refreshLocalSurfaces();
      new import_obsidian20.Notice(status === 429 ? `TickTick \u0645\u0648\u0642\u062A\u0627\u064B \u0645\u062D\u062F\u0648\u062F\u06CC\u062A \u06AF\u0630\u0627\u0634\u062A\u0647 \u0627\u0633\u062A\u061B \u062A\u063A\u06CC\u06CC\u0631 \u0645\u062D\u0644\u06CC \u062D\u0641\u0638 \u0634\u062F \u0648 \u062D\u062F\u0648\u062F ${this.rateLimitWaitSeconds()} \u062B\u0627\u0646\u06CC\u0647\u0654 \u062F\u06CC\u06AF\u0631 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0627\u0631\u0633\u0627\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F.` : "\u0627\u062A\u0635\u0627\u0644 TickTick \u0628\u0631\u0642\u0631\u0627\u0631 \u0646\u06CC\u0633\u062A\u061B \u062A\u063A\u06CC\u06CC\u0631 \u062F\u0631 \u0635\u0641 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.");
      return { queued: true };
    }
  }
  async flushPendingMutations() {
    if (!this.cache.pending.length || !navigator.onLine) return true;
    const remaining = [];
    for (let index = 0; index < this.cache.pending.length; index++) {
      const operation = this.cache.pending[index];
      try {
        const client = this.client();
        if (operation.type === "create") await client.createTask(operation.payload);
        else if (operation.type === "update") await client.updateTask(operation.payload);
        else if (operation.type === "complete") {
          const p = operation.payload;
          await client.completeTask(String(p.projectId ?? ""), String(p.id ?? ""));
        } else if (operation.type === "delete") {
          const p = operation.payload;
          await client.deleteTask(String(p.projectId ?? ""), String(p.id ?? ""));
        } else {
          const p = operation.payload;
          await client.checkInHabit(String(p.habitId), String(p.day), p.checkin);
        }
      } catch (error) {
        const status = Number(error?.status ?? 0);
        if (status > 0 && status < 500 && status !== 429) {
          this.cache.conflicts.push(operation);
          new import_obsidian20.Notice("\u06CC\u06A9 \u062A\u063A\u06CC\u06CC\u0631 \u0622\u0641\u0644\u0627\u06CC\u0646 \u0628\u0627 \u0646\u0633\u062E\u0647\u0654 TickTick \u062A\u062F\u0627\u062E\u0644 \u062F\u0627\u0634\u062A \u0648 \u0627\u0631\u0633\u0627\u0644 \u0646\u0634\u062F.");
        } else {
          if (status === 429) this.deferForRateLimit(error);
          remaining.push(...this.cache.pending.slice(index));
          this.cache.pending = remaining;
          await this.saveSettings();
          return false;
        }
      }
    }
    this.cache.pending = remaining;
    await this.saveSettings();
    return true;
  }
  isRateLimitError(error) {
    return Number(error?.status ?? 0) === 429;
  }
  deferForRateLimit(error) {
    const requestedSeconds = Number(error?.retryAfter ?? 0);
    const seconds = Number.isFinite(requestedSeconds) && requestedSeconds > 0 ? Math.min(Math.ceil(requestedSeconds), 600) : 60;
    this.rateLimitedUntil = Math.max(this.rateLimitedUntil, Date.now() + seconds * 1e3);
    this.cache.rateLimitedUntil = this.rateLimitedUntil;
  }
  rateLimitWaitSeconds() {
    return Math.max(1, Math.ceil((this.rateLimitedUntil - Date.now()) / 1e3));
  }
  async createTask(task) {
    return this.runMutation("create", task);
  }
  async updateTask(task) {
    return this.runMutation("update", task);
  }
  async completeTask(task, originElement) {
    return this.runMutation("complete", task, originElement);
  }
  async deleteTask(task, originElement) {
    return this.runMutation("delete", task, originElement);
  }
  async checkInHabit(habitId, day, checkin) {
    return this.runMutation("habit", { habitId, day, checkin });
  }
  async createTaskFromSurface(initial = {}) {
    const projects = await this.client().listProjects();
    const draft = await openTaskEditor(this.app, projects, initial);
    if (!draft) return null;
    return this.createTask(toTaskPayload(draft, this.settings.timeZone));
  }
  async loadTaskDetails(task) {
    const cached = this.cache.tasks.find((item) => String(item?.id) === String(task?.id) && String(item?.projectId ?? "") === String(task?.projectId ?? ""));
    if (cached && taskDescription(cached)) return mergeTaskDetails(task, cached);
    const projectId = String(task?.projectId ?? "");
    if (!projectId || !task?.id) return task;
    const client = this.client();
    let direct = task;
    try {
      direct = await client.getTask(projectId, String(task.id));
    } catch {
    }
    if (taskDescription(direct)) return direct;
    try {
      const project = await client.getProjectData(projectId);
      const record = (project?.tasks ?? []).find((item) => String(item?.id) === String(task.id));
      return record ? mergeTaskDetails(direct, record) : direct;
    } catch {
      return direct;
    }
  }
  async editTaskFromSurface(task) {
    const current = await this.loadTaskDetails(task) ?? task;
    const projects = await this.client().listProjects();
    const draft = await openTaskEditor(this.app, projects, current);
    if (!draft) return null;
    const payload = toTaskPayload({ ...current, ...draft }, this.settings.timeZone);
    await this.updateTask(payload);
    return { ...current, ...payload };
  }
  async rescheduleTaskFromPlanner(task, targetDay) {
    const start = toDateKey(task?.startDate, task?.timeZone || this.settings.timeZone);
    const due = toDateKey(task?.dueDate, task?.timeZone || this.settings.timeZone);
    const anchor = start ?? due;
    if (!anchor) throw new Error("\u062A\u0633\u06A9 \u062A\u0627\u0631\u06CC\u062E \u0642\u0627\u0628\u0644\u200C\u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u0646\u062F\u0627\u0631\u062F.");
    const offset = Math.round((Date.parse(`${targetDay}T12:00:00Z`) - Date.parse(`${anchor}T12:00:00Z`)) / 864e5);
    const moveValue = (value, fallback) => {
      if (!fallback) return null;
      const original = String(value ?? "");
      const moved = shiftIsoDay(fallback, offset);
      return original.includes("T") ? `${moved}${original.slice(10)}` : `${moved}T00:00:00+0330`;
    };
    const payload = toTaskPayload({ ...task, dueDate: due ? shiftIsoDay(due, offset) : null }, this.settings.timeZone);
    payload.startDate = moveValue(task.startDate, start);
    payload.dueDate = moveValue(task.dueDate, due);
    payload.isAllDay = task.isAllDay ?? !String(task.dueDate ?? task.startDate ?? "").includes("T");
    await this.updateTask(payload);
    return { ...task, ...payload };
  }
  async moveTaskToBoardColumn(task, columnId) {
    if (!columnId) throw new Error("\u0633\u062A\u0648\u0646 \u0645\u0642\u0635\u062F \u0628\u0631\u0627\u06CC \u0627\u0646\u062A\u0642\u0627\u0644 \u0642\u0627\u0628\u0644\u200C\u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0646\u06CC\u0633\u062A.");
    if (String(task.columnId ?? "") === columnId) return task;
    const payload = toTaskPayload({ ...task, columnId }, this.settings.timeZone);
    await this.updateTask(payload);
    return { ...task, ...payload };
  }
  cachedTasksForDay(day) {
    return this.cache.tasks.filter((task) => isScheduledForDay(task, day));
  }
  cachedHabitsForDay(day) {
    const stamp = Number(day.replaceAll("-", ""));
    return this.cache.habits.filter((habit) => isHabitScheduledForCachedDay(habit, day)).map((habit) => ({
      ...habit,
      checkin: (this.cache.habitCheckins[habit.id] ?? []).find((entry) => entry.stamp === stamp) ?? null
    }));
  }
  cachedHabitsWithHistory(day, days) {
    const start = shiftIsoDay(day, -Math.max(0, days - 1));
    const dates = Array.from({ length: days }, (_, index) => shiftIsoDay(start, index));
    const stamp = Number(day.replaceAll("-", ""));
    return this.cache.habits.map((habit) => {
      const goal = Math.max(1, Number(habit.goal ?? 1));
      const entries = this.cache.habitCheckins[habit.id] ?? [];
      return {
        ...habit,
        checkin: entries.find((entry) => entry.stamp === stamp) ?? null,
        history: dates.filter((date) => isHabitScheduledForCachedDay(habit, date)).map((date) => {
          const entry = entries.find((value2) => value2.stamp === Number(date.replaceAll("-", "")));
          const value = Number(entry?.value ?? 0);
          return { date, value, completed: entry?.status === 2 || value >= goal };
        })
      };
    });
  }
  /** Load one habit's requested calendar range on demand. This keeps routine
   * sync cache-first, while month navigation can safely fetch older history. */
  async habitHistoryRange(habitId, from, to) {
    const habit = this.cache.habits.find((item) => String(item.id) === habitId);
    if (!habit) return [];
    let entries = this.cache.habitCheckins[habitId] ?? [];
    if (navigator.onLine && Date.now() >= this.rateLimitedUntil) {
      try {
        const documents = await this.client().getHabitCheckins([habitId], from, to);
        const remote = (documents ?? []).find((document) => String(document?.habitId) === habitId)?.checkins ?? [];
        if (remote.length || entries.length) {
          const byStamp = new Map(entries.map((entry) => [Number(entry.stamp), entry]));
          for (const entry of remote) byStamp.set(Number(entry.stamp), { stamp: Number(entry.stamp), value: Number(entry.value ?? 0), goal: Number(entry.goal ?? habit.goal ?? 1), status: Number(entry.status ?? 0) });
          entries = [...byStamp.values()];
          this.cache.habitCheckins[habitId] = entries;
          await this.saveSettings();
        }
      } catch {
      }
    }
    const dates = [];
    for (let day = from; day <= to; day = shiftIsoDay(day, 1)) dates.push(day);
    const goal = Math.max(1, Number(habit.goal ?? habit.target ?? 1));
    return dates.filter((day) => isHabitScheduledForCachedDay(habit, day)).map((day) => {
      const entry = entries.find((item) => Number(item.stamp) === Number(day.replaceAll("-", "")));
      const value = Number(entry?.value ?? 0);
      return { date: day, value, completed: Number(entry?.status ?? 0) === 2 || value >= goal };
    });
  }
  cachedHabitHistoryRange(habitId, from, to) {
    const habit = this.cache.habits.find((item) => String(item.id) === habitId);
    if (!habit) return [];
    const entries = this.cache.habitCheckins[habitId] ?? [];
    const dates = [];
    for (let day = from; day <= to; day = shiftIsoDay(day, 1)) dates.push(day);
    const goal = Math.max(1, Number(habit.goal ?? habit.target ?? 1));
    return dates.filter((day) => isHabitScheduledForCachedDay(habit, day)).map((day) => {
      const entry = entries.find((item) => Number(item.stamp) === Number(day.replaceAll("-", "")));
      const value = Number(entry?.value ?? 0);
      return { date: day, value, completed: Number(entry?.status ?? 0) === 2 || value >= goal };
    });
  }
  async loadHabitDetails(habit) {
    if (!habit?.id || !navigator.onLine || Date.now() < this.rateLimitedUntil) return habit;
    const fresh = await this.client().getHabit(String(habit.id));
    if (fresh && typeof fresh === "object") {
      this.cache.habits = this.cache.habits.map((item) => String(item.id) === String(habit.id) ? { ...item, ...fresh } : item);
      await this.saveSettings();
    }
    return fresh;
  }
  client() {
    if (!this.settings.apiToken.trim()) throw new Error("\u0627\u0628\u062A\u062F\u0627 API Token \u0631\u0627 \u062F\u0631 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A TickTick Bridge \u0648\u0627\u0631\u062F \u06A9\u0646.");
    return new TickTickClient({
      token: this.settings.apiToken,
      transport: async (url, init) => {
        const response = await (0, import_obsidian20.requestUrl)({ url, method: init.method, headers: init.headers, body: init.body, throw: false });
        return { status: response.status, text: response.text, headers: response.headers };
      }
    });
  }
  /**
   * TickTick's documented token API can lag behind the web app for current
   * habit check-ins.  If the user has opted in with their web-session cookie,
   * use the same read-only check-in feed that the web app reads.
   */
  /**
   * Imports the already-authenticated private TickTick session maintained by
   * TickTickSync.  The password is never read or stored by this plugin.
   */
  async importTickTickSyncSession() {
    const legacyPath = ".obsidian/plugins/tickticksync/data.json";
    try {
      const raw = await this.app.vault.adapter.read(legacyPath);
      const legacy = JSON.parse(raw);
      const token = String(legacy.token ?? "").trim();
      if (!token) throw new Error("\u0646\u0634\u0633\u062A \u0641\u0639\u0627\u0644\u06CC \u062F\u0631 TickTickSync \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F. \u0627\u0628\u062A\u062F\u0627 \u06CC\u06A9\u200C\u0628\u0627\u0631 \u062F\u0631 \u0622\u0646 \u0627\u0641\u0632\u0648\u0646\u0647 \u0648\u0627\u0631\u062F TickTick \u0634\u0648.");
      this.settings.webSessionToken = token;
      this.settings.webSessionCookie = normalizeWebSessionCookie(window.localStorage.getItem("TTS_Cookies") ?? "");
      this.settings.webSessionDeviceId ||= crypto.randomUUID().replaceAll("-", "").slice(0, 24);
      await this.saveSettings();
      return { hasCookie: Boolean(this.settings.webSessionCookie) };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("\u0646\u0634\u0633\u062A \u0641\u0639\u0627\u0644\u06CC")) throw error;
      throw new Error("\u062A\u0646\u0638\u06CC\u0645\u0627\u062A TickTickSync \u062E\u0648\u0627\u0646\u062F\u0647 \u0646\u0634\u062F. \u0645\u0637\u0645\u0626\u0646 \u0634\u0648 \u0627\u0641\u0632\u0648\u0646\u0647 \u0647\u0646\u0648\u0632 \u0646\u0635\u0628 \u0627\u0633\u062A \u0648 \u06CC\u06A9\u200C\u0628\u0627\u0631 \u062F\u0631 \u0622\u0646 \u0648\u0627\u0631\u062F \u0634\u062F\u0647\u200C\u0627\u06CC.");
    }
  }
  webDeviceAgent() {
    const id = this.settings.webSessionDeviceId || crypto.randomUUID().replaceAll("-", "").slice(0, 24);
    return JSON.stringify({
      platform: "web",
      os: currentPlatformName(),
      device: currentPlatformName(),
      name: "",
      version: 6070,
      id,
      channel: "website",
      campaign: "",
      websocket: ""
    });
  }
  /** Signs in directly with TickTick's web endpoint; credentials stay in memory only. */
  async loginToTickTickWeb(username, password) {
    const cleanUsername = username.trim();
    if (!cleanUsername || !password) throw new Error("\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646.");
    const deviceId = this.settings.webSessionDeviceId || crypto.randomUUID().replaceAll("-", "").slice(0, 24);
    this.settings.webSessionDeviceId = deviceId;
    const origin = "https://ticktick.com";
    const response = await (0, import_obsidian20.requestUrl)({
      url: `${origin}/api/v2/user/signon?wc=true&remember=true`,
      method: "POST",
      headers: {
        Accept: "*/*",
        "x-device": this.webDeviceAgent(),
        "Content-Type": "application/json",
        "X-Requested-With": "XMLHttpRequest",
        Origin: origin,
        Referer: `${origin}/signin`
      },
      body: JSON.stringify({ username: cleanUsername, password }),
      throw: false
    });
    const body = response.json;
    const token = String(body?.token ?? "").trim();
    if (response.status < 200 || response.status >= 300 || !token) throw new Error("\u0648\u0631\u0648\u062F TickTick \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F. \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC\u060C \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u06CC\u0627 \u062A\u0623\u06CC\u06CC\u062F \u0627\u0645\u0646\u06CC\u062A\u06CC \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646.");
    const receivedCookie = response.headers?.["set-cookie"] ?? response.headers?.["Set-Cookie"] ?? "";
    this.settings.webSessionToken = token;
    this.settings.webSessionCookie = normalizeWebSessionCookie(Array.isArray(receivedCookie) ? receivedCookie.join("; ") : receivedCookie);
    await this.saveSettings();
  }
  async webHabitCheckins(habitIds, day, historyDays = 1) {
    const token = this.settings.webSessionToken.trim();
    const cookie = normalizeWebSessionCookie(this.settings.webSessionCookie);
    if (!token && !cookie || !habitIds.length) return null;
    const afterDay = shiftIsoDay(day, -Math.max(1, historyDays));
    const sessionCookie = token ? `t=${token};${cookie ? ` ${cookie}` : ""}` : cookie;
    try {
      const response = await (0, import_obsidian20.requestUrl)({
        url: "https://api.ticktick.com/api/v2/habitCheckins/query",
        method: "POST",
        headers: {
          Cookie: sessionCookie,
          ...token ? { t: token } : {},
          "Content-Type": "application/json",
          "x-device": this.webDeviceAgent()
        },
        body: JSON.stringify({ habitIds, afterStamp: Number(afterDay.replaceAll("-", "")) }),
        throw: false
      });
      if (response.status < 200 || response.status >= 300) return null;
      return parseWebHabitCheckins(JSON.parse(response.text || "{}"));
    } catch {
      return null;
    }
  }
  /** The web session sees the same task collection as TickTick's Today screen,
   * including Inbox tasks that can be absent from the documented project feed. */
  async webRequest(path, method = "GET", body) {
    const token = this.settings.webSessionToken.trim();
    const cookie = normalizeWebSessionCookie(this.settings.webSessionCookie);
    if (!token && !cookie) return null;
    const sessionCookie = token ? `t=${token};${cookie ? ` ${cookie}` : ""}` : cookie;
    try {
      const response = await (0, import_obsidian20.requestUrl)({
        url: `https://api.ticktick.com/api/v2/${path.replace(/^\//, "")}`,
        method,
        headers: {
          Cookie: sessionCookie,
          ...token ? { t: token } : {},
          "Content-Type": "application/json",
          "x-device": this.webDeviceAgent()
        },
        body: body === void 0 ? void 0 : JSON.stringify(body),
        throw: false
      });
      if (response.status < 200 || response.status >= 300) return null;
      return JSON.parse(response.text || "{}");
    } catch {
      return null;
    }
  }
  async webOpenTasks() {
    const document = await this.webRequest("batch/check/0");
    if (!document) return null;
    const profiles = Array.isArray(document.projectProfiles) ? document.projectProfiles : [];
    const projectNames = new Map(profiles.map((project) => [String(project.id ?? ""), String(project.name ?? "")]));
    const updates = Array.isArray(document.syncTaskBean?.update) ? document.syncTaskBean.update : [];
    return updates.filter((task) => Boolean(task?.id) && Number(task.status ?? 0) === 0).map((task) => ({
      ...task,
      projectName: String(task.projectName ?? projectNames.get(String(task.projectId ?? "")) ?? "\u0648\u0631\u0648\u062F\u06CC")
    }));
  }
  async tasksForDay(day) {
    if (this.hasCache()) return this.cachedTasksForDay(day);
    const webTasks = await this.webOpenTasks();
    if (webTasks !== null) return webTasks.filter((task) => isScheduledForDay(task, day));
    return this.client().tasksForDay(day);
  }
  async recurringTasks() {
    if (this.hasCache()) return this.cache.tasks.filter((task) => Boolean(task.repeatFlag) || recurringTaskKind(task) !== "other").sort((left, right) => String(left.dueDate ?? "9999-12-31").localeCompare(String(right.dueDate ?? "9999-12-31")) || String(left.title ?? "").localeCompare(String(right.title ?? ""), "fa"));
    const webTasks = await this.webOpenTasks();
    if (webTasks !== null) return webTasks.filter((task) => Boolean(task.repeatFlag) || recurringTaskKind(task) !== "other").sort((left, right) => String(left.dueDate ?? "9999-12-31").localeCompare(String(right.dueDate ?? "9999-12-31")) || String(left.title ?? "").localeCompare(String(right.title ?? ""), "fa"));
    return (await this.client().listOpenTasks()).filter((task) => Boolean(task.repeatFlag) || recurringTaskKind(task) !== "other").sort((left, right) => String(left.dueDate ?? "9999-12-31").localeCompare(String(right.dueDate ?? "9999-12-31")) || String(left.title ?? "").localeCompare(String(right.title ?? ""), "fa"));
  }
  async openTodayView() {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE, active: true });
  }
  async openHabitView() {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: HABIT_VIEW_TYPE, active: true });
  }
  async openPlannerView() {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: PLANNER_VIEW_TYPE, active: true });
  }
  async openProjectBoardView() {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: PROJECT_BOARD_VIEW_TYPE, active: true });
  }
  async openControlPage(screen) {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: CONTROL_VIEW_TYPE, active: true, state: { screen } });
  }
  async renderTodayBlock(element, dayOverride) {
    element.replaceChildren();
    const root = element.createDiv({ cls: "daily-tasks-output ticktick-task-grid" });
    try {
      const client = this.client();
      const day = dayOverride ?? todayInZone(this.settings.timeZone);
      const toolbar = root.createDiv({ cls: "daily-task-toolbar" });
      const addButton = toolbar.createEl("button", { text: "+ \u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9", cls: "daily-task-add" });
      addButton.addEventListener("click", async () => {
        addButton.disabled = true;
        try {
          const projects = await client.listProjects();
          const draft = await openTaskEditor(this.app, projects, { dueDate: day });
          if (!draft) return;
          await this.createTask(toTaskPayload(draft, this.settings.timeZone));
          new import_obsidian20.Notice("\u062A\u0633\u06A9 \u0628\u0647 TickTick \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.");
          await this.renderTodayBlock(element, dayOverride);
        } catch (error) {
          new import_obsidian20.Notice(error instanceof Error ? error.message : "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
        } finally {
          addButton.disabled = false;
        }
      });
      const tasks = await this.tasksForDay(day);
      if (!tasks.length) {
        root.createDiv({ cls: "daily-task-empty", text: "\u062A\u0633\u06A9\u06CC \u0628\u0631\u0627\u06CC \u0627\u0645\u0631\u0648\u0632 \u06CC\u0627 \u0642\u0628\u0644 \u0627\u0632 \u0622\u0646 \u0646\u06CC\u0633\u062A." });
        return;
      }
      const cards = root.createDiv({ cls: "ticktick-task-cards" });
      for (const task of tasks) {
        const title = cleanTaskTitle(task.title);
        const row = cards.createDiv({ cls: "daily-task-row ticktick-task-card" });
        row.dataset.taskId = String(task.id);
        const check = row.createEl("input", { cls: "daily-task-checkbox", type: "checkbox", attr: { "aria-label": `\u0627\u0646\u062C\u0627\u0645 ${title}` } });
        const body = row.createDiv({ cls: "daily-task-main" });
        body.createSpan({ cls: "daily-task-title", text: title });
        appendChecklistSummary(body, task, this.settings.experimentalChecklistReadOnly);
        const description = body.createDiv({ cls: "daily-task-description is-hidden" });
        await import_obsidian20.MarkdownRenderer.renderMarkdown(cleanTaskDescription(task.desc || task.content) || "\u062A\u0648\u0636\u06CC\u062D\u06CC \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u062A\u0633\u06A9 \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.", description, "", this);
        const due = toDateKey(task.dueDate, task.timeZone || this.settings.timeZone) ?? "";
        const start = toDateKey(task.startDate, task.timeZone || this.settings.timeZone) ?? "";
        row.createSpan({ cls: `daily-task-date${due && due < day ? " is-overdue" : ""}`, text: formatTaskSchedule(start, due, day) });
        const actions = row.createDiv({ cls: "daily-task-actions" });
        const descriptionButton = actions.createEl("button", { cls: "daily-task-action mod-icon", attr: { "aria-label": "\u062A\u0648\u0636\u06CC\u062D\u0627\u062A" } });
        (0, import_obsidian20.setIcon)(descriptionButton, "file-text");
        const edit = actions.createEl("button", { cls: "daily-task-action mod-icon", attr: { "aria-label": "\u0648\u06CC\u0631\u0627\u06CC\u0634" } });
        (0, import_obsidian20.setIcon)(edit, "pencil");
        const remove = actions.createEl("button", { cls: "daily-task-action is-danger mod-icon", attr: { "aria-label": "\u062D\u0630\u0641" } });
        (0, import_obsidian20.setIcon)(remove, "trash-2");
        descriptionButton.addEventListener("click", () => {
          const hidden = description.hasClass("is-hidden");
          description.toggleClass("is-hidden", !hidden);
        });
        check.addEventListener("change", async () => {
          check.disabled = true;
          row.addClass("is-completed");
          try {
            await this.completeTask(task, element);
            new import_obsidian20.Notice("\u0646\u0648\u0628\u062A \u062A\u0633\u06A9 \u062F\u0631 TickTick \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F.");
            row.addClass("is-leaving");
            setTimeout(() => {
              row.remove();
              if (!cards.querySelectorAll(".daily-task-row:not(.is-leaving)").length) {
                cards.remove();
                root.createDiv({ cls: "daily-task-empty", text: "\u062A\u0633\u06A9\u06CC \u0628\u0631\u0627\u06CC \u0627\u0645\u0631\u0648\u0632 \u06CC\u0627 \u0642\u0628\u0644 \u0627\u0632 \u0622\u0646 \u0646\u06CC\u0633\u062A." });
              }
              if (this.taskBlocks.has(element)) {
                this.taskBlockSignatures.set(element, this.taskBlockSignature(dayOverride));
              }
            }, 220);
          } catch (error) {
            row.removeClass("is-completed");
            check.checked = false;
            check.disabled = false;
            new import_obsidian20.Notice(error instanceof Error ? error.message : "\u062A\u06A9\u0645\u06CC\u0644 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
        edit.addEventListener("click", async () => {
          try {
            const projects = await client.listProjects();
            const draft = await openTaskEditor(this.app, projects, task);
            if (!draft) return;
            await this.updateTask(toTaskPayload({ ...task, ...draft }, this.settings.timeZone));
            new import_obsidian20.Notice("\u062A\u0633\u06A9 \u062F\u0631 TickTick \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u062F.");
            await this.renderTodayBlock(element, dayOverride);
          } catch (error) {
            new import_obsidian20.Notice(error instanceof Error ? error.message : "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
        remove.addEventListener("click", async () => {
          if (!await confirmDelete(this.app, title)) return;
          row.addClass("is-leaving");
          try {
            await this.deleteTask(task, element);
            new import_obsidian20.Notice("\u062A\u0633\u06A9 \u0627\u0632 TickTick \u062D\u0630\u0641 \u0634\u062F.");
            setTimeout(() => {
              row.remove();
              if (!cards.querySelectorAll(".daily-task-row:not(.is-leaving)").length) {
                cards.remove();
                root.createDiv({ cls: "daily-task-empty", text: "\u062A\u0633\u06A9\u06CC \u0628\u0631\u0627\u06CC \u0627\u0645\u0631\u0648\u0632 \u06CC\u0627 \u0642\u0628\u0644 \u0627\u0632 \u0622\u0646 \u0646\u06CC\u0633\u062A." });
              }
              if (this.taskBlocks.has(element)) {
                this.taskBlockSignatures.set(element, this.taskBlockSignature(dayOverride));
              }
            }, 220);
          } catch (error) {
            row.removeClass("is-leaving");
            new import_obsidian20.Notice(error instanceof Error ? error.message : "\u062D\u0630\u0641 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
      }
    } catch (error) {
      root.createEl("p", { text: error instanceof Error ? error.message : "\u0627\u062A\u0635\u0627\u0644 TickTick \u0622\u0645\u0627\u062F\u0647 \u0646\u06CC\u0633\u062A." });
    } finally {
      if (this.taskBlocks.has(element)) this.taskBlockSignatures.set(element, this.taskBlockSignature(dayOverride));
    }
  }
  async renderHabitBlock(element, dashboard = false, dayOverride) {
    element.replaceChildren();
    this.habitCheckinCache.clear();
    const today = todayInZone(this.settings.timeZone);
    const state = dashboard ? this.dashboardStates.get(element) ?? { day: dayOverride ?? today, mode: "day" } : null;
    if (dashboard) this.dashboardStates.set(element, state);
    const root = element.createDiv({ cls: dashboard ? `daily-habit-list ticktick-dashboard-habits ticktick-dashboard-mode-${state.mode}` : "daily-habit-list" });
    try {
      const client = this.client();
      const day = state?.day ?? dayOverride ?? today;
      const historyDays = state?.mode === "week" ? 7 : state?.mode === "month" ? 30 : state?.mode === "stats" ? 28 : 1;
      let habits = this.hasCache() ? dashboard ? this.cachedHabitsWithHistory(day, historyDays) : this.cachedHabitsForDay(day) : dashboard ? await client.habitsWithHistory(day, historyDays) : await client.habitsForDay(day);
      const webCheckins = this.hasCache() ? null : await this.webHabitCheckins(habits.map((habit) => habit.id), day, historyDays);
      if (webCheckins) habits = habits.map((habit) => {
        const entries = webCheckins.get(habit.id) ?? [];
        const checkin = entries.find((entry) => entry.stamp === Number(day.replaceAll("-", ""))) ?? habit.checkin;
        const goal = Math.max(1, Number(habit.goal ?? 1));
        const history = habit.history?.map((entry) => {
          const recorded = entries.find((item) => item.stamp === Number(entry.date.replaceAll("-", "")));
          if (!recorded) return entry;
          const value = Number(recorded.value ?? 0);
          return { ...entry, value, completed: recorded.status === 2 || value >= goal };
        });
        return { ...habit, checkin, ...history ? { history } : {} };
      });
      if (dashboard && state?.mode === "day") habits = habits.filter((habit) => habit.history?.some((entry) => entry.date === day));
      if (dashboard) {
        const controls = root.createDiv({ cls: "ticktick-dashboard-controls" });
        const tabs = controls.createDiv({ cls: "ticktick-dashboard-tabs" });
        const modes = [["day", "\u0631\u0648\u0632"], ["week", "\u0647\u0641\u062A\u0647"], ["month", "\u0645\u0627\u0647"]];
        for (const [mode, label] of modes) {
          const button = tabs.createEl("button", { text: label, cls: mode === state.mode ? "is-active" : "", attr: { type: "button" } });
          button.addEventListener("click", () => {
            this.dashboardStates.set(element, { ...state, mode });
            void this.renderHabitBlock(element, true);
          });
        }
        const navigator2 = controls.createDiv({ cls: "ticktick-dashboard-date" });
        const previous = navigator2.createEl("button", { cls: "mod-icon", attr: { type: "button", "aria-label": "\u0631\u0648\u0632 \u0642\u0628\u0644", title: "\u0631\u0648\u0632 \u0642\u0628\u0644" } });
        (0, import_obsidian20.setIcon)(previous, "chevron-left");
        const now = navigator2.createEl("button", { text: "\u0627\u0645\u0631\u0648\u0632", attr: { type: "button" } });
        navigator2.createEl("strong", { text: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(/* @__PURE__ */ new Date(`${day}T12:00:00`)) });
        const next = navigator2.createEl("button", { cls: "mod-icon", attr: { type: "button", "aria-label": "\u0631\u0648\u0632 \u0628\u0639\u062F", title: "\u0631\u0648\u0632 \u0628\u0639\u062F" } });
        (0, import_obsidian20.setIcon)(next, "chevron-right");
        previous.addEventListener("click", () => {
          this.dashboardStates.set(element, { ...state, day: shiftIsoDay(day, -1) });
          void this.renderHabitBlock(element, true);
        });
        now.addEventListener("click", () => {
          this.dashboardStates.set(element, { ...state, day: today });
          void this.renderHabitBlock(element, true);
        });
        next.addEventListener("click", () => {
          this.dashboardStates.set(element, { ...state, day: shiftIsoDay(day, 1) });
          void this.renderHabitBlock(element, true);
        });
      }
      if (!habits.length) {
        root.createDiv({ cls: "daily-habit-empty", text: "\u0639\u0627\u062F\u062A\u06CC \u0628\u0631\u0627\u06CC \u0627\u0645\u0631\u0648\u0632 \u062F\u0631 TickTick \u0646\u06CC\u0633\u062A." });
        return;
      }
      if (dashboard) habits.sort((left, right) => habitDashboardGroup(left).localeCompare(habitDashboardGroup(right), "fa") || habitDashboardSection(left).localeCompare(habitDashboardSection(right), "fa"));
      const cards = dashboard ? null : root.createDiv({ cls: "daily-habit-cards" });
      const dashboardGroups = /* @__PURE__ */ new Map();
      for (const habit of habits) {
        let cardHost = cards;
        if (dashboard) {
          const group = habitDashboardGroup(habit);
          cardHost = dashboardGroups.get(group) ?? null;
          if (!cardHost) {
            const groupShell = root.createDiv({ cls: "ticktick-dashboard-group" });
            const groupTitle = groupShell.createDiv({ cls: "ticktick-dashboard-group-title" });
            groupTitle.createSpan({ text: habitDashboardGroupLabel(group) });
            groupTitle.createSpan({ text: "\u2022" });
            cardHost = groupShell.createDiv({ cls: "ticktick-dashboard-cards" });
            dashboardGroups.set(group, cardHost);
          }
        }
        const streak = habitStreak(habit.history ?? []);
        const historyComplete = (habit.history ?? []).filter((entry) => entry.completed).length;
        const showHistoryDots = Boolean(dashboard && state?.mode !== "day" && habit.history?.length);
        renderUnifiedHabitCard(cardHost, {
          habit,
          day,
          variant: dashboard ? "dashboard" : "board",
          streak,
          historyComplete,
          historyTotal: habit.history?.length ?? 0,
          showHistoryDots,
          onCheckIn: async (h, d) => {
            const goal = Math.max(1, Number(h.checkin?.goal ?? h.goal ?? h.target ?? 1));
            const currentValue = Number(h.checkin?.value ?? 0);
            const completed = h.checkin?.status === 2 || currentValue >= goal;
            const step = Math.max(1, Number(h.step ?? 1));
            const nextValue = completed ? 0 : Math.min(goal, currentValue + step);
            const nextStatus = completed ? 0 : nextValue >= goal ? 2 : void 0;
            await this.checkInHabit(h.id, d, {
              value: nextValue,
              goal,
              status: nextStatus
            });
            new import_obsidian20.Notice(completed ? "\u062B\u0628\u062A \u0627\u0645\u0631\u0648\u0632 \u0639\u0627\u062F\u062A \u062F\u0631 TickTick \u0628\u0631\u062F\u0627\u0634\u062A\u0647 \u0634\u062F." : nextStatus === 2 ? "\u0639\u0627\u062F\u062A \u062F\u0631 TickTick \u06A9\u0627\u0645\u0644 \u0634\u062F." : `\u06CC\u06A9 \u0645\u0631\u062D\u0644\u0647 \u062B\u0628\u062A \u0634\u062F: ${nextValue}/${goal}`);
            await this.renderHabitBlock(element, dashboard, dayOverride);
          },
          onOpenDetails: (h, d) => {
            new HabitDetailsModal(this.app, h, {
              firstWeekday: 6,
              habits: (dayKey) => this.cachedHabitsForDay(dayKey),
              habitHistory: (habitId, from, to) => this.cachedHabitHistoryRange(habitId, from, to),
              setHabitProgress: async (habitItem, dayKey, val, goalVal) => {
                await this.checkInHabit(String(habitItem.id), dayKey, { value: Math.max(0, val), goal: Math.max(1, goalVal), status: val >= goalVal ? 2 : void 0 });
                await this.renderHabitBlock(element, dashboard, dayOverride);
              }
            }, d).open();
          }
        });
      }
    } catch (error) {
      root.createEl("p", { text: error instanceof Error ? error.message : "\u0627\u062A\u0635\u0627\u0644 TickTick \u0622\u0645\u0627\u062F\u0647 \u0646\u06CC\u0633\u062A." });
    } finally {
      const context = this.habitBlocks.get(element);
      if (context) this.habitBlockSignatures.set(element, this.habitBlockSignature(element, context));
    }
  }
  async renderRecurringBlock(element) {
    element.replaceChildren();
    const root = element.createDiv({ cls: "ticktick-recurring-board" });
    try {
      const tasks = (await this.recurringTasks()).filter((task) => Boolean(
        toDateKey(task.startDate, task.timeZone || this.settings.timeZone) || toDateKey(task.dueDate, task.timeZone || this.settings.timeZone)
      ));
      const groups = [[["daily"], "\u0631\u0648\u0632\u0627\u0646\u0647"], [["weekly"], "\u0647\u0641\u062A\u06AF\u06CC"], [["monthly"], "\u0645\u0627\u0647\u0627\u0646\u0647"], [["yearly"], "\u0633\u0627\u0644\u0627\u0646\u0647"]];
      const today = todayInZone(this.settings.timeZone);
      for (const [kinds, label] of groups) {
        const items = tasks.filter((task) => {
          const kind = recurringTaskKind(task);
          return kind !== "other" && kinds.includes(kind);
        });
        const column = root.createDiv({ cls: `ticktick-recurring-column ticktick-recurring-${kinds[0]}` });
        const heading = column.createDiv({ cls: "ticktick-recurring-column-heading" });
        heading.createSpan({ text: label });
        heading.createEl("small", { text: String(items.length) });
        if (!items.length) {
          column.createDiv({ cls: "ticktick-recurring-empty", text: "\u0645\u0648\u0631\u062F\u06CC \u0646\u062F\u0627\u0631\u062F." });
          continue;
        }
        const projectListColor = (name) => {
          const map = { "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC": "#3b82f6", "\u0634\u062E\u0635\u06CC": "#10b981", "\u0645\u062F\u06CC\u0631\u06CC\u062A \u0645\u0627\u0644\u06CC": "#f59e0b", "\u0641\u0631\u0648\u0634\u06AF\u0627\u0647": "#8b5cf6", "\u062A\u0648\u0633\u0646\u200C\u062A\u06A9\u0646\u06CC\u0648": "#0ea5e9" };
          return map[name] || "var(--interactive-accent)";
        };
        for (const task of items) {
          const card = column.createEl("button", { cls: "ticktick-recurring-card", attr: { type: "button", "aria-label": `\u0648\u06CC\u0631\u0627\u06CC\u0634 ${cleanTaskTitle(task.title)}` } });
          card.style.setProperty("--card-tone", projectListColor(task.projectName ?? ""));
          card.createDiv({ cls: "ticktick-recurring-title", text: cleanTaskTitle(task.title) });
          const meta = card.createDiv({ cls: "ticktick-recurring-meta" });
          meta.createDiv({ cls: "ticktick-recurring-project", text: task.projectName ?? "\u0628\u062F\u0648\u0646 \u0644\u06CC\u0633\u062A" });
          const due = toDateKey(task.dueDate, task.timeZone || this.settings.timeZone);
          const start = toDateKey(task.startDate, task.timeZone || this.settings.timeZone);
          const repeatDays = parseRecurringDays(task.repeatFlag, due || start || "");
          if (repeatDays) meta.createDiv({ cls: "ticktick-recurring-days", text: repeatDays });
          const dateStr = formatRecurringTaskSchedule(start || "", due || "", today);
          meta.createDiv({ cls: "ticktick-recurring-date", text: dateStr ? `\u0646\u0648\u0628\u062A \u0628\u0639\u062F\u06CC: ${dateStr}` : "\u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E" });
          card.addEventListener("click", async () => {
            card.disabled = true;
            try {
              const projects = await this.client().listProjects();
              const draft = await openTaskEditor(this.app, projects, task);
              if (!draft) return;
              await this.updateTask(toTaskPayload({ ...task, ...draft }, this.settings.timeZone));
              new import_obsidian20.Notice("\u062A\u0633\u06A9 \u062A\u06A9\u0631\u0627\u0631\u0634\u0648\u0646\u062F\u0647 \u062F\u0631 TickTick \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u062F.");
              await this.renderRecurringBlock(element);
            } catch (error) {
              new import_obsidian20.Notice(error instanceof Error ? error.message : "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
            } finally {
              card.disabled = false;
            }
          });
        }
      }
    } catch (error) {
      root.createEl("p", { text: error instanceof Error ? error.message : "\u0627\u062A\u0635\u0627\u0644 TickTick \u0622\u0645\u0627\u062F\u0647 \u0646\u06CC\u0633\u062A." });
    }
  }
};
