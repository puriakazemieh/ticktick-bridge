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
  boardColumns: () => boardColumns,
  normalizeProjectData: () => normalizeProjectData,
  sidebarTree: () => sidebarTree
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
function boardColumns(data, showCompleted = false) {
  const columns = data.columns.length ? data.columns : [{ id: "", name: "Tasks", synthetic: true, sortOrder: 0 }];
  return columns.map((column) => {
    const matching = data.tasks.filter((task) => String(task.columnId ?? "") === String(column.id) && (showCompleted || Number(task.status ?? 0) === 0));
    const groups = ["High", "Medium", "Low", "No priority", ...showCompleted ? ["Completed"] : []].map((name) => ({ name, tasks: matching.filter((task) => Number(task.status ?? 0) !== 0 ? name === "Completed" : groupName(task.priority) === name).sort((a, b) => Number(a.sortOrder ?? a.order ?? 0) - Number(b.sortOrder ?? b.order ?? 0) || String(a.title).localeCompare(String(b.title), "fa")) })).filter((group) => group.tasks.length);
    return { ...column, count: matching.length, groups };
  });
}
var groupName;
var init_project_board = __esm({
  "src/core/project-board.js"() {
    "use strict";
    groupName = (priority) => ({ 5: "High", 3: "Medium", 1: "Low" })[Number(priority)] ?? "No priority";
  }
});

// src/obsidian/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => TickTickBridgePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian8 = require("obsidian");

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
  constructor(message, { status, body } = {}) {
    super(message);
    this.name = "TickTickApiError";
    this.status = status;
    this.body = body;
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
      throw new TickTickApiError("TickTick request failed.", { status: response.status, body: parsed });
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
  async writeJson(path, value) {
    path = this.managedPath(path);
    await this.ensure(path.split("/").slice(0, -1).join("/"));
    const serialized = JSON.stringify(publicManagedMetadata(value));
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

// src/obsidian/planning-calendar.ts
var import_obsidian4 = require("obsidian");

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
function taskDay(task, timeZone) {
  return toDateKey(task.dueDate, task.timeZone || timeZone) ?? toDateKey(task.startDate, task.timeZone || timeZone);
}
function taskTime(task) {
  return String(task.startDate ?? task.dueDate ?? "").match(/T(\d{2}:\d{2})/)?.[1] ?? "";
}
function sortPlanningTasks(tasks) {
  return [...tasks].sort((left, right) => Number(left.sortOrder ?? left.order ?? 0) - Number(right.sortOrder ?? right.order ?? 0) || taskTime(left).localeCompare(taskTime(right)) || Number(right.priority ?? 0) - Number(left.priority ?? 0) || String(left.title ?? "").localeCompare(String(right.title ?? ""), "fa"));
}
function planningBuckets(tasks, day, timeZone = "Asia/Tehran", showCompleted = false) {
  const result = { allDay: [], timed: [], overdue: [], recurring: [], completed: [], unscheduled: [] };
  for (const task of tasks ?? []) {
    const completed = Number(task.status ?? 0) !== 0;
    if (completed) {
      if (showCompleted) result.completed.push(task);
      continue;
    }
    const key = taskDay(task, timeZone);
    if (!key) {
      result.unscheduled.push(task);
      continue;
    }
    if (task.repeatFlag) result.recurring.push(task);
    if (key < day) result.overdue.push(task);
    else if (String(task.startDate ?? task.dueDate ?? "").includes("T") && !Boolean(task.isAllDay)) result.timed.push(task);
    else result.allDay.push(task);
  }
  for (const key of Object.keys(result)) result[key] = sortPlanningTasks(result[key]);
  return result;
}
function tasksForCalendarDay(tasks, day, timeZone = "Asia/Tehran", showCompleted = false) {
  const buckets = planningBuckets(tasks, day, timeZone, showCompleted);
  return [...sortPlanningTasks(buckets.allDay.filter((task) => taskDay(task, timeZone) === day)), ...sortPlanningTasks(buckets.timed.filter((task) => taskDay(task, timeZone) === day)), ...sortPlanningTasks(buckets.overdue)];
}

// src/obsidian/task-details-modal.ts
var import_obsidian3 = require("obsidian");

// src/core/checklist.js
function normalizeChecklist(items) {
  return (Array.isArray(items) ? items : []).map((item, index) => ({ id: item?.id ? String(item.id) : null, title: String(item?.title ?? item?.content ?? "").trim(), completed: item?.completed !== void 0 ? Boolean(item.completed) : Number(item?.status ?? 0) !== 0, sortOrder: Number(item?.sortOrder ?? index), unknown: Object.fromEntries(Object.entries(item ?? {}).filter(([key]) => !["id", "title", "content", "status", "sortOrder", "completed", "completedTime", "startDate", "dueDate", "isAllDay", "timeZone"].includes(key))) })).sort((a, b) => a.sortOrder - b.sortOrder);
}
function checklistSummary(items) {
  const normalized = normalizeChecklist(items);
  return { total: normalized.length, completed: normalized.filter((item) => item.completed).length };
}

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

// src/obsidian/task-details-modal.ts
var TaskDetailsModal = class extends import_obsidian3.Modal {
  constructor(app, task, actions = {}) {
    super(app);
    this.task = task;
    this.actions = actions;
  }
  onOpen() {
    this.modalEl.addClass("ticktick-task-details-modal");
    void this.loadAndRender();
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
    for (const value of [this.task.projectName, this.task.dueDate ? `\u{1F4C5} ${String(this.task.dueDate).slice(0, 10)}` : "\u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E", `${priority.icon} \u0627\u0648\u0644\u0648\u06CC\u062A ${priority.label}`, this.task.repeatFlag ? "\u{1F501} \u062A\u06A9\u0631\u0627\u0631" : ""]) if (value) meta.createSpan({ text: String(value) });
    const description = taskDescription(this.task);
    const descriptionBox = this.contentEl.createDiv({ cls: "ticktick-task-details-description" });
    descriptionBox.createEl("strong", { text: "\u062A\u0648\u0636\u06CC\u062D\u0627\u062A" });
    descriptionBox.createDiv({ text: description || "\u062A\u0648\u0636\u06CC\u062D\u06CC \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u062A\u0633\u06A9 \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A." });
    const items = normalizeChecklist(this.task.items);
    if (items.length) {
      const box = this.contentEl.createDiv({ cls: "ticktick-task-details-checklist" });
      const summary = checklistSummary(items);
      box.createEl("strong", { text: `Checklist \xB7 ${summary.completed}/${summary.total}` });
      for (const item of items) box.createDiv({ text: `${item.completed ? "\u2611" : "\u2610"} ${item.title}` });
    }
    const tags = this.task.tags ?? [];
    if (tags.length) this.contentEl.createDiv({ cls: "ticktick-task-details-tags", text: tags.map((tag) => `#${tag}`).join("  ") });
    const actions = this.contentEl.createDiv({ cls: "ticktick-task-details-actions" });
    if (this.actions.edit) {
      const edit = actions.createEl("button", { text: "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u06A9\u0627\u0645\u0644", cls: "mod-cta" });
      edit.addEventListener("click", async () => {
        edit.disabled = true;
        try {
          const updated = await this.actions.edit(this.task);
          if (!updated) {
            edit.disabled = false;
            return;
          }
          if (updated.id) this.task = { ...this.task, ...updated };
          await this.actions.changed?.();
          new import_obsidian3.Notice("\u062A\u063A\u06CC\u06CC\u0631\u0627\u062A \u062F\u0631 TickTick \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.");
          await this.loadAndRender();
        } catch (error) {
          edit.disabled = false;
          new import_obsidian3.Notice(error instanceof Error ? error.message : "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
        }
      });
    }
    if (this.actions.complete && Number(this.task.status ?? 0) === 0) {
      const button = actions.createEl("button", { text: "\u062A\u06A9\u0645\u06CC\u0644 \u062A\u0633\u06A9" });
      button.addEventListener("click", async () => {
        button.disabled = true;
        try {
          await this.actions.complete();
          await this.actions.changed?.();
          new import_obsidian3.Notice("\u062A\u0633\u06A9 \u062A\u06A9\u0645\u06CC\u0644 \u0648 \u0647\u0645\u06AF\u0627\u0645 \u0634\u062F.");
          this.close();
        } catch (error) {
          button.disabled = false;
          new import_obsidian3.Notice(error instanceof Error ? error.message : "\u062A\u06A9\u0645\u06CC\u0644 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
        }
      });
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/obsidian/planning-calendar.ts
var RescheduleModal = class extends import_obsidian4.Modal {
  constructor(app, task, target) {
    super(app);
    this.task = task;
    this.target = target;
  }
  resolveAnswer;
  openAndWait() {
    this.open();
    return new Promise((resolve) => {
      this.resolveAnswer = resolve;
    });
  }
  onOpen() {
    this.titleEl.setText("\u062A\u0623\u06CC\u06CC\u062F \u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u062A\u0633\u06A9");
    this.contentEl.createEl("p", { text: `\xAB${this.task.title}\xBB \u0628\u0647 ${this.target} \u0645\u0646\u062A\u0642\u0644 \u0634\u0648\u062F\u061F` });
    if (this.task.repeatFlag) this.contentEl.createEl("p", { cls: "mod-warning", text: "\u062A\u0633\u06A9 \u062A\u06A9\u0631\u0627\u0631\u0634\u0648\u0646\u062F\u0647 \u0627\u0633\u062A\u061B occurrence \u062C\u062F\u06CC\u062F \u0645\u062D\u0644\u06CC \u0633\u0627\u062E\u062A\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F." });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "\u0644\u063A\u0648" }).addEventListener("click", () => {
      this.resolveAnswer(false);
      this.close();
    });
    actions.createEl("button", { text: "\u0627\u0646\u062A\u0642\u0627\u0644", cls: "mod-cta" }).addEventListener("click", () => {
      this.resolveAnswer(true);
      this.close();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var TaskOverflowModal = class extends import_obsidian4.Modal {
  constructor(app, tasks, complete, load, edit, changed) {
    super(app);
    this.tasks = tasks;
    this.complete = complete;
    this.load = load;
    this.edit = edit;
    this.changed = changed;
  }
  onOpen() {
    this.titleEl.setText("\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u06CC\u0646 \u0631\u0648\u0632");
    for (const task of this.tasks) {
      const row = this.contentEl.createDiv({ cls: "ticktick-overflow-task" });
      const check = row.createEl("input", { type: "checkbox", attr: { "aria-label": `\u062A\u06A9\u0645\u06CC\u0644 ${task.title}` } });
      check.checked = Number(task.status ?? 0) !== 0;
      check.disabled = check.checked;
      const button = row.createEl("button", { text: String(task.title ?? "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646"), attr: { type: "button", "aria-label": `\u062C\u0632\u0626\u06CC\u0627\u062A ${task.title}` } });
      button.addEventListener("click", () => new TaskDetailsModal(this.app, task, { complete: () => this.complete(task), load: this.load, edit: this.edit, changed: this.changed }).open());
      check.addEventListener("change", async () => {
        check.disabled = true;
        try {
          await this.complete(task);
          task.status = 2;
          await this.changed();
          new import_obsidian4.Notice("\u062A\u0633\u06A9 \u062A\u06A9\u0645\u06CC\u0644 \u0648 \u0647\u0645\u06AF\u0627\u0645 \u0634\u062F.");
        } catch (error) {
          check.checked = false;
          check.disabled = false;
          new import_obsidian4.Notice(error instanceof Error ? error.message : "\u062A\u06A9\u0645\u06CC\u0644 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
        }
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
  }
  mode = "week";
  day;
  project = "";
  tag = "";
  async render() {
    this.element.empty();
    this.element.addClass("ticktick-planner");
    const root = this.element.createDiv({ cls: "ticktick-planner-root" });
    const controls = root.createDiv({ cls: "ticktick-planner-controls" });
    for (const [mode, label] of [["day", "\u0631\u0648\u0632"], ["week", "\u0647\u0641\u062A\u0647"], ["month", "\u0645\u0627\u0647"]]) {
      const button = controls.createEl("button", { text: label, cls: this.mode === mode ? "is-active" : "" });
      button.addEventListener("click", () => {
        this.mode = mode;
        void this.render();
      });
    }
    const nav = controls.createDiv({ cls: "ticktick-planner-nav" });
    const step = this.mode === "month" ? 28 : this.mode === "week" ? 7 : 1;
    const previous = nav.createEl("button", { text: "\u2039", attr: { "aria-label": "\u0642\u0628\u0644\u06CC" } });
    previous.addEventListener("click", () => {
      this.day = shiftCalendarDay(this.day, -step);
      void this.render();
    });
    const today = nav.createEl("button", { text: "\u0627\u0645\u0631\u0648\u0632" });
    today.addEventListener("click", () => {
      this.day = todayInZone(this.host.timeZone);
      void this.render();
    });
    nav.createEl("span", { text: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" }).format(/* @__PURE__ */ new Date(`${this.day}T12:00:00Z`)) });
    const next = nav.createEl("button", { text: "\u203A", attr: { "aria-label": "\u0628\u0639\u062F\u06CC" } });
    next.addEventListener("click", () => {
      this.day = shiftCalendarDay(this.day, step);
      void this.render();
    });
    const add = controls.createEl("button", { text: "+ \u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9" });
    add.addEventListener("click", () => void this.addTask(this.day));
    const refresh = controls.createEl("button", { text: "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC" });
    refresh.addEventListener("click", async () => {
      refresh.disabled = true;
      try {
        await this.host.refresh();
        await this.render();
      } catch (error) {
        new import_obsidian4.Notice(error instanceof Error ? error.message : "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      }
    });
    this.renderFilters(root);
    const tasks = this.filteredTasks();
    if (!tasks.length) root.createDiv({ cls: "ticktick-planner-empty", text: "\u062A\u0633\u06A9\u06CC \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u0641\u06CC\u0644\u062A\u0631 \u0646\u06CC\u0633\u062A\u061B \u0627\u0632 \u062F\u06A9\u0645\u0647\u0654 \xAB\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9\xBB \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u06A9\u0646." });
    if (this.mode === "month") this.renderMonth(root, tasks);
    else this.renderDays(root, this.mode === "week" ? weekRange(this.day, this.host.firstWeekday) : [this.day], tasks);
  }
  renderFilters(root) {
    const filters = root.createDiv({ cls: "ticktick-planner-filters" });
    const tasks = this.host.tasks();
    const projects = [...new Set(tasks.map((task) => String(task.projectName ?? task.projectId ?? "\u0648\u0631\u0648\u062F\u06CC")))];
    for (const project of ["", ...projects]) {
      const button = filters.createEl("button", { text: project || "\u0647\u0645\u0647\u0654 \u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627", cls: this.project === project ? "is-active" : "" });
      button.addEventListener("click", () => {
        this.project = project;
        void this.render();
      });
    }
    const tags = [...new Set(tasks.flatMap((task) => task.tags ?? []))].slice(0, 12);
    for (const tag of tags) {
      const button = filters.createEl("button", { text: `#${tag}`, cls: this.tag === tag ? "is-active" : "" });
      button.addEventListener("click", () => {
        this.tag = this.tag === tag ? "" : tag;
        void this.render();
      });
    }
  }
  filteredTasks() {
    return this.host.tasks().filter((task) => (!this.project || String(task.projectName ?? task.projectId ?? "\u0648\u0631\u0648\u062F\u06CC") === this.project) && (!this.tag || (task.tags ?? []).includes(this.tag)));
  }
  renderDays(root, days, tasks) {
    const grid = root.createDiv({ cls: `ticktick-planner-days ticktick-planner-days-${days.length}` });
    for (const day of days) {
      const column = grid.createDiv({ cls: "ticktick-planner-day", attr: { "data-day": day } });
      column.createEl("strong", { text: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", month: "numeric", day: "numeric" }).format(/* @__PURE__ */ new Date(`${day}T12:00:00Z`)) });
      const items = tasksForCalendarDay(tasks, day, this.host.timeZone, this.host.showCompleted);
      column.createSpan({ cls: "ticktick-planner-counter", text: `${items.length} \u062A\u0633\u06A9` });
      const add = column.createEl("button", { cls: "ticktick-planner-add", text: "+ \u0627\u0641\u0632\u0648\u062F\u0646", attr: { type: "button", "aria-label": `\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u062F\u0631 ${day}` } });
      add.addEventListener("click", () => void this.addTask(day));
      column.addEventListener("dragover", (event) => event.preventDefault());
      column.addEventListener("drop", (event) => {
        event.preventDefault();
        const id = event.dataTransfer?.getData("text/ticktick-task");
        const task = tasks.find((item) => String(item.id) === id);
        if (task) void this.dropTask(task, day);
      });
      for (const task of items) this.renderTask(column, task);
    }
  }
  renderMonth(root, tasks) {
    const grid = root.createDiv({ cls: "ticktick-planner-month" });
    for (const day of monthRange(this.day, this.host.firstWeekday)) {
      const cell = grid.createDiv({ cls: `ticktick-planner-month-cell${day.slice(0, 7) === this.day.slice(0, 7) ? "" : " is-outside"}`, attr: { "data-day": day } });
      cell.createEl("strong", { text: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric" }).format(/* @__PURE__ */ new Date(`${day}T12:00:00Z`)) });
      const items = tasksForCalendarDay(tasks, day, this.host.timeZone, this.host.showCompleted);
      cell.createSpan({ cls: "ticktick-planner-counter", text: String(items.length) });
      const add = cell.createEl("button", { cls: "ticktick-planner-add", text: "+", attr: { type: "button", "aria-label": `\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u062F\u0631 ${day}` } });
      add.addEventListener("click", () => void this.addTask(day));
      cell.addEventListener("dragover", (event) => event.preventDefault());
      cell.addEventListener("drop", (event) => {
        event.preventDefault();
        const id = event.dataTransfer?.getData("text/ticktick-task");
        const task = tasks.find((item) => String(item.id) === id);
        if (task) void this.dropTask(task, day);
      });
      for (const task of items.slice(0, 3)) this.renderTask(cell, task);
      if (items.length > 3) {
        const more = cell.createEl("button", { cls: "ticktick-planner-overflow", text: `+${items.length - 3}`, attr: { type: "button", "aria-label": "\u0646\u0645\u0627\u06CC\u0634 \u0647\u0645\u0647\u0654 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0631\u0648\u0632" } });
        more.addEventListener("click", () => new TaskOverflowModal(this.host.app, items, (task) => this.completeTask(task), (task) => this.host.load(task), (task) => this.host.edit(task), async () => {
          await this.host.refresh();
          await this.render();
        }).open());
      }
    }
  }
  renderTask(parent, task) {
    const bound = this.host.binding(task);
    const priority = taskPriority(task.priority);
    const card = parent.createDiv({ cls: `ticktick-planner-task priority-${priority.value}${bound ? " is-bound" : ""}`, attr: { title: `${bound ? "\u0628\u0631\u0627\u06CC \u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u0628\u06A9\u0634" : "\u0628\u0631\u0627\u06CC \u062F\u06CC\u062F\u0646 \u062C\u0632\u0626\u06CC\u0627\u062A \u06A9\u0644\u06CC\u06A9 \u06A9\u0646"} \xB7 \u0627\u0648\u0644\u0648\u06CC\u062A: ${priority.label}` } });
    const check = card.createEl("input", { type: "checkbox", attr: { "aria-label": `\u062A\u06A9\u0645\u06CC\u0644 ${task.title}` } });
    check.checked = Number(task.status ?? 0) !== 0;
    check.disabled = check.checked;
    const title = card.createEl("button", { text: String(task.title ?? "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646"), attr: { type: "button", "aria-label": `\u062C\u0632\u0626\u06CC\u0627\u062A ${task.title}` } });
    title.addEventListener("click", () => new TaskDetailsModal(this.host.app, task, { complete: () => this.completeTask(task), load: (item) => this.host.load(item), edit: (item) => this.host.edit(item), changed: async () => {
      await this.host.refresh();
      await this.render();
    } }).open());
    check.addEventListener("click", (event) => event.stopPropagation());
    check.addEventListener("change", () => void this.completeTask(task, check));
    card.draggable = Boolean(bound);
    card.addEventListener("dragstart", (event) => {
      if (bound) event.dataTransfer?.setData("text/ticktick-task", String(task.id));
    });
  }
  async completeTask(task, checkbox) {
    try {
      await this.host.complete(task);
      new import_obsidian4.Notice("\u062A\u0633\u06A9 \u062A\u06A9\u0645\u06CC\u0644 \u0648 \u0647\u0645\u06AF\u0627\u0645 \u0634\u062F.");
      await this.host.refresh();
      await this.render();
    } catch (error) {
      if (checkbox) {
        checkbox.checked = false;
        checkbox.disabled = false;
      }
      new import_obsidian4.Notice(error instanceof Error ? error.message : "\u062A\u06A9\u0645\u06CC\u0644 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    }
  }
  async addTask(day) {
    try {
      const created = await this.host.create({ dueDate: day });
      if (!created) return;
      new import_obsidian4.Notice("\u062A\u0633\u06A9 \u062F\u0631 TickTick \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.");
      await this.host.refresh();
      await this.render();
    } catch (error) {
      new import_obsidian4.Notice(error instanceof Error ? error.message : "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    }
  }
  async dropTask(task, target) {
    if (!this.host.binding(task)) {
      new import_obsidian4.Notice("\u0641\u0642\u0637 task\u0647\u0627\u06CC bind\u200C\u0634\u062F\u0647 \u0628\u0647 Markdown \u0642\u0627\u0628\u0644 \u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u0647\u0633\u062A\u0646\u062F.");
      return;
    }
    if (!await new RescheduleModal(this.host.app, task, target).openAndWait()) return;
    try {
      await this.host.reschedule(task, target);
      new import_obsidian4.Notice("\u062A\u0627\u0631\u06CC\u062E \u062A\u0633\u06A9 \u0628\u0627 \u062A\u0623\u06CC\u06CC\u062F \u0634\u0645\u0627 \u062A\u063A\u06CC\u06CC\u0631 \u06A9\u0631\u062F.");
      await this.host.refresh();
      await this.render();
    } catch (error) {
      new import_obsidian4.Notice(error instanceof Error ? error.message : "\u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    }
  }
};

// src/obsidian/project-board.ts
var import_obsidian6 = require("obsidian");
init_project_board();

// src/obsidian/project-editor-modal.ts
var import_obsidian5 = require("obsidian");
var ProjectEditorModal = class extends import_obsidian5.Modal {
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
    new import_obsidian5.Setting(this.contentEl).setName("\u0646\u0627\u0645 \u0644\u06CC\u0633\u062A").addText((input) => {
      input.setValue(name).onChange((value) => name = value);
      input.inputEl.dir = "rtl";
      input.inputEl.focus();
    });
    new import_obsidian5.Setting(this.contentEl).setName("\u0631\u0646\u06AF").setDesc("\u06A9\u062F \u0631\u0646\u06AF \u0645\u0627\u0646\u0646\u062F #4772fa").addText((input) => {
      input.setValue(color).onChange((value) => color = value.trim());
      input.inputEl.dir = "ltr";
    });
    new import_obsidian5.Setting(this.contentEl).setName("\u0646\u0645\u0627\u06CC\u0634").addDropdown((dropdown) => dropdown.addOption("list", "\u0641\u0647\u0631\u0633\u062A").addOption("kanban", "\u06A9\u0627\u0646\u0628\u0627\u0646").addOption("timeline", "Timeline").setValue(viewMode).onChange((value) => viewMode = value));
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "\u0627\u0646\u0635\u0631\u0627\u0641" }).addEventListener("click", () => this.finish(null));
    actions.createEl("button", { text: "\u0630\u062E\u06CC\u0631\u0647", cls: "mod-cta" }).addEventListener("click", () => {
      if (!name.trim()) {
        new import_obsidian5.Notice("\u0646\u0627\u0645 \u0644\u06CC\u0633\u062A \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646.");
        return;
      }
      if (color && !/^#[0-9a-f]{6}$/i.test(color)) {
        new import_obsidian5.Notice("\u0631\u0646\u06AF \u0628\u0627\u06CC\u062F \u0645\u0627\u0646\u0646\u062F #4772fa \u0628\u0627\u0634\u062F.");
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
var ProjectBoard = class {
  constructor(element, host) {
    this.element = element;
    this.host = host;
  }
  selected = "";
  collapsed = /* @__PURE__ */ new Set();
  initialized = false;
  async render() {
    if (!this.initialized) {
      const saved = this.host.preferences();
      this.selected = saved.selected;
      this.collapsed = new Set(saved.collapsed);
      this.initialized = true;
    }
    this.element.empty();
    this.element.addClass("ticktick-project-board");
    const root = this.element.createDiv({ cls: "ticktick-project-board-root" });
    try {
      const projects = await this.host.projects();
      if (!this.selected && projects[0]) this.selected = String(projects[0].id);
      const rail = root.createDiv({ cls: "ticktick-project-rail" });
      rail.createEl("strong", { text: "\u0644\u06CC\u0633\u062A\u200C\u0647\u0627" });
      const all = rail.createEl("button", { cls: !this.selected ? "is-selected" : "", text: `\u0647\u0645\u0647\u0654 \u0644\u06CC\u0633\u062A\u200C\u0647\u0627 \xB7 ${this.host.tasks().length}` });
      all.addEventListener("click", () => {
        this.selected = "";
        void this.persistAndRender();
      });
      for (const group of sidebarTree(projects, this.host.tasks())) {
        const key = group.name || "flat";
        const heading = rail.createEl("button", { cls: "ticktick-project-group", text: group.name || "\u0644\u06CC\u0633\u062A\u200C\u0647\u0627" });
        heading.addEventListener("click", () => {
          this.collapsed.has(key) ? this.collapsed.delete(key) : this.collapsed.add(key);
          void this.persistAndRender();
        });
        if (this.collapsed.has(key)) continue;
        for (const project2 of group.projects) {
          const row = rail.createEl("button", { cls: `ticktick-project-row${this.selected === String(project2.id) ? " is-selected" : ""}`, attr: { "aria-label": `${project2.name}\u060C ${project2.openCount} \u062A\u0633\u06A9 \u0628\u0627\u0632` } });
          row.createSpan({ cls: "ticktick-project-dot" }).style.setProperty("--project-color", project2.color ?? "var(--interactive-accent)");
          row.createSpan({ text: project2.name });
          row.createSpan({ cls: "ticktick-project-count", text: String(project2.openCount) });
          row.addEventListener("click", () => {
            this.selected = String(project2.id);
            void this.persistAndRender();
          });
        }
      }
      const main = root.createDiv({ cls: "ticktick-project-main" });
      const toolbar = main.createDiv({ cls: "ticktick-project-toolbar" });
      const refresh = toolbar.createEl("button", { text: "\u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC" });
      refresh.addEventListener("click", async () => {
        refresh.disabled = true;
        try {
          await this.host.refresh();
          await this.render();
        } catch (error) {
          new import_obsidian6.Notice(error instanceof Error ? error.message : "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
        }
      });
      const create = toolbar.createEl("button", { text: "+ \u0644\u06CC\u0633\u062A \u062C\u062F\u06CC\u062F" });
      create.addEventListener("click", async () => {
        const draft = await new ProjectEditorModal(this.host.app).openAndWait();
        if (!draft) return;
        create.disabled = true;
        try {
          const project2 = await this.host.createProject(draft);
          this.selected = String(project2?.id ?? "");
          await this.host.refresh();
          await this.persistAndRender();
          new import_obsidian6.Notice("\u0644\u06CC\u0633\u062A \u062F\u0631 TickTick \u0633\u0627\u062E\u062A\u0647 \u0634\u062F.");
        } catch (error) {
          new import_obsidian6.Notice(error instanceof Error ? error.message : "\u0633\u0627\u062E\u062A \u0644\u06CC\u0633\u062A \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
        } finally {
          create.disabled = false;
        }
      });
      const project = projects.find((item) => String(item.id) === this.selected);
      if (!project) {
        main.createEl("p", { text: "\u06CC\u06A9 \u0644\u06CC\u0633\u062A \u0631\u0627 \u0627\u0632 \u0646\u0648\u0627\u0631 \u06A9\u0646\u0627\u0631\u06CC \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646." });
        return;
      }
      const addTask = toolbar.createEl("button", { text: "+ \u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9", cls: "mod-cta" });
      addTask.addEventListener("click", async () => {
        addTask.disabled = true;
        try {
          const created = await this.host.createTask({ projectId: project.id });
          if (!created) return;
          await this.host.refresh();
          await this.render();
          new import_obsidian6.Notice("\u062A\u0633\u06A9 \u062F\u0631 \u0627\u06CC\u0646 \u0644\u06CC\u0633\u062A \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.");
        } catch (error) {
          new import_obsidian6.Notice(error instanceof Error ? error.message : "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
        } finally {
          addTask.disabled = false;
        }
      });
      const editProject = toolbar.createEl("button", { text: "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0644\u06CC\u0633\u062A" });
      editProject.addEventListener("click", async () => {
        const draft = await new ProjectEditorModal(this.host.app, project).openAndWait();
        if (!draft) return;
        editProject.disabled = true;
        try {
          await this.host.updateProject({ ...project, ...draft });
          await this.host.refresh();
          await this.render();
          new import_obsidian6.Notice("\u0644\u06CC\u0633\u062A \u062F\u0631 TickTick \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u062F.");
        } catch (error) {
          new import_obsidian6.Notice(error instanceof Error ? error.message : "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0644\u06CC\u0633\u062A \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
        } finally {
          editProject.disabled = false;
        }
      });
      const removeProject = toolbar.createEl("button", { text: "\u062D\u0630\u0641 \u0644\u06CC\u0633\u062A", cls: "mod-warning" });
      removeProject.addEventListener("click", async () => {
        if (!window.confirm(`\u0644\u06CC\u0633\u062A \xAB${project.name}\xBB \u0648 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0622\u0646 \u062F\u0631 TickTick \u062D\u0630\u0641 \u0634\u0648\u062F\u061F`)) return;
        removeProject.disabled = true;
        try {
          await this.host.deleteProject(String(project.id));
          this.selected = "";
          await this.host.refresh();
          await this.persistAndRender();
          new import_obsidian6.Notice("\u0644\u06CC\u0633\u062A \u0627\u0632 TickTick \u062D\u0630\u0641 \u0634\u062F.");
        } catch (error) {
          removeProject.disabled = false;
          new import_obsidian6.Notice(error instanceof Error ? error.message : "\u062D\u0630\u0641 \u0644\u06CC\u0633\u062A \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
        }
      });
      const data = await this.host.board(project);
      main.createEl("h2", { text: project.name });
      const columns = main.createDiv({ cls: "ticktick-project-columns" });
      for (const column of boardColumns(data, this.host.showCompleted())) {
        const shell = columns.createDiv({ cls: "ticktick-project-column" });
        shell.createEl("strong", { text: `${column.name} \xB7 ${column.count}` });
        shell.createEl("small", { text: column.synthetic ? "\u0633\u062A\u0648\u0646 \u0646\u0645\u0627\u06CC\u0634\u06CC\u061B \u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062A" : "\u062A\u0631\u062A\u06CC\u0628 \u0648 \u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u0633\u062A\u0648\u0646 \u062F\u0631 \u0646\u0633\u062E\u0647\u0654 \u0627\u0648\u0644 \u0641\u0642\u0637 \u062E\u0648\u0627\u0646\u062F\u0646\u06CC \u0627\u0633\u062A" });
        shell.addEventListener("dragover", (event) => event.preventDefault());
        shell.addEventListener("drop", (event) => {
          event.preventDefault();
          new import_obsidian6.Notice("\u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u0628\u06CC\u0646 \u0633\u062A\u0648\u0646\u200C\u0647\u0627 \u062A\u0627 \u062A\u0623\u06CC\u06CC\u062F \u0631\u0633\u0645\u06CC API TickTick \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062A.");
        });
        for (const group of column.groups) {
          shell.createEl("h4", { text: group.name });
          for (const task of group.tasks) this.card(shell, task);
        }
      }
    } catch (error) {
      root.createEl("p", { text: error instanceof Error ? error.message : "\u062F\u0627\u062F\u0647\u0654 \u067E\u0631\u0648\u0698\u0647 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A." });
    }
  }
  async persistAndRender() {
    await this.host.savePreferences({ selected: this.selected, collapsed: [...this.collapsed] });
    await this.render();
  }
  card(parent, task) {
    const bound = this.host.binding(task);
    const card = parent.createDiv({ cls: "ticktick-project-card", attr: { role: "button", tabindex: "0", "aria-label": `\u062C\u0632\u0626\u06CC\u0627\u062A ${task.title}` } });
    card.draggable = false;
    card.setAttribute("title", "\u0628\u0631\u0627\u06CC \u062F\u06CC\u062F\u0646 \u062C\u0632\u0626\u06CC\u0627\u062A \u06A9\u0644\u06CC\u06A9 \u06A9\u0646\u061B \u062A\u0631\u062A\u06CC\u0628 \u06A9\u0627\u0631\u062A\u200C\u0647\u0627 \u062F\u0631 \u0646\u0633\u062E\u0647\u0654 \u0627\u0648\u0644 \u0641\u0642\u0637 \u062E\u0648\u0627\u0646\u062F\u0646\u06CC \u0627\u0633\u062A");
    const top = card.createDiv({ cls: "ticktick-project-card-top" });
    const check = top.createEl("input", { type: "checkbox", attr: { "aria-label": `\u062A\u06A9\u0645\u06CC\u0644 ${task.title}` } });
    check.checked = Number(task.status ?? 0) !== 0;
    check.disabled = !bound || check.checked;
    const priority = taskPriority(task.priority);
    top.createSpan({ text: task.title });
    top.createSpan({ cls: `ticktick-project-priority ${priority.className}`, text: `${priority.icon} ${priority.label}`, attr: { title: `\u0627\u0648\u0644\u0648\u06CC\u062A: ${priority.label}` } });
    const description = taskDescription(task);
    if (description) card.createEl("small", { text: description.slice(0, 100) });
    const meta = card.createDiv({ cls: "ticktick-project-card-meta" });
    if (task.dueDate) meta.createSpan({ text: `\u{1F4C5} ${String(task.dueDate).slice(0, 10)}` });
    if (task.repeatFlag) meta.createSpan({ text: "\u{1F501} \u062A\u06A9\u0631\u0627\u0631" });
    for (const tag of task.tags ?? []) meta.createSpan({ text: `#${tag}` });
    if (bound) meta.createSpan({ text: "\u2197 Markdown" });
    const details = () => new TaskDetailsModal(this.host.app, task, { complete: async () => {
      await this.host.complete(task);
    }, load: (item) => this.host.load(item), edit: (item) => this.host.edit(item), changed: async () => {
      await this.host.refresh();
      await this.render();
    } }).open();
    card.addEventListener("click", details);
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        details();
      }
    });
    check.addEventListener("click", (event) => event.stopPropagation());
    check.addEventListener("change", async () => {
      check.disabled = true;
      try {
        await this.host.complete(task);
        new import_obsidian6.Notice("\u062A\u0633\u06A9 \u0628\u0627 \u0645\u0633\u06CC\u0631 \u0627\u0645\u0646 Markdown sync \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F.");
        await this.render();
      } catch (error) {
        check.checked = false;
        check.disabled = false;
        new import_obsidian6.Notice(error instanceof Error ? error.message : "\u062A\u06A9\u0645\u06CC\u0644 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      }
    });
  }
};

// src/core/local-habit.js
function scalar(value) {
  const text = String(value ?? "").trim();
  if (/^(true|false)$/i.test(text)) return /^true$/i.test(text);
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  return text.replace(/^['"]|['"]$/g, "");
}
function frontmatter(markdown) {
  const match = String(markdown).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { data: {}, body: String(markdown), valid: false };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const pair = line.match(/^([\w-]+):\s*(.*)$/);
    if (pair) data[pair[1]] = scalar(pair[2]);
  }
  return { data, body: String(markdown).slice(match[0].length), valid: true };
}
function historyFrom(body) {
  return [...String(body).matchAll(/^\s*-\s*\[([ xX])\]\s*(\d{4}-\d{2}-\d{2})(?:\s*[:—-]\s*(\d+))?/gm)].map((match) => ({ date: match[2], value: match[3] ? Number(match[3]) : match[1].toLowerCase() === "x" ? 1 : 0, completed: match[1].toLowerCase() === "x" }));
}
function parseLocalHabit(markdown, path) {
  const { data, body, valid } = frontmatter(markdown);
  const name = String(data.name ?? data.title ?? "").trim();
  const cadence = String(data.cadence ?? data.frequency ?? data.repeat ?? "daily").toLowerCase();
  const supported = ["daily", "weekly"].includes(cadence);
  const goal = Math.max(1, Number(data.goal ?? data.target ?? 1));
  const days = String(data.days ?? data.weekdays ?? "").split(",").map((day) => day.trim()).filter(Boolean);
  const needsMapping = !valid || !name || !supported || cadence === "weekly" && !days.length;
  return { id: `local:${path}`, sourcePath: path, source: "local", name: name || path.split("/").pop()?.replace(/\.md$/i, "") || "\u0628\u062F\u0648\u0646 \u0646\u0627\u0645", cadence, goal, unit: String(data.unit ?? ""), sectionName: String(data.section ?? data.group ?? "\u0628\u062F\u0648\u0646 \u062F\u0633\u062A\u0647"), days, exclusions: String(data.exclusions ?? "").split(",").map((value) => value.trim()).filter(Boolean), history: historyFrom(body), needsMapping, unsupported: Object.keys(data).filter((key) => !["name", "title", "cadence", "frequency", "repeat", "goal", "target", "unit", "section", "group", "days", "weekdays", "exclusions"].includes(key)) };
}

// src/obsidian/habit-migration.ts
var HabitMigration = class {
  constructor(app, storage, folder) {
    this.app = app;
    this.storage = storage;
    this.folder = folder;
  }
  async localHabits() {
    const prefix = this.folder().replace(/^\/+|\/+$/g, "");
    const files = this.app.vault.getMarkdownFiles().filter((file) => file.path.startsWith(`${prefix}/`) && !file.path.startsWith(".ticktick/"));
    return Promise.all(files.map(async (file) => parseLocalHabit(await this.app.vault.read(file), file.path)));
  }
  async preview(remoteHabits = []) {
    const habits = await this.localHabits();
    const rows = habits.map((habit) => ({ ...habit, selected: false, duplicate: remoteHabits.filter((remote) => String(remote.name ?? "").trim() === habit.name).map((remote) => remote.id), remotePayload: { name: habit.name, goal: habit.goal, unit: habit.unit, sectionName: habit.sectionName, cadence: habit.cadence }, loss: ["\u062A\u0627\u0631\u06CC\u062E\u0686\u0647\u0654 \u0645\u062D\u0644\u06CC \u0641\u0642\u0637 \u062E\u0648\u0627\u0646\u062F\u0646\u06CC \u0645\u06CC\u200C\u0645\u0627\u0646\u062F\u061B import \u062A\u0627\u0631\u06CC\u062E\u0686\u0647 \u0628\u0647 TickTick \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.", ...habit.needsMapping ? ["\u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0646\u06AF\u0627\u0634\u062A \u062F\u0633\u062A\u06CC"] : []] }));
    await this.storage.writeReport("habit-migration-preview", { sourceCount: rows.length, needsMapping: rows.filter((row) => row.needsMapping).length, duplicateCount: rows.filter((row) => row.duplicate.length).length, remoteCreation: "blocked-unverified-official-api" });
    return rows;
  }
  async apply() {
    throw new Error("\u0627\u06CC\u062C\u0627\u062F Habit \u062A\u0627 \u0632\u0645\u0627\u0646 \u062A\u0623\u06CC\u06CC\u062F endpoint \u0631\u0633\u0645\u06CC TickTick \u063A\u06CC\u0631\u0641\u0639\u0627\u0644 \u0627\u0633\u062A. \u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 \u0648 \u062A\u0627\u0631\u06CC\u062E\u0686\u0647\u0654 \u0645\u062D\u0644\u06CC \u0628\u062F\u0648\u0646 \u062A\u063A\u06CC\u06CC\u0631 \u0628\u0627\u0642\u06CC \u0645\u06CC\u200C\u0645\u0627\u0646\u0646\u062F.");
  }
};

// src/obsidian/note-import.ts
var import_obsidian7 = require("obsidian");

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
var NoteImportModal = class extends import_obsidian7.Modal {
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
    for (const row of rows) new import_obsidian7.Setting(this.contentEl).setName(row.note.title).setDesc(`${row.note.projectName || "\u0628\u062F\u0648\u0646 \u067E\u0631\u0648\u0698\u0647"}${row.collision ? " \xB7 \u0641\u0627\u06CC\u0644 \u0647\u0645\u200C\u0646\u0627\u0645 \u0645\u0648\u062C\u0648\u062F \u0627\u0633\u062A \u0648 \u0631\u062F \u0645\u06CC\u200C\u0634\u0648\u062F" : ""}`).addToggle((toggle) => toggle.setValue(false).setDisabled(row.collision).onChange((value) => row.selected = value));
    new import_obsidian7.Setting(this.contentEl).addButton((button) => button.setButtonText("\u0627\u0646\u062A\u0642\u0627\u0644 \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647\u200C\u0647\u0627").setCta().onClick(async () => {
      button.setDisabled(true);
      try {
        const result = await this.importer.apply(rows);
        new import_obsidian7.Notice(`${result.created.length} \u0641\u0627\u06CC\u0644 \u0627\u06CC\u062C\u0627\u062F \u0634\u062F\u061B ${result.skipped.length} \u0645\u0648\u0631\u062F \u0631\u062F \u0634\u062F.`);
        this.close();
      } catch (error) {
        button.setDisabled(false);
        new import_obsidian7.Notice(error instanceof Error ? error.message : "\u0627\u0646\u062A\u0642\u0627\u0644 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      }
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/obsidian/main.ts
var VIEW_TYPE = "ticktick-bridge-today";
var HABIT_VIEW_TYPE = "ticktick-bridge-habits";
var PLANNER_VIEW_TYPE = "ticktick-bridge-planner";
var PROJECT_BOARD_VIEW_TYPE = "ticktick-bridge-project-board";
var CONTROL_VIEW_TYPE = "ticktick-bridge-control";
function currentPlatformName() {
  if (import_obsidian8.Platform.isWin) return "Windows";
  if (import_obsidian8.Platform.isMacOS) return "macOS";
  if (import_obsidian8.Platform.isLinux) return "Linux";
  return "Unknown";
}
var DEFAULT_SETTINGS = {
  apiToken: "",
  webSessionToken: "",
  webSessionCookie: "",
  webSessionDeviceId: "",
  timeZone: "Asia/Tehran",
  dailyNoteFolder: "Journal",
  syncIntervalMinutes: 0,
  syncIntervalSeconds: 0,
  checkboxImportTag: "ticktick",
  scheduledCheckboxProjectId: "",
  showRibbonIcons: false,
  plannerFirstWeekday: 6,
  plannerShowCompleted: false,
  localHabitFolder: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC/Habits",
  ticktickNotesFolder: "TickTick Notes",
  experimentalChecklistReadOnly: true,
  boardLastProjectId: "",
  boardCollapsedGroups: []
};
var TickTickBridgePlugin = class extends import_obsidian8.Plugin {
  settings = DEFAULT_SETTINGS;
  cache = { savedAt: "", tasks: [], habits: [], habitCheckins: {}, pending: [], conflicts: [] };
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
  managedStorage;
  markdownSync;
  habitMigration;
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
      ...activeSettings
    } = legacySettings;
    this.settings = { ...DEFAULT_SETTINGS, ...activeSettings };
    if (this.settings.plannerFirstWeekday !== 6) this.settings.plannerFirstWeekday = 6;
    this.cache = normalizeCache(savedCache);
    this.markdownSync = new MarkdownSync(this.app, this.managedStorage, () => this.client(), () => this.settings, () => this.scheduledCheckboxProjectId());
    await this.markdownSync.initialize();
    this.habitMigration = new HabitMigration(this.app, this.managedStorage, () => this.settings.localHabitFolder);
    this.noteImport = new NoteImport(this.app, this.managedStorage, () => this.settings.ticktickNotesFolder);
    if ("projectRoot" in legacySettings || "projectDependencies" in legacySettings || "projectTaskCatalog" in legacySettings) await this.saveSettings();
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
    this.addCommand({ id: "review-local-habits", name: "Review local habits for TickTick migration", callback: () => this.reviewLocalHabits() });
    this.addCommand({ id: "migrate-local-habits", name: "Migrate selected local habits to TickTick", callback: () => this.migrateLocalHabits() });
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
      if (file instanceof import_obsidian8.TFile && file.extension === "md") this.queueTaggedCheckboxImport(file);
    }));
    this.configureAutomaticSync();
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
    await this.createPrewriteSnapshot("cache", publicCacheMetadata(this.cache));
    await this.saveData({ ...this.settings, cache: this.cache });
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
    if (!quiet) new import_obsidian8.Notice(`\u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 Markdown sync: \u0627\u06CC\u062C\u0627\u062F ${result.create}\u060C \u0627\u0631\u0633\u0627\u0644 ${result.push}\u060C \u062F\u0631\u06CC\u0627\u0641\u062A ${result.pull}\u060C \u062A\u0639\u0627\u0631\u0636 ${result.conflict}\u060C \u0642\u0631\u0646\u0637\u06CC\u0646\u0647 ${result.quarantine}.`);
    return result;
  }
  async applyMarkdownSync() {
    const result = await this.markdownSync.apply();
    new import_obsidian8.Notice(`\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0627\u0639\u0645\u0627\u0644 \u0634\u062F: ${result.applied} \u062A\u063A\u06CC\u06CC\u0631. \u062A\u0639\u0627\u0631\u0636/\u0642\u0631\u0646\u0637\u06CC\u0646\u0647: ${result.conflict + result.quarantine}.`);
    return result;
  }
  async openMarkdownSyncConflicts() {
    const conflicts = await this.markdownSync.conflicts();
    if (conflicts.length) {
      if (!conflicts[0].diff?.conflicts?.length) {
        new import_obsidian8.Notice(`${conflicts[0].message} \u2014 \u0627\u06CC\u0646 \u0645\u0648\u0631\u062F \u0642\u0631\u0646\u0637\u06CC\u0646\u0647 \u0634\u062F\u0647 \u0648 \u062F\u0631 \u06AF\u0632\u0627\u0631\u0634 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A.`);
        return conflicts;
      }
      const choice = await new MarkdownConflictModal(this.app, conflicts[0]).openAndWait();
      await this.markdownSync.resolve(conflicts[0], choice);
      new import_obsidian8.Notice("\u0627\u0646\u062A\u062E\u0627\u0628 \u0634\u0645\u0627 \u062B\u0628\u062A \u0634\u062F\u061B \u06AF\u0632\u0627\u0631\u0634 \u062F\u0631 /.ticktick/reports/ \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.");
    } else new import_obsidian8.Notice("\u062A\u0639\u0627\u0631\u0636 Markdown sync \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.");
    return conflicts;
  }
  async repairMarkdownBindings() {
    const result = await this.markdownSync.repairLegacyBindings();
    new import_obsidian8.Notice(`\u0627\u0633\u06A9\u0646 binding \u0642\u062F\u06CC\u0645\u06CC \u062A\u0645\u0627\u0645 \u0634\u062F\u061B ${result.quarantine} \u0645\u0648\u0631\u062F \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC \u062F\u0633\u062A\u06CC \u0627\u0633\u062A.`);
    return result;
  }
  async reviewLocalHabits() {
    const rows = await this.habitMigration.preview(this.cache.habits);
    new import_obsidian8.Notice(`\u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 \u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0645\u062D\u0644\u06CC: ${rows.length} \u0645\u0648\u0631\u062F\u061B ${rows.filter((row) => row.needsMapping).length} \u0645\u0648\u0631\u062F \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0646\u06AF\u0627\u0634\u062A \u062F\u0633\u062A\u06CC \u0627\u0633\u062A. \u0647\u06CC\u0686 \u062F\u0627\u062F\u0647\u200C\u0627\u06CC \u062A\u063A\u06CC\u06CC\u0631 \u0646\u06A9\u0631\u062F.`);
    return rows;
  }
  async migrateLocalHabits() {
    return this.habitMigration.apply();
  }
  async previewTickTickNotes() {
    const rows = this.noteImport.preview(this.cache.tasks);
    if (rows.length) new NoteImportModal(this.app, this.noteImport, this.cache.tasks).open();
    else new import_obsidian8.Notice("Note \u0642\u0627\u0628\u0644\u200C\u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u0627 kind: NOTE \u062F\u0631 cache \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
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
      refresh: async () => {
        await this.syncNow({ quiet: true });
      },
      reschedule: async (task, day) => this.markdownSync.rescheduleBoundTask(String(task.id), day),
      complete: async (task) => this.markdownSync.bindingForTask(String(task.id)) ? this.markdownSync.completeBoundTask(String(task.id)) : this.completeTask(task),
      binding: (task) => this.markdownSync.bindingForTask(String(task.id)),
      load: async (task) => this.loadTaskDetails(task),
      edit: async (task) => this.editTaskFromSurface(task),
      create: async (initial) => this.createTaskFromSurface(initial)
    };
  }
  projectBoardHost() {
    return {
      app: this.app,
      projects: () => this.client().listProjects(),
      createProject: (project) => this.client().createProject(project),
      updateProject: (project) => this.client().updateProject(project),
      deleteProject: (projectId) => this.client().deleteProject(projectId),
      createTask: (initial) => this.createTaskFromSurface(initial),
      tasks: () => this.cache.tasks,
      board: (project) => this.client().projectBoard(project),
      refresh: async () => {
        await this.syncNow({ quiet: true });
      },
      complete: async (task) => this.markdownSync.bindingForTask(String(task.id)) ? this.markdownSync.completeBoundTask(String(task.id)) : this.completeTask(task),
      binding: (task) => this.markdownSync.bindingForTask(String(task.id)),
      load: async (task) => this.loadTaskDetails(task),
      edit: async (task) => this.editTaskFromSurface(task),
      showCompleted: () => this.settings.plannerShowCompleted,
      preferences: () => ({ selected: this.settings.boardLastProjectId, collapsed: this.settings.boardCollapsedGroups }),
      savePreferences: async (value) => {
        this.settings.boardLastProjectId = value.selected;
        this.settings.boardCollapsedGroups = value.collapsed;
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
    if (imported && !quiet) new import_obsidian8.Notice(`${imported} \u0686\u06A9\u200C\u0628\u0627\u06A9\u0633 \u0628\u0647 TickTick \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.`);
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
    if (this.syncTimer !== null) window.clearInterval(this.syncTimer);
    this.syncTimer = null;
    const seconds = Number(this.settings.syncIntervalSeconds);
    const legacyMinutes = Number(this.settings.syncIntervalMinutes);
    const delay = Number.isFinite(seconds) && seconds >= 30 ? seconds * 1e3 : Number.isFinite(legacyMinutes) && legacyMinutes >= 1 ? legacyMinutes * 6e4 : 0;
    if (!delay) return;
    this.syncTimer = window.setInterval(() => void this.syncNow({ quiet: true }), delay);
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
    const menu = new import_obsidian8.Menu();
    menu.addItem((item) => item.setTitle("\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632").setIcon("check-square").onClick(() => void this.openTodayView()));
    menu.addItem((item) => item.setTitle("\u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632").setIcon("activity").onClick(() => void this.openHabitView()));
    menu.addItem((item) => item.setTitle("\u062A\u0642\u0648\u06CC\u0645 \u0648 \u0628\u0631\u0646\u0627\u0645\u0647\u0654 \u0647\u0641\u062A\u06AF\u06CC").setIcon("calendar-days").onClick(() => void this.openPlannerView()));
    menu.addItem((item) => item.setTitle("\u0628\u0631\u062F \u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627").setIcon("kanban-square").onClick(() => void this.openProjectBoardView()));
    menu.addSeparator();
    menu.addItem((item) => item.setTitle("\u0645\u0631\u06A9\u0632 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0648 \u062A\u0639\u0627\u0631\u0636\u200C\u0647\u0627").setIcon("arrow-down-up").onClick(() => void this.openControlPage("sync")));
    menu.addItem((item) => item.setTitle("\u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 \u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0645\u062D\u0644\u06CC").setIcon("activity").onClick(() => void this.openControlPage("habits")));
    menu.addItem((item) => item.setTitle("\u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 \u0627\u0646\u062A\u0642\u0627\u0644 TickTick Notes").setIcon("file-down").onClick(() => void this.openControlPage("notes")));
    menu.addItem((item) => item.setTitle("Checklist\u0647\u0627\u06CC task (\u0641\u0642\u0637\u200C\u062E\u0648\u0627\u0646\u062F\u0646\u06CC)").setIcon("list-checks").onClick(() => void this.openControlPage("checklists")));
    menu.addItem((item) => item.setTitle("\u0622\u062E\u0631\u06CC\u0646 \u06AF\u0632\u0627\u0631\u0634 \u0648 backup").setIcon("shield-check").onClick(() => void this.openControlPage("reports")));
    menu.showAtMouseEvent(event);
  }
  setSyncRibbonState(syncing) {
    if (!this.syncRibbonIcon) return;
    (0, import_obsidian8.setIcon)(this.syncRibbonIcon, syncing ? "loader-circle" : "arrow-down-up");
    this.syncRibbonIcon.toggleClass("is-syncing", syncing);
    this.syncRibbonIcon.setAttribute("aria-label", syncing ? "TickTick Bridge: \u062F\u0631 \u062D\u0627\u0644 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC\u2026" : "TickTick Bridge: \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0628\u0627 TickTick");
  }
  async syncNow({ quiet = false } = {}) {
    if (this.syncInProgress) return;
    this.syncInProgress = true;
    this.setSyncRibbonState(true);
    try {
      const day = todayInZone(this.settings.timeZone);
      await this.flushPendingMutations();
      await this.refreshCacheFromTickTick(day);
      const tasks = this.cachedTasksForDay(day);
      const habits = this.cachedHabitsForDay(day);
      this.habitCheckinCache.clear();
      for (const [element, day2] of this.taskBlocks) {
        if (!element.isConnected) {
          this.taskBlocks.delete(element);
          this.taskBlockSignatures.delete(element);
          continue;
        }
        const signature = this.taskBlockSignature(day2);
        if (this.taskBlockSignatures.get(element) !== signature) {
          await this.renderTodayBlock(element, day2);
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
      for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
        const view = leaf.view;
        if (typeof view.render === "function") await view.render();
      }
      for (const leaf of this.app.workspace.getLeavesOfType(HABIT_VIEW_TYPE)) {
        const view = leaf.view;
        if (typeof view.render === "function") await view.render();
      }
      if (!quiet) new import_obsidian8.Notice(`TickTick \u0647\u0645\u06AF\u0627\u0645 \u0634\u062F: ${tasks.length} \u062A\u0633\u06A9 \u0648 ${habits.length} \u0639\u0627\u062F\u062A \u0627\u0645\u0631\u0648\u0632.`);
    } catch (error) {
      if (!quiet) new import_obsidian8.Notice(error instanceof Error ? error.message : "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC TickTick \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    } finally {
      this.setSyncRibbonState(false);
      this.syncInProgress = false;
    }
  }
  hasCache() {
    return Boolean(this.cache.savedAt);
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
  async refreshCacheFromTickTick(today) {
    const client = this.client();
    const [webTasks, habits, sections] = await Promise.all([this.webOpenTasks(), client.listHabits(), client.listHabitSections()]);
    const tasks = webTasks ?? await client.listOpenTasks();
    const activeHabits = habits.filter((habit) => habit.status === void 0 || habit.status === 0);
    const fromDay = shiftIsoDay(today, -90);
    const officialDocuments = activeHabits.length ? await client.getHabitCheckins(activeHabits.map((habit) => habit.id), fromDay, today) : [];
    const checkins = {};
    for (const document of officialDocuments ?? []) {
      const habitId = String(document?.habitId ?? "");
      if (!habitId) continue;
      checkins[habitId] = (document.checkins ?? []).map((entry) => ({ stamp: Number(entry.stamp), value: Number(entry.value ?? 0), goal: Number(entry.goal ?? 1), status: Number(entry.status ?? 0) }));
    }
    const webCheckins = await this.webHabitCheckins(activeHabits.map((habit) => habit.id), today, 91);
    if (webCheckins) for (const [habitId, entries] of webCheckins) checkins[habitId] = entries;
    const sectionNames = new Map(sections.map((section) => [section.id, section.name]));
    this.cache = {
      savedAt: (/* @__PURE__ */ new Date()).toISOString(),
      tasks,
      habits: activeHabits.map((habit) => ({ ...habit, sectionName: sectionNames.get(habit.sectionId) ?? "\u0628\u062F\u0648\u0646 \u062F\u0633\u062A\u0647" })),
      habitCheckins: checkins,
      pending: this.cache.pending,
      conflicts: this.cache.conflicts
    };
    await this.saveSettings();
  }
  async runMutation(type, payload) {
    const operation = { id: crypto.randomUUID(), type, payload, queuedAt: (/* @__PURE__ */ new Date()).toISOString() };
    const execute = async () => {
      const client = this.client();
      if (type === "create") return client.createTask(payload);
      if (type === "update") return client.updateTask(payload);
      if (type === "complete") return client.completeTask(payload.projectId, payload.id);
      if (type === "delete") return client.deleteTask(payload.projectId, payload.id);
      return client.checkInHabit(payload.habitId, payload.day, payload.checkin);
    };
    const applyLocal = () => {
      if (type === "create") this.cache.tasks.push({ ...payload, id: `offline-${operation.id}`, status: 0 });
      if (type === "update") this.cache.tasks = this.cache.tasks.map((task) => task.id === payload.id ? { ...task, ...payload } : task);
      if (type === "complete" || type === "delete") this.cache.tasks = this.cache.tasks.filter((task) => task.id !== payload.id);
      if (type === "habit") {
        const stamp = Number(String(payload.day).replaceAll("-", ""));
        const previous = this.cache.habitCheckins[payload.habitId] ?? [];
        this.cache.habitCheckins[payload.habitId] = [...previous.filter((entry) => entry.stamp !== stamp), { stamp, ...payload.checkin }];
      }
    };
    if (!navigator.onLine) {
      this.cache.pending.push(operation);
      applyLocal();
      await this.saveSettings();
      new import_obsidian8.Notice("\u0622\u0641\u0644\u0627\u06CC\u0646 \u0647\u0633\u062A\u06CC\u061B \u062A\u063A\u06CC\u06CC\u0631 \u062F\u0631 \u0635\u0641 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.");
      return { queued: true };
    }
    try {
      const result = await execute();
      applyLocal();
      await this.saveSettings();
      return { queued: false, result };
    } catch (error) {
      const status = Number(error?.status ?? 0);
      if (status > 0 && status < 500) throw error;
      this.cache.pending.push(operation);
      applyLocal();
      await this.saveSettings();
      new import_obsidian8.Notice("\u0627\u062A\u0635\u0627\u0644 TickTick \u0628\u0631\u0642\u0631\u0627\u0631 \u0646\u06CC\u0633\u062A\u061B \u062A\u063A\u06CC\u06CC\u0631 \u062F\u0631 \u0635\u0641 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.");
      return { queued: true };
    }
  }
  async flushPendingMutations() {
    if (!this.cache.pending.length || !navigator.onLine) return;
    const remaining = [];
    for (let index = 0; index < this.cache.pending.length; index++) {
      const operation = this.cache.pending[index];
      try {
        const client = this.client();
        if (operation.type === "create") await client.createTask(operation.payload);
        else if (operation.type === "update") await client.updateTask(operation.payload);
        else if (operation.type === "complete") await client.completeTask(operation.payload.projectId, operation.payload.id);
        else if (operation.type === "delete") await client.deleteTask(operation.payload.projectId, operation.payload.id);
        else await client.checkInHabit(operation.payload.habitId, operation.payload.day, operation.payload.checkin);
      } catch (error) {
        const status = Number(error?.status ?? 0);
        if (status > 0 && status < 500) {
          this.cache.conflicts.push(operation);
          new import_obsidian8.Notice("\u06CC\u06A9 \u062A\u063A\u06CC\u06CC\u0631 \u0622\u0641\u0644\u0627\u06CC\u0646 \u0628\u0627 \u0646\u0633\u062E\u0647\u0654 TickTick \u062A\u062F\u0627\u062E\u0644 \u062F\u0627\u0634\u062A \u0648 \u0627\u0631\u0633\u0627\u0644 \u0646\u0634\u062F.");
        } else {
          remaining.push(...this.cache.pending.slice(index));
          break;
        }
      }
    }
    this.cache.pending = remaining;
    await this.saveSettings();
  }
  async createTask(task) {
    return this.runMutation("create", task);
  }
  async updateTask(task) {
    return this.runMutation("update", task);
  }
  async completeTask(task) {
    return this.runMutation("complete", task);
  }
  async deleteTask(task) {
    return this.runMutation("delete", task);
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
    const projectId = String(task?.projectId ?? "");
    if (!projectId || !task?.id) return task;
    return this.client().getTask(projectId, String(task.id));
  }
  async editTaskFromSurface(task) {
    const current = await this.loadTaskDetails(task);
    const projects = await this.client().listProjects();
    const draft = await openTaskEditor(this.app, projects, current);
    if (!draft) return null;
    const payload = toTaskPayload({ ...current, ...draft }, this.settings.timeZone);
    await this.updateTask(payload);
    return { ...current, ...payload };
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
  client() {
    if (!this.settings.apiToken.trim()) throw new Error("\u0627\u0628\u062A\u062F\u0627 API Token \u0631\u0627 \u062F\u0631 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A TickTick Bridge \u0648\u0627\u0631\u062F \u06A9\u0646.");
    return new TickTickClient({
      token: this.settings.apiToken,
      transport: async (url, init) => {
        const response = await (0, import_obsidian8.requestUrl)({ url, method: init.method, headers: init.headers, body: init.body, throw: false });
        return { status: response.status, text: response.text };
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
    const response = await (0, import_obsidian8.requestUrl)({
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
      const response = await (0, import_obsidian8.requestUrl)({
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
      const response = await (0, import_obsidian8.requestUrl)({
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
          new import_obsidian8.Notice("\u062A\u0633\u06A9 \u0628\u0647 TickTick \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.");
          await this.renderTodayBlock(element, dayOverride);
        } catch (error) {
          new import_obsidian8.Notice(error instanceof Error ? error.message : "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
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
        const check = row.createEl("input", { cls: "daily-task-checkbox", type: "checkbox", attr: { "aria-label": `\u0627\u0646\u062C\u0627\u0645 ${title}` } });
        const body = row.createDiv({ cls: "daily-task-main" });
        body.createSpan({ cls: "daily-task-title", text: title });
        appendChecklistSummary(body, task, this.settings.experimentalChecklistReadOnly);
        const description = body.createDiv({ cls: "daily-task-description is-hidden" });
        await import_obsidian8.MarkdownRenderer.renderMarkdown(cleanTaskDescription(task.desc || task.content) || "\u062A\u0648\u0636\u06CC\u062D\u06CC \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u062A\u0633\u06A9 \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.", description, "", this);
        const due = toDateKey(task.dueDate, task.timeZone || this.settings.timeZone) ?? "";
        const start = toDateKey(task.startDate, task.timeZone || this.settings.timeZone) ?? "";
        row.createSpan({ cls: `daily-task-date${due && due < day ? " is-overdue" : ""}`, text: formatTaskSchedule(start, due, day) });
        const actions = row.createDiv({ cls: "daily-task-actions" });
        const descriptionButton = actions.createEl("button", { cls: "daily-task-action mod-icon", attr: { "aria-label": "\u062A\u0648\u0636\u06CC\u062D\u0627\u062A" } });
        (0, import_obsidian8.setIcon)(descriptionButton, "file-text");
        const edit = actions.createEl("button", { cls: "daily-task-action mod-icon", attr: { "aria-label": "\u0648\u06CC\u0631\u0627\u06CC\u0634" } });
        (0, import_obsidian8.setIcon)(edit, "pencil");
        const remove = actions.createEl("button", { cls: "daily-task-action is-danger mod-icon", attr: { "aria-label": "\u062D\u0630\u0641" } });
        (0, import_obsidian8.setIcon)(remove, "trash-2");
        descriptionButton.addEventListener("click", () => {
          const hidden = description.hasClass("is-hidden");
          description.toggleClass("is-hidden", !hidden);
        });
        check.addEventListener("change", async () => {
          check.disabled = true;
          try {
            await this.completeTask(task);
            new import_obsidian8.Notice("\u0646\u0648\u0628\u062A \u062A\u0633\u06A9 \u062F\u0631 TickTick \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F.");
            await this.renderTodayBlock(element, dayOverride);
          } catch (error) {
            check.checked = false;
            check.disabled = false;
            new import_obsidian8.Notice(error instanceof Error ? error.message : "\u062A\u06A9\u0645\u06CC\u0644 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
        edit.addEventListener("click", async () => {
          try {
            const projects = await client.listProjects();
            const draft = await openTaskEditor(this.app, projects, task);
            if (!draft) return;
            await this.updateTask(toTaskPayload({ ...task, ...draft }, this.settings.timeZone));
            new import_obsidian8.Notice("\u062A\u0633\u06A9 \u062F\u0631 TickTick \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u062F.");
            await this.renderTodayBlock(element, dayOverride);
          } catch (error) {
            new import_obsidian8.Notice(error instanceof Error ? error.message : "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
        remove.addEventListener("click", async () => {
          if (!await confirmDelete(this.app, title)) return;
          try {
            await this.deleteTask(task);
            new import_obsidian8.Notice("\u062A\u0633\u06A9 \u0627\u0632 TickTick \u062D\u0630\u0641 \u0634\u062F.");
            await this.renderTodayBlock(element, dayOverride);
          } catch (error) {
            new import_obsidian8.Notice(error instanceof Error ? error.message : "\u062D\u0630\u0641 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
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
      const localHabits = (await this.habitMigration.localHabits()).map((habit) => {
        const checkin = habit.history.find((entry) => entry.date === day);
        return { ...habit, id: habit.id, source: "local", repeatRule: habit.cadence === "weekly" ? "RRULE:FREQ=WEEKLY" : "RRULE:FREQ=DAILY", checkin: checkin ? { value: checkin.value, goal: habit.goal, status: checkin.completed ? 2 : 0 } : null };
      });
      habits = [...habits, ...localHabits];
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
        const previous = navigator2.createEl("button", { text: "\u2039", attr: { type: "button", "aria-label": "\u0631\u0648\u0632 \u0642\u0628\u0644" } });
        const now = navigator2.createEl("button", { text: "\u0627\u0645\u0631\u0648\u0632", attr: { type: "button" } });
        navigator2.createEl("strong", { text: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(/* @__PURE__ */ new Date(`${day}T12:00:00`)) });
        const next = navigator2.createEl("button", { text: "\u203A", attr: { type: "button", "aria-label": "\u0631\u0648\u0632 \u0628\u0639\u062F" } });
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
        const goal = Math.max(1, Number(habit.checkin?.goal ?? habit.goal ?? habit.target ?? 1));
        const currentValue = Number(habit.checkin?.value ?? 0);
        const completed = habit.checkin?.status === 2 || currentValue >= goal;
        const step = Math.max(1, Number(habit.step ?? 1));
        const progress = Math.min(1, Math.max(0, currentValue / goal));
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
        const habitGroupTone = (group) => {
          const map = { "\u0632\u0628\u0627\u0646": "var(--pd-language, var(--color-yellow))", "\u0634\u062E\u0635\u06CC": "var(--pd-personal, var(--color-green))", "\u0633\u0644\u0627\u0645\u062A\u06CC": "var(--pd-kotlin, var(--color-blue))" };
          return map[group] || "var(--interactive-accent)";
        };
        const card = cardHost.createEl("button", { cls: `daily-habit-card${dashboard ? " ticktick-dashboard-habit-card" : ""}${completed ? " is-done" : ""}`, attr: { type: "button", "aria-label": `\u062B\u0628\u062A \u0639\u0627\u062F\u062A ${habit.name}` } });
        const localOnly = habit.source === "local";
        if (localOnly) card.addClass("ticktick-local-habit");
        card.style.setProperty("--card-tone", habitGroupTone(habitDashboardSection(habit)));
        const icon = card.createDiv({ cls: "daily-habit-progress" });
        icon.style.setProperty("--ticktick-progress", `${Math.round(progress * 360)}deg`);
        icon.createDiv({ cls: "daily-habit-icon", text: habitIcon(habit.iconRes ?? habit.icon) });
        const text = card.createDiv({ cls: "daily-habit-text" });
        text.createDiv({ cls: "daily-habit-title", text: habit.name });
        text.createDiv({ cls: "ticktick-habit-source", text: localOnly ? `\u0645\u062D\u0644\u06CC \xB7 ${habit.sourcePath}` : "TickTick" });
        const historyComplete = (habit.history ?? []).filter((entry) => entry.completed).length;
        const streak = habitStreak(habit.history ?? []);
        const progressLabel = goal > 1 ? `${currentValue}/${goal} ${habit.unit ?? ""}`.trim() : completed ? "\u0627\u0646\u062C\u0627\u0645 \u0634\u062F" : "\u0628\u0631\u0627\u06CC \u062B\u0628\u062A \u0628\u0632\u0646";
        card.createDiv({ cls: "daily-habit-state", text: dashboard ? state.mode === "day" ? progressLabel : `\u{1F525} ${streak}  \u2713 ${historyComplete}/${habit.history?.length ?? 0}` : progressLabel });
        if (dashboard && state.mode !== "day" && habit.history) {
          const history = card.createDiv({ cls: "ticktick-habit-history", attr: { "aria-label": "\u062A\u0627\u0631\u06CC\u062E\u0686\u0647\u0654 \u0639\u0627\u062F\u062A" } });
          for (const entry of habit.history) {
            const dot = history.createSpan({ cls: `ticktick-habit-history-dot${entry.completed ? " is-complete" : " is-missed"}` });
            dot.setAttribute("aria-label", `${entry.date}: ${entry.completed ? "\u0627\u0646\u062C\u0627\u0645 \u0634\u062F" : "\u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F"}`);
            dot.setAttribute("title", `${entry.date}: ${entry.completed ? "\u0627\u0646\u062C\u0627\u0645 \u0634\u062F" : "\u0627\u0646\u062C\u0627\u0645 \u0646\u0634\u062F"}`);
          }
        }
        card.addEventListener("click", async () => {
          if (localOnly) {
            new import_obsidian8.Notice("\u0639\u0627\u062F\u062A \u0645\u062D\u0644\u06CC \u0641\u0642\u0637 \u062E\u0648\u0627\u0646\u062F\u0646\u06CC \u0627\u0633\u062A\u061B writeback \u067E\u06CC\u0634\u200C\u0641\u0631\u0636 \u062E\u0627\u0645\u0648\u0634 \u0627\u0633\u062A.");
            return;
          }
          card.disabled = true;
          try {
            const nextValue = completed ? 0 : Math.min(goal, currentValue + step);
            const nextStatus = completed ? 0 : nextValue >= goal ? 2 : void 0;
            await this.checkInHabit(habit.id, day, {
              value: nextValue,
              goal,
              status: nextStatus
            });
            new import_obsidian8.Notice(completed ? "\u062B\u0628\u062A \u0627\u0645\u0631\u0648\u0632 \u0639\u0627\u062F\u062A \u062F\u0631 TickTick \u0628\u0631\u062F\u0627\u0634\u062A\u0647 \u0634\u062F." : nextStatus === 2 ? "\u0639\u0627\u062F\u062A \u062F\u0631 TickTick \u06A9\u0627\u0645\u0644 \u0634\u062F." : `\u06CC\u06A9 \u0645\u0631\u062D\u0644\u0647 \u062B\u0628\u062A \u0634\u062F: ${nextValue}/${goal}`);
            await this.renderHabitBlock(element, dashboard, dayOverride);
          } catch (error) {
            card.disabled = false;
            new import_obsidian8.Notice(error instanceof Error ? error.message : "\u062B\u0628\u062A \u0639\u0627\u062F\u062A \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
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
              new import_obsidian8.Notice("\u062A\u0633\u06A9 \u062A\u06A9\u0631\u0627\u0631\u0634\u0648\u0646\u062F\u0647 \u062F\u0631 TickTick \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u062F.");
              await this.renderRecurringBlock(element);
            } catch (error) {
              new import_obsidian8.Notice(error instanceof Error ? error.message : "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
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
var TodayTasksView = class extends import_obsidian8.ItemView {
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
    header.createEl("h2", { text: "\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632" });
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
          new import_obsidian8.Notice("\u062A\u0633\u06A9 \u0628\u0647 TickTick \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.");
          await this.render();
        } catch (error) {
          new import_obsidian8.Notice(error instanceof Error ? error.message : "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
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
        (0, import_obsidian8.setIcon)(edit, "pencil");
        const remove = actions.createEl("button", { cls: "mod-warning mod-icon", attr: { "aria-label": "\u062D\u0630\u0641" } });
        (0, import_obsidian8.setIcon)(remove, "trash-2");
        check.addEventListener("change", async () => {
          check.disabled = true;
          try {
            await this.plugin.completeTask(task);
            new import_obsidian8.Notice("\u0646\u0648\u0628\u062A \u062A\u0633\u06A9 \u062F\u0631 TickTick \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F.");
            await this.render();
          } catch (error) {
            check.checked = false;
            check.disabled = false;
            new import_obsidian8.Notice(error instanceof Error ? error.message : "\u062A\u06A9\u0645\u06CC\u0644 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
        edit.addEventListener("click", async () => {
          try {
            const projects = await client.listProjects();
            const draft = await openTaskEditor(this.app, projects, task);
            if (!draft) return;
            await this.plugin.updateTask(toTaskPayload({ ...task, ...draft }, this.plugin.settings.timeZone));
            new import_obsidian8.Notice("\u062A\u0633\u06A9 \u062F\u0631 TickTick \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u062F.");
            await this.render();
          } catch (error) {
            new import_obsidian8.Notice(error instanceof Error ? error.message : "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
        remove.addEventListener("click", async () => {
          const accepted = await confirmDelete(this.app, task.title);
          if (!accepted) return;
          try {
            await this.plugin.deleteTask(task);
            new import_obsidian8.Notice("\u062A\u0633\u06A9 \u0627\u0632 TickTick \u062D\u0630\u0641 \u0634\u062F.");
            await this.render();
          } catch (error) {
            new import_obsidian8.Notice(error instanceof Error ? error.message : "\u062D\u0630\u0641 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
      }
    } catch (error) {
      contentEl.createEl("p", { text: error instanceof Error ? error.message : "\u0627\u062A\u0635\u0627\u0644 TickTick \u0622\u0645\u0627\u062F\u0647 \u0646\u06CC\u0633\u062A." });
    }
  }
};
var TodayHabitsView = class extends import_obsidian8.ItemView {
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
var PlanningView = class extends import_obsidian8.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  getViewType() {
    return PLANNER_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC TickTick";
  }
  getIcon() {
    return "calendar-days";
  }
  async onOpen() {
    await this.render();
  }
  async render() {
    this.contentEl.empty();
    this.contentEl.addClass("ticktick-planner-panel");
    await new PlanningCalendar(this.contentEl, this.plugin.plannerHost()).render();
  }
};
var ProjectBoardView = class extends import_obsidian8.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
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
    this.contentEl.empty();
    this.contentEl.addClass("ticktick-project-board-panel");
    await new ProjectBoard(this.contentEl, this.plugin.projectBoardHost()).render();
  }
};
var TickTickControlView = class extends import_obsidian8.ItemView {
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
    const choices = [["sync", "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC"], ["habits", "\u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0645\u062D\u0644\u06CC"], ["notes", "TickTick Notes"], ["checklists", "Checklist"], ["reports", "\u06AF\u0632\u0627\u0631\u0634\u200C\u0647\u0627"]];
    for (const [screen, label] of choices) {
      const button = nav.createEl("button", { text: label, cls: this.screen === screen ? "is-active" : "" });
      button.addEventListener("click", () => {
        this.screen = screen;
        void this.render();
      });
    }
    const body = this.contentEl.createDiv({ cls: "ticktick-control-body" });
    if (this.screen === "sync") {
      body.createEl("h2", { text: "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0648 \u062A\u0639\u0627\u0631\u0636\u200C\u0647\u0627" });
      body.createEl("p", { text: "Preview \u0647\u06CC\u0686 \u062A\u063A\u06CC\u06CC\u0631\u06CC \u0646\u0645\u06CC\u200C\u0646\u0648\u06CC\u0633\u062F\u061B Apply \u0641\u0642\u0637 \u067E\u0633 \u0627\u0632 \u0627\u0646\u062A\u062E\u0627\u0628 \u0634\u0645\u0627 \u0627\u062C\u0631\u0627 \u0645\u06CC\u200C\u0634\u0648\u062F." });
      this.button(body, "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0639\u0627\u062F\u06CC", async () => this.plugin.syncNow());
      this.button(body, "Preview Markdown", async () => this.plugin.previewMarkdownSync());
      this.button(body, "Apply Preview", async () => this.plugin.applyMarkdownSync(), true);
      this.button(body, "\u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u062A\u0639\u0627\u0631\u0636\u200C\u0647\u0627", async () => this.plugin.openMarkdownSyncConflicts());
    } else if (this.screen === "habits") {
      body.createEl("h2", { text: "\u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0645\u062D\u0644\u06CC" });
      body.createEl("p", { text: "\u0627\u06CC\u0646 \u0628\u0631\u0631\u0633\u06CC \u0641\u0642\u0637\u200C\u062E\u0648\u0627\u0646\u062F\u0646\u06CC \u0627\u0633\u062A\u061B \u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC \u0645\u062D\u0644\u06CC \u062A\u063A\u06CC\u06CC\u0631 \u06CC\u0627 \u062D\u0630\u0641 \u0646\u0645\u06CC\u200C\u0634\u0648\u0646\u062F." });
      this.button(body, "\u0645\u0631\u0648\u0631 \u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0645\u062D\u0644\u06CC", async () => this.plugin.reviewLocalHabits());
    } else if (this.screen === "notes") {
      body.createEl("h2", { text: "\u0627\u0646\u062A\u0642\u0627\u0644 \u0627\u0646\u062A\u062E\u0627\u0628\u06CC TickTick Notes" });
      body.createEl("p", { text: "\u0641\u0642\u0637 Note\u0647\u0627\u06CC \u062F\u0627\u0631\u0627\u06CC kind: NOTE \u067E\u0633 \u0627\u0632 \u0627\u0646\u062A\u062E\u0627\u0628 \u0634\u0645\u0627 \u0648\u0627\u0631\u062F \u0641\u0648\u0644\u062F\u0631 TickTick Notes \u0645\u06CC\u200C\u0634\u0648\u0646\u062F\u061B \u0641\u0627\u06CC\u0644 \u0645\u0648\u062C\u0648\u062F overwrite \u0646\u0645\u06CC\u200C\u0634\u0648\u062F." });
      this.button(body, "\u0627\u0646\u062A\u062E\u0627\u0628 \u0648 \u0627\u0646\u062A\u0642\u0627\u0644 Note\u0647\u0627", async () => this.plugin.previewTickTickNotes(), true);
    } else if (this.screen === "checklists") {
      body.createEl("h2", { text: "Checklist \u0648 Subtask" });
      body.createEl("p", { text: "Checklist\u0647\u0627 \u062F\u0631 \u06A9\u0627\u0631\u062A task \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F \u0627\u0645\u0627 \u0641\u0639\u0644\u0627\u064B \u0641\u0642\u0637\u200C\u062E\u0648\u0627\u0646\u062F\u0646\u06CC\u200C\u0627\u0646\u062F\u061B \u0648\u06CC\u0631\u0627\u06CC\u0634 child item \u062A\u0627 \u062A\u0623\u06CC\u06CC\u062F \u0631\u0633\u0645\u06CC API TickTick \u0641\u0639\u0627\u0644 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F." });
      this.button(body, "\u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632", async () => this.plugin.openTodayView());
    } else {
      body.createEl("h2", { text: "\u06AF\u0632\u0627\u0631\u0634\u200C\u0647\u0627 \u0648 backup" });
      const latest = await this.plugin.latestManagedReport();
      body.createEl("p", { text: latest?.path ?? "\u0647\u0646\u0648\u0632 \u06AF\u0632\u0627\u0631\u0634\u06CC \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F." });
      if (latest) body.createEl("pre", { text: JSON.stringify(latest.report, null, 2) });
    }
  }
  button(parent, label, action, cta = false) {
    const button = parent.createEl("button", { text: label, cls: cta ? "mod-cta" : "" });
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        await action();
      } catch (error) {
        new import_obsidian8.Notice(error instanceof Error ? error.message : "\u0639\u0645\u0644\u06CC\u0627\u062A \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      } finally {
        button.disabled = false;
      }
    });
  }
};
function appendChecklistSummary(parent, task, enabled) {
  const summary = checklistSummary(task.items);
  if (!summary.total) return;
  const detail = parent.createEl("details", { cls: "ticktick-checklist-readonly" });
  detail.createEl("summary", { text: `Checklist: ${summary.completed}/${summary.total}${enabled ? " \xB7 \u0641\u0642\u0637 \u062E\u0648\u0627\u0646\u062F\u0646\u06CC" : " \xB7 \u063A\u06CC\u0631\u0641\u0639\u0627\u0644"}` });
  for (const item of task.items ?? []) detail.createEl("div", { text: `${Number(item.status ?? 0) !== 0 ? "\u2611" : "\u2610"} ${String(item.title ?? item.content ?? "")}` });
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
function habitIcon(icon) {
  const value = String(icon ?? "").toLowerCase();
  if (value.includes("reading")) return "\u{1F4D6}";
  if (value.includes("listen") || value.includes("music")) return "\u{1F3A7}";
  if (value.includes("stretch") || value.includes("sport") || value.includes("exercise")) return "\u{1F9D8}";
  if (value.includes("language") || value.includes("learn")) return "\u{1F5E3}\uFE0F";
  return "\u2713";
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
  if (!candidate || typeof candidate !== "object") return { savedAt: "", tasks: [], habits: [], habitCheckins: {}, pending: [], conflicts: [] };
  return {
    savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : "",
    tasks: Array.isArray(candidate.tasks) ? candidate.tasks : [],
    habits: Array.isArray(candidate.habits) ? candidate.habits : [],
    habitCheckins: candidate.habitCheckins && typeof candidate.habitCheckins === "object" ? candidate.habitCheckins : {},
    pending: Array.isArray(candidate.pending) ? candidate.pending : [],
    conflicts: Array.isArray(candidate.conflicts) ? candidate.conflicts : []
  };
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function checkboxSchedule(source, today) {
  const rules = [
    { pattern: /#امروز(?=\s|$)/giu, due: () => today },
    { pattern: /#فردا(?=\s|$)/giu, due: () => shiftIsoDay(today, 1) },
    { pattern: /#پس(?:[-_‌\s])?فردا(?=\s|$)/giu, due: () => shiftIsoDay(today, 2) },
    { pattern: /#این(?:[-_‌\s])?هفته(?=\s|$)/giu, due: () => nextWeekday(today, 5, false) },
    { pattern: /#هفته(?:[-_‌\s])?بعد(?=\s|$)/giu, due: () => nextWeekday(today, 6, true) },
    { pattern: /#ماه(?:[-_‌\s])?بعد(?=\s|$)/giu, due: () => {
      const date = /* @__PURE__ */ new Date(`${today}T12:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() + 1, 1);
      return date.toISOString().slice(0, 10);
    } }
  ];
  const weekdays = { "\u0634\u0646\u0628\u0647": 6, "\u06CC\u06A9\u0634\u0646\u0628\u0647": 0, "\u062F\u0648\u0634\u0646\u0628\u0647": 1, "\u0633\u0647\u200C\u0634\u0646\u0628\u0647": 2, "\u0686\u0647\u0627\u0631\u0634\u0646\u0628\u0647": 3, "\u067E\u0646\u062C\u0634\u0646\u0628\u0647": 4, "\u062C\u0645\u0639\u0647": 5 };
  for (const [name, weekday] of Object.entries(weekdays)) rules.push({ pattern: new RegExp(`#${name}(?=\\s|$)`, "giu"), due: () => nextWeekday(today, weekday, false) });
  for (const rule of rules) {
    if (rule.pattern.test(source)) return { dueDate: rule.due(), title: source.replace(rule.pattern, "").replace(/\s+/g, " ").trim() };
  }
  return { dueDate: "", title: source.replace(/\s+/g, " ").trim() };
}
function nextWeekday(day, weekday, forceNextWeek) {
  const current = (/* @__PURE__ */ new Date(`${day}T12:00:00Z`)).getUTCDay();
  let offset = (weekday - current + 7) % 7;
  if (forceNextWeek || offset === 0) offset += 7;
  return shiftIsoDay(day, offset);
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
  (0, import_obsidian8.setIcon)(button, "file-text");
  const panel = body.createDiv({ cls: "ticktick-bridge-description" });
  panel.addClass("is-hidden");
  await import_obsidian8.MarkdownRenderer.render(app, description || "\u062A\u0648\u0636\u06CC\u062D\u06CC \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u062A\u0633\u06A9 \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.", panel, "", component);
  button.addEventListener("click", () => panel.classList.toggle("is-hidden"));
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
var TaskEditorModal = class extends import_obsidian8.Modal {
  constructor(app, projects, initial) {
    super(app);
    this.projects = projects;
    this.initial = initial;
  }
  resolveResult;
  result = new Promise((resolve) => this.resolveResult = resolve);
  finished = false;
  comp = new import_obsidian8.Component();
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
    new import_obsidian8.Setting(fields2).setName("\u{1F4DD} \u0639\u0646\u0648\u0627\u0646").addText((input) => {
      input.setValue(title).onChange((value) => title = value);
      input.inputEl.dir = "rtl";
      input.inputEl.addClass("ticktick-input-full-width");
    });
    const selectedProjectName = () => this.projects.find((project) => project.id === projectId)?.name ?? "\u0627\u0646\u062A\u062E\u0627\u0628 \u067E\u0631\u0648\u0698\u0647";
    new import_obsidian8.Setting(fields2).setName("\u{1F4C2} \u067E\u0631\u0648\u0698\u0647").setDesc("\u0628\u0631\u0627\u06CC \u0627\u0646\u062A\u062E\u0627\u0628 \u067E\u0631\u0648\u0698\u0647 \u06A9\u0644\u06CC\u06A9 \u06A9\u0646.").addButton((button) => {
      button.setButtonText(selectedProjectName());
      button.buttonEl.addClass("ticktick-project-picker");
      button.buttonEl.addEventListener("click", (event) => {
        const menu = new import_obsidian8.Menu();
        this.projects.forEach((project) => menu.addItem((item) => item.setTitle(project.name).setChecked(project.id === projectId).onClick(() => {
          projectId = project.id;
          button.setButtonText(selectedProjectName());
        })));
        menu.showAtMouseEvent(event);
      });
    });
    new import_obsidian8.Setting(fields2).setName("\u{1F4C5} \u062A\u0627\u0631\u06CC\u062E").setDesc("\u0628\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u062A\u0627\u0631\u06CC\u062E\u060C \u062A\u0642\u0648\u06CC\u0645 \u0633\u06CC\u0633\u062A\u0645 \u0628\u0627\u0632 \u0645\u06CC\u200C\u0634\u0648\u062F.").addText((input) => {
      input.inputEl.type = "date";
      input.setValue(dueDate).onChange((value) => dueDate = value);
      input.inputEl.dir = "ltr";
    });
    new import_obsidian8.Setting(fields2).setName("\u23F0 \u06CC\u0627\u062F\u0622\u0648\u0631\u06CC").setDesc("\u0627\u062E\u062A\u06CC\u0627\u0631\u06CC\u061B \u062F\u0631 \u0633\u0627\u0639\u062A \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647 \u062F\u0631 \u0647\u0645\u0627\u0646 \u0631\u0648\u0632 \u06CC\u0627\u062F\u0622\u0648\u0631\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F.").addText((input) => {
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
      await import_obsidian8.MarkdownRenderer.render(this.app, content, previewEl, "", this.comp);
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
      if (!title.trim() || !projectId) return new import_obsidian8.Notice("\u0639\u0646\u0648\u0627\u0646 \u0648 \u067E\u0631\u0648\u0698\u0647 \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646.");
      if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return new import_obsidian8.Notice("\u062A\u0627\u0631\u06CC\u062E \u0628\u0627\u06CC\u062F \u0628\u0647 \u0634\u06A9\u0644 YYYY-MM-DD \u0628\u0627\u0634\u062F.");
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
var DeleteConfirmationModal = class extends import_obsidian8.Modal {
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
var TickTickWebLoginModal = class extends import_obsidian8.Modal {
  resolveResult;
  result = new Promise((resolve) => this.resolveResult = resolve);
  submitted = false;
  onOpen() {
    this.contentEl.addClass("ticktick-login-modal");
    this.contentEl.createEl("h2", { text: "\u0648\u0631\u0648\u062F \u0645\u0633\u062A\u0642\u06CC\u0645 \u0628\u0647 TickTick" });
    this.contentEl.createEl("p", { text: "\u0631\u0645\u0632 \u0641\u0642\u0637 \u0628\u0631\u0627\u06CC \u062F\u0631\u06CC\u0627\u0641\u062A \u0646\u0634\u0633\u062A TickTick \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u062F\u0631 Obsidian \u0630\u062E\u06CC\u0631\u0647 \u0646\u062E\u0648\u0627\u0647\u062F \u0634\u062F." });
    let username = "";
    let password = "";
    new import_obsidian8.Setting(this.contentEl).setName("\u0627\u06CC\u0645\u06CC\u0644 \u06CC\u0627 \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC").addText((input) => {
      input.inputEl.autocomplete = "username";
      input.inputEl.addClass("ticktick-input-full-width");
      input.onChange((value) => username = value);
    });
    new import_obsidian8.Setting(this.contentEl).setName("\u0631\u0645\u0632 \u0639\u0628\u0648\u0631").addText((input) => {
      input.inputEl.type = "password";
      input.inputEl.autocomplete = "current-password";
      input.inputEl.addClass("ticktick-input-full-width");
      input.onChange((value) => password = value);
    });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "\u0627\u0646\u0635\u0631\u0627\u0641" }).addEventListener("click", () => this.finish(null));
    actions.createEl("button", { text: "\u0648\u0631\u0648\u062F \u0648 \u0627\u062A\u0635\u0627\u0644", cls: "mod-cta" }).addEventListener("click", () => {
      if (!username.trim() || !password) {
        new import_obsidian8.Notice("\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646.");
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
var TickTickBridgeSettings = class extends import_obsidian8.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian8.Setting(containerEl).setName("\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0627\u062A\u0635\u0627\u0644 \u0648 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC").setHeading();
    const cachedAt = this.plugin.cacheSnapshotTime();
    new import_obsidian8.Setting(containerEl).setName("\u0646\u0633\u062E\u0647\u0654 \u0645\u062D\u0644\u06CC \u062F\u0627\u062F\u0647\u200C\u0647\u0627").setDesc(cachedAt ? `\u0622\u062E\u0631\u06CC\u0646 \u062F\u0631\u06CC\u0627\u0641\u062A: ${cachedAt} \u2014 \u067E\u0646\u0644\u200C\u0647\u0627 \u0627\u0628\u062A\u062F\u0627 \u0627\u0632 \u0627\u06CC\u0646 \u0646\u0633\u062E\u0647\u0654 \u0633\u0631\u06CC\u0639 \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F.` : "\u0647\u0646\u0648\u0632 \u0646\u0633\u062E\u0647\u0654 \u0645\u062D\u0644\u06CC \u0633\u0627\u062E\u062A\u0647 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A. \u06CC\u06A9\u200C\u0628\u0627\u0631 \xAB\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0627\u0644\u0622\u0646\xBB \u0631\u0627 \u0628\u0632\u0646.");
    new import_obsidian8.Setting(containerEl).setName("\u0645\u0631\u06A9\u0632 \u0633\u0627\u062F\u0647\u0654 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC").setDesc("\u06CC\u06A9 \u0635\u0641\u062D\u0647\u0654 \u06A9\u0627\u0645\u0644 \u0628\u0631\u0627\u06CC sync \u0639\u0627\u062F\u06CC\u060C preview/apply Markdown \u0648 \u062D\u0644 \u062A\u0639\u0627\u0631\u0636\u200C\u0647\u0627.").addButton((button) => button.setButtonText("\u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u0645\u0631\u06A9\u0632 Sync").setCta().onClick(() => void this.plugin.openControlPage("sync")));
    if (this.plugin.cacheConflictCount()) new import_obsidian8.Setting(containerEl).setName("\u062A\u062F\u0627\u062E\u0644\u200C\u0647\u0627\u06CC \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC").setDesc(`${this.plugin.cacheConflictCount()} \u062A\u063A\u06CC\u06CC\u0631 \u0622\u0641\u0644\u0627\u06CC\u0646 \u062F\u0631 TickTick \u0642\u0627\u0628\u0644 \u0627\u0639\u0645\u0627\u0644 \u0646\u0628\u0648\u062F \u0648 \u0628\u0631\u0627\u06CC \u062C\u0644\u0648\u06AF\u06CC\u0631\u06CC \u0627\u0632 \u0628\u0627\u0632\u0646\u0648\u06CC\u0633\u06CC \u062F\u0627\u062F\u0647\u0654 \u062C\u062F\u06CC\u062F\u060C \u0646\u06AF\u0647 \u062F\u0627\u0634\u062A\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A.`);
    new import_obsidian8.Setting(containerEl).setName("\u0641\u0636\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A\u200C\u0634\u062F\u0647\u0654 TickTick").setDesc(`/.ticktick/ \u2014 \u0646\u0633\u062E\u0647\u200C\u0647\u0627\u06CC \u067E\u0634\u062A\u06CC\u0628\u0627\u0646 \u062A\u0627 \u06F1\u06F0 \u0631\u0648\u0632 \u062A\u0642\u0648\u06CC\u0645\u06CC UTC \u0646\u06AF\u0647 \u062F\u0627\u0634\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F. \u0622\u062E\u0631\u06CC\u0646 \u06AF\u0632\u0627\u0631\u0634: ${this.plugin.managedStorageReport()}`);
    new import_obsidian8.Setting(containerEl).setName("\u0622\u062E\u0631\u06CC\u0646 \u06AF\u0632\u0627\u0631\u0634 \u0645\u062F\u06CC\u0631\u06CC\u062A\u200C\u0634\u062F\u0647").setDesc("\u0622\u062E\u0631\u06CC\u0646 \u06AF\u0632\u0627\u0631\u0634 \u063A\u06CC\u0631\u0645\u062D\u0631\u0645\u0627\u0646\u0647\u0654 \u0639\u0645\u0644\u06CC\u0627\u062A \u0630\u062E\u06CC\u0631\u0647\u200C\u0634\u062F\u0647 \u062F\u0631 .ticktick/reports/ \u0631\u0627 \u0646\u0645\u0627\u06CC\u0634 \u0645\u06CC\u200C\u062F\u0647\u062F.").addButton((button) => button.setButtonText("\u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u06AF\u0632\u0627\u0631\u0634 \u0622\u062E\u0631").onClick(async () => {
      button.setDisabled(true);
      try {
        new ManagedReportModal(this.app, await this.plugin.latestManagedReport()).open();
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian8.Setting(containerEl).setName("\u0627\u0646\u062A\u0642\u0627\u0644 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u200C\u0647\u0627\u06CC \u0642\u062F\u06CC\u0645\u06CC \u0631\u06CC\u0634\u0647\u0654 Vault").setDesc("\u0641\u0642\u0637 \u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC \u062F\u0642\u06CC\u0642 ticktick-backup-*.csv \u0631\u0627 \u067E\u0633 \u0627\u0632 \u062A\u0623\u06CC\u06CC\u062F \u0648 \u0628\u0631\u0631\u0633\u06CC \u0637\u0648\u0644 \u0628\u0627\u06CC\u062A \u06A9\u067E\u06CC \u0645\u06CC\u200C\u06A9\u0646\u062F.").addButton((button) => button.setButtonText("Move legacy root backups").onClick(async () => {
      button.setDisabled(true);
      try {
        const files = await this.plugin.previewLegacyRootBackups();
        const size = files.reduce((total, file) => total + file.size, 0);
        if (!files.length) {
          new import_obsidian8.Notice("\u067E\u0634\u062A\u06CC\u0628\u0627\u0646 \u0642\u062F\u06CC\u0645\u06CC \u062F\u0631 \u0631\u06CC\u0634\u0647\u0654 Vault \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
          return;
        }
        const confirmed = await new LegacyBackupMigrationModal(this.app, files.length, size).openAndWait();
        if (!confirmed) return;
        const result = await this.plugin.migrateLegacyRootBackups();
        new import_obsidian8.Notice(`${result.migrated.length} \u0627\u0632 ${result.sources.length} \u067E\u0634\u062A\u06CC\u0628\u0627\u0646 \u0642\u062F\u06CC\u0645\u06CC \u0645\u0646\u062A\u0642\u0644 \u0634\u062F.`);
        this.display();
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian8.Setting(containerEl).setName("API Token").setDesc("\u062A\u0648\u06A9\u0646 \u0634\u062E\u0635\u06CC TickTick\u061B \u0641\u0642\u0637 \u062F\u0631 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0627\u0641\u0632\u0648\u0646\u0647 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F.").addText((input) => {
      input.inputEl.type = "password";
      input.setValue(this.plugin.settings.apiToken).onChange(async (value) => {
        this.plugin.settings.apiToken = value.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian8.Setting(containerEl).setName("\u062A\u06AF \u0686\u06A9\u200C\u0628\u0627\u06A9\u0633 TickTick").setDesc("\u0686\u06A9\u200C\u0628\u0627\u06A9\u0633\u200C\u0647\u0627\u06CC \u062F\u0627\u0631\u0627\u06CC \u0627\u06CC\u0646 \u062A\u06AF \u0627\u0628\u062A\u062F\u0627 \u0641\u0642\u0637 \u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F\u061B \u0633\u067E\u0633 \u0628\u0627 \u0641\u0631\u0645\u0627\u0646 \u0627\u0639\u0645\u0627\u0644\u060C binding \u0627\u0645\u0646 TickTick \u0645\u06CC\u200C\u06AF\u06CC\u0631\u0646\u062F.").addText((input) => {
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
    new import_obsidian8.Setting(containerEl).setName("Checklist \u0648 Subtask \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC").setDesc("\u0641\u0639\u0644\u0627\u064B \u0641\u0642\u0637 \u062E\u0648\u0627\u0646\u062F\u0646\u06CC \u0627\u0633\u062A\u061B API \u0631\u0633\u0645\u06CC \u0628\u0631\u0627\u06CC \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0627\u0645\u0646 child item \u062A\u0623\u06CC\u06CC\u062F \u0646\u0634\u062F\u0647 \u0648 \u0647\u06CC\u0686 checkbox\u0627\u06CC \u062F\u0631 \u0627\u06CC\u0646 \u0628\u062E\u0634 \u0686\u06CC\u0632\u06CC \u0631\u0627 \u062A\u063A\u06CC\u06CC\u0631 \u0646\u0645\u06CC\u200C\u062F\u0647\u062F.").addToggle((toggle) => toggle.setValue(this.plugin.settings.experimentalChecklistReadOnly).setDisabled(true));
    new import_obsidian8.Setting(containerEl).setName("\u0627\u0646\u062A\u0642\u0627\u0644 TickTick Notes").setDesc("\u0641\u0642\u0637 Note\u0647\u0627\u06CC \u062F\u0627\u0631\u0627\u06CC kind: NOTE \u0631\u0627 \u067E\u0633 \u0627\u0632 \u0627\u0646\u062A\u062E\u0627\u0628 \u0634\u0645\u0627 \u062F\u0631 \u0641\u0648\u0644\u062F\u0631 \u0642\u0627\u0628\u0644\u200C\u0645\u0634\u0627\u0647\u062F\u0647 \u0648\u0627\u0631\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u06CC\u06A9\u200C\u0637\u0631\u0641\u0647 \u0648 \u0628\u062F\u0648\u0646 overwrite.").addText((input) => input.setValue(this.plugin.settings.ticktickNotesFolder).onChange(async (value) => {
      this.plugin.settings.ticktickNotesFolder = value.trim().replace(/^\/+|\/+$/g, "") || "TickTick Notes";
      await this.plugin.saveSettings();
    })).addButton((button) => button.setButtonText("\u0627\u0646\u062A\u062E\u0627\u0628 Note\u0647\u0627").onClick(() => void this.plugin.previewTickTickNotes()));
    new import_obsidian8.Setting(containerEl).setName("\u0648\u0631\u0648\u062F \u0645\u0633\u062A\u0642\u0644 \u0628\u0631\u0627\u06CC \u0639\u0627\u062F\u062A\u200C\u0647\u0627").setDesc("\u0645\u0633\u062A\u0642\u06CC\u0645 \u0648\u0627\u0631\u062F TickTick \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0646\u0634\u0633\u062A \u0644\u0627\u0632\u0645 \u0631\u0627 \u062F\u0631 \u062E\u0648\u062F Bridge \u0646\u06AF\u0647 \u0645\u06CC\u200C\u062F\u0627\u0631\u062F. \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648 \u0631\u0645\u0632 \u0630\u062E\u06CC\u0631\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u0646\u062F.").addButton((button) => button.setButtonText("\u0648\u0631\u0648\u062F \u0628\u0647 TickTick").setCta().onClick(async () => {
      const credentials = await new TickTickWebLoginModal(this.app).openAndWait();
      if (!credentials) return;
      button.setDisabled(true);
      try {
        await this.plugin.loginToTickTickWeb(credentials.username, credentials.password);
        new import_obsidian8.Notice("\u0648\u0631\u0648\u062F \u0645\u0633\u062A\u0642\u0644 TickTick \u0627\u0646\u062C\u0627\u0645 \u0634\u062F. \u062D\u0627\u0644\u0627 \u0627\u062A\u0635\u0627\u0644 \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06CC\u0627 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u06A9\u0646.");
        this.display();
      } catch (error) {
        new import_obsidian8.Notice(error instanceof Error ? error.message : "\u0648\u0631\u0648\u062F \u0628\u0647 TickTick \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian8.Setting(containerEl).setName("\u0627\u062A\u0635\u0627\u0644 \u0622\u0633\u0627\u0646 \u0627\u0632 TickTickSync").setDesc("\u0646\u0634\u0633\u062A \u0641\u0639\u0627\u0644 TickTickSync \u0631\u0627 \u0648\u0627\u0631\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F \u062A\u0627 \u0686\u06A9\u200C\u0627\u06CC\u0646 \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0641\u0648\u0631\u06CC \u0648 \u062F\u0642\u06CC\u0642 \u062E\u0648\u0627\u0646\u062F\u0647 \u0634\u0648\u0646\u062F. \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u062E\u0648\u0627\u0646\u062F\u0647\u060C \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u06CC\u0627 \u0630\u062E\u06CC\u0631\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.").addButton((button) => button.setButtonText("\u0648\u0627\u0631\u062F \u06A9\u0631\u062F\u0646 \u0627\u062A\u0635\u0627\u0644 TickTickSync").setCta().onClick(async () => {
      button.setDisabled(true);
      try {
        const result = await this.plugin.importTickTickSyncSession();
        new import_obsidian8.Notice(result.hasCookie ? "\u0627\u062A\u0635\u0627\u0644 TickTickSync \u0648\u0627\u0631\u062F \u0634\u062F." : "\u0627\u062A\u0635\u0627\u0644 TickTickSync \u0648\u0627\u0631\u062F \u0634\u062F\u061B \u062F\u0631 \u0635\u0648\u0631\u062A \u062E\u0637\u0627 \u06CC\u06A9\u200C\u0628\u0627\u0631 \u0627\u0641\u0632\u0648\u0646\u0647\u0654 \u0642\u062F\u06CC\u0645\u06CC \u0631\u0627 \u0628\u0627\u0632 \u06A9\u0646 \u0648 \u062F\u0648\u0628\u0627\u0631\u0647 \u0627\u0645\u062A\u062D\u0627\u0646 \u06A9\u0646.");
        this.display();
      } catch (error) {
        new import_obsidian8.Notice(error instanceof Error ? error.message : "\u0648\u0627\u0631\u062F \u06A9\u0631\u062F\u0646 \u0627\u062A\u0635\u0627\u0644 TickTickSync \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian8.Setting(containerEl).setName("Cookie \u062A\u06A9\u0645\u06CC\u0644\u06CC \u0648\u0628 (\u0627\u062E\u062A\u06CC\u0627\u0631\u06CC)").setDesc("\u0641\u0642\u0637 \u0627\u06AF\u0631 \u0627\u062A\u0635\u0627\u0644 \u062E\u0648\u062F\u06A9\u0627\u0631 \u062C\u0648\u0627\u0628 \u0646\u062F\u0627\u062F\u060C Cookie \u0646\u0634\u0633\u062A \u0648\u0628 TickTick \u0631\u0627 \u0627\u06CC\u0646\u062C\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646. \u0627\u06CC\u0646 \u0645\u0642\u062F\u0627\u0631 \u0645\u0627\u0646\u0646\u062F \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0627\u0633\u062A.").addText((input) => {
      input.inputEl.type = "password";
      input.inputEl.addClass("ticktick-input-cookie");
      input.setValue(this.plugin.settings.webSessionCookie).onChange(async (value) => {
        this.plugin.settings.webSessionCookie = normalizeWebSessionCookie(value);
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian8.Setting(containerEl).setName("\u0628\u0631\u0631\u0633\u06CC \u0627\u062A\u0635\u0627\u0644 \u0648\u0628 \u0639\u0627\u062F\u062A\u200C\u0647\u0627").setDesc("\u0686\u06A9\u200C\u0627\u06CC\u0646\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632 \u0631\u0627 \u0645\u0633\u062A\u0642\u06CC\u0645\u0627\u064B \u0627\u0632 \u0633\u0631\u0648\u06CC\u0633 \u0648\u0628 TickTick \u0645\u06CC\u200C\u062E\u0648\u0627\u0646\u062F.").addButton((button) => button.setButtonText("\u0627\u062A\u0635\u0627\u0644 \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646").onClick(async () => {
      button.setDisabled(true);
      try {
        const habits = await this.plugin.client().listHabits();
        const checkins = await this.plugin.webHabitCheckins(habits.map((habit) => habit.id), todayInZone(this.plugin.settings.timeZone));
        if (!checkins) throw new Error("\u0646\u0634\u0633\u062A \u0648\u0628 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A \u06CC\u0627 TickTick \u067E\u0627\u0633\u062E \u0646\u062F\u0627\u062F.");
        const count = [...checkins.values()].flat().filter((entry) => entry.status === 2).length;
        new import_obsidian8.Notice(`\u0627\u062A\u0635\u0627\u0644 \u0648\u0628 \u0628\u0631\u0642\u0631\u0627\u0631 \u0627\u0633\u062A: ${count} \u0686\u06A9\u200C\u0627\u06CC\u0646 \u0627\u0645\u0631\u0648\u0632 \u062E\u0648\u0627\u0646\u062F\u0647 \u0634\u062F.`);
      } catch (error) {
        new import_obsidian8.Notice(error instanceof Error ? error.message : "\u0627\u062A\u0635\u0627\u0644 \u0648\u0628 \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian8.Setting(containerEl).setName("\u0628\u0631\u0631\u0633\u06CC \u0627\u062A\u0635\u0627\u0644").setDesc("\u0628\u0627 \u062A\u0648\u06A9\u0646 \u0648\u0627\u0631\u062F\u0634\u062F\u0647\u060C \u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627 \u0648 \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0631\u0627 \u0627\u0632 TickTick \u0645\u06CC\u200C\u062E\u0648\u0627\u0646\u062F.").addButton((button) => button.setButtonText("\u0627\u062A\u0635\u0627\u0644 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646").onClick(async () => {
      button.setDisabled(true);
      try {
        const client = this.plugin.client();
        const [projects, habits] = await Promise.all([client.listProjects(), client.listHabits()]);
        new import_obsidian8.Notice(`\u0627\u062A\u0635\u0627\u0644 \u0628\u0631\u0642\u0631\u0627\u0631 \u0627\u0633\u062A: ${projects.length} \u067E\u0631\u0648\u0698\u0647 \u0648 ${habits.length} \u0639\u0627\u062F\u062A \u067E\u06CC\u062F\u0627 \u0634\u062F.`);
      } catch (error) {
        new import_obsidian8.Notice(error instanceof Error ? error.message : "\u0627\u062A\u0635\u0627\u0644 \u0628\u0647 TickTick \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian8.Setting(containerEl).setName("\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u062E\u0648\u062F\u06A9\u0627\u0631").setDesc("\u0641\u0627\u0635\u0644\u0647\u0654 \u0632\u0645\u0627\u0646\u06CC \u0628\u0631 \u062D\u0633\u0628 \u062B\u0627\u0646\u06CC\u0647 (\u062D\u062F\u0627\u0642\u0644 \u06F3\u06F0 \u062B\u0627\u0646\u06CC\u0647). \u0635\u0641\u0631 \u06CC\u0639\u0646\u06CC \u062E\u0627\u0645\u0648\u0634. \u0646\u0645\u0627\u06CC\u0634 \u0627\u0632 \u0646\u0633\u062E\u0647\u0654 \u0645\u062D\u0644\u06CC \u0641\u0648\u0631\u06CC \u0627\u0633\u062A \u0648 \u0627\u06CC\u0646 \u0632\u0645\u0627\u0646 \u0641\u0642\u0637 \u0628\u0631\u0627\u06CC \u062A\u0627\u0632\u0647\u200C\u0633\u0627\u0632\u06CC \u0622\u0646 \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F.").addText((input) => {
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
    new import_obsidian8.Setting(containerEl).setName("\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u062F\u0633\u062A\u06CC").setDesc("\u0646\u0633\u062E\u0647\u0654 \u0645\u062D\u0644\u06CC \u062A\u0633\u06A9\u200C\u0647\u0627\u060C \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0648 \u062A\u0627\u0631\u06CC\u062E\u0686\u0647\u0654 \u06F9\u06F0 \u0631\u0648\u0632 \u0627\u062E\u06CC\u0631 \u0631\u0627 \u0647\u0645\u06CC\u0646 \u062D\u0627\u0644\u0627 \u0627\u0632 TickTick \u062A\u0627\u0632\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F.").addButton((button) => button.setButtonText("\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0627\u0644\u0622\u0646").onClick(async () => {
      button.setDisabled(true);
      try {
        await this.plugin.syncNow();
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian8.Setting(containerEl).setName("\u062A\u0642\u0648\u06CC\u0645 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC").setDesc("\u0647\u0641\u062A\u0647 \u0648 \u0634\u0628\u06A9\u0647\u0654 \u0645\u0627\u0647 \u0647\u0645\u06CC\u0634\u0647 \u0627\u0632 \u0634\u0646\u0628\u0647 \u0634\u0631\u0648\u0639 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F \u0648 \u062A\u0633\u06A9 \u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647 \u0628\u0647\u200C\u0635\u0648\u0631\u062A \u067E\u06CC\u0634\u200C\u0641\u0631\u0636 \u067E\u0646\u0647\u0627\u0646 \u0627\u0633\u062A.").addToggle((toggle) => toggle.setValue(this.plugin.settings.plannerShowCompleted).setTooltip("\u0646\u0645\u0627\u06CC\u0634 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647 \u062F\u0631 \u062A\u0642\u0648\u06CC\u0645").onChange(async (value) => {
      this.plugin.settings.plannerShowCompleted = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian8.Setting(containerEl).setName("\u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0645\u062D\u0644\u06CC").setDesc("\u0645\u0646\u0628\u0639 \u0641\u0642\u0637\u200C\u062E\u0648\u0627\u0646\u062F\u0646\u06CC \u0628\u0631\u0627\u06CC \u062F\u0627\u0634\u0628\u0648\u0631\u062F \u0648 \u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 \u0645\u0647\u0627\u062C\u0631\u062A\u061B \u0641\u0627\u06CC\u0644\u200C\u0647\u0627 \u0647\u0631\u06AF\u0632 \u062E\u0648\u062F\u06A9\u0627\u0631 \u062A\u063A\u06CC\u06CC\u0631 \u06CC\u0627 \u062D\u0630\u0641 \u0646\u0645\u06CC\u200C\u0634\u0648\u0646\u062F.").addText((input) => input.setValue(this.plugin.settings.localHabitFolder).onChange(async (value) => {
      this.plugin.settings.localHabitFolder = value.trim().replace(/^\/+|\/+$/g, "");
      await this.plugin.saveSettings();
    })).addButton((button) => button.setButtonText("\u0645\u0631\u0648\u0631 \u0639\u0627\u062F\u062A\u200C\u0647\u0627").onClick(async () => {
      button.setDisabled(true);
      try {
        await this.plugin.reviewLocalHabits();
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian8.Setting(containerEl).setName("\u0622\u06CC\u06A9\u0648\u0646\u200C\u0647\u0627\u06CC \u0627\u0636\u0627\u0641\u06CC \u0646\u0648\u0627\u0631 \u06A9\u0646\u0627\u0631\u06CC").setDesc("\u0622\u06CC\u06A9\u0648\u0646 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0647\u0645\u06CC\u0634\u0647 \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F. \u0628\u0627 \u0631\u0648\u0634\u0646\u200C\u06A9\u0631\u062F\u0646 \u0627\u06CC\u0646 \u06AF\u0632\u06CC\u0646\u0647\u060C \u0645\u06CC\u0627\u0646\u0628\u0631 \u062A\u0633\u06A9\u200C\u0647\u0627 \u0648 \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0647\u0645 \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F.").addToggle((toggle) => toggle.setValue(this.plugin.settings.showRibbonIcons).onChange(async (value) => {
      this.plugin.settings.showRibbonIcons = value;
      await this.plugin.saveSettings();
      this.plugin.configureRibbonIcons();
    }));
    new import_obsidian8.Setting(containerEl).setName("Time zone").addText((input) => input.setValue(this.plugin.settings.timeZone).onChange(async (value) => {
      this.plugin.settings.timeZone = value || "Asia/Tehran";
      await this.plugin.saveSettings();
    }));
    new import_obsidian8.Setting(containerEl).setName("Daily notes folder").addText((input) => input.setValue(this.plugin.settings.dailyNoteFolder).onChange(async (value) => {
      this.plugin.settings.dailyNoteFolder = value;
      await this.plugin.saveSettings();
    }));
  }
};
var LegacyBackupMigrationModal = class extends import_obsidian8.Modal {
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
var ManagedReportModal = class extends import_obsidian8.Modal {
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
function publicCacheMetadata(cache) {
  const task = (item) => ({ id: item?.id, projectId: item?.projectId, title: item?.title, status: item?.status, dueDate: item?.dueDate, startDate: item?.startDate });
  const habit = (item) => ({ id: item?.id, name: item?.name, status: item?.status, sectionId: item?.sectionId, sectionName: item?.sectionName });
  return { savedAt: cache.savedAt, tasks: cache.tasks.map(task), habits: cache.habits.map(habit), pendingCount: cache.pending.length, conflictCount: cache.conflicts.length };
}
