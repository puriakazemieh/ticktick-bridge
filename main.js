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
var __toCommonJS = (mod2) => __copyProps(__defProp({}, "__esModule", { value: true }), mod2);

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
function gregorianDateKeyToJalali(dateKey2) {
  if (!dateKey2) return null;
  const dt = /* @__PURE__ */ new Date(`${dateKey2}T12:00:00Z`);
  if (isNaN(dt.getTime())) return null;
  const formatter = new Intl.DateTimeFormat("en-US-u-ca-persian", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = Object.fromEntries(formatter.formatToParts(dt).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
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
var init_date = __esm({
  "src/core/date.js"() {
    "use strict";
  }
});

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
function isTaskUnscheduled(task, timeZone = "Asia/Tehran") {
  if (Number(task?.status ?? 0) !== 0) return false;
  const due = toDateKey(task?.dueDate, task?.timeZone || timeZone);
  const start = toDateKey(task?.startDate, task?.timeZone || timeZone);
  return !due && !start;
}
function unscheduledTasks(tasks, timeZone = "Asia/Tehran", sortMode = "ticktick") {
  return sortPlanningTasks((tasks ?? []).filter((task) => isTaskUnscheduled(task, timeZone)), sortMode);
}
function taskHourSlot(task) {
  if (task?.isAllDay) return null;
  const time = taskTime(task);
  if (!time) return null;
  const hour = time.slice(0, 2);
  return `${hour}:00`;
}
var HOURLY_SLOTS;
var init_calendar_range = __esm({
  "src/core/calendar-range.js"() {
    "use strict";
    init_date();
    HOURLY_SLOTS = [
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00"
    ];
  }
});

// src/core/task-filter.js
function normalizeSearchText(text) {
  if (typeof text !== "string") return "";
  return text.replace(/\u0643/g, "\u06A9").replace(/[\u0649\u064A]/g, "\u06CC").replace(/\u0629/g, "\u0647").replace(/[\u064B-\u065F\u0670]/g, "").replace(/[\u200C\u200B]/g, " ").toLowerCase().trim();
}
function fuzzyMatchesText(query, target) {
  const normQuery = normalizeSearchText(query);
  if (!normQuery) return true;
  const normTarget = normalizeSearchText(target);
  if (!normTarget) return false;
  if (normTarget.includes(normQuery)) return true;
  const queryNoSpace = normQuery.replace(/\s+/g, "");
  const targetNoSpace = normTarget.replace(/\s+/g, "");
  return targetNoSpace.includes(queryNoSpace);
}
function matchesTaskFilter(task, filter = {}, options = {}) {
  if (!task) return false;
  if (Array.isArray(filter.projects) && filter.projects.length > 0) {
    const taskProjId = String(task.projectId ?? "");
    const taskProjName = String(task.projectName ?? "");
    const matchesProj = filter.projects.some((p) => p === taskProjId || p === taskProjName);
    if (!matchesProj) return false;
  }
  if (Array.isArray(filter.tags) && filter.tags.length > 0) {
    const taskTags = Array.isArray(task.tags) ? task.tags.map(String) : [];
    const matchesTag = filter.tags.some((t) => taskTags.includes(t));
    if (!matchesTag) return false;
  }
  if (Array.isArray(filter.statuses) && filter.statuses.length > 0) {
    const taskStatus = Number(task.status ?? 0);
    if (!filter.statuses.includes(taskStatus)) return false;
  }
  if (Array.isArray(filter.priorities) && filter.priorities.length > 0) {
    const taskPriority2 = Number(task.priority ?? 0);
    if (!filter.priorities.includes(taskPriority2)) return false;
  }
  if (filter.dateRange && (filter.dateRange.start || filter.dateRange.end)) {
    const timeZone = options.timeZone || "Asia/Tehran";
    const due = task.dueDate ? toDateKey(task.dueDate, timeZone) : null;
    const start = task.startDate ? toDateKey(task.startDate, timeZone) : null;
    const effectiveDate = due || start;
    if (!effectiveDate) {
      return false;
    }
    if (filter.dateRange.start && effectiveDate < filter.dateRange.start) {
      return false;
    }
    if (filter.dateRange.end && effectiveDate > filter.dateRange.end) {
      return false;
    }
  }
  if (filter.searchText && String(filter.searchText).trim()) {
    const query = String(filter.searchText).trim();
    const title = String(task.title ?? "");
    const content = String(task.content ?? task.desc ?? "");
    const tags = Array.isArray(task.tags) ? task.tags.join(" ") : "";
    const combined = `${title} ${content} ${tags}`;
    if (!fuzzyMatchesText(query, combined)) {
      return false;
    }
  }
  return true;
}
function createSavedView(name, filterState = {}, options = {}) {
  const cleanName = String(name ?? "").trim() || "\u0646\u0645\u0627\u06CC \u0630\u062E\u06CC\u0631\u0647\u200C\u0634\u062F\u0647";
  const id = options.id || `view_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    id,
    name: cleanName,
    scope: options.scope || "all",
    filter: {
      projects: Array.isArray(filterState.projects) ? [...filterState.projects] : [],
      tags: Array.isArray(filterState.tags) ? [...filterState.tags] : [],
      statuses: Array.isArray(filterState.statuses) ? [...filterState.statuses] : [],
      priorities: Array.isArray(filterState.priorities) ? [...filterState.priorities] : [],
      dateRange: filterState.dateRange ? { ...filterState.dateRange } : null,
      searchText: String(filterState.searchText ?? "").trim(),
      grouping: filterState.grouping || "none",
      sort: filterState.sort || "ticktick"
    },
    createdAt: options.createdAt || now,
    updatedAt: now
  };
}
var DEFAULT_TASK_FILTER;
var init_task_filter = __esm({
  "src/core/task-filter.js"() {
    "use strict";
    init_date();
    DEFAULT_TASK_FILTER = Object.freeze({
      projects: [],
      tags: [],
      statuses: [],
      priorities: [],
      dateRange: null,
      searchText: "",
      grouping: "none",
      sort: "ticktick"
    });
  }
});

// src/core/project-board.js
var project_board_exports = {};
__export(project_board_exports, {
  ALL_BOARD_VIEW_ID: () => ALL_BOARD_VIEW_ID,
  COMPLETED_BOARD_VIEW_ID: () => COMPLETED_BOARD_VIEW_ID,
  HIGH_PRIORITY_BOARD_VIEW_ID: () => HIGH_PRIORITY_BOARD_VIEW_ID,
  INBOX_BOARD_VIEW_ID: () => INBOX_BOARD_VIEW_ID,
  OVERDUE_BOARD_VIEW_ID: () => OVERDUE_BOARD_VIEW_ID,
  RECURRING_BOARD_VIEW_ID: () => RECURRING_BOARD_VIEW_ID,
  SAVED_BOARD_VIEW_PREFIX: () => SAVED_BOARD_VIEW_PREFIX,
  TAG_BOARD_VIEW_PREFIX: () => TAG_BOARD_VIEW_PREFIX,
  TODAY_BOARD_VIEW_ID: () => TODAY_BOARD_VIEW_ID,
  UNSCHEDULED_BOARD_VIEW_ID: () => UNSCHEDULED_BOARD_VIEW_ID,
  UPCOMING_BOARD_VIEW_ID: () => UPCOMING_BOARD_VIEW_ID,
  boardColumns: () => boardColumns,
  normalizeProjectData: () => normalizeProjectData,
  selectSmartViewTasks: () => selectSmartViewTasks,
  sidebarTree: () => sidebarTree,
  virtualBoardData: () => virtualBoardData,
  virtualBoardEntries: () => virtualBoardEntries
});
function normalizeProjectData(document2 = {}, fallbackProject = {}) {
  const project = { ...fallbackProject, ...document2.project ?? {}, id: document2.project?.id ?? fallbackProject.id ?? document2.projectId, name: document2.project?.name ?? fallbackProject.name ?? "\u0628\u062F\u0648\u0646 \u0646\u0627\u0645" };
  const columns = (document2.columns ?? []).map((column, index) => ({ id: String(column.id ?? ""), name: String(column.name ?? `\u0633\u062A\u0648\u0646 ${index + 1}`), sortOrder: Number(column.sortOrder ?? index) }));
  const names = new Map(columns.map((column) => [column.id, column.name]));
  const tasks = (document2.tasks ?? []).map((task) => ({ ...task, projectId: task.projectId ?? project.id, projectName: project.name, projectColor: project.color, columnId: task.columnId ?? "", columnName: names.get(String(task.columnId ?? "")) ?? "Tasks" }));
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
function virtualBoardEntries(tasks = [], options = {}) {
  const timeZone = options.timeZone || "Asia/Tehran";
  const todayKey = options.todayKey || todayInZone(timeZone);
  const open = tasks.filter((task) => Number(task?.status ?? 0) === 0);
  const tags = /* @__PURE__ */ new Map();
  for (const task of open) {
    for (const tag of Array.isArray(task.tags) ? task.tags : []) {
      const name = String(tag ?? "").trim();
      if (name) tags.set(name, (tags.get(name) ?? 0) + 1);
    }
  }
  const tomorrow = shiftCalendarDay(todayKey, 1);
  const nextWeekEnd = shiftCalendarDay(todayKey, 7);
  const recurringCount = open.filter((task) => Boolean(task.repeatFlag)).length;
  const unscheduledCount = open.filter((task) => !toDateKey(task.dueDate, task.timeZone || timeZone) && !toDateKey(task.startDate, task.timeZone || timeZone)).length;
  const todayCount = open.filter((task) => {
    const due = toDateKey(task.dueDate, task.timeZone || timeZone);
    const start = toDateKey(task.startDate, task.timeZone || timeZone);
    if (due === todayKey || start === todayKey) return true;
    if (start && due && start <= todayKey && due >= todayKey) return true;
    return false;
  }).length;
  const upcomingCount = open.filter((task) => {
    const due = toDateKey(task.dueDate, task.timeZone || timeZone) ?? toDateKey(task.startDate, task.timeZone || timeZone);
    return Boolean(due && due >= tomorrow && due <= nextWeekEnd);
  }).length;
  const overdueCount = open.filter((task) => {
    const due = toDateKey(task.dueDate, task.timeZone || timeZone);
    return Boolean(due && due < todayKey);
  }).length;
  const inboxCount = open.filter((task) => Boolean(task.isInbox) || String(task.projectId ?? "").toLowerCase() === "inbox" || !task.projectId).length;
  const highPriorityCount = open.filter((task) => Number(task.priority) === 5).length;
  const completedCount = tasks.filter((task) => Number(task.status ?? 0) !== 0).length;
  const smartViews = [
    { id: RECURRING_BOARD_VIEW_ID, key: "recurring", name: "\u062A\u06A9\u0631\u0627\u0631\u0634\u0648\u0646\u062F\u0647\u200C\u0647\u0627", icon: "repeat-2", count: recurringCount },
    { id: UNSCHEDULED_BOARD_VIEW_ID, key: "unscheduled", name: "\u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E", icon: "calendar-off", count: unscheduledCount },
    { id: TODAY_BOARD_VIEW_ID, key: "today", name: "\u0627\u0645\u0631\u0648\u0632", icon: "sun", count: todayCount },
    { id: UPCOMING_BOARD_VIEW_ID, key: "upcoming", name: "\u0647\u0641\u062A\u0647\u0654 \u0622\u06CC\u0646\u062F\u0647", icon: "calendar-days", count: upcomingCount },
    { id: OVERDUE_BOARD_VIEW_ID, key: "overdue", name: "\u0639\u0642\u0628\u200C\u0627\u0641\u062A\u0627\u062F\u0647", icon: "alert-circle", count: overdueCount },
    { id: INBOX_BOARD_VIEW_ID, key: "inbox", name: "\u0648\u0631\u0648\u062F\u06CC", icon: "inbox", count: inboxCount },
    { id: HIGH_PRIORITY_BOARD_VIEW_ID, key: "highPriority", name: "\u0627\u0648\u0644\u0648\u06CC\u062A \u0628\u0627\u0644\u0627", icon: "alert-triangle", count: highPriorityCount },
    { id: COMPLETED_BOARD_VIEW_ID, key: "completed", name: "\u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647\u200C\u0647\u0627", icon: "check-circle-2", count: completedCount }
  ];
  return {
    all: { id: ALL_BOARD_VIEW_ID, name: "\u0647\u0645\u0647\u0654 \u0644\u06CC\u0633\u062A\u200C\u0647\u0627", count: open.length },
    inbox: { id: INBOX_BOARD_VIEW_ID, name: "\u0648\u0631\u0648\u062F\u06CC", count: inboxCount },
    recurring: { id: RECURRING_BOARD_VIEW_ID, name: "\u062A\u06A9\u0631\u0627\u0631\u0634\u0648\u0646\u062F\u0647\u200C\u0647\u0627", count: recurringCount },
    unscheduled: { id: UNSCHEDULED_BOARD_VIEW_ID, name: "\u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E", count: unscheduledCount },
    today: { id: TODAY_BOARD_VIEW_ID, name: "\u0627\u0645\u0631\u0648\u0632", count: todayCount },
    upcoming: { id: UPCOMING_BOARD_VIEW_ID, name: "\u0647\u0641\u062A\u0647\u0654 \u0622\u06CC\u0646\u062F\u0647", count: upcomingCount },
    overdue: { id: OVERDUE_BOARD_VIEW_ID, name: "\u0639\u0642\u0628\u200C\u0627\u0641\u062A\u0627\u062F\u0647", count: overdueCount },
    highPriority: { id: HIGH_PRIORITY_BOARD_VIEW_ID, name: "\u0627\u0648\u0644\u0648\u06CC\u062A \u0628\u0627\u0644\u0627", count: highPriorityCount },
    completed: { id: COMPLETED_BOARD_VIEW_ID, name: "\u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647\u200C\u0647\u0627", count: completedCount },
    smartViews,
    savedViews: (Array.isArray(options.savedViews) ? options.savedViews : []).map((view) => ({
      id: `${SAVED_BOARD_VIEW_PREFIX}${view.id}`,
      viewId: view.id,
      name: view.name,
      icon: "bookmark",
      count: view.filter?.statuses && view.filter.statuses.length > 0 ? tasks.filter((task) => matchesTaskFilter(task, view.filter, options)).length : open.filter((task) => matchesTaskFilter(task, view.filter, options)).length,
      rawView: view
    })),
    tags: [...tags.entries()].sort(([left], [right]) => left.localeCompare(right, "fa")).map(([name, count]) => ({ id: `${TAG_BOARD_VIEW_PREFIX}${encodeURIComponent(name)}`, name, count }))
  };
}
function selectSmartViewTasks(selection, tasks = [], options = {}) {
  const timeZone = options.timeZone || "Asia/Tehran";
  const todayKey = options.todayKey || todayInZone(timeZone);
  const open = tasks.filter((task) => Number(task?.status ?? 0) === 0);
  if (selection === ALL_BOARD_VIEW_ID) {
    return { name: "\u0647\u0645\u0647\u0654 \u0644\u06CC\u0633\u062A\u200C\u0647\u0627", tasks: open };
  }
  if (selection === RECURRING_BOARD_VIEW_ID) {
    return { name: "\u062A\u06A9\u0631\u0627\u0631\u0634\u0648\u0646\u062F\u0647\u200C\u0647\u0627", tasks: open.filter((task) => Boolean(task.repeatFlag)) };
  }
  if (selection === UNSCHEDULED_BOARD_VIEW_ID) {
    return {
      name: "\u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E",
      tasks: open.filter((task) => !toDateKey(task.dueDate, task.timeZone || timeZone) && !toDateKey(task.startDate, task.timeZone || timeZone))
    };
  }
  if (selection === TODAY_BOARD_VIEW_ID) {
    return {
      name: "\u0627\u0645\u0631\u0648\u0632",
      tasks: open.filter((task) => {
        const due = toDateKey(task.dueDate, task.timeZone || timeZone);
        const start = toDateKey(task.startDate, task.timeZone || timeZone);
        if (due === todayKey || start === todayKey) return true;
        if (start && due && start <= todayKey && due >= todayKey) return true;
        return false;
      })
    };
  }
  if (selection === UPCOMING_BOARD_VIEW_ID) {
    const tomorrow = shiftCalendarDay(todayKey, 1);
    const nextWeekEnd = shiftCalendarDay(todayKey, 7);
    return {
      name: "\u0647\u0641\u062A\u0647\u0654 \u0622\u06CC\u0646\u062F\u0647",
      tasks: open.filter((task) => {
        const due = toDateKey(task.dueDate, task.timeZone || timeZone) ?? toDateKey(task.startDate, task.timeZone || timeZone);
        return Boolean(due && due >= tomorrow && due <= nextWeekEnd);
      })
    };
  }
  if (selection === OVERDUE_BOARD_VIEW_ID) {
    return {
      name: "\u0639\u0642\u0628\u200C\u0627\u0641\u062A\u0627\u062F\u0647",
      tasks: open.filter((task) => {
        const due = toDateKey(task.dueDate, task.timeZone || timeZone);
        return Boolean(due && due < todayKey);
      })
    };
  }
  if (selection === INBOX_BOARD_VIEW_ID) {
    return {
      name: "\u0648\u0631\u0648\u062F\u06CC",
      tasks: open.filter((task) => Boolean(task.isInbox) || String(task.projectId ?? "").toLowerCase() === "inbox" || !task.projectId)
    };
  }
  if (selection === HIGH_PRIORITY_BOARD_VIEW_ID) {
    return {
      name: "\u0627\u0648\u0644\u0648\u06CC\u062A \u0628\u0627\u0644\u0627",
      tasks: open.filter((task) => Number(task.priority) === 5)
    };
  }
  if (selection === COMPLETED_BOARD_VIEW_ID) {
    return {
      name: "\u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647\u200C\u0647\u0627",
      tasks: tasks.filter((task) => Number(task.status ?? 0) !== 0)
    };
  }
  if (String(selection ?? "").startsWith(TAG_BOARD_VIEW_PREFIX)) {
    const tag = decodeURIComponent(String(selection).slice(TAG_BOARD_VIEW_PREFIX.length));
    return {
      name: `#${tag}`,
      tasks: open.filter((task) => (task.tags ?? []).some((value) => String(value) === tag))
    };
  }
  if (String(selection ?? "").startsWith(SAVED_BOARD_VIEW_PREFIX)) {
    const viewId = String(selection).slice(SAVED_BOARD_VIEW_PREFIX.length);
    const savedViews = Array.isArray(options.savedViews) ? options.savedViews : [];
    const view = savedViews.find((v) => String(v.id) === viewId);
    if (view) {
      const matching = view.filter?.statuses && view.filter.statuses.length > 0 ? tasks.filter((task) => matchesTaskFilter(task, view.filter, options)) : open.filter((task) => matchesTaskFilter(task, view.filter, options));
      return {
        name: view.name,
        tasks: matching,
        savedView: view
      };
    }
  }
  return null;
}
function virtualBoardData(selection, tasks = [], projects = [], options = {}) {
  const selected = selectSmartViewTasks(selection, tasks, options);
  if (!selected) return null;
  const { name, tasks: matching, savedView } = selected;
  const grouping = options.grouping || savedView?.grouping || "project";
  const timeZone = options.timeZone || "Asia/Tehran";
  const todayKey = options.todayKey || todayInZone(timeZone);
  let columns = [];
  let mappedTasks = [];
  if (grouping === "priority") {
    columns = [
      { id: "p-high", name: "\u0627\u0648\u0644\u0648\u06CC\u062A \u0628\u0627\u0644\u0627", color: "var(--text-error, #e53935)", sortOrder: 0, synthetic: true },
      { id: "p-medium", name: "\u0627\u0648\u0644\u0648\u06CC\u062A \u0645\u062A\u0648\u0633\u0637", color: "var(--text-warning, #fb8c00)", sortOrder: 1, synthetic: true },
      { id: "p-low", name: "\u0627\u0648\u0644\u0648\u06CC\u062A \u067E\u0627\u06CC\u06CC\u0646", color: "var(--text-accent, #1e88e5)", sortOrder: 2, synthetic: true },
      { id: "p-none", name: "\u0628\u062F\u0648\u0646 \u0627\u0648\u0644\u0648\u06CC\u062A", color: "var(--text-muted, #757575)", sortOrder: 3, synthetic: true }
    ];
    mappedTasks = matching.map((task) => {
      const priority = Number(task.priority ?? 0);
      const columnId = priority === 5 ? "p-high" : priority === 3 ? "p-medium" : priority === 1 ? "p-low" : "p-none";
      return { ...task, columnId };
    });
  } else if (grouping === "date") {
    const tomorrow = shiftCalendarDay(todayKey, 1);
    const nextWeekEnd = shiftCalendarDay(todayKey, 7);
    const dateDefs = [
      { id: "d-overdue", name: "\u0639\u0642\u0628\u200C\u0627\u0641\u062A\u0627\u062F\u0647", color: "var(--text-error, #e53935)", sortOrder: 0, synthetic: true },
      { id: "d-today", name: "\u0627\u0645\u0631\u0648\u0632", color: "var(--interactive-accent, #2196f3)", sortOrder: 1, synthetic: true },
      { id: "d-tomorrow", name: "\u0641\u0631\u062F\u0627", color: "var(--text-accent, #00acc1)", sortOrder: 2, synthetic: true },
      { id: "d-week", name: "\u0627\u06CC\u0646 \u0647\u0641\u062A\u0647", color: "var(--text-success, #43a047)", sortOrder: 3, synthetic: true },
      { id: "d-later", name: "\u0622\u06CC\u0646\u062F\u0647", color: "var(--text-muted, #7e57c2)", sortOrder: 4, synthetic: true },
      { id: "d-unscheduled", name: "\u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E", color: "var(--text-muted, #9e9e9e)", sortOrder: 5, synthetic: true }
    ];
    mappedTasks = matching.map((task) => {
      const due = toDateKey(task.dueDate, task.timeZone || timeZone) ?? toDateKey(task.startDate, task.timeZone || timeZone);
      let columnId = "d-unscheduled";
      if (!due) columnId = "d-unscheduled";
      else if (due < todayKey) columnId = "d-overdue";
      else if (due === todayKey) columnId = "d-today";
      else if (due === tomorrow) columnId = "d-tomorrow";
      else if (due <= nextWeekEnd) columnId = "d-week";
      else columnId = "d-later";
      return { ...task, columnId };
    });
    const usedColIds = new Set(mappedTasks.map((t) => t.columnId));
    columns = dateDefs.filter((d) => usedColIds.has(d.id));
    if (columns.length === 0) columns = dateDefs;
  } else if (grouping === "tag") {
    const allTags = /* @__PURE__ */ new Set();
    let hasUntagged = false;
    for (const task of matching) {
      const taskTags = Array.isArray(task.tags) ? task.tags : [];
      if (taskTags.length === 0) {
        hasUntagged = true;
      } else {
        for (const t of taskTags) {
          const clean = String(t ?? "").trim();
          if (clean) allTags.add(clean);
        }
      }
    }
    const sortedTags = [...allTags].sort((a, b) => a.localeCompare(b, "fa"));
    columns = sortedTags.map((tag, index) => ({
      id: `t-${encodeURIComponent(tag)}`,
      name: `#${tag}`,
      sortOrder: index,
      synthetic: true
    }));
    if (hasUntagged || columns.length === 0) {
      columns.push({
        id: "t-none",
        name: "\u0628\u062F\u0648\u0646 \u0628\u0631\u0686\u0633\u0628",
        sortOrder: columns.length,
        synthetic: true
      });
    }
    mappedTasks = matching.map((task) => {
      const taskTags = Array.isArray(task.tags) ? task.tags : [];
      const primaryTag = taskTags.find((t) => String(t ?? "").trim());
      const columnId = primaryTag ? `t-${encodeURIComponent(primaryTag)}` : "t-none";
      return { ...task, columnId };
    });
  } else {
    const usedProjectIds = new Set(matching.map((task) => String(task.projectId ?? "")));
    columns = projects.filter((project) => usedProjectIds.has(String(project.id))).map((project, index) => ({
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
    mappedTasks = matching.map((task) => ({ ...task, columnId: String(task.projectId ?? "") }));
  }
  return {
    project: { id: selection, name, virtual: true, grouping },
    columns,
    tasks: mappedTasks
  };
}
function boardColumns(data, showCompleted = false) {
  const isCompletedView = data.project?.id === COMPLETED_BOARD_VIEW_ID;
  const effectiveShowCompleted = showCompleted || isCompletedView;
  const columns = data.columns.length ? data.columns : [{ id: "", name: "Tasks", synthetic: true, sortOrder: 0 }];
  const isPriorityGrouping = data.project?.grouping === "priority";
  return columns.map((column) => {
    const matching = data.tasks.filter((task) => String(task.columnId ?? "") === String(column.id) && (effectiveShowCompleted || Number(task.status ?? 0) === 0));
    const ordered = matching.slice().sort((a, b) => Number(isPinned(b)) - Number(isPinned(a)) || Number(a.sortOrder ?? a.order ?? 0) - Number(b.sortOrder ?? b.order ?? 0) || String(a.title).localeCompare(String(b.title), "fa"));
    if (isPriorityGrouping) {
      const groups2 = [
        { name: "Pinned", tasks: ordered.filter((task) => isPinned(task)) },
        { name: "", tasks: ordered.filter((task) => !isPinned(task)) }
      ].filter((group) => group.tasks.length);
      return { ...column, count: matching.length, groups: groups2 };
    }
    const groups = ["Pinned", "High", "Medium", "Low", "No priority", ...effectiveShowCompleted ? ["Completed"] : []].map((name) => ({ name, tasks: ordered.filter((task) => {
      if (name === "Pinned") return isPinned(task);
      if (isPinned(task)) return false;
      return Number(task.status ?? 0) !== 0 ? name === "Completed" : groupName(task.priority) === name;
    }) })).filter((group) => group.tasks.length);
    return { ...column, count: matching.length, groups };
  });
}
var RECURRING_BOARD_VIEW_ID, ALL_BOARD_VIEW_ID, INBOX_BOARD_VIEW_ID, UNSCHEDULED_BOARD_VIEW_ID, TODAY_BOARD_VIEW_ID, UPCOMING_BOARD_VIEW_ID, OVERDUE_BOARD_VIEW_ID, HIGH_PRIORITY_BOARD_VIEW_ID, COMPLETED_BOARD_VIEW_ID, TAG_BOARD_VIEW_PREFIX, SAVED_BOARD_VIEW_PREFIX, isPinned, groupName;
var init_project_board = __esm({
  "src/core/project-board.js"() {
    "use strict";
    init_date();
    init_calendar_range();
    init_task_filter();
    RECURRING_BOARD_VIEW_ID = "ticktick:view:recurring";
    ALL_BOARD_VIEW_ID = "ticktick:view:all";
    INBOX_BOARD_VIEW_ID = "ticktick:view:inbox";
    UNSCHEDULED_BOARD_VIEW_ID = "ticktick:view:unscheduled";
    TODAY_BOARD_VIEW_ID = "ticktick:view:today";
    UPCOMING_BOARD_VIEW_ID = "ticktick:view:upcoming";
    OVERDUE_BOARD_VIEW_ID = "ticktick:view:overdue";
    HIGH_PRIORITY_BOARD_VIEW_ID = "ticktick:view:high-priority";
    COMPLETED_BOARD_VIEW_ID = "ticktick:view:completed";
    TAG_BOARD_VIEW_PREFIX = "ticktick:view:tag:";
    SAVED_BOARD_VIEW_PREFIX = "ticktick:view:saved:";
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
var import_obsidian46 = require("obsidian");
init_date();

// src/core/ticktick-client.js
init_date();
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
    const values = new Map((checkinDocuments ?? []).flatMap((document2) => (document2.checkins ?? []).filter((checkin) => Number(checkin.stamp) === toHabitStamp(day)).map((checkin) => [document2.habitId, checkin])));
    return active.map((habit) => ({ ...habit, sectionName: sectionNames.get(habit.sectionId) ?? "\u0628\u062F\u0648\u0646 \u062F\u0633\u062A\u0647", checkin: values.get(habit.id) ?? null }));
  }
  async habitsWithHistory(day, days = 28) {
    const [habits, sections] = await Promise.all([this.listHabits(), this.listHabitSections()]);
    const sectionNames = new Map(sections.map((section) => [section.id, section.name]));
    const start = /* @__PURE__ */ new Date(`${day}T12:00:00Z`);
    start.setUTCDate(start.getUTCDate() - Math.max(0, days - 1));
    const fromDay = start.toISOString().slice(0, 10);
    const documents = await this.getHabitCheckins(habits.map((habit) => habit.id), fromDay, day);
    const checkins = new Map((documents ?? []).flatMap((document2) => (document2.checkins ?? []).map((checkin) => [`${document2.habitId}:${checkin.stamp}`, checkin])));
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
var import_obsidian9 = require("obsidian");

// src/obsidian/habit-card.ts
var import_obsidian4 = require("obsidian");

// src/obsidian/helpers.ts
var import_obsidian3 = require("obsidian");

// src/core/checklist.js
var CHECKLIST_CAPABILITY = Object.freeze({
  UNAVAILABLE: "unavailable",
  READ_ONLY: "read-only",
  ENABLED_UNVERIFIED: "enabled-unverified",
  VERIFIED: "verified"
});
function normalizeChecklist(items) {
  return (Array.isArray(items) ? items : []).map((item, index) => ({
    id: item?.id ? String(item.id) : null,
    title: String(item?.title ?? item?.content ?? "").trim(),
    completed: item?.completed !== void 0 ? Boolean(item.completed) : Number(item?.status ?? 0) !== 0,
    sortOrder: Number(item?.sortOrder ?? index),
    unknown: Object.fromEntries(
      Object.entries(item ?? {}).filter(
        ([key]) => !["id", "title", "content", "status", "sortOrder", "completed", "completedTime", "startDate", "dueDate", "isAllDay", "timeZone"].includes(key)
      )
    )
  })).sort((a, b) => a.sortOrder - b.sortOrder);
}
function checklistSummary(items) {
  const normalized = normalizeChecklist(items);
  return {
    total: normalized.length,
    completed: normalized.filter((item) => item.completed).length
  };
}

// src/obsidian/helpers.ts
init_date();
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
    parentId: draft.parentId !== void 0 ? draft.parentId || null : task.parentId ?? null,
    dueDate: day ? `${day}T00:00:00+0330` : null,
    startDate: task.startDate ?? null,
    timeZone,
    isAllDay: true,
    reminders: reminderTime ? [reminderTrigger(reminderTime)] : [],
    repeatFlag: String(task.repeatFlag ?? "").trim() || null,
    tags: Array.isArray(task.tags) ? task.tags : task.tags ? [String(task.tags)] : void 0
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
    meta.createSpan({
      cls: "ticktick-habit-streak-pill",
      text: `\u{1F525} ${options.streak} \u0631\u0648\u0632`,
      attr: { title: `${options.streak} \u0631\u0648\u0632 \u067E\u06CC\u0648\u0633\u062A\u0647 \u0627\u0646\u062C\u0627\u0645 \u0634\u062F\u0647` }
    });
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

// src/obsidian/planning-calendar.ts
init_calendar_range();
init_date();

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
function reconcileOpenTasks(cached = [], fresh = null) {
  if (fresh === null) return cached.filter((task) => Number(task?.status ?? 0) === 0);
  const details = new Map(cached.filter((task) => task?.id).map((task) => [String(task.id), task]));
  return fresh.filter((task) => task?.id && Number(task.status ?? 0) === 0).map((task) => mergeTaskDetails(details.get(String(task.id)), task));
}

// src/core/persian-date.js
init_date();
function formatPersianDate(value, timeZone = "Asia/Tehran") {
  const day = toDateKey(value, timeZone);
  if (!day) return "\u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" }).format(/* @__PURE__ */ new Date(`${day}T12:00:00Z`));
}

// src/core/task-hierarchy.js
function buildTaskHierarchy(tasks = []) {
  const taskMap = /* @__PURE__ */ new Map();
  const childrenMap = /* @__PURE__ */ new Map();
  const orphaned = [];
  const rootTasks = [];
  for (const task of tasks) {
    if (!task || !task.id) continue;
    const strId = String(task.id);
    taskMap.set(strId, task);
  }
  for (const task of tasks) {
    if (!task || !task.id) continue;
    const strId = String(task.id);
    const parentId = task.parentId ? String(task.parentId) : null;
    if (parentId) {
      if (taskMap.has(parentId)) {
        if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
        childrenMap.get(parentId).push(task);
      } else {
        orphaned.push(task);
        rootTasks.push(task);
      }
    } else {
      rootTasks.push(task);
    }
  }
  return {
    rootTasks,
    orphanedSubtasks: orphaned,
    childrenMap,
    getChildTasks: (parentId) => childrenMap.get(String(parentId)) || [],
    getParentTask: (childTask) => childTask.parentId ? taskMap.get(String(childTask.parentId)) || null : null,
    totalSubtasksCount: tasks.filter((t) => Boolean(t.parentId)).length
  };
}
function calculateHierarchyProgress(parentTask, childTasks = []) {
  if (!parentTask) return null;
  if (Array.isArray(childTasks) && childTasks.length > 0) {
    const completed = childTasks.filter((c) => Number(c?.status ?? 0) !== 0).length;
    const total = childTasks.length;
    const percent = Math.round(completed / total * 100);
    return {
      total,
      completed,
      percent,
      source: "subtasks"
    };
  }
  if (Array.isArray(parentTask.items) && parentTask.items.length > 0) {
    const completed = parentTask.items.filter((item) => Boolean(item.completed) || Number(item.status ?? 0) !== 0).length;
    const total = parentTask.items.length;
    const percent = Math.round(completed / total * 100);
    return {
      total,
      completed,
      percent,
      source: "checklists"
    };
  }
  if (parentTask.progress !== void 0 && parentTask.progress !== null) {
    const p = Math.max(0, Math.min(100, Number(parentTask.progress) || 0));
    return {
      total: 100,
      completed: p,
      percent: p,
      source: "explicit"
    };
  }
  return null;
}
function resolveTaskDependencies(task, allTasks = []) {
  if (!task) return { blockedBy: [], blocks: [], isBlocked: false };
  const taskMap = new Map(allTasks.map((t) => [String(t.id), t]));
  const currentId = String(task.id);
  const rawBlockedBy = Array.isArray(task.blockedBy) ? task.blockedBy : Array.isArray(task.dependsOn) ? task.dependsOn : [];
  const blockedBy = rawBlockedBy.map((id) => {
    const dep = taskMap.get(String(id));
    return {
      id: String(id),
      title: dep ? dep.title : `\u062A\u0633\u06A9 \u0646\u0627\u0634\u0646\u0627\u0633 #${id}`,
      completed: dep ? Number(dep.status ?? 0) !== 0 : false
    };
  });
  const blocks = [];
  for (const other of allTasks) {
    if (!other || String(other.id) === currentId) continue;
    const otherDeps = Array.isArray(other.blockedBy) ? other.blockedBy : Array.isArray(other.dependsOn) ? other.dependsOn : [];
    if (otherDeps.map(String).includes(currentId)) {
      blocks.push({
        id: String(other.id),
        title: other.title || `\u062A\u0633\u06A9 #${other.id}`,
        completed: Number(other.status ?? 0) !== 0
      });
    }
  }
  const isBlocked = blockedBy.some((dep) => !dep.completed);
  return {
    blockedBy,
    blocks,
    isBlocked
  };
}
function formatTaskEstimate(task) {
  if (!task) return null;
  if (task.timeEstimate !== void 0 && task.timeEstimate !== null) {
    const mins = Number(task.timeEstimate);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const rem = mins % 60;
      return rem > 0 ? `\u23F3 ${hours}\u0633 ${rem}\u062F` : `\u23F3 ${hours} \u0633\u0627\u0639\u062A`;
    }
    return `\u23F3 ${mins} \u062F\u0642\u06CC\u0642\u0647`;
  }
  if (task.pomodoroCount !== void 0 && task.pomodoroCount !== null) {
    return `\u{1F345} ${task.pomodoroCount} \u067E\u0648\u0645\u0648\u062F\u0648\u0631\u0648`;
  }
  if (task.estimate !== void 0 && task.estimate !== null) {
    return `\u23F3 \u062A\u062E\u0645\u06CC\u0646: ${task.estimate}`;
  }
  return null;
}
function probeTaskHierarchy(tasks = []) {
  let parentChildCount = 0;
  let checklistCount = 0;
  let dependencyCount = 0;
  let estimateCount = 0;
  let progressCount = 0;
  const observedParentIds = /* @__PURE__ */ new Set();
  const ambiguousFields = [];
  for (const task of tasks) {
    if (!task) continue;
    if (task.parentId) {
      parentChildCount++;
      observedParentIds.add(String(task.parentId));
    }
    if (Array.isArray(task.items) && task.items.length > 0) {
      checklistCount++;
    }
    if (Array.isArray(task.blockedBy) && task.blockedBy.length > 0 || Array.isArray(task.dependsOn) && task.dependsOn.length > 0) {
      dependencyCount++;
    }
    if (task.estimate !== void 0 || task.timeEstimate !== void 0 || task.pomodoroCount !== void 0) {
      estimateCount++;
    }
    if (task.progress !== void 0) {
      progressCount++;
    }
    if (task.parentId && Array.isArray(task.items) && task.items.length > 0) {
      ambiguousFields.push({
        taskId: String(task.id),
        issue: "Task has both parentId and checklist items"
      });
    }
  }
  return {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    totalTasksScanned: tasks.length,
    parentChildCount,
    uniqueParentsCount: observedParentIds.size,
    checklistCount,
    dependencyCount,
    estimateCount,
    progressCount,
    ambiguousCount: ambiguousFields.length,
    ambiguousSamples: ambiguousFields.slice(0, 5),
    writeSafety: {
      readOnlyByDefault: true,
      writeRequiresExplicitSetting: true,
      journalingSupported: false
    }
  };
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
    const estimate = formatTaskEstimate(this.task);
    for (const value of [this.task.projectName, this.task.dueDate ? `\u{1F4C5} ${formatPersianDate(this.task.dueDate, this.task.timeZone)}` : "\u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E", `${priority.icon} \u0627\u0648\u0644\u0648\u06CC\u062A ${priority.label}`, repeatSummary(this.task.repeatFlag), estimate]) if (value) meta.createSpan({ text: String(value) });
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
    const allTasks = this.actions.allTasks ? this.actions.allTasks() : [];
    const deps = resolveTaskDependencies(this.task, allTasks);
    if (deps.blockedBy.length > 0 || deps.blocks.length > 0) {
      const depBox = this.contentEl.createDiv({ cls: "ticktick-task-details-deps" });
      depBox.createEl("strong", { text: "\u0648\u0627\u0628\u0633\u062A\u06AF\u06CC\u200C\u0647\u0627 \u0648 \u067E\u06CC\u0634\u200C\u0646\u06CC\u0627\u0632\u0647\u0627" });
      if (deps.isBlocked) {
        depBox.createDiv({ cls: "ticktick-task-blocked-alert", text: "\u26D4 \u0627\u06CC\u0646 \u062A\u0633\u06A9 \u0628\u0647 \u062F\u0644\u06CC\u0644 \u062A\u06A9\u0645\u06CC\u0644 \u0646\u0634\u062F\u0646 \u067E\u06CC\u0634\u200C\u0646\u06CC\u0627\u0632\u0647\u0627 \u0645\u0633\u062F\u0648\u062F \u0627\u0633\u062A." });
      }
      for (const b of deps.blockedBy) {
        depBox.createDiv({
          cls: `ticktick-task-dep-item ${b.completed ? "is-done" : "is-pending"}`,
          text: `${b.completed ? "\u2705" : "\u23F3"} \u0648\u0627\u0628\u0633\u062A\u0647 \u0628\u0647: ${b.title}`
        });
      }
      for (const b of deps.blocks) {
        depBox.createDiv({
          cls: "ticktick-task-dep-item is-blocks",
          text: `\u21B3 \u067E\u06CC\u0634\u200C\u0646\u06CC\u0627\u0632 \u0628\u0631\u0627\u06CC: ${b.title}`
        });
      }
    }
    const hierarchy = buildTaskHierarchy(allTasks);
    const parentTask = hierarchy.getParentTask(this.task);
    const childTasks = hierarchy.getChildTasks(this.task.id);
    const progress = calculateHierarchyProgress(this.task, childTasks);
    if (parentTask || childTasks.length > 0 || progress) {
      const hierBox = this.contentEl.createDiv({ cls: "ticktick-task-details-hierarchy" });
      const hierHeader = hierBox.createDiv({ cls: "ticktick-task-hier-header" });
      hierHeader.createEl("strong", { text: "\u0633\u0627\u062E\u062A\u0627\u0631 \u0633\u0644\u0633\u0644\u0647\u200C\u0645\u0631\u0627\u062A\u0628\u06CC \u0648 \u0632\u06CC\u0631\u062A\u0633\u06A9\u200C\u0647\u0627" });
      if (!this.actions.experimentalWritesEnabled) {
        hierHeader.createSpan({ cls: "ticktick-task-readonly-badge", text: "\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC: \u0641\u0642\u0637\u200C\u062E\u0648\u0627\u0646\u062F\u0646\u06CC" });
      }
      if (parentTask) {
        hierBox.createDiv({
          cls: "ticktick-task-parent-link",
          text: `\u21B3 \u062A\u0633\u06A9 \u0648\u0627\u0644\u062F: ${parentTask.title || "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646"}`
        });
      }
      if (progress && progress.total > 0) {
        const progRow = hierBox.createDiv({ cls: "ticktick-task-progress-row" });
        progRow.createSpan({ text: `\u067E\u06CC\u0634\u0631\u0641\u062A: ${progress.completed}/${progress.total} (${progress.percent}\u066A)` });
        const progBar = progRow.createDiv({ cls: "ticktick-metric-progress" });
        const progFill = progBar.createDiv({ cls: "ticktick-metric-progress-fill" });
        progFill.style.width = `${progress.percent}%`;
      }
      if (childTasks.length > 0) {
        const subtaskList = hierBox.createDiv({ cls: "ticktick-task-subtasks-list" });
        for (const child of childTasks) {
          const childDone = Number(child.status ?? 0) !== 0;
          const row = subtaskList.createDiv({ cls: `ticktick-task-subtask-item ${childDone ? "is-completed" : ""}` });
          row.createSpan({ text: childDone ? "\u2611" : "\u2610" });
          row.createSpan({ text: child.title || "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646", cls: "ticktick-subtask-title" });
        }
      }
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
init_task_filter();

// src/obsidian/selection-store.ts
var BulkSelectionStore = class {
  selected = /* @__PURE__ */ new Set();
  listeners = /* @__PURE__ */ new Set();
  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.selected.size > 0) {
          if (!document.querySelector(".modal-container")) {
            this.clear();
          }
        }
      });
    }
  }
  toggle(id, force) {
    if (!id) return false;
    const strId = String(id);
    let state;
    if (force !== void 0) {
      if (force) this.selected.add(strId);
      else this.selected.delete(strId);
      state = force;
    } else {
      if (this.selected.has(strId)) {
        this.selected.delete(strId);
        state = false;
      } else {
        this.selected.add(strId);
        state = true;
      }
    }
    this.notify();
    return state;
  }
  select(id) {
    this.toggle(id, true);
  }
  deselect(id) {
    this.toggle(id, false);
  }
  selectAll(ids) {
    for (const id of ids) {
      this.selected.add(String(id));
    }
    this.notify();
  }
  clear() {
    if (this.selected.size === 0) return;
    this.selected.clear();
    this.notify();
  }
  isSelected(id) {
    return this.selected.has(String(id));
  }
  getSelection() {
    return Array.from(this.selected);
  }
  count() {
    return this.selected.size;
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  notify() {
    if (typeof document !== "undefined") {
      document.querySelectorAll(".is-bulk-selected").forEach((el) => {
        const id = el.dataset.taskId;
        if (!id || !this.selected.has(id)) {
          el.classList.remove("is-bulk-selected");
        }
      });
      for (const id of this.selected) {
        document.querySelectorAll(`[data-task-id="${id}"]`).forEach((el) => {
          el.classList.add("is-bulk-selected");
        });
      }
    }
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error("BulkSelectionStore listener error:", err);
      }
    }
  }
};
var bulkSelectionStore = new BulkSelectionStore();

// src/obsidian/bulk-action-bar.ts
var import_obsidian8 = require("obsidian");

// src/obsidian/modals/bulk-confirm-modal.ts
var import_obsidian6 = require("obsidian");
var BulkConfirmModal = class extends import_obsidian6.Modal {
  constructor(app, tasks, options) {
    super(app);
    this.tasks = tasks;
    this.options = options;
  }
  resolveResult;
  result = new Promise((resolve) => {
    this.resolveResult = resolve;
  });
  finished = false;
  finish(value) {
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(value);
      this.close();
    }
  }
  onOpen() {
    this.modalEl.addClass("ticktick-bulk-confirm-modal");
    this.modalEl.style.direction = "rtl";
    this.titleEl.setText(this.options.title);
    const descEl = this.contentEl.createEl("p", {
      cls: "ticktick-bulk-desc",
      text: this.options.description
    });
    if (this.options.isDestructive) {
      const alertBox = this.contentEl.createDiv({ cls: "ticktick-bulk-alert" });
      const alertIcon = alertBox.createSpan({ cls: "mod-icon" });
      (0, import_obsidian6.setIcon)(alertIcon, "alert-triangle");
      alertBox.createSpan({
        text: `\u0647\u0634\u062F\u0627\u0631: \u0627\u06CC\u0646 \u0639\u0645\u0644\u06CC\u0627\u062A \u0631\u0648\u06CC ${this.tasks.length} \u062A\u0633\u06A9 \u063A\u06CC\u0631\u0642\u0627\u0628\u0644\u200C\u0628\u0627\u0632\u06AF\u0634\u062A \u0627\u0633\u062A.`
      });
    }
    const previewContainer = this.contentEl.createDiv({ cls: "ticktick-bulk-preview-list" });
    const maxPreview = 6;
    const previewTasks = this.tasks.slice(0, maxPreview);
    for (const t of previewTasks) {
      const item = previewContainer.createDiv({ cls: "ticktick-bulk-preview-item" });
      const dot = item.createSpan({ cls: "ticktick-bulk-item-dot" });
      dot.setText("\u2022");
      item.createSpan({ cls: "ticktick-bulk-item-title", text: t.title || "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646" });
      if (t.projectName) {
        item.createSpan({ cls: "ticktick-bulk-item-proj", text: `(${t.projectName})` });
      }
    }
    if (this.tasks.length > maxPreview) {
      const remaining = this.tasks.length - maxPreview;
      previewContainer.createDiv({
        cls: "ticktick-bulk-more",
        text: `\u0648 ${remaining} \u062A\u0633\u06A9 \u062F\u06CC\u06AF\u0631...`
      });
    }
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    const cancelBtn = actions.createEl("button", { text: "\u0627\u0646\u0635\u0631\u0627\u0641" });
    cancelBtn.addEventListener("click", () => this.finish(false));
    const confirmBtn = actions.createEl("button", {
      text: this.options.confirmLabel,
      cls: this.options.isDestructive ? "mod-warning" : "mod-cta"
    });
    confirmBtn.addEventListener("click", () => this.finish(true));
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

// src/obsidian/modals/bulk-input-modal.ts
var import_obsidian7 = require("obsidian");

// node_modules/jalaali-js/dist/index.js
var BREAKS = [
  -61,
  9,
  38,
  199,
  426,
  686,
  756,
  818,
  1111,
  1181,
  1210,
  1635,
  2060,
  2097,
  2192,
  2262,
  2324,
  2394,
  2456,
  3178
];
var MIN_JALAALI_YEAR = BREAKS[0];
var MAX_JALAALI_YEAR = BREAKS[BREAKS.length - 1] - 1;
function toJalaali(gyOrDate, gm, gd) {
  if (gyOrDate instanceof Date) return d2j(g2d(gyOrDate.getFullYear(), gyOrDate.getMonth() + 1, gyOrDate.getDate()));
  return d2j(g2d(gyOrDate, gm, gd));
}
function toGregorian(jy, jm, jd) {
  return d2g(j2d(jy, jm, jd));
}
function isLeapJalaaliYear(jy) {
  return jalCalLeap(jy) === 0;
}
function jalaaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaaliYear(jy) ? 30 : 29;
}
function jalCal(jy) {
  const { gy, march, jump, n } = jalCalCore(jy);
  return {
    leap: leapFromCycle(jump, n),
    gy,
    march
  };
}
function jalCalShort(jy) {
  const { gy, march } = jalCalCore(jy);
  return {
    gy,
    march
  };
}
function j2d(jy, jm, jd) {
  const r = jalCalShort(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}
var FIRST_JALAALI_JDN = j2d(MIN_JALAALI_YEAR, 1, 1);
var LAST_JALAALI_JDN = j2d(MAX_JALAALI_YEAR, 12, jalaaliMonthLength(MAX_JALAALI_YEAR, 12));
function d2j(jdn) {
  if (jdn < FIRST_JALAALI_JDN || jdn > LAST_JALAALI_JDN) throw new RangeError(`Invalid Julian Day number ${jdn}: outside the supported Jalaali range [${MIN_JALAALI_YEAR}, ${MAX_JALAALI_YEAR}]`);
  const gy = d2g(jdn).gy;
  let jy = Math.min(gy - 621, MAX_JALAALI_YEAR);
  const r = jalCal(jy);
  let k = jdn - g2d(r.gy, 3, r.march);
  if (k >= 0) {
    if (k <= 185) return {
      jy,
      jm: 1 + div(k, 31),
      jd: mod(k, 31) + 1
    };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return {
    jy,
    jm: 7 + div(k, 30),
    jd: mod(k, 30) + 1
  };
}
function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}
function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  return {
    gy: div(j, 1461) - 100100 + div(8 - gm, 6),
    gm,
    gd
  };
}
function jalCalCore(jy) {
  if (!Number.isFinite(jy) || jy < MIN_JALAALI_YEAR || jy > MAX_JALAALI_YEAR) throw new RangeError(`Invalid Jalaali year ${jy}: must be a finite number between ${MIN_JALAALI_YEAR} and ${MAX_JALAALI_YEAR} (inclusive)`);
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jm = 0;
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i += 1) {
    jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  const n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  return {
    gy,
    march: 20 + leapJ - leapG,
    jump,
    n
  };
}
function leapFromCycle(jump, n) {
  let adjusted = n;
  if (jump - n < 6) adjusted = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(adjusted + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return leap;
}
function jalCalLeap(jy) {
  if (!Number.isFinite(jy) || jy < MIN_JALAALI_YEAR || jy > MAX_JALAALI_YEAR) throw new RangeError(`Invalid Jalaali year ${jy}: must be a finite number between ${MIN_JALAALI_YEAR} and ${MAX_JALAALI_YEAR} (inclusive)`);
  let jp = BREAKS[0];
  let jm = 0;
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i += 1) {
    jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    jp = jm;
  }
  return leapFromCycle(jump, jy - jp);
}
function div(a, b) {
  return ~~(a / b);
}
function mod(a, b) {
  return a - ~~(a / b) * b;
}

// src/obsidian/components/jalali-date-picker.ts
var JALALI_MONTHS = ["\u0641\u0631\u0648\u0631\u062F\u06CC\u0646", "\u0627\u0631\u062F\u06CC\u0628\u0647\u0634\u062A", "\u062E\u0631\u062F\u0627\u062F", "\u062A\u06CC\u0631", "\u0645\u0631\u062F\u0627\u062F", "\u0634\u0647\u0631\u06CC\u0648\u0631", "\u0645\u0647\u0631", "\u0622\u0628\u0627\u0646", "\u0622\u0630\u0631", "\u062F\u06CC", "\u0628\u0647\u0645\u0646", "\u0627\u0633\u0641\u0646\u062F"];
var JALALI_WEEKDAYS = ["\u0634", "\u06CC", "\u062F", "\u0633", "\u0686", "\u067E", "\u062C"];
var toEnDigits = (s) => s.replace(/[۰-۹]/g, (d) => String("\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9".indexOf(d))).replace(/[٠-٩]/g, (d) => String("\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669".indexOf(d)));
var pad2 = (n) => String(n).padStart(2, "0");
var isIsoDate = (x) => /^\d{4}-\d{2}-\d{2}$/.test(x);
var toIso = (g) => `${g.gy}-${pad2(g.gm)}-${pad2(g.gd)}`;
var parseJalali = (str) => {
  if (!str) return null;
  const clean = toEnDigits(str).trim();
  const m = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (!m) return null;
  const jy = parseInt(m[1], 10), jm = parseInt(m[2], 10), jd = parseInt(m[3], 10);
  if (jy < 1300 || jy > 1500) return null;
  if (jm < 1 || jm > 12) return null;
  const maxDays = jalaaliMonthLength(jy, jm);
  if (jd < 1 || jd > maxDays) return null;
  const g = toGregorian(jy, jm, jd);
  return { jy, jm, jd, iso: toIso(g) };
};
var isoToJalali = (iso) => {
  if (!isIsoDate(iso)) return null;
  const [gy, gm, gd] = iso.split("-").map(Number);
  const j = toJalaali(gy, gm, gd);
  return {
    jy: j.jy,
    jm: j.jm,
    jd: j.jd,
    str: `${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`,
    full: `${j.jd} ${JALALI_MONTHS[j.jm - 1]} ${j.jy}`
  };
};
var getTodayJalali = () => {
  const now = /* @__PURE__ */ new Date();
  return toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
};
var JalaliDatePicker = class {
  constructor(parent, labelText, initialIso, onChange, options) {
    this.onChange = onChange;
    this.container = parent.createDiv({ cls: "ticktick-jalali-date-wrap" });
    if (labelText) {
      this.container.createEl("label", { text: labelText, cls: "ticktick-form-label" });
    }
    const row = this.container.createDiv({ cls: "ticktick-jalali-input-row" });
    this.inputEl = row.createEl("input", {
      type: "text",
      cls: "ticktick-input ticktick-jalali-input",
      placeholder: "\u0645\u062B\u0627\u0644: \u06F1\u06F4\u06F0\u06F5/\u06F0\u06F1/\u06F0\u06F1"
    });
    this.calBtn = row.createEl("button", {
      type: "button",
      cls: "ticktick-jalali-cal-btn",
      text: "\u{1F4C5}"
    });
    this.calBtn.setAttribute("title", "\u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u062A\u0642\u0648\u06CC\u0645 \u0634\u0645\u0633\u06CC");
    this.helperEl = this.container.createDiv({ cls: "ticktick-jalali-helper-text" });
    this.cardEl = this.container.createDiv({ cls: "ticktick-jalali-calendar-card is-hidden" });
    const todayJ = getTodayJalali();
    this.viewYear = options?.defaultYear || todayJ.jy;
    this.viewMonth = todayJ.jm;
    this.setValue(initialIso);
    this.inputEl.addEventListener("input", () => this.handleInput());
    this.inputEl.addEventListener("blur", () => this.handleBlur());
    this.calBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleCalendar();
    });
    document.addEventListener("pointerdown", (e) => {
      if (this.isOpen && !this.container.contains(e.target)) {
        this.closeCalendar();
      }
    });
  }
  container;
  inputEl;
  calBtn;
  helperEl;
  cardEl;
  currentIso = "";
  viewYear;
  viewMonth;
  isOpen = false;
  setValue(iso) {
    this.currentIso = iso ? iso.slice(0, 10) : "";
    const j = isoToJalali(this.currentIso);
    if (j) {
      this.inputEl.value = j.str;
      this.helperEl.setText(`${j.full} (\u0645\u0639\u0627\u062F\u0644 \u0645\u06CC\u0644\u0627\u062F\u06CC: ${this.currentIso})`);
      this.viewYear = j.jy;
      this.viewMonth = j.jm;
    } else {
      this.inputEl.value = "";
      this.helperEl.setText("\u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E \u0633\u0631\u0631\u0633\u06CC\u062F");
    }
    if (this.isOpen) this.renderCalendar();
  }
  handleInput() {
    const val = this.inputEl.value.trim();
    if (!val) {
      this.currentIso = "";
      this.helperEl.setText("\u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E \u0633\u0631\u0631\u0633\u06CC\u062F");
      this.onChange("");
      return;
    }
    const parsed = parseJalali(val);
    if (parsed) {
      this.currentIso = parsed.iso;
      this.viewYear = parsed.jy;
      this.viewMonth = parsed.jm;
      this.helperEl.setText(`${parsed.jd} ${JALALI_MONTHS[parsed.jm - 1]} ${parsed.jy} (\u0645\u0639\u0627\u062F\u0644 \u0645\u06CC\u0644\u0627\u062F\u06CC: ${parsed.iso})`);
      this.onChange(parsed.iso);
      if (this.isOpen) this.renderCalendar();
    } else {
      this.helperEl.setText("\u0641\u0631\u0645\u062A \u062A\u0627\u0631\u06CC\u062E \u0646\u0627\u0645\u0639\u062A\u0628\u0631 \u0627\u0633\u062A (\u0645\u062B\u0627\u0644: \u06F1\u06F4\u06F0\u06F5/\u06F0\u06F7/\u06F2\u06F7)");
    }
  }
  handleBlur() {
    const j = isoToJalali(this.currentIso);
    if (j) {
      this.inputEl.value = j.str;
    }
  }
  toggleCalendar() {
    if (this.isOpen) {
      this.closeCalendar();
    } else {
      document.querySelectorAll(".ticktick-jalali-calendar-card").forEach((el) => {
        if (el !== this.cardEl) el.addClass("is-hidden");
      });
      this.openCalendar();
    }
  }
  openCalendar() {
    this.isOpen = true;
    this.cardEl.removeClass("is-hidden");
    this.renderCalendar();
  }
  closeCalendar() {
    this.isOpen = false;
    this.cardEl.addClass("is-hidden");
  }
  renderCalendar() {
    this.cardEl.empty();
    const header = this.cardEl.createDiv({ cls: "ticktick-jalali-cal-header" });
    const prevBtn = header.createEl("button", { type: "button", text: "\u2039", cls: "ticktick-jalali-nav-btn", title: "\u0645\u0627\u0647 \u0642\u0628\u0644" });
    prevBtn.onclick = (e) => {
      e.preventDefault();
      if (this.viewMonth === 1) {
        this.viewMonth = 12;
        this.viewYear--;
      } else {
        this.viewMonth--;
      }
      this.renderCalendar();
    };
    const controls = header.createDiv({ cls: "ticktick-jalali-header-selects" });
    const monthSelect = controls.createEl("select", { cls: "ticktick-select ticktick-jalali-select" });
    JALALI_MONTHS.forEach((m, idx) => {
      const opt = monthSelect.createEl("option", { text: m, value: String(idx + 1) });
      if (idx + 1 === this.viewMonth) opt.selected = true;
    });
    monthSelect.onchange = () => {
      this.viewMonth = parseInt(monthSelect.value, 10);
      this.renderCalendar();
    };
    const yearSelect = controls.createEl("select", { cls: "ticktick-select ticktick-jalali-select" });
    for (let y = this.viewYear - 5; y <= this.viewYear + 5; y++) {
      const opt = yearSelect.createEl("option", { text: String(y), value: String(y) });
      if (y === this.viewYear) opt.selected = true;
    }
    yearSelect.onchange = () => {
      this.viewYear = parseInt(yearSelect.value, 10);
      this.renderCalendar();
    };
    const nextBtn = header.createEl("button", { type: "button", text: "\u203A", cls: "ticktick-jalali-nav-btn", title: "\u0645\u0627\u0647 \u0628\u0639\u062F" });
    nextBtn.onclick = (e) => {
      e.preventDefault();
      if (this.viewMonth === 12) {
        this.viewMonth = 1;
        this.viewYear++;
      } else {
        this.viewMonth++;
      }
      this.renderCalendar();
    };
    const weekdaysRow = this.cardEl.createDiv({ cls: "ticktick-jalali-weekdays" });
    JALALI_WEEKDAYS.forEach((w) => weekdaysRow.createSpan({ text: w }));
    const grid = this.cardEl.createDiv({ cls: "ticktick-jalali-days-grid" });
    const { gy, gm, gd } = toGregorian(this.viewYear, this.viewMonth, 1);
    const gDate = new Date(Date.UTC(gy, gm - 1, gd, 12, 0, 0));
    const startWeekday = (gDate.getUTCDay() + 1) % 7;
    for (let i = 0; i < startWeekday; i++) {
      grid.createDiv({ cls: "ticktick-jalali-day-cell is-empty" });
    }
    const monthLength = jalaaliMonthLength(this.viewYear, this.viewMonth);
    const selectedJ = isoToJalali(this.currentIso);
    const todayJ = getTodayJalali();
    for (let d = 1; d <= monthLength; d++) {
      const isSelected = selectedJ && selectedJ.jy === this.viewYear && selectedJ.jm === this.viewMonth && selectedJ.jd === d;
      const isToday = todayJ.jy === this.viewYear && todayJ.jm === this.viewMonth && todayJ.jd === d;
      const cell = grid.createEl("button", {
        type: "button",
        text: String(d),
        cls: `ticktick-jalali-day-cell${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`
      });
      cell.onclick = (e) => {
        e.preventDefault();
        const g = toGregorian(this.viewYear, this.viewMonth, d);
        const iso = toIso(g);
        this.setValue(iso);
        this.onChange(iso);
        this.closeCalendar();
      };
    }
    const footer = this.cardEl.createDiv({ cls: "ticktick-jalali-cal-footer" });
    const todayBtn = footer.createEl("button", { type: "button", text: "\u0627\u0645\u0631\u0648\u0632", cls: "ticktick-jalali-btn-sm" });
    todayBtn.onclick = (e) => {
      e.preventDefault();
      const t = getTodayJalali();
      const g = toGregorian(t.jy, t.jm, t.jd);
      const iso = toIso(g);
      this.setValue(iso);
      this.onChange(iso);
      this.closeCalendar();
    };
    const tomorrowBtn = footer.createEl("button", { type: "button", text: "\u0641\u0631\u062F\u0627", cls: "ticktick-jalali-btn-sm" });
    tomorrowBtn.onclick = (e) => {
      e.preventDefault();
      const now = /* @__PURE__ */ new Date();
      now.setDate(now.getDate() + 1);
      const tj = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
      const g = toGregorian(tj.jy, tj.jm, tj.jd);
      const iso = toIso(g);
      this.setValue(iso);
      this.onChange(iso);
      this.closeCalendar();
    };
    const clearBtn = footer.createEl("button", { type: "button", text: "\u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E", cls: "ticktick-jalali-btn-sm" });
    clearBtn.onclick = (e) => {
      e.preventDefault();
      this.setValue("");
      this.onChange("");
      this.closeCalendar();
    };
    const closeBtn = footer.createEl("button", { type: "button", text: "\u0628\u0633\u062A\u0646", cls: "ticktick-jalali-btn-sm mod-muted" });
    closeBtn.onclick = (e) => {
      e.preventDefault();
      this.closeCalendar();
    };
  }
};

// src/obsidian/modals/bulk-input-modal.ts
var BulkTagModal = class extends import_obsidian7.Modal {
  constructor(app, count) {
    super(app);
    this.count = count;
  }
  resolveResult;
  result = new Promise((resolve) => {
    this.resolveResult = resolve;
  });
  finished = false;
  finish(value) {
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(value);
      this.close();
    }
  }
  onOpen() {
    this.modalEl.addClass("ticktick-bulk-input-modal");
    this.modalEl.style.direction = "rtl";
    this.titleEl.setText(`\u0645\u062F\u06CC\u0631\u06CC\u062A \u0628\u0631\u0686\u0633\u0628\u200C\u0647\u0627\u06CC ${this.count} \u062A\u0633\u06A9`);
    const inputWrapper = this.contentEl.createDiv({ cls: "ticktick-bulk-input-wrapper" });
    inputWrapper.createEl("label", { text: "\u0646\u0627\u0645 \u0628\u0631\u0686\u0633\u0628:" });
    const tagInput = inputWrapper.createEl("input", {
      type: "text",
      placeholder: "\u0645\u062B\u0627\u0644: \u0641\u0648\u0631\u06CC \u06CC\u0627 \u06A9\u0627\u0631"
    });
    const buttonContainer = this.contentEl.createDiv({ cls: "modal-button-container" });
    const cancelBtn = buttonContainer.createEl("button", { text: "\u0627\u0646\u0635\u0631\u0627\u0641" });
    cancelBtn.addEventListener("click", () => this.finish(null));
    const removeBtn = buttonContainer.createEl("button", {
      text: "\u062D\u0630\u0641 \u0627\u0632 \u062A\u0633\u06A9\u200C\u0647\u0627",
      cls: "mod-warning"
    });
    removeBtn.addEventListener("click", () => {
      const tag = tagInput.value.trim().replace(/^#/, "");
      if (!tag) return;
      this.finish({ tag, action: "remove" });
    });
    const addBtn = buttonContainer.createEl("button", {
      text: "\u0627\u0641\u0632\u0648\u062F\u0646 \u0628\u0647 \u062A\u0633\u06A9\u200C\u0647\u0627",
      cls: "mod-cta"
    });
    addBtn.addEventListener("click", () => {
      const tag = tagInput.value.trim().replace(/^#/, "");
      if (!tag) return;
      this.finish({ tag, action: "add" });
    });
    setTimeout(() => tagInput.focus(), 50);
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
var BulkDateModal = class extends import_obsidian7.Modal {
  constructor(app, count, defaultDay) {
    super(app);
    this.count = count;
    this.defaultDay = defaultDay;
  }
  resolveResult;
  result = new Promise((resolve) => {
    this.resolveResult = resolve;
  });
  finished = false;
  finish(value) {
    if (!this.finished) {
      this.finished = true;
      this.resolveResult(value);
      this.close();
    }
  }
  onOpen() {
    this.modalEl.addClass("ticktick-bulk-input-modal");
    this.modalEl.style.direction = "rtl";
    this.titleEl.setText(`\u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC ${this.count} \u062A\u0633\u06A9`);
    let targetDay = this.defaultDay;
    const dateWrapper = this.contentEl.createDiv({ cls: "ticktick-bulk-input-wrapper" });
    new JalaliDatePicker(dateWrapper, "\u062A\u0627\u0631\u06CC\u062E \u0633\u0631\u0631\u0633\u06CC\u062F (\u0634\u0645\u0633\u06CC):", this.defaultDay, (val) => targetDay = val);
    const timeWrapper = this.contentEl.createDiv({ cls: "ticktick-bulk-input-wrapper" });
    timeWrapper.createEl("label", { text: "\u0633\u0627\u0639\u062A (\u0627\u062E\u062A\u06CC\u0627\u0631\u06CC):" });
    const timeInput = timeWrapper.createEl("input", {
      type: "time"
    });
    const buttonContainer = this.contentEl.createDiv({ cls: "modal-button-container" });
    const cancelBtn = buttonContainer.createEl("button", { text: "\u0627\u0646\u0635\u0631\u0627\u0641" });
    cancelBtn.addEventListener("click", () => this.finish(null));
    const applyBtn = buttonContainer.createEl("button", {
      text: "\u0627\u0639\u0645\u0627\u0644 \u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC",
      cls: "mod-cta"
    });
    applyBtn.addEventListener("click", () => {
      if (!targetDay) return;
      this.finish({ targetDay, time: timeInput.value.trim() || void 0 });
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

// src/obsidian/bulk-action-bar.ts
init_date();
var BulkActionBar = class {
  constructor(parent, host) {
    this.parent = parent;
    this.host = host;
    this.container = this.parent.createDiv({ cls: "ticktick-bulk-action-bar" });
    this.container.style.display = "none";
    this.container.style.direction = "rtl";
    this.unsubscribe = bulkSelectionStore.subscribe(() => {
      this.render();
    });
  }
  container;
  unsubscribe = null;
  isExecuting = false;
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.container.remove();
  }
  async render() {
    if (!this.container.isConnected && this.parent) {
      this.parent.appendChild(this.container);
    }
    const selectedIds = bulkSelectionStore.getSelection();
    if (selectedIds.length === 0 || this.isExecuting) {
      this.container.style.display = "none";
      this.container.empty();
      return;
    }
    this.container.style.display = "flex";
    this.container.empty();
    const allTasks = this.host.tasks();
    const taskMap = new Map(allTasks.map((t) => [String(t.id), t]));
    const selectedTasks = selectedIds.map((id) => taskMap.get(id)).filter(Boolean);
    const countBadge = this.container.createDiv({ cls: "ticktick-bulk-counter" });
    const countIcon = countBadge.createSpan({ cls: "mod-icon" });
    (0, import_obsidian8.setIcon)(countIcon, "check-circle");
    countBadge.createSpan({ text: `${selectedTasks.length} \u062A\u0633\u06A9 \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647` });
    const actionsGroup = this.container.createDiv({ cls: "ticktick-bulk-buttons" });
    const projBtn = actionsGroup.createEl("button", {
      cls: "ticktick-bulk-btn",
      attr: { "aria-label": "\u062A\u063A\u06CC\u06CC\u0631 \u067E\u0631\u0648\u0698\u0647" }
    });
    (0, import_obsidian8.setIcon)(projBtn.createSpan({ cls: "mod-icon" }), "folder");
    projBtn.createSpan({ text: "\u067E\u0631\u0648\u0698\u0647" });
    projBtn.addEventListener("click", async (e) => {
      const rawProjs = await this.host.projects();
      const projects = Array.isArray(rawProjs) ? rawProjs : [];
      const menu = new import_obsidian8.Menu();
      menu.addItem((i) => i.setTitle("\u0635\u0646\u062F\u0648\u0642 \u0648\u0631\u0648\u062F\u06CC (Inbox)").onClick(() => void this.runOperation(selectedTasks, "project", { projectId: "inbox" })));
      for (const p of projects.filter((p2) => p2.id !== "inbox")) {
        menu.addItem((i) => i.setTitle(p.name).onClick(() => void this.runOperation(selectedTasks, "project", { projectId: String(p.id) })));
      }
      menu.showAtMouseEvent(e);
    });
    const tagBtn = actionsGroup.createEl("button", {
      cls: "ticktick-bulk-btn",
      attr: { "aria-label": "\u0645\u062F\u06CC\u0631\u06CC\u062A \u0628\u0631\u0686\u0633\u0628\u200C\u0647\u0627" }
    });
    (0, import_obsidian8.setIcon)(tagBtn.createSpan({ cls: "mod-icon" }), "tag");
    tagBtn.createSpan({ text: "\u0628\u0631\u0686\u0633\u0628" });
    tagBtn.addEventListener("click", async () => {
      const res = await new BulkTagModal(this.host.app, selectedTasks.length).openAndWait();
      if (!res) return;
      await this.runOperation(selectedTasks, res.action === "add" ? "tag-add" : "tag-remove", { tag: res.tag });
    });
    const priorityBtn = actionsGroup.createEl("button", {
      cls: "ticktick-bulk-btn",
      attr: { "aria-label": "\u062A\u0646\u0638\u06CC\u0645 \u0627\u0648\u0644\u0648\u06CC\u062A" }
    });
    (0, import_obsidian8.setIcon)(priorityBtn.createSpan({ cls: "mod-icon" }), "flag");
    priorityBtn.createSpan({ text: "\u0627\u0648\u0644\u0648\u06CC\u062A" });
    priorityBtn.addEventListener("click", (e) => {
      const menu = new import_obsidian8.Menu();
      menu.addItem((i) => i.setTitle("\u{1F534} \u0627\u0648\u0644\u0648\u06CC\u062A \u0628\u0627\u0644\u0627 (High)").onClick(() => void this.runOperation(selectedTasks, "priority", { priority: 5 })));
      menu.addItem((i) => i.setTitle("\u{1F7E1} \u0627\u0648\u0644\u0648\u06CC\u062A \u0645\u062A\u0648\u0633\u0637 (Medium)").onClick(() => void this.runOperation(selectedTasks, "priority", { priority: 3 })));
      menu.addItem((i) => i.setTitle("\u{1F535} \u0627\u0648\u0644\u0648\u06CC\u062A \u06A9\u0645 (Low)").onClick(() => void this.runOperation(selectedTasks, "priority", { priority: 1 })));
      menu.addItem((i) => i.setTitle("\u26AA \u0628\u062F\u0648\u0646 \u0627\u0648\u0644\u0648\u06CC\u062A (None)").onClick(() => void this.runOperation(selectedTasks, "priority", { priority: 0 })));
      menu.showAtMouseEvent(e);
    });
    const dateBtn = actionsGroup.createEl("button", {
      cls: "ticktick-bulk-btn",
      attr: { "aria-label": "\u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC / \u062A\u063A\u06CC\u06CC\u0631 \u062A\u0627\u0631\u06CC\u062E" }
    });
    (0, import_obsidian8.setIcon)(dateBtn.createSpan({ cls: "mod-icon" }), "calendar");
    dateBtn.createSpan({ text: "\u062A\u0627\u0631\u06CC\u062E" });
    dateBtn.addEventListener("click", async () => {
      const today = todayInZone(this.host.timeZone);
      const res = await new BulkDateModal(this.host.app, selectedTasks.length, today).openAndWait();
      if (!res) return;
      await this.runOperation(selectedTasks, "schedule-date", res);
    });
    const clearDateBtn = actionsGroup.createEl("button", {
      cls: "ticktick-bulk-btn",
      attr: { "aria-label": "\u062D\u0630\u0641 \u062A\u0627\u0631\u06CC\u062E \u0648 \u0644\u063A\u0648 \u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC" }
    });
    (0, import_obsidian8.setIcon)(clearDateBtn.createSpan({ cls: "mod-icon" }), "calendar-x");
    clearDateBtn.createSpan({ text: "\u0644\u063A\u0648 \u062A\u0627\u0631\u06CC\u062E" });
    clearDateBtn.addEventListener("click", async () => {
      const confirmed = await new BulkConfirmModal(this.host.app, selectedTasks, {
        title: "\u0644\u063A\u0648 \u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC \u062A\u0633\u06A9\u200C\u0647\u0627",
        description: `\u0622\u06CC\u0627 \u0645\u0637\u0645\u0626\u0646 \u0647\u0633\u062A\u06CC\u062F \u06A9\u0647 \u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u06CC\u062F \u062A\u0627\u0631\u06CC\u062E \u0633\u0631\u0631\u0633\u06CC\u062F ${selectedTasks.length} \u062A\u0633\u06A9 \u0631\u0627 \u067E\u0627\u06A9 \u06A9\u0631\u062F\u0647 \u0648 \u0622\u0646\u200C\u0647\u0627 \u0631\u0627 \u0628\u0647 \u0628\u06A9\u200C\u0644\u0627\u06AF \u0645\u0646\u062A\u0642\u0644 \u06A9\u0646\u06CC\u062F\u061F`,
        confirmLabel: "\u062D\u0630\u0641 \u062A\u0627\u0631\u06CC\u062E\u200C\u0647\u0627",
        isDestructive: false
      }).openAndWait();
      if (confirmed) {
        await this.runOperation(selectedTasks, "clear-date", {});
      }
    });
    const statusBtn = actionsGroup.createEl("button", {
      cls: "ticktick-bulk-btn",
      attr: { "aria-label": "\u062A\u06A9\u0645\u06CC\u0644 \u06CC\u0627 \u0628\u0627\u0632\u06AF\u0634\u0627\u06CC\u06CC" }
    });
    (0, import_obsidian8.setIcon)(statusBtn.createSpan({ cls: "mod-icon" }), "check-square");
    statusBtn.createSpan({ text: "\u0648\u0636\u0639\u06CC\u062A" });
    statusBtn.addEventListener("click", (e) => {
      const menu = new import_obsidian8.Menu();
      menu.addItem((i) => i.setTitle("\u2705 \u062A\u06A9\u0645\u06CC\u0644 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647").onClick(() => void this.runOperation(selectedTasks, "complete", {})));
      menu.addItem((i) => i.setTitle("\u{1F504} \u0628\u0627\u0632\u06AF\u0634\u0627\u06CC\u06CC \u0645\u062C\u062F\u062F \u062A\u0633\u06A9\u200C\u0647\u0627").onClick(() => void this.runOperation(selectedTasks, "reopen", {})));
      menu.showAtMouseEvent(e);
    });
    const deleteBtn = actionsGroup.createEl("button", {
      cls: "ticktick-bulk-btn mod-destructive",
      attr: { "aria-label": "\u062D\u0630\u0641 \u062F\u0627\u0626\u0645\u06CC \u062A\u0633\u06A9\u200C\u0647\u0627" }
    });
    (0, import_obsidian8.setIcon)(deleteBtn.createSpan({ cls: "mod-icon" }), "trash-2");
    deleteBtn.createSpan({ text: "\u062D\u0630\u0641" });
    deleteBtn.addEventListener("click", async () => {
      const confirmed = await new BulkConfirmModal(this.host.app, selectedTasks, {
        title: "\u062D\u0630\u0641 \u06AF\u0631\u0648\u0647\u06CC \u062A\u0633\u06A9\u200C\u0647\u0627",
        description: `\u0622\u06CC\u0627 \u0645\u0637\u0645\u0626\u0646 \u0647\u0633\u062A\u06CC\u062F \u06A9\u0647 \u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u06CC\u062F ${selectedTasks.length} \u062A\u0633\u06A9 \u0632\u06CC\u0631 \u0631\u0627 \u0628\u0647 \u0635\u0648\u0631\u062A \u06A9\u0627\u0645\u0644 \u0627\u0632 TickTick \u062D\u0630\u0641 \u06A9\u0646\u06CC\u062F\u061F`,
        confirmLabel: "\u062D\u0630\u0641 \u062F\u0627\u0626\u0645\u06CC",
        isDestructive: true
      }).openAndWait();
      if (confirmed) {
        await this.runOperation(selectedTasks, "delete", {});
      }
    });
    const clearBtn = this.container.createEl("button", {
      cls: "ticktick-bulk-close mod-icon",
      attr: { "aria-label": "\u0644\u063A\u0648 \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0647\u0627 (Escape)" }
    });
    (0, import_obsidian8.setIcon)(clearBtn, "x");
    clearBtn.addEventListener("click", () => {
      bulkSelectionStore.clear();
    });
  }
  async runOperation(tasks, operationType, params) {
    if (this.isExecuting || tasks.length === 0) return;
    this.isExecuting = true;
    this.container.addClass("is-executing");
    new import_obsidian8.Notice(`\u062F\u0631 \u062D\u0627\u0644 \u0627\u0639\u0645\u0627\u0644 \u0639\u0645\u0644\u06CC\u0627\u062A \u06AF\u0631\u0648\u0647\u06CC \u0631\u0648\u06CC ${tasks.length} \u062A\u0633\u06A9...`);
    try {
      const taskIds = tasks.map((t) => String(t.id));
      await this.host.executeBulkOperation(taskIds, operationType, params);
      bulkSelectionStore.clear();
      await this.host.onChanged();
    } catch (err) {
      new import_obsidian8.Notice(`\u062E\u0637\u0627 \u062F\u0631 \u0627\u062C\u0631\u0627\u06CC \u0639\u0645\u0644\u06CC\u0627\u062A \u06AF\u0631\u0648\u0647\u06CC: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.isExecuting = false;
      this.container.removeClass("is-executing");
      await this.render();
    }
  }
};

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
var PlannerMultiSelectModal = class extends import_obsidian9.Modal {
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
var TaskOverflowModal = class extends import_obsidian9.Modal {
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
          new import_obsidian9.Notice("\u062A\u0633\u06A9 \u062A\u06A9\u0645\u06CC\u0644 \u0648 \u0647\u0645\u06AF\u0627\u0645 \u0634\u062F.");
        } catch (error) {
          check.checked = false;
          check.disabled = false;
          new import_obsidian9.Notice(error instanceof Error ? error.message : "\u062A\u06A9\u0645\u06CC\u0644 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
        }
      });
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};
var HabitDetailsModal = class extends import_obsidian9.Modal {
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
        new import_obsidian9.Notice(next2 >= goal ? "\u0639\u0627\u062F\u062A \u06A9\u0627\u0645\u0644 \u0648 \u0647\u0645\u06AF\u0627\u0645 \u0634\u062F." : `\u067E\u06CC\u0634\u0631\u0641\u062A \u0639\u0627\u062F\u062A: ${next2}/${goal}`);
      } catch (error) {
        new import_obsidian9.Notice(error instanceof Error ? error.message : "\u062B\u0628\u062A \u0639\u0627\u062F\u062A \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
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
var UnscheduleConfirmModal = class extends import_obsidian9.Modal {
  constructor(app, task, onConfirm) {
    super(app);
    this.task = task;
    this.onConfirm = onConfirm;
  }
  confirmed = false;
  onOpen() {
    this.modalEl.addClass("ticktick-unschedule-modal");
    this.titleEl.setText("\u062D\u0630\u0641 \u062A\u0627\u0631\u06CC\u062E \u0648 \u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u0647 \u0628\u06A9\u200C\u0644\u0627\u06AF");
    this.contentEl.createEl("p", {
      text: `\u0622\u06CC\u0627 \u0645\u0637\u0645\u0626\u0646 \u0647\u0633\u062A\u06CC\u062F \u06A9\u0647 \u0645\u06CC\u200C\u062E\u0648\u0627\u0647\u06CC\u062F \u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC \u062A\u0633\u06A9 \xAB${this.task.title || "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646"}\xBB \u0631\u0627 \u062D\u0630\u0641 \u06A9\u0631\u062F\u0647 \u0648 \u0622\u0646 \u0631\u0627 \u0628\u0647 \u0633\u062A\u0648\u0646 \u0628\u06A9\u200C\u0644\u0627\u06AF (\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E) \u0645\u0646\u062A\u0642\u0644 \u06A9\u0646\u06CC\u062F\u061F`
    });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "\u0627\u0646\u0635\u0631\u0627\u0641" }).addEventListener("click", () => this.close());
    const confirmBtn = actions.createEl("button", {
      text: "\u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u0647 \u0628\u06A9\u200C\u0644\u0627\u06AF",
      cls: "mod-warning"
    });
    confirmBtn.addEventListener("click", () => {
      this.confirmed = true;
      this.close();
    });
  }
  onClose() {
    this.contentEl.empty();
    if (this.confirmed) {
      this.onConfirm();
    }
  }
};
var PlanningCalendar = class {
  constructor(element, host) {
    this.element = element;
    this.host = host;
    this.day = todayInZone(host.timeZone);
    this.showHabits = host.showHabits();
  }
  backlogCollapsed = false;
  showTimeGrid = false;
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
  filterState = {
    projects: [],
    tags: [],
    statuses: [],
    priorities: [],
    dateRange: null,
    searchText: "",
    grouping: "none",
    sort: "ticktick"
  };
  draggingSourceDay = "";
  displayedHabitIds = /* @__PURE__ */ new Set();
  lastRenderedDay;
  bulkActionBar = null;
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
      (0, import_obsidian9.setIcon)(iconSpan, icon);
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
      cls: "ticktick-planner-add-btn tb-action-add-task mod-cta",
      attr: { type: "button", "aria-label": "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u062C\u062F\u06CC\u062F" }
    });
    const addIcon = addBtn.createSpan({ cls: "ticktick-btn-icon" });
    (0, import_obsidian9.setIcon)(addIcon, "plus");
    addBtn.createSpan({ text: "+ \u062A\u0633\u06A9 \u062C\u062F\u06CC\u062F" });
    addBtn.addEventListener("click", () => void this.addTask(this.day));
    const refreshBtn = actionsGroup.createEl("button", {
      cls: "ticktick-planner-sync-btn",
      attr: { type: "button", "aria-label": "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC" }
    });
    const syncIcon = refreshBtn.createSpan({ cls: "ticktick-btn-icon" });
    (0, import_obsidian9.setIcon)(syncIcon, "refresh-cw");
    refreshBtn.createSpan({ text: "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC" });
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      refreshBtn.addClass("is-syncing");
      try {
        await this.host.refresh();
        await this.render();
      } catch (error) {
        new import_obsidian9.Notice(error instanceof Error ? error.message : "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      } finally {
        refreshBtn.disabled = false;
        refreshBtn.removeClass("is-syncing");
      }
    });
    const unscheduledCount = unscheduledTasks(this.filteredTasks(), this.host.timeZone).length;
    const backlogBtn = actionsGroup.createEl("button", {
      cls: `ticktick-planner-toggle-btn ${!this.backlogCollapsed ? "is-active" : ""}`,
      attr: { type: "button", "aria-label": "\u062A\u063A\u06CC\u06CC\u0631 \u0648\u0636\u0639\u06CC\u062A \u0646\u0645\u0627\u06CC\u0634 \u0633\u062A\u0648\u0646 \u0628\u06A9\u200C\u0644\u0627\u06AF", title: "\u0646\u0645\u0627\u06CC\u0634 \u06CC\u0627 \u0645\u062E\u0641\u06CC\u200C\u0633\u0627\u0632\u06CC \u0633\u062A\u0648\u0646 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E" }
    });
    const bIcon = backlogBtn.createSpan({ cls: "ticktick-btn-icon" });
    (0, import_obsidian9.setIcon)(bIcon, "layout-list");
    backlogBtn.createSpan({ text: `\u0628\u06A9\u200C\u0644\u0627\u06AF (${unscheduledCount})` });
    backlogBtn.addEventListener("click", () => {
      this.backlogCollapsed = !this.backlogCollapsed;
      void this.render();
    });
    if (this.mode !== "month") {
      const timeGridBtn = actionsGroup.createEl("button", {
        cls: `ticktick-planner-toggle-btn ${this.showTimeGrid ? "is-active" : ""}`,
        attr: { type: "button", "aria-label": "\u0646\u0645\u0627\u06CC\u0634 \u0634\u0628\u06A9\u0647\u0654 \u0633\u0627\u0639\u062A\u06CC", title: "\u062A\u063A\u06CC\u06CC\u0631 \u062D\u0627\u0644\u062A \u0628\u0647 \u0634\u0628\u06A9\u0647\u0654 \u0633\u0627\u0639\u062A\u06CC \u062C\u0647\u062A \u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC \u062F\u0642\u06CC\u0642" }
      });
      const tgIcon = timeGridBtn.createSpan({ cls: "ticktick-btn-icon" });
      (0, import_obsidian9.setIcon)(tgIcon, "clock");
      timeGridBtn.createSpan({ text: this.showTimeGrid ? "\u0633\u0627\u0639\u062A: \u0631\u0648\u0634\u0646" : "\u0634\u0628\u06A9\u0647\u0654 \u0633\u0627\u0639\u062A\u06CC" });
      timeGridBtn.addEventListener("click", () => {
        this.showTimeGrid = !this.showTimeGrid;
        void this.render();
      });
    }
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
    this.bulkActionBar ??= new BulkActionBar(this.element, {
      app: this.host.app,
      timeZone: this.host.timeZone,
      tasks: () => this.host.tasks(),
      projects: async () => {
        const tasks2 = this.host.tasks();
        const projs = [...new Set(tasks2.map((t) => t.projectId).filter(Boolean))];
        return projs.map((id) => ({ id: String(id), name: String(tasks2.find((t) => t.projectId === id)?.projectName || id) }));
      },
      executeBulkOperation: async (ids, op, params) => this.host.executeBulkOperation ? this.host.executeBulkOperation(ids, op, params) : null,
      onChanged: async () => {
        await this.host.refresh();
        await this.render();
      }
    });
    void this.bulkActionBar.render();
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
    (0, import_obsidian9.setIcon)(habitsIcon, "activity");
    habitsBtn.createSpan({ text: this.showHabits ? "\u0639\u0627\u062F\u062A\u200C\u0647\u0627: \u0631\u0648\u0634\u0646" : "\u0646\u0645\u0627\u06CC\u0634 \u0639\u0627\u062F\u062A\u200C\u0647\u0627" });
    habitsBtn.addEventListener("click", () => {
      this.showHabits = !this.showHabits;
      void this.host.setShowHabits(this.showHabits).then(() => this.render());
    });
    if (this.showHabits) {
      const scopeBtn = filters.createEl("button", { cls: "ticktick-filter-chip", attr: { type: "button" } });
      (0, import_obsidian9.setIcon)(scopeBtn.createSpan({ cls: "ticktick-chip-icon" }), "calendar-days");
      scopeBtn.createSpan({ text: this.showHabitsForAllDays ? "\u0639\u0627\u062F\u062A\u200C\u0647\u0627: \u0647\u0645\u0647\u0654 \u0631\u0648\u0632\u0647\u0627" : "\u0639\u0627\u062F\u062A\u200C\u0647\u0627: \u0641\u0642\u0637 \u0631\u0648\u0632 \u0627\u0646\u062A\u062E\u0627\u0628\u06CC" });
      scopeBtn.addEventListener("click", () => {
        this.showHabitsForAllDays = !this.showHabitsForAllDays;
        void this.render();
      });
    }
    const recurringBtn = filters.createEl("button", { cls: `ticktick-filter-chip ${this.showAllRecurring ? "is-filtered" : ""}`, attr: { type: "button" } });
    (0, import_obsidian9.setIcon)(recurringBtn.createSpan({ cls: "ticktick-chip-icon" }), "repeat-2");
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
    (0, import_obsidian9.setIcon)(sortIcon, "arrow-up-down");
    sortBtn.createSpan({
      cls: "ticktick-filter-select-label",
      text: `\u0645\u0631\u062A\u0628\u200C\u0633\u0627\u0632\u06CC: ${sortLabels[this.sortMode] ?? "\u062A\u0631\u062A\u06CC\u0628 TickTick"}`
    });
    const sortChevron = sortBtn.createSpan({ cls: "ticktick-select-chevron" });
    (0, import_obsidian9.setIcon)(sortChevron, "chevron-down");
    const openSortMenu = (event) => {
      const menu = new import_obsidian9.Menu();
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
    (0, import_obsidian9.setIcon)(colorIcon, "palette");
    colorBtn.createSpan({
      cls: "ticktick-filter-select-label",
      text: colorLabels[this.colorMode] ?? "\u0631\u0646\u06AF: \u067E\u0631\u0648\u0698\u0647"
    });
    const colorChevron = colorBtn.createSpan({ cls: "ticktick-select-chevron" });
    (0, import_obsidian9.setIcon)(colorChevron, "chevron-down");
    const openColorMenu = (event) => {
      const menu = new import_obsidian9.Menu();
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
    (0, import_obsidian9.setIcon)(folderIcon, "folder");
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
    (0, import_obsidian9.setIcon)(tagIcon, "tag");
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
      (0, import_obsidian9.setIcon)(clearIcon, "x");
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
      (task) => matchesTaskFilter(task, this.filterState, { timeZone: this.host.timeZone }) && (!this.projects.size || this.projects.has(String(task.projectName ?? task.projectId ?? "\u0648\u0631\u0648\u062F\u06CC"))) && (!this.tags.size || (task.tags ?? []).some((tag) => this.tags.has(String(tag))))
    );
  }
  renderDays(root, days, tasks) {
    const today = todayInZone(this.host.timeZone);
    const workspace = root.createDiv({ cls: `ticktick-planner-workspace ${this.backlogCollapsed ? "is-backlog-collapsed" : ""}` });
    if (!this.backlogCollapsed) {
      this.renderBacklogColumn(workspace, tasks);
    }
    const grid = workspace.createDiv({ cls: `ticktick-planner-days ticktick-planner-days-${days.length}` });
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
      (0, import_obsidian9.setIcon)(add, "plus");
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
      if (this.showTimeGrid) {
        this.renderTimeGrid(column, day, singleDayTasks, tasks);
      } else {
        if (!singleDayTasks.length) {
          const emptyHint = column.createDiv({ cls: "ticktick-planner-day-empty" });
          emptyHint.createSpan({ text: "\u062A\u0633\u06A9\u06CC \u0646\u06CC\u0633\u062A" });
        } else {
          for (const task of singleDayTasks) this.renderTask(column, task);
        }
      }
      if (this.showHabitsForAllDays || day === this.day) this.renderHabits(column, day);
    }
  }
  renderMonth(root, tasks) {
    const today = todayInZone(this.host.timeZone);
    const workspace = root.createDiv({ cls: `ticktick-planner-workspace ${this.backlogCollapsed ? "is-backlog-collapsed" : ""}` });
    if (!this.backlogCollapsed) {
      this.renderBacklogColumn(workspace, tasks);
    }
    const grid = workspace.createDiv({ cls: "ticktick-planner-month" });
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
        (0, import_obsidian9.setIcon)(add, "plus");
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
      bar.dataset.taskId = String(task.id);
      bar.style.gridColumn = `${first + 1} / ${last + 2}`;
      bar.style.setProperty("--ticktick-task-tone", tone);
      const openDetails = () => new TaskDetailsModal(this.host.app, task, {
        complete: () => this.completeTask(task),
        load: (item) => this.host.load(item),
        edit: (item) => this.host.edit(item),
        changed: async () => {
          await this.host.refresh();
          await this.render();
        },
        allTasks: () => this.host.tasks()
      }).open();
      if (bulkSelectionStore.isSelected(String(task.id))) {
        bar.addClass("is-bulk-selected");
      }
      bar.addEventListener("click", (event) => {
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
          event.preventDefault();
          event.stopPropagation();
          const sel = bulkSelectionStore.toggle(String(task.id));
          bar.toggleClass("is-bulk-selected", sel);
          return;
        }
        openDetails();
      });
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
      (0, import_obsidian9.setIcon)(rangeIcon, "calendar-range");
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
          new import_obsidian9.Notice(complete ? "\u062B\u0628\u062A \u0639\u0627\u062F\u062A \u0628\u0631\u062F\u0627\u0634\u062A\u0647 \u0634\u062F." : current + 1 >= goal ? "\u0639\u0627\u062F\u062A \u06A9\u0627\u0645\u0644 \u0648 \u0647\u0645\u06AF\u0627\u0645 \u0634\u062F." : `\u06CC\u06A9 \u0645\u0631\u062D\u0644\u0647 \u062B\u0628\u062A \u0634\u062F: ${current + 1}/${goal}`);
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
      },
      allTasks: () => this.host.tasks()
    }).open();
    if (bulkSelectionStore.isSelected(String(task.id))) {
      card.addClass("is-bulk-selected");
    }
    card.addEventListener("click", (event) => {
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        const sel = bulkSelectionStore.toggle(String(task.id));
        card.toggleClass("is-bulk-selected", sel);
        return;
      }
      openDetails();
    });
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetails();
      }
    });
    if (bound) {
      const grip = card.createSpan({ cls: "ticktick-task-grip mod-icon", attr: { "aria-hidden": "true" } });
      (0, import_obsidian9.setIcon)(grip, "grip-vertical");
      grip.addEventListener("click", (event) => event.stopPropagation());
    }
    const check = card.createEl("input", { type: "checkbox", cls: "ticktick-task-check", attr: { "aria-label": `\u062A\u06A9\u0645\u06CC\u0644 ${task.title}` } });
    check.checked = isCompleted;
    check.disabled = isCompleted;
    check.addEventListener("click", (event) => event.stopPropagation());
    check.addEventListener("change", () => void this.completeTask(task, check));
    const content = card.createDiv({ cls: "ticktick-task-content" });
    const timeStr = formatTaskTime(task, this.host.timeZone);
    const estText = formatTaskEstimate(task);
    if (timeStr || priority.value > 0 || task.projectName || task.parentId || estText) {
      const metaRow = content.createDiv({ cls: "ticktick-task-meta-row" });
      if (task.parentId) {
        metaRow.createSpan({ cls: "ticktick-task-project-chip", text: "\u21B3" });
      }
      if (task.projectName) {
        metaRow.createSpan({ cls: "ticktick-task-project-chip", text: task.projectName });
      }
      if (estText) {
        metaRow.createSpan({ cls: "ticktick-task-project-chip", text: estText });
      }
      if (timeStr) {
        const timeBadge = metaRow.createSpan({ cls: "ticktick-task-time-badge" });
        const clockIcon = timeBadge.createSpan({ cls: "ticktick-time-icon" });
        (0, import_obsidian9.setIcon)(clockIcon, "clock");
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
      },
      allTasks: () => this.host.tasks()
    }).open();
    if (bulkSelectionStore.isSelected(String(task.id))) {
      card.addClass("is-bulk-selected");
    }
    card.addEventListener("click", (event) => {
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        event.preventDefault();
        event.stopPropagation();
        const sel = bulkSelectionStore.toggle(String(task.id));
        card.toggleClass("is-bulk-selected", sel);
        return;
      }
      openDetails();
    });
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
      new import_obsidian9.Notice("\u062A\u0633\u06A9 \u062A\u06A9\u0645\u06CC\u0644 \u0648 \u0647\u0645\u06AF\u0627\u0645 \u0634\u062F.");
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
      new import_obsidian9.Notice(error instanceof Error ? error.message : "\u062A\u06A9\u0645\u06CC\u0644 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    }
  }
  async addTask(day) {
    try {
      const created = await this.host.create({ dueDate: day });
      if (!created) return;
      new import_obsidian9.Notice("\u062A\u0633\u06A9 \u062F\u0631 TickTick \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.");
      await this.host.refresh();
      await this.render();
    } catch (error) {
      new import_obsidian9.Notice(error instanceof Error ? error.message : "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    }
  }
  renderBacklogColumn(parent, tasks) {
    const unscheduled = unscheduledTasks(tasks, this.host.timeZone, this.sortMode);
    const col = parent.createDiv({ cls: "ticktick-planner-backlog-column" });
    const header = col.createDiv({ cls: "ticktick-planner-backlog-header" });
    const titleWrap = header.createDiv({ cls: "ticktick-planner-backlog-title" });
    const bIcon = titleWrap.createSpan({ cls: "ticktick-backlog-icon" });
    (0, import_obsidian9.setIcon)(bIcon, "layout-list");
    titleWrap.createSpan({ text: "\u0628\u06A9\u200C\u0644\u0627\u06AF" });
    titleWrap.createSpan({ cls: "ticktick-planner-counter", text: `${unscheduled.length} \u062A\u0633\u06A9` });
    const headerActions = header.createDiv({ cls: "ticktick-backlog-actions" });
    const addBtn = headerActions.createEl("button", {
      cls: "ticktick-planner-add mod-icon",
      attr: { type: "button", "aria-label": "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u062F\u0631 \u0628\u06A9\u200C\u0644\u0627\u06AF", title: "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E" }
    });
    (0, import_obsidian9.setIcon)(addBtn, "plus");
    addBtn.addEventListener("click", () => void this.addTask(""));
    const collapseBtn = headerActions.createEl("button", {
      cls: "ticktick-backlog-collapse-btn mod-icon",
      attr: { type: "button", "aria-label": "\u0628\u0633\u062A\u0646 \u0628\u06A9\u200C\u0644\u0627\u06AF", title: "\u0628\u0633\u062A\u0646 \u0633\u062A\u0648\u0646 \u0628\u06A9\u200C\u0644\u0627\u06AF" }
    });
    (0, import_obsidian9.setIcon)(collapseBtn, "panel-right-close");
    collapseBtn.addEventListener("click", () => {
      this.backlogCollapsed = true;
      void this.render();
    });
    const cardsContainer = col.createDiv({ cls: "ticktick-planner-backlog-cards" });
    cardsContainer.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      cardsContainer.addClass("is-drag-over");
    });
    cardsContainer.addEventListener("dragleave", (event) => {
      if (!cardsContainer.contains(event.relatedTarget)) {
        cardsContainer.removeClass("is-drag-over");
      }
    });
    cardsContainer.addEventListener("drop", (event) => {
      event.preventDefault();
      cardsContainer.removeClass("is-drag-over");
      const task = this.draggedTask(event, tasks);
      if (task) void this.dropTaskToBacklog(task);
    });
    if (!unscheduled.length) {
      const emptyBox = cardsContainer.createDiv({ cls: "ticktick-planner-day-empty" });
      emptyBox.createSpan({ text: "\u062A\u0633\u06A9\u06CC \u062F\u0631 \u0628\u06A9\u200C\u0644\u0627\u06AF \u0646\u06CC\u0633\u062A" });
    } else {
      for (const task of unscheduled) {
        this.renderTask(cardsContainer, task);
      }
    }
  }
  renderTimeGrid(column, day, dayTasks, allTasks) {
    const allDayTasks = dayTasks.filter((item) => Boolean(item.isAllDay) || !String(item.dueDate ?? item.startDate ?? "").includes("T"));
    const timedTasks = dayTasks.filter((item) => !item.isAllDay && String(item.dueDate ?? item.startDate ?? "").includes("T"));
    const allDaySection = column.createDiv({ cls: "ticktick-timegrid-allday-section" });
    const allDayHeader = allDaySection.createDiv({ cls: "ticktick-timegrid-allday-header" });
    allDayHeader.createSpan({ cls: "ticktick-timegrid-allday-title", text: "\u062A\u0645\u0627\u0645 \u0631\u0648\u0632" });
    allDayHeader.createSpan({ cls: "ticktick-planner-counter", text: `${allDayTasks.length}` });
    allDaySection.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      allDaySection.addClass("is-drag-over");
    });
    allDaySection.addEventListener("dragleave", () => allDaySection.removeClass("is-drag-over"));
    allDaySection.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      allDaySection.removeClass("is-drag-over");
      const task = this.draggedTask(event, allTasks);
      if (task) void this.dropTask(task, day);
    });
    if (allDayTasks.length) {
      for (const task of allDayTasks) this.renderTask(allDaySection, task);
    }
    const timeSlotsWrap = column.createDiv({ cls: "ticktick-timegrid-slots" });
    for (const slot of HOURLY_SLOTS) {
      const slotRow = timeSlotsWrap.createDiv({ cls: "ticktick-timegrid-slot" });
      slotRow.dataset.time = slot;
      const slotHead = slotRow.createDiv({ cls: "ticktick-timegrid-slot-head" });
      const pTime = new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(/* @__PURE__ */ new Date(`2026-01-01T${slot}:00Z`));
      slotHead.createSpan({ cls: "ticktick-timegrid-hour-label", text: pTime });
      slotRow.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        slotRow.addClass("is-drag-over");
      });
      slotRow.addEventListener("dragleave", () => slotRow.removeClass("is-drag-over"));
      slotRow.addEventListener("drop", (event) => {
        event.preventDefault();
        event.stopPropagation();
        slotRow.removeClass("is-drag-over");
        const task = this.draggedTask(event, allTasks);
        if (task) void this.dropTaskToTime(task, day, slot);
      });
      const matchingTasks = timedTasks.filter((t) => taskHourSlot(t) === slot);
      for (const task of matchingTasks) {
        this.renderTask(slotRow, task);
      }
    }
    const outsideTasks = timedTasks.filter((t) => !HOURLY_SLOTS.includes(taskHourSlot(t) ?? ""));
    if (outsideTasks.length) {
      const extraSection = column.createDiv({ cls: "ticktick-timegrid-extra-section" });
      for (const task of outsideTasks) {
        this.renderTask(extraSection, task);
      }
    }
  }
  async dropTask(task, target, visualSourceDay) {
    const currentRange = taskDateRange(task, this.host.timeZone);
    const currentDay = currentRange?.start ?? toDateKey(task.dueDate ?? task.startDate, this.host.timeZone);
    if (!currentDay) {
      try {
        await this.host.reschedule(task, target);
        new import_obsidian9.Notice(`\u062A\u0633\u06A9 \xAB${task.title}\xBB \u0628\u0631\u0627\u06CC ${target} \u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC \u0634\u062F.`);
        await this.render();
      } catch (error) {
        new import_obsidian9.Notice(error instanceof Error ? error.message : "\u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      }
      return;
    }
    const offset = visualSourceDay ? Math.round((Date.parse(`${target}T12:00:00Z`) - Date.parse(`${visualSourceDay}T12:00:00Z`)) / 864e5) : Math.round((Date.parse(`${target}T12:00:00Z`) - Date.parse(`${currentDay}T12:00:00Z`)) / 864e5);
    if (!offset) return;
    const taskTarget = shiftCalendarDay(currentDay, offset);
    try {
      await this.host.reschedule(task, taskTarget);
      new import_obsidian9.Notice(currentRange ? "\u0628\u0627\u0632\u0647\u0654 \u0632\u0645\u0627\u0646\u06CC \u062A\u0633\u06A9 \u062C\u0627\u0628\u0647\u200C\u062C\u0627 \u0648 \u0647\u0645\u06AF\u0627\u0645 \u0634\u062F." : "\u062A\u0627\u0631\u06CC\u062E \u062A\u0633\u06A9 \u062C\u0627\u0628\u0647\u200C\u062C\u0627 \u0648 \u0647\u0645\u06AF\u0627\u0645 \u0634\u062F.");
      await this.render();
    } catch (error) {
      new import_obsidian9.Notice(error instanceof Error ? error.message : "\u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    }
  }
  async dropTaskToTime(task, targetDay, time) {
    try {
      await this.host.reschedule(task, targetDay, time);
      new import_obsidian9.Notice(`\u0633\u0627\u0639\u062A \u062A\u0633\u06A9 \xAB${task.title}\xBB \u0628\u0647 ${time} \u062A\u063A\u06CC\u06CC\u0631 \u06A9\u0631\u062F.`);
      await this.render();
    } catch (error) {
      new import_obsidian9.Notice(error instanceof Error ? error.message : "\u062A\u063A\u06CC\u06CC\u0631 \u0633\u0627\u0639\u062A \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    }
  }
  async dropTaskToBacklog(task) {
    const hasDate = Boolean(task.dueDate || task.startDate);
    if (!hasDate) return;
    new UnscheduleConfirmModal(this.host.app, task, async () => {
      try {
        await this.host.unschedule(task);
        new import_obsidian9.Notice(`\u062A\u0633\u06A9 \xAB${task.title}\xBB \u0628\u0647 \u0628\u06A9\u200C\u0644\u0627\u06AF \u0645\u0646\u062A\u0642\u0644 \u0634\u062F.`);
        await this.render();
      } catch (error) {
        new import_obsidian9.Notice(error instanceof Error ? error.message : "\u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u0647 \u0628\u06A9\u200C\u0644\u0627\u06AF \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      }
    }).open();
  }
  draggedTask(event, tasks) {
    const id = event.dataTransfer?.getData("text/ticktick-task") || event.dataTransfer?.getData("text/plain") || this.draggingTaskId;
    return tasks.find((item) => String(item.id) === String(id)) || this.host.tasks().find((item) => String(item.id) === String(id));
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
      const targetEl = event.target;
      const slot = targetEl?.closest(".ticktick-timegrid-slot")?.dataset.time;
      if (task) {
        if (slot) {
          void this.dropTaskToTime(task, day, slot);
        } else {
          void this.dropTask(task, day, sourceDay);
        }
      } else new import_obsidian9.Notice("\u062A\u0633\u06A9\u0650 \u062F\u0631 \u062D\u0627\u0644 \u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F\u061B \u062F\u0648\u0628\u0627\u0631\u0647 \u062A\u0644\u0627\u0634 \u06A9\u0646.");
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
var import_obsidian15 = require("obsidian");
init_project_board();

// src/obsidian/project-editor-modal.ts
var import_obsidian10 = require("obsidian");
var ProjectEditorModal = class extends import_obsidian10.Modal {
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
    new import_obsidian10.Setting(this.contentEl).setName("\u0646\u0627\u0645 \u0644\u06CC\u0633\u062A").addText((input) => {
      input.setValue(name).onChange((value) => name = value);
      input.inputEl.dir = "rtl";
      input.inputEl.focus();
    });
    new import_obsidian10.Setting(this.contentEl).setName("\u0631\u0646\u06AF").setDesc("\u06A9\u062F \u0631\u0646\u06AF \u0645\u0627\u0646\u0646\u062F #4772fa").addText((input) => {
      input.setValue(color).onChange((value) => color = value.trim());
      input.inputEl.dir = "ltr";
    });
    new import_obsidian10.Setting(this.contentEl).setName("\u0646\u0645\u0627\u06CC\u0634").addDropdown((dropdown) => dropdown.addOption("list", "\u0641\u0647\u0631\u0633\u062A").addOption("kanban", "\u06A9\u0627\u0646\u0628\u0627\u0646").addOption("timeline", "Timeline").setValue(viewMode).onChange((value) => viewMode = value));
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "\u0627\u0646\u0635\u0631\u0627\u0641" }).addEventListener("click", () => this.finish(null));
    actions.createEl("button", { text: "\u0630\u062E\u06CC\u0631\u0647", cls: "mod-cta" }).addEventListener("click", () => {
      if (!name.trim()) {
        new import_obsidian10.Notice("\u0646\u0627\u0645 \u0644\u06CC\u0633\u062A \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646.");
        return;
      }
      if (color && !/^#[0-9a-f]{6}$/i.test(color)) {
        new import_obsidian10.Notice("\u0631\u0646\u06AF \u0628\u0627\u06CC\u062F \u0645\u0627\u0646\u0646\u062F #4772fa \u0628\u0627\u0634\u062F.");
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

// src/obsidian/modals/create-tag-modal.ts
var import_obsidian11 = require("obsidian");
var CreateTagModal = class extends import_obsidian11.Modal {
  constructor(app, options) {
    super(app);
    this.options = options;
    if (this.options.projects.length > 0) {
      const inbox = this.options.projects.find((p) => p.isInbox || p.name === "Inbox" || p.name === "\u0648\u0631\u0648\u062F\u06CC");
      this.projectId = String(inbox?.id ?? this.options.projects[0].id);
    }
  }
  tag = "";
  taskTitle = "";
  projectId = "";
  onOpen() {
    this.modalEl.addClass("ticktick-create-tag-modal");
    this.modalEl.style.direction = "rtl";
    this.titleEl.setText("\u{1F3F7}\uFE0F \u0633\u0627\u062E\u062A \u0628\u0631\u0686\u0633\u0628 \u062C\u062F\u06CC\u062F");
    this.contentEl.createEl("p", {
      cls: "ticktick-modal-desc",
      text: "\u0646\u0627\u0645 \u0628\u0631\u0686\u0633\u0628 \u062C\u062F\u06CC\u062F \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F. \u0628\u0631\u0627\u06CC \u062B\u0628\u062A \u0628\u0631\u0686\u0633\u0628 \u062F\u0631 TickTick\u060C \u062A\u0633\u06A9 \u0627\u0648\u0644\u06CC\u0647 \u0628\u0627 \u0627\u06CC\u0646 \u0628\u0631\u0686\u0633\u0628 \u0627\u06CC\u062C\u0627\u062F \u0645\u06CC\u200C\u0634\u0648\u062F."
    });
    new import_obsidian11.Setting(this.contentEl).setName("\u0646\u0627\u0645 \u0628\u0631\u0686\u0633\u0628").setDesc("\u0628\u062F\u0648\u0646 \u06A9\u0627\u0631\u0627\u06A9\u062A\u0631 # \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F.").addText((text) => {
      text.setPlaceholder("\u0645\u062B\u0627\u0644: \u0641\u0648\u0631\u06CC\u060C \u06A9\u0627\u0631\u06CC\u060C \u0645\u0637\u0627\u0644\u0639\u0647...").setValue(this.tag).onChange((val) => {
        this.tag = val.trim().replace(/^[#＃]/, "");
      });
      text.inputEl.dir = "rtl";
      setTimeout(() => text.inputEl.focus(), 50);
      text.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void this.submit();
        }
      });
    });
    new import_obsidian11.Setting(this.contentEl).setName("\u0639\u0646\u0648\u0627\u0646 \u062A\u0633\u06A9 \u0627\u0648\u0644\u06CC\u0647 (\u0627\u062E\u062A\u06CC\u0627\u0631\u06CC)").setDesc("\u062F\u0631 \u0635\u0648\u0631\u062A \u062E\u0627\u0644\u06CC \u0628\u0648\u062F\u0646\u060C \u062A\u0633\u06A9\u06CC \u0628\u0627 \u0646\u0627\u0645 \u062E\u0648\u062F \u0628\u0631\u0686\u0633\u0628 \u062B\u0628\u062A \u0645\u06CC\u200C\u0634\u0648\u062F.").addText((text) => {
      text.setPlaceholder("\u0645\u062B\u0627\u0644: \u062A\u0633\u06A9 \u0628\u0627 \u0628\u0631\u0686\u0633\u0628 \u062C\u062F\u06CC\u062F").setValue(this.taskTitle).onChange((val) => {
        this.taskTitle = val;
      });
      text.inputEl.dir = "rtl";
      text.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void this.submit();
        }
      });
    });
    if (this.options.projects.length > 0) {
      new import_obsidian11.Setting(this.contentEl).setName("\u067E\u0631\u0648\u0698\u0647 / \u0644\u06CC\u0633\u062A \u0645\u0642\u0635\u062F").setDesc("\u062A\u0633\u06A9 \u0627\u0648\u0644\u06CC\u0647 \u062F\u0631 \u06A9\u062F\u0627\u0645 \u0644\u06CC\u0633\u062A \u0627\u06CC\u062C\u0627\u062F \u0634\u0648\u062F.").addDropdown((dd) => {
        for (const p of this.options.projects) {
          dd.addOption(String(p.id), p.name);
        }
        dd.setValue(this.projectId);
        dd.onChange((val) => {
          this.projectId = val;
        });
      });
    }
    const buttonContainer = this.contentEl.createDiv({ cls: "modal-button-container" });
    const cancelBtn = buttonContainer.createEl("button", { text: "\u0627\u0646\u0635\u0631\u0627\u0641" });
    cancelBtn.addEventListener("click", () => this.close());
    const saveBtn = buttonContainer.createEl("button", {
      text: "\u0633\u0627\u062E\u062A \u0628\u0631\u0686\u0633\u0628",
      cls: "mod-cta"
    });
    saveBtn.addEventListener("click", () => void this.submit());
  }
  async submit() {
    const cleanTag = this.tag.trim().replace(/^[#＃]/, "");
    if (!cleanTag) {
      new import_obsidian11.Notice("\u0644\u0637\u0641\u0627\u064B \u0646\u0627\u0645 \u0628\u0631\u0686\u0633\u0628 \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F.");
      return;
    }
    const finalTitle = this.taskTitle.trim() || `\u062A\u0633\u06A9 #${cleanTag}`;
    try {
      await this.options.onCreate({
        tag: cleanTag,
        taskTitle: finalTitle,
        projectId: this.projectId
      });
      this.close();
    } catch (err) {
      new import_obsidian11.Notice(err instanceof Error ? err.message : "\u0627\u06CC\u062C\u0627\u062F \u0628\u0631\u0686\u0633\u0628 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/obsidian/modals/create-smart-view-modal.ts
var import_obsidian12 = require("obsidian");
var CreateSmartViewModal = class extends import_obsidian12.Modal {
  // "project" | "priority" | "date"
  constructor(app, options) {
    super(app);
    this.options = options;
  }
  viewName = "";
  selectedProjects = [];
  selectedTags = [];
  selectedPriority = -1;
  // -1 means all
  selectedStatus = 0;
  // 0: open, 1: completed, -1: all
  selectedGrouping = "project";
  onOpen() {
    this.modalEl.addClass("ticktick-create-smart-view-modal");
    this.modalEl.style.direction = "rtl";
    this.titleEl.setText("\u2728 \u0633\u0627\u062E\u062A \u0646\u0645\u0627\u06CC \u0647\u0648\u0634\u0645\u0646\u062F \u062C\u062F\u06CC\u062F");
    this.contentEl.createEl("p", {
      cls: "ticktick-modal-desc",
      text: "\u06CC\u06A9 \u0646\u0645\u0627\u06CC \u0647\u0648\u0634\u0645\u0646\u062F \u0633\u0641\u0627\u0631\u0634\u06CC \u0628\u0627 \u062A\u0631\u06A9\u06CC\u0628 \u0641\u06CC\u0644\u062A\u0631\u0647\u0627\u06CC \u062F\u0644\u062E\u0648\u0627\u0647 \u0627\u06CC\u062C\u0627\u062F \u06A9\u0646\u06CC\u062F \u062A\u0627 \u062F\u0631 \u0646\u0648\u0627\u0631 \u06A9\u0646\u0627\u0631\u06CC \u0628\u0631\u062F \u0647\u0645\u06CC\u0634\u0647 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0628\u0627\u0634\u062F."
    });
    new import_obsidian12.Setting(this.contentEl).setName("\u0646\u0627\u0645 \u0646\u0645\u0627\u06CC \u0647\u0648\u0634\u0645\u0646\u062F").setDesc("\u0646\u0627\u0645\u06CC \u0645\u0634\u062E\u0635 \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u0646\u0645\u0627 (\u0645\u062B\u0644\u0627\u064B: \u0641\u0648\u0631\u06CC\u200C\u0647\u0627\u06CC \u062A\u0648\u0633\u0646 \u062A\u06A9\u0646\u0648).").addText((text) => {
      text.setPlaceholder("\u0645\u062B\u0627\u0644: \u06A9\u0627\u0631\u0647\u0627\u06CC \u0628\u0627 \u0627\u0648\u0644\u0648\u06CC\u062A \u0628\u0627\u0644\u0627").setValue(this.viewName).onChange((val) => {
        this.viewName = val;
      });
      text.inputEl.dir = "rtl";
      setTimeout(() => text.inputEl.focus(), 50);
      text.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          void this.submit();
        }
      });
    });
    const projectSetting = new import_obsidian12.Setting(this.contentEl).setName("\u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627 / \u0644\u06CC\u0633\u062A\u200C\u0647\u0627").setDesc("\u0627\u0646\u062A\u062E\u0627\u0628 \u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627\u06CC \u062E\u0627\u0635 \u06CC\u0627 \u0647\u0645\u0647\u0654 \u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627.");
    const projContainer = projectSetting.controlEl.createDiv({ cls: "ticktick-smart-filter-chips" });
    const allProjChip = projContainer.createSpan({
      cls: `ticktick-filter-choice-chip ${this.selectedProjects.length === 0 ? "is-selected" : ""}`,
      text: "\u0647\u0645\u0647\u0654 \u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627"
    });
    allProjChip.onclick = () => {
      this.selectedProjects = [];
      updateProjectChips();
    };
    const projectChipsMap = /* @__PURE__ */ new Map();
    const updateProjectChips = () => {
      allProjChip.toggleClass("is-selected", this.selectedProjects.length === 0);
      for (const [pId, chip] of projectChipsMap.entries()) {
        chip.toggleClass("is-selected", this.selectedProjects.includes(pId));
      }
    };
    for (const p of this.options.projects) {
      const chip = projContainer.createSpan({
        cls: `ticktick-filter-choice-chip ${this.selectedProjects.includes(String(p.id)) ? "is-selected" : ""}`,
        text: p.name
      });
      chip.onclick = () => {
        const id = String(p.id);
        if (this.selectedProjects.includes(id)) {
          this.selectedProjects = this.selectedProjects.filter((x) => x !== id);
        } else {
          this.selectedProjects.push(id);
        }
        updateProjectChips();
      };
      projectChipsMap.set(String(p.id), chip);
    }
    if (this.options.tags.length > 0) {
      const tagSetting = new import_obsidian12.Setting(this.contentEl).setName("\u0628\u0631\u0686\u0633\u0628\u200C\u0647\u0627").setDesc("\u0641\u06CC\u0644\u062A\u0631 \u0628\u0631 \u0627\u0633\u0627\u0633 \u06CC\u06A9 \u06CC\u0627 \u0686\u0646\u062F \u0628\u0631\u0686\u0633\u0628.");
      const tagContainer = tagSetting.controlEl.createDiv({ cls: "ticktick-smart-filter-chips" });
      const allTagsChip = tagContainer.createSpan({
        cls: `ticktick-filter-choice-chip ${this.selectedTags.length === 0 ? "is-selected" : ""}`,
        text: "\u0647\u0645\u0647\u0654 \u0628\u0631\u0686\u0633\u0628\u200C\u0647\u0627"
      });
      allTagsChip.onclick = () => {
        this.selectedTags = [];
        updateTagChips();
      };
      const tagChipsMap = /* @__PURE__ */ new Map();
      const updateTagChips = () => {
        allTagsChip.toggleClass("is-selected", this.selectedTags.length === 0);
        for (const [tName, chip] of tagChipsMap.entries()) {
          chip.toggleClass("is-selected", this.selectedTags.includes(tName));
        }
      };
      for (const t of this.options.tags) {
        const chip = tagContainer.createSpan({
          cls: `ticktick-filter-choice-chip ${this.selectedTags.includes(t) ? "is-selected" : ""}`,
          text: `#${t}`
        });
        chip.onclick = () => {
          if (this.selectedTags.includes(t)) {
            this.selectedTags = this.selectedTags.filter((x) => x !== t);
          } else {
            this.selectedTags.push(t);
          }
          updateTagChips();
        };
        tagChipsMap.set(t, chip);
      }
    }
    const prioSetting = new import_obsidian12.Setting(this.contentEl).setName("\u0627\u0648\u0644\u0648\u06CC\u062A").setDesc("\u0641\u06CC\u0644\u062A\u0631 \u0628\u0631 \u0627\u0633\u0627\u0633 \u0627\u0648\u0644\u0648\u06CC\u062A \u062A\u0633\u06A9.");
    const prioContainer = prioSetting.controlEl.createDiv({ cls: "ticktick-smart-filter-chips" });
    const prioOptions = [
      { label: "\u0647\u0645\u0647\u0654 \u0627\u0648\u0644\u0648\u06CC\u062A\u200C\u0647\u0627", val: -1 },
      { label: "\u0628\u0627\u0644\u0627 \u{1F6A9}", val: 5 },
      { label: "\u0645\u062A\u0648\u0633\u0637 \u{1F6A9}", val: 3 },
      { label: "\u06A9\u0645 \u{1F6A9}", val: 1 },
      { label: "\u0639\u0627\u062F\u06CC", val: 0 }
    ];
    for (const opt of prioOptions) {
      const chip = prioContainer.createSpan({
        cls: `ticktick-filter-choice-chip ${this.selectedPriority === opt.val ? "is-selected" : ""}`,
        text: opt.label
      });
      chip.onclick = () => {
        this.selectedPriority = opt.val;
        for (const sibling of Array.from(prioContainer.children)) {
          sibling.toggleClass("is-selected", sibling === chip);
        }
      };
    }
    new import_obsidian12.Setting(this.contentEl).setName("\u0648\u0636\u0639\u06CC\u062A \u062A\u0633\u06A9\u200C\u0647\u0627").setDesc("\u0646\u0645\u0627\u06CC\u0634 \u06A9\u0627\u0631\u0647\u0627\u06CC \u0628\u0627\u0632 \u06CC\u0627 \u062A\u0645\u0627\u0645\u200C\u0634\u062F\u0647.").addDropdown((dd) => {
      dd.addOption("0", "\u0641\u0642\u0637 \u06A9\u0627\u0631\u0647\u0627\u06CC \u0628\u0627\u0632 (\u0646\u0627\u062A\u0645\u0627\u0645)").addOption("1", "\u0641\u0642\u0637 \u06A9\u0627\u0631\u0647\u0627\u06CC \u0627\u0646\u062C\u0627\u0645\u200C\u0634\u062F\u0647").addOption("-1", "\u0647\u0645\u0647\u0654 \u062A\u0633\u06A9\u200C\u0647\u0627 (\u0628\u0627\u0632 \u0648 \u0627\u0646\u062C\u0627\u0645\u200C\u0634\u062F\u0647)").setValue(String(this.selectedStatus)).onChange((val) => {
        this.selectedStatus = Number(val);
      });
    });
    new import_obsidian12.Setting(this.contentEl).setName("\u0686\u06CC\u062F\u0645\u0627\u0646 \u0633\u062A\u0648\u0646\u200C\u0647\u0627\u06CC \u06A9\u0627\u0646\u0628\u0627\u0646").setDesc("\u0633\u062A\u0648\u0646\u200C\u0647\u0627 \u0628\u0631 \u0686\u0647 \u0627\u0633\u0627\u0633\u06CC \u062F\u0631 \u0627\u06CC\u0646 \u0646\u0645\u0627 \u062F\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC \u0634\u0648\u0646\u062F.").addDropdown((dd) => {
      dd.addOption("project", "\u0628\u0631 \u0627\u0633\u0627\u0633 \u067E\u0631\u0648\u0698\u0647 / \u0644\u06CC\u0633\u062A").addOption("priority", "\u0628\u0631 \u0627\u0633\u0627\u0633 \u0627\u0648\u0644\u0648\u06CC\u062A").addOption("date", "\u0628\u0631 \u0627\u0633\u0627\u0633 \u062A\u0627\u0631\u06CC\u062E \u0633\u0631\u0631\u0633\u06CC\u062F").setValue(this.selectedGrouping).onChange((val) => {
        this.selectedGrouping = val;
      });
    });
    const buttonContainer = this.contentEl.createDiv({ cls: "modal-button-container" });
    const cancelBtn = buttonContainer.createEl("button", { text: "\u0627\u0646\u0635\u0631\u0627\u0641" });
    cancelBtn.addEventListener("click", () => this.close());
    const saveBtn = buttonContainer.createEl("button", {
      text: "\u0630\u062E\u06CC\u0631\u0647 \u0646\u0645\u0627\u06CC \u0647\u0648\u0634\u0645\u0646\u062F",
      cls: "mod-cta"
    });
    saveBtn.addEventListener("click", () => void this.submit());
  }
  async submit() {
    const trimmed = this.viewName.trim();
    if (!trimmed) {
      new import_obsidian12.Notice("\u0644\u0637\u0641\u0627\u064B \u06CC\u06A9 \u0646\u0627\u0645 \u0628\u0631\u0627\u06CC \u0646\u0645\u0627\u06CC \u0647\u0648\u0634\u0645\u0646\u062F \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F.");
      return;
    }
    const filter = {
      projects: this.selectedProjects,
      tags: this.selectedTags,
      priorities: this.selectedPriority >= 0 ? [this.selectedPriority] : [],
      statuses: this.selectedStatus >= 0 ? [this.selectedStatus] : [],
      dateRange: null,
      searchText: "",
      grouping: this.selectedGrouping,
      sort: "ticktick"
    };
    const newView = {
      id: `sv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
      scope: "board",
      filter,
      grouping: this.selectedGrouping,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    try {
      await this.options.onSave(newView);
      this.close();
    } catch (err) {
      new import_obsidian12.Notice(err instanceof Error ? err.message : "\u0630\u062E\u06CC\u0631\u0647 \u0646\u0645\u0627\u06CC \u0647\u0648\u0634\u0645\u0646\u062F \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/obsidian/project-board.ts
init_calendar_range();
init_date();

// src/obsidian/filter-bar.ts
var import_obsidian13 = require("obsidian");
init_task_filter();
var MultiChoiceModal = class extends import_obsidian13.Modal {
  constructor(app, label, items, selected, onApply) {
    super(app);
    this.label = label;
    this.items = items;
    this.selected = selected;
    this.onApply = onApply;
  }
  answer = null;
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
      const filtered = this.items.filter(
        (item) => !filterText || item.label.toLowerCase().includes(filterText.toLowerCase())
      );
      if (!filtered.length) {
        list.createDiv({ cls: "ticktick-filter-empty", text: "\u0645\u0648\u0631\u062F\u06CC \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F" });
        return;
      }
      for (const item of filtered) {
        const row = list.createEl("label", { cls: "ticktick-filter-item" });
        const check = row.createEl("input", { type: "checkbox", cls: "ticktick-filter-checkbox" });
        check.checked = choices.has(item.id);
        row.createSpan({ cls: "ticktick-filter-item-text", text: item.label });
        check.addEventListener("change", () => {
          check.checked ? choices.add(item.id) : choices.delete(item.id);
        });
      }
    };
    searchInput.addEventListener("input", () => renderList(searchInput.value.trim()));
    renderList();
    const actions = this.contentEl.createDiv({ cls: "modal-button-container ticktick-filter-actions" });
    const selectAllBtn = actions.createEl("button", { text: "\u0627\u0646\u062A\u062E\u0627\u0628 \u0647\u0645\u0647", cls: "ticktick-filter-quick-btn" });
    selectAllBtn.addEventListener("click", () => {
      this.items.forEach((i) => choices.add(i.id));
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
  onClose() {
    this.contentEl.empty();
    if (this.answer) {
      this.onApply(this.answer);
    }
  }
};
var SaveViewModal = class extends import_obsidian13.Modal {
  constructor(app, defaultName, onSave) {
    super(app);
    this.onSave = onSave;
    this.name = defaultName;
  }
  name = "";
  onOpen() {
    this.titleEl.setText("\u0630\u062E\u06CC\u0631\u0647\u0654 \u0646\u0645\u0627\u06CC \u0641\u0639\u0644\u06CC (Saved View)");
    this.contentEl.createEl("p", {
      text: "\u062A\u0631\u06A9\u06CC\u0628 \u0641\u06CC\u0644\u062A\u0631\u0647\u0627\u060C \u062C\u0633\u062A\u200C\u0648\u062C\u0648 \u0648 \u0686\u06CC\u062F\u0645\u0627\u0646 \u0641\u0639\u0644\u06CC \u0631\u0627 \u0628\u0627 \u06CC\u06A9 \u0646\u0627\u0645 \u062F\u0644\u062E\u0648\u0627\u0647 \u0630\u062E\u06CC\u0631\u0647 \u06A9\u0646\u06CC\u062F \u062A\u0627 \u0647\u0645\u06CC\u0634\u0647 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0628\u0627\u0634\u062F."
    });
    const input = this.contentEl.createEl("input", {
      type: "text",
      value: this.name,
      cls: "ticktick-saved-view-input",
      attr: { placeholder: "\u0645\u062B\u0627\u0644: \u062A\u0648\u0633\u0646\u200C\u062A\u06A9\u0646\u0648 + #\u0641\u0648\u0631\u06CC" }
    });
    input.focus();
    input.addEventListener("input", () => {
      this.name = input.value;
    });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "\u0627\u0646\u0635\u0631\u0627\u0641" }).addEventListener("click", () => this.close());
    const saveBtn = actions.createEl("button", { text: "\u0630\u062E\u06CC\u0631\u0647 \u0646\u0645\u0627", cls: "mod-cta" });
    saveBtn.addEventListener("click", () => {
      if (!this.name.trim()) {
        new import_obsidian13.Notice("\u0644\u0637\u0641\u0627\u064B \u06CC\u06A9 \u0646\u0627\u0645 \u0628\u0631\u0627\u06CC \u0646\u0645\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F.");
        return;
      }
      this.onSave(this.name.trim());
      this.close();
    });
  }
  onClose() {
    this.contentEl.empty();
  }
};
var FilterBar = class {
  constructor(parent, host) {
    this.parent = parent;
    this.host = host;
    this.element = this.parent.createDiv({ cls: "ticktick-shared-filter-bar" });
  }
  element;
  searchInput = null;
  searchClearBtn = null;
  chipsContainer = null;
  debounceTimer = null;
  render() {
    const wasSearchFocused = this.searchInput === document.activeElement;
    const selStart = this.searchInput?.selectionStart ?? null;
    const selEnd = this.searchInput?.selectionEnd ?? null;
    const prevText = this.searchInput ? this.searchInput.value : null;
    this.element.empty();
    const state = this.host.filterState();
    const searchWrapper = this.element.createDiv({ cls: "ticktick-filter-search-pill" });
    const sIcon = searchWrapper.createSpan({ cls: "ticktick-search-icon" });
    (0, import_obsidian13.setIcon)(sIcon, "search");
    const inputVal = prevText !== null ? prevText : state.searchText || "";
    this.searchInput = searchWrapper.createEl("input", {
      type: "search",
      placeholder: "\u062C\u0633\u062A\u200C\u0648\u062C\u0648\u06CC \u062A\u0633\u06A9\u200C\u0647\u0627\u2026",
      value: inputVal,
      cls: "ticktick-filter-search-field"
    });
    this.searchClearBtn = searchWrapper.createEl("button", {
      cls: "ticktick-filter-clear-search",
      attr: { type: "button", "aria-label": "\u067E\u0627\u06A9 \u06A9\u0631\u062F\u0646 \u0645\u062A\u0646" }
    });
    (0, import_obsidian13.setIcon)(this.searchClearBtn, "x");
    this.updateSearchClearButton();
    this.searchClearBtn.addEventListener("click", () => {
      if (this.searchInput) {
        this.searchInput.value = "";
        this.searchInput.focus();
      }
      this.updateSearchClearButton();
      this.notifyFilterChange({ ...this.host.filterState(), searchText: "" });
      this.renderChips();
    });
    this.searchInput.addEventListener("input", () => {
      this.updateSearchClearButton();
      if (this.debounceTimer !== null) {
        window.clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = window.setTimeout(() => {
        this.debounceTimer = null;
        this.notifyFilterChange({
          ...this.host.filterState(),
          searchText: this.searchInput?.value || ""
        });
        this.renderChips();
      }, 120);
    });
    this.searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        if (this.debounceTimer !== null) {
          window.clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
        }
        this.notifyFilterChange({
          ...this.host.filterState(),
          searchText: this.searchInput?.value || ""
        });
        this.renderChips();
      } else if (e.key === "Escape") {
        if (this.debounceTimer !== null) {
          window.clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
        }
        if (this.searchInput) {
          this.searchInput.value = "";
        }
        this.updateSearchClearButton();
        this.notifyFilterChange({
          ...this.host.filterState(),
          searchText: ""
        });
        this.renderChips();
      }
    });
    this.chipsContainer = this.element.createDiv({ cls: "ticktick-filter-chips-container" });
    this.renderChips();
    if (wasSearchFocused && this.searchInput) {
      this.searchInput.focus();
      if (selStart !== null && selEnd !== null) {
        this.searchInput.setSelectionRange(selStart, selEnd);
      }
    }
  }
  updateSearchClearButton() {
    if (!this.searchClearBtn) return;
    const hasText = Boolean(this.searchInput?.value);
    this.searchClearBtn.style.display = hasText ? "flex" : "none";
  }
  notifyFilterChange(nextState) {
    this.host.onFilterChange(nextState);
  }
  renderChips() {
    if (!this.chipsContainer) return;
    this.chipsContainer.empty();
    const state = this.host.filterState();
    if (this.host.sortMode && this.host.onSortChange) {
      const currentSort = this.host.sortMode();
      const sortLabels = {
        ticktick: "\u062A\u0631\u062A\u06CC\u0628 TickTick",
        time: "\u062A\u0627\u0631\u06CC\u062E/\u0633\u0627\u0639\u062A",
        priority: "\u0627\u0648\u0644\u0648\u06CC\u062A",
        title: "\u0639\u0646\u0648\u0627\u0646"
      };
      const sortBtn = this.chipsContainer.createEl("button", {
        cls: `ticktick-filter-chip ${currentSort !== "ticktick" ? "is-active" : ""}`,
        attr: { type: "button", "aria-label": "\u0645\u0631\u062A\u0628\u200C\u0633\u0627\u0632\u06CC \u06A9\u0627\u0631\u062A\u200C\u0647\u0627", title: "\u0645\u0631\u062A\u0628\u200C\u0633\u0627\u0632\u06CC \u06A9\u0627\u0631\u062A\u200C\u0647\u0627" }
      });
      const sIcon = sortBtn.createSpan({ cls: "ticktick-chip-icon" });
      (0, import_obsidian13.setIcon)(sIcon, "arrow-up-down");
      sortBtn.createSpan({ text: `\u0645\u0631\u062A\u0628\u200C\u0633\u0627\u0632\u06CC: ${sortLabels[currentSort] ?? "\u062A\u0631\u062A\u06CC\u0628 TickTick"}` });
      const chevron2 = sortBtn.createSpan({ cls: "ticktick-chip-chevron" });
      (0, import_obsidian13.setIcon)(chevron2, "chevron-down");
      sortBtn.addEventListener("click", (e) => {
        const menu = new import_obsidian13.Menu();
        for (const [val, label] of [
          ["ticktick", "\u062A\u0631\u062A\u06CC\u0628 TickTick"],
          ["time", "\u062A\u0627\u0631\u06CC\u062E/\u0633\u0627\u0639\u062A"],
          ["priority", "\u0627\u0648\u0644\u0648\u06CC\u062A"],
          ["title", "\u0639\u0646\u0648\u0627\u0646"]
        ]) {
          menu.addItem((item) => {
            item.setTitle(label).setChecked(currentSort === val).onClick(() => {
              this.host.onSortChange?.(val);
              this.renderChips();
            });
          });
        }
        menu.showAtMouseEvent(e);
      });
    }
    if (this.host.scope !== "board") {
      const projects = this.host.projects();
      const selProjects = new Set(state.projects || []);
      const projBtn = this.chipsContainer.createEl("button", {
        cls: `ticktick-filter-chip ${selProjects.size ? "is-active" : ""}`,
        attr: { type: "button" }
      });
      const pIcon = projBtn.createSpan({ cls: "ticktick-chip-icon" });
      (0, import_obsidian13.setIcon)(pIcon, "folder");
      const projLabel = selProjects.size ? `\u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627 (${selProjects.size})` : "\u0647\u0645\u0647\u0654 \u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627";
      projBtn.createSpan({ text: projLabel });
      projBtn.addEventListener("click", () => {
        new MultiChoiceModal(
          this.host.app,
          "\u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627",
          projects.map((p) => ({ id: p.id, label: p.name })),
          selProjects,
          (selected) => {
            this.notifyFilterChange({
              ...state,
              projects: [...selected]
            });
            this.renderChips();
          }
        ).open();
      });
    }
    const tags = this.host.tags();
    const selTags = new Set(state.tags || []);
    const tagBtn = this.chipsContainer.createEl("button", {
      cls: `ticktick-filter-chip ${selTags.size ? "is-active" : ""}`,
      attr: { type: "button" }
    });
    const tIcon = tagBtn.createSpan({ cls: "ticktick-chip-icon" });
    (0, import_obsidian13.setIcon)(tIcon, "tag");
    const tagLabel = selTags.size ? `\u0628\u0631\u0686\u0633\u0628\u200C\u0647\u0627 (${selTags.size})` : "\u0647\u0645\u0647\u0654 \u0628\u0631\u0686\u0633\u0628\u200C\u0647\u0627";
    tagBtn.createSpan({ text: tagLabel });
    tagBtn.addEventListener("click", () => {
      new MultiChoiceModal(
        this.host.app,
        "\u0628\u0631\u0686\u0633\u0628\u200C\u0647\u0627",
        tags.map((t) => ({ id: t, label: `#${t}` })),
        selTags,
        (selected) => {
          this.notifyFilterChange({
            ...state,
            tags: [...selected]
          });
          this.renderChips();
        }
      ).open();
    });
    const selPriorities = new Set(state.priorities || []);
    const priorityBtn = this.chipsContainer.createEl("button", {
      cls: `ticktick-filter-chip ${selPriorities.size ? "is-active" : ""}`,
      attr: { type: "button" }
    });
    const prIcon = priorityBtn.createSpan({ cls: "ticktick-chip-icon" });
    (0, import_obsidian13.setIcon)(prIcon, "flag");
    const prLabel = selPriorities.size ? `\u0627\u0648\u0644\u0648\u06CC\u062A (${selPriorities.size})` : "\u0647\u0645\u0647\u0654 \u0627\u0648\u0644\u0648\u06CC\u062A\u200C\u0647\u0627";
    priorityBtn.createSpan({ text: prLabel });
    priorityBtn.addEventListener("click", (e) => {
      const menu = new import_obsidian13.Menu();
      const priorityOptions = [
        [5, "\u{1F534} \u0641\u0648\u0631\u06CC (High)"],
        [3, "\u{1F7E1} \u0628\u0627\u0644\u0627 (Medium)"],
        [1, "\u{1F535} \u0645\u062A\u0648\u0633\u0637 (Low)"],
        [0, "\u26AA \u0628\u062F\u0648\u0646 \u0627\u0648\u0644\u0648\u06CC\u062A (None)"]
      ];
      for (const [pVal, pText] of priorityOptions) {
        menu.addItem((item) => {
          item.setTitle(pText).setChecked(selPriorities.has(pVal)).onClick(() => {
            const next = new Set(selPriorities);
            next.has(pVal) ? next.delete(pVal) : next.add(pVal);
            this.notifyFilterChange({
              ...state,
              priorities: [...next]
            });
            this.renderChips();
          });
        });
      }
      menu.addSeparator();
      menu.addItem((item) => {
        item.setTitle("\u067E\u0627\u06A9 \u06A9\u0631\u062F\u0646 \u0641\u06CC\u0644\u062A\u0631 \u0627\u0648\u0644\u0648\u06CC\u062A").onClick(() => {
          this.notifyFilterChange({ ...state, priorities: [] });
          this.renderChips();
        });
      });
      menu.showAtMouseEvent(e);
    });
    const selStatuses = state.statuses || [];
    const statusBtn = this.chipsContainer.createEl("button", {
      cls: `ticktick-filter-chip ${selStatuses.length ? "is-active" : ""}`,
      attr: { type: "button" }
    });
    const stIcon = statusBtn.createSpan({ cls: "ticktick-chip-icon" });
    (0, import_obsidian13.setIcon)(stIcon, "check-circle");
    const stLabel = selStatuses.includes(2) && !selStatuses.includes(0) ? "\u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647" : selStatuses.includes(0) && !selStatuses.includes(2) ? "\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0628\u0627\u0632" : "\u0647\u0645\u0647\u0654 \u0648\u0636\u0639\u06CC\u062A\u200C\u0647\u0627";
    statusBtn.createSpan({ text: stLabel });
    statusBtn.addEventListener("click", (e) => {
      const menu = new import_obsidian13.Menu();
      menu.addItem((item) => item.setTitle("\u0647\u0645\u0647\u0654 \u0648\u0636\u0639\u06CC\u062A\u200C\u0647\u0627").setChecked(!selStatuses.length).onClick(() => {
        this.notifyFilterChange({ ...state, statuses: [] });
        this.renderChips();
      }));
      menu.addItem((item) => item.setTitle("\u0641\u0642\u0637 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0628\u0627\u0632").setChecked(selStatuses.length === 1 && selStatuses[0] === 0).onClick(() => {
        this.notifyFilterChange({ ...state, statuses: [0] });
        this.renderChips();
      }));
      menu.addItem((item) => item.setTitle("\u0641\u0642\u0637 \u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647\u200C\u0647\u0627").setChecked(selStatuses.length === 1 && selStatuses[0] === 2).onClick(() => {
        this.notifyFilterChange({ ...state, statuses: [2] });
        this.renderChips();
      }));
      menu.showAtMouseEvent(e);
    });
    const savedViews = this.host.savedViews();
    const savedViewsBtn = this.chipsContainer.createEl("button", {
      cls: "ticktick-filter-chip ticktick-saved-views-chip",
      attr: { type: "button" }
    });
    const svIcon = savedViewsBtn.createSpan({ cls: "ticktick-chip-icon" });
    (0, import_obsidian13.setIcon)(svIcon, "bookmark");
    savedViewsBtn.createSpan({ text: "\u0646\u0645\u0627\u0647\u0627\u06CC \u0630\u062E\u06CC\u0631\u0647\u200C\u0634\u062F\u0647" });
    const chevron = savedViewsBtn.createSpan({ cls: "ticktick-select-chevron" });
    (0, import_obsidian13.setIcon)(chevron, "chevron-down");
    savedViewsBtn.addEventListener("click", (e) => {
      const menu = new import_obsidian13.Menu();
      menu.addItem((item) => {
        item.setTitle("\u{1F4BE} \u0630\u062E\u06CC\u0631\u0647\u0654 \u0641\u06CC\u0644\u062A\u0631\u0647\u0627\u06CC \u0641\u0639\u0644\u06CC \u0628\u0647 \u0639\u0646\u0648\u0627\u0646 \u0646\u0645\u0627\u06CC \u062C\u062F\u06CC\u062F\u2026").setIcon("plus").onClick(() => {
          new SaveViewModal(this.host.app, "", async (name) => {
            const currentFilter = {
              ...state,
              searchText: this.searchInput?.value || ""
            };
            const newView = createSavedView(name, currentFilter, { scope: this.host.scope });
            await this.host.saveSavedViews([...savedViews, newView]);
            this.renderChips();
            new import_obsidian13.Notice(`\u0646\u0645\u0627\u06CC \xAB${name}\xBB \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.`);
          }).open();
        });
      });
      if (savedViews.length) {
        menu.addSeparator();
        for (const view of savedViews) {
          menu.addItem((item) => {
            item.setTitle(`\u{1F4CC} ${view.name}`).onClick(() => {
              if (this.searchInput && view.filter.searchText !== void 0) {
                this.searchInput.value = view.filter.searchText;
              }
              this.updateSearchClearButton();
              this.notifyFilterChange({
                ...state,
                ...view.filter
              });
              this.renderChips();
              new import_obsidian13.Notice(`\u0646\u0645\u0627\u06CC \xAB${view.name}\xBB \u0627\u0639\u0645\u0627\u0644 \u0634\u062F.`);
            });
          });
        }
        menu.addSeparator();
        menu.addItem((item) => {
          item.setTitle("\u0645\u062F\u06CC\u0631\u06CC\u062A \u0648 \u062D\u0630\u0641 \u0646\u0645\u0627\u0647\u0627\u06CC \u0630\u062E\u06CC\u0631\u0647\u200C\u0634\u062F\u0647\u2026").setIcon("trash-2").onClick(() => {
            this.openManageSavedViewsMenu(e);
          });
        });
      }
      menu.showAtMouseEvent(e);
    });
    const activeSearch = Boolean(this.searchInput?.value || state.searchText);
    const hasActiveFilters = Boolean(
      activeSearch || state.projects && state.projects.length > 0 || state.tags && state.tags.length > 0 || state.priorities && state.priorities.length > 0 || state.statuses && state.statuses.length > 0 || state.dateRange
    );
    if (hasActiveFilters) {
      const resetBtn = this.chipsContainer.createEl("button", {
        cls: "ticktick-filter-clear-btn",
        attr: { type: "button", title: "\u067E\u0627\u06A9 \u06A9\u0631\u062F\u0646 \u0647\u0645\u0647\u0654 \u0641\u06CC\u0644\u062A\u0631\u0647\u0627", "aria-label": "\u067E\u0627\u06A9 \u06A9\u0631\u062F\u0646 \u0641\u06CC\u0644\u062A\u0631\u0647\u0627" }
      });
      const rIcon = resetBtn.createSpan({ cls: "ticktick-chip-icon" });
      (0, import_obsidian13.setIcon)(rIcon, "rotate-ccw");
      resetBtn.createSpan({ text: "\u067E\u0627\u06A9\u200C\u0633\u0627\u0632\u06CC \u0641\u06CC\u0644\u062A\u0631\u0647\u0627" });
      resetBtn.addEventListener("click", () => {
        if (this.searchInput) {
          this.searchInput.value = "";
        }
        this.updateSearchClearButton();
        this.notifyFilterChange({
          projects: [],
          tags: [],
          statuses: [],
          priorities: [],
          dateRange: null,
          searchText: "",
          grouping: state.grouping || "none",
          sort: state.sort || "ticktick"
        });
        this.renderChips();
      });
    }
  }
  openManageSavedViewsMenu(event) {
    const savedViews = this.host.savedViews();
    const menu = new import_obsidian13.Menu();
    for (const view of savedViews) {
      menu.addItem((item) => {
        item.setTitle(`\u062D\u0630\u0641 \xAB${view.name}\xBB`).setIcon("trash").onClick(async () => {
          const next = savedViews.filter((v) => v.id !== view.id);
          await this.host.saveSavedViews(next);
          this.renderChips();
          new import_obsidian13.Notice(`\u0646\u0645\u0627\u06CC \xAB${view.name}\xBB \u062D\u0630\u0641 \u0634\u062F.`);
        });
      });
    }
    menu.showAtMouseEvent(event);
  }
};

// src/obsidian/project-board.ts
init_task_filter();

// src/obsidian/components/task-card-element.ts
var import_obsidian14 = require("obsidian");
init_date();
function formatTaskTime2(task, timeZone) {
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
function renderDueDateChip(container, task, timeZone, isCompleted) {
  const today = todayInZone(timeZone);
  const dueDay = toDateKey(task.dueDate || task.startDate, task.timeZone || timeZone);
  if (!dueDay) return null;
  const isOverdue = dueDay < today && !isCompleted;
  const isToday = dueDay === today;
  const isTomorrow = dueDay === toDateKey(new Date(Date.now() + 864e5), timeZone);
  let dueBadgeClass = "tb-badge-slate";
  let dueText = formatPersianDate(dueDay);
  if (isOverdue) {
    dueBadgeClass = "tb-badge-coral";
    dueText = `\u0645\u0639\u0648\u0642\u0647: ${dueText}`;
  } else if (isToday) {
    dueBadgeClass = "tb-badge-mint";
    dueText = "\u0627\u0645\u0631\u0648\u0632";
  } else if (isTomorrow) {
    dueBadgeClass = "tb-badge-cobalt";
    dueText = "\u0641\u0631\u062F\u0627";
  }
  const timeStr = formatTaskTime2(task, timeZone);
  if (timeStr) {
    dueText = `${dueText} ${timeStr}`;
  }
  const dueChip = container.createSpan({ cls: `tb-badge ${dueBadgeClass}` });
  const calIcon = dueChip.createSpan({ cls: "tb-chip-icon" });
  (0, import_obsidian14.setIcon)(calIcon, timeStr ? "clock" : "calendar");
  dueChip.createSpan({ text: dueText });
  return dueChip;
}
function renderTaskCard(parent, options) {
  const {
    task,
    timeZone,
    projectColor,
    projectName,
    movable = true,
    dragType = "text/ticktick-task",
    onComplete,
    onOpenDetails,
    onStartPomodoro,
    onSchedule,
    onContextMenu,
    isBulkSelected = false,
    onToggleBulkSelect,
    showProjectPill = true,
    variant = "board",
    isBound = false,
    subtasks = [],
    onCompleteSubtask,
    onOpenSubtaskDetails,
    onAddSubtask
  } = options;
  const isCompleted = Number(task.status ?? 0) !== 0;
  const isNote = String(task.kind ?? task.type ?? task.taskType ?? "").toUpperCase() === "NOTE";
  const isPinned2 = Boolean(task.pinned ?? task.isPinned ?? task.pin ?? task.pinnedTime ?? task.pinnedAt ?? task.pinTime);
  const priority = taskPriority(task.priority);
  const prioNum = Number(task.priority ?? 0);
  let toneClass = "tb-tone-slate";
  if (isNote) {
    toneClass = "tb-tone-orchid";
  } else if (prioNum === 5) {
    toneClass = "tb-tone-coral";
  } else if (prioNum === 3) {
    toneClass = "tb-tone-amber";
  } else if (prioNum === 1) {
    toneClass = "tb-tone-cobalt";
  }
  const selectedInStore = isBulkSelected || bulkSelectionStore.isSelected(String(task.id));
  const card = parent.createDiv({
    cls: `tb-task-card ticktick-project-card ${toneClass} priority-${priority.value} ${isCompleted ? "is-completed" : ""} ${isNote ? "is-note" : ""} ${selectedInStore ? "is-bulk-selected" : ""} mod-${variant}`,
    attr: {
      role: "button",
      tabindex: "0",
      "data-task-id": String(task.id),
      "aria-label": `${cleanTaskTitle(task.title)}, ${priority.label}`,
      title: "\u0628\u0631\u0627\u06CC \u0645\u0634\u0627\u0647\u062F\u0647 \u062C\u0632\u0626\u06CC\u0627\u062A \u06A9\u0644\u06CC\u06A9 \u06A9\u0646\u06CC\u062F"
    }
  });
  if (projectColor) {
    card.style.setProperty("--ticktick-task-tone", projectColor);
  }
  if (movable) {
    card.setAttribute("draggable", "true");
    card.addEventListener("dragstart", (e) => {
      card.addClass("is-dragging");
      e.dataTransfer?.setData(dragType, String(task.id));
      e.dataTransfer?.setData("text/ticktick-task", String(task.id));
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => {
      card.removeClass("is-dragging");
    });
  }
  const headerRow = card.createDiv({ cls: "tb-card-header-row" });
  const hasSubtasks = Boolean(subtasks && subtasks.length > 0);
  let subtasksContainer = null;
  let isSubtasksExpanded = true;
  let chevIcon = null;
  if (hasSubtasks) {
    const expandBtn = headerRow.createEl("button", {
      cls: "tb-card-expand-btn",
      attr: {
        type: "button",
        "aria-label": "\u062A\u063A\u06CC\u06CC\u0631 \u0648\u0636\u0639\u06CC\u062A \u0646\u0645\u0627\u06CC\u0634 \u0632\u06CC\u0631\u062A\u0633\u06A9\u200C\u0647\u0627",
        title: "\u0646\u0645\u0627\u06CC\u0634 \u06CC\u0627 \u0628\u0633\u062A\u0646 \u0632\u06CC\u0631\u062A\u0633\u06A9\u200C\u0647\u0627"
      }
    });
    chevIcon = expandBtn.createSpan({ cls: "tb-expand-icon" });
    (0, import_obsidian14.setIcon)(chevIcon, "chevron-down");
    expandBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      isSubtasksExpanded = !isSubtasksExpanded;
      if (chevIcon) {
        (0, import_obsidian14.setIcon)(chevIcon, isSubtasksExpanded ? "chevron-down" : "chevron-left");
      }
      if (subtasksContainer) {
        subtasksContainer.style.display = isSubtasksExpanded ? "flex" : "none";
      }
      card.toggleClass("is-subtasks-collapsed", !isSubtasksExpanded);
    });
  }
  if (isNote) {
    const noteIcon = headerRow.createSpan({ cls: "tb-card-note-icon", attr: { title: "\u06CC\u0627\u062F\u062F\u0627\u0634\u062A TickTick" } });
    (0, import_obsidian14.setIcon)(noteIcon, "file-text");
  } else {
    const checkEl = headerRow.createDiv({
      cls: `tb-checkbox tb-card-checkbox ${isCompleted ? "is-checked" : ""}`,
      attr: {
        role: "checkbox",
        "aria-checked": isCompleted ? "true" : "false",
        "aria-label": `\u062A\u06A9\u0645\u06CC\u0644 ${cleanTaskTitle(task.title)}`,
        tabindex: "0"
      }
    });
    const svg = checkEl.createSvg("svg", {
      attr: { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor" }
    });
    svg.createSvg("path", {
      attr: {
        d: "M3.5 8.5L6.5 11.5L12.5 4.5",
        "stroke-linecap": "round",
        "stroke-linejoin": "round"
      }
    });
    checkEl.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (checkEl.hasClass("is-busy")) return;
      checkEl.addClass("is-busy");
      checkEl.addClass("is-checked");
      try {
        if (onComplete) {
          await onComplete(task);
        }
      } catch {
        checkEl.removeClass("is-checked");
        checkEl.removeClass("is-busy");
      }
    });
    checkEl.addEventListener("keydown", (e) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        checkEl.click();
      }
    });
  }
  const titleEl = headerRow.createDiv({
    cls: "tb-card-title",
    text: cleanTaskTitle(task.title) || "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646"
  });
  titleEl.addEventListener("click", (e) => {
    e.stopPropagation();
    if (onOpenDetails) onOpenDetails(task);
  });
  if (isPinned2) {
    const pin = headerRow.createSpan({ cls: "tb-card-pin-icon", attr: { title: "\u067E\u06CC\u0646\u200C\u0634\u062F\u0647" } });
    (0, import_obsidian14.setIcon)(pin, "pin");
  }
  if (prioNum > 0) {
    let prioBadgeClass = "tb-badge-slate";
    if (prioNum === 5) prioBadgeClass = "tb-badge-coral";
    else if (prioNum === 3) prioBadgeClass = "tb-badge-amber";
    else if (prioNum === 1) prioBadgeClass = "tb-badge-cobalt";
    headerRow.createSpan({
      cls: `tb-badge ${prioBadgeClass} tb-card-priority-badge is-${priority.value}`,
      text: priority.label,
      attr: { title: `\u0627\u0648\u0644\u0648\u06CC\u062A: ${priority.label}` }
    });
  }
  if (hasSubtasks) {
    subtasksContainer = card.createDiv({ cls: "tb-card-subtasks-container" });
    for (const child of subtasks) {
      const childDone = Number(child.status ?? 0) !== 0;
      const childPrio = taskPriority(child.priority);
      const childPrioNum = Number(child.priority ?? 0);
      const subRow = subtasksContainer.createDiv({
        cls: `tb-card-subtask-row ${childDone ? "is-completed" : ""}`,
        attr: {
          "data-task-id": String(child.id),
          role: "button",
          tabindex: "0",
          title: "\u0645\u0634\u0627\u0647\u062F\u0647 \u0648 \u0648\u06CC\u0631\u0627\u06CC\u0634 \u062C\u0632\u0626\u06CC\u0627\u062A \u0632\u06CC\u0631\u062A\u0633\u06A9 (\u06CC\u0627 \u062F\u0631\u06AF \u0628\u0631\u0627\u06CC \u062C\u0627\u0628\u0647\u200C\u062C\u0627\u06CC\u06CC)"
        }
      });
      if (movable) {
        subRow.setAttribute("draggable", "true");
        subRow.addEventListener("dragstart", (e) => {
          subRow.addClass("is-dragging");
          e.dataTransfer?.setData(dragType, String(child.id));
          e.dataTransfer?.setData("text/ticktick-board-task", String(child.id));
          e.dataTransfer?.setData("text/ticktick-task", String(child.id));
          e.dataTransfer?.setData("text/task-parent-id", String(task.id));
          e.dataTransfer.effectAllowed = "move";
        });
        subRow.addEventListener("dragend", () => {
          subRow.removeClass("is-dragging");
        });
      }
      const subTop = subRow.createDiv({ cls: "tb-card-subtask-top" });
      const subCheck = subTop.createDiv({
        cls: `tb-checkbox tb-card-checkbox tb-card-subtask-check ${childDone ? "is-checked" : ""}`,
        attr: {
          role: "checkbox",
          "aria-checked": childDone ? "true" : "false",
          "aria-label": `\u062A\u06A9\u0645\u06CC\u0644 ${cleanTaskTitle(child.title)}`,
          tabindex: "0"
        }
      });
      const svg = subCheck.createSvg("svg", {
        attr: { viewBox: "0 0 16 16", fill: "none", stroke: "currentColor" }
      });
      svg.createSvg("path", {
        attr: {
          d: "M3.5 8.5L6.5 11.5L12.5 4.5",
          "stroke-linecap": "round",
          "stroke-linejoin": "round"
        }
      });
      subCheck.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (subCheck.hasClass("is-busy")) return;
        subCheck.addClass("is-busy");
        const nextDone = !subCheck.hasClass("is-checked");
        subCheck.toggleClass("is-checked", nextDone);
        subRow.toggleClass("is-completed", nextDone);
        try {
          if (onCompleteSubtask) {
            await onCompleteSubtask(child);
          }
        } catch {
          subCheck.toggleClass("is-checked", !nextDone);
          subRow.toggleClass("is-completed", !nextDone);
        } finally {
          subCheck.removeClass("is-busy");
        }
      });
      subCheck.addEventListener("keydown", (e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          subCheck.click();
        }
      });
      const subHeaderContent = subTop.createDiv({ cls: "tb-card-subtask-header-content" });
      subHeaderContent.createSpan({
        cls: "tb-card-subtask-title",
        text: cleanTaskTitle(child.title) || "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646"
      });
      if (childPrioNum > 0) {
        let childPrioClass = "tb-badge-slate";
        if (childPrioNum === 5) childPrioClass = "tb-badge-coral";
        else if (childPrioNum === 3) childPrioClass = "tb-badge-amber";
        else if (childPrioNum === 1) childPrioClass = "tb-badge-cobalt";
        subHeaderContent.createSpan({
          cls: `tb-badge ${childPrioClass} tb-card-priority-badge is-${childPrio.value}`,
          text: childPrio.label,
          attr: { title: `\u0627\u0648\u0644\u0648\u06CC\u062A: ${childPrio.label}` }
        });
      }
      const childDesc = taskDescription(child);
      if (childDesc) {
        subRow.createDiv({
          cls: "tb-card-subtask-desc",
          text: childDesc.slice(0, 90)
        });
      }
      const childChipsRow = subRow.createDiv({ cls: "tb-card-subtask-chips" });
      renderDueDateChip(childChipsRow, child, timeZone, childDone);
      const childTags = child.tags ?? [];
      for (const tag of childTags) {
        childChipsRow.createSpan({
          cls: "tb-badge tb-badge-slate is-tag",
          text: `#${tag}`
        });
      }
      const childChecklist = child.items;
      if (Array.isArray(childChecklist) && childChecklist.length > 0) {
        const totalItems = childChecklist.length;
        const completedItems = childChecklist.filter((i) => Number(i.status ?? 0) !== 0).length;
        const isAllDone = completedItems === totalItems;
        const chkChip = childChipsRow.createSpan({
          cls: `tb-badge tb-chip mod-checklist ${isAllDone ? "tb-badge-mint is-all-done" : "tb-badge-slate"}`,
          attr: { title: `\u0686\u06A9\u200C\u0644\u06CC\u0633\u062A: ${completedItems} \u0627\u0632 ${totalItems} \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F\u0647` }
        });
        const chkIcon = chkChip.createSpan({ cls: "tb-chip-icon" });
        (0, import_obsidian14.setIcon)(chkIcon, isAllDone ? "check-check" : "list-checks");
        chkChip.createSpan({ text: `${completedItems}/${totalItems}` });
      }
      const childEst = formatTaskEstimate(child);
      if (childEst) {
        const estChip = childChipsRow.createSpan({ cls: "tb-badge tb-badge-cyan" });
        estChip.createSpan({ text: childEst });
      }
      if (child.repeatFlag) {
        const repChip = childChipsRow.createSpan({ cls: "tb-badge tb-badge-slate" });
        const repIcon = repChip.createSpan({ cls: "tb-chip-icon" });
        (0, import_obsidian14.setIcon)(repIcon, "repeat");
        repChip.createSpan({ text: "\u062A\u06A9\u0631\u0627\u0631" });
      }
      if (!childChipsRow.children.length) {
        childChipsRow.remove();
      }
      subRow.addEventListener("click", (e) => {
        e.stopPropagation();
        if (onOpenSubtaskDetails) onOpenSubtaskDetails(child);
      });
      subRow.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (e.target.closest(".tb-card-subtask-check")) return;
          e.preventDefault();
          if (onOpenSubtaskDetails) onOpenSubtaskDetails(child);
        }
      });
    }
  }
  const description = taskDescription(task);
  if (description) {
    card.createDiv({
      cls: "tb-card-desc",
      text: description.slice(0, 110)
    });
  }
  const chipsRow = card.createDiv({ cls: "tb-card-chips" });
  renderDueDateChip(chipsRow, task, timeZone, isCompleted);
  const projDisplay = projectName || task.projectName;
  if (showProjectPill && projDisplay) {
    const projChip = chipsRow.createSpan({ cls: "tb-badge tb-badge-slate is-project" });
    if (projectColor) {
      const dot = projChip.createSpan({ cls: "tb-project-dot" });
      dot.style.backgroundColor = projectColor;
    }
    projChip.createSpan({ text: projDisplay });
  }
  if (task.parentId) {
    const subChip = chipsRow.createSpan({ cls: "tb-badge tb-badge-slate" });
    subChip.createSpan({ text: "\u21B3 \u0632\u06CC\u0631\u062A\u0633\u06A9" });
  }
  if (hasSubtasks) {
    const totalSubs = subtasks.length;
    const completedSubs = subtasks.filter((s) => Number(s.status ?? 0) !== 0).length;
    const subChip = chipsRow.createSpan({
      cls: `tb-badge tb-chip mod-checklist ${completedSubs === totalSubs ? "tb-badge-mint is-all-done" : "tb-badge-slate"}`,
      attr: { title: `\u0632\u06CC\u0631\u062A\u0633\u06A9\u200C\u0647\u0627: ${completedSubs} \u0627\u0632 ${totalSubs} \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F\u0647` }
    });
    const sIcon = subChip.createSpan({ cls: "tb-chip-icon" });
    (0, import_obsidian14.setIcon)(sIcon, completedSubs === totalSubs ? "check-check" : "list-tree");
    subChip.createSpan({ text: `${completedSubs}/${totalSubs} \u0632\u06CC\u0631\u062A\u0633\u06A9` });
  }
  const checklistItems = task.items;
  if (Array.isArray(checklistItems) && checklistItems.length > 0) {
    const totalItems = checklistItems.length;
    const completedItems = checklistItems.filter((i) => Number(i.status ?? 0) !== 0).length;
    const isAllDone = completedItems === totalItems;
    const chkChip = chipsRow.createSpan({
      cls: `tb-badge tb-chip mod-checklist ${isAllDone ? "tb-badge-mint is-all-done" : "tb-badge-slate"}`,
      attr: { title: `\u0686\u06A9\u200C\u0644\u06CC\u0633\u062A: ${completedItems} \u0627\u0632 ${totalItems} \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F\u0647` }
    });
    const chkIcon = chkChip.createSpan({ cls: "tb-chip-icon" });
    (0, import_obsidian14.setIcon)(chkIcon, isAllDone ? "check-check" : "list-checks");
    chkChip.createSpan({ text: `${completedItems}/${totalItems}` });
  }
  const estText = formatTaskEstimate(task);
  if (estText) {
    const estChip = chipsRow.createSpan({ cls: "tb-badge tb-badge-cyan" });
    estChip.createSpan({ text: estText });
  }
  if (task.repeatFlag) {
    const repChip = chipsRow.createSpan({ cls: "tb-badge tb-badge-slate" });
    const repIcon = repChip.createSpan({ cls: "tb-chip-icon" });
    (0, import_obsidian14.setIcon)(repIcon, "repeat");
    repChip.createSpan({ text: "\u062A\u06A9\u0631\u0627\u0631" });
  }
  if (Array.isArray(task.blockedBy) && task.blockedBy.length > 0) {
    const depChip = chipsRow.createSpan({ cls: "tb-badge tb-badge-coral" });
    depChip.createSpan({ text: "\u26D4 \u0648\u0627\u0628\u0633\u062A\u0647" });
  }
  const tags = task.tags ?? [];
  for (const tag of tags.slice(0, 3)) {
    chipsRow.createSpan({
      cls: "tb-badge tb-badge-slate is-tag",
      text: `#${tag}`
    });
  }
  if (isBound) {
    const mdChip = chipsRow.createSpan({ cls: "tb-badge tb-badge-slate is-bound" });
    const mdIcon = mdChip.createSpan({ cls: "tb-chip-icon" });
    (0, import_obsidian14.setIcon)(mdIcon, "file-text");
    mdChip.createSpan({ text: "Markdown" });
  }
  const hoverActions = card.createDiv({ cls: "tb-card-hover-actions" });
  if (onStartPomodoro && !isCompleted) {
    const pomoBtn = hoverActions.createEl("button", {
      cls: "tb-btn-icon tb-card-action-btn",
      attr: { type: "button", "aria-label": "\u0634\u0631\u0648\u0639 \u0641\u0648\u06A9\u0648\u0633 \u067E\u0648\u0645\u0648\u062F\u0648\u0631\u0648", title: "\u0634\u0631\u0648\u0639 \u062A\u0645\u0631\u06A9\u0632 \u067E\u0648\u0645\u0648\u062F\u0648\u0631\u0648" }
    });
    (0, import_obsidian14.setIcon)(pomoBtn, "timer");
    pomoBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onStartPomodoro(task);
    });
  }
  if (onSchedule) {
    const schedBtn = hoverActions.createEl("button", {
      cls: "tb-btn-icon tb-card-action-btn",
      attr: { type: "button", "aria-label": "\u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC \u0633\u0631\u06CC\u0639", title: "\u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC \u0633\u0631\u06CC\u0639" }
    });
    (0, import_obsidian14.setIcon)(schedBtn, "calendar-plus");
    schedBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onSchedule(task, e);
    });
  }
  if (onOpenDetails) {
    const editBtn = hoverActions.createEl("button", {
      cls: "tb-btn-icon tb-card-action-btn",
      attr: { type: "button", "aria-label": "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062C\u0632\u0626\u06CC\u0627\u062A", title: "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062C\u0632\u0626\u06CC\u0627\u062A" }
    });
    (0, import_obsidian14.setIcon)(editBtn, "pencil");
    editBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onOpenDetails(task);
    });
  }
  if (onAddSubtask && !isCompleted) {
    const addSubBtn = hoverActions.createEl("button", {
      cls: "tb-btn-icon tb-card-action-btn",
      attr: { type: "button", "aria-label": "\u0627\u0641\u0632\u0648\u062F\u0646 \u0632\u06CC\u0631\u062A\u0633\u06A9", title: "\u0627\u0641\u0632\u0648\u062F\u0646 \u0632\u06CC\u0631\u062A\u0633\u06A9 \u0628\u0647 \u0627\u06CC\u0646 \u062A\u0633\u06A9" }
    });
    (0, import_obsidian14.setIcon)(addSubBtn, "list-plus");
    addSubBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onAddSubtask(task);
    });
  }
  if (onContextMenu) {
    const moreBtn = hoverActions.createEl("button", {
      cls: "tb-btn-icon tb-card-action-btn",
      attr: { type: "button", "aria-label": "\u06AF\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u0628\u06CC\u0634\u062A\u0631", title: "\u06AF\u0632\u06CC\u0646\u0647\u200C\u0647\u0627\u06CC \u0628\u06CC\u0634\u062A\u0631" }
    });
    (0, import_obsidian14.setIcon)(moreBtn, "more-horizontal");
    moreBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      onContextMenu(task, e);
    });
  }
  card.addEventListener("click", (e) => {
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      e.preventDefault();
      e.stopPropagation();
      if (onToggleBulkSelect) {
        onToggleBulkSelect(String(task.id));
      } else {
        bulkSelectionStore.toggle(String(task.id));
      }
      card.toggleClass("is-bulk-selected", bulkSelectionStore.isSelected(String(task.id)));
      return;
    }
    if (onOpenDetails) {
      onOpenDetails(task);
    }
  });
  card.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (onOpenDetails) onOpenDetails(task);
    }
  });
  return card;
}

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
  smartViewGrouping = "project";
  sidebarCollapsed = false;
  lastSelectedProject = null;
  savedColumnsScrollLeft = 0;
  savedBodyScrollTop = 0;
  savedColumnScrolls = /* @__PURE__ */ new Map();
  savedRailScrollTop = 0;
  filterState = {
    projects: [],
    tags: [],
    statuses: [],
    priorities: [],
    dateRange: null,
    searchText: "",
    grouping: "none",
    sort: "ticktick"
  };
  currentRawData = null;
  currentProject;
  currentDisplayProject;
  columnsContainer = null;
  headerBadgeEl = null;
  filterBarInstance = null;
  bulkActionBar = null;
  cachedProjects = [];
  async render() {
    if (!this.initialized) {
      const saved = this.host.preferences();
      this.selected = saved.selected;
      this.collapsed = new Set(saved.collapsed);
      this.sidebarCollapsed = saved.sidebarPreferenceInitialized ? Boolean(saved.sidebarCollapsed) : false;
      if (saved.smartViewGrouping && ["project", "priority", "date", "tag"].includes(saved.smartViewGrouping)) {
        this.smartViewGrouping = saved.smartViewGrouping;
      }
      this.initialized = true;
      if (!saved.sidebarPreferenceInitialized) void this.host.savePreferences({ selected: this.selected, collapsed: [...this.collapsed], sidebarCollapsed: false, sidebarPreferenceInitialized: true, smartViewGrouping: this.smartViewGrouping });
    }
    const existingCols = this.element.querySelector(".ticktick-project-columns");
    if (existingCols && this.lastSelectedProject === this.selected) {
      this.savedColumnsScrollLeft = existingCols.scrollLeft;
    }
    const bodySlot = this.element.closest(".ticktick-workspace-body-slot") ?? this.element;
    if (bodySlot && this.lastSelectedProject === this.selected) {
      this.savedBodyScrollTop = bodySlot.scrollTop;
    }
    if (bodySlot && !bodySlot._ttbScrollTrackingAttached) {
      bodySlot._ttbScrollTrackingAttached = true;
      bodySlot.addEventListener("scroll", () => {
        if (this.lastSelectedProject === this.selected) {
          this.savedBodyScrollTop = bodySlot.scrollTop;
        }
      }, { passive: true });
    }
    const existingColEls = this.element.querySelectorAll(".ticktick-project-column");
    existingColEls.forEach((col) => {
      const colId = col.dataset.columnId;
      const cards = col.querySelector(".ticktick-column-cards");
      if (colId) {
        const top = cards?.scrollTop || col.scrollTop || 0;
        if (top > 0) this.savedColumnScrolls.set(colId, top);
      }
    });
    const existingRailContent = this.element.querySelector(".ticktick-rail-content");
    if (existingRailContent) {
      this.savedRailScrollTop = existingRailContent.scrollTop;
    }
    this.element.empty();
    this.element.addClass("ticktick-project-board");
    const root = this.element.createDiv({ cls: "ticktick-project-board-root" });
    root.toggleClass("is-rail-collapsed", this.sidebarCollapsed);
    try {
      const projects = await this.host.projects();
      this.cachedProjects = projects;
      if (!this.selected || this.selected === "ticktick:view:all") this.selected = String(projects[0]?.id ?? INBOX_BOARD_VIEW_ID);
      if (!this.sidebarCollapsed) {
        this.renderSidebarRail(root, projects);
      }
      const main = root.createDiv({ cls: "ticktick-project-main" });
      if (this.selected === HABIT_BOARD_VIEW_ID) {
        this.renderHabitBoard(main, projects);
        return;
      }
      const project = projects.find((item) => String(item.id) === this.selected);
      const virtualData = virtualBoardData(this.selected, this.host.tasks(), projects, {
        grouping: this.smartViewGrouping,
        timeZone: this.host.timeZone,
        savedViews: this.host.savedViews ? this.host.savedViews() : []
      });
      const displayProject = virtualData?.project ?? project;
      if (!displayProject) {
        const emptyState2 = main.createDiv({ cls: "ticktick-board-empty" });
        const emptyIcon = emptyState2.createSpan({ cls: "ticktick-empty-icon" });
        (0, import_obsidian15.setIcon)(emptyIcon, "folder-open");
        emptyState2.createEl("h3", { text: "\u06CC\u06A9 \u0644\u06CC\u0633\u062A \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u06A9\u0646\u06CC\u062F" });
        emptyState2.createEl("p", { text: "\u0628\u0631\u0627\u06CC \u0645\u0634\u0627\u0647\u062F\u0647 \u06A9\u0627\u0631\u062A\u200C\u0647\u0627\u060C \u06CC\u06A9\u06CC \u0627\u0632 \u0644\u06CC\u0633\u062A\u200C\u0647\u0627\u06CC \u0646\u0648\u0627\u0631 \u06A9\u0646\u0627\u0631\u06CC \u0631\u0627 \u0627\u0646\u062A\u062E\u0627\u0628 \u0641\u0631\u0645\u0627\u06CC\u06CC\u062F." });
        return;
      }
      const projectHeader = main.createDiv({ cls: "ticktick-project-header" });
      const headerLead = projectHeader.createDiv({ cls: "ticktick-project-header-lead" });
      const listsBtn = headerLead.createEl("button", {
        cls: `ticktick-lists-toggle-btn ${!this.sidebarCollapsed ? "is-active" : ""}`,
        attr: {
          type: "button",
          "aria-expanded": String(!this.sidebarCollapsed),
          "aria-label": !this.sidebarCollapsed ? "\u0628\u0633\u062A\u0646 \u0645\u0646\u0648\u06CC \u06A9\u0646\u0627\u0631\u06CC \u0644\u06CC\u0633\u062A\u200C\u0647\u0627" : "\u0645\u0634\u0627\u0647\u062F\u0647 \u0648 \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u0645\u0646\u0648\u06CC \u06A9\u0646\u0627\u0631\u06CC \u0644\u06CC\u0633\u062A\u200C\u0647\u0627",
          title: !this.sidebarCollapsed ? "\u0628\u0633\u062A\u0646 \u0645\u0646\u0648\u06CC \u06A9\u0646\u0627\u0631\u06CC \u0644\u06CC\u0633\u062A\u200C\u0647\u0627" : "\u0645\u0634\u0627\u0647\u062F\u0647 \u0648 \u0627\u0646\u062A\u062E\u0627\u0628 \u0644\u06CC\u0633\u062A\u200C\u0647\u0627"
        }
      });
      const lIcon = listsBtn.createSpan({ cls: "ticktick-btn-icon" });
      (0, import_obsidian15.setIcon)(lIcon, "folders");
      listsBtn.createSpan({ cls: "ticktick-lists-btn-label", text: "\u0644\u06CC\u0633\u062A\u200C\u0647\u0627" });
      listsBtn.createSpan({ cls: "ticktick-lists-toggle-badge", text: String(projects.length) });
      listsBtn.addEventListener("click", () => {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        void this.persistAndRender();
      });
      headerLead.createDiv({ cls: "ticktick-header-separator" });
      const headerInfo = headerLead.createDiv({ cls: "ticktick-project-header-info" });
      if (displayProject.color) {
        const pDot = headerInfo.createSpan({ cls: "ticktick-header-dot" });
        pDot.style.setProperty("--project-color", displayProject.color);
      }
      headerInfo.createEl("h2", { cls: "ticktick-project-title", text: displayProject.name });
      const isCompletedView = displayProject.id === COMPLETED_BOARD_VIEW_ID;
      const countLabel = isCompletedView ? `${virtualData?.tasks.length ?? 0} \u062A\u0633\u06A9 \u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647` : `${virtualData ? virtualData.tasks.filter((task) => Number(task.status ?? 0) === 0).length : project?.openCount ?? 0} \u062A\u0633\u06A9 \u0628\u0627\u0632`;
      this.headerBadgeEl = headerInfo.createSpan({
        cls: "ticktick-project-badge",
        text: countLabel
      });
      if (displayProject.virtual) {
        const groupLabels = {
          project: "\u067E\u0631\u0648\u0698\u0647",
          priority: "\u0627\u0648\u0644\u0648\u06CC\u062A",
          date: "\u062A\u0627\u0631\u06CC\u062E",
          tag: "\u0628\u0631\u0686\u0633\u0628"
        };
        const groupBtn = headerLead.createDiv({
          cls: "ticktick-filter-select-wrapper",
          attr: { role: "button", tabindex: "0", "aria-label": "\u0633\u062A\u0648\u0646\u200C\u0628\u0646\u062F\u06CC \u06A9\u0627\u0631\u062A\u200C\u0647\u0627\u06CC \u0646\u0645\u0627" }
        });
        const groupIcon = groupBtn.createSpan({ cls: "ticktick-select-icon" });
        (0, import_obsidian15.setIcon)(groupIcon, "columns-3");
        groupBtn.createSpan({
          cls: "ticktick-filter-select-label",
          text: `\u0633\u062A\u0648\u0646\u200C\u0628\u0646\u062F\u06CC: ${groupLabels[this.smartViewGrouping] ?? "\u067E\u0631\u0648\u0698\u0647"}`
        });
        const groupChevron = groupBtn.createSpan({ cls: "ticktick-select-chevron" });
        (0, import_obsidian15.setIcon)(groupChevron, "chevron-down");
        const openGroupMenu = (event) => {
          const menu = new import_obsidian15.Menu();
          for (const [value, label] of [["project", "\u0628\u0631 \u0627\u0633\u0627\u0633 \u067E\u0631\u0648\u0698\u0647"], ["priority", "\u0628\u0631 \u0627\u0633\u0627\u0633 \u0627\u0648\u0644\u0648\u06CC\u062A"], ["date", "\u0628\u0631 \u0627\u0633\u0627\u0633 \u062A\u0627\u0631\u06CC\u062E"], ["tag", "\u0628\u0631 \u0627\u0633\u0627\u0633 \u0628\u0631\u0686\u0633\u0628"]]) {
            menu.addItem((item) => {
              item.setTitle(label).setChecked(this.smartViewGrouping === value).onClick(() => {
                this.smartViewGrouping = value;
                void this.persistAndRender();
              });
            });
          }
          if (event instanceof MouseEvent) {
            menu.showAtMouseEvent(event);
          } else {
            const rect = groupBtn.getBoundingClientRect();
            menu.showAtPosition({ x: rect.right, y: rect.bottom });
          }
        };
        groupBtn.addEventListener("click", openGroupMenu);
        groupBtn.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openGroupMenu(event);
          }
        });
      }
      const filterBarHost = {
        app: this.host.app,
        scope: "board",
        projects: () => projects.map((p) => ({ id: String(p.id), name: p.name })),
        tags: () => this.availableTags(),
        savedViews: () => this.host.savedViews ? this.host.savedViews() : [],
        saveSavedViews: async (views) => {
          if (this.host.saveSavedViews) await this.host.saveSavedViews(views);
        },
        filterState: () => this.filterState,
        onFilterChange: (nextState) => {
          this.applyFilter(nextState);
        },
        sortMode: () => this.sortMode,
        onSortChange: (val) => {
          this.sortMode = val;
          if (this.columnsContainer && this.currentRawData) {
            this.renderColumnsContainer(
              this.columnsContainer,
              this.currentRawData,
              this.currentProject,
              this.currentDisplayProject
            );
          } else {
            void this.render();
          }
        }
      };
      this.filterBarInstance = new FilterBar(projectHeader, filterBarHost);
      this.filterBarInstance.render();
      const rawData = virtualData ?? await this.host.board(project);
      if (!rawData) return;
      this.currentRawData = rawData;
      this.currentProject = project;
      this.currentDisplayProject = displayProject;
      const columns = main.createDiv({ cls: "ticktick-project-columns" });
      this.columnsContainer = columns;
      this.renderColumnsContainer(columns, rawData, project, displayProject);
      this.bulkActionBar ??= new BulkActionBar(main, {
        app: this.host.app,
        timeZone: this.host.timeZone,
        tasks: () => this.host.tasks(),
        projects: () => this.host.projects(),
        executeBulkOperation: async (ids, op, params) => this.host.executeBulkOperation ? this.host.executeBulkOperation(ids, op, params) : null,
        onChanged: async () => {
          await this.host.refresh();
          await this.render();
        }
      });
      void this.bulkActionBar.render();
    } catch (error) {
      root.createEl("p", { text: error instanceof Error ? error.message : "\u062F\u0627\u062F\u0647\u0654 \u067E\u0631\u0648\u0698\u0647 \u062F\u0631 \u062F\u0633\u062A\u0631\u0633 \u0646\u06CC\u0633\u062A." });
    }
  }
  applyFilter(nextState) {
    this.filterState = nextState;
    if (this.columnsContainer && this.currentRawData) {
      this.renderColumnsContainer(
        this.columnsContainer,
        this.currentRawData,
        this.currentProject,
        this.currentDisplayProject
      );
    } else {
      void this.render();
    }
  }
  getInitialTaskForColumn(column, project, currentTag) {
    const payload = {};
    if (currentTag) {
      payload.tags = [currentTag];
    }
    if (project && !column.synthetic) {
      payload.projectId = project.id;
      payload.columnId = String(column.id);
      return payload;
    }
    if (project) {
      payload.projectId = project.id;
      return payload;
    }
    if (this.smartViewGrouping === "priority") {
      const prioMap = { "p-high": 5, "p-medium": 3, "p-low": 1, "p-none": 0 };
      if (String(column.id) in prioMap) {
        payload.priority = prioMap[String(column.id)];
      }
      if (this.cachedProjects.length > 0) {
        payload.projectId = this.cachedProjects[0].id;
      }
    } else if (this.smartViewGrouping === "date") {
      const today = todayInZone(this.host.timeZone);
      if (column.id === "d-today") payload.dueDate = today;
      else if (column.id === "d-tomorrow") payload.dueDate = shiftCalendarDay(today, 1);
      else if (column.id === "d-week") payload.dueDate = shiftCalendarDay(today, 3);
      if (this.cachedProjects.length > 0) {
        payload.projectId = this.cachedProjects[0].id;
      }
    } else if (this.smartViewGrouping === "tag") {
      const colTag = String(column.id).startsWith("t-") && column.id !== "t-none" ? decodeURIComponent(String(column.id).slice(2)) : null;
      const combinedTags = [...new Set([currentTag, colTag].filter(Boolean))];
      if (combinedTags.length > 0) payload.tags = combinedTags;
      if (this.cachedProjects.length > 0) {
        payload.projectId = this.cachedProjects[0].id;
      }
    } else {
      const matchingProj = this.cachedProjects.find((p) => String(p.id) === String(column.id));
      if (matchingProj) {
        payload.projectId = matchingProj.id;
      } else if (String(column.id).toLowerCase() === "inbox") {
        payload.projectId = "inbox";
      } else if (column.id && !String(column.id).startsWith("p-") && !String(column.id).startsWith("d-") && !String(column.id).startsWith("t-")) {
        payload.projectId = String(column.id);
      } else if (this.cachedProjects.length > 0) {
        payload.projectId = this.cachedProjects[0].id;
      }
    }
    return payload;
  }
  renderColumnsContainer(columns, rawData, project, displayProject) {
    if (this.lastSelectedProject === this.selected && columns.scrollLeft !== 0) {
      this.savedColumnsScrollLeft = columns.scrollLeft;
    }
    columns.empty();
    enhanceHorizontalScroll(columns);
    columns.addEventListener("scroll", () => {
      if (this.lastSelectedProject === this.selected) {
        this.savedColumnsScrollLeft = columns.scrollLeft;
      }
    }, { passive: true });
    const filteredTasks = rawData.tasks.filter(
      (task) => matchesTaskFilter(task, this.filterState, { timeZone: this.host.timeZone })
    );
    const data = {
      ...rawData,
      tasks: filteredTasks
    };
    if (this.headerBadgeEl) {
      const isCompletedView2 = displayProject?.id === COMPLETED_BOARD_VIEW_ID;
      const countLabel = isCompletedView2 ? `${data.tasks.length} \u062A\u0633\u06A9 \u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647` : `${data.tasks.filter((task) => Number(task.status ?? 0) === 0).length} \u062A\u0633\u06A9 \u0628\u0627\u0632`;
      const isFiltered = Boolean(
        this.filterState.searchText || this.filterState.projects && this.filterState.projects.length || this.filterState.tags && this.filterState.tags.length || this.filterState.priorities && this.filterState.priorities.length || this.filterState.statuses && this.filterState.statuses.length
      );
      this.headerBadgeEl.setText(isFiltered ? `${countLabel} (\u0641\u06CC\u0644\u062A\u0631 \u0634\u062F\u0647)` : countLabel);
    }
    const allKnownTasks = this.host.tasks();
    const taskMap = /* @__PURE__ */ new Map();
    for (const t of allKnownTasks) {
      if (t?.id) taskMap.set(String(t.id), t);
    }
    for (const t of data.tasks) {
      if (t?.id) taskMap.set(String(t.id), t);
    }
    const childrenMap = /* @__PURE__ */ new Map();
    for (const t of data.tasks) {
      if (t?.parentId) {
        const pId = String(t.parentId);
        if (!childrenMap.has(pId)) childrenMap.set(pId, []);
        childrenMap.get(pId).push(t);
      }
    }
    const isTagView = String(this.selected).startsWith(TAG_BOARD_VIEW_PREFIX);
    const currentTag = isTagView ? decodeURIComponent(String(this.selected).slice(TAG_BOARD_VIEW_PREFIX.length)) : null;
    const isCompletedView = displayProject?.id === COMPLETED_BOARD_VIEW_ID;
    for (const column of boardColumns(data, this.host.showCompleted())) {
      const shell = columns.createDiv({ cls: "ticktick-project-column" });
      shell.dataset.columnId = String(column.id);
      const colHeader = shell.createDiv({ cls: "ticktick-column-header" });
      colHeader.createEl("strong", { cls: "ticktick-column-name", text: column.name });
      colHeader.createSpan({ cls: "ticktick-column-count", text: String(column.count) });
      const movableColumn = Boolean(project) && !column.synthetic;
      const canAddToColumn = !isCompletedView && (movableColumn || isTagView || Boolean(displayProject?.virtual));
      if (canAddToColumn) {
        const addToColumn = colHeader.createEl("button", {
          cls: "ticktick-column-add mod-icon",
          attr: {
            type: "button",
            "aria-label": `\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0628\u0647 \u0633\u062A\u0648\u0646 ${column.name}`,
            title: isTagView && currentTag ? `\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0628\u0627 \u0628\u0631\u0686\u0633\u0628 #${currentTag} \u0628\u0647 ${column.name}` : `\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0628\u0647 \u0627\u06CC\u0646 \u0633\u062A\u0648\u0646`
          }
        });
        (0, import_obsidian15.setIcon)(addToColumn, "plus");
        addToColumn.addEventListener("click", async (event) => {
          event.stopPropagation();
          addToColumn.disabled = true;
          try {
            const initial = this.getInitialTaskForColumn(column, project, currentTag);
            const res = await this.host.createTask(initial);
            if (res) {
              new import_obsidian15.Notice(`\u062A\u0633\u06A9 \u062C\u062F\u06CC\u062F \u0628\u0647 \u0633\u062A\u0648\u0646 \xAB${column.name}\xBB \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.`);
              await this.render();
            }
          } catch (error) {
            new import_obsidian15.Notice(error instanceof Error ? error.message : "\u0633\u0627\u062E\u062A \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          } finally {
            addToColumn.disabled = false;
          }
        });
      }
      const listWrap = shell.createDiv({ cls: "ticktick-column-cards" });
      listWrap.addEventListener("scroll", () => {
        if (this.lastSelectedProject === this.selected && listWrap.scrollTop > 0) {
          this.savedColumnScrolls.set(String(column.id), listWrap.scrollTop);
        }
      }, { passive: true });
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
          new import_obsidian15.Notice("\u0627\u06CC\u0646 \u0633\u062A\u0648\u0646 \u0646\u0645\u0627\u06CC\u0634\u06CC \u0627\u0633\u062A \u0648 \u0645\u0642\u0635\u062F \u0627\u0646\u062A\u0642\u0627\u0644 \u0646\u06CC\u0633\u062A.");
          return;
        }
        const id = event.dataTransfer?.getData("text/ticktick-board-task");
        const allTasks = this.currentRawData?.tasks ?? data.tasks;
        const task = allTasks.find((item) => String(item.id) === id);
        if (!task) return;
        if (task.parentId) {
          void this.unparentTask(task, String(column.id));
          return;
        }
        if (String(task.columnId ?? "") === String(column.id)) return;
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
      let colTaskCount = 0;
      for (const group of column.groups) {
        if (group.name) {
          listWrap.createEl("h4", { cls: "ticktick-group-heading", text: group.name });
        }
        for (const task of sortPlanningTasks(group.tasks, this.sortMode)) {
          if (task.parentId && taskMap.has(String(task.parentId))) {
            continue;
          }
          colTaskCount++;
          const subtasks = childrenMap.get(String(task.id)) ?? [];
          this.card(listWrap, task, task.projectColor || displayProject?.color, Boolean(project), subtasks);
        }
      }
      if (colTaskCount === 0 && canAddToColumn) {
        const emptyCard = listWrap.createDiv({
          cls: "ticktick-column-empty-card",
          attr: {
            role: "button",
            tabindex: "0",
            "aria-label": `\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0628\u0647 \u0633\u062A\u0648\u0646 ${column.name}`,
            title: isTagView && currentTag ? `\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0628\u0627 \u0628\u0631\u0686\u0633\u0628 #${currentTag} \u0628\u0647 ${column.name}` : `\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0628\u0647 \u0633\u062A\u0648\u0646 ${column.name}`
          }
        });
        const plusIcon = emptyCard.createSpan({ cls: "ticktick-empty-plus" });
        (0, import_obsidian15.setIcon)(plusIcon, "plus");
        emptyCard.createSpan({
          text: isTagView && currentTag ? `+ \u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0628\u0627 #${currentTag}` : "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0628\u0647 \u0627\u06CC\u0646 \u0633\u062A\u0648\u0646"
        });
        const onEmptyAdd = async () => {
          try {
            const initial = this.getInitialTaskForColumn(column, project, currentTag);
            const res = await this.host.createTask(initial);
            if (res) await this.render();
          } catch (error) {
            new import_obsidian15.Notice(error instanceof Error ? error.message : "\u0633\u0627\u062E\u062A \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        };
        emptyCard.addEventListener("click", onEmptyAdd);
        emptyCard.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void onEmptyAdd();
          }
        });
      }
    }
    if (data.tasks.length === 0) {
      const emptyState2 = columns.createDiv({ cls: "ticktick-board-empty ticktick-smart-view-empty" });
      const emptyIcon = emptyState2.createSpan({ cls: "ticktick-empty-icon" });
      (0, import_obsidian15.setIcon)(emptyIcon, "check-circle");
      emptyState2.createEl("h3", { text: `\u0647\u06CC\u0686 \u062A\u0633\u06A9\u06CC \u062F\u0631 \u0646\u0645\u0627\u06CC \xAB${displayProject?.name ?? ""}\xBB \u0646\u06CC\u0633\u062A` });
      emptyState2.createEl("p", { text: "\u0647\u0645\u0647\u0654 \u062A\u0633\u06A9\u200C\u0647\u0627 \u0627\u0646\u062C\u0627\u0645 \u0634\u062F\u0647\u200C\u0627\u0646\u062F \u06CC\u0627 \u062A\u0633\u06A9\u06CC \u0645\u0637\u0627\u0628\u0642 \u0627\u06CC\u0646 \u0646\u0645\u0627 \u06CC\u0627 \u0641\u06CC\u0644\u062A\u0631\u0647\u0627\u06CC \u0627\u0646\u062A\u062E\u0627\u0628\u06CC \u062F\u0631 \u06A9\u0634 \u0645\u062D\u0644\u06CC \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F." });
      if (isTagView && currentTag) {
        const addBtn = emptyState2.createEl("button", {
          cls: "mod-cta ticktick-empty-add-btn",
          text: `+ \u0627\u0641\u0632\u0648\u062F\u0646 \u0627\u0648\u0644\u06CC\u0646 \u062A\u0633\u06A9 \u0628\u0627 #${currentTag}`
        });
        addBtn.addEventListener("click", async () => {
          const initial = { tags: [currentTag] };
          if (this.cachedProjects.length > 0) initial.projectId = this.cachedProjects[0].id;
          const res = await this.host.createTask(initial);
          if (res) await this.render();
        });
      }
    }
    const restoreScrolls = () => {
      if (this.lastSelectedProject === this.selected) {
        columns.scrollLeft = this.savedColumnsScrollLeft;
        if (this.savedBodyScrollTop !== 0) {
          const body = this.element.closest(".ticktick-workspace-body-slot") ?? this.element;
          if (body) body.scrollTop = this.savedBodyScrollTop;
        }
        if (this.savedColumnScrolls.size > 0) {
          for (const [colId, top] of this.savedColumnScrolls.entries()) {
            const col = columns.querySelector(`[data-column-id="${colId}"]`);
            const cards = col?.querySelector(".ticktick-column-cards");
            if (cards && top > 0) cards.scrollTop = top;
            else if (col && top > 0) col.scrollTop = top;
          }
        }
      } else {
        scrollToStart(columns);
      }
      this.lastSelectedProject = this.selected;
    };
    restoreScrolls();
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        restoreScrolls();
      });
    }
    setTimeout(() => {
      restoreScrolls();
    }, 40);
  }
  async persistAndRender() {
    await this.host.savePreferences({ selected: this.selected, collapsed: [...this.collapsed], sidebarCollapsed: this.sidebarCollapsed, sidebarPreferenceInitialized: true, smartViewGrouping: this.smartViewGrouping });
    await this.render();
  }
  renderHabitBoard(main, projects) {
    const habits = this.host.habits();
    const header = main.createDiv({ cls: "ticktick-project-header" });
    const headerLead = header.createDiv({ cls: "ticktick-project-header-lead" });
    const listsBtn = headerLead.createEl("button", {
      cls: `ticktick-lists-toggle-btn ${!this.sidebarCollapsed ? "is-active" : ""}`,
      attr: {
        type: "button",
        "aria-expanded": String(!this.sidebarCollapsed),
        "aria-label": !this.sidebarCollapsed ? "\u0628\u0633\u062A\u0646 \u0645\u0646\u0648\u06CC \u06A9\u0646\u0627\u0631\u06CC \u0644\u06CC\u0633\u062A\u200C\u0647\u0627" : "\u0645\u0634\u0627\u0647\u062F\u0647 \u0648 \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u0645\u0646\u0648\u06CC \u06A9\u0646\u0627\u0631\u06CC \u0644\u06CC\u0633\u062A\u200C\u0647\u0627",
        title: !this.sidebarCollapsed ? "\u0628\u0633\u062A\u0646 \u0645\u0646\u0648\u06CC \u06A9\u0646\u0627\u0631\u06CC \u0644\u06CC\u0633\u062A\u200C\u0647\u0627" : "\u0645\u0634\u0627\u0647\u062F\u0647 \u0648 \u0627\u0646\u062A\u062E\u0627\u0628 \u0644\u06CC\u0633\u062A\u200C\u0647\u0627"
      }
    });
    const lIcon = listsBtn.createSpan({ cls: "ticktick-btn-icon" });
    (0, import_obsidian15.setIcon)(lIcon, "folders");
    listsBtn.createSpan({ cls: "ticktick-lists-btn-label", text: "\u0644\u06CC\u0633\u062A\u200C\u0647\u0627" });
    listsBtn.createSpan({ cls: "ticktick-lists-toggle-badge", text: String(projects.length) });
    listsBtn.addEventListener("click", () => {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      void this.persistAndRender();
    });
    headerLead.createDiv({ cls: "ticktick-header-separator" });
    const info = headerLead.createDiv({ cls: "ticktick-project-header-info" });
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
  availableTags() {
    const set = /* @__PURE__ */ new Set();
    for (const t of this.host.tasks()) {
      for (const tag of Array.isArray(t.tags) ? t.tags : []) {
        const clean = String(tag ?? "").trim().replace(/^[#＃]/, "");
        if (clean) set.add(clean);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, "fa"));
  }
  renderSidebarRail(parent, projects) {
    const rail = parent.createDiv({ cls: "ticktick-project-rail" });
    const railHeader = rail.createDiv({ cls: "ticktick-rail-header" });
    const titleWrap = railHeader.createDiv({ cls: "ticktick-rail-title" });
    const headerIcon = titleWrap.createSpan({ cls: "ticktick-rail-icon" });
    (0, import_obsidian15.setIcon)(headerIcon, "folders");
    titleWrap.createSpan({ text: "\u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627 \u0648 \u0644\u06CC\u0633\u062A\u200C\u0647\u0627" });
    titleWrap.createSpan({ cls: "ticktick-rail-counter", text: `${projects.length} \u0644\u06CC\u0633\u062A` });
    const headerActions = railHeader.createDiv({ cls: "ticktick-rail-actions" });
    const collapseBtn = headerActions.createEl("button", {
      cls: "ticktick-rail-collapse-btn mod-icon",
      attr: { type: "button", "aria-label": "\u0628\u0633\u062A\u0646 \u0645\u0646\u0648\u06CC \u0644\u06CC\u0633\u062A\u200C\u0647\u0627", title: "\u0628\u0633\u062A\u0646 \u0645\u0646\u0648\u06CC \u06A9\u0646\u0627\u0631\u06CC \u0644\u06CC\u0633\u062A\u200C\u0647\u0627" }
    });
    (0, import_obsidian15.setIcon)(collapseBtn, "panel-right-close");
    collapseBtn.addEventListener("click", () => {
      this.sidebarCollapsed = true;
      void this.persistAndRender();
    });
    const railBody = rail.createDiv({ cls: "ticktick-rail-content" });
    railBody.addEventListener("scroll", () => {
      this.savedRailScrollTop = railBody.scrollTop;
    }, { passive: true });
    const virtual = virtualBoardEntries(this.host.tasks(), {
      timeZone: this.host.timeZone,
      savedViews: this.host.savedViews ? this.host.savedViews() : []
    });
    const habits = railBody.createEl("button", {
      cls: `ticktick-project-row ${this.selected === HABIT_BOARD_VIEW_ID ? "is-selected" : ""}`,
      attr: { type: "button", "aria-label": `\u0639\u0627\u062F\u062A\u200C\u0647\u0627\u060C ${this.host.habits().length} \u0639\u0627\u062F\u062A` }
    });
    const habitsIcon = habits.createSpan({ cls: "ticktick-project-row-icon" });
    (0, import_obsidian15.setIcon)(habitsIcon, "activity");
    habits.createSpan({ cls: "ticktick-project-name", text: "\u0639\u0627\u062F\u062A\u200C\u0647\u0627" });
    habits.createSpan({ cls: "ticktick-project-count", text: String(this.host.habits().length) });
    habits.addEventListener("click", () => {
      this.selected = HABIT_BOARD_VIEW_ID;
      this.savedColumnsScrollLeft = 0;
      this.savedBodyScrollTop = 0;
      this.savedColumnScrolls.clear();
      void this.persistAndRender();
    });
    const isSmartCollapsed = this.collapsed.has("smart-views") || this.collapsed.has("virtual-views");
    const smartGroupRow = railBody.createDiv({ cls: "ticktick-group-header-row" });
    const smartHeading = smartGroupRow.createEl("button", {
      cls: `ticktick-project-group ${isSmartCollapsed ? "is-collapsed" : ""}`,
      attr: { type: "button" }
    });
    const smartChevron = smartHeading.createSpan({ cls: "ticktick-group-chevron" });
    (0, import_obsidian15.setIcon)(smartChevron, isSmartCollapsed ? "chevron-left" : "chevron-down");
    smartHeading.createSpan({ cls: "ticktick-group-title", text: "\u0646\u0645\u0627\u0647\u0627\u06CC \u0647\u0648\u0634\u0645\u0646\u062F" });
    smartHeading.addEventListener("click", () => {
      if (isSmartCollapsed) {
        this.collapsed.delete("smart-views");
        this.collapsed.delete("virtual-views");
      } else {
        this.collapsed.add("smart-views");
        this.collapsed.add("virtual-views");
      }
      void this.persistAndRender();
    });
    const addSmartViewBtn = smartGroupRow.createEl("button", {
      cls: "ticktick-group-add-btn mod-icon",
      attr: { type: "button", "aria-label": "\u0627\u0641\u0632\u0648\u062F\u0646 \u0646\u0645\u0627\u06CC \u0647\u0648\u0634\u0645\u0646\u062F \u062C\u062F\u06CC\u062F", title: "\u0627\u0641\u0632\u0648\u062F\u0646 \u0646\u0645\u0627\u06CC \u0647\u0648\u0634\u0645\u0646\u062F \u062C\u062F\u06CC\u062F" }
    });
    (0, import_obsidian15.setIcon)(addSmartViewBtn, "plus");
    addSmartViewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      new CreateSmartViewModal(this.host.app, {
        projects,
        tags: this.availableTags(),
        onSave: async (newView) => {
          const currentSavedViews = this.host.savedViews ? this.host.savedViews() : [];
          if (this.host.saveSavedViews) {
            await this.host.saveSavedViews([...currentSavedViews, newView]);
          }
          this.selected = `${SAVED_BOARD_VIEW_PREFIX}${newView.id}`;
          this.collapsed.delete("smart-views");
          this.collapsed.delete("virtual-views");
          this.savedColumnsScrollLeft = 0;
          this.savedBodyScrollTop = 0;
          this.savedColumnScrolls.clear();
          await this.persistAndRender();
          new import_obsidian15.Notice(`\u0646\u0645\u0627\u06CC \u0647\u0648\u0634\u0645\u0646\u062F \xAB${newView.name}\xBB \u0627\u06CC\u062C\u0627\u062F \u0648 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.`);
        }
      }).open();
    });
    if (!isSmartCollapsed) {
      for (const view of virtual.smartViews) {
        const row = railBody.createEl("button", {
          cls: `ticktick-project-row ${this.selected === view.id ? "is-selected" : ""}`,
          attr: { type: "button", "aria-label": `${view.name}\u060C ${view.count} \u062A\u0633\u06A9` }
        });
        const rowIcon = row.createSpan({ cls: "ticktick-project-row-icon" });
        (0, import_obsidian15.setIcon)(rowIcon, view.icon);
        row.createSpan({ cls: "ticktick-project-name", text: view.name });
        row.createSpan({ cls: "ticktick-project-count", text: String(view.count) });
        row.addEventListener("click", () => {
          this.selected = view.id;
          this.savedColumnsScrollLeft = 0;
          this.savedBodyScrollTop = 0;
          this.savedColumnScrolls.clear();
          void this.persistAndRender();
        });
      }
      for (const view of virtual.savedViews ?? []) {
        const row = railBody.createEl("button", {
          cls: `ticktick-project-row ticktick-saved-view-row ${this.selected === view.id ? "is-selected" : ""}`,
          attr: { type: "button", "aria-label": `\u0646\u0645\u0627\u06CC \u0647\u0648\u0634\u0645\u0646\u062F ${view.name}\u060C ${view.count} \u062A\u0633\u06A9` }
        });
        const rowIcon = row.createSpan({ cls: "ticktick-project-row-icon" });
        (0, import_obsidian15.setIcon)(rowIcon, "bookmark");
        row.createSpan({ cls: "ticktick-project-name", text: view.name });
        row.createSpan({ cls: "ticktick-project-count", text: String(view.count) });
        row.addEventListener("click", () => {
          this.selected = view.id;
          this.savedColumnsScrollLeft = 0;
          this.savedBodyScrollTop = 0;
          this.savedColumnScrolls.clear();
          void this.persistAndRender();
        });
        row.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          const menu = new import_obsidian15.Menu();
          menu.addItem((item) => {
            item.setTitle(`\u062D\u0630\u0641 \u0646\u0645\u0627\u06CC \xAB${view.name}\xBB`).setIcon("trash-2").onClick(async () => {
              const currentSavedViews = this.host.savedViews ? this.host.savedViews() : [];
              const next = currentSavedViews.filter((v) => v.id !== view.viewId);
              if (this.host.saveSavedViews) await this.host.saveSavedViews(next);
              if (this.selected === view.id) {
                this.selected = String(projects[0]?.id ?? INBOX_BOARD_VIEW_ID);
              }
              await this.persistAndRender();
              new import_obsidian15.Notice(`\u0646\u0645\u0627\u06CC \xAB${view.name}\xBB \u062D\u0630\u0641 \u0634\u062F.`);
            });
          });
          menu.showAtMouseEvent(e);
        });
      }
    }
    const tagGroupRow = railBody.createDiv({ cls: "ticktick-group-header-row" });
    const tagHeading = tagGroupRow.createEl("button", {
      cls: `ticktick-project-group ${this.collapsed.has("virtual-tags") ? "is-collapsed" : ""}`,
      attr: { type: "button" }
    });
    const tagChevron = tagHeading.createSpan({ cls: "ticktick-group-chevron" });
    (0, import_obsidian15.setIcon)(tagChevron, this.collapsed.has("virtual-tags") ? "chevron-left" : "chevron-down");
    tagHeading.createSpan({ cls: "ticktick-group-title", text: "\u0628\u0631\u0686\u0633\u0628\u200C\u0647\u0627" });
    tagHeading.addEventListener("click", () => {
      this.collapsed.has("virtual-tags") ? this.collapsed.delete("virtual-tags") : this.collapsed.add("virtual-tags");
      void this.persistAndRender();
    });
    const addTagBtn = tagGroupRow.createEl("button", {
      cls: "ticktick-group-add-btn mod-icon",
      attr: { type: "button", "aria-label": "\u0627\u0641\u0632\u0648\u062F\u0646 \u0628\u0631\u0686\u0633\u0628 \u062C\u062F\u06CC\u062F", title: "\u0627\u0641\u0632\u0648\u062F\u0646 \u0628\u0631\u0686\u0633\u0628 \u062C\u062F\u06CC\u062F" }
    });
    (0, import_obsidian15.setIcon)(addTagBtn, "plus");
    addTagBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      new CreateTagModal(this.host.app, {
        projects,
        onCreate: async ({ tag, taskTitle, projectId }) => {
          addTagBtn.disabled = true;
          try {
            const finalProjectId = projectId || String(projects[0]?.id ?? "");
            await this.host.createTask({
              title: taskTitle || `\u062A\u0633\u06A9 #${tag}`,
              tags: [tag],
              projectId: finalProjectId
            });
            await this.host.refresh();
            this.selected = `${TAG_BOARD_VIEW_PREFIX}${encodeURIComponent(tag)}`;
            this.collapsed.delete("virtual-tags");
            this.savedColumnsScrollLeft = 0;
            this.savedBodyScrollTop = 0;
            this.savedColumnScrolls.clear();
            await this.persistAndRender();
            new import_obsidian15.Notice(`\u0628\u0631\u0686\u0633\u0628 #${tag} \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062F\u0631 TickTick \u062B\u0628\u062A \u0634\u062F.`);
          } finally {
            addTagBtn.disabled = false;
          }
        }
      }).open();
    });
    if (!this.collapsed.has("virtual-tags")) {
      for (const tag of virtual.tags) {
        const row = railBody.createEl("button", {
          cls: `ticktick-project-row ticktick-tag-view-row ${this.selected === tag.id ? "is-selected" : ""}`,
          attr: { type: "button", "aria-label": `\u0628\u0631\u0686\u0633\u0628 ${tag.name}\u060C ${tag.count} \u062A\u0633\u06A9 \u0628\u0627\u0632` }
        });
        const tagIcon = row.createSpan({ cls: "ticktick-project-row-icon" });
        (0, import_obsidian15.setIcon)(tagIcon, "tag");
        row.createSpan({ cls: "ticktick-project-name", text: `#${tag.name}` });
        row.createSpan({ cls: "ticktick-project-count", text: String(tag.count) });
        row.addEventListener("click", () => {
          this.selected = tag.id;
          this.savedColumnsScrollLeft = 0;
          this.savedBodyScrollTop = 0;
          this.savedColumnScrolls.clear();
          void this.persistAndRender();
        });
      }
    }
    for (const group of sidebarTree(projects, this.host.tasks())) {
      const key = group.name || "flat";
      const groupRow = railBody.createDiv({ cls: "ticktick-group-header-row" });
      const groupHeading = groupRow.createEl("button", {
        cls: `ticktick-project-group ${this.collapsed.has(key) ? "is-collapsed" : ""}`,
        attr: { type: "button" }
      });
      const groupChevron = groupHeading.createSpan({ cls: "ticktick-group-chevron" });
      (0, import_obsidian15.setIcon)(groupChevron, this.collapsed.has(key) ? "chevron-left" : "chevron-down");
      groupHeading.createSpan({ cls: "ticktick-group-title", text: group.name || "\u0644\u06CC\u0633\u062A\u200C\u0647\u0627" });
      groupHeading.addEventListener("click", () => {
        this.collapsed.has(key) ? this.collapsed.delete(key) : this.collapsed.add(key);
        void this.persistAndRender();
      });
      const addProjectBtn = groupRow.createEl("button", {
        cls: "ticktick-group-add-btn mod-icon",
        attr: { type: "button", "aria-label": `\u0627\u0641\u0632\u0648\u062F\u0646 \u0644\u06CC\u0633\u062A \u062C\u062F\u06CC\u062F \u0628\u0647 ${group.name || "\u0644\u06CC\u0633\u062A\u200C\u0647\u0627"}`, title: "\u0627\u0641\u0632\u0648\u062F\u0646 \u0644\u06CC\u0633\u062A \u062C\u062F\u06CC\u062F" }
      });
      (0, import_obsidian15.setIcon)(addProjectBtn, "plus");
      addProjectBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const draft = await new ProjectEditorModal(this.host.app).openAndWait();
        if (!draft) return;
        addProjectBtn.disabled = true;
        try {
          const project = await this.host.createProject(draft);
          this.selected = String(project?.id ?? "");
          this.collapsed.delete(key);
          this.savedColumnsScrollLeft = 0;
          this.savedBodyScrollTop = 0;
          this.savedColumnScrolls.clear();
          await this.host.refresh();
          await this.persistAndRender();
          new import_obsidian15.Notice("\u0644\u06CC\u0633\u062A \u062F\u0631 TickTick \u0633\u0627\u062E\u062A\u0647 \u0634\u062F.");
        } catch (error) {
          new import_obsidian15.Notice(error instanceof Error ? error.message : "\u0633\u0627\u062E\u062A \u0644\u06CC\u0633\u062A \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
        } finally {
          addProjectBtn.disabled = false;
        }
      });
      if (this.collapsed.has(key)) continue;
      for (const project of group.projects) {
        const row = railBody.createDiv({
          cls: `ticktick-project-row ${this.selected === String(project.id) ? "is-selected" : ""}`,
          attr: { role: "button", tabindex: "0", "aria-label": `${project.name}\u060C ${project.openCount} \u062A\u0633\u06A9 \u0628\u0627\u0632` }
        });
        const lead = row.createDiv({ cls: "ticktick-project-row-lead" });
        const dot = lead.createSpan({ cls: "ticktick-project-dot" });
        dot.style.setProperty("--project-color", project.color ?? "var(--interactive-accent)");
        lead.createSpan({ cls: "ticktick-project-name", text: project.name });
        const trailing = row.createDiv({ cls: "ticktick-project-row-trailing" });
        trailing.createSpan({ cls: "ticktick-project-count", text: String(project.openCount) });
        const menuBtn = trailing.createEl("button", {
          cls: "ticktick-project-row-menu-btn mod-icon",
          attr: { type: "button", "aria-label": `\u0639\u0645\u0644\u06CC\u0627\u062A \u0644\u06CC\u0633\u062A ${project.name}`, title: "\u0639\u0645\u0644\u06CC\u0627\u062A \u0644\u06CC\u0633\u062A" }
        });
        (0, import_obsidian15.setIcon)(menuBtn, "more-horizontal");
        const handleEditProject = async () => {
          const draft = await new ProjectEditorModal(this.host.app, project).openAndWait();
          if (!draft) return;
          try {
            await this.host.updateProject({ ...project, ...draft });
            await this.host.refresh();
            await this.render();
            new import_obsidian15.Notice("\u0644\u06CC\u0633\u062A \u062F\u0631 TickTick \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u062F.");
          } catch (error) {
            new import_obsidian15.Notice(error instanceof Error ? error.message : "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0644\u06CC\u0633\u062A \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        };
        const handleDeleteProject = async () => {
          const isInbox = project.isInbox || project.name === "Inbox" || project.name === "\u0648\u0631\u0648\u062F\u06CC";
          if (isInbox) {
            new import_obsidian15.Notice("\u0644\u06CC\u0633\u062A \u0648\u0631\u0648\u062F\u06CC (Inbox) \u0642\u0627\u0628\u0644 \u062D\u0630\u0641 \u0646\u06CC\u0633\u062A.");
            return;
          }
          if (!window.confirm(`\u0644\u06CC\u0633\u062A \xAB${project.name}\xBB \u0648 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0622\u0646 \u062F\u0631 TickTick \u062D\u0630\u0641 \u0634\u0648\u062F\u061F`)) return;
          try {
            await this.host.deleteProject(String(project.id));
            if (this.selected === String(project.id)) {
              this.selected = String(projects[0]?.id ?? INBOX_BOARD_VIEW_ID);
            }
            this.savedColumnsScrollLeft = 0;
            this.savedBodyScrollTop = 0;
            this.savedColumnScrolls.clear();
            await this.host.refresh();
            await this.persistAndRender();
            new import_obsidian15.Notice("\u0644\u06CC\u0633\u062A \u0627\u0632 TickTick \u062D\u0630\u0641 \u0634\u062F.");
          } catch (error) {
            new import_obsidian15.Notice(error instanceof Error ? error.message : "\u062D\u0630\u0641 \u0644\u06CC\u0633\u062A \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        };
        const openMenu = (event) => {
          event.stopPropagation();
          event.preventDefault();
          const menu = new import_obsidian15.Menu();
          menu.addItem((item) => {
            item.setTitle("\u0648\u06CC\u0631\u0627\u06CC\u0634 \u0644\u06CC\u0633\u062A").setIcon("pencil").onClick(() => void handleEditProject());
          });
          const isInbox = project.isInbox || project.name === "Inbox" || project.name === "\u0648\u0631\u0648\u062F\u06CC";
          if (!isInbox) {
            menu.addItem((item) => {
              item.setTitle("\u062D\u0630\u0641 \u0644\u06CC\u0633\u062A").setIcon("trash-2").onClick(() => void handleDeleteProject());
            });
          }
          menu.showAtMouseEvent(event);
        };
        menuBtn.addEventListener("click", openMenu);
        row.addEventListener("contextmenu", openMenu);
        row.addEventListener("click", () => {
          this.selected = String(project.id);
          this.savedColumnsScrollLeft = 0;
          this.savedBodyScrollTop = 0;
          this.savedColumnScrolls.clear();
          void this.persistAndRender();
        });
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.selected = String(project.id);
            void this.persistAndRender();
          }
        });
      }
    }
    if (this.savedRailScrollTop > 0) {
      railBody.scrollTop = this.savedRailScrollTop;
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => {
          railBody.scrollTop = this.savedRailScrollTop;
        });
      }
      setTimeout(() => {
        railBody.scrollTop = this.savedRailScrollTop;
      }, 40);
    }
  }
  card(parent, task, projectColor, movable = true, subtasks = []) {
    const bound = this.host.binding(task);
    const hideCompleted = !this.host.showCompleted();
    const card = renderTaskCard(parent, {
      task,
      timeZone: this.host.timeZone,
      projectColor,
      movable,
      dragType: "text/ticktick-board-task",
      isBound: Boolean(bound),
      variant: "board",
      subtasks,
      onCompleteSubtask: async (child) => {
        try {
          await this.host.complete(child);
          child.status = 2;
          new import_obsidian15.Notice("\u0632\u06CC\u0631\u062A\u0633\u06A9 \u062F\u0631 TickTick \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F.");
          if (hideCompleted) {
            await this.render();
          }
        } catch (error) {
          new import_obsidian15.Notice(error instanceof Error ? error.message : "\u062E\u0637\u0627 \u062F\u0631 \u062A\u06A9\u0645\u06CC\u0644 \u0632\u06CC\u0631\u062A\u0633\u06A9.");
        }
      },
      onOpenSubtaskDetails: (child) => {
        new TaskDetailsModal(this.host.app, child, {
          complete: async () => {
            await this.host.complete(child);
            await this.render();
          },
          load: (item) => this.host.load(item),
          edit: (item) => this.host.edit(item),
          changed: async () => {
            await this.host.refresh();
            await this.render();
          },
          allTasks: () => this.host.tasks()
        }).open();
      },
      onComplete: async (t) => {
        card.addClass("is-completed");
        if (hideCompleted) {
          card.addClass("is-leaving");
        }
        try {
          await this.host.complete(t);
          t.status = 2;
          new import_obsidian15.Notice(bound ? "\u062A\u0633\u06A9 \u062F\u0631 \u0641\u0627\u06CC\u0644 \u0645\u0627\u0631\u06A9\u200C\u062F\u0627\u0648\u0646 \u0648 TickTick \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F." : "\u062A\u0633\u06A9 \u062F\u0631 TickTick \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F.");
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
          new import_obsidian15.Notice(error instanceof Error ? error.message : "\u062E\u0637\u0627 \u062F\u0631 \u062A\u06A9\u0645\u06CC\u0644 \u062A\u0633\u06A9.");
        }
      },
      onOpenDetails: (t) => {
        new TaskDetailsModal(this.host.app, t, {
          complete: async () => {
            await this.host.complete(t);
            await this.render();
          },
          load: (item) => this.host.load(item),
          edit: (item) => this.host.edit(item),
          changed: async () => {
            await this.host.refresh();
            await this.render();
          },
          allTasks: () => this.host.tasks()
        }).open();
      },
      onAddSubtask: async (parentTask) => {
        try {
          await this.host.createTask({
            projectId: parentTask.projectId,
            parentId: String(parentTask.id),
            columnId: parentTask.columnId
          });
          await this.render();
        } catch (error) {
          new import_obsidian15.Notice(error instanceof Error ? error.message : "\u0627\u06CC\u062C\u0627\u062F \u0632\u06CC\u0631\u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
        }
      },
      onToggleBulkSelect: (id) => {
        const sel = bulkSelectionStore.toggle(id);
        card.toggleClass("is-bulk-selected", sel);
      }
    });
    if (movable) {
      card.addEventListener("dragover", (e) => {
        const types = e.dataTransfer?.types ?? [];
        if (!types.includes("text/ticktick-board-task")) return;
        e.preventDefault();
        e.stopPropagation();
        card.addClass("is-subtask-drop-target");
      });
      card.addEventListener("dragleave", (e) => {
        if (!card.contains(e.relatedTarget)) {
          card.removeClass("is-subtask-drop-target");
        }
      });
      card.addEventListener("drop", async (e) => {
        const draggedId = e.dataTransfer?.getData("text/ticktick-board-task");
        if (!draggedId || draggedId === String(task.id)) return;
        e.preventDefault();
        e.stopPropagation();
        card.removeClass("is-subtask-drop-target");
        const allTasks = this.currentRawData?.tasks ?? this.host.tasks();
        const draggedTask = allTasks.find((t) => String(t.id) === draggedId);
        if (!draggedTask) return;
        await this.reparentTask(draggedTask, task);
      });
    }
    return card;
  }
  isDescendant(potentialParentId, potentialChildId) {
    const allTasks = this.currentRawData?.tasks ?? this.host.tasks();
    const children = allTasks.filter((t) => String(t.parentId) === potentialParentId);
    for (const c of children) {
      if (String(c.id) === potentialChildId) return true;
      if (this.isDescendant(String(c.id), potentialChildId)) return true;
    }
    return false;
  }
  async reparentTask(child, parentTask) {
    if (String(child.id) === String(parentTask.id)) return;
    if (this.isDescendant(String(child.id), String(parentTask.id))) {
      new import_obsidian15.Notice("\u0646\u0645\u06CC\u200C\u062A\u0648\u0627\u0646 \u06CC\u06A9 \u062A\u0633\u06A9 \u0631\u0627 \u0632\u06CC\u0631\u062A\u0633\u06A9\u0650 \u0641\u0631\u0632\u0646\u062F \u062E\u0648\u062F \u0642\u0631\u0627\u0631 \u062F\u0627\u062F.");
      return;
    }
    try {
      if (this.host.updateTask) {
        await this.host.updateTask({
          id: child.id,
          parentId: String(parentTask.id),
          projectId: parentTask.projectId,
          columnId: parentTask.columnId
        });
      }
      child.parentId = String(parentTask.id);
      child.projectId = parentTask.projectId;
      child.columnId = parentTask.columnId;
      new import_obsidian15.Notice(`\u062A\u0633\u06A9 \xAB${cleanTaskTitle(child.title)}\xBB \u0628\u0647 \u0639\u0646\u0648\u0627\u0646 \u0632\u06CC\u0631\u062A\u0633\u06A9 \xAB${cleanTaskTitle(parentTask.title)}\xBB \u062A\u0646\u0638\u06CC\u0645 \u0634\u062F.`);
      await this.render();
    } catch (error) {
      new import_obsidian15.Notice(error instanceof Error ? error.message : "\u062A\u0646\u0638\u06CC\u0645 \u0632\u06CC\u0631\u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    }
  }
  async unparentTask(task, targetColumnId) {
    try {
      if (this.host.updateTask) {
        await this.host.updateTask({
          id: task.id,
          parentId: null,
          columnId: targetColumnId
        });
      }
      task.parentId = null;
      task.columnId = targetColumnId;
      new import_obsidian15.Notice(`\u062A\u0633\u06A9 \xAB${cleanTaskTitle(task.title)}\xBB \u0627\u0632 \u062D\u0627\u0644\u062A \u0632\u06CC\u0631\u062A\u0633\u06A9 \u062E\u0627\u0631\u062C \u0634\u062F \u0648 \u0628\u0647 \u062A\u0633\u06A9 \u0645\u0633\u062A\u0642\u0644 \u062A\u0628\u062F\u06CC\u0644 \u06AF\u0631\u062F\u06CC\u062F.`);
      await this.render();
    } catch (error) {
      new import_obsidian15.Notice(error instanceof Error ? error.message : "\u062E\u0627\u0631\u062C \u06A9\u0631\u062F\u0646 \u062A\u0633\u06A9 \u0627\u0632 \u062D\u0627\u0644\u062A \u0632\u06CC\u0631\u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    }
  }
  async moveTask(task, columnId, optimisticCard, sourceCol, oldColumnId) {
    try {
      await this.host.moveToColumn(task, columnId);
      new import_obsidian15.Notice("\u062A\u0633\u06A9 \u0628\u0647 \u0633\u062A\u0648\u0646 \u062C\u062F\u06CC\u062F \u0645\u0646\u062A\u0642\u0644 \u0648 \u0628\u0627 TickTick \u0647\u0645\u06AF\u0627\u0645 \u0634\u062F.");
    } catch (error) {
      if (optimisticCard && sourceCol) {
        const srcList = sourceCol.querySelector(".ticktick-column-cards");
        srcList?.appendChild(optimisticCard);
        task.columnId = oldColumnId;
      }
      new import_obsidian15.Notice(error instanceof Error ? error.message : "\u0627\u0646\u062A\u0642\u0627\u0644 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    }
  }
};

// src/obsidian/project-timeline.ts
var import_obsidian16 = require("obsidian");

// src/core/timeline.js
init_date();
init_calendar_range();
init_task_filter();
var DEFAULT_TIMELINE_PALETTE = [
  "#7c6cff",
  "#4aa3df",
  "#2a9d8f",
  "#e76f51",
  "#d36ba6",
  "#d49a2a",
  "#5a9b68",
  "#f59e0b"
];
function daysBetween(fromDay, toDay) {
  if (!fromDay || !toDay) return 0;
  return Math.round((Date.parse(`${toDay}T12:00:00Z`) - Date.parse(`${fromDay}T12:00:00Z`)) / 864e5);
}
function taskTimelineRange(task, timeZone = "Asia/Tehran") {
  if (!task) return null;
  const zone = task.timeZone || timeZone;
  const calendarRange = taskDateRange(task, zone);
  if (calendarRange) {
    return {
      start: calendarRange.start,
      end: calendarRange.end,
      isRange: true
    };
  }
  const start = toDateKey(task.startDate, zone);
  const due = toDateKey(task.dueDate, zone);
  if (start && due) {
    if (start <= due) {
      return { start, end: due, isRange: start !== due };
    }
    return { start: due, end: start, isRange: true };
  }
  const single = start || due;
  if (single) {
    return { start: single, end: single, isRange: false };
  }
  return null;
}
function computeTimelineBounds(tasks = [], options = {}) {
  const timeZone = options.timeZone || "Asia/Tehran";
  const marginDays = Number(options.marginDays ?? 5);
  const today = todayInZone(timeZone);
  let minDay = null;
  let maxDay = null;
  for (const task of tasks) {
    const range = taskTimelineRange(task, timeZone);
    if (!range) continue;
    if (!minDay || range.start < minDay) minDay = range.start;
    if (!maxDay || range.end > maxDay) maxDay = range.end;
  }
  if (!minDay || !maxDay) {
    minDay = shiftCalendarDay(today, -7);
    maxDay = shiftCalendarDay(today, 21);
  } else {
    minDay = shiftCalendarDay(minDay, -marginDays);
    maxDay = shiftCalendarDay(maxDay, marginDays);
  }
  return {
    startDate: minDay,
    endDate: maxDay,
    totalDays: Math.max(1, daysBetween(minDay, maxDay) + 1)
  };
}
function generateTimelineGrid(startDay, endDay, zoom = "day", firstWeekday = 6) {
  const totalDays = Math.max(1, daysBetween(startDay, endDay) + 1);
  const allDays = Array.from({ length: totalDays }, (_, i) => shiftCalendarDay(startDay, i));
  if (zoom === "day") {
    return {
      zoom: "day",
      columns: allDays.map((day, idx) => ({
        key: day,
        colStart: idx + 1,
        colSpan: 1,
        date: day,
        dayNumber: Number(day.slice(8, 10)),
        isToday: false,
        label: day
      })),
      days: allDays
    };
  }
  if (zoom === "week") {
    const weeks = [];
    let currentWeek = [];
    let weekColStart = 1;
    for (const day of allDays) {
      currentWeek.push(day);
      const dayOfWeek = (/* @__PURE__ */ new Date(`${day}T12:00:00Z`)).getUTCDay();
      const isEndOfWeek = (dayOfWeek + 1) % 7 === firstWeekday;
      if (isEndOfWeek) {
        weeks.push({
          key: currentWeek[0],
          colStart: weekColStart,
          colSpan: currentWeek.length,
          start: currentWeek[0],
          end: currentWeek.at(-1),
          days: [...currentWeek],
          label: `${currentWeek[0].slice(5)} - ${currentWeek.at(-1).slice(5)}`
        });
        weekColStart += currentWeek.length;
        currentWeek = [];
      }
    }
    if (currentWeek.length > 0) {
      weeks.push({
        key: currentWeek[0],
        colStart: weekColStart,
        colSpan: currentWeek.length,
        start: currentWeek[0],
        end: currentWeek.at(-1),
        days: [...currentWeek],
        label: `${currentWeek[0].slice(5)} - ${currentWeek.at(-1).slice(5)}`
      });
    }
    return {
      zoom: "week",
      columns: weeks,
      days: allDays
    };
  }
  const months = [];
  let currentMonthKey = null;
  let currentMonthDays = [];
  let monthColStart = 1;
  for (const day of allDays) {
    const monthKey = day.slice(0, 7);
    if (monthKey !== currentMonthKey) {
      if (currentMonthDays.length > 0) {
        months.push({
          key: currentMonthKey,
          colStart: monthColStart,
          colSpan: currentMonthDays.length,
          start: currentMonthDays[0],
          end: currentMonthDays.at(-1),
          days: [...currentMonthDays],
          label: currentMonthKey
        });
        monthColStart += currentMonthDays.length;
      }
      currentMonthKey = monthKey;
      currentMonthDays = [day];
    } else {
      currentMonthDays.push(day);
    }
  }
  if (currentMonthDays.length > 0) {
    months.push({
      key: currentMonthKey,
      colStart: monthColStart,
      colSpan: currentMonthDays.length,
      start: currentMonthDays[0],
      end: currentMonthDays.at(-1),
      days: [...currentMonthDays],
      label: currentMonthKey
    });
  }
  return {
    zoom: "month",
    columns: months,
    days: allDays
  };
}
function packTimelineLanes(items) {
  const sorted = [...items].sort((a, b) => {
    if (a.range.start !== b.range.start) {
      return a.range.start.localeCompare(b.range.start);
    }
    return a.range.end.localeCompare(b.range.end);
  });
  const laneEnds = [];
  const laneAssignments = [];
  for (const entry of sorted) {
    let assignedLane = -1;
    for (let i = 0; i < laneEnds.length; i++) {
      if (laneEnds[i] < entry.range.start) {
        assignedLane = i;
        laneEnds[i] = entry.range.end;
        break;
      }
    }
    if (assignedLane === -1) {
      assignedLane = laneEnds.length;
      laneEnds.push(entry.range.end);
    }
    laneAssignments.push({
      ...entry,
      laneIndex: assignedLane
    });
  }
  return {
    assignments: laneAssignments,
    totalLanes: Math.max(1, laneEnds.length)
  };
}
function computeBarGridPlacement(range, gridStartDay, totalGridDays) {
  const startOffset = daysBetween(gridStartDay, range.start);
  const endOffset = daysBetween(gridStartDay, range.end);
  const colStart = Math.max(1, startOffset + 1);
  const colEnd = Math.min(totalGridDays + 1, endOffset + 2);
  const colSpan = Math.max(1, colEnd - colStart);
  return {
    colStart,
    colEnd,
    colSpan,
    gridColumn: `${colStart} / span ${colSpan}`
  };
}
function getTimelineTaskTone(task, colorMode = "project", palette = DEFAULT_TIMELINE_PALETTE) {
  if (colorMode === "uniform") {
    return "var(--interactive-accent)";
  }
  if (colorMode === "priority") {
    const p = Number(task?.priority ?? 0);
    if (p === 5) return "var(--color-red)";
    if (p === 3) return "var(--color-orange)";
    if (p === 1) return "var(--color-blue)";
    return "var(--text-muted)";
  }
  if (colorMode === "tag") {
    const tag = String(task?.tags?.[0] ?? "");
    if (!tag) return "var(--interactive-accent)";
    const hash2 = [...tag].reduce((val, ch) => val * 31 + ch.charCodeAt(0) >>> 0, 0);
    return palette[hash2 % palette.length];
  }
  const projColor = String(task?.projectColor ?? "").trim();
  if (/^#[0-9a-f]{3,8}$/i.test(projColor)) {
    return projColor;
  }
  const seed = String(task?.projectName ?? task?.projectId ?? "inbox");
  const hash = [...seed].reduce((val, ch) => val * 31 + ch.charCodeAt(0) >>> 0, 0);
  return palette[hash % palette.length];
}
function shiftTimelineEndpoints(task, deltaDays, edge = "both", timeZone = "Asia/Tehran") {
  if (!task) return null;
  if (!deltaDays) return { ...task };
  const zone = task.timeZone || timeZone;
  const currentStart = toDateKey(task.startDate, zone);
  const currentDue = toDateKey(task.dueDate, zone);
  const anchor = currentStart || currentDue;
  if (!anchor) return { ...task };
  let nextStartDay = currentStart;
  let nextDueDay = currentDue;
  if (edge === "both") {
    if (currentStart) nextStartDay = shiftCalendarDay(currentStart, deltaDays);
    if (currentDue) nextDueDay = shiftCalendarDay(currentDue, deltaDays);
  } else if (edge === "start") {
    if (currentStart) {
      const candidate = shiftCalendarDay(currentStart, deltaDays);
      nextStartDay = currentDue && candidate > currentDue ? currentDue : candidate;
    } else if (currentDue) {
      const candidate = shiftCalendarDay(currentDue, deltaDays);
      nextStartDay = candidate > currentDue ? currentDue : candidate;
    }
  } else if (edge === "due") {
    if (currentDue) {
      const candidate = shiftCalendarDay(currentDue, deltaDays);
      nextDueDay = currentStart && candidate < currentStart ? currentStart : candidate;
    } else if (currentStart) {
      const candidate = shiftCalendarDay(currentStart, deltaDays);
      nextDueDay = candidate < currentStart ? currentStart : candidate;
    }
  }
  const isTimed = !task.isAllDay && String(task.startDate ?? task.dueDate ?? "").includes("T");
  const startTimePart = String(task.startDate ?? "").match(/T(\d{2}:\d{2}:\d{2})/)?.[1] ?? "00:00:00";
  const dueTimePart = String(task.dueDate ?? "").match(/T(\d{2}:\d{2}:\d{2})/)?.[1] ?? "00:00:00";
  const tzOffset = "+0330";
  const nextStartDate = nextStartDay ? isTimed ? `${nextStartDay}T${startTimePart}${tzOffset}` : `${nextStartDay}T00:00:00${tzOffset}` : null;
  const nextDueDate = nextDueDay ? isTimed ? `${nextDueDay}T${dueTimePart}${tzOffset}` : `${nextDueDay}T00:00:00${tzOffset}` : null;
  return {
    ...task,
    startDate: nextStartDate,
    dueDate: nextDueDate,
    isAllDay: !isTimed,
    timeZone: zone
  };
}
function partitionTimelineTasks(tasks = [], filterState = {}, options = {}) {
  const timeZone = options.timeZone || "Asia/Tehran";
  const showCompleted = Boolean(options.showCompleted);
  const rangeTasks = [];
  const pointTasks = [];
  const backlogTasks = [];
  for (const task of tasks) {
    if (Number(task?.status ?? 0) !== 0 && !showCompleted) continue;
    if (filterState && !matchesTaskFilter(task, filterState)) continue;
    const range = taskTimelineRange(task, timeZone);
    if (!range) {
      backlogTasks.push(task);
    } else if (range.isRange) {
      rangeTasks.push({ task, range });
    } else {
      pointTasks.push({ task, range });
    }
  }
  return {
    rangeTasks,
    pointTasks,
    backlogTasks
  };
}

// src/obsidian/project-timeline.ts
init_date();
init_calendar_range();
var ProjectTimeline = class {
  constructor(element, host) {
    this.element = element;
    this.host = host;
  }
  zoom = "day";
  colorMode = "project";
  showBacklog = false;
  filterState = {
    projects: [],
    tags: [],
    statuses: [],
    priorities: [],
    dateRange: null,
    searchText: "",
    grouping: "none",
    sort: "ticktick"
  };
  windowStart = null;
  windowEnd = null;
  filterBarInstance = null;
  isSyncing = false;
  // Active drag state
  activeDrag = null;
  wasDraggedRecently = false;
  bulkActionBar = null;
  async render() {
    this.element.empty();
    this.element.addClass("ticktick-timeline-workspace");
    const allTasks = this.host.tasks();
    const rawProjects = await this.host.projects();
    const projects = Array.isArray(rawProjects) ? rawProjects : [];
    const projectMap = new Map(projects.map((p) => [String(p.id), p]));
    const enrichedTasks = allTasks.map((t) => {
      const proj = projectMap.get(String(t.projectId));
      return {
        ...t,
        projectName: proj?.name ?? t.projectName,
        projectColor: proj?.color ?? t.projectColor
      };
    });
    const partitioned = partitionTimelineTasks(enrichedTasks, this.filterState, {
      timeZone: this.host.timeZone,
      showCompleted: this.host.showCompleted()
    });
    if (!this.windowStart || !this.windowEnd) {
      const bounds = computeTimelineBounds(enrichedTasks, {
        timeZone: this.host.timeZone,
        marginDays: this.zoom === "month" ? 30 : this.zoom === "week" ? 14 : 7
      });
      this.windowStart = bounds.startDate;
      this.windowEnd = bounds.endDate;
    }
    this.renderToolbar(partitioned.backlogTasks.length + partitioned.pointTasks.length);
    this.renderFilterBar(projects, enrichedTasks);
    const canvas = this.element.createDiv({ cls: "ticktick-timeline-canvas" });
    this.renderTimelineGrid(canvas, partitioned.rangeTasks, partitioned.pointTasks, projectMap);
    if (this.showBacklog) {
      this.renderBacklogDrawer(partitioned.pointTasks, partitioned.backlogTasks);
    }
    this.bulkActionBar ??= new BulkActionBar(this.element, {
      app: this.host.app,
      timeZone: this.host.timeZone,
      tasks: () => this.host.tasks(),
      projects: () => this.host.projects(),
      executeBulkOperation: async (ids, op, params) => this.host.executeBulkOperation ? this.host.executeBulkOperation(ids, op, params) : null,
      onChanged: async () => {
        await this.host.refresh();
        await this.render();
      }
    });
    void this.bulkActionBar.render();
  }
  renderToolbar(backlogCount) {
    const toolbar = this.element.createDiv({ cls: "ticktick-timeline-toolbar" });
    const navGroup = toolbar.createDiv({ cls: "ticktick-timeline-tool-group" });
    const zoomSelector = navGroup.createDiv({ cls: "ticktick-timeline-zoom-group" });
    for (const [mode, label] of [["day", "\u0631\u0648\u0632"], ["week", "\u0647\u0641\u062A\u0647"], ["month", "\u0645\u0627\u0647"]]) {
      const btn = zoomSelector.createEl("button", {
        cls: `ticktick-timeline-zoom-btn ${this.zoom === mode ? "is-active" : ""}`,
        text: label
      });
      btn.addEventListener("click", () => {
        this.zoom = mode;
        this.windowStart = null;
        this.windowEnd = null;
        void this.render();
      });
    }
    const navButtons = navGroup.createDiv({ cls: "ticktick-timeline-nav-group" });
    const prevBtn = navButtons.createEl("button", {
      cls: "ticktick-timeline-nav-btn mod-icon",
      attr: { "aria-label": "\u062F\u0648\u0631\u0647\u0654 \u0642\u0628\u0644" }
    });
    (0, import_obsidian16.setIcon)(prevBtn, "chevron-right");
    prevBtn.addEventListener("click", () => this.shiftWindow(-1));
    const todayBtn = navButtons.createEl("button", {
      cls: "ticktick-timeline-nav-btn",
      text: "\u0627\u0645\u0631\u0648\u0632"
    });
    todayBtn.addEventListener("click", () => {
      this.windowStart = null;
      this.windowEnd = null;
      void this.render();
    });
    const nextBtn = navButtons.createEl("button", {
      cls: "ticktick-timeline-nav-btn mod-icon",
      attr: { "aria-label": "\u062F\u0648\u0631\u0647\u0654 \u0628\u0639\u062F" }
    });
    (0, import_obsidian16.setIcon)(nextBtn, "chevron-left");
    nextBtn.addEventListener("click", () => this.shiftWindow(1));
    const titleSpan = toolbar.createDiv({ cls: "ticktick-timeline-title-span" });
    if (this.windowStart && this.windowEnd) {
      titleSpan.setText(`${formatPersianDate(this.windowStart, this.host.timeZone)} \u062A\u0627 ${formatPersianDate(this.windowEnd, this.host.timeZone)}`);
    }
    const actionsGroup = toolbar.createDiv({ cls: "ticktick-timeline-tool-group" });
    const colorLabels = {
      project: "\u0631\u0646\u06AF: \u067E\u0631\u0648\u0698\u0647",
      tag: "\u0631\u0646\u06AF: \u0628\u0631\u0686\u0633\u0628",
      priority: "\u0631\u0646\u06AF: \u0627\u0648\u0644\u0648\u06CC\u062A",
      uniform: "\u0631\u0646\u06AF: \u06CC\u06A9\u062F\u0633\u062A"
    };
    const colorBtn = actionsGroup.createEl("button", {
      cls: "ticktick-timeline-tool-btn",
      attr: { "aria-label": "\u067E\u0627\u0644\u062A \u0631\u0646\u06AF\u200C\u0628\u0646\u062F\u06CC" }
    });
    const paletteIcon = colorBtn.createSpan({ cls: "mod-icon" });
    (0, import_obsidian16.setIcon)(paletteIcon, "palette");
    colorBtn.createSpan({ text: colorLabels[this.colorMode] });
    colorBtn.addEventListener("click", (event) => {
      const menu = new import_obsidian16.Menu();
      for (const [mode, label] of [
        ["project", "\u0628\u0631 \u0627\u0633\u0627\u0633 \u067E\u0631\u0648\u0698\u0647"],
        ["tag", "\u0628\u0631 \u0627\u0633\u0627\u0633 \u0628\u0631\u0686\u0633\u0628"],
        ["priority", "\u0628\u0631 \u0627\u0633\u0627\u0633 \u0627\u0648\u0644\u0648\u06CC\u062A"],
        ["uniform", "\u0631\u0646\u06AF \u06CC\u06A9\u062F\u0633\u062A"]
      ]) {
        menu.addItem((item) => {
          item.setTitle(label).setChecked(this.colorMode === mode).onClick(() => {
            this.colorMode = mode;
            void this.render();
          });
        });
      }
      menu.showAtMouseEvent(event);
    });
    const backlogBtn = actionsGroup.createEl("button", {
      cls: `ticktick-timeline-tool-btn ${this.showBacklog ? "is-active" : ""}`,
      attr: { "aria-label": "\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0628\u062F\u0648\u0646 \u0628\u0627\u0632\u0647 \u0648 \u0646\u0642\u0637\u0647\u200C\u0627\u06CC" }
    });
    const backlogIcon = backlogBtn.createSpan({ cls: "mod-icon" });
    (0, import_obsidian16.setIcon)(backlogIcon, "layers");
    backlogBtn.createSpan({ text: `\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0628\u062F\u0648\u0646 \u0628\u0627\u0632\u0647 (${backlogCount})` });
    backlogBtn.addEventListener("click", () => {
      this.showBacklog = !this.showBacklog;
      void this.render();
    });
    const refreshBtn = actionsGroup.createEl("button", {
      cls: `ticktick-timeline-tool-btn mod-icon ${this.isSyncing ? "is-loading" : ""}`,
      attr: { "aria-label": "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0627\u0632 \u0633\u0631\u0648\u0631" }
    });
    (0, import_obsidian16.setIcon)(refreshBtn, "refresh-cw");
    refreshBtn.addEventListener("click", async () => {
      if (this.isSyncing) return;
      this.isSyncing = true;
      refreshBtn.addClass("is-loading");
      try {
        await this.host.refresh();
      } finally {
        this.isSyncing = false;
        refreshBtn.removeClass("is-loading");
        await this.render();
      }
    });
  }
  renderFilterBar(projects, tasks) {
    const filterContainer = this.element.createDiv({ cls: "ticktick-timeline-filter-container" });
    const filterHost = {
      app: this.host.app,
      scope: "timeline",
      projects: () => projects.map((p) => ({ id: String(p.id), name: p.name })),
      tags: () => [...new Set(tasks.flatMap((t) => t.tags ?? []).map(String))],
      savedViews: () => this.host.savedViews ? this.host.savedViews() : [],
      saveSavedViews: async (views) => {
        if (this.host.saveSavedViews) await this.host.saveSavedViews(views);
      },
      filterState: () => this.filterState,
      onFilterChange: (state) => {
        this.filterState = state;
        void this.render();
      }
    };
    this.filterBarInstance = new FilterBar(filterContainer, filterHost);
    this.filterBarInstance.render();
  }
  renderTimelineGrid(canvas, rangeItems, pointItems, projectMap) {
    if (!this.windowStart || !this.windowEnd) return;
    const grid = generateTimelineGrid(this.windowStart, this.windowEnd, this.zoom, this.host.firstWeekday);
    const totalDays = grid.days.length;
    const today = todayInZone(this.host.timeZone);
    const colWidthPx = this.zoom === "day" ? 38 : this.zoom === "week" ? 18 : 7;
    const scrollArea = canvas.createDiv({ cls: "ticktick-timeline-scroll-area" });
    const gridEl = scrollArea.createDiv({ cls: "ticktick-timeline-grid" });
    gridEl.style.direction = "rtl";
    gridEl.style.gridTemplateColumns = `repeat(${totalDays}, ${colWidthPx}px)`;
    const headerRow = gridEl.createDiv({ cls: "ticktick-timeline-header-row" });
    headerRow.style.gridColumn = `1 / span ${totalDays}`;
    headerRow.style.display = "grid";
    headerRow.style.direction = "rtl";
    headerRow.style.gridTemplateColumns = gridEl.style.gridTemplateColumns;
    for (const rawCol of grid.columns) {
      const col = rawCol;
      const colKey = String(col.key ?? "");
      const colHeader = headerRow.createDiv({
        cls: `ticktick-timeline-col-header ${colKey === today ? "is-today" : ""}`
      });
      colHeader.style.gridColumn = `${col.colStart} / span ${col.colSpan}`;
      if (this.zoom === "day") {
        const jsDate = /* @__PURE__ */ new Date(`${col.date ?? colKey}T12:00:00Z`);
        const weekdayName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "narrow" }).format(jsDate);
        const dayNum = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { day: "numeric" }).format(jsDate);
        colHeader.createDiv({ cls: "ticktick-col-weekday", text: weekdayName });
        colHeader.createDiv({ cls: "ticktick-col-daynum", text: dayNum });
      } else if (this.zoom === "week") {
        colHeader.createDiv({ cls: "ticktick-col-week-title", text: String(col.label ?? "") });
      } else {
        const jsDate = /* @__PURE__ */ new Date(`${col.start ?? colKey}T12:00:00Z`);
        const monthName = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { month: "long", year: "2-digit" }).format(jsDate);
        colHeader.createDiv({ cls: "ticktick-col-month-title", text: monthName });
      }
    }
    const todayIndex = grid.days.indexOf(today);
    if (todayIndex >= 0) {
      const todayMarker = gridEl.createDiv({ cls: "ticktick-timeline-today-line" });
      todayMarker.style.gridColumnStart = `${todayIndex + 1}`;
    }
    const visibleRangeItems = rangeItems.filter((item) => {
      return item.range.end >= this.windowStart && item.range.start <= this.windowEnd;
    });
    const byProject = /* @__PURE__ */ new Map();
    for (const item of visibleRangeItems) {
      const pId = String(item.task.projectId || "inbox");
      if (!byProject.has(pId)) byProject.set(pId, []);
      byProject.get(pId).push(item);
    }
    if (byProject.size === 0) {
      const emptyState2 = gridEl.createDiv({ cls: "ticktick-timeline-empty" });
      emptyState2.style.gridColumn = `1 / span ${totalDays}`;
      emptyState2.createDiv({
        cls: "ticktick-empty-desc",
        text: "\u0647\u06CC\u0686 \u062A\u0633\u06A9 \u0632\u0645\u0627\u0646\u200C\u062F\u0627\u0631\u06CC \u0628\u0627 \u0641\u06CC\u0644\u062A\u0631\u0647\u0627\u06CC \u0641\u0639\u0644\u06CC \u06CC\u0627\u0641\u062A \u0646\u0634\u062F. \u0645\u06CC\u200C\u062A\u0648\u0627\u0646\u06CC\u062F \u0627\u0632 \u067E\u0646\u0644 \xAB\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0628\u062F\u0648\u0646 \u0628\u0627\u0632\u0647\xBB \u062A\u0633\u06A9\u200C\u0647\u0627 \u0631\u0627 \u0627\u0636\u0627\u0641\u0647 \u06A9\u0646\u06CC\u062F."
      });
      return;
    }
    for (const [projectId, items] of byProject.entries()) {
      const project = projectMap.get(projectId);
      const projName = project?.name ?? (projectId === "inbox" ? "\u0635\u0646\u062F\u0648\u0642 \u0648\u0631\u0648\u062F\u06CC" : "\u067E\u0631\u0648\u0698\u0647");
      const projColor = project?.color ?? "#7c6cff";
      const projHeader = gridEl.createDiv({ cls: "ticktick-timeline-project-row" });
      projHeader.style.gridColumn = `1 / span ${totalDays}`;
      const colorDot = projHeader.createSpan({ cls: "ticktick-project-dot" });
      colorDot.style.backgroundColor = projColor;
      projHeader.createSpan({ cls: "ticktick-project-name", text: projName });
      projHeader.createSpan({ cls: "ticktick-project-count", text: `(${items.length})` });
      const packed = packTimelineLanes(items);
      for (let laneIdx = 0; laneIdx < packed.totalLanes; laneIdx++) {
        const laneTasks = packed.assignments.filter((a) => a.laneIndex === laneIdx);
        const laneRow = gridEl.createDiv({ cls: "ticktick-timeline-lane-row" });
        laneRow.style.gridColumn = `1 / span ${totalDays}`;
        laneRow.style.display = "grid";
        laneRow.style.direction = "rtl";
        laneRow.style.gridTemplateColumns = gridEl.style.gridTemplateColumns;
        for (const assignment of laneTasks) {
          this.renderRangeBar(laneRow, assignment.task, assignment.range, grid.days[0], totalDays, colWidthPx);
        }
      }
    }
  }
  renderRangeBar(container, task, range, gridStartDay, totalGridDays, colWidthPx) {
    const placement = computeBarGridPlacement(range, gridStartDay, totalGridDays);
    const tone = getTimelineTaskTone(task, this.colorMode);
    const priority = taskPriority(task.priority);
    const isCompleted = Number(task.status ?? 0) !== 0;
    const bar = container.createDiv({
      cls: `ticktick-timeline-bar priority-${priority.value} ${isCompleted ? "is-completed" : ""}`,
      attr: {
        role: "button",
        tabindex: "0",
        title: `${task.title} \xB7 ${range.start} \u062A\u0627 ${range.end}`
      }
    });
    bar.dataset.taskId = String(task.id);
    bar.style.gridColumn = placement.gridColumn;
    if (bulkSelectionStore.isSelected(String(task.id))) {
      bar.addClass("is-bulk-selected");
    }
    bar.style.setProperty("--ticktick-task-tone", tone);
    const handleStart = bar.createDiv({
      cls: "ticktick-timeline-handle handle-start",
      attr: { "data-edge": "start", title: "\u062A\u063A\u06CC\u06CC\u0631 \u062A\u0627\u0631\u06CC\u062E \u0634\u0631\u0648\u0639" }
    });
    const contentWrapper = bar.createDiv({ cls: "ticktick-timeline-bar-content" });
    const check = contentWrapper.createEl("input", {
      type: "checkbox",
      cls: "ticktick-timeline-bar-check",
      attr: { "aria-label": `\u062A\u06A9\u0645\u06CC\u0644 ${task.title}` }
    });
    check.checked = isCompleted;
    check.disabled = isCompleted;
    check.addEventListener("click", (e) => e.stopPropagation());
    check.addEventListener("pointerdown", (e) => e.stopPropagation());
    check.addEventListener("change", async () => {
      await this.host.complete(task);
      await this.render();
    });
    const titleEl = contentWrapper.createSpan({
      cls: "ticktick-timeline-bar-title",
      text: String(task.title || "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646")
    });
    const dateChip = contentWrapper.createSpan({
      cls: "ticktick-timeline-bar-date-chip",
      text: `${range.start.slice(5)} \u2192 ${range.end.slice(5)}`
    });
    const handleDue = bar.createDiv({
      cls: "ticktick-timeline-handle handle-due",
      attr: { "data-edge": "due", title: "\u062A\u063A\u06CC\u06CC\u0631 \u062A\u0627\u0631\u06CC\u062E \u067E\u0627\u06CC\u0627\u0646" }
    });
    const openDetails = () => {
      new TaskDetailsModal(this.host.app, task, {
        complete: async () => {
          await this.host.complete(task);
          await this.render();
        },
        load: (item) => this.host.load(item),
        edit: (item) => this.host.edit(item),
        changed: async () => {
          await this.host.refresh();
          await this.render();
        },
        allTasks: () => this.host.tasks()
      }).open();
    };
    contentWrapper.addEventListener("click", (e) => {
      if (this.activeDrag || this.wasDraggedRecently) return;
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        const sel = bulkSelectionStore.toggle(String(task.id));
        bar.toggleClass("is-bulk-selected", sel);
        return;
      }
      openDetails();
    });
    bar.addEventListener("keydown", (e) => {
      if (e.key === "x" || (e.key === "Enter" || e.key === " ") && (e.shiftKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        const sel = bulkSelectionStore.toggle(String(task.id));
        bar.toggleClass("is-bulk-selected", sel);
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetails();
      }
    });
    this.bindPointerInteractions(bar, handleStart, handleDue, task, range, colWidthPx);
  }
  bindPointerInteractions(bar, handleStart, handleDue, task, range, colWidthPx) {
    const onPointerDown = (event, edge) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      event.preventDefault();
      const startX = event.clientX;
      let deltaDays = 0;
      const previewEl = document.body.createDiv({ cls: "ticktick-timeline-drag-preview" });
      previewEl.setText(`\u0628\u0627\u0632\u0647: ${range.start} \u062A\u0627 ${range.end}`);
      previewEl.style.left = `${event.clientX + 16}px`;
      previewEl.style.top = `${event.clientY + 16}px`;
      bar.addClass("is-dragging");
      this.activeDrag = {
        task,
        edge,
        startX,
        initialStart: range.start,
        initialDue: range.end,
        deltaDays: 0,
        previewEl,
        barEl: bar
      };
      const onPointerMove = (moveEvent) => {
        if (!this.activeDrag) return;
        const dx = startX - moveEvent.clientX;
        deltaDays = Math.round(dx / colWidthPx);
        this.activeDrag.deltaDays = deltaDays;
        const shifted = shiftTimelineEndpoints(task, deltaDays, edge, this.host.timeZone);
        const newStart = toDateKey(shifted.startDate, this.host.timeZone);
        const newDue = toDateKey(shifted.dueDate, this.host.timeZone);
        const edgeLabel = edge === "both" ? "\u062C\u0627\u0628\u062C\u0627\u06CC\u06CC \u06A9\u0644 \u0628\u0627\u0632\u0647" : edge === "start" ? "\u062A\u0646\u0638\u06CC\u0645 \u062A\u0627\u0631\u06CC\u062E \u0634\u0631\u0648\u0639" : "\u062A\u0646\u0638\u06CC\u0645 \u0633\u0631\u0631\u0633\u06CC\u062F";
        previewEl.setText(`${edgeLabel}: ${newStart ?? "\u2014"} \u062A\u0627 ${newDue ?? "\u2014"} (${deltaDays >= 0 ? `+${deltaDays}` : deltaDays} \u0631\u0648\u0632)`);
        previewEl.style.left = `${moveEvent.clientX + 16}px`;
        previewEl.style.top = `${moveEvent.clientY + 16}px`;
      };
      const onPointerUp = async (upEvent) => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        window.removeEventListener("keydown", onKeyDown);
        if (!this.activeDrag) return;
        previewEl.remove();
        bar.removeClass("is-dragging");
        const finalDelta = this.activeDrag.deltaDays;
        const activeEdge = this.activeDrag.edge;
        this.activeDrag = null;
        if (finalDelta !== 0) {
          this.wasDraggedRecently = true;
          setTimeout(() => {
            this.wasDraggedRecently = false;
          }, 250);
          const shifted = shiftTimelineEndpoints(task, finalDelta, activeEdge, this.host.timeZone);
          const nextStart = toDateKey(shifted.startDate, this.host.timeZone);
          const nextDue = toDateKey(shifted.dueDate, this.host.timeZone);
          try {
            new import_obsidian16.Notice(`\u062F\u0631 \u062D\u0627\u0644 \u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0628\u0627\u0632\u0647\u0654 \u062A\u0633\u06A9 \u0628\u0647 ${nextStart} \u062A\u0627 ${nextDue}...`);
            await this.host.rescheduleRange(task, nextStart, nextDue);
            new import_obsidian16.Notice("\u0628\u0627\u0632\u0647 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062A\u0646\u0638\u06CC\u0645 \u0634\u062F.");
            await this.render();
          } catch (err) {
            new import_obsidian16.Notice(`\u062E\u0637\u0627 \u062F\u0631 \u0630\u062E\u06CC\u0631\u0647\u0654 \u0628\u0627\u0632\u0647: ${err instanceof Error ? err.message : String(err)}`);
            await this.render();
          }
        }
      };
      const onKeyDown = (keyEvent) => {
        if (keyEvent.key === "Escape") {
          window.removeEventListener("pointermove", onPointerMove);
          window.removeEventListener("pointerup", onPointerUp);
          window.removeEventListener("keydown", onKeyDown);
          previewEl.remove();
          bar.removeClass("is-dragging");
          this.activeDrag = null;
          new import_obsidian16.Notice("\u062C\u0627\u0628\u062C\u0627\u06CC\u06CC \u0644\u063A\u0648 \u0634\u062F.");
        }
      };
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("keydown", onKeyDown);
    };
    bar.addEventListener("pointerdown", (e) => onPointerDown(e, "both"));
    handleStart.addEventListener("pointerdown", (e) => onPointerDown(e, "start"));
    handleDue.addEventListener("pointerdown", (e) => onPointerDown(e, "due"));
  }
  renderBacklogDrawer(pointTasks, backlogTasks) {
    const drawer = this.element.createDiv({ cls: "ticktick-timeline-backlog-drawer" });
    const header = drawer.createDiv({ cls: "ticktick-backlog-header" });
    header.createSpan({ cls: "ticktick-backlog-title", text: "\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0646\u0642\u0637\u0647\u200C\u0627\u06CC \u0648 \u0628\u062F\u0648\u0646 \u0628\u0627\u0632\u0647\u0654 \u0645\u0634\u062E\u0635" });
    const closeBtn = header.createEl("button", { cls: "ticktick-backlog-close mod-icon" });
    (0, import_obsidian16.setIcon)(closeBtn, "x");
    closeBtn.addEventListener("click", () => {
      this.showBacklog = false;
      void this.render();
    });
    const cardsContainer = drawer.createDiv({ cls: "ticktick-backlog-cards" });
    for (const item of pointTasks) {
      const card = cardsContainer.createDiv({ cls: "ticktick-backlog-card is-point" });
      card.dataset.taskId = String(item.task.id);
      if (bulkSelectionStore.isSelected(String(item.task.id))) {
        card.addClass("is-bulk-selected");
      }
      card.addEventListener("click", (e) => {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          bulkSelectionStore.toggle(String(item.task.id));
        }
      });
      card.createDiv({ cls: "ticktick-card-title", text: item.task.title });
      card.createDiv({ cls: "ticktick-card-date", text: `\u0633\u0631\u0631\u0633\u06CC\u062F: ${item.range.end}` });
      const planBtn = card.createEl("button", {
        cls: "ticktick-card-plan-btn",
        text: "\u0627\u06CC\u062C\u0627\u062F \u0628\u0627\u0632\u0647\u0654 \u06F3 \u0631\u0648\u0632\u0647"
      });
      planBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const start = item.range.end;
        const due = shiftCalendarDay(start, 3);
        await this.host.rescheduleRange(item.task, start, due);
        await this.render();
      });
    }
    for (const task of backlogTasks) {
      const card = cardsContainer.createDiv({ cls: "ticktick-backlog-card is-unscheduled" });
      card.dataset.taskId = String(task.id);
      if (bulkSelectionStore.isSelected(String(task.id))) {
        card.addClass("is-bulk-selected");
      }
      card.addEventListener("click", (e) => {
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          e.preventDefault();
          e.stopPropagation();
          bulkSelectionStore.toggle(String(task.id));
        }
      });
      card.createDiv({ cls: "ticktick-card-title", text: task.title });
      card.createDiv({ cls: "ticktick-card-badge", text: "\u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E" });
      const planBtn = card.createEl("button", {
        cls: "ticktick-card-plan-btn",
        text: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC \u0627\u0632 \u0627\u0645\u0631\u0648\u0632"
      });
      planBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const today = todayInZone(this.host.timeZone);
        const due = shiftCalendarDay(today, 2);
        await this.host.rescheduleRange(task, today, due);
        await this.render();
      });
    }
    if (pointTasks.length === 0 && backlogTasks.length === 0) {
      cardsContainer.createDiv({
        cls: "ticktick-backlog-empty",
        text: "\u062A\u0645\u0627\u0645 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u06CC\u0646 \u0641\u06CC\u0644\u062A\u0631 \u062F\u0627\u0631\u0627\u06CC \u0628\u0627\u0632\u0647\u0654 \u0632\u0645\u0627\u0646\u06CC \u0631\u0648\u06CC \u062A\u0627\u06CC\u0645\u200C\u0644\u0627\u06CC\u0646 \u0647\u0633\u062A\u0646\u062F."
      });
    }
  }
  shiftWindow(direction) {
    if (!this.windowStart || !this.windowEnd) return;
    const amount = this.zoom === "month" ? direction * 30 : this.zoom === "week" ? direction * 7 : direction * 14;
    this.windowStart = shiftCalendarDay(this.windowStart, amount);
    this.windowEnd = shiftCalendarDay(this.windowEnd, amount);
    void this.render();
  }
};

// src/obsidian/note-import.ts
var import_obsidian17 = require("obsidian");

// src/core/ticktick-note.js
function normalizeTickTickNote(record, project = {}) {
  if (!record || String(record.kind ?? "").toUpperCase() !== "NOTE") {
    return null;
  }
  const id = String(record.id ?? "").trim();
  const title = String(record.title ?? "").trim();
  if (!id || !title) {
    return null;
  }
  return {
    id,
    title,
    projectId: String(record.projectId ?? project.id ?? ""),
    projectName: String(record.projectName ?? project.name ?? ""),
    kind: "NOTE",
    content: String(record.content ?? record.desc ?? ""),
    modifiedTime: record.modifiedTime ?? record.modifiedAt ?? null,
    tags: Array.isArray(record.tags) ? record.tags.map(String) : []
  };
}
function noteFileName(note) {
  const safeTitle = String(note.title ?? "").replace(/[\\/:*?"<>|]/g, "-").trim().slice(0, 80) || "TickTick Note";
  return `${safeTitle}-${note.id}.md`;
}
function noteMarkdown(note, importedAt = (/* @__PURE__ */ new Date()).toISOString()) {
  return [
    "---",
    `ticktickNoteId: ${note.id}`,
    `ticktickProjectId: ${note.projectId}`,
    "ticktickKind: NOTE",
    `ticktickImportedAt: ${importedAt}`,
    "---",
    "",
    "<!-- ticktick-bridge:note:start -->",
    note.content,
    "<!-- ticktick-bridge:note:end -->",
    ""
  ].join("\n");
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
var NoteImportModal = class extends import_obsidian17.Modal {
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
    for (const row of rows) new import_obsidian17.Setting(this.contentEl).setName(row.note.title).setDesc(`${row.note.projectName || "\u0628\u062F\u0648\u0646 \u067E\u0631\u0648\u0698\u0647"}${row.collision ? " \xB7 \u0641\u0627\u06CC\u0644 \u0647\u0645\u200C\u0646\u0627\u0645 \u0645\u0648\u062C\u0648\u062F \u0627\u0633\u062A \u0648 \u0631\u062F \u0645\u06CC\u200C\u0634\u0648\u062F" : ""}`).addToggle((toggle) => toggle.setValue(false).setDisabled(row.collision).onChange((value) => row.selected = value));
    new import_obsidian17.Setting(this.contentEl).addButton((button) => button.setButtonText("\u0627\u0646\u062A\u0642\u0627\u0644 \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647\u200C\u0647\u0627").setCta().onClick(async () => {
      button.setDisabled(true);
      try {
        const result = await this.importer.apply(rows);
        new import_obsidian17.Notice(`${result.created.length} \u0641\u0627\u06CC\u0644 \u0627\u06CC\u062C\u0627\u062F \u0634\u062F\u061B ${result.skipped.length} \u0645\u0648\u0631\u062F \u0631\u062F \u0634\u062F.`);
        this.close();
      } catch (error) {
        button.setDisabled(false);
        new import_obsidian17.Notice(error instanceof Error ? error.message : "\u0627\u0646\u062A\u0642\u0627\u0644 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      }
    }));
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/obsidian/modals/local-habit-migration-modal.ts
var import_obsidian18 = require("obsidian");

// src/core/local-habit.js
var KNOWN_FRONTMATTER_KEYS = /* @__PURE__ */ new Set([
  "habit",
  "type",
  "target",
  "unit",
  "startDate",
  "records",
  "icon",
  "group",
  "useGroupColor",
  "tags"
]);
function parseYamlFrontmatter(text) {
  if (typeof text !== "string") return null;
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const yamlContent = match[1];
  const lines = yamlContent.split(/\r?\n/);
  const result = {};
  let currentKey = null;
  let currentList = null;
  let currentDict = null;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const listItemMatch = line.match(/^[\t ]+-\s+(.*)$/);
    if (listItemMatch && currentKey && currentList) {
      let val = listItemMatch[1].trim().replace(/^['"]|['"]$/g, "");
      currentList.push(val);
      continue;
    }
    const dictItemMatch = line.match(/^[\t ]+([^:\s]+):\s*(.*)$/);
    if (dictItemMatch && currentKey && currentDict) {
      const subKey = dictItemMatch[1].trim();
      let subVal = dictItemMatch[2].trim();
      if (/^-?\d+(\.\d+)?$/.test(subVal)) {
        subVal = Number(subVal);
      } else if (subVal === "true") {
        subVal = true;
      } else if (subVal === "false") {
        subVal = false;
      } else {
        subVal = subVal.replace(/^['"]|['"]$/g, "");
      }
      currentDict[subKey] = subVal;
      continue;
    }
    const topMatch = line.match(/^([^:\s]+):\s*(.*)$/);
    if (topMatch) {
      currentKey = topMatch[1].trim();
      currentList = null;
      currentDict = null;
      let rawVal = topMatch[2].trim();
      if (!rawVal) {
        if (currentKey === "records") {
          currentDict = {};
          result[currentKey] = currentDict;
        } else if (currentKey === "tags") {
          currentList = [];
          result[currentKey] = currentList;
        } else {
          result[currentKey] = "";
        }
      } else if (rawVal.startsWith("[") && rawVal.endsWith("]")) {
        result[currentKey] = rawVal.slice(1, -1).split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
      } else if (/^-?\d+(\.\d+)?$/.test(rawVal)) {
        result[currentKey] = Number(rawVal);
      } else if (rawVal === "true") {
        result[currentKey] = true;
      } else if (rawVal === "false") {
        result[currentKey] = false;
      } else {
        result[currentKey] = rawVal.replace(/^['"]|['"]$/g, "");
      }
    }
  }
  return result;
}
function isLocalHabit(markdownText) {
  if (typeof markdownText !== "string") return false;
  return /^---\r?\n[\s\S]*?\bhabit:\s*true\b[\s\S]*?\r?\n---/m.test(markdownText);
}
function extractHabitTitle(markdownText, fallback = "\u0639\u0627\u062F\u062A \u0628\u062F\u0648\u0646 \u0646\u0627\u0645") {
  if (typeof markdownText !== "string") return fallback;
  const headingMatch = markdownText.match(/^#\s+(.+)$/m);
  if (headingMatch && headingMatch[1].trim()) {
    return headingMatch[1].trim();
  }
  return fallback;
}
function parseLocalHabit(markdownText, { path = "", fallbackTitle = "" } = {}) {
  const frontmatter = parseYamlFrontmatter(markdownText);
  if (!frontmatter || frontmatter.habit !== true) {
    return null;
  }
  const derivedTitle = fallbackTitle || (path ? path.split("/").pop()?.replace(/\.md$/, "") : "");
  const title = extractHabitTitle(markdownText, derivedTitle || "\u0639\u0627\u062F\u062A \u0628\u062F\u0648\u0646 \u0646\u0627\u0645");
  const type = String(frontmatter.type ?? "binary").toLowerCase();
  const rawTarget = frontmatter.target !== void 0 ? Number(frontmatter.target) : type === "repetition" ? 2 : 1;
  const goal = Math.max(1, Number.isNaN(rawTarget) ? 1 : rawTarget);
  const rawRecords = frontmatter.records && typeof frontmatter.records === "object" ? frontmatter.records : {};
  const records = {};
  for (const [dateKey2, val] of Object.entries(rawRecords)) {
    const num = Number(val);
    if (!Number.isNaN(num)) {
      records[String(dateKey2).trim()] = num;
    }
  }
  const unsupported = {};
  for (const [key, val] of Object.entries(frontmatter)) {
    if (!KNOWN_FRONTMATTER_KEYS.has(key)) {
      unsupported[key] = val;
    }
  }
  const hasUnsupportedType = !["binary", "repetition"].includes(type);
  const needsMapping = Object.keys(unsupported).length > 0 || hasUnsupportedType;
  return {
    id: path ? `local:${path}` : `local:${title}`,
    name: title,
    type,
    goal,
    target: goal,
    unit: typeof frontmatter.unit === "string" ? frontmatter.unit.trim() : "",
    startDate: typeof frontmatter.startDate === "string" ? frontmatter.startDate.trim() : null,
    records,
    icon: typeof frontmatter.icon === "string" ? frontmatter.icon.trim() : "",
    sectionName: typeof frontmatter.group === "string" ? frontmatter.group.trim() : "",
    group: typeof frontmatter.group === "string" ? frontmatter.group.trim() : "",
    useGroupColor: Boolean(frontmatter.useGroupColor),
    tags: Array.isArray(frontmatter.tags) ? frontmatter.tags.map(String) : [],
    source: "local",
    path,
    unsupported,
    needsMapping
  };
}
function previewHabitMigration(localHabit) {
  if (!localHabit) return null;
  const losses = [];
  losses.push("\u0631\u06A9\u0648\u0631\u062F\u0647\u0627\u06CC \u0631\u0648\u0632\u0627\u0646\u0647 \u06AF\u0630\u0634\u062A\u0647 \u0628\u0647 TickTick \u0645\u0646\u062A\u0642\u0644 \u0646\u0645\u06CC\u200C\u0634\u0648\u0646\u062F\u061B \u062A\u0627\u0631\u06CC\u062E\u0686\u0647 \u062F\u0631 \u0633\u0631\u0648\u0631 \u0627\u0632 \u0631\u0648\u0632 \u062C\u0627\u0631\u06CC \u0645\u062D\u0627\u0633\u0628\u0647 \u062E\u0648\u0627\u0647\u062F \u0634\u062F.");
  if (localHabit.needsMapping) {
    const unKeys = Object.keys(localHabit.unsupported ?? {});
    if (unKeys.length) {
      losses.push(`\u0641\u06CC\u0644\u062F\u0647\u0627\u06CC \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC\u200C\u0646\u0634\u062F\u0647 \u0645\u062D\u0644\u06CC \u0646\u06CC\u0627\u0632 \u0628\u0647 \u0646\u06AF\u0627\u0634\u062A \u062F\u0627\u0631\u0646\u062F: ${unKeys.join(", ")}`);
    }
    if (!["binary", "repetition"].includes(localHabit.type)) {
      losses.push(`\u0646\u0648\u0639 \u0639\u0627\u062F\u062A '${localHabit.type}' \u062F\u0631 TickTick \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.`);
    }
  }
  return {
    sourceId: localHabit.id,
    sourcePath: localHabit.path,
    name: localHabit.name,
    targetPayload: {
      name: localHabit.name,
      type: localHabit.type,
      goal: localHabit.goal,
      unit: localHabit.unit,
      sectionName: localHabit.sectionName,
      icon: localHabit.icon,
      tags: localHabit.tags
    },
    losses,
    needsMapping: localHabit.needsMapping,
    isBlocked: true,
    blockReason: "\u0627\u06CC\u062C\u0627\u062F \u0631\u06CC\u0645\u0648\u062A \u0639\u0627\u062F\u062A \u062F\u0631 TickTick \u062A\u0627 \u0632\u0645\u0627\u0646 \u0627\u0639\u062A\u0628\u0627\u0631\u0633\u0646\u062C\u06CC \u0642\u0631\u0627\u0631\u062F\u0627\u062F \u0631\u0633\u0645\u06CC API \u062F\u0631 \u062D\u0627\u0644\u062A \u0627\u06CC\u0645\u0646 \u0645\u0633\u062F\u0648\u062F \u0627\u0633\u062A."
  };
}

// src/obsidian/modals/local-habit-migration-modal.ts
var LocalHabitMigrationModal = class extends import_obsidian18.Modal {
  discovered = [];
  selectedPaths = /* @__PURE__ */ new Set();
  constructor(app) {
    super(app);
  }
  async onOpen() {
    this.contentEl.empty();
    this.contentEl.addClass("ticktick-local-habit-modal");
    this.contentEl.createEl("h2", { text: "\u0645\u0631\u0648\u0631 \u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0645\u062D\u0644\u06CC \u0648 \u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 \u0645\u0647\u0627\u062C\u0631\u062A" });
    const intro = this.contentEl.createEl("p", {
      text: "\u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0630\u062E\u06CC\u0631\u0647\u200C\u0634\u062F\u0647 \u062F\u0631 \u0648\u0627\u0644\u062A \u0628\u0631\u0631\u0633\u06CC \u0634\u062F\u0646\u062F. \u0627\u0646\u062A\u0642\u0627\u0644 \u0645\u0633\u062A\u0642\u06CC\u0645 \u0628\u0647 TickTick \u062A\u0627 \u0632\u0645\u0627\u0646 \u062A\u0623\u06CC\u06CC\u062F \u0631\u0633\u0645\u06CC API \u0645\u0633\u062F\u0648\u062F \u0627\u0633\u062A \u0648 \u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC \u0645\u062D\u0644\u06CC \u0634\u0645\u0627 \u062F\u0633\u062A\u200C\u0646\u062E\u0648\u0631\u062F\u0647 \u0628\u0627\u0642\u06CC \u0645\u06CC\u200C\u0645\u0627\u0646\u0646\u062F."
    });
    intro.addClass("ticktick-control-desc");
    const loading = this.contentEl.createDiv({ text: "\u062F\u0631 \u062D\u0627\u0644 \u062C\u0633\u062A\u062C\u0648\u06CC \u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0645\u062D\u0644\u06CC \u0648\u0627\u0644\u062A..." });
    try {
      await this.discoverHabits();
      loading.remove();
      this.renderHabitList();
    } catch (error) {
      loading.setText(`\u062E\u0637\u0627 \u062F\u0631 \u062E\u0648\u0627\u0646\u062F\u0646 \u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC \u0639\u0627\u062F\u062A: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  async discoverHabits() {
    this.discovered = [];
    const files = this.app.vault.getMarkdownFiles();
    for (const file of files) {
      if (file.path.startsWith(".ticktick")) continue;
      const isCandidatePath = file.path.includes("Habit") || file.path.includes("\u0639\u0627\u062F\u062A");
      if (isCandidatePath || file.stat.size < 5e4) {
        try {
          const content = await this.app.vault.read(file);
          if (isLocalHabit(content)) {
            const habit = parseLocalHabit(content, { path: file.path, fallbackTitle: file.basename });
            if (habit) {
              const preview = previewHabitMigration(habit);
              this.discovered.push({ file, habit, preview });
            }
          }
        } catch {
        }
      }
    }
  }
  renderHabitList() {
    if (!this.discovered.length) {
      this.contentEl.createDiv({
        cls: "ticktick-empty-state",
        text: "\u0647\u06CC\u0686 \u0641\u0627\u06CC\u0644 \u0639\u0627\u062F\u062A \u0645\u062D\u0644\u06CC \u0628\u0627 \u0633\u0627\u062E\u062A\u0627\u0631 frontmatter \u0645\u0639\u062A\u0628\u0631 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F."
      });
      return;
    }
    const listContainer = this.contentEl.createDiv({ cls: "ticktick-local-habit-list" });
    for (const item of this.discovered) {
      const { habit, preview } = item;
      const row = listContainer.createDiv({ cls: "ticktick-local-habit-row" });
      const check = row.createEl("input", {
        type: "checkbox",
        attr: { "aria-label": `\u0627\u0646\u062A\u062E\u0627\u0628 ${habit?.name}` }
      });
      check.checked = this.selectedPaths.has(item.file.path);
      check.addEventListener("change", () => {
        if (check.checked) this.selectedPaths.add(item.file.path);
        else this.selectedPaths.delete(item.file.path);
      });
      const body = row.createDiv({ cls: "ticktick-local-habit-info" });
      const header = body.createDiv({ cls: "ticktick-local-habit-header" });
      if (habit?.icon) header.createSpan({ text: habit.icon + " " });
      header.createEl("strong", { text: habit?.name ?? item.file.basename });
      if (habit?.sectionName) {
        header.createSpan({ cls: "ticktick-habit-tag", text: habit.sectionName });
      }
      const meta = body.createDiv({ cls: "ticktick-local-habit-meta" });
      meta.createSpan({ text: `\u0646\u0648\u0639: ${habit?.type === "repetition" ? "\u062A\u06A9\u0631\u0627\u0631" : "\u062F\u0648\u062F\u0648\u06CC\u06CC"} \xB7 \u0647\u062F\u0641: ${habit?.goal} ${habit?.unit || ""}` });
      meta.createSpan({ text: ` | \u0645\u0633\u06CC\u0631: ${item.file.path}` });
      if (preview?.losses.length) {
        const lossBox = body.createDiv({ cls: "ticktick-local-habit-losses" });
        for (const loss of preview.losses) {
          lossBox.createDiv({ text: `\u26A0\uFE0F ${loss}` });
        }
      }
      if (preview?.isBlocked) {
        const gateBox = body.createDiv({ cls: "ticktick-local-habit-gate" });
        gateBox.createDiv({ text: `\u{1F512} ${preview.blockReason}` });
      }
    }
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    const closeBtn = actions.createEl("button", { text: "\u0628\u0633\u062A\u0646", cls: "mod-cta" });
    closeBtn.addEventListener("click", () => this.close());
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/obsidian/main.ts
init_project_board();

// src/core/bulk-operations.js
init_date();
init_calendar_range();
function computeBulkTaskMutation(task, operationType, parameters = {}, timeZone = "Asia/Tehran") {
  if (!task) return null;
  const taskId = String(task.id);
  const projectId = String(task.projectId || "inbox");
  switch (operationType) {
    case "project": {
      const targetProjectId = String(parameters.projectId || "");
      if (!targetProjectId) throw new Error("\u0634\u0646\u0627\u0633\u0647\u0654 \u067E\u0631\u0648\u0698\u0647\u0654 \u0645\u0642\u0635\u062F \u0645\u0634\u062E\u0635 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.");
      return {
        id: taskId,
        projectId: targetProjectId,
        columnId: null
        // reset board column when moving projects
      };
    }
    case "tag-add": {
      const tag = String(parameters.tag || "").trim().replace(/^#/, "");
      if (!tag) throw new Error("\u0646\u0627\u0645 \u0628\u0631\u0686\u0633\u0628 \u0628\u0631\u0627\u06CC \u0627\u0641\u0632\u0648\u062F\u0646 \u0645\u0634\u062E\u0635 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.");
      const currentTags = Array.isArray(task.tags) ? task.tags : [];
      if (currentTags.includes(tag)) return null;
      return {
        id: taskId,
        projectId,
        tags: [...currentTags, tag]
      };
    }
    case "tag-remove": {
      const tag = String(parameters.tag || "").trim().replace(/^#/, "");
      if (!tag) throw new Error("\u0646\u0627\u0645 \u0628\u0631\u0686\u0633\u0628 \u0628\u0631\u0627\u06CC \u062D\u0630\u0641 \u0645\u0634\u062E\u0635 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.");
      const currentTags = Array.isArray(task.tags) ? task.tags : [];
      if (!currentTags.includes(tag)) return null;
      return {
        id: taskId,
        projectId,
        tags: currentTags.filter((t) => t !== tag)
      };
    }
    case "priority": {
      const priority = Number(parameters.priority ?? 0);
      return {
        id: taskId,
        projectId,
        priority
      };
    }
    case "schedule-date": {
      const targetDay = String(parameters.targetDay || parameters.dueDate || "");
      if (!targetDay) throw new Error("\u062A\u0627\u0631\u06CC\u062E \u0645\u0642\u0635\u062F \u0645\u0634\u062E\u0635 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.");
      const tzOffset = "+0330";
      const isTimed = Boolean(parameters.time);
      const timePart = parameters.time ? parameters.time.length === 5 ? `${parameters.time}:00` : parameters.time : "00:00:00";
      const due = isTimed ? `${targetDay}T${timePart}${tzOffset}` : `${targetDay}T00:00:00${tzOffset}`;
      let start = null;
      if (parameters.startDate) {
        start = isTimed ? `${parameters.startDate}T${timePart}${tzOffset}` : `${parameters.startDate}T00:00:00${tzOffset}`;
      }
      return {
        id: taskId,
        projectId,
        dueDate: due,
        startDate: start,
        isAllDay: !isTimed,
        timeZone
      };
    }
    case "shift-date": {
      const deltaDays = Number(parameters.deltaDays ?? 0);
      if (!deltaDays) return null;
      const curDue = toDateKey(task.dueDate, task.timeZone || timeZone);
      const curStart = toDateKey(task.startDate, task.timeZone || timeZone);
      if (!curDue && !curStart) return null;
      const tzOffset = "+0330";
      const isTimed = !task.isAllDay && String(task.startDate ?? task.dueDate ?? "").includes("T");
      const dueTime = String(task.dueDate ?? "").match(/T(\d{2}:\d{2}:\d{2})/)?.[1] ?? "00:00:00";
      const startTime = String(task.startDate ?? "").match(/T(\d{2}:\d{2}:\d{2})/)?.[1] ?? "00:00:00";
      const nextDue = curDue ? isTimed ? `${shiftCalendarDay(curDue, deltaDays)}T${dueTime}${tzOffset}` : `${shiftCalendarDay(curDue, deltaDays)}T00:00:00${tzOffset}` : null;
      const nextStart = curStart ? isTimed ? `${shiftCalendarDay(curStart, deltaDays)}T${startTime}${tzOffset}` : `${shiftCalendarDay(curStart, deltaDays)}T00:00:00${tzOffset}` : null;
      return {
        id: taskId,
        projectId,
        dueDate: nextDue,
        startDate: nextStart,
        isAllDay: !isTimed,
        timeZone
      };
    }
    case "clear-date": {
      return {
        id: taskId,
        projectId,
        dueDate: null,
        startDate: null,
        isAllDay: true
      };
    }
    case "complete": {
      return {
        id: taskId,
        projectId,
        status: 2
      };
    }
    case "reopen": {
      return {
        id: taskId,
        projectId,
        status: 0
      };
    }
    case "delete": {
      return {
        id: taskId,
        projectId,
        isDelete: true
      };
    }
    default:
      throw new Error(`\u0639\u0645\u0644\u06CC\u0627\u062A \u06AF\u0631\u0648\u0647\u06CC \u0646\u0627\u0634\u0646\u0627\u062E\u062A\u0647: ${operationType}`);
  }
}
function createBulkOperationManifest(tasks = [], operationType, parameters = {}) {
  return {
    manifestId: `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    operationType,
    parameters: sanitizeParameters(parameters),
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    totalCount: tasks.length,
    targets: tasks.map((t) => ({
      id: String(t.id),
      title: String(t.title || "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646"),
      projectId: String(t.projectId || ""),
      before: {
        projectId: t.projectId,
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate,
        startDate: t.startDate,
        tags: Array.isArray(t.tags) ? [...t.tags] : []
      }
    }))
  };
}
async function runBoundedQueue(items, workerFn, concurrency = 3) {
  const results = [];
  const activeConcurrency = Math.max(1, concurrency);
  let index = 0;
  async function next() {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      try {
        const result = await workerFn(item, currentIndex);
        results[currentIndex] = {
          success: true,
          item,
          result
        };
      } catch (error) {
        results[currentIndex] = {
          success: false,
          item,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  }
  const pool = Array.from(
    { length: Math.min(items.length, activeConcurrency) },
    () => next()
  );
  await Promise.all(pool);
  return results;
}
function formatBulkOutcomeReport(manifest, queueResults = []) {
  const succeeded = queueResults.filter((r) => r.success).length;
  const failed = queueResults.filter((r) => !r.success).length;
  return {
    manifestId: manifest.manifestId,
    operationType: manifest.operationType,
    parameters: manifest.parameters,
    startedAt: manifest.timestamp,
    completedAt: (/* @__PURE__ */ new Date()).toISOString(),
    total: manifest.totalCount,
    succeeded,
    failed,
    items: queueResults.map((r) => ({
      id: r.item.id,
      title: r.item.title,
      success: r.success,
      before: r.item.before,
      after: r.result ?? null,
      error: r.error ?? null
    }))
  };
}
function sanitizeParameters(params) {
  const safe = {};
  for (const [key, val] of Object.entries(params)) {
    if (["token", "cookie", "password", "secret", "auth"].some((s) => key.toLowerCase().includes(s))) {
      continue;
    }
    safe[key] = val;
  }
  return safe;
}

// src/obsidian/constants.ts
var VIEW_TYPE = "ticktick-bridge-today";
var HABIT_VIEW_TYPE = "ticktick-bridge-habits";
var PLANNER_VIEW_TYPE = "ticktick-bridge-planner";
var PROJECT_BOARD_VIEW_TYPE = "ticktick-bridge-project-board";
var CONTROL_VIEW_TYPE = "ticktick-bridge-control";
var TIMELINE_VIEW_TYPE = "ticktick-bridge-timeline";
var WEEKLY_REVIEW_VIEW_TYPE = "ticktick-bridge-weekly-review";
var EISENHOWER_MATRIX_VIEW_TYPE = "ticktick-bridge-matrix";
var TIMEBLOCK_PLANNER_VIEW_TYPE = "ticktick-bridge-day-planner";
var HEATMAP_VIEW_TYPE = "ticktick-bridge-heatmap";
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
  boardSidebarCollapsed: false,
  boardSidebarPreferenceInitialized: false,
  boardSmartViewGrouping: "project",
  savedViews: [],
  experimentalHierarchyWrites: false,
  enableDueReminders: true,
  reminderLeadMinutes: 5,
  enableReminderChime: true
};

// src/obsidian/modals/task-editor-modal.ts
var import_obsidian19 = require("obsidian");
init_date();
var TaskEditorModal = class extends import_obsidian19.Modal {
  constructor(app, projects, initial, existingTags = [], availableTasks = [], onCreateSubtask) {
    super(app);
    this.projects = projects;
    this.initial = initial;
    this.existingTags = existingTags;
    this.availableTasks = availableTasks;
    this.onCreateSubtask = onCreateSubtask;
  }
  resolveResult;
  result = new Promise((resolve) => this.resolveResult = resolve);
  finished = false;
  comp = new import_obsidian19.Component();
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
    let parentId = this.initial.parentId ? String(this.initial.parentId) : null;
    let dueDate = toDateKey(String(this.initial.dueDate ?? ""), String(this.initial.timeZone ?? "Asia/Tehran")) ?? "";
    let reminderTime = reminderTimeFromTask(this.initial);
    let priority = typeof this.initial.priority === "number" ? this.initial.priority : 0;
    let titleInputEl = null;
    new import_obsidian19.Setting(fields2).setName("\u{1F4DD} \u0639\u0646\u0648\u0627\u0646").addText((input) => {
      input.setValue(title).onChange((value) => title = value);
      input.inputEl.dir = "rtl";
      input.inputEl.addClass("ticktick-input-full-width");
      input.inputEl.placeholder = "\u0639\u0646\u0648\u0627\u0646 \u062A\u0633\u06A9 \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F...";
      titleInputEl = input.inputEl;
      input.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          onSave();
        }
      });
    });
    const selectedProjectName = () => this.projects.find((project) => project.id === projectId)?.name ?? "\u0627\u0646\u062A\u062E\u0627\u0628 \u067E\u0631\u0648\u0698\u0647";
    new import_obsidian19.Setting(fields2).setName("\u{1F4C2} \u067E\u0631\u0648\u0698\u0647").setDesc("\u0628\u0631\u0627\u06CC \u0627\u0646\u062A\u062E\u0627\u0628 \u067E\u0631\u0648\u0698\u0647 \u06A9\u0644\u06CC\u06A9 \u06A9\u0646.").addButton((button) => {
      button.setButtonText(selectedProjectName());
      button.buttonEl.addClass("ticktick-project-picker");
      button.buttonEl.addEventListener("click", (event) => {
        const menu = new import_obsidian19.Menu();
        this.projects.forEach((project) => menu.addItem((item) => item.setTitle(project.name).setChecked(project.id === projectId).onClick(() => {
          projectId = project.id;
          button.setButtonText(selectedProjectName());
        })));
        menu.showAtMouseEvent(event);
      });
    });
    const parentSetting = new import_obsidian19.Setting(fields2).setName("\u21B3 \u062A\u0633\u06A9 \u0648\u0627\u0644\u062F (\u0633\u0644\u0633\u0644\u0647\u200C\u0645\u0631\u0627\u062A\u0628)").setDesc("\u0627\u0646\u062A\u062E\u0627\u0628 \u0648\u0627\u0644\u062F \u0628\u0631\u0627\u06CC \u062A\u0628\u062F\u06CC\u0644 \u0628\u0647 \u0632\u06CC\u0631\u062A\u0633\u06A9 \u06CC\u0627 \u062E\u0631\u0648\u062C \u0627\u0632 \u0632\u06CC\u0631\u062A\u0633\u06A9.");
    const parentControl = parentSetting.controlEl.createDiv({ cls: "ticktick-parent-task-control" });
    const renderParentTaskUI = () => {
      parentControl.empty();
      if (parentId) {
        const parentTask = this.availableTasks.find((t) => String(t.id) === parentId);
        const parentChip = parentControl.createSpan({ cls: "ticktick-parent-task-chip" });
        const iconSpan = parentChip.createSpan({ cls: "ticktick-pill-icon" });
        (0, import_obsidian19.setIcon)(iconSpan, "corner-down-left");
        parentChip.createSpan({
          cls: "ticktick-parent-name",
          text: parentTask?.title ? `\u0648\u0627\u0644\u062F: ${cleanTaskTitle(parentTask.title)}` : `\u0648\u0627\u0644\u062F #${parentId}`
        });
        const unnestBtn = parentControl.createEl("button", {
          cls: "ticktick-parent-action-btn mod-warning",
          text: "\u2715 \u062E\u0631\u0648\u062C \u0627\u0632 \u0632\u06CC\u0631\u062A\u0633\u06A9",
          attr: { type: "button", title: "\u062A\u0628\u062F\u06CC\u0644 \u0628\u0647 \u062A\u0633\u06A9 \u0627\u0635\u0644\u06CC \u0645\u0633\u062A\u0642\u0644" }
        });
        unnestBtn.addEventListener("click", (e) => {
          e.preventDefault();
          parentId = null;
          renderParentTaskUI();
        });
      } else {
        const pickParentBtn = parentControl.createEl("button", {
          cls: "ticktick-parent-action-btn",
          text: "+ \u062A\u0628\u062F\u06CC\u0644 \u0628\u0647 \u0632\u06CC\u0631\u062A\u0633\u06A9 (\u0627\u0646\u062A\u062E\u0627\u0628 \u0648\u0627\u0644\u062F)",
          attr: { type: "button" }
        });
        const pIcon = pickParentBtn.createSpan({ cls: "ticktick-btn-icon" });
        (0, import_obsidian19.setIcon)(pIcon, "list-tree");
        pickParentBtn.addEventListener("click", (e) => {
          e.preventDefault();
          const menu = new import_obsidian19.Menu();
          const candidates = this.availableTasks.filter(
            (t) => String(t.id) !== String(this.initial.id ?? "") && (!this.initial.id || String(t.parentId ?? "") !== String(this.initial.id))
          );
          if (candidates.length === 0) {
            menu.addItem((item) => item.setTitle("\u062A\u0633\u06A9\u06CC \u0628\u0631\u0627\u06CC \u0627\u0646\u062A\u062E\u0627\u0628 \u0628\u0647 \u0639\u0646\u0648\u0627\u0646 \u0648\u0627\u0644\u062F \u06CC\u0627\u0641\u062A \u0646\u0634\u062F").setDisabled(true));
          } else {
            const projectCandidates = candidates.filter((t) => !projectId || String(t.projectId) === projectId);
            const listToShow = projectCandidates.length > 0 ? projectCandidates : candidates;
            for (const cand of listToShow.slice(0, 30)) {
              menu.addItem((item) => {
                const titleStr = cleanTaskTitle(cand.title) || `\u062A\u0633\u06A9 #${cand.id}`;
                item.setTitle(titleStr).setChecked(String(cand.id) === parentId).onClick(() => {
                  parentId = String(cand.id);
                  if (cand.projectId) {
                    projectId = String(cand.projectId);
                    const projBtn = fields2.querySelector(".ticktick-project-picker");
                    if (projBtn) projBtn.textContent = selectedProjectName();
                  }
                  renderParentTaskUI();
                });
              });
            }
          }
          menu.showAtMouseEvent(e);
        });
      }
    };
    renderParentTaskUI();
    const dateSetting = new import_obsidian19.Setting(fields2).setName("\u{1F4C5} \u062A\u0627\u0631\u06CC\u062E \u0633\u0631\u0631\u0633\u06CC\u062F (\u0634\u0645\u0633\u06CC)").setDesc("\u0627\u0646\u062A\u062E\u0627\u0628 \u062A\u0627\u0631\u06CC\u062E \u0627\u0632 \u062A\u0642\u0648\u06CC\u0645 \u0634\u0645\u0633\u06CC \u06CC\u0627 \u062A\u0627\u06CC\u067E \u062F\u0633\u062A\u06CC.");
    new JalaliDatePicker(dateSetting.controlEl, "", dueDate, (value) => dueDate = value);
    new import_obsidian19.Setting(fields2).setName("\u23F0 \u06CC\u0627\u062F\u0622\u0648\u0631\u06CC").setDesc("\u0627\u062E\u062A\u06CC\u0627\u0631\u06CC\u061B \u062F\u0631 \u0633\u0627\u0639\u062A \u0627\u0646\u062A\u062E\u0627\u0628\u200C\u0634\u062F\u0647 \u062F\u0631 \u0647\u0645\u0627\u0646 \u0631\u0648\u0632 \u06CC\u0627\u062F\u0622\u0648\u0631\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F.").addText((input) => {
      input.inputEl.type = "time";
      input.setValue(reminderTime).onChange((value) => reminderTime = value);
      input.inputEl.dir = "ltr";
    });
    const prioritySetting = new import_obsidian19.Setting(fields2).setName("\u{1F6A9} \u0627\u0648\u0644\u0648\u06CC\u062A").setDesc("\u0627\u0648\u0644\u0648\u06CC\u062A \u062A\u0633\u06A9 \u0631\u0627 \u0628\u0631\u0627\u06CC \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC \u0645\u0634\u062E\u0635 \u06A9\u0646.");
    const priorityControl = prioritySetting.controlEl.createDiv({ cls: "ticktick-priority-selector" });
    const priorityLevels = [
      { value: 0, label: "\u0639\u0627\u062F\u06CC", icon: "circle", cls: "prio-none" },
      { value: 1, label: "\u06A9\u0645", icon: "flag", cls: "prio-low" },
      { value: 3, label: "\u0645\u062A\u0648\u0633\u0637", icon: "flag", cls: "prio-med" },
      { value: 5, label: "\u0628\u0627\u0644\u0627", icon: "flag", cls: "prio-high" }
    ];
    const priorityButtons = [];
    for (const lvl of priorityLevels) {
      const btn = priorityControl.createEl("button", {
        cls: `ticktick-priority-btn ${lvl.cls} ${priority === lvl.value ? "is-active" : ""}`,
        attr: { type: "button", "aria-label": `\u0627\u0648\u0644\u0648\u06CC\u062A: ${lvl.label}` }
      });
      const iconSpan = btn.createSpan({ cls: "ticktick-priority-icon" });
      (0, import_obsidian19.setIcon)(iconSpan, lvl.icon);
      btn.createSpan({ text: lvl.label, cls: "ticktick-priority-label" });
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        priority = lvl.value;
        for (const b of priorityButtons) b.removeClass("is-active");
        btn.addClass("is-active");
      });
      priorityButtons.push(btn);
    }
    const rawInitialTags = Array.isArray(this.initial.tags) ? this.initial.tags : Array.isArray(this.initial.tagNames) ? this.initial.tagNames : [];
    let selectedTags = [...new Set(rawInitialTags.map((t) => String(t).replace(/^[#＃]/, "").trim()).filter(Boolean))];
    const allAvailableTags = [.../* @__PURE__ */ new Set([
      ...this.existingTags.map((t) => String(t).replace(/^[#＃]/, "").trim()).filter(Boolean),
      ...selectedTags
    ])].sort((a, b) => a.localeCompare(b, "fa"));
    const tagsSetting = new import_obsidian19.Setting(fields2).setName("\u{1F3F7}\uFE0F \u0628\u0631\u0686\u0633\u0628\u200C\u0647\u0627").setDesc("\u0627\u0646\u062A\u062E\u0627\u0628 \u0627\u0632 \u0628\u0631\u0686\u0633\u0628\u200C\u0647\u0627\u06CC \u0645\u0648\u062C\u0648\u062F \u06CC\u0627 \u0627\u0641\u0632\u0648\u062F\u0646 \u0628\u0631\u0686\u0633\u0628 \u062C\u062F\u06CC\u062F.");
    const tagsContainer = tagsSetting.controlEl.createDiv({ cls: "ticktick-editor-tags-container" });
    const selectedTagsList = tagsContainer.createDiv({ cls: "ticktick-selected-tags-list" });
    const addTagRow = tagsContainer.createDiv({ cls: "ticktick-add-tag-row" });
    const tagInput = addTagRow.createEl("input", {
      type: "text",
      cls: "ticktick-tag-input",
      placeholder: "\u0628\u0631\u0686\u0633\u0628 \u062C\u062F\u06CC\u062F... (Enter \u0628\u0631\u0627\u06CC \u0627\u0641\u0632\u0648\u062F\u0646)"
    });
    tagInput.dir = "rtl";
    const addTagBtn = addTagRow.createEl("button", {
      type: "button",
      cls: "ticktick-tag-add-btn",
      text: "+ \u0627\u0641\u0632\u0648\u062F\u0646"
    });
    const availableWrap = tagsContainer.createDiv({ cls: "ticktick-available-tags-wrap" });
    const renderTagsUI = () => {
      selectedTagsList.empty();
      if (selectedTags.length === 0) {
        selectedTagsList.createSpan({ cls: "ticktick-no-tags-hint", text: "\u0628\u062F\u0648\u0646 \u0628\u0631\u0686\u0633\u0628" });
      } else {
        for (const tag of selectedTags) {
          const chip = selectedTagsList.createSpan({ cls: "ticktick-selected-tag-chip" });
          chip.createSpan({ cls: "ticktick-tag-text", text: `#${tag}` });
          const removeBtn = chip.createSpan({
            cls: "ticktick-tag-remove-btn",
            attr: { role: "button", "aria-label": `\u062D\u0630\u0641 \u0628\u0631\u0686\u0633\u0628 ${tag}`, title: "\u062D\u0630\u0641" }
          });
          removeBtn.setText("\xD7");
          removeBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            selectedTags = selectedTags.filter((t) => t !== tag);
            renderTagsUI();
          });
        }
      }
      availableWrap.empty();
      if (allAvailableTags.length > 0) {
        availableWrap.createSpan({ cls: "ticktick-available-tags-title", text: "\u0628\u0631\u0686\u0633\u0628\u200C\u0647\u0627\u06CC \u0645\u0648\u062C\u0648\u062F:" });
        const availableList = availableWrap.createDiv({ cls: "ticktick-available-tags-list" });
        for (const tag of allAvailableTags) {
          const isSelected = selectedTags.includes(tag);
          const pill = availableList.createEl("button", {
            type: "button",
            cls: `ticktick-tag-pill ${isSelected ? "is-selected" : ""}`,
            attr: { "aria-pressed": isSelected ? "true" : "false" }
          });
          const iconSpan = pill.createSpan({ cls: "ticktick-pill-icon" });
          (0, import_obsidian19.setIcon)(iconSpan, isSelected ? "check" : "tag");
          pill.createSpan({ text: `#${tag}` });
          pill.addEventListener("click", (e) => {
            e.preventDefault();
            if (selectedTags.includes(tag)) {
              selectedTags = selectedTags.filter((t) => t !== tag);
            } else {
              selectedTags.push(tag);
            }
            renderTagsUI();
          });
        }
      }
    };
    const handleAddNewTag = () => {
      const raw = tagInput.value.trim().replace(/^[#＃]/, "").trim();
      if (!raw) return;
      if (!selectedTags.includes(raw)) {
        selectedTags.push(raw);
      }
      if (!allAvailableTags.includes(raw)) {
        allAvailableTags.push(raw);
        allAvailableTags.sort((a, b) => a.localeCompare(b, "fa"));
      }
      tagInput.value = "";
      renderTagsUI();
    };
    addTagBtn.addEventListener("click", (e) => {
      e.preventDefault();
      handleAddNewTag();
    });
    tagInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        handleAddNewTag();
      }
    });
    renderTagsUI();
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
      await import_obsidian19.MarkdownRenderer.render(this.app, content, previewEl, "", this.comp);
    };
    const setTab = (tab, autoFocus = false) => {
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
        if (autoFocus) {
          descTextarea.focus();
        }
      }
    };
    previewTabBtn.onclick = (e) => {
      e.preventDefault();
      setTab("preview");
    };
    editTabBtn.onclick = (e) => {
      e.preventDefault();
      setTab("edit", true);
    };
    const initialTab = description.trim() ? "preview" : "edit";
    setTab(initialTab, false);
    if (this.initial.id) {
      const currentTaskId = String(this.initial.id);
      const existingSubtasks = this.availableTasks.filter((t) => String(t.parentId) === currentTaskId);
      const subtasksSection = fields2.createDiv({ cls: "ticktick-editor-subtasks-section" });
      const subHeader = subtasksSection.createDiv({ cls: "ticktick-editor-subtasks-header" });
      subHeader.createSpan({ text: `\u{1F4D1} \u0632\u06CC\u0631\u062A\u0633\u06A9\u200C\u0647\u0627 (${existingSubtasks.length})`, cls: "ticktick-subtasks-title" });
      const subtasksList = subtasksSection.createDiv({ cls: "ticktick-editor-subtasks-list" });
      if (existingSubtasks.length === 0) {
        subtasksList.createSpan({ cls: "ticktick-no-tags-hint", text: "\u0628\u062F\u0648\u0646 \u0632\u06CC\u0631\u062A\u0633\u06A9" });
      } else {
        for (const st of existingSubtasks) {
          const itemRow = subtasksList.createDiv({ cls: "ticktick-editor-subtask-item" });
          itemRow.createSpan({ text: Number(st.status ?? 0) !== 0 ? "\u2611" : "\u2610", cls: "ticktick-subtask-check-icon" });
          itemRow.createSpan({ text: cleanTaskTitle(st.title) || "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646", cls: "ticktick-subtask-title-text" });
        }
      }
      const addSubRow = subtasksSection.createDiv({ cls: "ticktick-add-subtask-row" });
      const subInput = addSubRow.createEl("input", {
        type: "text",
        cls: "ticktick-subtask-input",
        placeholder: "\u0639\u0646\u0648\u0627\u0646 \u0632\u06CC\u0631\u062A\u0633\u06A9 \u062C\u062F\u06CC\u062F... (Enter \u0628\u0631\u0627\u06CC \u0627\u0641\u0632\u0648\u062F\u0646)"
      });
      subInput.dir = "rtl";
      const addSubBtn = addSubRow.createEl("button", {
        type: "button",
        cls: "ticktick-subtask-add-btn",
        text: "+ \u0627\u0641\u0632\u0648\u062F\u0646 \u0632\u06CC\u0631\u062A\u0633\u06A9"
      });
      const handleCreateSub = async () => {
        const subTitle = subInput.value.trim();
        if (!subTitle) return;
        addSubBtn.disabled = true;
        try {
          if (this.onCreateSubtask) {
            await this.onCreateSubtask(currentTaskId, subTitle);
            new import_obsidian19.Notice(`\u0632\u06CC\u0631\u062A\u0633\u06A9 \xAB${subTitle}\xBB \u0627\u06CC\u062C\u0627\u062F \u0634\u062F.`);
            const hint = subtasksList.querySelector(".ticktick-no-tags-hint");
            if (hint) hint.remove();
            const newSubRow = subtasksList.createDiv({ cls: "ticktick-editor-subtask-item" });
            newSubRow.createSpan({ text: "\u2610", cls: "ticktick-subtask-check-icon" });
            newSubRow.createSpan({ text: subTitle, cls: "ticktick-subtask-title-text" });
            subInput.value = "";
          }
        } catch (err) {
          new import_obsidian19.Notice(err instanceof Error ? err.message : "\u0627\u06CC\u062C\u0627\u062F \u0632\u06CC\u0631\u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
        } finally {
          addSubBtn.disabled = false;
        }
      };
      addSubBtn.addEventListener("click", (e) => {
        e.preventDefault();
        void handleCreateSub();
      });
      subInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          void handleCreateSub();
        }
      });
    }
    const onSave = () => {
      description = descTextarea.value;
      if (!title.trim() || !projectId) return new import_obsidian19.Notice("\u0639\u0646\u0648\u0627\u0646 \u0648 \u067E\u0631\u0648\u0698\u0647 \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646.");
      if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return new import_obsidian19.Notice("\u062A\u0627\u0631\u06CC\u062E \u0628\u0627\u06CC\u062F \u0628\u0647 \u0634\u06A9\u0644 YYYY-MM-DD \u0628\u0627\u0634\u062F.");
      this.finish({
        ...this.initial,
        title: title.trim(),
        desc: description.trim(),
        projectId,
        parentId: parentId || null,
        dueDate,
        reminderTime,
        priority,
        tags: selectedTags,
        tagNames: selectedTags
      });
    };
    const actions = contentEl.createDiv({ cls: "ticktick-editor-actions" });
    actions.createEl("button", { text: "\u274C \u0627\u0646\u0635\u0631\u0627\u0641" }).addEventListener("click", () => this.finish(null));
    actions.createEl("button", { text: "\u{1F4BE} \u0630\u062E\u06CC\u0631\u0647", cls: "mod-cta" }).addEventListener("click", () => onSave());
    const resetScrollToTop = () => {
      fields2.scrollTop = 0;
      contentEl.scrollTop = 0;
      this.modalEl.scrollTop = 0;
    };
    resetScrollToTop();
    window.setTimeout(() => {
      resetScrollToTop();
      if (titleInputEl) {
        titleInputEl.focus({ preventScroll: true });
        if (title.length > 0) {
          titleInputEl.select();
        }
      }
    }, 25);
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
var DeleteConfirmationModal = class extends import_obsidian19.Modal {
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
function openTaskEditor(app, projects, initial, existingTags = [], availableTasks = [], onCreateSubtask) {
  const allProjects = [{ id: "inbox", name: "\u0635\u0646\u062F\u0648\u0642 \u0648\u0631\u0648\u062F\u06CC" }, ...projects.filter((p) => p.id !== "inbox")];
  return new TaskEditorModal(app, allProjects, initial, existingTags, availableTasks, onCreateSubtask).openAndWait();
}
function confirmDelete(app, title) {
  return new DeleteConfirmationModal(app, title).openAndWait();
}

// src/obsidian/modals/quick-capture-modal.ts
var import_obsidian20 = require("obsidian");

// src/core/nlp-parser.js
init_date();
init_calendar_range();
function normalizeDigits(str) {
  return String(str ?? "").replace(/[۰-۹]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1776 + 48)).replace(/[٠-٩]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 1632 + 48));
}
function findNextWeekday(fromDay, targetWeekday, isNextWeek = false) {
  const curWeekday = weekdayIndex(fromDay);
  let delta = (targetWeekday - curWeekday + 7) % 7;
  if (delta === 0 || isNextWeek) {
    delta += 7;
  }
  return shiftCalendarDay(fromDay, delta);
}
var PERSIAN_WEEKDAYS = {
  "\u0634\u0646\u0628\u0647": 6,
  "\u06CC\u06A9\u0634\u0646\u0628\u0647": 0,
  "\u062F\u0648\u0634\u0646\u0628\u0647": 1,
  "\u0633\u0647\u200C\u0634\u0646\u0628\u0647": 2,
  "\u0686\u0647\u0627\u0631\u0634\u0646\u0628\u0647": 3,
  "\u067E\u0646\u062C\u0634\u0646\u0628\u0647": 4,
  "\u062C\u0645\u0639\u0647": 5
};
var ENGLISH_WEEKDAYS = {
  "sunday": 0,
  "sun": 0,
  "monday": 1,
  "mon": 1,
  "tuesday": 2,
  "tue": 2,
  "wednesday": 3,
  "wed": 3,
  "thursday": 4,
  "thu": 4,
  "friday": 5,
  "fri": 5,
  "saturday": 6,
  "sat": 6
};
function parseTaskNaturalLanguage(input = "", options = {}) {
  const today = options.today || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const timeZone = options.timeZone || "Asia/Tehran";
  const knownProjects = Array.isArray(options.projects) ? options.projects : [];
  let text = String(input).trim();
  if (!text) {
    return {
      title: "",
      dueDate: null,
      isAllDay: true,
      priority: 0,
      tags: [],
      projectName: null,
      projectId: null,
      chips: []
    };
  }
  const chips = [];
  let dueDate = null;
  let timeStr = null;
  let priority = 0;
  const tags = [];
  let projectName = null;
  let projectId = null;
  const prioMatch = text.match(/(?:^|\s)!(1|high|h|بالا|2|med|m|متوسط|3|low|l|کم|0|none)(?=\s|$)/i);
  if (prioMatch) {
    const raw = prioMatch[1].toLowerCase();
    text = text.replace(prioMatch[0], " ");
    if (["1", "high", "h", "\u0628\u0627\u0644\u0627"].includes(raw)) {
      priority = 5;
      chips.push({ type: "priority", label: "\u0627\u0648\u0644\u0648\u06CC\u062A \u0628\u0627\u0644\u0627", value: 5 });
    } else if (["2", "med", "m", "\u0645\u062A\u0648\u0633\u0637"].includes(raw)) {
      priority = 3;
      chips.push({ type: "priority", label: "\u0627\u0648\u0644\u0648\u06CC\u062A \u0645\u062A\u0648\u0633\u0637", value: 3 });
    } else if (["3", "low", "l", "\u06A9\u0645"].includes(raw)) {
      priority = 1;
      chips.push({ type: "priority", label: "\u0627\u0648\u0644\u0648\u06CC\u062A \u06A9\u0645", value: 1 });
    } else {
      priority = 0;
      chips.push({ type: "priority", label: "\u0628\u062F\u0648\u0646 \u0627\u0648\u0644\u0648\u06CC\u062A", value: 0 });
    }
  }
  const projMatch = text.match(/(?:^|\s)[~@](\S+)(?=\s|$)/);
  if (projMatch) {
    const rawName = projMatch[1];
    text = text.replace(projMatch[0], " ");
    const matchedProj = knownProjects.find((p) => String(p.name).toLowerCase() === rawName.toLowerCase());
    if (matchedProj) {
      projectName = matchedProj.name;
      projectId = String(matchedProj.id);
    } else {
      projectName = rawName;
    }
    chips.push({ type: "project", label: `\u067E\u0631\u0648\u0698\u0647: ${projectName}`, value: projectName });
  }
  const tagMatches = Array.from(text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)(?=\s|$)/gu));
  for (const match of tagMatches) {
    const tagName = match[1];
    if (PERSIAN_WEEKDAYS[tagName] === void 0 && ENGLISH_WEEKDAYS[tagName.toLowerCase()] === void 0) {
      tags.push(tagName);
      text = text.replace(match[0], " ");
      chips.push({ type: "tag", label: `#${tagName}`, value: tagName });
    }
  }
  const persianTimeMatch = text.match(/(?:^|\s)(?:ساعت\s*)?(\d{1,2})(?::(\d{2}))?\s*(صبح|عصر|شب|بعدازظهر)?(?=\s|$)/);
  let handledTime = false;
  const englishTimeMatch = text.match(/(?:^|\s)(?:ساعت\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=\s|$)/i);
  if (englishTimeMatch) {
    let hour = parseInt(englishTimeMatch[1], 10);
    const min = parseInt(englishTimeMatch[2] || "0", 10);
    const meridiem = englishTimeMatch[3].toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
    timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    text = text.replace(englishTimeMatch[0], " ");
    chips.push({ type: "time", label: `\u0633\u0627\u0639\u062A ${timeStr}`, value: timeStr });
    handledTime = true;
  } else {
    const time24Match = text.match(/(?:^|\s)(?:ساعت\s*)?([\d۰-۹٠-٩]{1,2}):([\d۰-۹٠-٩]{2})(?=\s|$)/);
    if (time24Match) {
      const hour = parseInt(normalizeDigits(time24Match[1]), 10);
      const min = parseInt(normalizeDigits(time24Match[2]), 10);
      if (hour >= 0 && hour <= 23 && min >= 0 && min <= 59) {
        timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        text = text.replace(time24Match[0], " ");
        chips.push({ type: "time", label: `\u0633\u0627\u0639\u062A ${timeStr}`, value: timeStr });
        handledTime = true;
      }
    }
  }
  if (!handledTime) {
    const faTimeMatch = text.match(/(?:^|\s)ساعت\s*([\d۰-۹٠-٩]{1,2})(?::([\d۰-۹٠-٩]{2}))?\s*(صبح|عصر|شب|بعدازظهر)?(?=\s|$)/);
    if (faTimeMatch) {
      let hour = parseInt(normalizeDigits(faTimeMatch[1]), 10);
      const min = parseInt(normalizeDigits(faTimeMatch[2] || "0"), 10);
      const modifier = faTimeMatch[3];
      if ((modifier === "\u0639\u0635\u0631" || modifier === "\u0634\u0628" || modifier === "\u0628\u0639\u062F\u0627\u0632\u0638\u0647\u0631") && hour < 12) {
        hour += 12;
      }
      timeStr = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
      text = text.replace(faTimeMatch[0], " ");
      chips.push({ type: "time", label: `\u0633\u0627\u0639\u062A ${timeStr}`, value: timeStr });
      handledTime = true;
    }
  }
  const pasFardaMatch = text.match(/(?:^|\s)(پس‌فردا|پس فردا)(?=\s|$)/);
  if (pasFardaMatch) {
    dueDate = shiftCalendarDay(today, 2);
    text = text.replace(pasFardaMatch[0], " ");
    chips.push({ type: "date", label: "\u067E\u0633\u200C\u0641\u0631\u062F\u0627", value: dueDate });
  } else {
    const fardaMatch = text.match(/(?:^|\s)(فردا|tomorrow)(?=\s|$)/i);
    if (fardaMatch) {
      dueDate = shiftCalendarDay(today, 1);
      text = text.replace(fardaMatch[0], " ");
      chips.push({ type: "date", label: "\u0641\u0631\u062F\u0627", value: dueDate });
    } else {
      const emroozMatch = text.match(/(?:^|\s)(امروز|today)(?=\s|$)/i);
      if (emroozMatch) {
        dueDate = today;
        text = text.replace(emroozMatch[0], " ");
        chips.push({ type: "date", label: "\u0627\u0645\u0631\u0648\u0632", value: dueDate });
      }
    }
  }
  if (!dueDate) {
    for (const [wName, wDay] of Object.entries(PERSIAN_WEEKDAYS)) {
      const nextMatch = new RegExp(`(?:^|\\s)${wName}\\s+\u0628\u0639\u062F(?=\\s|$)`, "i");
      if (nextMatch.test(text)) {
        dueDate = findNextWeekday(today, wDay, true);
        text = text.replace(nextMatch, " ");
        chips.push({ type: "date", label: `${wName} \u0628\u0639\u062F`, value: dueDate });
        break;
      }
      const regularMatch = new RegExp(`(?:^|\\s)${wName}(?=\\s|$)`, "i");
      if (regularMatch.test(text)) {
        dueDate = findNextWeekday(today, wDay, false);
        text = text.replace(regularMatch, " ");
        chips.push({ type: "date", label: wName, value: dueDate });
        break;
      }
    }
  }
  if (!dueDate) {
    for (const [wName, wDay] of Object.entries(ENGLISH_WEEKDAYS)) {
      const nextMatch = new RegExp(`(?:^|\\s)next\\s+${wName}(?=\\s|$)`, "i");
      if (nextMatch.test(text)) {
        dueDate = findNextWeekday(today, wDay, true);
        text = text.replace(nextMatch, " ");
        chips.push({ type: "date", label: `Next ${wName}`, value: dueDate });
        break;
      }
      const regularMatch = new RegExp(`(?:^|\\s)${wName}(?=\\s|$)`, "i");
      if (regularMatch.test(text)) {
        dueDate = findNextWeekday(today, wDay, false);
        text = text.replace(regularMatch, " ");
        chips.push({ type: "date", label: wName, value: dueDate });
        break;
      }
    }
  }
  const cleanTitle = text.replace(/\s+/g, " ").trim();
  const tzOffset = "+0330";
  let fullDue = null;
  let isAllDay = true;
  if (dueDate) {
    if (timeStr) {
      fullDue = `${dueDate}T${timeStr}:00${tzOffset}`;
      isAllDay = false;
    } else {
      fullDue = `${dueDate}T00:00:00${tzOffset}`;
      isAllDay = true;
    }
  }
  return {
    title: cleanTitle,
    dueDate: fullDue,
    targetDay: dueDate,
    time: timeStr,
    isAllDay,
    priority,
    tags,
    projectName,
    projectId,
    chips
  };
}

// src/obsidian/modals/quick-capture-modal.ts
init_date();
var QuickCaptureModal = class extends import_obsidian20.Modal {
  constructor(app, host) {
    super(app);
    this.host = host;
  }
  projects = [];
  inputEl;
  chipsEl;
  hintsEl;
  isSubmitting = false;
  async onOpen() {
    this.modalEl.addClass("ticktick-quick-capture-modal");
    this.titleEl.setText("\u062B\u0628\u062A \u0633\u0631\u06CC\u0639 \u062A\u0633\u06A9 (\u067E\u0631\u062F\u0627\u0632\u0634 \u0632\u0628\u0627\u0646 \u0637\u0628\u06CC\u0639\u06CC)");
    try {
      this.projects = await Promise.resolve(this.host.projects());
    } catch {
      this.projects = [];
    }
    this.render();
  }
  onClose() {
    this.contentEl.empty();
  }
  render() {
    this.contentEl.empty();
    const root = this.contentEl.createDiv({ cls: "ticktick-quick-capture-container" });
    this.inputEl = root.createEl("input", {
      type: "text",
      cls: "ticktick-quick-capture-input",
      placeholder: "\u0645\u062B\u0644\u0627\u064B: \u062C\u0644\u0633\u0647 \u0628\u0627 \u062A\u06CC\u0645 \u0641\u0631\u062F\u0627 \u0633\u0627\u0639\u062A \u06F5 \u0639\u0635\u0631 !1 #\u06A9\u0627\u0631\u06CC @\u067E\u0631\u0648\u0698\u0647"
    });
    this.chipsEl = root.createDiv({ cls: "ticktick-quick-capture-chips" });
    this.hintsEl = root.createDiv({ cls: "ticktick-quick-capture-hints" });
    this.hintsEl.createDiv({
      text: "\u{1F4A1} \u06A9\u0644\u06CC\u062F\u0648\u0627\u0698\u0647\u200C\u0647\u0627\u06CC \u0647\u0648\u0634\u0645\u0646\u062F \u0642\u0627\u0628\u0644 \u0627\u0633\u062A\u0641\u0627\u062F\u0647:",
      cls: "ticktick-quick-capture-hint-title"
    });
    const tokens = this.hintsEl.createDiv({ cls: "ticktick-quick-capture-hint-tokens" });
    tokens.createSpan({ cls: "ticktick-quick-token-badge", text: "\u0641\u0631\u062F\u0627 / \u067E\u0633\u200C\u0641\u0631\u062F\u0627 / \u0634\u0646\u0628\u0647 \u0628\u0639\u062F" });
    tokens.createSpan({ cls: "ticktick-quick-token-badge", text: "\u0633\u0627\u0639\u062A \u06F5 \u0639\u0635\u0631 / 17:00 / 9am" });
    tokens.createSpan({ cls: "ticktick-quick-token-badge", text: "!1 (\u0628\u0627\u0644\u0627) / !2 (\u0645\u062A\u0648\u0633\u0637) / !3 (\u06A9\u0645)" });
    tokens.createSpan({ cls: "ticktick-quick-token-badge", text: "#\u0628\u0631\u0686\u0633\u0628" });
    tokens.createSpan({ cls: "ticktick-quick-token-badge", text: "@\u067E\u0631\u0648\u0698\u0647 \u06CC\u0627 ~\u067E\u0631\u0648\u0698\u0647" });
    const actions = root.createDiv({ cls: "ticktick-quick-capture-actions" });
    const cancelBtn = actions.createEl("button", {
      cls: "ticktick-quick-capture-btn-cancel",
      text: "\u0627\u0646\u0635\u0631\u0627\u0641"
    });
    cancelBtn.addEventListener("click", () => this.close());
    const submitBtn = actions.createEl("button", {
      cls: "ticktick-quick-capture-btn-primary",
      text: "\u062B\u0628\u062A \u062A\u0633\u06A9 (Enter)"
    });
    submitBtn.addEventListener("click", () => void this.handleSubmit());
    this.inputEl.addEventListener("input", () => this.updateChips());
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void this.handleSubmit();
      }
    });
    window.setTimeout(() => this.inputEl.focus(), 50);
  }
  updateChips() {
    this.chipsEl.empty();
    const val = this.inputEl.value.trim();
    if (!val) return;
    const today = todayInZone(this.host.timeZone);
    const parsed = parseTaskNaturalLanguage(val, {
      today,
      timeZone: this.host.timeZone,
      projects: this.projects
    });
    for (const chip of parsed.chips) {
      const chipEl = this.chipsEl.createSpan({
        cls: `ticktick-quick-chip is-${chip.type}`
      });
      const iconSpan = chipEl.createSpan();
      switch (chip.type) {
        case "date":
          (0, import_obsidian20.setIcon)(iconSpan, "calendar");
          break;
        case "time":
          (0, import_obsidian20.setIcon)(iconSpan, "clock");
          break;
        case "priority":
          (0, import_obsidian20.setIcon)(iconSpan, "alert-circle");
          break;
        case "project":
          (0, import_obsidian20.setIcon)(iconSpan, "folder");
          break;
        case "tag":
          (0, import_obsidian20.setIcon)(iconSpan, "hash");
          break;
      }
      chipEl.createSpan({ text: chip.label });
    }
  }
  async handleSubmit() {
    if (this.isSubmitting) return;
    const val = this.inputEl.value.trim();
    if (!val) {
      new import_obsidian20.Notice("\u0644\u0637\u0641\u0627\u064B \u0639\u0646\u0648\u0627\u0646 \u062A\u0633\u06A9 \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646\u06CC\u062F.");
      return;
    }
    const today = todayInZone(this.host.timeZone);
    const parsed = parseTaskNaturalLanguage(val, {
      today,
      timeZone: this.host.timeZone,
      projects: this.projects
    });
    if (!parsed.title) {
      new import_obsidian20.Notice("\u0639\u0646\u0648\u0627\u0646 \u0645\u0639\u062A\u0628\u0631\u06CC \u0628\u0631\u0627\u06CC \u062A\u0633\u06A9 \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
      return;
    }
    this.isSubmitting = true;
    try {
      const payload = {
        title: parsed.title,
        dueDate: parsed.dueDate,
        isAllDay: parsed.isAllDay,
        priority: parsed.priority,
        tags: parsed.tags,
        projectId: parsed.projectId || void 0,
        timeZone: this.host.timeZone
      };
      await this.host.createTask(payload);
      new import_obsidian20.Notice(`\u062A\u0633\u06A9 \xAB${parsed.title}\xBB \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u062F\u0631 TickTick \u062B\u0628\u062A \u0634\u062F.`);
      this.close();
    } catch (err) {
      new import_obsidian20.Notice(err instanceof Error ? err.message : "\u062B\u0628\u062A \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      this.isSubmitting = false;
    }
  }
};

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
var import_obsidian21 = require("obsidian");
init_date();
var TodayTasksView = class extends import_obsidian21.ItemView {
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
          new import_obsidian21.Notice("\u062A\u0633\u06A9 \u0628\u0647 TickTick \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.");
          await this.render();
        } catch (error) {
          new import_obsidian21.Notice(error instanceof Error ? error.message : "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
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
        (0, import_obsidian21.setIcon)(edit, "pencil");
        const remove = actions.createEl("button", { cls: "mod-warning mod-icon", attr: { "aria-label": "\u062D\u0630\u0641" } });
        (0, import_obsidian21.setIcon)(remove, "trash-2");
        check.addEventListener("change", async () => {
          check.disabled = true;
          try {
            await this.plugin.completeTask(task);
            new import_obsidian21.Notice("\u0646\u0648\u0628\u062A \u062A\u0633\u06A9 \u062F\u0631 TickTick \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F.");
            await this.render();
          } catch (error) {
            check.checked = false;
            check.disabled = false;
            new import_obsidian21.Notice(error instanceof Error ? error.message : "\u062A\u06A9\u0645\u06CC\u0644 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
        edit.addEventListener("click", async () => {
          try {
            const projects = await client.listProjects();
            const draft = await openTaskEditor(this.app, projects, task);
            if (!draft) return;
            await this.plugin.updateTask(toTaskPayload({ ...task, ...draft }, this.plugin.settings.timeZone));
            new import_obsidian21.Notice("\u062A\u0633\u06A9 \u062F\u0631 TickTick \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u062F.");
            await this.render();
          } catch (error) {
            new import_obsidian21.Notice(error instanceof Error ? error.message : "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
        remove.addEventListener("click", async () => {
          const accepted = await confirmDelete(this.app, task.title);
          if (!accepted) return;
          try {
            await this.plugin.deleteTask(task);
            new import_obsidian21.Notice("\u062A\u0633\u06A9 \u0627\u0632 TickTick \u062D\u0630\u0641 \u0634\u062F.");
            await this.render();
          } catch (error) {
            new import_obsidian21.Notice(error instanceof Error ? error.message : "\u062D\u0630\u0641 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
      }
    } catch (error) {
      contentEl.createEl("p", { text: error instanceof Error ? error.message : "\u0627\u062A\u0635\u0627\u0644 TickTick \u0622\u0645\u0627\u062F\u0647 \u0646\u06CC\u0633\u062A." });
    }
  }
};

// src/obsidian/views/today-habits-view.ts
var import_obsidian22 = require("obsidian");
var TodayHabitsView = class extends import_obsidian22.ItemView {
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
var import_obsidian24 = require("obsidian");

// src/obsidian/components/workspace-header.ts
var import_obsidian23 = require("obsidian");
var WORKSPACE_NAV_TABS = [
  { id: "board", label: "\u06A9\u0627\u0646\u0628\u0627\u0646", icon: "kanban-square", viewType: PROJECT_BOARD_VIEW_TYPE },
  { id: "planner", label: "\u062A\u0642\u0648\u06CC\u0645", icon: "calendar", viewType: PLANNER_VIEW_TYPE },
  { id: "matrix", label: "\u0622\u06CC\u0632\u0646\u0647\u0627\u0648\u0631", icon: "grid", viewType: EISENHOWER_MATRIX_VIEW_TYPE },
  { id: "timeblock", label: "\u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC", icon: "clock", viewType: TIMEBLOCK_PLANNER_VIEW_TYPE },
  { id: "timeline", label: "\u062A\u0627\u06CC\u0645\u200C\u0644\u0627\u06CC\u0646", icon: "calendar-range", viewType: TIMELINE_VIEW_TYPE },
  { id: "review", label: "\u0645\u0631\u0648\u0631 \u0647\u0641\u062A\u06AF\u06CC", icon: "check-check", viewType: WEEKLY_REVIEW_VIEW_TYPE },
  { id: "heatmap", label: "\u0646\u0642\u0634\u0647 \u0641\u0639\u0627\u0644\u06CC\u062A", icon: "flame", viewType: HEATMAP_VIEW_TYPE }
];
var WorkspaceHeader = class {
  constructor(container, options) {
    this.container = container;
    this.options = options;
  }
  syncBtn;
  render() {
    this.container.empty();
    const header = this.container.createDiv({ cls: "ticktick-workspace-header" });
    const topBar = header.createDiv({ cls: "ticktick-workspace-topbar" });
    const brand = topBar.createDiv({ cls: "ticktick-workspace-brand" });
    const logoEl = brand.createSpan({ cls: "ticktick-workspace-brand-logo" });
    (0, import_obsidian23.setIcon)(logoEl, "check-circle-2");
    const brandTitle = brand.createSpan({ cls: "ticktick-workspace-brand-title", text: "\u0641\u0636\u0627\u06CC \u06A9\u0627\u0631 \u062A\u06CC\u06A9\u200C\u062A\u06CC\u06A9" });
    brandTitle.setAttribute("title", "\u0633\u06CC\u0633\u062A\u0645 \u06CC\u06A9\u067E\u0627\u0631\u0686\u0647 \u0645\u062F\u06CC\u0631\u06CC\u062A \u06A9\u0627\u0631 \u0648 \u062A\u0645\u0631\u06A9\u0632 TickTick Bridge");
    const actions = topBar.createDiv({ cls: "ticktick-workspace-actions" });
    const addBtn = actions.createEl("button", {
      cls: "tb-btn tb-btn-primary ticktick-workspace-quick-add tb-action-add-task",
      attr: { type: "button", "aria-label": "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u062C\u062F\u06CC\u062F", title: "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u062C\u062F\u06CC\u062F (\u06A9\u0644\u06CC\u06A9: \u0645\u0648\u062F\u0627\u0644 | \u0631\u0627\u0633\u062A\u200C\u06A9\u0644\u06CC\u06A9: \u062B\u0628\u062A \u0633\u0631\u06CC\u0639 \u0632\u0628\u0627\u0646 \u0637\u0628\u06CC\u0639\u06CC)" }
    });
    const addIcon = addBtn.createSpan();
    (0, import_obsidian23.setIcon)(addIcon, "plus");
    addBtn.createSpan({ text: "\u062A\u0633\u06A9 \u062C\u062F\u06CC\u062F" });
    addBtn.addEventListener("click", () => {
      if (this.options.onQuickAdd) {
        this.options.onQuickAdd();
      } else {
        void this.options.plugin.createTaskFromSurface();
      }
    });
    addBtn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.options.plugin.openQuickCaptureModal();
    });
    const briefingBtn = actions.createEl("button", {
      cls: "tb-btn-icon ticktick-workspace-briefing-btn",
      attr: { type: "button", "aria-label": "\u0628\u0631\u06CC\u0641\u06CC\u0646\u06AF \u0635\u0628\u062D\u06AF\u0627\u0647\u06CC \u0648 \u0627\u0647\u062F\u0627\u0641 \u0631\u0648\u0632\u0627\u0646\u0647", title: "\u0628\u0631\u06CC\u0641\u06CC\u0646\u06AF \u0635\u0628\u062D\u06AF\u0627\u0647\u06CC \u0648 \u0627\u0647\u062F\u0627\u0641 \u0631\u0648\u0632\u0627\u0646\u0647" }
    });
    const briefingIcon = briefingBtn.createSpan({ cls: "ticktick-btn-icon" });
    (0, import_obsidian23.setIcon)(briefingIcon, "sun");
    briefingBtn.addEventListener("click", () => {
      if (this.options.onMorningBriefing) {
        this.options.onMorningBriefing();
      } else {
        this.options.plugin.openMorningBriefing();
      }
    });
    this.syncBtn = actions.createEl("button", {
      cls: "tb-btn-icon ticktick-workspace-sync-btn",
      attr: { type: "button", "aria-label": "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0633\u0631\u06CC\u0639 \u0628\u0627 \u062A\u06CC\u06A9\u200C\u062A\u06CC\u06A9", title: "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0633\u0631\u06CC\u0639 \u0628\u0627 \u062A\u06CC\u06A9\u200C\u062A\u06CC\u06A9" }
    });
    const syncIcon = this.syncBtn.createSpan({ cls: "ticktick-btn-icon" });
    (0, import_obsidian23.setIcon)(syncIcon, "refresh-cw");
    this.syncBtn.addEventListener("click", async () => {
      if (this.syncBtn) {
        this.syncBtn.addClass("is-syncing");
        const iconSpan = this.syncBtn.querySelector(".ticktick-btn-icon") || this.syncBtn;
        (0, import_obsidian23.setIcon)(iconSpan, "loader-circle");
      }
      try {
        if (this.options.onSync) {
          await this.options.onSync();
        } else {
          await this.options.plugin.syncNow();
        }
      } finally {
        if (this.syncBtn) {
          this.syncBtn.removeClass("is-syncing");
          const iconSpan = this.syncBtn.querySelector(".ticktick-btn-icon") || this.syncBtn;
          (0, import_obsidian23.setIcon)(iconSpan, "refresh-cw");
        }
      }
    });
    const tabsBar = header.createDiv({ cls: "ticktick-workspace-tabs-bar" });
    const navWrapper = tabsBar.createDiv({ cls: "ticktick-workspace-nav-wrapper" });
    const segmentedControl = navWrapper.createDiv({
      cls: "tb-segmented-control",
      attr: { role: "tablist", "aria-label": "\u0646\u0645\u0627\u0647\u0627\u06CC \u0641\u0636\u0627\u06CC \u06A9\u0627\u0631 \u062A\u06CC\u06A9\u200C\u062A\u06CC\u06A9" }
    });
    tabsBar.addEventListener(
      "wheel",
      (e) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaY !== 0) {
          e.preventDefault();
          const isRtl = window.getComputedStyle(navWrapper).direction === "rtl";
          const scrollAmount = isRtl ? -e.deltaY : e.deltaY;
          navWrapper.scrollBy({ left: scrollAmount, behavior: "auto" });
        }
      },
      { passive: false }
    );
    let isTouchDragging = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let isHorizontalSwipe = false;
    tabsBar.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        isTouchDragging = false;
        isHorizontalSwipe = false;
      },
      { passive: true }
    );
    tabsBar.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        if (!isHorizontalSwipe && Math.abs(dx) > 4 && Math.abs(dx) > Math.abs(dy)) {
          isHorizontalSwipe = true;
        }
        if (isHorizontalSwipe) {
          e.stopPropagation();
          if (Math.abs(dx) > 6) {
            isTouchDragging = true;
          }
        }
      },
      { passive: false }
    );
    const onTouchEnd = () => {
      if (isTouchDragging) {
        setTimeout(() => {
          isTouchDragging = false;
          isHorizontalSwipe = false;
        }, 120);
      } else {
        isTouchDragging = false;
        isHorizontalSwipe = false;
      }
    };
    tabsBar.addEventListener("touchend", onTouchEnd, { passive: true });
    tabsBar.addEventListener("touchcancel", onTouchEnd, { passive: true });
    let isMouseDown = false;
    let mouseStartX = 0;
    let mouseStartScrollLeft = 0;
    let isMouseDragging = false;
    navWrapper.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      isMouseDown = true;
      mouseStartX = e.clientX;
      mouseStartScrollLeft = navWrapper.scrollLeft;
      isMouseDragging = false;
      const onWindowMouseMove = (moveEv) => {
        if (!isMouseDown) return;
        const dx = moveEv.clientX - mouseStartX;
        if (Math.abs(dx) > 5) {
          isMouseDragging = true;
          navWrapper.scrollLeft = mouseStartScrollLeft - dx;
        }
      };
      const onWindowMouseUp = () => {
        isMouseDown = false;
        window.removeEventListener("mousemove", onWindowMouseMove);
        window.removeEventListener("mouseup", onWindowMouseUp);
        if (isMouseDragging) {
          setTimeout(() => {
            isMouseDragging = false;
          }, 80);
        }
      };
      window.addEventListener("mousemove", onWindowMouseMove);
      window.addEventListener("mouseup", onWindowMouseUp);
    });
    let activeTabEl = null;
    const tabElements = [];
    for (const tab of WORKSPACE_NAV_TABS) {
      const isActive = tab.viewType === this.options.activeViewType;
      const tabBtn = segmentedControl.createEl("button", {
        cls: `tb-segment-item ${isActive ? "is-active" : ""}`,
        attr: {
          type: "button",
          role: "tab",
          "aria-selected": isActive ? "true" : "false",
          "aria-label": `\u0646\u0645\u0627\u06CC ${tab.label}`,
          tabindex: isActive ? "0" : "-1"
        }
      });
      tabElements.push(tabBtn);
      const iconSpan = tabBtn.createSpan({ cls: "tb-segment-icon" });
      (0, import_obsidian23.setIcon)(iconSpan, tab.icon);
      tabBtn.createSpan({ cls: "tb-segment-label", text: tab.label });
      if (isActive) {
        activeTabEl = tabBtn;
        tabBtn.addEventListener("click", (e) => {
          if (isTouchDragging || isMouseDragging) {
            e.preventDefault();
            e.stopPropagation();
          }
        });
      } else {
        tabBtn.addEventListener("click", async (e) => {
          if (isTouchDragging || isMouseDragging) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          e.preventDefault();
          try {
            await this.options.leaf.setViewState({ type: tab.viewType, active: true });
          } catch (err) {
            new import_obsidian23.Notice(`\u062E\u0637\u0627 \u062F\u0631 \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u0646\u0645\u0627\u06CC ${tab.label}: ${String(err)}`);
          }
        });
      }
      tabBtn.addEventListener("keydown", (e) => {
        const index = tabElements.indexOf(tabBtn);
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          const next = (index + 1) % tabElements.length;
          tabElements[next]?.focus();
          tabElements[next]?.click();
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          const prev = (index - 1 + tabElements.length) % tabElements.length;
          tabElements[prev]?.focus();
          tabElements[prev]?.click();
        }
      });
    }
    if (activeTabEl) {
      window.requestAnimationFrame(() => {
        try {
          const navRect = navWrapper.getBoundingClientRect();
          const tabRect = activeTabEl?.getBoundingClientRect();
          if (tabRect && navRect) {
            if (tabRect.left < navRect.left) {
              navWrapper.scrollBy({ left: tabRect.left - navRect.left - 16, behavior: "smooth" });
            } else if (tabRect.right > navRect.right) {
              navWrapper.scrollBy({ left: tabRect.right - navRect.right + 16, behavior: "smooth" });
            }
          }
        } catch {
          activeTabEl?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        }
      });
    }
    const viewRoot = this.container.closest(".ticktick-workspace-view-root") ?? this.container;
    attachHorizontalSwipeGuard(viewRoot);
    return header;
  }
};
function attachHorizontalSwipeGuard(rootEl) {
  if (!rootEl || rootEl._tbSwipeGuardAttached) {
    return;
  }
  rootEl._tbSwipeGuardAttached = true;
  let startX = 0;
  let startY = 0;
  let isHorizontal = false;
  rootEl.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isHorizontal = false;
    },
    { passive: true }
  );
  rootEl.addEventListener(
    "touchmove",
    (e) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (!isHorizontal && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
        isHorizontal = true;
      }
      if (isHorizontal) {
        const target = e.target;
        const scrollableAncestor = target?.closest(
          ".ticktick-workspace-tabs-bar, .ticktick-workspace-nav-wrapper, .tb-segmented-control, .ticktick-project-columns, .ticktick-planner-days, .ticktick-planner-month, .ticktick-planner-days-scroll, .ticktick-planner-month-scroll, .overview-calendar, .ticktick-backlog-cards, .ticktick-timeblock-actions, .ticktick-timeblock-grid, .ticktick-activity-heatmap-scroll, .ticktick-review-horizontal-scroll, [data-horizontal-scroll]"
        );
        if (scrollableAncestor) {
          e.stopPropagation();
        }
      }
    },
    { passive: false }
  );
  const reset = () => {
    isHorizontal = false;
  };
  rootEl.addEventListener("touchend", reset, { passive: true });
  rootEl.addEventListener("touchcancel", reset, { passive: true });
}
function renderWorkspaceHeader(container, options) {
  const header = new WorkspaceHeader(container, options);
  header.render();
  return header;
}

// src/obsidian/views/planning-view.ts
var PlanningView = class extends import_obsidian24.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  planner;
  headerSlot;
  bodySlot;
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
    this.contentEl.addClass("ticktick-workspace-view-root");
    this.contentEl.addClass("ticktick-planner-panel");
    if (!this.headerSlot || !this.bodySlot) {
      this.contentEl.empty();
      this.headerSlot = this.contentEl.createDiv({ cls: "ticktick-workspace-header-slot" });
      this.bodySlot = this.contentEl.createDiv({ cls: "ticktick-workspace-body-slot" });
      renderWorkspaceHeader(this.headerSlot, {
        plugin: this.plugin,
        leaf: this.leaf,
        activeViewType: this.getViewType()
      });
      this.planner = new PlanningCalendar(this.bodySlot, this.plugin.plannerHost());
    }
    await this.planner?.render();
  }
  async onClose() {
    this.planner = void 0;
    this.headerSlot = void 0;
    this.bodySlot = void 0;
  }
};

// src/obsidian/views/project-board-view.ts
var import_obsidian25 = require("obsidian");
var ProjectBoardView = class extends import_obsidian25.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  board;
  headerSlot;
  bodySlot;
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
    this.contentEl.addClass("ticktick-workspace-view-root");
    this.contentEl.addClass("ticktick-project-board-panel");
    if (!this.headerSlot || !this.bodySlot) {
      this.contentEl.empty();
      this.headerSlot = this.contentEl.createDiv({ cls: "ticktick-workspace-header-slot" });
      this.bodySlot = this.contentEl.createDiv({ cls: "ticktick-workspace-body-slot" });
      renderWorkspaceHeader(this.headerSlot, {
        plugin: this.plugin,
        leaf: this.leaf,
        activeViewType: this.getViewType()
      });
      this.board = new ProjectBoard(this.bodySlot, this.plugin.projectBoardHost());
    }
    await this.board?.render();
  }
  async onClose() {
    this.board = void 0;
    this.headerSlot = void 0;
    this.bodySlot = void 0;
  }
};

// src/obsidian/views/ticktick-control-view.ts
var import_obsidian26 = require("obsidian");
var TickTickControlView = class extends import_obsidian26.ItemView {
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
      (0, import_obsidian26.setIcon)(icon, iconName);
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
      (0, import_obsidian26.setIcon)(hIcon, "arrow-down-up");
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
      (0, import_obsidian26.setIcon)(hIcon, "file-text");
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
      (0, import_obsidian26.setIcon)(hIcon, "list-checks");
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
      (0, import_obsidian26.setIcon)(hIcon, "bar-chart-2");
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
    (0, import_obsidian26.setIcon)(btnIcon, iconName);
    button.createSpan({ text: label });
    button.addEventListener("click", async () => {
      button.disabled = true;
      btnIcon.addClass("is-spinning");
      try {
        await action();
      } catch (error) {
        new import_obsidian26.Notice(error instanceof Error ? error.message : "\u0639\u0645\u0644\u06CC\u0627\u062A \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      } finally {
        button.disabled = false;
        btnIcon.removeClass("is-spinning");
      }
    });
  }
};

// src/obsidian/views/project-timeline-view.ts
var import_obsidian27 = require("obsidian");
var ProjectTimelineView = class extends import_obsidian27.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  timeline;
  headerSlot;
  bodySlot;
  getViewType() {
    return TIMELINE_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u062A\u0627\u06CC\u0645\u200C\u0644\u0627\u06CC\u0646 \u0648 \u06AF\u0627\u0646\u062A \u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627\u06CC TickTick";
  }
  getIcon() {
    return "calendar-range";
  }
  async onOpen() {
    await this.render();
  }
  async render() {
    this.contentEl.addClass("ticktick-workspace-view-root");
    this.contentEl.addClass("ticktick-timeline-panel");
    if (!this.headerSlot || !this.bodySlot) {
      this.contentEl.empty();
      this.headerSlot = this.contentEl.createDiv({ cls: "ticktick-workspace-header-slot" });
      this.bodySlot = this.contentEl.createDiv({ cls: "ticktick-workspace-body-slot" });
      renderWorkspaceHeader(this.headerSlot, {
        plugin: this.plugin,
        leaf: this.leaf,
        activeViewType: this.getViewType()
      });
      this.timeline = new ProjectTimeline(this.bodySlot, this.plugin.timelineHost());
    }
    await this.timeline?.render();
  }
  async onClose() {
    this.timeline = void 0;
    this.headerSlot = void 0;
    this.bodySlot = void 0;
  }
};

// src/obsidian/views/weekly-review-view.ts
var import_obsidian29 = require("obsidian");

// src/obsidian/weekly-review.ts
var import_obsidian28 = require("obsidian");
init_date();

// src/core/weekly-review.js
init_date();
init_calendar_range();
function computeWeeklyReviewRange(anchorDay, weekOffset = 0) {
  const targetDay = weekOffset !== 0 ? shiftCalendarDay(anchorDay, weekOffset * 7) : anchorDay;
  const days = weekRange(targetDay, 6);
  const start = days[0];
  const end = days[6];
  return {
    start,
    // Saturday (YYYY-MM-DD)
    end,
    // Friday (YYYY-MM-DD)
    days,
    previousWeekAnchor: shiftCalendarDay(start, -7),
    nextWeekAnchor: shiftCalendarDay(start, 7)
  };
}
function computeWeeklyReviewMetrics(tasks = [], weekRange2, options = {}) {
  const timeZone = options.timeZone || "Asia/Tehran";
  const today = options.today || todayInZone(timeZone);
  const { start, end } = weekRange2;
  const completed = [];
  const scheduledInWeek = [];
  const overdue = [];
  const moved = [];
  const unscheduled = [];
  const tagCounts = /* @__PURE__ */ new Map();
  for (const task of tasks) {
    if (!task) continue;
    const isCompleted = Number(task.status ?? 0) !== 0;
    const dueDay = toDateKey(task.dueDate, task.timeZone || timeZone);
    const startDay = toDateKey(task.startDate, task.timeZone || timeZone);
    const completionDay = toDateKey(task.completedTime, task.timeZone || timeZone) || dueDay;
    if (isCompleted) {
      if (completionDay && completionDay >= start && completionDay <= end) {
        completed.push(task);
        recordTags(task.tags, tagCounts);
      }
      continue;
    }
    if (!dueDay && !startDay) {
      unscheduled.push(task);
      continue;
    }
    const effectiveDue = dueDay || startDay;
    if (effectiveDue && effectiveDue < today) {
      overdue.push(task);
      recordTags(task.tags, tagCounts);
    }
    const taskStart = startDay || dueDay;
    const taskEnd = dueDay || startDay;
    const intersectsWeek = taskStart <= end && taskEnd >= start;
    if (intersectsWeek) {
      scheduledInWeek.push(task);
      recordTags(task.tags, tagCounts);
      const modifiedDay = toDateKey(task.modifiedTime, task.timeZone || timeZone);
      const isMoved = taskStart && taskEnd && taskStart !== taskEnd || modifiedDay && effectiveDue && modifiedDay > effectiveDue || Array.isArray(task.tags) && task.tags.some((t) => ["moved", "rescheduled", "postponed"].includes(String(t).toLowerCase()));
      if (isMoved) {
        moved.push(task);
      }
    }
  }
  const mostUsedTags = Array.from(tagCounts.entries()).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count);
  const totalReviewed = completed.length + scheduledInWeek.length;
  const completionRate = totalReviewed > 0 ? Math.round(completed.length / totalReviewed * 100) : 0;
  return {
    weekRange: { start, end },
    today,
    completed,
    scheduledInWeek,
    overdue,
    moved,
    unscheduled,
    mostUsedTags,
    summary: {
      completedCount: completed.length,
      scheduledCount: scheduledInWeek.length,
      overdueCount: overdue.length,
      movedCount: moved.length,
      unscheduledCount: unscheduled.length,
      totalReviewed,
      completionRate
    }
  };
}
function planMoveOverdueAction(overdueTasks = [], targetDay) {
  if (!targetDay) throw new Error("\u062A\u0627\u0631\u06CC\u062E \u0645\u0642\u0635\u062F \u0628\u0631\u0627\u06CC \u0627\u0646\u062A\u0642\u0627\u0644 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0645\u0639\u0648\u0642 \u0645\u0634\u062E\u0635 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.");
  return {
    operationType: "schedule-date",
    parameters: { targetDay },
    tasks: overdueTasks,
    description: `\u0627\u0646\u062A\u0642\u0627\u0644 ${overdueTasks.length} \u062A\u0633\u06A9 \u0645\u0639\u0648\u0642 \u0628\u0647 \u062A\u0627\u0631\u06CC\u062E ${targetDay}`
  };
}
function planClearWeeklyAction(scheduledTasks = []) {
  return {
    operationType: "clear-date",
    parameters: {},
    tasks: scheduledTasks,
    description: `\u0644\u063A\u0648 \u062A\u0627\u0631\u06CC\u062E \u0648 \u0627\u0646\u062A\u0642\u0627\u0644 ${scheduledTasks.length} \u062A\u0633\u06A9 \u0627\u06CC\u0646 \u0647\u0641\u062A\u0647 \u0628\u0647 \u0628\u06A9\u200C\u0644\u0627\u06AF`
  };
}
function planNextWeekAction(tasksToPlan = [], nextWeekStart) {
  if (!nextWeekStart) throw new Error("\u062A\u0627\u0631\u06CC\u062E \u0622\u063A\u0627\u0632 \u0647\u0641\u062A\u0647 \u0622\u06CC\u0646\u062F\u0647 \u0645\u0634\u062E\u0635 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.");
  return {
    operationType: "schedule-date",
    parameters: { targetDay: nextWeekStart },
    tasks: tasksToPlan,
    description: `\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC ${tasksToPlan.length} \u062A\u0633\u06A9 \u0628\u0631\u0627\u06CC \u0622\u063A\u0627\u0632 \u0647\u0641\u062A\u0647 \u0622\u06CC\u0646\u062F\u0647 (${nextWeekStart})`
  };
}
function recordTags(tags, map) {
  if (!Array.isArray(tags)) return;
  for (const tag of tags) {
    if (!tag) continue;
    const clean = String(tag).trim().replace(/^#/, "");
    if (!clean) continue;
    map.set(clean, (map.get(clean) || 0) + 1);
  }
}

// src/obsidian/weekly-review.ts
var WeeklyReview = class {
  constructor(element, host) {
    this.element = element;
    this.host = host;
    this.element.addClass("ticktick-weekly-review-root");
    this.element.style.direction = "rtl";
  }
  weekOffset = 0;
  activeTab = "completed";
  selectedTagFilter = null;
  isSyncing = false;
  bulkActionBar = null;
  destroy() {
    this.bulkActionBar?.destroy();
    this.bulkActionBar = null;
    this.element.empty();
  }
  async render() {
    this.element.empty();
    const today = todayInZone(this.host.timeZone);
    const range = computeWeeklyReviewRange(today, this.weekOffset);
    const allTasks = this.host.tasks();
    const metrics = computeWeeklyReviewMetrics(allTasks, range, { today, timeZone: this.host.timeZone });
    this.renderHeader(range, today);
    this.renderMetricsCards(metrics, today, range.nextWeekAnchor);
    this.renderTagsSection(metrics.mostUsedTags);
    this.renderTabsAndTaskList(metrics);
    this.bulkActionBar ??= new BulkActionBar(this.element, {
      app: this.host.app,
      timeZone: this.host.timeZone,
      tasks: () => this.host.tasks(),
      projects: () => this.host.projects(),
      executeBulkOperation: async (ids, op, params) => this.host.executeBulkOperation(ids, op, params),
      onChanged: async () => {
        await this.render();
      }
    });
    void this.bulkActionBar.render();
  }
  renderHeader(range, today) {
    const header = this.element.createDiv({ cls: "ticktick-review-header" });
    const titleGroup = header.createDiv({ cls: "ticktick-review-title-group" });
    const iconSpan = titleGroup.createSpan({ cls: "ticktick-review-main-icon mod-icon" });
    (0, import_obsidian28.setIcon)(iconSpan, "bar-chart-2");
    titleGroup.createEl("h2", { text: "\u0645\u0631\u0648\u0631 \u0647\u0641\u062A\u06AF\u06CC \u0648 \u062F\u0627\u0634\u0628\u0648\u0631\u062F \u0627\u062C\u0631\u0627" });
    const navGroup = header.createDiv({ cls: "ticktick-review-nav-group" });
    const prevBtn = navGroup.createEl("button", {
      cls: "ticktick-review-nav-btn mod-icon",
      attr: { "aria-label": "\u0647\u0641\u062A\u0647 \u0642\u0628\u0644" }
    });
    (0, import_obsidian28.setIcon)(prevBtn, "chevron-right");
    prevBtn.addEventListener("click", () => {
      this.weekOffset--;
      void this.render();
    });
    const dateLabel = navGroup.createSpan({ cls: "ticktick-review-week-label" });
    dateLabel.setText(`${formatPersianDate(range.start)} \u062A\u0627 ${formatPersianDate(range.end)}`);
    const nextBtn = navGroup.createEl("button", {
      cls: "ticktick-review-nav-btn mod-icon",
      attr: { "aria-label": "\u0647\u0641\u062A\u0647 \u0628\u0639\u062F" }
    });
    (0, import_obsidian28.setIcon)(nextBtn, "chevron-left");
    nextBtn.addEventListener("click", () => {
      this.weekOffset++;
      void this.render();
    });
    if (this.weekOffset !== 0) {
      const todayBtn = navGroup.createEl("button", {
        cls: "ticktick-review-today-btn",
        text: "\u0627\u06CC\u0646 \u0647\u0641\u062A\u0647"
      });
      todayBtn.addEventListener("click", () => {
        this.weekOffset = 0;
        void this.render();
      });
    }
    const syncGroup = header.createDiv({ cls: "ticktick-review-sync-group" });
    const savedAt = this.host.savedAt();
    let statusText = "\u062F\u0627\u062F\u0647\u200C\u0647\u0627 \u0627\u0632 \u06A9\u0634 \u0645\u062D\u0644\u06CC";
    if (savedAt) {
      const dt = new Date(savedAt);
      if (!Number.isNaN(dt.getTime())) {
        statusText = `\u062F\u0627\u062F\u0647\u200C\u0647\u0627 \u062A\u0627: ${dt.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}`;
      }
    }
    syncGroup.createSpan({ cls: "ticktick-review-saved-at", text: statusText });
    const syncBtn = syncGroup.createEl("button", {
      cls: `ticktick-review-sync-btn ${this.isSyncing ? "is-syncing" : ""}`,
      attr: { "aria-label": "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u062F\u0633\u062A\u06CC" }
    });
    const syncIcon = syncBtn.createSpan({ cls: "mod-icon" });
    (0, import_obsidian28.setIcon)(syncIcon, "refresh-cw");
    syncBtn.createSpan({ text: "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC" });
    syncBtn.addEventListener("click", async () => {
      if (this.isSyncing) return;
      this.isSyncing = true;
      syncBtn.addClass("is-syncing");
      new import_obsidian28.Notice("\u062F\u0631 \u062D\u0627\u0644 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0628\u0627 TickTick...");
      try {
        await this.host.refresh();
        new import_obsidian28.Notice("\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u0646\u062C\u0627\u0645 \u0634\u062F.");
      } catch (err) {
        new import_obsidian28.Notice(`\u062E\u0637\u0627 \u062F\u0631 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        this.isSyncing = false;
        syncBtn.removeClass("is-syncing");
        await this.render();
      }
    });
  }
  renderMetricsCards(metrics, today, nextWeekStart) {
    const grid = this.element.createDiv({ cls: "ticktick-review-cards-grid" });
    const completedCard = grid.createDiv({ cls: "ticktick-metric-card mod-completed" });
    const compHeader = completedCard.createDiv({ cls: "ticktick-metric-header" });
    compHeader.createSpan({ cls: "ticktick-metric-title", text: "\u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647 \u062F\u0631 \u0627\u06CC\u0646 \u0647\u0641\u062A\u0647" });
    const compIcon = compHeader.createSpan({ cls: "mod-icon" });
    (0, import_obsidian28.setIcon)(compIcon, "check-circle-2");
    const compBody = completedCard.createDiv({ cls: "ticktick-metric-body" });
    compBody.createDiv({ cls: "ticktick-metric-val", text: String(metrics.summary.completedCount) });
    const compRate = compBody.createDiv({ cls: "ticktick-metric-badge", text: `\u0646\u0631\u062E \u0627\u0646\u062C\u0627\u0645: ${metrics.summary.completionRate}\u066A` });
    const progBar = completedCard.createDiv({ cls: "ticktick-metric-progress" });
    const progFill = progBar.createDiv({ cls: "ticktick-metric-progress-fill" });
    progFill.style.width = `${metrics.summary.completionRate}%`;
    const overdueCard = grid.createDiv({ cls: "ticktick-metric-card mod-overdue" });
    const ovHeader = overdueCard.createDiv({ cls: "ticktick-metric-header" });
    ovHeader.createSpan({ cls: "ticktick-metric-title", text: "\u0645\u0639\u0648\u0642 / \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u067E\u06CC\u06AF\u06CC\u0631\u06CC" });
    const ovIcon = ovHeader.createSpan({ cls: "mod-icon" });
    (0, import_obsidian28.setIcon)(ovIcon, "alert-circle");
    const ovBody = overdueCard.createDiv({ cls: "ticktick-metric-body" });
    ovBody.createDiv({ cls: "ticktick-metric-val", text: String(metrics.summary.overdueCount) });
    ovBody.createDiv({ cls: "ticktick-metric-sub", text: "\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u06AF\u0630\u0634\u062A\u0647 \u0627\u0632 \u0633\u0631\u0631\u0633\u06CC\u062F" });
    const moveOvBtn = overdueCard.createEl("button", {
      cls: "ticktick-metric-action-btn",
      text: "\u0627\u0646\u062A\u0642\u0627\u0644 \u0645\u0639\u0648\u0642\u200C\u0647\u0627 \u0628\u0647 \u0627\u0645\u0631\u0648\u0632"
    });
    moveOvBtn.addEventListener("click", () => void this.actionMoveOverdue(metrics.overdue, today));
    const schedCard = grid.createDiv({ cls: "ticktick-metric-card mod-scheduled" });
    const scHeader = schedCard.createDiv({ cls: "ticktick-metric-header" });
    scHeader.createSpan({ cls: "ticktick-metric-title", text: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC \u0627\u06CC\u0646 \u0647\u0641\u062A\u0647" });
    const scIcon = scHeader.createSpan({ cls: "mod-icon" });
    (0, import_obsidian28.setIcon)(scIcon, "calendar");
    const scBody = schedCard.createDiv({ cls: "ticktick-metric-body" });
    scBody.createDiv({ cls: "ticktick-metric-val", text: String(metrics.summary.scheduledCount) });
    scBody.createDiv({ cls: "ticktick-metric-sub", text: `${metrics.summary.movedCount} \u062A\u0633\u06A9 \u0628\u0627\u0632\u0647\u200C\u062F\u0627\u0631 \u06CC\u0627 \u062C\u0627\u0628\u062C\u0627\u0634\u062F\u0647` });
    const clearSchedBtn = schedCard.createEl("button", {
      cls: "ticktick-metric-action-btn",
      text: "\u067E\u0627\u06A9\u0633\u0627\u0632\u06CC \u0628\u0631\u0646\u0627\u0645\u0647 \u0627\u06CC\u0646 \u0647\u0641\u062A\u0647"
    });
    clearSchedBtn.addEventListener("click", () => void this.actionClearWeekly(metrics.scheduledInWeek));
    const backlogCard = grid.createDiv({ cls: "ticktick-metric-card mod-unscheduled" });
    const blHeader = backlogCard.createDiv({ cls: "ticktick-metric-header" });
    blHeader.createSpan({ cls: "ticktick-metric-title", text: "\u0628\u06A9\u200C\u0644\u0627\u06AF / \u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E" });
    const blIcon = blHeader.createSpan({ cls: "mod-icon" });
    (0, import_obsidian28.setIcon)(blIcon, "inbox");
    const blBody = backlogCard.createDiv({ cls: "ticktick-metric-body" });
    blBody.createDiv({ cls: "ticktick-metric-val", text: String(metrics.summary.unscheduledCount) });
    blBody.createDiv({ cls: "ticktick-metric-sub", text: "\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E \u0645\u0634\u062E\u0635" });
    const planNextBtn = backlogCard.createEl("button", {
      cls: "ticktick-metric-action-btn",
      text: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC \u0647\u0641\u062A\u0647 \u0622\u06CC\u0646\u062F\u0647"
    });
    planNextBtn.addEventListener("click", () => void this.actionPlanNextWeek(metrics.unscheduled, nextWeekStart));
  }
  renderTagsSection(tags) {
    if (!tags.length) return;
    const section = this.element.createDiv({ cls: "ticktick-review-tags-section" });
    const title = section.createDiv({ cls: "ticktick-review-tags-title" });
    const tagIcon = title.createSpan({ cls: "mod-icon" });
    (0, import_obsidian28.setIcon)(tagIcon, "tag");
    title.createSpan({ text: "\u067E\u0631\u062A\u06A9\u0631\u0627\u0631\u062A\u0631\u06CC\u0646 \u0628\u0631\u0686\u0633\u0628\u200C\u0647\u0627\u06CC \u0647\u0641\u062A\u0647:" });
    const list = section.createDiv({ cls: "ticktick-review-tags-list" });
    if (this.selectedTagFilter) {
      const allTagPill = list.createEl("button", {
        cls: "ticktick-review-tag-pill mod-clear",
        text: "\u0646\u0645\u0627\u06CC\u0634 \u0647\u0645\u0647"
      });
      allTagPill.addEventListener("click", () => {
        this.selectedTagFilter = null;
        void this.render();
      });
    }
    for (const item of tags.slice(0, 10)) {
      const isSelected = this.selectedTagFilter === item.tag;
      const pill = list.createEl("button", {
        cls: `ticktick-review-tag-pill ${isSelected ? "is-selected" : ""}`,
        text: `#${item.tag} (${item.count})`
      });
      pill.addEventListener("click", () => {
        this.selectedTagFilter = isSelected ? null : item.tag;
        void this.render();
      });
    }
  }
  renderTabsAndTaskList(metrics) {
    const container = this.element.createDiv({ cls: "ticktick-review-tasks-container" });
    const tabBar = container.createDiv({ cls: "ticktick-review-tabs-bar" });
    const tabs = [
      { id: "completed", label: "\u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647", count: metrics.completed.length },
      { id: "overdue", label: "\u0645\u0639\u0648\u0642", count: metrics.overdue.length },
      { id: "scheduled", label: "\u0628\u0631\u0646\u0627\u0645\u0647 \u0647\u0641\u062A\u06AF\u06CC", count: metrics.scheduledInWeek.length },
      { id: "moved", label: "\u062C\u0627\u0628\u062C\u0627\u0634\u062F\u0647 / \u0628\u0627\u0632\u0647\u200C\u062F\u0627\u0631", count: metrics.moved.length },
      { id: "unscheduled", label: "\u0628\u06A9\u200C\u0644\u0627\u06AF", count: metrics.unscheduled.length }
    ];
    for (const tab of tabs) {
      const tabBtn = tabBar.createEl("button", {
        cls: `ticktick-review-tab-btn ${this.activeTab === tab.id ? "is-active" : ""}`
      });
      tabBtn.createSpan({ text: tab.label });
      tabBtn.createSpan({ cls: "ticktick-review-tab-count", text: String(tab.count) });
      tabBtn.addEventListener("click", () => {
        this.activeTab = tab.id;
        void this.render();
      });
    }
    const listWrapper = container.createDiv({ cls: "ticktick-review-task-list" });
    let tasksToShow = [];
    switch (this.activeTab) {
      case "completed":
        tasksToShow = metrics.completed;
        break;
      case "overdue":
        tasksToShow = metrics.overdue;
        break;
      case "scheduled":
        tasksToShow = metrics.scheduledInWeek;
        break;
      case "moved":
        tasksToShow = metrics.moved;
        break;
      case "unscheduled":
        tasksToShow = metrics.unscheduled;
        break;
    }
    if (this.selectedTagFilter) {
      tasksToShow = tasksToShow.filter((t) => Array.isArray(t.tags) && t.tags.some((tag) => String(tag).trim().replace(/^#/, "") === this.selectedTagFilter));
    }
    if (tasksToShow.length === 0) {
      const emptyBox = listWrapper.createDiv({ cls: "ticktick-review-empty" });
      const emptyIcon = emptyBox.createSpan({ cls: "mod-icon" });
      (0, import_obsidian28.setIcon)(emptyIcon, "inbox");
      emptyBox.createSpan({ text: "\u062A\u0633\u06A9\u06CC \u062F\u0631 \u0627\u06CC\u0646 \u0628\u062E\u0634 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F." });
      return;
    }
    for (const task of tasksToShow) {
      this.renderTaskRow(listWrapper, task);
    }
  }
  renderTaskRow(parent, task) {
    const priority = taskPriority(task.priority);
    const isCompleted = Number(task.status ?? 0) !== 0;
    const row = parent.createDiv({
      cls: `ticktick-review-task-row priority-${priority.value} ${isCompleted ? "is-completed" : ""}`,
      attr: {
        role: "button",
        tabindex: "0"
      }
    });
    row.dataset.taskId = String(task.id);
    if (bulkSelectionStore.isSelected(String(task.id))) {
      row.addClass("is-bulk-selected");
    }
    const checkWrap = row.createDiv({ cls: "ticktick-review-task-check" });
    const check = checkWrap.createEl("input", { type: "checkbox" });
    check.checked = isCompleted;
    check.addEventListener("mousedown", (e) => e.stopPropagation());
    check.addEventListener("click", (e) => e.stopPropagation());
    check.addEventListener("change", async () => {
      check.disabled = true;
      try {
        if (check.checked) {
          await this.host.complete(task);
        } else {
          await this.host.executeBulkOperation([String(task.id)], "reopen", {});
        }
        await this.render();
      } catch (err) {
        new import_obsidian28.Notice(`\u062E\u0637\u0627 \u062F\u0631 \u062A\u063A\u06CC\u06CC\u0631 \u0648\u0636\u0639\u06CC\u062A: ${err instanceof Error ? err.message : String(err)}`);
        check.checked = !check.checked;
        check.disabled = false;
      }
    });
    const body = row.createDiv({ cls: "ticktick-review-task-body" });
    body.createSpan({ cls: "ticktick-review-task-title", text: task.title || "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646" });
    const meta = row.createDiv({ cls: "ticktick-review-task-meta" });
    if (task.projectName) {
      meta.createSpan({ cls: "ticktick-review-task-proj", text: task.projectName });
    }
    if (task.dueDate) {
      meta.createSpan({
        cls: "ticktick-review-task-date",
        text: formatPersianDate(task.dueDate, this.host.timeZone)
      });
    }
    if (task.parentId) {
      meta.createSpan({ cls: "ticktick-review-task-proj", text: "\u21B3 \u0632\u06CC\u0631\u062A\u0633\u06A9" });
    }
    const estText = formatTaskEstimate(task);
    if (estText) {
      meta.createSpan({ cls: "ticktick-review-task-date", text: estText });
    }
    if (Array.isArray(task.blockedBy) && task.blockedBy.length > 0) {
      meta.createSpan({ cls: "ticktick-review-task-tag", text: "\u26D4 \u0648\u0627\u0628\u0633\u062A\u0647" });
    }
    if (Array.isArray(task.tags) && task.tags.length > 0) {
      for (const tag of task.tags.slice(0, 3)) {
        meta.createSpan({ cls: "ticktick-review-task-tag", text: `#${tag}` });
      }
    }
    const openDetails = () => new TaskDetailsModal(this.host.app, task, {
      complete: () => this.host.complete(task),
      load: (item) => this.host.load(item),
      edit: (item) => this.host.edit(item),
      changed: async () => {
        await this.render();
      },
      allTasks: () => this.host.tasks()
    }).open();
    row.addEventListener("click", (e) => {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        bulkSelectionStore.toggle(String(task.id));
        return;
      }
      openDetails();
    });
    row.addEventListener("keydown", (e) => {
      if (e.key === "x" || (e.key === "Enter" || e.key === " ") && (e.shiftKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        bulkSelectionStore.toggle(String(task.id));
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDetails();
      }
    });
  }
  // Action 1: Move Overdue to Today
  async actionMoveOverdue(overdueTasks, today) {
    if (!overdueTasks.length) {
      new import_obsidian28.Notice("\u0647\u06CC\u0686 \u062A\u0633\u06A9 \u0645\u0639\u0648\u0642\u06CC \u0628\u0631\u0627\u06CC \u0627\u0646\u062A\u0642\u0627\u0644 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.");
      return;
    }
    const plan = planMoveOverdueAction(overdueTasks, today);
    const confirmed = await new BulkConfirmModal(this.host.app, overdueTasks, {
      title: "\u0627\u0646\u062A\u0642\u0627\u0644 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0645\u0639\u0648\u0642 \u0628\u0647 \u0627\u0645\u0631\u0648\u0632",
      description: `\u0622\u06CC\u0627 \u0645\u0627\u06CC\u0644\u06CC\u062F \u062A\u0627\u0631\u06CC\u062E \u0633\u0631\u0631\u0633\u06CC\u062F ${overdueTasks.length} \u062A\u0633\u06A9 \u0645\u0639\u0648\u0642 \u0632\u06CC\u0631 \u0631\u0627 \u0628\u0647 \u0627\u0645\u0631\u0648\u0632 (${formatPersianDate(today)}) \u0645\u0646\u062A\u0642\u0644 \u06A9\u0646\u06CC\u062F\u061F`,
      confirmLabel: "\u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u0647 \u0627\u0645\u0631\u0648\u0632",
      isDestructive: false
    }).openAndWait();
    if (confirmed) {
      await this.host.executeBulkOperation(overdueTasks.map((t) => String(t.id)), plan.operationType, plan.parameters);
      await this.render();
    }
  }
  // Action 2: Clear Weekly Plan
  async actionClearWeekly(scheduledTasks) {
    if (!scheduledTasks.length) {
      new import_obsidian28.Notice("\u0647\u06CC\u0686 \u062A\u0633\u06A9 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC\u200C\u0634\u062F\u0647\u200C\u0627\u06CC \u062F\u0631 \u0627\u06CC\u0646 \u0647\u0641\u062A\u0647 \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.");
      return;
    }
    const plan = planClearWeeklyAction(scheduledTasks);
    const confirmed = await new BulkConfirmModal(this.host.app, scheduledTasks, {
      title: "\u067E\u0627\u06A9\u0633\u0627\u0632\u06CC \u0628\u0631\u0646\u0627\u0645\u0647 \u0627\u06CC\u0646 \u0647\u0641\u062A\u0647",
      description: `\u0622\u06CC\u0627 \u0645\u0627\u06CC\u0644\u06CC\u062F \u062A\u0627\u0631\u06CC\u062E \u0633\u0631\u0631\u0633\u06CC\u062F ${scheduledTasks.length} \u062A\u0633\u06A9 \u0627\u06CC\u0646 \u0647\u0641\u062A\u0647 \u0631\u0627 \u0644\u063A\u0648 \u06A9\u0631\u062F\u0647 \u0648 \u0622\u0646\u200C\u0647\u0627 \u0631\u0627 \u0628\u0647 \u0628\u06A9\u200C\u0644\u0627\u06AF \u0645\u0646\u062A\u0642\u0644 \u06A9\u0646\u06CC\u062F\u061F`,
      confirmLabel: "\u067E\u0627\u06A9\u0633\u0627\u0632\u06CC \u0648 \u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u0647 \u0628\u06A9\u200C\u0644\u0627\u06AF",
      isDestructive: false
    }).openAndWait();
    if (confirmed) {
      await this.host.executeBulkOperation(scheduledTasks.map((t) => String(t.id)), plan.operationType, plan.parameters);
      await this.render();
    }
  }
  // Action 3: Plan Next Week
  async actionPlanNextWeek(backlogTasks, nextWeekStart) {
    if (!backlogTasks.length) {
      new import_obsidian28.Notice("\u0647\u06CC\u0686 \u062A\u0633\u06A9 \u0628\u062F\u0648\u0646 \u062A\u0627\u0631\u06CC\u062E\u06CC \u062F\u0631 \u0628\u06A9\u200C\u0644\u0627\u06AF \u0628\u0631\u0627\u06CC \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC \u0647\u0641\u062A\u0647 \u0622\u06CC\u0646\u062F\u0647 \u0645\u0648\u062C\u0648\u062F \u0646\u06CC\u0633\u062A.");
      return;
    }
    const candidates = backlogTasks.slice(0, 10);
    const plan = planNextWeekAction(candidates, nextWeekStart);
    const confirmed = await new BulkConfirmModal(this.host.app, candidates, {
      title: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC \u0628\u0631\u0627\u06CC \u0622\u063A\u0627\u0632 \u0647\u0641\u062A\u0647 \u0622\u06CC\u0646\u062F\u0647",
      description: `\u0622\u06CC\u0627 \u0645\u0627\u06CC\u0644\u06CC\u062F ${candidates.length} \u062A\u0633\u06A9 \u0646\u0645\u0648\u0646\u0647 \u0627\u0632 \u0628\u06A9\u200C\u0644\u0627\u06AF \u0631\u0627 \u0628\u0631\u0627\u06CC \u0631\u0648\u0632 \u0634\u0646\u0628\u0647 \u0647\u0641\u062A\u0647 \u0622\u06CC\u0646\u062F\u0647 (${formatPersianDate(nextWeekStart)}) \u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC \u06A9\u0646\u06CC\u062F\u061F`,
      confirmLabel: "\u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC \u0628\u0631\u0627\u06CC \u0634\u0646\u0628\u0647 \u0628\u0639\u062F",
      isDestructive: false
    }).openAndWait();
    if (confirmed) {
      await this.host.executeBulkOperation(candidates.map((t) => String(t.id)), plan.operationType, plan.parameters);
      await this.render();
    }
  }
};

// src/obsidian/views/weekly-review-view.ts
var WeeklyReviewView = class extends import_obsidian29.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  review;
  headerSlot;
  bodySlot;
  getViewType() {
    return WEEKLY_REVIEW_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u0645\u0631\u0648\u0631 \u0647\u0641\u062A\u06AF\u06CC \u0648 \u062F\u0627\u0634\u0628\u0648\u0631\u062F \u0627\u062C\u0631\u0627";
  }
  getIcon() {
    return "check-check";
  }
  async onOpen() {
    await this.render();
  }
  async render() {
    this.contentEl.addClass("ticktick-workspace-view-root");
    this.contentEl.addClass("ticktick-weekly-review-panel");
    if (!this.headerSlot || !this.bodySlot) {
      this.contentEl.empty();
      this.headerSlot = this.contentEl.createDiv({ cls: "ticktick-workspace-header-slot" });
      this.bodySlot = this.contentEl.createDiv({ cls: "ticktick-workspace-body-slot" });
      renderWorkspaceHeader(this.headerSlot, {
        plugin: this.plugin,
        leaf: this.leaf,
        activeViewType: this.getViewType()
      });
      this.review = new WeeklyReview(this.bodySlot, this.plugin.weeklyReviewHost());
    }
    await this.review?.render();
  }
  async onClose() {
    this.review?.destroy();
    this.review = void 0;
    this.headerSlot = void 0;
    this.bodySlot = void 0;
  }
};

// src/obsidian/views/eisenhower-matrix-view.ts
var import_obsidian31 = require("obsidian");

// src/obsidian/eisenhower-matrix.ts
var import_obsidian30 = require("obsidian");

// src/core/eisenhower-matrix.js
init_date();
init_calendar_range();
var QUADRANT_IDS = ["q1", "q2", "q3", "q4"];
var QUADRANTS = {
  q1: {
    id: "q1",
    title: "\u0627\u0642\u062F\u0627\u0645 \u0641\u0648\u0631\u06CC (Do First)",
    subtitle: "\u0641\u0648\u0631\u06CC \u0648 \u0645\u0647\u0645",
    shortName: "\u0641\u0648\u0631\u06CC \u0648 \u0645\u0647\u0645",
    color: "var(--text-error, #d32f2f)",
    accentBg: "rgba(211, 47, 47, 0.08)",
    icon: "alert-triangle"
  },
  q2: {
    id: "q2",
    title: "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC (Schedule)",
    subtitle: "\u0645\u0647\u0645 \u0648 \u063A\u06CC\u0631\u0641\u0648\u0631\u06CC",
    shortName: "\u0645\u0647\u0645 / \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC",
    color: "var(--interactive-accent, #1976d2)",
    accentBg: "rgba(25, 118, 210, 0.08)",
    icon: "calendar"
  },
  q3: {
    id: "q3",
    title: "\u0648\u0627\u06AF\u0630\u0627\u0631\u06CC / \u0627\u0642\u062F\u0627\u0645 \u0633\u0631\u06CC\u0639 (Delegate)",
    subtitle: "\u0641\u0648\u0631\u06CC \u0648 \u063A\u06CC\u0631\u0645\u0647\u0645",
    shortName: "\u0641\u0648\u0631\u06CC / \u0648\u0627\u06AF\u0630\u0627\u0631\u06CC",
    color: "var(--text-warning, #f57c00)",
    accentBg: "rgba(245, 124, 0, 0.08)",
    icon: "users"
  },
  q4: {
    id: "q4",
    title: "\u062D\u0630\u0641 / \u0628\u06A9\u200C\u0644\u0627\u06AF (Eliminate)",
    subtitle: "\u0646\u0647 \u0641\u0648\u0631\u06CC \u0648 \u0646\u0647 \u0645\u0647\u0645",
    shortName: "\u0628\u06A9\u200C\u0644\u0627\u06AF / \u06A9\u0645\u200C\u0627\u0648\u0644\u0648\u06CC\u062A",
    color: "var(--text-muted, #757575)",
    accentBg: "rgba(117, 117, 117, 0.08)",
    icon: "archive"
  }
};
function isTaskUrgent(task, today, timeZone = "Asia/Tehran", thresholdDays = 2) {
  if (!task) return false;
  const dueDay = toDateKey(task.dueDate || task.startDate, task.timeZone || timeZone);
  if (!dueDay) return false;
  const urgentThreshold = shiftCalendarDay(today, thresholdDays);
  return dueDay <= urgentThreshold;
}
function isTaskImportant(task) {
  if (!task) return false;
  const priority = Number(task.priority ?? 0);
  if (priority >= 3) return true;
  if (Array.isArray(task.tags)) {
    const importantTags = ["important", "\u0645\u0647\u0645", "priority", "critical"];
    return task.tags.some((t) => importantTags.includes(String(t).toLowerCase().replace(/^#/, "")));
  }
  return false;
}
function partitionEisenhowerMatrix(tasks = [], options = {}) {
  const timeZone = options.timeZone || "Asia/Tehran";
  const today = options.today || todayInZone(timeZone);
  const thresholdDays = Number(options.thresholdDays ?? 2);
  const q1 = [];
  const q2 = [];
  const q3 = [];
  const q4 = [];
  const completed = [];
  for (const task of tasks) {
    if (!task) continue;
    const isCompleted = Number(task.status ?? 0) !== 0;
    if (isCompleted) {
      completed.push(task);
      continue;
    }
    const urgent = isTaskUrgent(task, today, timeZone, thresholdDays);
    const important = isTaskImportant(task);
    if (important && urgent) {
      q1.push(task);
    } else if (important && !urgent) {
      q2.push(task);
    } else if (!important && urgent) {
      q3.push(task);
    } else {
      q4.push(task);
    }
  }
  const sortFn = (a, b) => {
    const pA = Number(a.priority ?? 0);
    const pB = Number(b.priority ?? 0);
    if (pB !== pA) return pB - pA;
    const dA = String(a.dueDate ?? "9999");
    const dB = String(b.dueDate ?? "9999");
    return dA.localeCompare(dB);
  };
  q1.sort(sortFn);
  q2.sort(sortFn);
  q3.sort(sortFn);
  q4.sort(sortFn);
  return {
    today,
    q1,
    q2,
    q3,
    q4,
    completed,
    counts: {
      q1: q1.length,
      q2: q2.length,
      q3: q3.length,
      q4: q4.length,
      completed: completed.length,
      totalOpen: q1.length + q2.length + q3.length + q4.length
    }
  };
}
function computeQuadrantDropMutation(task, targetQuadrant, today, timeZone = "Asia/Tehran") {
  if (!task || !QUADRANT_IDS.includes(targetQuadrant)) return null;
  const tzOffset = "+0330";
  const currentDue = toDateKey(task.dueDate, task.timeZone || timeZone);
  switch (targetQuadrant) {
    case "q1": {
      const due = currentDue && currentDue <= today ? currentDue : today;
      return {
        id: String(task.id),
        projectId: task.projectId,
        priority: 5,
        dueDate: `${due}T00:00:00${tzOffset}`,
        isAllDay: true
      };
    }
    case "q2": {
      const targetDay = currentDue && currentDue > shiftCalendarDay(today, 2) ? currentDue : shiftCalendarDay(today, 3);
      return {
        id: String(task.id),
        projectId: task.projectId,
        priority: 5,
        dueDate: `${targetDay}T00:00:00${tzOffset}`,
        isAllDay: true
      };
    }
    case "q3": {
      const due = currentDue && currentDue <= today ? currentDue : today;
      return {
        id: String(task.id),
        projectId: task.projectId,
        priority: 1,
        dueDate: `${due}T00:00:00${tzOffset}`,
        isAllDay: true
      };
    }
    case "q4": {
      return {
        id: String(task.id),
        projectId: task.projectId,
        priority: 0,
        dueDate: null,
        startDate: null,
        isAllDay: true
      };
    }
    default:
      return null;
  }
}

// src/obsidian/eisenhower-matrix.ts
init_date();
init_calendar_range();
var EisenhowerMatrix = class {
  constructor(element, host) {
    this.element = element;
    this.host = host;
    this.element.addClass("ticktick-matrix-root");
    this.element.style.direction = "rtl";
    this.unsubscribeSelection = bulkSelectionStore.subscribe(() => {
      this.updateSelectionClasses();
    });
  }
  searchFilter = "";
  selectedProjectId = "";
  bulkActionBar = null;
  unsubscribeSelection = null;
  isMutating = false;
  destroy() {
    this.unsubscribeSelection?.();
    this.unsubscribeSelection = null;
    this.bulkActionBar?.destroy();
    this.bulkActionBar = null;
    this.element.empty();
  }
  async render() {
    this.element.empty();
    const today = todayInZone(this.host.timeZone);
    let allTasks = this.host.tasks();
    if (this.selectedProjectId) {
      allTasks = allTasks.filter((t) => String(t.projectId) === this.selectedProjectId);
    }
    if (this.searchFilter.trim()) {
      const q = this.searchFilter.trim().toLowerCase();
      allTasks = allTasks.filter((t) => {
        const title2 = String(t.title ?? "").toLowerCase();
        const desc = String(t.content ?? "").toLowerCase();
        const tags = Array.isArray(t.tags) ? t.tags.join(" ").toLowerCase() : "";
        return title2.includes(q) || desc.includes(q) || tags.includes(q);
      });
    }
    const matrixData = partitionEisenhowerMatrix(allTasks, {
      today,
      timeZone: this.host.timeZone
    });
    const toolbar = this.element.createDiv({ cls: "ticktick-matrix-toolbar" });
    const titleGroup = toolbar.createDiv({ cls: "ticktick-matrix-toolbar-title-group" });
    const title = titleGroup.createDiv({ cls: "ticktick-matrix-toolbar-title" });
    const iconEl = title.createSpan();
    (0, import_obsidian30.setIcon)(iconEl, "grid");
    title.createSpan({ text: "\u0645\u0627\u062A\u0631\u06CC\u0633 \u062A\u0635\u0645\u06CC\u0645\u200C\u06AF\u06CC\u0631\u06CC \u0622\u06CC\u0632\u0646\u0647\u0627\u0648\u0631" });
    const totalPill = titleGroup.createSpan({ cls: "ticktick-matrix-total-pill" });
    totalPill.setText(`${matrixData.counts.totalOpen} \u062A\u0633\u06A9 \u0641\u0639\u0627\u0644`);
    const controls = toolbar.createDiv({ cls: "ticktick-matrix-toolbar-controls" });
    const searchInput = controls.createEl("input", {
      type: "search",
      cls: "ticktick-matrix-search-input",
      placeholder: "\u062C\u0633\u062A\u062C\u0648 \u062F\u0631 \u0645\u0627\u062A\u0631\u06CC\u0633\u2026"
    });
    searchInput.value = this.searchFilter;
    searchInput.addEventListener("input", () => {
      this.searchFilter = searchInput.value;
      void this.render();
    });
    const projectSelect = controls.createEl("select", { cls: "ticktick-matrix-project-select" });
    const defaultOpt = projectSelect.createEl("option", { text: "\u0647\u0645\u0647\u0654 \u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627", value: "" });
    defaultOpt.selected = !this.selectedProjectId;
    Promise.resolve(this.host.projects()).then((projects) => {
      if (Array.isArray(projects)) {
        for (const proj of projects) {
          const opt = projectSelect.createEl("option", { text: proj.name, value: String(proj.id) });
          if (String(proj.id) === this.selectedProjectId) opt.selected = true;
        }
      }
    });
    projectSelect.addEventListener("change", () => {
      this.selectedProjectId = projectSelect.value;
      void this.render();
    });
    const refreshBtn = controls.createEl("button", { cls: "ticktick-matrix-btn" });
    const refreshIcon = refreshBtn.createSpan();
    (0, import_obsidian30.setIcon)(refreshIcon, "refresh-cw");
    refreshBtn.createSpan({ text: "\u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC" });
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      try {
        await this.host.refresh();
        await this.render();
      } finally {
        refreshBtn.disabled = false;
      }
    });
    const addBtn = controls.createEl("button", {
      cls: "ticktick-matrix-btn ticktick-matrix-btn-accent ticktick-matrix-add-btn tb-action-add-task",
      attr: { type: "button", "aria-label": "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u062C\u062F\u06CC\u062F" }
    });
    const addIcon = addBtn.createSpan();
    (0, import_obsidian30.setIcon)(addIcon, "plus");
    addBtn.createSpan({ text: "+ \u062A\u0633\u06A9 \u062C\u062F\u06CC\u062F" });
    addBtn.addEventListener("click", () => {
      void this.promptAddTask("q1", today);
    });
    const grid = this.element.createDiv({ cls: "ticktick-matrix-grid" });
    this.renderQuadrant(grid, "q1", matrixData.q1, today);
    this.renderQuadrant(grid, "q2", matrixData.q2, today);
    this.renderQuadrant(grid, "q3", matrixData.q3, today);
    this.renderQuadrant(grid, "q4", matrixData.q4, today);
    if (this.host.executeBulkOperation) {
      this.bulkActionBar = new BulkActionBar(this.element, {
        app: this.host.app,
        timeZone: this.host.timeZone,
        tasks: () => this.host.tasks(),
        projects: () => this.host.projects(),
        executeBulkOperation: this.host.executeBulkOperation,
        onChanged: async () => {
          await this.render();
        }
      });
      await this.bulkActionBar.render();
    }
    this.updateSelectionClasses();
  }
  renderQuadrant(grid, qid, tasks, today) {
    const meta = QUADRANTS[qid];
    const quad = grid.createDiv({ cls: `ticktick-matrix-quadrant is-${qid}` });
    quad.dataset.quadrantId = qid;
    const header = quad.createDiv({ cls: "ticktick-matrix-quadrant-header" });
    const titleGroup = header.createDiv({ cls: "ticktick-matrix-quadrant-title-group" });
    const badge = titleGroup.createSpan({ cls: "ticktick-matrix-quadrant-badge" });
    badge.setText(qid.toUpperCase());
    const namesDiv = titleGroup.createDiv();
    const nameEl = namesDiv.createDiv({ cls: "ticktick-matrix-quadrant-name" });
    nameEl.setText(meta.title);
    const descEl = namesDiv.createDiv({ cls: "ticktick-matrix-quadrant-desc" });
    descEl.setText(meta.subtitle);
    const actions = header.createDiv({ cls: "ticktick-matrix-quadrant-actions" });
    const countBadge = actions.createSpan({ cls: "ticktick-matrix-count-badge" });
    countBadge.setText(String(tasks.length));
    const addBtn = actions.createEl("button", {
      cls: "ticktick-matrix-quadrant-add-btn",
      attr: { "aria-label": `\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0628\u0647 ${meta.shortName}`, title: `\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0628\u0647 ${meta.shortName}` }
    });
    (0, import_obsidian30.setIcon)(addBtn, "plus");
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      void this.promptAddTask(qid, today);
    });
    const list = quad.createDiv({ cls: "ticktick-matrix-task-list" });
    quad.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }
      quad.addClass("is-drag-over");
    });
    quad.addEventListener("dragleave", (e) => {
      const rect = quad.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX >= rect.right || e.clientY < rect.top || e.clientY >= rect.bottom) {
        quad.removeClass("is-drag-over");
      }
    });
    quad.addEventListener("drop", async (e) => {
      e.preventDefault();
      quad.removeClass("is-drag-over");
      const taskId = e.dataTransfer?.getData("application/x-ticktick-task-id") || e.dataTransfer?.getData("text/plain");
      if (!taskId) return;
      await this.handleDropOnQuadrant(taskId, qid, today);
    });
    if (tasks.length === 0) {
      const empty = list.createDiv({ cls: "ticktick-matrix-empty" });
      empty.setText("\u062A\u0633\u06A9\u06CC \u062F\u0631 \u0627\u06CC\u0646 \u0628\u062E\u0634 \u0646\u06CC\u0633\u062A");
      return;
    }
    for (const task of tasks) {
      this.renderTaskCard(list, task, qid, today);
    }
  }
  renderTaskCard(list, task, qid, today) {
    const card = renderTaskCard(list, {
      task,
      timeZone: this.host.timeZone,
      movable: true,
      dragType: "application/x-ticktick-task-id",
      variant: "matrix",
      onComplete: async (t) => {
        try {
          await this.host.complete(t);
          new import_obsidian30.Notice(`\u062A\u0633\u06A9 \xAB${cleanTaskTitle(t.title)}\xBB \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F.`);
          await this.render();
        } catch (err) {
          new import_obsidian30.Notice(err instanceof Error ? err.message : "\u062A\u06A9\u0645\u06CC\u0644 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
        }
      },
      onOpenDetails: (t) => {
        new TaskDetailsModal(this.host.app, t, {
          edit: this.host.edit,
          load: this.host.load,
          complete: async () => {
            await this.host.complete(t);
            await this.render();
          },
          changed: async () => {
            await this.render();
          }
        }).open();
      },
      onToggleBulkSelect: (id) => {
        bulkSelectionStore.toggle(id);
      }
    });
    card.addClass("ticktick-matrix-card");
    card.dataset.quadrant = qid;
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer?.setData("text/plain", String(task.id));
      e.dataTransfer?.setData("application/x-ticktick-task-id", String(task.id));
    });
  }
  async handleDropOnQuadrant(taskId, targetQuadrant, today) {
    if (this.isMutating) return;
    this.isMutating = true;
    try {
      const allTasks = this.host.tasks();
      const taskMap = new Map(allTasks.map((t) => [String(t.id), t]));
      const draggedTask = taskMap.get(taskId);
      if (!draggedTask) return;
      const selected = bulkSelectionStore.getSelection();
      const isSelected = selected.includes(taskId);
      const targetTasks = isSelected && selected.length > 1 ? selected.map((id) => taskMap.get(id)).filter(Boolean) : [draggedTask];
      for (const t of targetTasks) {
        const mutation = computeQuadrantDropMutation(t, targetQuadrant, today, this.host.timeZone);
        if (mutation) {
          await this.host.updateTask(mutation);
        }
      }
      const qMeta = QUADRANTS[targetQuadrant];
      if (targetTasks.length > 1) {
        new import_obsidian30.Notice(`${targetTasks.length} \u062A\u0633\u06A9 \u0628\u0647 \u0628\u062E\u0634 \xAB${qMeta.shortName}\xBB \u0645\u0646\u062A\u0642\u0644 \u0634\u062F\u0646\u062F.`);
        bulkSelectionStore.clear();
      } else {
        new import_obsidian30.Notice(`\u062A\u0633\u06A9 \xAB${cleanTaskTitle(draggedTask.title)}\xBB \u0628\u0647 \xAB${qMeta.shortName}\xBB \u0645\u0646\u062A\u0642\u0644 \u0634\u062F.`);
      }
      await this.render();
    } catch (err) {
      new import_obsidian30.Notice(err instanceof Error ? err.message : "\u0627\u0646\u062A\u0642\u0627\u0644 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    } finally {
      this.isMutating = false;
    }
  }
  async promptAddTask(qid, today) {
    if (!this.host.createTask) {
      new import_obsidian30.Notice("\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u062F\u0631 \u0627\u06CC\u0646 \u0645\u062D\u06CC\u0637 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u06CC \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.");
      return;
    }
    let initial = {};
    switch (qid) {
      case "q1":
        initial = { priority: 5, dueDate: today };
        break;
      case "q2":
        initial = { priority: 5, dueDate: shiftCalendarDay(today, 3) };
        break;
      case "q3":
        initial = { priority: 1, dueDate: today };
        break;
      case "q4":
        initial = { priority: 0 };
        break;
    }
    try {
      await this.host.createTask(initial);
      await this.render();
    } catch (err) {
      new import_obsidian30.Notice(err instanceof Error ? err.message : "\u0627\u06CC\u062C\u0627\u062F \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    }
  }
  updateSelectionClasses() {
    const selected = new Set(bulkSelectionStore.getSelection());
    const cards = this.element.querySelectorAll(".ticktick-matrix-card");
    cards.forEach((card) => {
      const tid = card.dataset.taskId;
      if (tid && selected.has(tid)) {
        card.addClass("is-selected");
      } else {
        card.removeClass("is-selected");
      }
    });
  }
};

// src/obsidian/views/eisenhower-matrix-view.ts
var EisenhowerMatrixView = class extends import_obsidian31.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  matrix;
  headerSlot;
  bodySlot;
  getViewType() {
    return EISENHOWER_MATRIX_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u0645\u0627\u062A\u0631\u06CC\u0633 \u062A\u0635\u0645\u06CC\u0645\u200C\u06AF\u06CC\u0631\u06CC \u0622\u06CC\u0632\u0646\u0647\u0627\u0648\u0631";
  }
  getIcon() {
    return "grid";
  }
  async onOpen() {
    await this.render();
  }
  async render() {
    this.contentEl.addClass("ticktick-workspace-view-root");
    this.contentEl.addClass("ticktick-matrix-view-container");
    if (!this.headerSlot || !this.bodySlot) {
      this.contentEl.empty();
      this.headerSlot = this.contentEl.createDiv({ cls: "ticktick-workspace-header-slot" });
      this.bodySlot = this.contentEl.createDiv({ cls: "ticktick-workspace-body-slot" });
      renderWorkspaceHeader(this.headerSlot, {
        plugin: this.plugin,
        leaf: this.leaf,
        activeViewType: this.getViewType()
      });
      this.matrix = new EisenhowerMatrix(this.bodySlot, this.plugin.eisenhowerMatrixHost());
    }
    await this.matrix?.render();
  }
  async onClose() {
    this.matrix?.destroy();
    this.matrix = void 0;
    this.headerSlot = void 0;
    this.bodySlot = void 0;
  }
};

// src/obsidian/views/timeblocking-planner-view.ts
var import_obsidian33 = require("obsidian");

// src/obsidian/timeblocking-planner.ts
var import_obsidian32 = require("obsidian");

// src/core/timeblocking.js
init_date();
function timeStringToMinutes(str) {
  if (!str) return null;
  const match = String(str).match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}
function minutesToTimeString(totalMinutes) {
  const clamped = Math.max(0, Math.min(1439, Math.floor(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function extractTaskTimeRange(task, targetDay, options = {}) {
  const defaultDuration = Number(options.defaultDurationMinutes ?? 45);
  const timeZone = options.timeZone || "Asia/Tehran";
  if (!task) return null;
  if (task.isAllDay) return null;
  const startDay = toDateKey(task.startDate, task.timeZone || timeZone);
  const dueDay = toDateKey(task.dueDate, task.timeZone || timeZone);
  const touchesTarget = startDay === targetDay || dueDay === targetDay || !startDay && dueDay === targetDay;
  if (!touchesTarget) return null;
  const startMin = timeStringToMinutes(task.startDate);
  const dueMin = timeStringToMinutes(task.dueDate);
  if (startMin === null && dueMin === null) return null;
  let start = 0;
  let end = 0;
  if (startMin !== null && dueMin !== null) {
    if (startDay === targetDay && dueDay === targetDay) {
      start = startMin;
      end = Math.max(start + 15, dueMin);
    } else if (startDay === targetDay) {
      start = startMin;
      end = 24 * 60;
    } else {
      start = 0;
      end = dueMin;
    }
  } else if (startMin !== null) {
    start = startMin;
    end = Math.min(24 * 60, start + defaultDuration);
  } else {
    start = Math.max(0, dueMin - defaultDuration);
    end = dueMin;
  }
  const duration = Math.max(15, end - start);
  return {
    startMinutes: start,
    endMinutes: end,
    durationMinutes: duration,
    startTime: minutesToTimeString(start),
    endTime: minutesToTimeString(end)
  };
}
function computeDayTimeSlots(tasks = [], targetDay, options = {}) {
  const startHour = Number(options.startHour ?? 7);
  const endHour = Number(options.endHour ?? 23);
  const slotMinutes = Number(options.slotMinutes ?? 30);
  const timeZone = options.timeZone || "Asia/Tehran";
  const dayStartMinutes = startHour * 60;
  const dayEndMinutes = (endHour + 1) * 60;
  const totalSlots = Math.ceil((dayEndMinutes - dayStartMinutes) / slotMinutes);
  const slots = [];
  for (let i = 0; i < totalSlots; i++) {
    const slotMin = dayStartMinutes + i * slotMinutes;
    slots.push({
      index: i + 1,
      // 1-based for CSS Grid
      startMinutes: slotMin,
      endMinutes: slotMin + slotMinutes,
      timeLabel: minutesToTimeString(slotMin),
      isHourMark: slotMin % 60 === 0
    });
  }
  const timed = [];
  const untimed = [];
  const overdue = [];
  for (const task of tasks) {
    if (!task) continue;
    const isCompleted = Number(task.status ?? 0) !== 0;
    if (isCompleted) continue;
    const dueDay = toDateKey(task.dueDate, task.timeZone || timeZone);
    const startDay = toDateKey(task.startDate, task.timeZone || timeZone);
    if (dueDay && dueDay < targetDay) {
      overdue.push(task);
      continue;
    }
    if (dueDay === targetDay || startDay === targetDay) {
      const range = extractTaskTimeRange(task, targetDay, { timeZone });
      if (range) {
        const effectiveStart = Math.max(dayStartMinutes, Math.min(dayEndMinutes - 15, range.startMinutes));
        const effectiveEnd = Math.max(effectiveStart + 15, Math.min(dayEndMinutes, range.endMinutes));
        const rowStart = Math.floor((effectiveStart - dayStartMinutes) / slotMinutes) + 1;
        const rowSpan = Math.max(1, Math.ceil((effectiveEnd - effectiveStart) / slotMinutes));
        timed.push({
          task,
          range,
          effectiveStart,
          effectiveEnd,
          rowStart,
          rowSpan,
          laneIndex: 0,
          totalLanes: 1
        });
      } else {
        untimed.push(task);
      }
    }
  }
  timed.sort((a, b) => a.effectiveStart - b.effectiveStart || b.effectiveEnd - a.effectiveEnd);
  const activeLanes = [];
  for (const item of timed) {
    let placed = false;
    for (let lane = 0; lane < activeLanes.length; lane++) {
      if (activeLanes[lane] <= item.effectiveStart) {
        item.laneIndex = lane;
        activeLanes[lane] = item.effectiveEnd;
        placed = true;
        break;
      }
    }
    if (!placed) {
      item.laneIndex = activeLanes.length;
      activeLanes.push(item.effectiveEnd);
    }
  }
  for (let i = 0; i < timed.length; i++) {
    const cur = timed[i];
    let maxLane = cur.laneIndex;
    for (let j = 0; j < timed.length; j++) {
      if (i === j) continue;
      const other = timed[j];
      const overlaps = Math.max(cur.effectiveStart, other.effectiveStart) < Math.min(cur.effectiveEnd, other.effectiveEnd);
      if (overlaps) {
        maxLane = Math.max(maxLane, other.laneIndex);
      }
    }
    cur.totalLanes = maxLane + 1;
  }
  return {
    targetDay,
    startHour,
    endHour,
    slotMinutes,
    slots,
    timed,
    untimed,
    overdue,
    counts: {
      timed: timed.length,
      untimed: untimed.length,
      overdue: overdue.length
    }
  };
}
function computeTimeSlotDropMutation(task, targetDay, startHour, startMinute, durationMinutes = 45, timeZone = "Asia/Tehran") {
  if (!task || !targetDay) return null;
  const tzOffset = "+0330";
  const startMin = Math.max(0, Math.min(1439, startHour * 60 + startMinute));
  const endMin = Math.min(1439, startMin + Math.max(15, durationMinutes));
  const startFormatted = minutesToTimeString(startMin);
  const endFormatted = minutesToTimeString(endMin);
  return {
    id: String(task.id),
    projectId: task.projectId,
    startDate: `${targetDay}T${startFormatted}:00${tzOffset}`,
    dueDate: `${targetDay}T${endFormatted}:00${tzOffset}`,
    isAllDay: false,
    timeZone
  };
}
function computeResizeBlockMutation(task, targetDay, newDurationMinutes, timeZone = "Asia/Tehran") {
  if (!task || !targetDay) return null;
  const range = extractTaskTimeRange(task, targetDay, { timeZone });
  const startMin = range ? range.startMinutes : 9 * 60;
  const newEndMin = Math.min(1439, startMin + Math.max(15, newDurationMinutes));
  const tzOffset = "+0330";
  const startFormatted = minutesToTimeString(startMin);
  const endFormatted = minutesToTimeString(newEndMin);
  return {
    id: String(task.id),
    projectId: task.projectId,
    startDate: `${targetDay}T${startFormatted}:00${tzOffset}`,
    dueDate: `${targetDay}T${endFormatted}:00${tzOffset}`,
    isAllDay: false,
    timeZone
  };
}
function findCurrentActiveBlock(timedItems = [], currentMinutes) {
  if (!Array.isArray(timedItems)) return null;
  return timedItems.find((item) => item.effectiveStart <= currentMinutes && currentMinutes < item.effectiveEnd) ?? null;
}

// src/obsidian/timeblocking-planner.ts
init_date();
init_calendar_range();
var TimeblockingPlanner = class {
  constructor(element, host) {
    this.element = element;
    this.host = host;
    this.element.addClass("ticktick-timeblock-root");
    this.element.style.direction = "rtl";
    this.unsubscribeSelection = bulkSelectionStore.subscribe(() => {
      this.updateSelectionClasses();
    });
  }
  dayOffset = 0;
  isDrawerOpen = true;
  bulkActionBar = null;
  unsubscribeSelection = null;
  isMutating = false;
  destroy() {
    this.unsubscribeSelection?.();
    this.unsubscribeSelection = null;
    this.bulkActionBar?.destroy();
    this.bulkActionBar = null;
    this.element.empty();
  }
  async render() {
    this.element.empty();
    const today = todayInZone(this.host.timeZone);
    const targetDay = shiftCalendarDay(today, this.dayOffset);
    const allTasks = this.host.tasks();
    const agendaData = computeDayTimeSlots(allTasks, targetDay, {
      startHour: 7,
      endHour: 23,
      slotMinutes: 30,
      timeZone: this.host.timeZone
    });
    const toolbar = this.element.createDiv({ cls: "ticktick-timeblock-toolbar" });
    const dateGroup = toolbar.createDiv({ cls: "ticktick-timeblock-date-group" });
    const prevBtn = dateGroup.createEl("button", {
      cls: "ticktick-timeblock-nav-btn",
      attr: { "aria-label": "\u0631\u0648\u0632 \u0642\u0628\u0644", title: "\u0631\u0648\u0632 \u0642\u0628\u0644" }
    });
    (0, import_obsidian32.setIcon)(prevBtn, "chevron-right");
    prevBtn.addEventListener("click", () => {
      this.dayOffset--;
      void this.render();
    });
    const todayBtn = dateGroup.createEl("button", {
      cls: "ticktick-timeblock-nav-btn",
      text: "\u0627\u0645\u0631\u0648\u0632"
    });
    todayBtn.addEventListener("click", () => {
      this.dayOffset = 0;
      void this.render();
    });
    const nextBtn = dateGroup.createEl("button", {
      cls: "ticktick-timeblock-nav-btn",
      attr: { "aria-label": "\u0631\u0648\u0632 \u0628\u0639\u062F", title: "\u0631\u0648\u0632 \u0628\u0639\u062F" }
    });
    (0, import_obsidian32.setIcon)(nextBtn, "chevron-left");
    nextBtn.addEventListener("click", () => {
      this.dayOffset++;
      void this.render();
    });
    const dateTitle = dateGroup.createDiv({ cls: "ticktick-timeblock-date-title" });
    const calIcon = dateTitle.createSpan();
    (0, import_obsidian32.setIcon)(calIcon, "calendar");
    dateTitle.createSpan({ text: formatPersianDate(targetDay) });
    if (this.dayOffset === 0) {
      const todayBadge = dateGroup.createSpan({ cls: "ticktick-timeblock-stat-pill" });
      todayBadge.setText("\u0627\u0645\u0631\u0648\u0632");
    }
    const timedCountBadge = dateGroup.createSpan({ cls: "ticktick-timeblock-stat-pill" });
    timedCountBadge.setText(`${agendaData.counts.timed} \u06A9\u0627\u0631 \u0632\u0645\u0627\u0646\u200C\u062F\u0627\u0631`);
    const actions = toolbar.createDiv({ cls: "ticktick-timeblock-actions" });
    const drawerToggleBtn = actions.createEl("button", {
      cls: "ticktick-timeblock-nav-btn",
      attr: { "aria-label": "\u0641\u0647\u0631\u0633\u062A \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0628\u062F\u0648\u0646 \u0632\u0645\u0627\u0646", title: "\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0628\u062F\u0648\u0646 \u0632\u0645\u0627\u0646" }
    });
    (0, import_obsidian32.setIcon)(drawerToggleBtn, "sidebar");
    drawerToggleBtn.createSpan({ text: ` \u06A9\u0627\u0631\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632 (${agendaData.counts.untimed})` });
    drawerToggleBtn.addEventListener("click", () => {
      this.isDrawerOpen = !this.isDrawerOpen;
      void this.render();
    });
    const refreshBtn = actions.createEl("button", { cls: "ticktick-timeblock-nav-btn" });
    const refreshIcon = refreshBtn.createSpan();
    (0, import_obsidian32.setIcon)(refreshIcon, "refresh-cw");
    refreshBtn.createSpan({ text: "\u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC" });
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      try {
        await this.host.refresh();
        await this.render();
      } finally {
        refreshBtn.disabled = false;
      }
    });
    const addBtn = actions.createEl("button", {
      cls: "ticktick-timeblock-btn ticktick-timeblock-btn-primary tb-action-add-task",
      attr: { type: "button", "aria-label": "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u062C\u062F\u06CC\u062F" }
    });
    const addIcon = addBtn.createSpan({ cls: "ticktick-btn-icon" });
    (0, import_obsidian32.setIcon)(addIcon, "plus");
    addBtn.createSpan({ text: "+ \u062A\u0633\u06A9 \u062C\u062F\u06CC\u062F" });
    addBtn.addEventListener("click", async () => {
      if (!this.host.createTask) return;
      await this.host.createTask({ dueDate: targetDay });
      await this.render();
    });
    const content = this.element.createDiv({ cls: "ticktick-timeblock-content" });
    const gridContainer = content.createDiv({ cls: "ticktick-timeblock-grid-container" });
    const grid = gridContainer.createDiv({ cls: "ticktick-timeblock-grid" });
    const timeCol = grid.createDiv({ cls: "ticktick-timeblock-time-col" });
    for (const slot of agendaData.slots) {
      const lbl = timeCol.createDiv({
        cls: `ticktick-timeblock-time-label ${slot.isHourMark ? "is-hour" : ""}`
      });
      lbl.setText(slot.isHourMark ? slot.timeLabel : "");
    }
    const slotsCol = grid.createDiv({ cls: "ticktick-timeblock-slots-col" });
    for (const slot of agendaData.slots) {
      const row = slotsCol.createDiv({
        cls: `ticktick-timeblock-slot-row ${slot.isHourMark ? "is-hour" : ""}`
      });
      row.dataset.slotIndex = String(slot.index);
      row.dataset.startMinutes = String(slot.startMinutes);
      row.addEventListener("dragover", (e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        row.addClass("is-drag-over");
      });
      row.addEventListener("dragleave", () => {
        row.removeClass("is-drag-over");
      });
      row.addEventListener("drop", async (e) => {
        e.preventDefault();
        row.removeClass("is-drag-over");
        const taskId = e.dataTransfer?.getData("application/x-ticktick-task-id") || e.dataTransfer?.getData("text/plain");
        if (!taskId) return;
        const hour = Math.floor(slot.startMinutes / 60);
        const minute = slot.startMinutes % 60;
        await this.handleDropOnSlot(taskId, targetDay, hour, minute);
      });
    }
    if (targetDay === today) {
      const now = /* @__PURE__ */ new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const dayStartMin2 = agendaData.startHour * 60;
      const dayEndMin = (agendaData.endHour + 1) * 60;
      if (nowMin >= dayStartMin2 && nowMin <= dayEndMin) {
        const topPx = (nowMin - dayStartMin2) / agendaData.slotMinutes * 32;
        const nowLine = slotsCol.createDiv({ cls: "ticktick-timeblock-now-line" });
        nowLine.style.top = `${topPx}px`;
      }
    }
    const dayStartMin = agendaData.startHour * 60;
    for (const timedItem of agendaData.timed) {
      this.renderTimedCard(slotsCol, timedItem, targetDay, dayStartMin, agendaData.slotMinutes);
    }
    if (this.isDrawerOpen) {
      this.renderDrawer(content, agendaData.untimed, agendaData.overdue, targetDay);
    }
    if (this.host.executeBulkOperation) {
      this.bulkActionBar = new BulkActionBar(this.element, {
        app: this.host.app,
        timeZone: this.host.timeZone,
        tasks: () => this.host.tasks(),
        projects: () => this.host.projects(),
        executeBulkOperation: this.host.executeBulkOperation,
        onChanged: async () => {
          await this.render();
        }
      });
      await this.bulkActionBar.render();
    }
    this.updateSelectionClasses();
  }
  renderTimedCard(slotsCol, item, targetDay, dayStartMin, slotMinutes) {
    const card = slotsCol.createDiv({ cls: "ticktick-timeblock-card" });
    card.dataset.taskId = String(item.task.id);
    card.setAttribute("draggable", "true");
    const prio = taskPriority(item.task.priority);
    if (prio.className) card.addClass(prio.className);
    const topPx = (item.effectiveStart - dayStartMin) / slotMinutes * 32;
    const heightPx = Math.max(30, (item.effectiveEnd - item.effectiveStart) / slotMinutes * 32 - 2);
    card.style.top = `${topPx}px`;
    card.style.height = `${heightPx}px`;
    const widthPercent = 100 / item.totalLanes;
    const rightPercent = item.laneIndex * widthPercent;
    card.style.width = `calc(${widthPercent}% - 6px)`;
    card.style.right = `${rightPercent}%`;
    card.addEventListener("dragstart", (e) => {
      if (e.dataTransfer) {
        e.dataTransfer.setData("application/x-ticktick-task-id", String(item.task.id));
        e.dataTransfer.setData("text/plain", String(item.task.id));
        e.dataTransfer.effectAllowed = "move";
      }
      card.addClass("is-dragging");
    });
    card.addEventListener("dragend", () => {
      card.removeClass("is-dragging");
    });
    const header = card.createDiv({ cls: "ticktick-timeblock-card-header" });
    const titleEl = header.createDiv({ cls: "ticktick-timeblock-card-title" });
    titleEl.setText(cleanTaskTitle(item.task.title));
    const timeEl = header.createDiv({ cls: "ticktick-timeblock-card-time" });
    timeEl.setText(`${item.range.startTime} - ${item.range.endTime}`);
    card.addEventListener("click", (e) => {
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        bulkSelectionStore.toggle(String(item.task.id));
        return;
      }
      new TaskDetailsModal(this.host.app, item.task, {
        edit: this.host.edit,
        load: this.host.load,
        complete: async () => {
          await this.host.complete(item.task);
          await this.render();
        },
        changed: async () => {
          await this.render();
        }
      }).open();
    });
    const resizeHandle = card.createDiv({
      cls: "ticktick-timeblock-resize-handle",
      attr: { title: "\u062A\u063A\u06CC\u06CC\u0631 \u0645\u062F\u062A \u0632\u0645\u0627\u0646" }
    });
    resizeHandle.addEventListener("click", (e) => {
      e.stopPropagation();
      const menu = new import_obsidian32.Menu();
      const durations = [15, 30, 45, 60, 90, 120];
      for (const d of durations) {
        menu.addItem((menuItem) => {
          menuItem.setTitle(`${d} \u062F\u0642\u06CC\u0642\u0647`).onClick(async () => {
            const mutation = computeResizeBlockMutation(item.task, targetDay, d, this.host.timeZone);
            if (mutation) {
              await this.host.updateTask(mutation);
              await this.render();
            }
          });
        });
      }
      menu.showAtMouseEvent(e);
    });
  }
  renderDrawer(content, untimed, overdue, targetDay) {
    const drawer = content.createDiv({ cls: "ticktick-timeblock-drawer" });
    const titleToday = drawer.createDiv({ cls: "ticktick-timeblock-drawer-title" });
    titleToday.createSpan({ text: "\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632 (\u0628\u062F\u0648\u0646 \u0633\u0627\u0639\u062A)" });
    titleToday.createSpan({ cls: "ticktick-timeblock-stat-pill", text: String(untimed.length) });
    const untimedList = drawer.createDiv({ cls: "ticktick-timeblock-untimed-list" });
    if (untimed.length === 0) {
      untimedList.createDiv({ cls: "ticktick-matrix-empty", text: "\u0645\u0648\u0631\u062F\u06CC \u0646\u06CC\u0633\u062A." });
    } else {
      for (const task of untimed) {
        this.renderDrawerTaskCard(untimedList, task);
      }
    }
    if (overdue.length > 0) {
      const titleOverdue = drawer.createDiv({ cls: "ticktick-timeblock-drawer-title" });
      titleOverdue.createSpan({ text: "\u0645\u0639\u0648\u0642\u0647 \u0627\u0632 \u0642\u0628\u0644" });
      const overdueBadge = titleOverdue.createSpan({ cls: "ticktick-timeblock-stat-pill" });
      overdueBadge.setText(String(overdue.length));
      overdueBadge.style.color = "#dc2626";
      const overdueList = drawer.createDiv({ cls: "ticktick-timeblock-untimed-list" });
      for (const task of overdue) {
        this.renderDrawerTaskCard(overdueList, task, true);
      }
    }
  }
  renderDrawerTaskCard(container, task, isOverdue = false) {
    const card = container.createDiv({ cls: "ticktick-timeblock-untimed-card" });
    card.dataset.taskId = String(task.id);
    card.setAttribute("draggable", "true");
    const prio = taskPriority(task.priority);
    const prioDot = card.createSpan({ cls: `ticktick-matrix-priority-dot ${prio.className}` });
    const titleEl = card.createSpan({ text: cleanTaskTitle(task.title) });
    titleEl.style.flex = "1";
    titleEl.style.overflow = "hidden";
    titleEl.style.textOverflow = "ellipsis";
    titleEl.style.whiteSpace = "nowrap";
    if (isOverdue) {
      const due = toDateKey(task.dueDate, task.timeZone || this.host.timeZone);
      if (due) {
        const badge = card.createSpan({ cls: "ticktick-matrix-meta-pill is-overdue", text: formatPersianDate(due) });
      }
    }
    card.addEventListener("dragstart", (e) => {
      if (e.dataTransfer) {
        e.dataTransfer.setData("application/x-ticktick-task-id", String(task.id));
        e.dataTransfer.setData("text/plain", String(task.id));
        e.dataTransfer.effectAllowed = "move";
      }
      card.addClass("is-dragging");
    });
    card.addEventListener("dragend", () => {
      card.removeClass("is-dragging");
    });
    card.addEventListener("click", () => {
      new TaskDetailsModal(this.host.app, task, {
        edit: this.host.edit,
        load: this.host.load,
        complete: async () => {
          await this.host.complete(task);
          await this.render();
        },
        changed: async () => {
          await this.render();
        }
      }).open();
    });
  }
  async handleDropOnSlot(taskId, targetDay, hour, minute) {
    if (this.isMutating) return;
    this.isMutating = true;
    try {
      const allTasks = this.host.tasks();
      const task = allTasks.find((t) => String(t.id) === taskId);
      if (!task) return;
      const mutation = computeTimeSlotDropMutation(task, targetDay, hour, minute, 45, this.host.timeZone);
      if (mutation) {
        await this.host.updateTask(mutation);
        const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        new import_obsidian32.Notice(`\u062A\u0633\u06A9 \xAB${cleanTaskTitle(task.title)}\xBB \u0628\u0631\u0627\u06CC \u0633\u0627\u0639\u062A ${timeStr} \u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC \u0634\u062F.`);
        await this.render();
      }
    } catch (err) {
      new import_obsidian32.Notice(err instanceof Error ? err.message : "\u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
    } finally {
      this.isMutating = false;
    }
  }
  updateSelectionClasses() {
    const selected = new Set(bulkSelectionStore.getSelection());
    const cards = this.element.querySelectorAll(".ticktick-timeblock-card");
    cards.forEach((card) => {
      const tid = card.dataset.taskId;
      if (tid && selected.has(tid)) {
        card.addClass("is-selected");
      } else {
        card.removeClass("is-selected");
      }
    });
  }
};

// src/obsidian/views/timeblocking-planner-view.ts
var TimeblockingPlannerView = class extends import_obsidian33.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  planner;
  headerSlot;
  bodySlot;
  getViewType() {
    return TIMEBLOCK_PLANNER_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632 \u0648 \u0628\u0644\u0648\u06A9\u200C\u0628\u0646\u062F\u06CC \u0632\u0645\u0627\u0646\u06CC \u0631\u0648\u0632\u0627\u0646\u0647";
  }
  getIcon() {
    return "clock";
  }
  async onOpen() {
    await this.render();
  }
  async render() {
    this.contentEl.addClass("ticktick-workspace-view-root");
    this.contentEl.addClass("ticktick-timeblock-view-container");
    if (!this.headerSlot || !this.bodySlot) {
      this.contentEl.empty();
      this.headerSlot = this.contentEl.createDiv({ cls: "ticktick-workspace-header-slot" });
      this.bodySlot = this.contentEl.createDiv({ cls: "ticktick-workspace-body-slot" });
      renderWorkspaceHeader(this.headerSlot, {
        plugin: this.plugin,
        leaf: this.leaf,
        activeViewType: this.getViewType()
      });
      this.planner = new TimeblockingPlanner(this.bodySlot, this.plugin.timeblockingPlannerHost());
    }
    await this.planner?.render();
  }
  async onClose() {
    this.planner?.destroy();
    this.planner = void 0;
    this.headerSlot = void 0;
    this.bodySlot = void 0;
  }
};

// src/obsidian/pomodoro-timer.ts
var import_obsidian34 = require("obsidian");

// src/core/pomodoro-engine.js
var POMODORO_MODES = {
  FOCUS: "focus",
  SHORT_BREAK: "shortBreak",
  LONG_BREAK: "longBreak",
  IDLE: "idle"
};
var DEFAULT_POMODORO_SETTINGS = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  dailyNoteHeading: "## \u062C\u0644\u0633\u0627\u062A \u062A\u0645\u0631\u06A9\u0632 (Pomodoro)"
};
function createPomodoroState(settings = {}) {
  const merged = { ...DEFAULT_POMODORO_SETTINGS, ...settings };
  return {
    mode: POMODORO_MODES.IDLE,
    activeTask: null,
    totalSeconds: merged.focusMinutes * 60,
    remainingSeconds: merged.focusMinutes * 60,
    isRunning: false,
    completedPomodoros: 0,
    settings: merged,
    history: []
  };
}
function startFocusSession(state, task = null) {
  const durationSec = state.settings.focusMinutes * 60;
  return {
    ...state,
    mode: POMODORO_MODES.FOCUS,
    activeTask: task,
    totalSeconds: durationSec,
    remainingSeconds: durationSec,
    isRunning: true
  };
}
function startBreakSession(state, isLong = false) {
  const minutes = isLong ? state.settings.longBreakMinutes : state.settings.shortBreakMinutes;
  const durationSec = minutes * 60;
  return {
    ...state,
    mode: isLong ? POMODORO_MODES.LONG_BREAK : POMODORO_MODES.SHORT_BREAK,
    totalSeconds: durationSec,
    remainingSeconds: durationSec,
    isRunning: true
  };
}
function tickPomodoro(state, deltaSeconds = 1) {
  if (!state.isRunning) return { state, event: null };
  const nextRemaining = Math.max(0, state.remainingSeconds - deltaSeconds);
  if (nextRemaining > 0) {
    return {
      state: { ...state, remainingSeconds: nextRemaining },
      event: null
    };
  }
  if (state.mode === POMODORO_MODES.FOCUS) {
    const nextCompleted = state.completedPomodoros + 1;
    const isLong = nextCompleted % state.settings.sessionsBeforeLongBreak === 0;
    const sessionRecord = {
      task: state.activeTask,
      durationMinutes: state.settings.focusMinutes,
      completedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const nextBreakState = startBreakSession({
      ...state,
      completedPomodoros: nextCompleted,
      history: [...state.history, sessionRecord]
    }, isLong);
    return {
      state: nextBreakState,
      event: "focusCompleted",
      session: sessionRecord
    };
  } else {
    return {
      state: {
        ...state,
        mode: POMODORO_MODES.IDLE,
        isRunning: false,
        remainingSeconds: state.settings.focusMinutes * 60,
        totalSeconds: state.settings.focusMinutes * 60
      },
      event: "breakCompleted"
    };
  }
}
function pausePomodoro(state) {
  return { ...state, isRunning: false };
}
function resumePomodoro(state) {
  if (state.remainingSeconds <= 0) return state;
  return { ...state, isRunning: true };
}
function resetPomodoro(state) {
  const initialSec = state.settings.focusMinutes * 60;
  return {
    ...state,
    mode: POMODORO_MODES.IDLE,
    remainingSeconds: initialSec,
    totalSeconds: initialSec,
    isRunning: false,
    activeTask: null
  };
}
function skipPomodoro(state) {
  if (state.mode === POMODORO_MODES.FOCUS) {
    const nextCompleted = state.completedPomodoros + 1;
    const isLong = nextCompleted % state.settings.sessionsBeforeLongBreak === 0;
    return startBreakSession({ ...state, completedPomodoros: nextCompleted }, isLong);
  } else {
    return resetPomodoro(state);
  }
}
function formatPomodoroLogEntry(session, timeZone = "Asia/Tehran") {
  const duration = session.durationMinutes || 25;
  const taskTitle = session.task?.title ? String(session.task.title).trim() : "\u062A\u0645\u0631\u06A9\u0632 \u0639\u0645\u0648\u0645\u06CC";
  let timeStr = "";
  try {
    const dt = session.completedAt ? new Date(session.completedAt) : /* @__PURE__ */ new Date();
    timeStr = new Intl.DateTimeFormat("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone
    }).format(dt);
  } catch {
    timeStr = "\u062B\u0628\u062A\u200C\u0634\u062F\u0647";
  }
  return `- \u{1F345} ${duration} \u062F\u0642\u06CC\u0642\u0647: ${taskTitle} (\u0633\u0627\u0639\u062A ${timeStr})`;
}
function appendPomodoroLogToDailyNoteMarkdown(markdownContent = "", logEntry, heading = "## \u062C\u0644\u0633\u0627\u062A \u062A\u0645\u0631\u06A9\u0632 (Pomodoro)") {
  const cleanHeading = heading.trim();
  const cleanEntry = logEntry.trim();
  const lines = markdownContent.split(/\r?\n/);
  const headingIdx = lines.findIndex((line) => line.trim().toLowerCase() === cleanHeading.toLowerCase());
  if (headingIdx !== -1) {
    let insertIdx = headingIdx + 1;
    while (insertIdx < lines.length && !lines[insertIdx].trim().startsWith("#")) {
      insertIdx++;
    }
    const before = lines.slice(0, insertIdx);
    const after = lines.slice(insertIdx);
    return [...before, cleanEntry, ...after].join("\n");
  } else {
    const trimmed = markdownContent.trimEnd();
    const separator = trimmed ? "\n\n" : "";
    return `${trimmed}${separator}${cleanHeading}

${cleanEntry}
`;
  }
}

// src/obsidian/pomodoro-timer.ts
var PomodoroTimerService = class {
  constructor(host) {
    this.host = host;
  }
  state = createPomodoroState();
  timerId = null;
  listeners = /* @__PURE__ */ new Set();
  getState() {
    return this.state;
  }
  subscribe(callback) {
    this.listeners.add(callback);
    callback(this.state);
    return () => this.listeners.delete(callback);
  }
  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch {
      }
    }
    this.host.onStateChanged?.(this.state);
  }
  start(task = null) {
    this.state = startFocusSession(this.state, task);
    this.ensureTicker();
    this.notify();
  }
  pause() {
    this.state = pausePomodoro(this.state);
    this.notify();
  }
  resume() {
    this.state = resumePomodoro(this.state);
    this.ensureTicker();
    this.notify();
  }
  reset() {
    this.state = resetPomodoro(this.state);
    this.notify();
  }
  skip() {
    this.state = skipPomodoro(this.state);
    this.ensureTicker();
    this.notify();
  }
  setPreset(focusMinutes, breakMinutes) {
    this.state = createPomodoroState({
      ...this.state.settings,
      focusMinutes,
      shortBreakMinutes: breakMinutes
    });
    this.notify();
  }
  setTask(task) {
    this.state.activeTask = task;
    this.notify();
  }
  ensureTicker() {
    if (this.timerId !== null) return;
    this.timerId = window.setInterval(() => {
      if (!this.state.isRunning) return;
      const { state, event, session } = tickPomodoro(this.state, 1);
      this.state = state;
      this.notify();
      if (event === "focusCompleted" && session) {
        this.handleFocusCompleted(session);
      } else if (event === "breakCompleted") {
        new import_obsidian34.Notice("\u0632\u0645\u0627\u0646 \u0627\u0633\u062A\u0631\u0627\u062D\u062A \u0628\u0647 \u067E\u0627\u06CC\u0627\u0646 \u0631\u0633\u06CC\u062F! \u0622\u0645\u0627\u062F\u0647 \u062C\u0644\u0633\u0647 \u062A\u0645\u0631\u06A9\u0632 \u0628\u0639\u062F\u06CC\u061F \u{1F345}");
        this.playChime();
      }
    }, 1e3);
  }
  async handleFocusCompleted(session) {
    this.playChime();
    new import_obsidian34.Notice(`\u062C\u0644\u0633\u0647 \u062A\u0645\u0631\u06A9\u0632 ${session.durationMinutes} \u062F\u0642\u06CC\u0642\u0647\u200C\u0627\u06CC \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F! \u{1F44F} \u0648\u0642\u062A \u0627\u0633\u062A\u0631\u0627\u062D\u062A \u0627\u0633\u062A.`);
    if (session.task?.id) {
      const curCount = Number(session.task.pomodoroCount ?? 0);
      try {
        await this.host.updateTask({
          id: session.task.id,
          pomodoroCount: curCount + 1
        });
      } catch {
      }
    }
    try {
      await this.host.logPomodoroToDailyNote(session);
    } catch (err) {
      new import_obsidian34.Notice("\u062B\u0628\u062A \u062C\u0644\u0633\u0647 \u062A\u0645\u0631\u06A9\u0632 \u062F\u0631 \u06CC\u0627\u062F\u062F\u0627\u0634\u062A \u0631\u0648\u0632\u0627\u0646\u0647 \u0628\u0627 \u062E\u0637\u0627 \u0645\u0648\u0627\u062C\u0647 \u0634\u062F.");
    }
  }
  playChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(1e-3, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.6);
    } catch {
    }
  }
  destroy() {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    this.listeners.clear();
  }
};
var PomodoroModal = class extends import_obsidian34.Modal {
  constructor(app, service, host) {
    super(app);
    this.service = service;
    this.host = host;
  }
  unsubscribe = null;
  onOpen() {
    this.modalEl.addClass("ticktick-pomodoro-modal");
    this.render();
    this.unsubscribe = this.service.subscribe(() => {
      this.updateView();
    });
  }
  onClose() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.contentEl.empty();
  }
  render() {
    this.contentEl.empty();
    const root = this.contentEl.createDiv({ cls: "ticktick-pomodoro-container" });
    root.createDiv({ cls: "ticktick-pomodoro-badge" });
    root.createDiv({ cls: "ticktick-pomodoro-sessions" });
    root.createDiv({ cls: "ticktick-pomodoro-timer-display" });
    const progWrap = root.createDiv({ cls: "ticktick-pomodoro-progress-wrap" });
    progWrap.createDiv({ cls: "ticktick-pomodoro-progress-bar" });
    const taskCard = root.createDiv({ cls: "ticktick-pomodoro-task-card" });
    taskCard.createDiv({ cls: "ticktick-pomodoro-task-label", text: "\u062A\u0633\u06A9 \u062F\u0631 \u062D\u0627\u0644 \u062A\u0645\u0631\u06A9\u0632:" });
    const select = taskCard.createEl("select", { cls: "ticktick-pomodoro-select" });
    const openTasks = this.host.tasks().filter((t) => Number(t.status ?? 0) === 0);
    const defaultOpt = select.createEl("option", { text: "\u062A\u0645\u0631\u06A9\u0632 \u0639\u0645\u0648\u0645\u06CC (\u0628\u062F\u0648\u0646 \u062A\u0633\u06A9 \u0645\u0634\u062E\u0635)", value: "" });
    for (const t of openTasks) {
      const opt = select.createEl("option", { text: cleanTaskTitle(t.title), value: String(t.id) });
      if (String(t.id) === String(this.service.getState().activeTask?.id)) {
        opt.selected = true;
      }
    }
    select.addEventListener("change", () => {
      const chosen = openTasks.find((t) => String(t.id) === select.value) ?? null;
      this.service.setTask(chosen);
    });
    const controls = root.createDiv({ cls: "ticktick-pomodoro-controls" });
    const resetBtn = controls.createEl("button", {
      cls: "ticktick-pomodoro-btn-subtle",
      text: "\u0628\u0627\u0632\u0646\u0634\u0627\u0646\u06CC"
    });
    resetBtn.addEventListener("click", () => this.service.reset());
    const mainBtn = controls.createEl("button", {
      cls: "ticktick-pomodoro-btn-main"
    });
    mainBtn.addEventListener("click", () => {
      const st = this.service.getState();
      if (!st.isRunning) {
        if (st.remainingSeconds < st.totalSeconds && st.mode !== POMODORO_MODES.IDLE) {
          this.service.resume();
        } else {
          this.service.start(st.activeTask);
        }
      } else {
        this.service.pause();
      }
    });
    const skipBtn = controls.createEl("button", {
      cls: "ticktick-pomodoro-btn-subtle",
      text: "\u0631\u062F \u06A9\u0631\u062F\u0646"
    });
    skipBtn.addEventListener("click", () => this.service.skip());
    const presets = root.createDiv({ cls: "ticktick-pomodoro-presets" });
    const p25 = presets.createEl("button", { cls: "ticktick-pomodoro-preset-btn", text: "\u06F2\u06F5 / \u06F5 \u0627\u0633\u062A\u0627\u0646\u062F\u0627\u0631\u062F" });
    p25.addEventListener("click", () => this.service.setPreset(25, 5));
    const p50 = presets.createEl("button", { cls: "ticktick-pomodoro-preset-btn", text: "\u06F5\u06F0 / \u06F1\u06F0 \u062A\u0645\u0631\u06A9\u0632 \u0639\u0645\u06CC\u0642" });
    p50.addEventListener("click", () => this.service.setPreset(50, 10));
    this.updateView();
  }
  updateView() {
    const st = this.service.getState();
    const badge = this.contentEl.querySelector(".ticktick-pomodoro-badge");
    if (badge) {
      badge.className = `ticktick-pomodoro-badge is-${st.mode} ${st.isRunning ? "is-running" : ""}`;
      switch (st.mode) {
        case POMODORO_MODES.FOCUS:
          badge.setText(`\u062A\u0645\u0631\u06A9\u0632 \u0639\u0645\u06CC\u0642 (\u062F\u0648\u0631\u0647 ${st.completedPomodoros + 1})`);
          break;
        case POMODORO_MODES.SHORT_BREAK:
          badge.setText("\u0627\u0633\u062A\u0631\u0627\u062D\u062A \u06A9\u0648\u062A\u0627\u0647");
          break;
        case POMODORO_MODES.LONG_BREAK:
          badge.setText("\u0627\u0633\u062A\u0631\u0627\u062D\u062A \u0637\u0648\u0644\u0627\u0646\u06CC");
          break;
        default:
          badge.setText("\u0622\u0645\u0627\u062F\u0647 \u0634\u0631\u0648\u0639");
          break;
      }
    }
    const sessionsEl = this.contentEl.querySelector(".ticktick-pomodoro-sessions");
    if (sessionsEl) {
      sessionsEl.empty();
      const cyclePos = st.completedPomodoros % 4;
      for (let i = 0; i < 4; i++) {
        sessionsEl.createSpan({
          cls: `ticktick-pomodoro-session-dot ${i < cyclePos || st.completedPomodoros > 0 && cyclePos === 0 ? "is-filled" : ""}`,
          attr: { title: `\u062F\u0648\u0631\u0647 ${i + 1} \u0627\u0632 \u06F4` }
        });
      }
      if (st.completedPomodoros > 0) {
        sessionsEl.createSpan({ cls: "ticktick-pomodoro-session-count", text: `(\u062A\u06A9\u0645\u06CC\u0644: ${st.completedPomodoros})` });
      }
    }
    const timerDisplay = this.contentEl.querySelector(".ticktick-pomodoro-timer-display");
    if (timerDisplay) {
      const mins = Math.floor(st.remainingSeconds / 60);
      const secs = st.remainingSeconds % 60;
      timerDisplay.setText(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
    }
    const progBar = this.contentEl.querySelector(".ticktick-pomodoro-progress-bar");
    if (progBar && st.totalSeconds > 0) {
      const pct = Math.max(0, Math.min(100, (st.totalSeconds - st.remainingSeconds) / st.totalSeconds * 100));
      progBar.style.width = `${pct}%`;
    }
    const mainBtn = this.contentEl.querySelector(".ticktick-pomodoro-btn-main");
    if (mainBtn) {
      if (st.isRunning) {
        mainBtn.setText("\u23F8 \u062A\u0648\u0642\u0641 \u0645\u0648\u0642\u062A");
      } else if (st.remainingSeconds < st.totalSeconds && st.mode !== POMODORO_MODES.IDLE) {
        mainBtn.setText("\u25B6 \u0627\u062F\u0627\u0645\u0647");
      } else {
        mainBtn.setText("\u25B6 \u0634\u0631\u0648\u0639 \u062A\u0645\u0631\u06A9\u0632");
      }
    }
  }
};

// src/core/morning-briefing.js
init_date();
var PERSIAN_QUOTES = [
  "\u0647\u0631 \u0631\u0648\u0632 \u0641\u0631\u0635\u062A\u06CC \u0646\u0648 \u0628\u0631\u0627\u06CC \u067E\u06CC\u0634\u0631\u0641\u062A \u0648 \u062E\u0644\u0642 \u0627\u0631\u0632\u0634 \u0627\u0633\u062A.",
  "\u0634\u0631\u0648\u0639 \u067E\u0631\u0627\u0646\u0631\u0698\u06CC \u0631\u0648\u0632\u060C \u062A\u0636\u0645\u06CC\u0646\u200C\u06A9\u0646\u0646\u062F\u0647 \u062A\u0645\u0631\u06A9\u0632 \u0648 \u067E\u06CC\u0631\u0648\u0632\u06CC\u200C\u0647\u0627\u06CC \u0628\u0632\u0631\u06AF \u0627\u0633\u062A.",
  "\u06A9\u0627\u0631\u0647\u0627\u06CC \u0645\u0647\u0645 \u0631\u0627 \u0627\u0648\u0644 \u0648\u0642\u062A \u0627\u0646\u062C\u0627\u0645 \u062F\u0647\u06CC\u062F \u062A\u0627 \u0631\u0648\u0632\u062A\u0627\u0646 \u0628\u0627 \u0622\u0631\u0627\u0645\u0634 \u0633\u067E\u0631\u06CC \u0634\u0648\u062F.",
  "\u067E\u06CC\u0648\u0633\u062A\u06AF\u06CC \u062F\u0631 \u06AF\u0627\u0645\u200C\u0647\u0627\u06CC \u06A9\u0648\u0686\u06A9\u060C \u062F\u0633\u062A\u0627\u0648\u0631\u062F\u0647\u0627\u06CC \u0634\u06AF\u0641\u062A\u200C\u0627\u0646\u06AF\u06CC\u0632 \u0645\u06CC\u200C\u0633\u0627\u0632\u062F.",
  "\u062A\u0645\u0631\u06A9\u0632 \u0639\u0645\u06CC\u0642 \u06CC\u0639\u0646\u06CC \u0647\u0646\u0631 \xAB\u0646\u0647\xBB \u06AF\u0641\u062A\u0646 \u0628\u0647 \u0645\u0648\u0627\u0631\u062F \u063A\u06CC\u0631\u0636\u0631\u0648\u0631\u06CC."
];
function computeMorningBriefing(tasks, habits, options) {
  const today = options.today || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const timeZone = options.timeZone || "Asia/Tehran";
  const projectsMap = options.projectsMap || {};
  const allTasks = Array.isArray(tasks) ? tasks : [];
  const allHabits = Array.isArray(habits) ? habits : [];
  const todayDate = /* @__PURE__ */ new Date(`${today}T00:00:00Z`);
  const yestDate = new Date(todayDate.getTime() - 864e5);
  const yesterday = yestDate.toISOString().slice(0, 10);
  const overdueTasks = [];
  const todayTimedTasks = [];
  const todayUntimedTasks = [];
  let yesterdayCompletedCount = 0;
  for (const task of allTasks) {
    if (task.status !== 0) {
      const compDate = task.completedTime ? task.completedTime.slice(0, 10) : null;
      if (compDate === yesterday) {
        yesterdayCompletedCount++;
      }
      continue;
    }
    const dueDate = task.dueDate ? task.dueDate.slice(0, 10) : null;
    if (!dueDate) continue;
    if (dueDate < today) {
      overdueTasks.push(task);
      continue;
    }
    if (dueDate === today) {
      const timeRange = extractTaskTimeRange(task, today, { timeZone });
      if (timeRange) {
        todayTimedTasks.push({
          task,
          timeLabel: `${timeRange.startString} - ${timeRange.endString}`,
          startMinutes: timeRange.startMinutes
        });
      } else {
        todayUntimedTasks.push(task);
      }
    }
  }
  todayTimedTasks.sort((a, b) => a.startMinutes - b.startMinutes);
  todayUntimedTasks.sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));
  overdueTasks.sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""));
  const todayHabits = allHabits.filter((h) => isHabitScheduledForDay(h, today));
  const dayHash = today.split("-").reduce((acc, part) => acc + parseInt(part, 10), 0);
  const motivationalQuote = PERSIAN_QUOTES[dayHash % PERSIAN_QUOTES.length];
  return {
    today,
    overdueTasks,
    todayTimedTasks,
    todayUntimedTasks,
    todayHabits,
    yesterdayCompletedCount,
    totalTodayTasksCount: todayTimedTasks.length + todayUntimedTasks.length,
    motivationalQuote
  };
}
function formatMorningBriefingMarkdown(briefing, options = {}) {
  const dateHeader = options.jalaliDateStr ? ` (${options.jalaliDateStr})` : ` (${briefing.today})`;
  const lines = [];
  lines.push(`## \u{1F305} \u067E\u06CC\u0634\u062E\u0648\u0627\u0646 \u0645\u0631\u0648\u0631 \u0635\u0628\u062D\u06AF\u0627\u0647\u06CC${dateHeader}`);
  lines.push("");
  lines.push(`> \u{1F4A1} **\u067E\u06CC\u0627\u0645 \u0631\u0648\u0632**: ${briefing.motivationalQuote}`);
  lines.push(`> \u{1F4CA} **\u0648\u0636\u0639\u06CC\u062A**: ${briefing.totalTodayTasksCount} \u062A\u0633\u06A9 \u0628\u0631\u0627\u06CC \u0627\u0645\u0631\u0648\u0632\u060C ${briefing.overdueTasks.length} \u062A\u0633\u06A9 \u0645\u0639\u0648\u0642\u0647\u060C \u0648 ${briefing.todayHabits.length} \u0639\u0627\u062F\u062A \u062F\u0631 \u0628\u0631\u0646\u0627\u0645\u0647.`);
  if (briefing.yesterdayCompletedCount > 0) {
    lines.push(`> \u{1F3C6} **\u062F\u0633\u062A\u0627\u0648\u0631\u062F \u062F\u06CC\u0631\u0648\u0632**: ${briefing.yesterdayCompletedCount} \u062A\u0633\u06A9 \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u0646\u062C\u0627\u0645 \u0634\u062F.`);
  }
  lines.push("");
  if (briefing.overdueTasks.length > 0) {
    lines.push(`### \u{1F6A8} \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0645\u0639\u0648\u0642\u0647 \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0631\u0633\u06CC\u062F\u06AF\u06CC (${briefing.overdueTasks.length} \u0645\u0648\u0631\u062F)`);
    for (const t of briefing.overdueTasks) {
      const prioLabel = t.priority === 5 ? " \u{1F6A9} \u0628\u0627\u0644\u0627" : "";
      lines.push(`- [ ] ${t.title}${prioLabel} *(\u0633\u0631\u0631\u0633\u06CC\u062F: ${t.dueDate ? t.dueDate.slice(0, 10) : "\u0646\u0627\u0645\u0634\u062E\u0635"})*`);
    }
    lines.push("");
  }
  if (briefing.todayTimedTasks.length > 0) {
    lines.push("### \u23F0 \u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC \u0627\u0645\u0631\u0648\u0632");
    for (const item of briefing.todayTimedTasks) {
      lines.push(`- [ ] **${item.timeLabel}**: ${item.task.title}`);
    }
    lines.push("");
  }
  if (briefing.todayUntimedTasks.length > 0) {
    lines.push("### \u{1F3AF} \u0627\u0648\u0644\u0648\u06CC\u062A\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632");
    for (const t of briefing.todayUntimedTasks) {
      const prioEmoji = t.priority === 5 ? "\u{1F6A9} \u0628\u0627\u0644\u0627: " : t.priority === 3 ? "\u{1F6A9} \u0645\u062A\u0648\u0633\u0637: " : "";
      lines.push(`- [ ] ${prioEmoji}${t.title}`);
    }
    lines.push("");
  }
  if (briefing.todayHabits.length > 0) {
    lines.push("### \u{1F33F} \u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632");
    for (const h of briefing.todayHabits) {
      const goalStr = h.goal ? ` (\u0647\u062F\u0641: ${h.goal} ${h.unit || ""})` : "";
      lines.push(`- [ ] ${h.name || "\u0639\u0627\u062F\u062A"}${goalStr}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}
function injectBriefingIntoDailyNote(existingMarkdown, briefingMarkdown, targetHeading = "## \u{1F305} \u067E\u06CC\u0634\u062E\u0648\u0627\u0646 \u0645\u0631\u0648\u0631 \u0635\u0628\u062D\u06AF\u0627\u0647\u06CC") {
  if (!existingMarkdown || typeof existingMarkdown !== "string") {
    return briefingMarkdown;
  }
  const headingIndex = existingMarkdown.indexOf(targetHeading);
  if (headingIndex === -1) {
    const fmMatch = existingMarkdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
    if (fmMatch) {
      const endOfFm = fmMatch[0].length;
      return existingMarkdown.slice(0, endOfFm) + "\n" + briefingMarkdown + "\n\n" + existingMarkdown.slice(endOfFm).trimStart();
    }
    return briefingMarkdown + "\n\n" + existingMarkdown.trimStart();
  }
  const afterHeading = existingMarkdown.slice(headingIndex + targetHeading.length);
  const nextHeadingMatch = afterHeading.match(/\r?\n#{1,2}\s+/);
  if (nextHeadingMatch && typeof nextHeadingMatch.index === "number") {
    const sectionEndIndex = headingIndex + targetHeading.length + nextHeadingMatch.index;
    return existingMarkdown.slice(0, headingIndex) + briefingMarkdown + existingMarkdown.slice(sectionEndIndex);
  } else {
    return existingMarkdown.slice(0, headingIndex) + briefingMarkdown + "\n";
  }
}

// src/obsidian/modals/morning-briefing-modal.ts
var import_obsidian35 = require("obsidian");
init_date();
var MorningBriefingModal = class extends import_obsidian35.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onOpen() {
    this.render();
  }
  onClose() {
    this.contentEl.empty();
  }
  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ticktick-briefing-modal");
    contentEl.setAttribute("dir", "rtl");
    const today = todayInZone(this.plugin.settings.timeZone);
    const jalaliDate = gregorianDateKeyToJalali(today) || today;
    const tasks = this.plugin.getCacheTasks();
    const habits = this.plugin.getCacheHabits();
    const briefing = computeMorningBriefing(tasks, habits, {
      today,
      timeZone: this.plugin.settings.timeZone
    });
    const overdueTasks = briefing.overdueTasks;
    const todayUntimedTasks = briefing.todayUntimedTasks;
    const todayHabits = briefing.todayHabits;
    const todayTimedTasks = briefing.todayTimedTasks;
    const headerEl = contentEl.createDiv({ cls: "briefing-header" });
    headerEl.createEl("h2", { text: `\u{1F305} \u067E\u06CC\u0634\u062E\u0648\u0627\u0646 \u0645\u0631\u0648\u0631 \u0635\u0628\u062D\u06AF\u0627\u0647\u06CC (${jalaliDate})` });
    const quoteEl = contentEl.createDiv({ cls: "briefing-quote-card" });
    quoteEl.createDiv({ cls: "quote-icon", text: "\u{1F4A1}" });
    quoteEl.createDiv({ cls: "quote-text", text: briefing.motivationalQuote });
    const kpiRow = contentEl.createDiv({ cls: "briefing-kpi-row" });
    const createKpi = (label, value, tone) => {
      const card = kpiRow.createDiv({ cls: `briefing-kpi-card tone-${tone}` });
      card.createDiv({ cls: "kpi-value", text: String(value) });
      card.createDiv({ cls: "kpi-label", text: label });
    };
    createKpi("\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632", briefing.totalTodayTasksCount, "blue");
    createKpi("\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0645\u0639\u0648\u0642\u0647", overdueTasks.length, overdueTasks.length > 0 ? "red" : "green");
    createKpi("\u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632", todayHabits.length, "purple");
    createKpi("\u0645\u0648\u0641\u0642\u06CC\u062A\u200C\u0647\u0627\u06CC \u062F\u06CC\u0631\u0648\u0632", briefing.yesterdayCompletedCount, "emerald");
    const bodyEl = contentEl.createDiv({ cls: "briefing-sections-body" });
    if (overdueTasks.length > 0) {
      const overdueSec = bodyEl.createDiv({ cls: "briefing-section section-overdue" });
      const secHeader = overdueSec.createDiv({ cls: "section-header" });
      secHeader.createEl("h3", { text: `\u{1F6A8} \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0645\u0639\u0648\u0642\u0647 (${overdueTasks.length})` });
      const reschedBtn = secHeader.createEl("button", {
        text: "\u26A1 \u0627\u0646\u062A\u0642\u0627\u0644 \u0647\u0645\u0647 \u0628\u0647 \u0627\u0645\u0631\u0648\u0632",
        cls: "briefing-action-btn"
      });
      reschedBtn.onclick = async () => {
        reschedBtn.disabled = true;
        reschedBtn.setText("\u062F\u0631 \u062D\u0627\u0644 \u0627\u0646\u062A\u0642\u0627\u0644...");
        try {
          const taskIds = overdueTasks.map((t) => String(t.id));
          await this.plugin.executeBulkOperation(taskIds, "schedule", { dueDate: today });
          new import_obsidian35.Notice(`${taskIds.length} \u062A\u0633\u06A9 \u0645\u0639\u0648\u0642\u0647 \u0628\u0647 \u0627\u0645\u0631\u0648\u0632 \u0645\u0646\u062A\u0642\u0644 \u0634\u062F\u0646\u062F.`);
          this.render();
        } catch (err) {
          new import_obsidian35.Notice(`\u062E\u0637\u0627: ${err.message}`);
          reschedBtn.disabled = false;
          reschedBtn.setText("\u26A1 \u0627\u0646\u062A\u0642\u0627\u0644 \u0647\u0645\u0647 \u0628\u0647 \u0627\u0645\u0631\u0648\u0632");
        }
      };
      const taskList = overdueSec.createDiv({ cls: "briefing-task-list" });
      for (const t of overdueTasks.slice(0, 10)) {
        const item = taskList.createDiv({ cls: "briefing-task-item is-overdue" });
        item.createSpan({ cls: "task-title", text: t.title || "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646" });
        item.createSpan({ cls: "task-meta", text: `\u{1F4C5} ${t.dueDate ? t.dueDate.slice(0, 10) : ""}` });
      }
    }
    if (todayTimedTasks.length > 0) {
      const timedSec = bodyEl.createDiv({ cls: "briefing-section section-timed" });
      timedSec.createEl("h3", { text: "\u23F0 \u0628\u0631\u0646\u0627\u0645\u0647 \u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC \u0627\u0645\u0631\u0648\u0632" });
      const taskList = timedSec.createDiv({ cls: "briefing-task-list" });
      for (const item of todayTimedTasks) {
        const row = taskList.createDiv({ cls: "briefing-task-item" });
        row.createSpan({ cls: "task-time-badge", text: item.timeLabel });
        row.createSpan({ cls: "task-title", text: item.task.title || "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646" });
      }
    }
    if (todayUntimedTasks.length > 0) {
      const prioSec = bodyEl.createDiv({ cls: "briefing-section section-priorities" });
      prioSec.createEl("h3", { text: "\u{1F3AF} \u0627\u0648\u0644\u0648\u06CC\u062A\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632" });
      const taskList = prioSec.createDiv({ cls: "briefing-task-list" });
      for (const t of todayUntimedTasks) {
        const row = taskList.createDiv({ cls: "briefing-task-item" });
        const prioTag = t.priority === 5 ? "\u{1F6A9} \u0628\u0627\u0644\u0627" : t.priority === 3 ? "\u{1F6A9} \u0645\u062A\u0648\u0633\u0637" : "\u{1F6A9} \u0639\u0627\u062F\u06CC";
        row.createSpan({ cls: `task-prio-badge prio-${t.priority}`, text: prioTag });
        row.createSpan({ cls: "task-title", text: t.title || "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646" });
      }
    }
    if (todayHabits.length > 0) {
      const habitsSec = bodyEl.createDiv({ cls: "briefing-section section-habits" });
      habitsSec.createEl("h3", { text: "\u{1F33F} \u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632" });
      const habitsList = habitsSec.createDiv({ cls: "briefing-task-list" });
      for (const h of todayHabits) {
        const row = habitsList.createDiv({ cls: "briefing-task-item" });
        row.createSpan({ cls: "habit-name", text: `\u2022 ${h.name || "\u0639\u0627\u062F\u062A"}` });
        if (h.goal) {
          row.createSpan({ cls: "task-meta", text: `(\u0647\u062F\u0641: ${h.goal} ${h.unit || ""})` });
        }
      }
    }
    const footerEl = contentEl.createDiv({ cls: "briefing-modal-footer" });
    const logToDailyBtn = footerEl.createEl("button", {
      text: "\u{1F4DD} \u062B\u0628\u062A \u062F\u0631 \u062F\u06CC\u0644\u06CC\u200C\u0646\u0648\u062A \u0627\u0645\u0631\u0648\u0632",
      cls: "mod-cta"
    });
    logToDailyBtn.onclick = async () => {
      const md = formatMorningBriefingMarkdown(briefing, { jalaliDateStr: jalaliDate });
      const success = await this.plugin.logMorningBriefingToDailyNote(md);
      if (success) {
        this.close();
      }
    };
    const closeBtn = footerEl.createEl("button", { text: "\u0628\u0633\u062A\u0646" });
    closeBtn.onclick = () => this.close();
  }
};

// src/obsidian/views/activity-heatmap-view.ts
var import_obsidian37 = require("obsidian");

// src/obsidian/activity-heatmap.ts
var import_obsidian36 = require("obsidian");

// src/core/activity-heatmap.js
init_date();
init_calendar_range();
function normalizeHabitStamp(stamp) {
  if (!stamp) return null;
  const str = String(stamp).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const match = str.match(/^(\d{4})(\d{2})(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return null;
}
function calculateHeatmapLevel(score) {
  if (!score || score <= 0) return 0;
  if (score <= 2) return 1;
  if (score <= 5) return 2;
  if (score <= 9) return 3;
  return 4;
}
function computeAnnualHeatmapData(tasks = [], habitCheckins = {}, habits = [], options = {}) {
  const timeZone = options.timeZone || "Asia/Tehran";
  const today = options.today || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const weeksCount = Number(options.weeksCount ?? 52);
  const todayWeekday = weekdayIndex(today);
  const daysUntilFriday = (5 - todayWeekday + 7) % 7;
  const rangeEnd = shiftCalendarDay(today, daysUntilFriday);
  const totalDays = weeksCount * 7;
  const rangeStart = shiftCalendarDay(rangeEnd, -(totalDays - 1));
  const dayMap = /* @__PURE__ */ new Map();
  for (let i2 = 0; i2 < totalDays; i2++) {
    const dKey = shiftCalendarDay(rangeStart, i2);
    dayMap.set(dKey, {
      dateKey: dKey,
      jalaliKey: gregorianDateKeyToJalali(dKey) || dKey,
      weekday: weekdayIndex(dKey),
      // 6 = Sat, 0 = Sun ... 5 = Fri
      tasks: [],
      habits: [],
      score: 0,
      level: 0,
      isFuture: dKey > today
    });
  }
  for (const t of tasks) {
    if (!t || Number(t.status ?? 0) === 0) continue;
    const completedDay = toDateKey(t.completedTime || t.dueDate, t.timeZone || timeZone);
    if (completedDay && dayMap.has(completedDay)) {
      dayMap.get(completedDay).tasks.push(String(t.title ?? ""));
    }
  }
  const habitNameMap = new Map(habits.map((h) => [String(h.id), String(h.name || "\u0639\u0627\u062F\u062A")]));
  for (const [habitId, checkinEntries] of Object.entries(habitCheckins || {})) {
    if (!Array.isArray(checkinEntries)) continue;
    const hName = habitNameMap.get(String(habitId)) || "\u0639\u0627\u062F\u062A";
    for (const entry of checkinEntries) {
      if (!entry) continue;
      const isCompleted = Number(entry.status ?? 0) === 2 || Number(entry.value ?? 0) >= Number(entry.goal ?? 1);
      if (!isCompleted) continue;
      const dayKey = normalizeHabitStamp(entry.stamp);
      if (dayKey && dayMap.has(dayKey)) {
        dayMap.get(dayKey).habits.push(hName);
      }
    }
  }
  let totalTasksCompleted = 0;
  let totalHabitsCompleted = 0;
  let activeDaysCount = 0;
  for (const day of dayMap.values()) {
    day.score = day.tasks.length + day.habits.length;
    day.level = calculateHeatmapLevel(day.score);
    if (!day.isFuture) {
      totalTasksCompleted += day.tasks.length;
      totalHabitsCompleted += day.habits.length;
      if (day.score > 0) activeDaysCount++;
    }
  }
  const pastDays = Array.from(dayMap.values()).filter((d) => !d.isFuture);
  pastDays.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  let currentStreak = 0;
  let longestStreak = 0;
  let runningStreak = 0;
  for (let i2 = 0; i2 < pastDays.length; i2++) {
    const d = pastDays[i2];
    if (d.score > 0) {
      runningStreak++;
      if (runningStreak > longestStreak) longestStreak = runningStreak;
    } else {
      runningStreak = 0;
    }
  }
  let i = pastDays.length - 1;
  if (i >= 0 && pastDays[i].score === 0) {
    i--;
  }
  while (i >= 0 && pastDays[i].score > 0) {
    currentStreak++;
    i--;
  }
  const allDays = Array.from(dayMap.values());
  const weeks = [];
  const monthLabels = [];
  let lastJalaliMonth = "";
  for (let w = 0; w < weeksCount; w++) {
    const weekDays = allDays.slice(w * 7, (w + 1) * 7);
    weekDays.sort((a, b) => {
      const orderA = (a.weekday + 1) % 7;
      const orderB = (b.weekday + 1) % 7;
      return orderA - orderB;
    });
    weeks.push({
      weekIndex: w,
      days: weekDays
    });
    const firstDay = weekDays[0];
    const jMonth = firstDay.jalaliKey ? firstDay.jalaliKey.slice(5, 7) : "";
    if (jMonth && jMonth !== lastJalaliMonth) {
      lastJalaliMonth = jMonth;
      monthLabels.push({
        colIndex: w,
        monthCode: jMonth,
        jalaliKey: firstDay.jalaliKey
      });
    }
  }
  return {
    rangeStart,
    rangeEnd,
    weeksCount,
    weeks,
    monthLabels,
    summary: {
      totalTasksCompleted,
      totalHabitsCompleted,
      totalActivities: totalTasksCompleted + totalHabitsCompleted,
      activeDaysCount,
      currentStreak,
      longestStreak
    }
  };
}

// src/obsidian/activity-heatmap.ts
init_date();
var PERSIAN_MONTH_NAMES = {
  "01": "\u0641\u0631\u0648\u0631\u062F\u06CC\u0646",
  "02": "\u0627\u0631\u062F\u06CC\u0628\u0647\u0634\u062A",
  "03": "\u062E\u0631\u062F\u0627\u062F",
  "04": "\u062A\u06CC\u0631",
  "05": "\u0645\u0631\u062F\u0627\u062F",
  "06": "\u0634\u0647\u0631\u06CC\u0648\u0631",
  "07": "\u0645\u0647\u0631",
  "08": "\u0622\u0628\u0627\u0646",
  "09": "\u0622\u0630\u0631",
  "10": "\u062F\u06CC",
  "11": "\u0628\u0647\u0645\u0646",
  "12": "\u0627\u0633\u0641\u0646\u062F"
};
var WEEKDAY_NAMES = ["\u0634", "\u06CC", "\u062F", "\u0633", "\u0686", "\u067E", "\u062C"];
var ActivityHeatmap = class {
  constructor(element, host) {
    this.element = element;
    this.host = host;
    this.element.addClass("ticktick-heatmap-root");
    this.element.style.direction = "rtl";
  }
  tooltipEl = null;
  destroy() {
    this.removeTooltip();
    this.element.empty();
  }
  async render() {
    this.element.empty();
    this.removeTooltip();
    const today = todayInZone(this.host.timeZone);
    const tasks = this.host.tasks();
    const habits = this.host.habits();
    const checkins = this.host.habitCheckins();
    const data = computeAnnualHeatmapData(tasks, checkins, habits, {
      today,
      weeksCount: 52,
      timeZone: this.host.timeZone
    });
    const header = this.element.createDiv({ cls: "ticktick-heatmap-header" });
    const titleGroup = header.createDiv({ cls: "ticktick-heatmap-title-group" });
    const title = titleGroup.createDiv({ cls: "ticktick-heatmap-title" });
    const iconSpan = title.createSpan();
    (0, import_obsidian36.setIcon)(iconSpan, "flame");
    title.createSpan({ text: "\u0647\u06CC\u062A\u200C\u0645\u067E \u0641\u0639\u0627\u0644\u06CC\u062A \u0648 \u067E\u06CC\u0648\u0633\u062A\u06AF\u06CC \u0633\u0627\u0644\u0627\u0646\u0647 (Activity Heatmap)" });
    if (this.host.refresh) {
      const refreshBtn = header.createEl("button", {
        cls: "ticktick-matrix-btn",
        text: "\u0628\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC"
      });
      refreshBtn.addEventListener("click", async () => {
        refreshBtn.disabled = true;
        try {
          await this.host.refresh?.();
          await this.render();
        } finally {
          refreshBtn.disabled = false;
        }
      });
    }
    const kpiGrid = this.element.createDiv({ cls: "ticktick-heatmap-kpi-grid" });
    this.renderKpi(kpiGrid, "\u{1F525} \u067E\u06CC\u0648\u0633\u062A\u06AF\u06CC \u062C\u0627\u0631\u06CC", `${data.summary.currentStreak} \u0631\u0648\u0632`);
    this.renderKpi(kpiGrid, "\u{1F3C6} \u0628\u0647\u062A\u0631\u06CC\u0646 \u0631\u06A9\u0648\u0631\u062F", `${data.summary.longestStreak} \u0631\u0648\u0632`);
    this.renderKpi(kpiGrid, "\u2705 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647", String(data.summary.totalTasksCompleted));
    this.renderKpi(kpiGrid, "\u{1F48E} \u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u062B\u0628\u062A\u200C\u0634\u062F\u0647", String(data.summary.totalHabitsCompleted));
    this.renderKpi(kpiGrid, "\u{1F3AF} \u06A9\u0644 \u0641\u0639\u0627\u0644\u06CC\u062A\u200C\u0647\u0627", String(data.summary.totalActivities));
    const matrixCard = this.element.createDiv({ cls: "ticktick-heatmap-matrix-card" });
    const gridWrap = matrixCard.createDiv({ cls: "ticktick-heatmap-grid-wrap" });
    const weekdaysCol = gridWrap.createDiv({ cls: "ticktick-heatmap-weekday-labels" });
    for (const name of WEEKDAY_NAMES) {
      weekdaysCol.createDiv({ cls: "ticktick-heatmap-weekday-label", text: name });
    }
    const colsContainer = gridWrap.createDiv({ cls: "ticktick-heatmap-columns-container" });
    const monthsRow = colsContainer.createDiv({ cls: "ticktick-heatmap-months-row" });
    for (const m of data.monthLabels) {
      const monthName = PERSIAN_MONTH_NAMES[m.monthCode] || m.monthCode;
      const monthPill = monthsRow.createSpan({ cls: "ticktick-heatmap-month-pill", text: monthName });
      monthPill.style.right = `${m.colIndex * 15}px`;
    }
    const weeksRow = colsContainer.createDiv({ cls: "ticktick-heatmap-weeks-row" });
    for (const week of data.weeks) {
      const col = weeksRow.createDiv({ cls: "ticktick-heatmap-week-col" });
      col.dataset.weekIndex = String(week.weekIndex);
      for (const day of week.days) {
        const cell = col.createDiv({
          cls: `ticktick-heatmap-cell is-level-${day.level} ${day.isFuture ? "is-future" : ""}`
        });
        cell.dataset.date = day.dateKey;
        cell.dataset.jalali = day.jalaliKey;
        cell.addEventListener("mouseenter", (e) => {
          this.showTooltip(e, day);
        });
        cell.addEventListener("mouseleave", () => {
          this.removeTooltip();
        });
      }
    }
    const legend = matrixCard.createDiv({ cls: "ticktick-heatmap-legend" });
    legend.createSpan({ text: "\u06A9\u0645\u062A\u0631" });
    const legendCells = legend.createDiv({ cls: "ticktick-heatmap-legend-cells" });
    for (let lvl = 0; lvl <= 4; lvl++) {
      legendCells.createDiv({ cls: `ticktick-heatmap-legend-cell is-level-${lvl}` });
    }
    legend.createSpan({ text: "\u0628\u06CC\u0634\u062A\u0631" });
  }
  renderKpi(parent, label, val) {
    const card = parent.createDiv({ cls: "ticktick-heatmap-kpi-card" });
    card.createDiv({ cls: "ticktick-heatmap-kpi-val", text: val });
    card.createDiv({ cls: "ticktick-heatmap-kpi-label", text: label });
  }
  showTooltip(e, day) {
    this.removeTooltip();
    const tooltip = document.body.createDiv({ cls: "ticktick-heatmap-tooltip" });
    this.tooltipEl = tooltip;
    const pDate = formatPersianDate(day.dateKey, this.host.timeZone);
    tooltip.createDiv({ cls: "ticktick-heatmap-tooltip-title", text: pDate });
    if (day.isFuture) {
      tooltip.createDiv({ text: "\u0631\u0648\u0632 \u0622\u06CC\u0646\u062F\u0647" });
    } else if (day.score === 0) {
      tooltip.createDiv({ text: "\u0628\u062F\u0648\u0646 \u0641\u0639\u0627\u0644\u06CC\u062A \u062B\u0628\u062A\u200C\u0634\u062F\u0647" });
    } else {
      tooltip.createDiv({
        cls: "ticktick-heatmap-tooltip-score",
        text: `${day.score} \u0641\u0639\u0627\u0644\u06CC\u062A (${day.tasks.length} \u062A\u0633\u06A9\u060C ${day.habits.length} \u0639\u0627\u062F\u062A)`
      });
      const list = tooltip.createDiv({ cls: "ticktick-heatmap-tooltip-list" });
      for (const t of day.tasks.slice(0, 5)) {
        list.createDiv({ text: `\u2713 ${t}` });
      }
      if (day.tasks.length > 5) {
        list.createDiv({ text: `\u0648 ${day.tasks.length - 5} \u062A\u0633\u06A9 \u062F\u06CC\u06AF\u0631\u2026` });
      }
      for (const h of day.habits.slice(0, 5)) {
        list.createDiv({ text: `\u{1F48E} ${h}` });
      }
    }
    const x = e.clientX + 10;
    const y = e.clientY + 10;
    tooltip.style.left = `${Math.min(window.innerWidth - 250, x)}px`;
    tooltip.style.top = `${Math.min(window.innerHeight - 150, y)}px`;
  }
  removeTooltip() {
    this.tooltipEl?.remove();
    this.tooltipEl = null;
  }
};

// src/obsidian/views/activity-heatmap-view.ts
var ActivityHeatmapView = class extends import_obsidian37.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }
  heatmap;
  headerSlot;
  bodySlot;
  getViewType() {
    return HEATMAP_VIEW_TYPE;
  }
  getDisplayText() {
    return "\u0647\u06CC\u062A\u200C\u0645\u067E \u0641\u0639\u0627\u0644\u06CC\u062A \u0648 \u067E\u06CC\u0648\u0633\u062A\u06AF\u06CC \u0633\u0627\u0644\u0627\u0646\u0647";
  }
  getIcon() {
    return "flame";
  }
  async onOpen() {
    await this.render();
  }
  async render() {
    this.contentEl.addClass("ticktick-workspace-view-root");
    this.contentEl.addClass("ticktick-heatmap-view-container");
    if (!this.headerSlot || !this.bodySlot) {
      this.contentEl.empty();
      this.headerSlot = this.contentEl.createDiv({ cls: "ticktick-workspace-header-slot" });
      this.bodySlot = this.contentEl.createDiv({ cls: "ticktick-workspace-body-slot" });
      renderWorkspaceHeader(this.headerSlot, {
        plugin: this.plugin,
        leaf: this.leaf,
        activeViewType: this.getViewType()
      });
      this.heatmap = new ActivityHeatmap(this.bodySlot, this.plugin.activityHeatmapHost());
    }
    await this.heatmap?.render();
  }
  async onClose() {
    this.heatmap?.destroy();
    this.heatmap = void 0;
    this.headerSlot = void 0;
    this.bodySlot = void 0;
  }
};

// src/obsidian/query-block.ts
var import_obsidian38 = require("obsidian");

// src/core/query-engine.js
init_task_filter();
function parseQueryBlockSpec(rawText) {
  const spec = {
    title: null,
    project: null,
    tags: [],
    priority: null,
    status: "uncompleted",
    due: "any",
    search: null,
    sort: [{ field: "dueDate", order: "asc" }, { field: "priority", order: "desc" }],
    limit: 50,
    view: "list"
  };
  if (!rawText || typeof rawText !== "string") {
    return spec;
  }
  const lines = rawText.split("\n");
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const val = line.slice(colonIdx + 1).trim();
    const cleanVal = val.replace(/^["']|["']$/g, "").trim();
    switch (key) {
      case "title":
        spec.title = cleanVal;
        break;
      case "project":
        spec.project = cleanVal;
        break;
      case "tags":
      case "tag": {
        if (cleanVal.startsWith("[") && cleanVal.endsWith("]")) {
          const inner = cleanVal.slice(1, -1);
          spec.tags = inner.split(",").map((t) => t.trim().replace(/^["']|["']$/g, "").replace(/^#/, "")).filter(Boolean);
        } else {
          spec.tags = cleanVal.split(",").map((t) => t.trim().replace(/^["']|["']$/g, "").replace(/^#/, "")).filter(Boolean);
        }
        break;
      }
      case "priority":
        spec.priority = cleanVal.toLowerCase();
        break;
      case "status": {
        const s = cleanVal.toLowerCase();
        if (s === "completed" || s === "done") spec.status = "completed";
        else if (s === "all") spec.status = "all";
        else spec.status = "uncompleted";
        break;
      }
      case "due":
      case "date": {
        const d = cleanVal.toLowerCase();
        if (["today", "overdue", "tomorrow", "this-week", "unscheduled", "any"].includes(d)) {
          spec.due = /** @type {any} */
          d;
        }
        break;
      }
      case "search":
      case "query":
        spec.search = cleanVal;
        break;
      case "sort": {
        const sortTokens = cleanVal.split(",");
        const parsedSorts = [];
        for (const token of sortTokens) {
          const parts = token.trim().split(/\s+/);
          if (parts[0]) {
            parsedSorts.push({
              field: parts[0],
              order: parts[1] && parts[1].toLowerCase() === "desc" ? "desc" : "asc"
            });
          }
        }
        if (parsedSorts.length > 0) {
          spec.sort = parsedSorts;
        }
        break;
      }
      case "limit": {
        const parsedNum = parseInt(cleanVal, 10);
        if (!isNaN(parsedNum) && parsedNum > 0) {
          spec.limit = parsedNum;
        }
        break;
      }
      case "view":
      case "layout": {
        const v = cleanVal.toLowerCase();
        if (v === "compact" || v === "cards" || v === "list") {
          spec.view = v;
        }
        break;
      }
    }
  }
  return spec;
}
function matchesPriority(taskPriority2, filterStr) {
  if (!filterStr) return true;
  const p = Number(taskPriority2) || 0;
  const f = filterStr.trim().toLowerCase();
  if (f === "high") return p === 5;
  if (f === "medium" || f === "med") return p === 3;
  if (f === "low") return p === 1;
  if (f === "none") return p === 0;
  if (f.startsWith(">=")) {
    const num = parseInt(f.slice(2), 10);
    return !isNaN(num) && p >= num;
  }
  if (f.startsWith(">")) {
    const num = parseInt(f.slice(1), 10);
    return !isNaN(num) && p > num;
  }
  if (f.startsWith("<=")) {
    const num = parseInt(f.slice(2), 10);
    return !isNaN(num) && p <= num;
  }
  if (f.startsWith("<")) {
    const num = parseInt(f.slice(1), 10);
    return !isNaN(num) && p < num;
  }
  const exact = parseInt(f, 10);
  if (!isNaN(exact)) {
    return p === exact;
  }
  return true;
}
function matchesDue(task, dueFilter, today) {
  if (dueFilter === "any") return true;
  const due = task.dueDate ? task.dueDate.slice(0, 10) : null;
  if (dueFilter === "unscheduled") {
    return !due;
  }
  if (!due) return false;
  if (dueFilter === "today") {
    return due === today;
  }
  if (dueFilter === "overdue") {
    return due < today;
  }
  if (dueFilter === "tomorrow") {
    const todayDate = /* @__PURE__ */ new Date(`${today}T00:00:00Z`);
    const tmrDate = new Date(todayDate.getTime() + 864e5);
    const tmrStr = tmrDate.toISOString().slice(0, 10);
    return due === tmrStr;
  }
  if (dueFilter === "this-week") {
    const todayDate = /* @__PURE__ */ new Date(`${today}T00:00:00Z`);
    const weekEnd = new Date(todayDate.getTime() + 7 * 864e5);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    return due >= today && due <= weekEndStr;
  }
  return true;
}
function executeTaskQuery(tasks, spec, options = {}) {
  const today = options.today || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const projectsMap = options.projectsMap || {};
  if (!Array.isArray(tasks)) {
    return { matchedTasks: [], totalCount: 0, spec };
  }
  const filtered = tasks.filter((task) => {
    if (spec.status === "uncompleted" && task.status !== 0) return false;
    if (spec.status === "completed" && task.status === 0) return false;
    if (spec.project) {
      const targetProj = spec.project.toLowerCase();
      const projId = (task.projectId || "").toLowerCase();
      const projName = (projectsMap[task.projectId] || "").toLowerCase();
      if (projId !== targetProj && projName !== targetProj) {
        return false;
      }
    }
    if (spec.tags && spec.tags.length > 0) {
      const taskTags = Array.isArray(task.tags) ? task.tags.map((t) => t.toLowerCase()) : [];
      const hasAll = spec.tags.every((st) => taskTags.includes(st.toLowerCase()));
      if (!hasAll) return false;
    }
    if (!matchesPriority(task.priority, spec.priority)) {
      return false;
    }
    if (!matchesDue(task, spec.due, today)) {
      return false;
    }
    if (spec.search) {
      const normSearch = normalizeSearchText(spec.search);
      const titleNorm = normalizeSearchText(task.title || "");
      const contentNorm = normalizeSearchText(task.content || "");
      if (!titleNorm.includes(normSearch) && !contentNorm.includes(normSearch)) {
        return false;
      }
    }
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    for (const s of spec.sort) {
      let valA = a[s.field];
      let valB = b[s.field];
      if (s.field === "priority") {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else if (s.field === "dueDate") {
        valA = valA || "9999-99-99";
        valB = valB || "9999-99-99";
      } else if (typeof valA === "string" && typeof valB === "string") {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }
      if (valA < valB) return s.order === "asc" ? -1 : 1;
      if (valA > valB) return s.order === "asc" ? 1 : -1;
    }
    return 0;
  });
  const totalCount = sorted.length;
  const matchedTasks = sorted.slice(0, spec.limit);
  return {
    matchedTasks,
    totalCount,
    spec
  };
}

// src/obsidian/query-block.ts
init_date();
var QueryBlockRenderer = class {
  constructor(host) {
    this.host = host;
  }
  async render(source, el, _ctx) {
    el.empty();
    el.addClass("ticktick-query-container");
    el.setAttribute("dir", "rtl");
    const spec = parseQueryBlockSpec(source);
    const today = todayInZone(this.host.timeZone);
    const projectsMap = {};
    for (const p of this.host.projects()) {
      projectsMap[p.id] = p.name;
    }
    const tasks = this.host.tasks();
    const result = executeTaskQuery(tasks, spec, {
      today,
      timeZone: this.host.timeZone,
      projectsMap
    });
    const typedTasks = result.matchedTasks;
    const headerEl = el.createDiv({ cls: "ticktick-query-header" });
    const titleText = spec.title || "\u0641\u0647\u0631\u0633\u062A \u062A\u0633\u06A9\u200C\u0647\u0627";
    const titleEl = headerEl.createDiv({ cls: "ticktick-query-title" });
    titleEl.setText(titleText);
    const countEl = headerEl.createSpan({ cls: "ticktick-query-count-badge" });
    countEl.setText(`${typedTasks.length} \u0627\u0632 ${result.totalCount}`);
    if (typedTasks.length === 0) {
      const emptyEl = el.createDiv({ cls: "ticktick-query-empty" });
      emptyEl.setText("\u0647\u06CC\u0686 \u062A\u0633\u06A9\u06CC \u0628\u0627 \u0641\u06CC\u0644\u062A\u0631\u0647\u0627\u06CC \u0645\u0634\u062E\u0635\u200C\u0634\u062F\u0647 \u06CC\u0627\u0641\u062A \u0646\u0634\u062F.");
      return;
    }
    const viewClass = spec.view === "cards" ? "ticktick-query-cards" : spec.view === "compact" ? "ticktick-query-compact" : "ticktick-query-list";
    const listEl = el.createDiv({ cls: `ticktick-query-body ${viewClass}` });
    for (const task of typedTasks) {
      const itemEl = listEl.createDiv({ cls: "ticktick-query-item" });
      if (task.priority === 5) itemEl.addClass("priority-high");
      else if (task.priority === 3) itemEl.addClass("priority-med");
      else if (task.priority === 1) itemEl.addClass("priority-low");
      const checkEl = itemEl.createEl("input", {
        type: "checkbox",
        cls: "task-list-item-checkbox ticktick-checkbox"
      });
      checkEl.checked = task.status !== 0;
      checkEl.addEventListener("change", async (e) => {
        e.stopPropagation();
        const markCompleted = checkEl.checked;
        try {
          if (markCompleted) {
            await this.host.complete(task);
            itemEl.addClass("is-completed");
            new import_obsidian38.Notice(`\u062A\u0633\u06A9 \u0627\u0646\u062C\u0627\u0645 \u0634\u062F: ${task.title}`);
          } else {
            if (this.host.updateTask) {
              await this.host.updateTask({ id: task.id, status: 0 });
            }
            task.status = 0;
            itemEl.removeClass("is-completed");
            new import_obsidian38.Notice(`\u062A\u0633\u06A9 \u0645\u062C\u062F\u062F\u0627\u064B \u0641\u0639\u0627\u0644 \u0634\u062F: ${task.title}`);
          }
        } catch (err) {
          checkEl.checked = !markCompleted;
          new import_obsidian38.Notice(`\u062E\u0637\u0627 \u062F\u0631 \u062A\u063A\u06CC\u06CC\u0631 \u0648\u0636\u0639\u06CC\u062A \u062A\u0633\u06A9: ${err.message}`);
        }
      });
      const contentEl = itemEl.createDiv({ cls: "ticktick-query-item-content" });
      const titleSpan = contentEl.createSpan({ cls: "ticktick-query-item-title" });
      titleSpan.setText(task.title || "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646");
      titleSpan.addEventListener("click", () => {
        new TaskDetailsModal(this.host.app, task, {
          edit: async (t) => {
            await this.host.edit(t);
          },
          load: async (t) => {
            const loaded = await this.host.load(t);
            return loaded || t;
          },
          complete: async () => {
            await this.host.complete(task);
          }
        }).open();
      });
      const metaRow = contentEl.createDiv({ cls: "ticktick-query-item-meta" });
      if (task.projectId && projectsMap[task.projectId]) {
        const projBadge = metaRow.createSpan({ cls: "ticktick-query-chip chip-project" });
        projBadge.setText(`\u{1F4C1} ${projectsMap[task.projectId]}`);
      }
      if (typeof task.priority === "number" && task.priority > 0) {
        const prioBadge = metaRow.createSpan({ cls: "ticktick-query-chip chip-priority" });
        const prioLabel = task.priority === 5 ? "\u{1F6A9} \u0628\u0627\u0644\u0627" : task.priority === 3 ? "\u{1F6A9} \u0645\u062A\u0648\u0633\u0637" : "\u{1F6A9} \u067E\u0627\u06CC\u06CC\u0646";
        prioBadge.setText(prioLabel);
      }
      if (task.dueDate) {
        const dueBadge = metaRow.createSpan({ cls: "ticktick-query-chip chip-due" });
        const dueStr = task.dueDate.slice(0, 10);
        const isOverdue = dueStr < today && task.status === 0;
        if (isOverdue) dueBadge.addClass("is-overdue");
        const dueLabel = dueStr === today ? "\u0627\u0645\u0631\u0648\u0632" : dueStr;
        dueBadge.setText(`\u{1F4C5} ${dueLabel}`);
      }
      if (Array.isArray(task.tags) && task.tags.length > 0) {
        for (const tag of task.tags) {
          const tagBadge = metaRow.createSpan({ cls: "ticktick-query-chip chip-tag" });
          tagBadge.setText(`#${tag}`);
        }
      }
    }
  }
};

// src/obsidian/editor-suggest.ts
var import_obsidian39 = require("obsidian");

// src/core/editor-suggest-matcher.js
init_task_filter();
var SUGGEST_TRIGGERS = ["[[tt:", "@task:", "#tt:"];
function extractSuggestQuery(lineText, cursorCh) {
  if (typeof lineText !== "string" || cursorCh < 0) return null;
  const textBeforeCursor = lineText.slice(0, cursorCh);
  for (const trigger of SUGGEST_TRIGGERS) {
    const lastIndex = textBeforeCursor.lastIndexOf(trigger);
    if (lastIndex !== -1) {
      const candidate = textBeforeCursor.slice(lastIndex + trigger.length);
      if (!candidate.includes("]]") && !candidate.includes("\n")) {
        return {
          query: candidate.trim(),
          startCh: lastIndex,
          endCh: cursorCh,
          trigger
        };
      }
    }
  }
  return null;
}
function searchTasksForSuggest(tasks, rawQuery, options = {}) {
  const limit = options.limit || 10;
  const projectsMap = options.projectsMap || {};
  if (!Array.isArray(tasks)) return [];
  const query = (rawQuery || "").trim();
  const normQuery = normalizeSearchText(query);
  if (!normQuery) {
    return tasks.filter((t) => t.status === 0).sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0)).slice(0, limit);
  }
  const scored = [];
  for (const task of tasks) {
    if (task.status !== 0) continue;
    const normTitle = normalizeSearchText(task.title || "");
    const projName = projectsMap[task.projectId] || "";
    const normProj = normalizeSearchText(projName);
    const tagsStr = Array.isArray(task.tags) ? task.tags.join(" ") : "";
    const normTags = normalizeSearchText(tagsStr);
    let score = 0;
    if (normTitle.startsWith(normQuery)) {
      score += 100;
    } else if (normTitle.includes(normQuery)) {
      score += 50;
    }
    if (normTags.includes(normQuery)) {
      score += 30;
    }
    if (normProj.includes(normQuery)) {
      score += 20;
    }
    if (score > 0) {
      score += (Number(task.priority) || 0) * 2;
      scored.push({ task, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((item) => item.task);
}
function formatTaskMarkdownLink(task, options = {}) {
  const title = (task.title || "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646").replace(/[\[\]]/g, "");
  const id = String(task.id || "");
  if (options.protocol === "ticktick") {
    return `[\u{1F3AF} ${title}](ticktick://task/${id})`;
  }
  return `[\u{1F3AF} ${title}](obsidian://ticktick-bridge?taskId=${id})`;
}

// src/obsidian/editor-suggest.ts
var TickTickEditorSuggest = class extends import_obsidian39.EditorSuggest {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  onTrigger(cursor, editor, _file) {
    const line = editor.getLine(cursor.line);
    const match = extractSuggestQuery(line, cursor.ch);
    if (!match) return null;
    return {
      start: { line: cursor.line, ch: match.startCh },
      end: { line: cursor.line, ch: match.endCh },
      query: match.query
    };
  }
  getSuggestions(context) {
    const tasks = this.plugin.getCacheTasks();
    const projectsMap = {};
    for (const p of this.plugin.getCacheProjects()) {
      projectsMap[p.id] = p.name;
    }
    return searchTasksForSuggest(tasks, context.query, {
      limit: 10,
      projectsMap
    });
  }
  renderSuggestion(task, el) {
    el.empty();
    el.addClass("ticktick-suggest-item");
    el.setAttribute("dir", "rtl");
    const mainRow = el.createDiv({ cls: "suggest-main-row" });
    if (task.priority === 5) {
      mainRow.createSpan({ cls: "suggest-prio-flag prio-high", text: "\u{1F6A9}" });
    } else if (task.priority === 3) {
      mainRow.createSpan({ cls: "suggest-prio-flag prio-med", text: "\u{1F6A9}" });
    } else if (task.priority === 1) {
      mainRow.createSpan({ cls: "suggest-prio-flag prio-low", text: "\u{1F6A9}" });
    }
    const titleSpan = mainRow.createSpan({ cls: "suggest-task-title", text: task.title || "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646" });
    const metaRow = el.createDiv({ cls: "suggest-meta-row" });
    if (task.projectId) {
      const proj = this.plugin.getCacheProjects().find((p) => p.id === task.projectId);
      if (proj) {
        metaRow.createSpan({ cls: "suggest-chip chip-project", text: `\u{1F4C1} ${proj.name}` });
      }
    }
    if (task.dueDate) {
      const dueStr = task.dueDate.slice(0, 10);
      metaRow.createSpan({ cls: "suggest-chip chip-due", text: `\u{1F4C5} ${dueStr}` });
    }
    if (Array.isArray(task.tags) && task.tags.length > 0) {
      for (const t of task.tags.slice(0, 3)) {
        metaRow.createSpan({ cls: "suggest-chip chip-tag", text: `#${t}` });
      }
    }
  }
  selectSuggestion(task, _evt) {
    if (!this.context) return;
    const link = formatTaskMarkdownLink(task);
    this.context.editor.replaceRange(link, this.context.start, this.context.end);
  }
};

// src/obsidian/canvas-exporter.ts
var import_obsidian40 = require("obsidian");

// src/core/canvas-exporter.js
function getPriorityCanvasColor(priority) {
  const p = Number(priority) || 0;
  if (p === 5) return "1";
  if (p === 3) return "2";
  if (p === 1) return "5";
  return "4";
}
function formatTaskCanvasText(task, projectsMap = {}) {
  const lines = [];
  const isDone = Number(task.status ?? 0) !== 0;
  const statusMark = isDone ? "~~[x]" : "[ ]";
  const closeMark = isDone ? "~~" : "";
  const title = (task.title || "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646").replace(/[\[\]]/g, "");
  lines.push(`### ${statusMark} ${title}${closeMark}`);
  const meta = [];
  if (task.priority === 5) meta.push("\u{1F6A9} \u0628\u0627\u0644\u0627");
  else if (task.priority === 3) meta.push("\u{1F6A9} \u0645\u062A\u0648\u0633\u0637");
  else if (task.priority === 1) meta.push("\u{1F6A9} \u067E\u0627\u06CC\u06CC\u0646");
  if (task.dueDate) {
    meta.push(`\u{1F4C5} ${task.dueDate.slice(0, 10)}`);
  }
  if (task.projectId && projectsMap[task.projectId]) {
    meta.push(`\u{1F4C1} ${projectsMap[task.projectId]}`);
  }
  if (Array.isArray(task.tags) && task.tags.length > 0) {
    meta.push(task.tags.map((t) => `#${t}`).join(" "));
  }
  if (meta.length > 0) {
    lines.push(`> ${meta.join(" \u2022 ")}`);
  }
  if (task.content && task.content.trim()) {
    lines.push("");
    lines.push(task.content.trim().slice(0, 140));
  }
  return lines.join("\n");
}
function generateCanvasFromTasks(tasks, options = {}) {
  const groupBy = options.groupBy || "projects";
  const projectsMap = options.projectsMap || {};
  const today = options.today || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const nodes = [];
  const edges = [];
  const COLUMN_WIDTH = 340;
  const COLUMN_GAP = 80;
  const CARD_WIDTH = 300;
  const CARD_HEIGHT = 150;
  const CARD_GAP = 20;
  const TOP_PADDING = 70;
  const SIDE_PADDING = 20;
  const groups = /* @__PURE__ */ new Map();
  if (groupBy === "eisenhower") {
    const partitioned = partitionEisenhowerMatrix(tasks, { today });
    groups.set("Q1", { label: "\u{1F525} Q1: \u0641\u0648\u0631\u06CC \u0648 \u0645\u0647\u0645 (Do First)", color: "1", tasks: partitioned.q1 || [] });
    groups.set("Q2", { label: "\u{1F3AF} Q2: \u0645\u0647\u0645\u060C \u063A\u06CC\u0631\u0641\u0648\u0631\u06CC (Schedule)", color: "2", tasks: partitioned.q2 || [] });
    groups.set("Q3", { label: "\u26A1 Q3: \u0641\u0648\u0631\u06CC\u060C \u063A\u06CC\u0631\u0645\u0647\u0645 (Delegate)", color: "5", tasks: partitioned.q3 || [] });
    groups.set("Q4", { label: "\u{1F4E6} Q4: \u063A\u06CC\u0631\u0627\u0648\u0644\u0648\u06CC\u062A / \u0628\u06A9\u200C\u0644\u0627\u06AF (Backlog)", color: "4", tasks: partitioned.q4 || [] });
  } else if (groupBy === "status") {
    const uncompleted = tasks.filter((t) => t.status === 0);
    const completed = tasks.filter((t) => t.status !== 0);
    groups.set("todo", { label: "\u23F3 \u062F\u0631 \u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0646\u062C\u0627\u0645 (To Do)", color: "2", tasks: uncompleted });
    groups.set("done", { label: "\u2705 \u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647 (Completed)", color: "4", tasks: completed });
  } else {
    const projGroups = /* @__PURE__ */ new Map();
    const inboxTasks = [];
    for (const t of tasks) {
      if (t.projectId && projectsMap[t.projectId]) {
        if (!projGroups.has(t.projectId)) {
          projGroups.set(t.projectId, []);
        }
        projGroups.get(t.projectId).push(t);
      } else {
        inboxTasks.push(t);
      }
    }
    if (inboxTasks.length > 0) {
      groups.set("inbox", { label: "\u{1F4E5} \u0627\u06CC\u0646\u0628\u0627\u06A9\u0633 (Inbox)", color: "5", tasks: inboxTasks });
    }
    for (const [projId, pTasks] of projGroups) {
      const projName = projectsMap[projId] || "\u067E\u0631\u0648\u0698\u0647";
      groups.set(projId, { label: `\u{1F4C1} ${projName}`, color: "6", tasks: pTasks });
    }
  }
  let currentX = 0;
  const taskNodeMap = /* @__PURE__ */ new Map();
  for (const [groupId, group] of groups) {
    const taskCount = group.tasks.length;
    const groupHeight = Math.max(300, TOP_PADDING + taskCount * (CARD_HEIGHT + CARD_GAP) + 20);
    const groupNodeId = `group-${groupId}`;
    nodes.push({
      id: groupNodeId,
      x: currentX,
      y: 0,
      width: COLUMN_WIDTH,
      height: groupHeight,
      type: "group",
      label: group.label,
      color: group.color
    });
    let currentY = TOP_PADDING;
    for (const task of group.tasks) {
      const cardNodeId = `task-${task.id}`;
      taskNodeMap.set(String(task.id), cardNodeId);
      nodes.push({
        id: cardNodeId,
        x: currentX + SIDE_PADDING,
        y: currentY,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        type: "text",
        text: formatTaskCanvasText(task, projectsMap),
        color: getPriorityCanvasColor(task.priority)
      });
      currentY += CARD_HEIGHT + CARD_GAP;
    }
    currentX += COLUMN_WIDTH + COLUMN_GAP;
  }
  let edgeCounter = 1;
  for (const task of tasks) {
    if (task.parentId && taskNodeMap.has(String(task.parentId)) && taskNodeMap.has(String(task.id))) {
      edges.push({
        id: `edge-${edgeCounter++}`,
        fromNode: taskNodeMap.get(String(task.parentId)),
        toNode: taskNodeMap.get(String(task.id)),
        fromSide: "bottom",
        toSide: "top",
        label: "\u0632\u06CC\u0631\u062A\u0633\u06A9"
      });
    }
  }
  return {
    nodes,
    edges
  };
}

// src/obsidian/canvas-exporter.ts
init_date();
var CanvasExportModal = class extends import_obsidian40.Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }
  groupBy = "projects";
  fileName = "TickTick Tasks Board.canvas";
  includeCompleted = false;
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("ticktick-canvas-modal");
    contentEl.setAttribute("dir", "rtl");
    contentEl.createEl("h2", { text: "\u{1F3A8} \u062E\u0631\u0648\u062C\u06CC \u06AF\u0631\u0641\u062A\u0646 \u0628\u0648\u0645 \u0628\u0635\u0631\u06CC (Obsidian Canvas)" });
    contentEl.createEl("p", {
      text: "\u062A\u0628\u062F\u06CC\u0644 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC TickTick \u0628\u0647 \u06A9\u0627\u0631\u062A\u200C\u0647\u0627\u06CC \u062A\u0639\u0627\u0645\u0644\u06CC \u0648 \u0645\u062A\u0635\u0644 \u0628\u0647 \u0647\u0645 \u062F\u0631 \u0628\u0648\u0645 \u0628\u0635\u0631\u06CC Obsidian.",
      cls: "setting-item-description"
    });
    new import_obsidian40.Setting(contentEl).setName("\u0646\u062D\u0648\u0647 \u062F\u0633\u062A\u0647\u200C\u0628\u0646\u062F\u06CC \u0633\u062A\u0648\u0646\u200C\u0647\u0627").setDesc("\u06A9\u0627\u0631\u062A\u200C\u0647\u0627 \u062F\u0631 \u0686\u0647 \u0633\u062A\u0648\u0646\u200C\u0647\u0627 \u06CC\u0627 \u06A9\u0627\u062F\u0631\u0647\u0627\u06CC\u06CC \u0642\u0631\u0627\u0631 \u06AF\u06CC\u0631\u0646\u062F").addDropdown((dd) => {
      dd.addOption("projects", "\u{1F4C1} \u0628\u0631 \u0627\u0633\u0627\u0633 \u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627 (Projects)");
      dd.addOption("eisenhower", "\u{1F525} \u0628\u0631 \u0627\u0633\u0627\u0633 \u0645\u0627\u062A\u0631\u06CC\u0633 \u0622\u06CC\u0632\u0646\u0647\u0627\u0648\u0631 (Eisenhower Matrix)");
      dd.addOption("status", "\u23F3 \u0628\u0631 \u0627\u0633\u0627\u0633 \u0648\u0636\u0639\u06CC\u062A (To Do / Done)");
      dd.setValue(this.groupBy);
      dd.onChange((val) => {
        this.groupBy = val;
      });
    });
    new import_obsidian40.Setting(contentEl).setName("\u0646\u0627\u0645 \u0641\u0627\u06CC\u0644 \u0628\u0648\u0645").setDesc("\u0645\u0633\u06CC\u0631 \u0641\u0627\u06CC\u0644 \u062E\u0631\u0648\u062C\u06CC \u0628\u0627 \u067E\u0633\u0648\u0646\u062F .canvas").addText((text) => {
      text.setValue(this.fileName);
      text.onChange((val) => {
        this.fileName = val.trim();
      });
    });
    new import_obsidian40.Setting(contentEl).setName("\u0634\u0627\u0645\u0644 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647").setDesc("\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u0646\u062C\u0627\u0645\u200C\u0634\u062F\u0647 \u0646\u06CC\u0632 \u0628\u0647 \u0628\u0648\u0645 \u0627\u0636\u0627\u0641\u0647 \u0634\u0648\u0646\u062F").addToggle((toggle) => {
      toggle.setValue(this.includeCompleted);
      toggle.onChange((val) => {
        this.includeCompleted = val;
      });
    });
    const footerEl = contentEl.createDiv({ cls: "modal-button-container" });
    const exportBtn = footerEl.createEl("button", {
      text: "\u{1F3A8} \u0627\u06CC\u062C\u0627\u062F \u0648 \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 Canvas",
      cls: "mod-cta"
    });
    exportBtn.onclick = async () => {
      exportBtn.disabled = true;
      exportBtn.setText("\u062F\u0631 \u062D\u0627\u0644 \u062A\u0648\u0644\u06CC\u062F \u0628\u0648\u0645...");
      try {
        await this.performExport();
        this.close();
      } catch (err) {
        new import_obsidian40.Notice(`\u062E\u0637\u0627 \u062F\u0631 \u0627\u06CC\u062C\u0627\u062F Canvas: ${err.message}`);
        exportBtn.disabled = false;
        exportBtn.setText("\u{1F3A8} \u0627\u06CC\u062C\u0627\u062F \u0648 \u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 Canvas");
      }
    };
    const cancelBtn = footerEl.createEl("button", { text: "\u0627\u0646\u0635\u0631\u0627\u0641" });
    cancelBtn.onclick = () => this.close();
  }
  async performExport() {
    const rawTasks = this.plugin.getCacheTasks();
    const tasks = this.includeCompleted ? rawTasks : rawTasks.filter((t) => t.status === 0);
    const projectsMap = {};
    for (const p of this.plugin.getCacheProjects()) {
      projectsMap[p.id] = p.name;
    }
    const today = todayInZone(this.plugin.settings.timeZone);
    const canvasData = generateCanvasFromTasks(tasks, {
      groupBy: this.groupBy,
      projectsMap,
      today
    });
    const jsonText = JSON.stringify(canvasData, null, 2);
    let targetPath = this.fileName;
    if (!targetPath.endsWith(".canvas")) {
      targetPath += ".canvas";
    }
    let file = this.app.vault.getAbstractFileByPath(targetPath);
    if (file instanceof import_obsidian40.TFile) {
      await this.app.vault.modify(file, jsonText);
      new import_obsidian40.Notice(`\u0628\u0648\u0645 \u0628\u0635\u0631\u06CC ${targetPath} \u0628\u0647\u200C\u0631\u0648\u0632\u0631\u0633\u0627\u0646\u06CC \u0634\u062F.`);
    } else {
      file = await this.app.vault.create(targetPath, jsonText);
      new import_obsidian40.Notice(`\u0628\u0648\u0645 \u0628\u0635\u0631\u06CC ${targetPath} \u0628\u0627 \u0645\u0648\u0641\u0642\u06CC\u062A \u0627\u06CC\u062C\u0627\u062F \u0634\u062F.`);
    }
    if (file instanceof import_obsidian40.TFile) {
      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.openFile(file);
    }
  }
  onClose() {
    this.contentEl.empty();
  }
};

// src/obsidian/reminder-service.ts
var import_obsidian41 = require("obsidian");

// src/core/reminder-daemon.js
init_date();
function checkDueReminders(tasks, options) {
  const today = options.today || todayInZone(options.timeZone || "Asia/Tehran");
  const currentMinutes = options.currentMinutes;
  const leadMinutes = Number(options.leadMinutes ?? 5);
  const timeZone = options.timeZone || "Asia/Tehran";
  const ackSet = options.acknowledgedIds instanceof Set ? options.acknowledgedIds : new Set(options.acknowledgedIds || []);
  if (!Array.isArray(tasks) || typeof currentMinutes !== "number") {
    return [];
  }
  const alerts = [];
  for (const task of tasks) {
    if (!task || task.status !== 0) continue;
    if (ackSet.has(String(task.id))) continue;
    const timeRange = extractTaskTimeRange(task, today, { timeZone });
    if (!timeRange) continue;
    const alertTargetMin = task.startDate ? timeRange.startMinutes : timeRange.endMinutes;
    const diff = alertTargetMin - currentMinutes;
    if (diff <= leadMinutes && diff >= -15) {
      alerts.push({
        task,
        dueMinutes: alertTargetMin,
        diffMinutes: diff
      });
    }
  }
  return alerts;
}
function computeSnoozeMutation(task, today, currentMinutes, snoozeMinutes = 15, timeZone = "Asia/Tehran") {
  const newStartMin = Math.min(1439, currentMinutes + snoozeMinutes);
  const newEndMin = Math.min(1439, newStartMin + 30);
  const tzOffset = "+0330";
  const startFormatted = minutesToTimeString(newStartMin);
  const endFormatted = minutesToTimeString(newEndMin);
  return {
    id: String(task.id),
    projectId: task.projectId,
    startDate: `${today}T${startFormatted}:00${tzOffset}`,
    dueDate: `${today}T${endFormatted}:00${tzOffset}`,
    isAllDay: false,
    timeZone
  };
}

// src/obsidian/reminder-service.ts
init_date();
var ReminderService = class {
  constructor(plugin) {
    this.plugin = plugin;
  }
  timer = null;
  acknowledgedIds = /* @__PURE__ */ new Set();
  start() {
    this.stop();
    window.setTimeout(() => this.check(), 5e3);
    this.timer = window.setInterval(() => this.check(), 3e4);
  }
  stop() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }
  check() {
    if (this.plugin.settings.enableDueReminders === false) {
      return;
    }
    const tasks = this.plugin.getCacheTasks();
    const timeZone = this.plugin.settings.timeZone || "Asia/Tehran";
    const today = todayInZone(timeZone);
    const now = /* @__PURE__ */ new Date();
    const timeParts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      minute: "numeric",
      hour12: false
    }).formatToParts(now);
    const hourPart = timeParts.find((p) => p.type === "hour")?.value ?? "0";
    const minPart = timeParts.find((p) => p.type === "minute")?.value ?? "0";
    const currentMinutes = parseInt(hourPart, 10) * 60 + parseInt(minPart, 10);
    const alerts = checkDueReminders(tasks, {
      today,
      currentMinutes,
      acknowledgedIds: this.acknowledgedIds,
      leadMinutes: this.plugin.settings.reminderLeadMinutes ?? 5,
      timeZone
    });
    for (const alert of alerts) {
      const task = alert.task;
      this.acknowledgedIds.add(String(task.id));
      if (this.plugin.settings.enableReminderChime !== false) {
        this.playReminderChime();
      }
      this.showReminderNotice(task, alert.diffMinutes, today, currentMinutes);
    }
  }
  playReminderChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(1e-3, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.12);
      gain2.gain.setValueAtTime(0.15, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(1e-3, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.55);
    } catch {
    }
  }
  showReminderNotice(task, diffMinutes, today, currentMinutes) {
    const notice = new import_obsidian41.Notice("", 2e4);
    const el = notice.noticeEl;
    el.empty();
    el.addClass("ticktick-reminder-notice");
    el.setAttribute("dir", "rtl");
    const titleEl = el.createDiv({ cls: "reminder-notice-title" });
    titleEl.setText(`\u23F0 \u06CC\u0627\u062F\u0622\u0648\u0631\u06CC \u0633\u0631\u0631\u0633\u06CC\u062F: ${task.title || "\u0628\u062F\u0648\u0646 \u0639\u0646\u0648\u0627\u0646"}`);
    const diffText = diffMinutes <= 0 ? "\u0647\u0645\u200C\u0627\u06A9\u0646\u0648\u0646" : `\u062A\u0627 ${diffMinutes} \u062F\u0642\u06CC\u0642\u0647 \u062F\u06CC\u06AF\u0631`;
    const metaEl = el.createDiv({ cls: "reminder-notice-meta" });
    metaEl.setText(`\u0645\u0648\u0639\u062F \u0633\u0631\u0631\u0633\u06CC\u062F: ${diffText}`);
    const btnRow = el.createDiv({ cls: "reminder-notice-buttons" });
    const completeBtn = btnRow.createEl("button", { text: "\u2705 \u0627\u0646\u062C\u0627\u0645 \u0634\u062F", cls: "mod-cta" });
    completeBtn.onclick = async () => {
      notice.hide();
      await this.plugin.completeTask(task);
      new import_obsidian41.Notice(`\u062A\u0633\u06A9 \u0627\u0646\u062C\u0627\u0645 \u0634\u062F: ${task.title}`);
    };
    const snoozeBtn = btnRow.createEl("button", { text: "\u{1F4A4} \u062A\u0639\u0648\u06CC\u0642 \u06F1\u06F5 \u062F" });
    snoozeBtn.onclick = async () => {
      notice.hide();
      const mutation = computeSnoozeMutation(task, today, currentMinutes, 15, this.plugin.settings.timeZone);
      await this.plugin.updateTask(mutation);
      new import_obsidian41.Notice(`\u062A\u0633\u06A9 \u06F1\u06F5 \u062F\u0642\u06CC\u0642\u0647 \u0628\u0647 \u062A\u0639\u0648\u06CC\u0642 \u0627\u0641\u062A\u0627\u062F: ${task.title}`);
    };
    const dismissBtn = btnRow.createEl("button", { text: "\u2715" });
    dismissBtn.onclick = () => {
      notice.hide();
    };
  }
};

// src/obsidian/settings.ts
var import_obsidian45 = require("obsidian");
init_date();

// src/obsidian/modals/web-login-modal.ts
var import_obsidian42 = require("obsidian");
var TickTickWebLoginModal = class extends import_obsidian42.Modal {
  resolveResult;
  result = new Promise((resolve) => this.resolveResult = resolve);
  submitted = false;
  onOpen() {
    this.contentEl.addClass("ticktick-login-modal");
    this.contentEl.createEl("h2", { text: "\u0648\u0631\u0648\u062F \u0645\u0633\u062A\u0642\u06CC\u0645 \u0628\u0647 TickTick" });
    this.contentEl.createEl("p", { text: "\u0631\u0645\u0632 \u0641\u0642\u0637 \u0628\u0631\u0627\u06CC \u062F\u0631\u06CC\u0627\u0641\u062A \u0646\u0634\u0633\u062A TickTick \u0627\u0633\u062A\u0641\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u062F\u0631 Obsidian \u0630\u062E\u06CC\u0631\u0647 \u0646\u062E\u0648\u0627\u0647\u062F \u0634\u062F." });
    let username = "";
    let password = "";
    new import_obsidian42.Setting(this.contentEl).setName("\u0627\u06CC\u0645\u06CC\u0644 \u06CC\u0627 \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC").addText((input) => {
      input.inputEl.autocomplete = "username";
      input.inputEl.addClass("ticktick-input-full-width");
      input.onChange((value) => username = value);
    });
    new import_obsidian42.Setting(this.contentEl).setName("\u0631\u0645\u0632 \u0639\u0628\u0648\u0631").addText((input) => {
      input.inputEl.type = "password";
      input.inputEl.autocomplete = "current-password";
      input.inputEl.addClass("ticktick-input-full-width");
      input.onChange((value) => password = value);
    });
    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "\u0627\u0646\u0635\u0631\u0627\u0641" }).addEventListener("click", () => this.finish(null));
    actions.createEl("button", { text: "\u0648\u0631\u0648\u062F \u0648 \u0627\u062A\u0635\u0627\u0644", cls: "mod-cta" }).addEventListener("click", () => {
      if (!username.trim() || !password) {
        new import_obsidian42.Notice("\u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648 \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0631\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646.");
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
var import_obsidian43 = require("obsidian");
var LegacyBackupMigrationModal = class extends import_obsidian43.Modal {
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
var import_obsidian44 = require("obsidian");
var ManagedReportModal = class extends import_obsidian44.Modal {
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
var TickTickBridgeSettings = class extends import_obsidian45.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian45.Setting(containerEl).setName("\u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0627\u062A\u0635\u0627\u0644 \u0648 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC").setHeading();
    const cachedAt = this.plugin.cacheSnapshotTime();
    new import_obsidian45.Setting(containerEl).setName("\u0646\u0633\u062E\u0647\u0654 \u0645\u062D\u0644\u06CC \u062F\u0627\u062F\u0647\u200C\u0647\u0627").setDesc(cachedAt ? `\u0622\u062E\u0631\u06CC\u0646 \u062F\u0631\u06CC\u0627\u0641\u062A: ${cachedAt} \u2014 \u067E\u0646\u0644\u200C\u0647\u0627 \u0627\u0628\u062A\u062F\u0627 \u0627\u0632 \u0627\u06CC\u0646 \u0646\u0633\u062E\u0647\u0654 \u0633\u0631\u06CC\u0639 \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F.` : "\u0647\u0646\u0648\u0632 \u0646\u0633\u062E\u0647\u0654 \u0645\u062D\u0644\u06CC \u0633\u0627\u062E\u062A\u0647 \u0646\u0634\u062F\u0647 \u0627\u0633\u062A. \u06CC\u06A9\u200C\u0628\u0627\u0631 \xAB\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0627\u0644\u0622\u0646\xBB \u0631\u0627 \u0628\u0632\u0646.");
    new import_obsidian45.Setting(containerEl).setName("\u0645\u0631\u06A9\u0632 \u0633\u0627\u062F\u0647\u0654 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC").setDesc("\u06CC\u06A9 \u0635\u0641\u062D\u0647\u0654 \u06A9\u0627\u0645\u0644 \u0628\u0631\u0627\u06CC sync \u0639\u0627\u062F\u06CC\u060C preview/apply Markdown \u0648 \u062D\u0644 \u062A\u0639\u0627\u0631\u0636\u200C\u0647\u0627.").addButton((button) => button.setButtonText("\u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u0645\u0631\u06A9\u0632 Sync").setCta().onClick(() => void this.plugin.openControlPage("sync")));
    if (this.plugin.cacheConflictCount()) new import_obsidian45.Setting(containerEl).setName("\u062A\u062F\u0627\u062E\u0644\u200C\u0647\u0627\u06CC \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC").setDesc(`${this.plugin.cacheConflictCount()} \u062A\u063A\u06CC\u06CC\u0631 \u0622\u0641\u0644\u0627\u06CC\u0646 \u062F\u0631 TickTick \u0642\u0627\u0628\u0644 \u0627\u0639\u0645\u0627\u0644 \u0646\u0628\u0648\u062F \u0648 \u0628\u0631\u0627\u06CC \u062C\u0644\u0648\u06AF\u06CC\u0631\u06CC \u0627\u0632 \u0628\u0627\u0632\u0646\u0648\u06CC\u0633\u06CC \u062F\u0627\u062F\u0647\u0654 \u062C\u062F\u06CC\u062F\u060C \u0646\u06AF\u0647 \u062F\u0627\u0634\u062A\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A.`);
    new import_obsidian45.Setting(containerEl).setName("\u0641\u0636\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A\u200C\u0634\u062F\u0647\u0654 TickTick").setDesc(`/.ticktick/ \u2014 \u0646\u0633\u062E\u0647\u200C\u0647\u0627\u06CC \u067E\u0634\u062A\u06CC\u0628\u0627\u0646 \u062A\u0627 \u06F1\u06F0 \u0631\u0648\u0632 \u062A\u0642\u0648\u06CC\u0645\u06CC UTC \u0646\u06AF\u0647 \u062F\u0627\u0634\u062A\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F. \u0622\u062E\u0631\u06CC\u0646 \u06AF\u0632\u0627\u0631\u0634: ${this.plugin.managedStorageReport()}`);
    new import_obsidian45.Setting(containerEl).setName("\u0622\u062E\u0631\u06CC\u0646 \u06AF\u0632\u0627\u0631\u0634 \u0645\u062F\u06CC\u0631\u06CC\u062A\u200C\u0634\u062F\u0647").setDesc("\u0622\u062E\u0631\u06CC\u0646 \u06AF\u0632\u0627\u0631\u0634 \u063A\u06CC\u0631\u0645\u062D\u0631\u0645\u0627\u0646\u0647\u0654 \u0639\u0645\u0644\u06CC\u0627\u062A \u0630\u062E\u06CC\u0631\u0647\u200C\u0634\u062F\u0647 \u062F\u0631 .ticktick/reports/ \u0631\u0627 \u0646\u0645\u0627\u06CC\u0634 \u0645\u06CC\u200C\u062F\u0647\u062F.").addButton((button) => button.setButtonText("\u0628\u0627\u0632 \u06A9\u0631\u062F\u0646 \u06AF\u0632\u0627\u0631\u0634 \u0622\u062E\u0631").onClick(async () => {
      button.setDisabled(true);
      try {
        new ManagedReportModal(this.app, await this.plugin.latestManagedReport()).open();
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian45.Setting(containerEl).setName("\u0627\u0646\u062A\u0642\u0627\u0644 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u200C\u0647\u0627\u06CC \u0642\u062F\u06CC\u0645\u06CC \u0631\u06CC\u0634\u0647\u0654 Vault").setDesc("\u0641\u0642\u0637 \u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC \u062F\u0642\u06CC\u0642 ticktick-backup-*.csv \u0631\u0627 \u067E\u0633 \u0627\u0632 \u062A\u0623\u06CC\u06CC\u062F \u0648 \u0628\u0631\u0631\u0633\u06CC \u0637\u0648\u0644 \u0628\u0627\u06CC\u062A \u06A9\u067E\u06CC \u0645\u06CC\u200C\u06A9\u0646\u062F.").addButton((button) => button.setButtonText("Move legacy root backups").onClick(async () => {
      button.setDisabled(true);
      try {
        const files = await this.plugin.previewLegacyRootBackups();
        const size = files.reduce((total, file) => total + file.size, 0);
        if (!files.length) {
          new import_obsidian45.Notice("\u067E\u0634\u062A\u06CC\u0628\u0627\u0646 \u0642\u062F\u06CC\u0645\u06CC \u062F\u0631 \u0631\u06CC\u0634\u0647\u0654 Vault \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
          return;
        }
        const confirmed = await new LegacyBackupMigrationModal(this.app, files.length, size).openAndWait();
        if (!confirmed) return;
        const result = await this.plugin.migrateLegacyRootBackups();
        new import_obsidian45.Notice(`${result.migrated.length} \u0627\u0632 ${result.sources.length} \u067E\u0634\u062A\u06CC\u0628\u0627\u0646 \u0642\u062F\u06CC\u0645\u06CC \u0645\u0646\u062A\u0642\u0644 \u0634\u062F.`);
        this.display();
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian45.Setting(containerEl).setName("API Token").setDesc("\u062A\u0648\u06A9\u0646 \u0634\u062E\u0635\u06CC TickTick\u061B \u0641\u0642\u0637 \u062F\u0631 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0627\u0641\u0632\u0648\u0646\u0647 \u0646\u06AF\u0647\u062F\u0627\u0631\u06CC \u0645\u06CC\u200C\u0634\u0648\u062F.").addText((input) => {
      input.inputEl.type = "password";
      input.setValue(this.plugin.settings.apiToken).onChange(async (value) => {
        this.plugin.settings.apiToken = value.trim();
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian45.Setting(containerEl).setName("\u062A\u06AF \u0686\u06A9\u200C\u0628\u0627\u06A9\u0633 TickTick").setDesc("\u0686\u06A9\u200C\u0628\u0627\u06A9\u0633\u200C\u0647\u0627\u06CC \u062F\u0627\u0631\u0627\u06CC \u0627\u06CC\u0646 \u062A\u06AF \u0627\u0628\u062A\u062F\u0627 \u0641\u0642\u0637 \u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F\u061B \u0633\u067E\u0633 \u0628\u0627 \u0641\u0631\u0645\u0627\u0646 \u0627\u0639\u0645\u0627\u0644\u060C binding \u0627\u0645\u0646 TickTick \u0645\u06CC\u200C\u06AF\u06CC\u0631\u0646\u062F.").addText((input) => {
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
    new import_obsidian45.Setting(containerEl).setName("Checklist \u0648 Subtask \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC").setDesc("\u0641\u0639\u0644\u0627\u064B \u0641\u0642\u0637 \u062E\u0648\u0627\u0646\u062F\u0646\u06CC \u0627\u0633\u062A\u061B API \u0631\u0633\u0645\u06CC \u0628\u0631\u0627\u06CC \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0627\u0645\u0646 child item \u062A\u0623\u06CC\u06CC\u062F \u0646\u0634\u062F\u0647 \u0648 \u0647\u06CC\u0686 checkbox\u0627\u06CC \u062F\u0631 \u0627\u06CC\u0646 \u0628\u062E\u0634 \u0686\u06CC\u0632\u06CC \u0631\u0627 \u062A\u063A\u06CC\u06CC\u0631 \u0646\u0645\u06CC\u200C\u062F\u0647\u062F.").addToggle((toggle) => toggle.setValue(this.plugin.settings.experimentalChecklistReadOnly).setDisabled(true));
    new import_obsidian45.Setting(containerEl).setName("\u0627\u0646\u062A\u0642\u0627\u0644 TickTick Notes").setDesc("\u0641\u0642\u0637 Note\u0647\u0627\u06CC \u062F\u0627\u0631\u0627\u06CC kind: NOTE \u0631\u0627 \u067E\u0633 \u0627\u0632 \u0627\u0646\u062A\u062E\u0627\u0628 \u0634\u0645\u0627 \u062F\u0631 \u0641\u0648\u0644\u062F\u0631 \u0642\u0627\u0628\u0644\u200C\u0645\u0634\u0627\u0647\u062F\u0647 \u0648\u0627\u0631\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F\u061B \u06CC\u06A9\u200C\u0637\u0631\u0641\u0647 \u0648 \u0628\u062F\u0648\u0646 overwrite.").addText((input) => input.setValue(this.plugin.settings.ticktickNotesFolder).onChange(async (value) => {
      this.plugin.settings.ticktickNotesFolder = value.trim().replace(/^\/+|\/+$/g, "") || "TickTick Notes";
      await this.plugin.saveSettings();
    })).addButton((button) => button.setButtonText("\u0627\u0646\u062A\u062E\u0627\u0628 Note\u0647\u0627").onClick(() => void this.plugin.previewTickTickNotes()));
    const savedViews = this.plugin.settings.savedViews || [];
    const savedSetting = new import_obsidian45.Setting(containerEl).setName("\u0646\u0645\u0627\u0647\u0627\u06CC \u0630\u062E\u06CC\u0631\u0647\u200C\u0634\u062F\u0647 (Saved Views)").setDesc(`${savedViews.length} \u0646\u0645\u0627\u06CC \u0641\u06CC\u0644\u062A\u0631 \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F\u0647 \u0627\u0633\u062A. \u0627\u06CC\u0646 \u0646\u0645\u0627\u0647\u0627 \u062A\u0631\u06A9\u06CC\u0628\u200C\u0647\u0627\u06CC \u0633\u0631\u06CC\u0639 \u0641\u06CC\u0644\u062A\u0631\u0647\u0627 \u0648 \u062C\u0633\u062A\u200C\u0648\u062C\u0648 \u0631\u0627 \u062F\u0631 \u0628\u0631\u062F \u0648 \u062A\u0642\u0648\u06CC\u0645 \u0628\u0647 \u0627\u0634\u062A\u0631\u0627\u06A9 \u0645\u06CC\u200C\u06AF\u0630\u0627\u0631\u0646\u062F.`);
    if (savedViews.length) {
      savedSetting.addButton((btn) => btn.setButtonText("\u067E\u0627\u06A9\u200C\u0633\u0627\u0632\u06CC \u0647\u0645\u0647\u0654 \u0646\u0645\u0627\u0647\u0627").setWarning().onClick(async () => {
        this.plugin.settings.savedViews = [];
        await this.plugin.saveSettings();
        this.display();
        new import_obsidian45.Notice("\u0647\u0645\u0647\u0654 \u0646\u0645\u0627\u0647\u0627\u06CC \u0630\u062E\u06CC\u0631\u0647\u200C\u0634\u062F\u0647 \u067E\u0627\u06A9 \u0634\u062F\u0646\u062F.");
      }));
    }
    new import_obsidian45.Setting(containerEl).setName("\u0648\u0631\u0648\u062F \u0645\u0633\u062A\u0642\u0644 \u0628\u0631\u0627\u06CC \u0639\u0627\u062F\u062A\u200C\u0647\u0627").setDesc("\u0645\u0633\u062A\u0642\u06CC\u0645 \u0648\u0627\u0631\u062F TickTick \u0645\u06CC\u200C\u0634\u0648\u062F \u0648 \u0646\u0634\u0633\u062A \u0644\u0627\u0632\u0645 \u0631\u0627 \u062F\u0631 \u062E\u0648\u062F Bridge \u0646\u06AF\u0647 \u0645\u06CC\u200C\u062F\u0627\u0631\u062F. \u0646\u0627\u0645 \u06A9\u0627\u0631\u0628\u0631\u06CC \u0648 \u0631\u0645\u0632 \u0630\u062E\u06CC\u0631\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u0646\u062F.").addButton((button) => button.setButtonText("\u0648\u0631\u0648\u062F \u0628\u0647 TickTick").setCta().onClick(async () => {
      const credentials = await new TickTickWebLoginModal(this.app).openAndWait();
      if (!credentials) return;
      button.setDisabled(true);
      try {
        await this.plugin.loginToTickTickWeb(credentials.username, credentials.password);
        new import_obsidian45.Notice("\u0648\u0631\u0648\u062F \u0645\u0633\u062A\u0642\u0644 TickTick \u0627\u0646\u062C\u0627\u0645 \u0634\u062F. \u062D\u0627\u0644\u0627 \u0627\u062A\u0635\u0627\u0644 \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06CC\u0627 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u06A9\u0646.");
        this.display();
      } catch (error) {
        new import_obsidian45.Notice(error instanceof Error ? error.message : "\u0648\u0631\u0648\u062F \u0628\u0647 TickTick \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian45.Setting(containerEl).setName("\u0627\u062A\u0635\u0627\u0644 \u0622\u0633\u0627\u0646 \u0627\u0632 TickTickSync").setDesc("\u0646\u0634\u0633\u062A \u0641\u0639\u0627\u0644 TickTickSync \u0631\u0627 \u0648\u0627\u0631\u062F \u0645\u06CC\u200C\u06A9\u0646\u062F \u062A\u0627 \u0686\u06A9\u200C\u0627\u06CC\u0646 \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0641\u0648\u0631\u06CC \u0648 \u062F\u0642\u06CC\u0642 \u062E\u0648\u0627\u0646\u062F\u0647 \u0634\u0648\u0646\u062F. \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u062E\u0648\u0627\u0646\u062F\u0647\u060C \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u06CC\u0627 \u0630\u062E\u06CC\u0631\u0647 \u0646\u0645\u06CC\u200C\u0634\u0648\u062F.").addButton((button) => button.setButtonText("\u0648\u0627\u0631\u062F \u06A9\u0631\u062F\u0646 \u0627\u062A\u0635\u0627\u0644 TickTickSync").setCta().onClick(async () => {
      button.setDisabled(true);
      try {
        const result = await this.plugin.importTickTickSyncSession();
        new import_obsidian45.Notice(result.hasCookie ? "\u0627\u062A\u0635\u0627\u0644 TickTickSync \u0648\u0627\u0631\u062F \u0634\u062F." : "\u0627\u062A\u0635\u0627\u0644 TickTickSync \u0648\u0627\u0631\u062F \u0634\u062F\u061B \u062F\u0631 \u0635\u0648\u0631\u062A \u062E\u0637\u0627 \u06CC\u06A9\u200C\u0628\u0627\u0631 \u0627\u0641\u0632\u0648\u0646\u0647\u0654 \u0642\u062F\u06CC\u0645\u06CC \u0631\u0627 \u0628\u0627\u0632 \u06A9\u0646 \u0648 \u062F\u0648\u0628\u0627\u0631\u0647 \u0627\u0645\u062A\u062D\u0627\u0646 \u06A9\u0646.");
        this.display();
      } catch (error) {
        new import_obsidian45.Notice(error instanceof Error ? error.message : "\u0648\u0627\u0631\u062F \u06A9\u0631\u062F\u0646 \u0627\u062A\u0635\u0627\u0644 TickTickSync \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian45.Setting(containerEl).setName("Cookie \u062A\u06A9\u0645\u06CC\u0644\u06CC \u0648\u0628 (\u0627\u062E\u062A\u06CC\u0627\u0631\u06CC)").setDesc("\u0641\u0642\u0637 \u0627\u06AF\u0631 \u0627\u062A\u0635\u0627\u0644 \u062E\u0648\u062F\u06A9\u0627\u0631 \u062C\u0648\u0627\u0628 \u0646\u062F\u0627\u062F\u060C Cookie \u0646\u0634\u0633\u062A \u0648\u0628 TickTick \u0631\u0627 \u0627\u06CC\u0646\u062C\u0627 \u0648\u0627\u0631\u062F \u06A9\u0646. \u0627\u06CC\u0646 \u0645\u0642\u062F\u0627\u0631 \u0645\u0627\u0646\u0646\u062F \u0631\u0645\u0632 \u0639\u0628\u0648\u0631 \u0627\u0633\u062A.").addText((input) => {
      input.inputEl.type = "password";
      input.inputEl.addClass("ticktick-input-cookie");
      input.setValue(this.plugin.settings.webSessionCookie).onChange(async (value) => {
        this.plugin.settings.webSessionCookie = normalizeWebSessionCookie(value);
        await this.plugin.saveSettings();
      });
    });
    new import_obsidian45.Setting(containerEl).setName("\u0628\u0631\u0631\u0633\u06CC \u0627\u062A\u0635\u0627\u0644 \u0648\u0628 \u0639\u0627\u062F\u062A\u200C\u0647\u0627").setDesc("\u0686\u06A9\u200C\u0627\u06CC\u0646\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632 \u0631\u0627 \u0645\u0633\u062A\u0642\u06CC\u0645\u0627\u064B \u0627\u0632 \u0633\u0631\u0648\u06CC\u0633 \u0648\u0628 TickTick \u0645\u06CC\u200C\u062E\u0648\u0627\u0646\u062F.").addButton((button) => button.setButtonText("\u0627\u062A\u0635\u0627\u0644 \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646").onClick(async () => {
      button.setDisabled(true);
      try {
        const habits = await this.plugin.client().listHabits();
        const checkins = await this.plugin.webHabitCheckins(habits.map((habit) => habit.id), todayInZone(this.plugin.settings.timeZone));
        if (!checkins) throw new Error("\u0646\u0634\u0633\u062A \u0648\u0628 \u0645\u0639\u062A\u0628\u0631 \u0646\u06CC\u0633\u062A \u06CC\u0627 TickTick \u067E\u0627\u0633\u062E \u0646\u062F\u0627\u062F.");
        const count = [...checkins.values()].flat().filter((entry) => entry.status === 2).length;
        new import_obsidian45.Notice(`\u0627\u062A\u0635\u0627\u0644 \u0648\u0628 \u0628\u0631\u0642\u0631\u0627\u0631 \u0627\u0633\u062A: ${count} \u0686\u06A9\u200C\u0627\u06CC\u0646 \u0627\u0645\u0631\u0648\u0632 \u062E\u0648\u0627\u0646\u062F\u0647 \u0634\u062F.`);
      } catch (error) {
        new import_obsidian45.Notice(error instanceof Error ? error.message : "\u0627\u062A\u0635\u0627\u0644 \u0648\u0628 \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian45.Setting(containerEl).setName("\u0628\u0631\u0631\u0633\u06CC \u0627\u062A\u0635\u0627\u0644").setDesc("\u0628\u0627 \u062A\u0648\u06A9\u0646 \u0648\u0627\u0631\u062F\u0634\u062F\u0647\u060C \u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627 \u0648 \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0631\u0627 \u0627\u0632 TickTick \u0645\u06CC\u200C\u062E\u0648\u0627\u0646\u062F.").addButton((button) => button.setButtonText("\u0627\u062A\u0635\u0627\u0644 \u0631\u0627 \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646").onClick(async () => {
      button.setDisabled(true);
      try {
        const client = this.plugin.client();
        const [projects, habits] = await Promise.all([client.listProjects(), client.listHabits()]);
        new import_obsidian45.Notice(`\u0627\u062A\u0635\u0627\u0644 \u0628\u0631\u0642\u0631\u0627\u0631 \u0627\u0633\u062A: ${projects.length} \u067E\u0631\u0648\u0698\u0647 \u0648 ${habits.length} \u0639\u0627\u062F\u062A \u067E\u06CC\u062F\u0627 \u0634\u062F.`);
      } catch (error) {
        new import_obsidian45.Notice(error instanceof Error ? error.message : "\u0627\u062A\u0635\u0627\u0644 \u0628\u0647 TickTick \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian45.Setting(containerEl).setName("\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u062E\u0648\u062F\u06A9\u0627\u0631").setDesc("\u0641\u0627\u0635\u0644\u0647\u0654 \u0632\u0645\u0627\u0646\u06CC \u0628\u0631 \u062D\u0633\u0628 \u062B\u0627\u0646\u06CC\u0647 (\u067E\u06CC\u0634\u200C\u0641\u0631\u0636 \u0648 \u062D\u062F\u0627\u0642\u0644: \u06F3\u06F0 \u062B\u0627\u0646\u06CC\u0647). \u0635\u0641\u0631 \u06CC\u0639\u0646\u06CC \u062E\u0627\u0645\u0648\u0634. sync \u0628\u0639\u062F\u06CC \u0641\u0642\u0637 \u067E\u0633 \u0627\u0632 \u067E\u0627\u06CC\u0627\u0646 sync \u0642\u0628\u0644\u06CC \u0648 \u06AF\u0630\u0634\u062A \u0627\u06CC\u0646 \u0645\u062F\u062A \u0622\u063A\u0627\u0632 \u0645\u06CC\u200C\u0634\u0648\u062F.").addText((input) => {
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
    new import_obsidian45.Setting(containerEl).setName("\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u062F\u0633\u062A\u06CC").setDesc("\u0646\u0633\u062E\u0647\u0654 \u0645\u062D\u0644\u06CC \u062A\u0633\u06A9\u200C\u0647\u0627\u060C \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0648 \u062A\u0627\u0631\u06CC\u062E\u0686\u0647\u0654 \u06F9\u06F0 \u0631\u0648\u0632 \u0627\u062E\u06CC\u0631 \u0631\u0627 \u0647\u0645\u06CC\u0646 \u062D\u0627\u0644\u0627 \u0627\u0632 TickTick \u062A\u0627\u0632\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F.").addButton((button) => button.setButtonText("\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0627\u0644\u0622\u0646").onClick(async () => {
      button.setDisabled(true);
      try {
        await this.plugin.syncNow();
      } finally {
        button.setDisabled(false);
      }
    }));
    new import_obsidian45.Setting(containerEl).setName("\u062A\u0642\u0648\u06CC\u0645 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC").setDesc("\u0647\u0641\u062A\u0647 \u0648 \u0634\u0628\u06A9\u0647\u0654 \u0645\u0627\u0647 \u0647\u0645\u06CC\u0634\u0647 \u0627\u0632 \u0634\u0646\u0628\u0647 \u0634\u0631\u0648\u0639 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F \u0648 \u062A\u0633\u06A9 \u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647 \u0628\u0647\u200C\u0635\u0648\u0631\u062A \u067E\u06CC\u0634\u200C\u0641\u0631\u0636 \u067E\u0646\u0647\u0627\u0646 \u0627\u0633\u062A.").addToggle((toggle) => toggle.setValue(this.plugin.settings.plannerShowCompleted).setTooltip("\u0646\u0645\u0627\u06CC\u0634 \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u062A\u06A9\u0645\u06CC\u0644\u200C\u0634\u062F\u0647 \u062F\u0631 \u062A\u0642\u0648\u06CC\u0645").onChange(async (value) => {
      this.plugin.settings.plannerShowCompleted = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian45.Setting(containerEl).setName("\u0622\u06CC\u06A9\u0648\u0646\u200C\u0647\u0627\u06CC \u0627\u0636\u0627\u0641\u06CC \u0646\u0648\u0627\u0631 \u06A9\u0646\u0627\u0631\u06CC").setDesc("\u0622\u06CC\u06A9\u0648\u0646 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0647\u0645\u06CC\u0634\u0647 \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u062F. \u0628\u0627 \u0631\u0648\u0634\u0646\u200C\u06A9\u0631\u062F\u0646 \u0627\u06CC\u0646 \u06AF\u0632\u06CC\u0646\u0647\u060C \u0645\u06CC\u0627\u0646\u0628\u0631 \u062A\u0633\u06A9\u200C\u0647\u0627 \u0648 \u0639\u0627\u062F\u062A\u200C\u0647\u0627 \u0647\u0645 \u0646\u0645\u0627\u06CC\u0634 \u062F\u0627\u062F\u0647 \u0645\u06CC\u200C\u0634\u0648\u0646\u062F.").addToggle((toggle) => toggle.setValue(this.plugin.settings.showRibbonIcons).onChange(async (value) => {
      this.plugin.settings.showRibbonIcons = value;
      await this.plugin.saveSettings();
      this.plugin.configureRibbonIcons();
    }));
    new import_obsidian45.Setting(containerEl).setName("Time zone").addText((input) => input.setValue(this.plugin.settings.timeZone).onChange(async (value) => {
      this.plugin.settings.timeZone = value || "Asia/Tehran";
      await this.plugin.saveSettings();
    }));
    new import_obsidian45.Setting(containerEl).setName("Daily notes folder").addText((input) => input.setValue(this.plugin.settings.dailyNoteFolder).onChange(async (value) => {
      this.plugin.settings.dailyNoteFolder = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian45.Setting(containerEl).setName("\u0646\u0648\u0634\u062A\u0646 \u062F\u0631 \u0633\u0627\u062E\u062A\u0627\u0631 \u0633\u0644\u0633\u0644\u0647\u200C\u0645\u0631\u0627\u062A\u0628\u06CC \u0648 \u0632\u06CC\u0631\u062A\u0633\u06A9\u200C\u0647\u0627 (\u0622\u0632\u0645\u0627\u06CC\u0634\u06CC)").setDesc("\u0647\u0634\u062F\u0627\u0631: \u0633\u0627\u062E\u062A\u0627\u0631 API \u0632\u06CC\u0631\u062A\u0633\u06A9\u200C\u0647\u0627 \u062F\u0631 TickTick \u0628\u0647 \u0635\u0648\u0631\u062A \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u0627\u0633\u062A. \u062F\u0631 \u062D\u0627\u0644\u062A \u0639\u0627\u062F\u06CC \u0646\u0645\u0627\u06CC\u0634 \u0633\u0627\u062E\u062A\u0627\u0631 \u0641\u0642\u0637\u200C\u062E\u0648\u0627\u0646\u062F\u0646\u06CC \u0627\u0633\u062A. \u0641\u0639\u0627\u0644\u200C\u0633\u0627\u0632\u06CC \u0646\u0648\u0634\u062A\u0646 \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u062A\u0633\u062A \u0648 \u062A\u0627\u06CC\u06CC\u062F \u0635\u0631\u06CC\u062D \u062F\u0631 \u067E\u0631\u0648\u0698\u0647 \u0622\u0632\u0645\u0627\u06CC\u0634\u06CC \u0627\u0633\u062A.").addToggle((toggle) => toggle.setValue(Boolean(this.plugin.settings.experimentalHierarchyWrites)).onChange(async (value) => {
      this.plugin.settings.experimentalHierarchyWrites = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian45.Setting(containerEl).setName("\u06CC\u0627\u062F\u0622\u0648\u0631\u0647\u0627\u06CC \u0633\u0631\u0631\u0633\u06CC\u062F \u062A\u0633\u06A9\u200C\u0647\u0627 (Due Reminders)").setDesc("\u0628\u0631\u0631\u0633\u06CC \u062E\u0648\u062F\u06A9\u0627\u0631 \u0645\u0648\u0639\u062F \u0633\u0631\u0631\u0633\u06CC\u062F \u062A\u0633\u06A9\u200C\u0647\u0627 \u0648 \u0646\u0645\u0627\u06CC\u0634 \u0646\u0648\u062A\u06CC\u0641\u06CC\u06A9\u06CC\u0634\u0646 \u0628\u0627 \u0642\u0627\u0628\u0644\u06CC\u062A \u0627\u0646\u062C\u0627\u0645 \u06CC\u0627 \u062A\u0639\u0648\u06CC\u0642 (Snooze).").addToggle((toggle) => toggle.setValue(this.plugin.settings.enableDueReminders !== false).onChange(async (value) => {
      this.plugin.settings.enableDueReminders = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian45.Setting(containerEl).setName("\u0635\u062F\u0627\u06CC \u0632\u0646\u06AF \u0647\u0634\u062F\u0627\u0631 (Audio Chime)").setDesc("\u067E\u062E\u0634 \u0635\u062F\u0627\u06CC \u0632\u0646\u06AF \u0627\u062E\u062A\u0635\u0627\u0635\u06CC \u0647\u0646\u06AF\u0627\u0645 \u06CC\u0627\u062F\u0622\u0648\u0631\u06CC \u0633\u0631\u0631\u0633\u06CC\u062F \u0648 \u067E\u0627\u06CC\u0627\u0646 \u062A\u0627\u06CC\u0645\u0631 \u062A\u0645\u0631\u06A9\u0632.").addToggle((toggle) => toggle.setValue(this.plugin.settings.enableReminderChime !== false).onChange(async (value) => {
      this.plugin.settings.enableReminderChime = value;
      await this.plugin.saveSettings();
    })).addButton((btn) => btn.setButtonText("\u062A\u0633\u062A \u0635\u062F\u0627\u06CC \u0632\u0646\u06AF").onClick(() => {
      this.plugin.reminderService?.playReminderChime();
      new import_obsidian45.Notice("\u0635\u062F\u0627\u06CC \u0632\u0646\u06AF \u0647\u0634\u062F\u0627\u0631 \u067E\u062E\u0634 \u0634\u062F \u{1F514}");
    }));
  }
};

// src/obsidian/main.ts
var TickTickBridgePlugin = class extends import_obsidian46.Plugin {
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
  timeblockStatusBarItem = null;
  timeblockStatusTimer = null;
  pomodoroService = null;
  pomodoroStatusBarItem = null;
  reminderService = null;
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
    this.registerView(TIMELINE_VIEW_TYPE, (leaf) => new ProjectTimelineView(leaf, this));
    this.registerView(WEEKLY_REVIEW_VIEW_TYPE, (leaf) => new WeeklyReviewView(leaf, this));
    this.registerView(EISENHOWER_MATRIX_VIEW_TYPE, (leaf) => new EisenhowerMatrixView(leaf, this));
    this.registerView(TIMEBLOCK_PLANNER_VIEW_TYPE, (leaf) => new TimeblockingPlannerView(leaf, this));
    this.registerView(HEATMAP_VIEW_TYPE, (leaf) => new ActivityHeatmapView(leaf, this));
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
    this.registerMarkdownCodeBlockProcessor("ticktick-timeline", async (_source, element) => {
      await new ProjectTimeline(element, this.timelineHost()).render();
    });
    this.registerMarkdownCodeBlockProcessor("ticktick-review", async (_source, element) => {
      await new WeeklyReview(element, this.weeklyReviewHost()).render();
    });
    this.registerMarkdownCodeBlockProcessor("ticktick-matrix", async (_source, element) => {
      await new EisenhowerMatrix(element, this.eisenhowerMatrixHost()).render();
    });
    this.registerMarkdownCodeBlockProcessor("ticktick-day-planner", async (_source, element) => {
      await new TimeblockingPlanner(element, this.timeblockingPlannerHost()).render();
    });
    this.registerMarkdownCodeBlockProcessor("ticktick-heatmap", async (_source, element) => {
      await new ActivityHeatmap(element, this.activityHeatmapHost()).render();
    });
    this.registerMarkdownCodeBlockProcessor("ticktick-query", async (source, element, context) => {
      await new QueryBlockRenderer(this.queryBlockHost()).render(source, element, context);
    });
    this.registerMarkdownCodeBlockProcessor("ticktick-briefing", async (_source, element) => {
      const today = todayInZone(this.settings.timeZone);
      const jalaliDate = gregorianDateKeyToJalali(today) || today;
      const briefing = computeMorningBriefing(this.cache.tasks, this.cache.habits, {
        today,
        timeZone: this.settings.timeZone
      });
      const md = formatMorningBriefingMarkdown(briefing, { jalaliDateStr: jalaliDate });
      element.empty();
      await import_obsidian46.MarkdownRenderer.render(this.app, md, element, "", this);
    });
    this.registerEditorSuggest(new TickTickEditorSuggest(this.app, this));
    this.configurePanelMenuRibbonIcon();
    this.configureSyncRibbonIcon();
    this.configureRibbonIcons();
    this.addCommand({ id: "open-task-editor", name: "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u062C\u062F\u06CC\u062F (Add task modal)", callback: () => void this.createTaskFromSurface() });
    this.addCommand({ id: "quick-capture-task", name: "\u062B\u0628\u062A \u0633\u0631\u06CC\u0639 \u062A\u0633\u06A9 \u0628\u0627 \u0632\u0628\u0627\u0646 \u0637\u0628\u06CC\u0639\u06CC (Quick capture NLP)", callback: () => this.openQuickCaptureModal() });
    this.addCommand({ id: "open-morning-briefing", name: "\u0628\u0631\u06CC\u0641\u06CC\u0646\u06AF \u0635\u0628\u062D\u06AF\u0627\u0647\u06CC (Morning briefing and daily kickoff)", callback: () => this.openMorningBriefing() });
    this.addCommand({ id: "open-project-board", name: "\u0646\u0645\u0627\u06CC \u06A9\u0627\u0646\u0628\u0627\u0646 (Open Kanban Board)", callback: () => this.openProjectBoardView() });
    this.addCommand({ id: "open-weekly-planner", name: "\u0646\u0645\u0627\u06CC \u062A\u0642\u0648\u06CC\u0645 \u0648 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC (Open Weekly/Monthly Planner)", callback: () => this.openPlannerView() });
    this.addCommand({ id: "open-eisenhower-matrix", name: "\u0646\u0645\u0627\u06CC \u0645\u0627\u062A\u0631\u06CC\u0633 \u0622\u06CC\u0632\u0646\u0647\u0627\u0648\u0631 (Open Eisenhower Decision Matrix)", callback: () => this.openEisenhowerMatrixView() });
    this.addCommand({ id: "open-timeblocking-planner", name: "\u0646\u0645\u0627\u06CC \u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC \u0648 \u062A\u0627\u06CC\u0645\u200C\u0628\u0644\u0627\u06A9\u200C\u0647\u0627 (Open Timeblocking Planner)", callback: () => this.openTimeblockingPlannerView() });
    this.addCommand({ id: "open-project-timeline", name: "\u0646\u0645\u0627\u06CC \u062A\u0627\u06CC\u0645\u200C\u0644\u0627\u06CC\u0646 \u0648 \u06AF\u0627\u0646\u062A (Open Project Timeline & Gantt)", callback: () => this.openTimelineView() });
    this.addCommand({ id: "open-weekly-review", name: "\u0646\u0645\u0627\u06CC \u0645\u0631\u0648\u0631 \u0647\u0641\u062A\u06AF\u06CC \u0648 \u067E\u06CC\u0634\u0631\u0641\u062A (Open Weekly Review Dashboard)", callback: () => this.openWeeklyReviewView() });
    this.addCommand({ id: "open-activity-heatmap", name: "\u0646\u0645\u0627\u06CC \u0646\u0642\u0634\u0647 \u0641\u0639\u0627\u0644\u06CC\u062A \u0648 \u0647\u06CC\u062A\u200C\u0645\u067E (Open Activity Heatmap)", callback: () => this.openActivityHeatmapView() });
    this.addCommand({ id: "open-today-tasks", name: "\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632 (Open today's tasks)", callback: () => this.openTodayView() });
    this.addCommand({ id: "open-today-habits", name: "\u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632 (Open today's habits)", callback: () => this.openHabitView() });
    this.addCommand({ id: "open-pomodoro-timer", name: "\u062A\u0627\u06CC\u0645\u0631 \u062A\u0645\u0631\u06A9\u0632 \u0639\u0645\u06CC\u0642 \u0648 \u067E\u0648\u0645\u0648\u062F\u0648\u0631\u0648 (Open Pomodoro timer)", callback: () => this.openPomodoroModal() });
    this.addCommand({ id: "open-ticktick-sync-center", name: "\u0645\u0631\u06A9\u0632 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0648 \u062A\u0639\u0627\u0631\u0636\u200C\u0647\u0627 (Open Sync Center)", callback: () => this.openControlPage("sync") });
    this.addCommand({ id: "preview-ticktick-notes", name: "\u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 \u0627\u0646\u062A\u0642\u0627\u0644 \u06CC\u0627\u062F\u062F\u0627\u0634\u062A\u200C\u0647\u0627 (Preview Notes Import)", callback: () => this.openControlPage("notes") });
    this.addCommand({ id: "review-local-habits", name: "\u0645\u0631\u0648\u0631 \u0648 \u0645\u0627\u06CC\u06AF\u0631\u06CC\u0634\u0646 \u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0645\u062D\u0644\u06CC (Review Local Habits)", callback: () => this.openLocalHabitReviewModal() });
    this.addCommand({ id: "export-tasks-to-canvas", name: "Export tasks to visual Obsidian Canvas", callback: () => this.openCanvasExportModal() });
    this.addCommand({ id: "test-reminder-chime", name: "Test reminder audio chime", callback: () => this.reminderService?.playReminderChime() });
    this.addCommand({ id: "probe-task-hierarchy", name: "Probe task hierarchy and generate audit report", callback: () => this.probeTaskHierarchyAndReport() });
    this.addCommand({ id: "open-smart-views", name: "Open smart views (TickTick board)", callback: () => this.openProjectBoardView() });
    this.addCommand({ id: "refresh-project-board", name: "Refresh TickTick project board", callback: () => this.syncNow() });
    this.addCommand({ id: "sync-now", name: "Sync TickTick now", callback: () => this.syncNow() });
    this.addCommand({ id: "preview-markdown-sync", name: "Preview Markdown \u2194 TickTick sync", callback: () => this.previewMarkdownSync() });
    this.addCommand({ id: "apply-markdown-sync", name: "Apply Markdown \u2194 TickTick sync preview", callback: () => this.applyMarkdownSync() });
    this.addCommand({ id: "open-markdown-sync-conflicts", name: "Open Markdown sync conflicts", callback: () => this.openMarkdownSyncConflicts() });
    this.addCommand({ id: "repair-markdown-bindings", name: "Repair legacy Markdown bindings", callback: () => this.repairMarkdownBindings() });
    this.addCommand({ id: "import-ticktick-checkboxes", name: "Preview #ticktick checkboxes", callback: () => this.previewMarkdownSync() });
    this.addCommand({ id: "migrate-legacy-root-backups", name: "\u0627\u0646\u062A\u0642\u0627\u0644 \u0641\u0627\u06CC\u0644\u200C\u0647\u0627\u06CC \u0628\u06A9\u0627\u067E \u0642\u062F\u06CC\u0645\u06CC \u0628\u0647 \u067E\u0648\u0634\u0647 \u0645\u062F\u06CC\u0631\u06CC\u062A\u200C\u0634\u062F\u0647 (.ticktick/backups/)", callback: () => void this.migrateLegacyRootBackups() });
    this.addCommand({ id: "open-managed-reports", name: "\u0645\u0634\u0627\u0647\u062F\u0647 \u06AF\u0632\u0627\u0631\u0634 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u200C\u06AF\u06CC\u0631\u06CC \u0648 \u0630\u062E\u06CC\u0631\u0647\u200C\u0633\u0627\u0632\u06CC TickTick", callback: () => this.openControlPage("reports") });
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file instanceof import_obsidian46.TFile && file.extension === "md") this.queueTaggedCheckboxImport(file);
    }));
    this.configureAutomaticSync();
    this.timeblockStatusBarItem = this.addStatusBarItem();
    this.timeblockStatusBarItem.addClass("ticktick-timeblock-status-bar");
    this.updateTimeblockStatusBar();
    this.timeblockStatusTimer = window.setInterval(() => this.updateTimeblockStatusBar(), 6e4);
    this.pomodoroStatusBarItem = this.addStatusBarItem();
    this.pomodoroStatusBarItem.addClass("ticktick-pomodoro-status-bar");
    this.pomodoroStatusBarItem.style.display = "none";
    this.pomodoroStatusBarItem.addEventListener("click", () => this.openPomodoroModal());
    this.pomodoroService = new PomodoroTimerService({
      app: this.app,
      timeZone: this.settings.timeZone,
      dailyNoteFolder: this.settings.dailyNoteFolder,
      tasks: () => this.cache.tasks,
      updateTask: async (mutation) => this.updateTask(mutation),
      logPomodoroToDailyNote: async (session) => this.logPomodoroToDailyNote(session),
      onStateChanged: (st) => this.updatePomodoroStatusBar(st)
    });
    this.reminderService = new ReminderService(this);
    this.reminderService.start();
    this.app.workspace.onLayoutReady(() => void this.syncNow({ quiet: true }));
  }
  onunload() {
    if (this.timeblockStatusTimer !== null) {
      window.clearInterval(this.timeblockStatusTimer);
      this.timeblockStatusTimer = null;
    }
    this.pomodoroService?.destroy();
    this.reminderService?.stop();
    this.reminderService = null;
    this.pomodoroService = null;
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
    if (!quiet) new import_obsidian46.Notice(`\u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 Markdown sync: \u0627\u06CC\u062C\u0627\u062F ${result.create}\u060C \u0627\u0631\u0633\u0627\u0644 ${result.push}\u060C \u062F\u0631\u06CC\u0627\u0641\u062A ${result.pull}\u060C \u062A\u0639\u0627\u0631\u0636 ${result.conflict}\u060C \u0642\u0631\u0646\u0637\u06CC\u0646\u0647 ${result.quarantine}.`);
    return result;
  }
  async applyMarkdownSync() {
    const result = await this.markdownSync.apply();
    new import_obsidian46.Notice(`\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0627\u0639\u0645\u0627\u0644 \u0634\u062F: ${result.applied} \u062A\u063A\u06CC\u06CC\u0631. \u062A\u0639\u0627\u0631\u0636/\u0642\u0631\u0646\u0637\u06CC\u0646\u0647: ${result.conflict + result.quarantine}.`);
    return result;
  }
  async openMarkdownSyncConflicts() {
    const conflicts = await this.markdownSync.conflicts();
    if (conflicts.length) {
      const actionable = conflicts.find((conflict) => conflict.diff?.conflicts?.length);
      if (actionable) {
        const choice = await new MarkdownConflictModal(this.app, actionable).openAndWait();
        await this.markdownSync.resolve(actionable, choice);
        new import_obsidian46.Notice("\u0627\u0646\u062A\u062E\u0627\u0628 \u0634\u0645\u0627 \u062B\u0628\u062A \u0634\u062F\u061B \u06AF\u0632\u0627\u0631\u0634 \u062F\u0631 /.ticktick/reports/ \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.");
      } else new import_obsidian46.Notice(`${conflicts.length} \u0645\u0648\u0631\u062F Markdown \u062F\u0631 \u0642\u0631\u0646\u0637\u06CC\u0646\u0647 \u0627\u0633\u062A\u061B \u062C\u0632\u0626\u06CC\u0627\u062A \u062F\u0631 \u06AF\u0632\u0627\u0631\u0634 /.ticktick/reports/ \u062B\u0628\u062A \u0634\u062F\u0647 \u0627\u0633\u062A.`);
    }
    if (this.cache.conflicts.length) new PendingMutationConflictModal(this.app, this.cache.conflicts, (operation, choice) => this.resolveQueuedConflict(operation, choice)).open();
    else if (!conflicts.length) new import_obsidian46.Notice("\u062A\u0639\u0627\u0631\u0636\u06CC \u0628\u0631\u0627\u06CC \u0645\u062F\u06CC\u0631\u06CC\u062A \u0648\u062C\u0648\u062F \u0646\u062F\u0627\u0631\u062F.");
    return conflicts;
  }
  async resolveQueuedConflict(operation, choice) {
    this.cache.conflicts = this.cache.conflicts.filter((item) => item.id !== operation.id);
    if (choice === "retry") this.cache.pending.push({ ...operation, queuedAt: (/* @__PURE__ */ new Date()).toISOString() });
    await this.saveSettings();
    await this.refreshLocalSurfaces();
    new import_obsidian46.Notice(choice === "retry" ? "\u062A\u063A\u06CC\u06CC\u0631 \u062F\u0648\u0628\u0627\u0631\u0647 \u0628\u0647 \u0635\u0641 \u0627\u0645\u0646 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0631\u0641\u062A." : "\u062A\u063A\u06CC\u06CC\u0631 \u0645\u062D\u0644\u06CC \u0627\u0632 \u0635\u0641 \u062A\u0639\u0627\u0631\u0636 \u062D\u0630\u0641 \u0634\u062F.");
  }
  async repairMarkdownBindings() {
    const result = await this.markdownSync.repairLegacyBindings();
    new import_obsidian46.Notice(`\u0627\u0633\u06A9\u0646 binding \u0642\u062F\u06CC\u0645\u06CC \u062A\u0645\u0627\u0645 \u0634\u062F\u061B ${result.quarantine} \u0645\u0648\u0631\u062F \u0646\u06CC\u0627\u0632\u0645\u0646\u062F \u0628\u0631\u0631\u0633\u06CC \u062F\u0633\u062A\u06CC \u0627\u0633\u062A.`);
    return result;
  }
  async previewTickTickNotes() {
    const rows = this.noteImport.preview(this.cache.tasks);
    if (rows.length) new NoteImportModal(this.app, this.noteImport, this.cache.tasks).open();
    else new import_obsidian46.Notice("Note \u0642\u0627\u0628\u0644\u200C\u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u0627 kind: NOTE \u062F\u0631 cache \u067E\u06CC\u062F\u0627 \u0646\u0634\u062F.");
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
      reschedule: async (task, day, time) => this.markdownSync.bindingForTask(String(task.id)) ? this.markdownSync.rescheduleBoundTask(String(task.id), day) : this.rescheduleTaskFromPlanner(task, day, time),
      unschedule: async (task) => this.unscheduleTaskFromPlanner(task),
      complete: async (task) => {
        if (this.markdownSync.bindingForTask(String(task.id))) {
          await this.markdownSync.completeBoundTask(String(task.id));
        } else {
          await this.completeTask(task);
        }
      },
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
      },
      savedViews: () => this.settings.savedViews || [],
      saveSavedViews: async (views) => {
        this.settings.savedViews = views;
        await this.saveSettings();
      },
      executeBulkOperation: async (taskIds, op, params) => this.executeBulkOperation(taskIds, op, params)
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
      complete: async (task) => {
        if (this.markdownSync.bindingForTask(String(task.id))) {
          await this.markdownSync.completeBoundTask(String(task.id));
        } else {
          await this.completeTask(task);
        }
      },
      binding: (task) => this.markdownSync.bindingForTask(String(task.id)),
      load: async (task) => this.loadTaskDetails(task),
      edit: async (task) => this.editTaskFromSurface(task),
      moveToColumn: async (task, columnId) => this.moveTaskToBoardColumn(task, columnId),
      showCompleted: () => this.settings.plannerShowCompleted,
      preferences: () => ({ selected: this.settings.boardLastProjectId, collapsed: this.settings.boardCollapsedGroups, sidebarCollapsed: this.settings.boardSidebarCollapsed, sidebarPreferenceInitialized: this.settings.boardSidebarPreferenceInitialized, smartViewGrouping: this.settings.boardSmartViewGrouping }),
      savePreferences: async (value) => {
        this.settings.boardLastProjectId = value.selected;
        this.settings.boardCollapsedGroups = value.collapsed;
        this.settings.boardSidebarCollapsed = value.sidebarCollapsed;
        this.settings.boardSidebarPreferenceInitialized = value.sidebarPreferenceInitialized ?? true;
        if (value.smartViewGrouping) this.settings.boardSmartViewGrouping = value.smartViewGrouping;
        await this.saveSettings();
      },
      savedViews: () => this.settings.savedViews || [],
      saveSavedViews: async (views) => {
        this.settings.savedViews = views;
        await this.saveSettings();
      },
      executeBulkOperation: async (taskIds, op, params) => this.executeBulkOperation(taskIds, op, params)
    };
  }
  timelineHost() {
    return {
      app: this.app,
      timeZone: this.settings.timeZone,
      firstWeekday: 6,
      projects: async () => this.cache.projects.length ? this.cache.projects : this.client().listProjects(),
      tasks: () => this.cache.tasks,
      refresh: async () => {
        await this.syncNow();
      },
      rescheduleRange: async (task, newStart, newDue) => this.rescheduleTaskRange(task, newStart, newDue),
      complete: async (task) => {
        if (this.markdownSync.bindingForTask(String(task.id))) {
          await this.markdownSync.completeBoundTask(String(task.id));
        } else {
          await this.completeTask(task);
        }
      },
      edit: async (task) => this.editTaskFromSurface(task),
      load: async (task) => this.loadTaskDetails(task),
      showCompleted: () => this.settings.plannerShowCompleted,
      savedViews: () => this.settings.savedViews || [],
      saveSavedViews: async (views) => {
        this.settings.savedViews = views;
        await this.saveSettings();
      },
      executeBulkOperation: async (taskIds, op, params) => this.executeBulkOperation(taskIds, op, params)
    };
  }
  weeklyReviewHost() {
    return {
      app: this.app,
      timeZone: this.settings.timeZone,
      firstWeekday: 6,
      tasks: () => this.cache.tasks,
      savedAt: () => this.cache.savedAt,
      projects: async () => this.cache.projects.length ? this.cache.projects : this.client().listProjects(),
      executeBulkOperation: async (taskIds, op, params) => this.executeBulkOperation(taskIds, op, params),
      refresh: async () => {
        await this.syncNow();
      },
      load: async (task) => this.loadTaskDetails(task),
      edit: async (task) => this.editTaskFromSurface(task),
      complete: async (task) => {
        if (this.markdownSync.bindingForTask(String(task.id))) {
          await this.markdownSync.completeBoundTask(String(task.id));
        } else {
          await this.completeTask(task);
        }
      }
    };
  }
  eisenhowerMatrixHost() {
    return {
      app: this.app,
      timeZone: this.settings.timeZone,
      tasks: () => this.cache.tasks,
      projects: async () => this.cache.projects.length ? this.cache.projects : this.client().listProjects(),
      savedAt: () => this.cache.savedAt,
      refresh: async () => {
        await this.syncNow();
      },
      updateTask: async (mutation) => this.updateTask(mutation),
      createTask: async (initial) => this.createTaskFromSurface(initial),
      complete: async (task) => {
        if (this.markdownSync.bindingForTask(String(task.id))) {
          await this.markdownSync.completeBoundTask(String(task.id));
        } else {
          await this.completeTask(task);
        }
      },
      load: async (task) => this.loadTaskDetails(task),
      edit: async (task) => this.editTaskFromSurface(task),
      executeBulkOperation: async (taskIds, op, params) => this.executeBulkOperation(taskIds, op, params)
    };
  }
  timeblockingPlannerHost() {
    return {
      app: this.app,
      timeZone: this.settings.timeZone,
      tasks: () => this.cache.tasks,
      projects: async () => this.cache.projects.length ? this.cache.projects : this.client().listProjects(),
      savedAt: () => this.cache.savedAt,
      refresh: async () => {
        await this.syncNow();
      },
      updateTask: async (mutation) => this.updateTask(mutation),
      createTask: async (initial) => this.createTaskFromSurface(initial),
      complete: async (task) => {
        if (this.markdownSync.bindingForTask(String(task.id))) {
          await this.markdownSync.completeBoundTask(String(task.id));
        } else {
          await this.completeTask(task);
        }
      },
      load: async (task) => this.loadTaskDetails(task),
      edit: async (task) => this.editTaskFromSurface(task),
      executeBulkOperation: async (taskIds, op, params) => this.executeBulkOperation(taskIds, op, params)
    };
  }
  activityHeatmapHost() {
    return {
      tasks: () => this.cache.tasks,
      habits: () => this.cache.habits,
      habitCheckins: () => this.cache.habitCheckins,
      timeZone: this.settings.timeZone,
      refresh: async () => {
        await this.syncNow();
      }
    };
  }
  queryBlockHost() {
    return {
      app: this.app,
      tasks: () => this.cache.tasks,
      projects: () => this.cache.projects,
      timeZone: this.settings.timeZone,
      edit: (task) => {
        void this.editTaskFromSurface(task);
      },
      load: async (task) => this.loadTaskDetails(task),
      complete: async (task) => {
        if (this.markdownSync.bindingForTask(String(task.id))) {
          await this.markdownSync.completeBoundTask(String(task.id));
        } else {
          await this.completeTask(task);
        }
      },
      updateTask: async (mutation) => this.updateTask(mutation)
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
    if (imported && !quiet) new import_obsidian46.Notice(`${imported} \u0686\u06A9\u200C\u0628\u0627\u06A9\u0633 \u0628\u0647 TickTick \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.`);
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
      this.addRibbonIcon("activity", "TickTick Bridge: \u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632", () => this.openHabitView()),
      this.addRibbonIcon("calendar", "TickTick Bridge: \u062A\u0642\u0648\u06CC\u0645 \u0648 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC", () => void this.openPlannerView()),
      this.addRibbonIcon("kanban-square", "TickTick Bridge: \u0628\u0631\u062F \u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627 \u0648 \u0646\u0645\u0627\u0647\u0627\u06CC \u0647\u0648\u0634\u0645\u0646\u062F", () => void this.openProjectBoardView()),
      this.addRibbonIcon("calendar-range", "TickTick Bridge: \u062A\u0627\u06CC\u0645\u200C\u0644\u0627\u06CC\u0646 \u0648 \u06AF\u0627\u0646\u062A \u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627", () => void this.openTimelineView())
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
    const menu = new import_obsidian46.Menu();
    const menuDom = menu.dom;
    menuDom?.addClass("ticktick-bridge-panel-menu");
    menuDom?.setAttribute("dir", "rtl");
    const stopAutoScroll = (e) => {
      e.stopImmediatePropagation();
    };
    menuDom?.addEventListener("mousemove", stopAutoScroll, { capture: true });
    const preScrollEl = menu.scrollEl;
    preScrollEl?.addEventListener("mousemove", stopAutoScroll, { capture: true });
    menu.addItem((item) => {
      item.setTitle("\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u062C\u062F\u06CC\u062F").setIcon("plus").onClick(() => void this.createTaskFromSurface());
      item.dom?.addClass("ticktick-menu-item-cta");
    });
    menu.addItem((item) => {
      item.setTitle("\u062B\u0628\u062A \u0633\u0631\u06CC\u0639 \u0628\u0627 \u0632\u0628\u0627\u0646 \u0637\u0628\u06CC\u0639\u06CC").setIcon("zap").onClick(() => void this.openQuickCaptureModal());
    });
    menu.addItem((item) => {
      item.setTitle("\u0628\u0631\u06CC\u0641\u06CC\u0646\u06AF \u0635\u0628\u062D\u06AF\u0627\u0647\u06CC \u0648 \u0627\u0647\u062F\u0627\u0641 \u0631\u0648\u0632").setIcon("sun").onClick(() => void this.openMorningBriefing());
    });
    menu.addItem((item) => {
      item.setTitle("\u062A\u0627\u06CC\u0645\u0631 \u062A\u0645\u0631\u06A9\u0632 \u0639\u0645\u06CC\u0642 (\u067E\u0648\u0645\u0648\u062F\u0648\u0631\u0648)").setIcon("timer").onClick(() => void this.openPomodoroModal());
    });
    menu.addSeparator();
    menu.addItem((item) => item.setTitle("\u06A9\u0627\u0646\u0628\u0627\u0646 (\u0628\u0631\u062F \u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627)").setIcon("kanban-square").onClick(() => void this.openProjectBoardView()));
    menu.addItem((item) => item.setTitle("\u062A\u0642\u0648\u06CC\u0645 \u0648 \u0628\u0631\u0646\u0627\u0645\u0647\u200C\u0631\u06CC\u0632\u06CC").setIcon("calendar").onClick(() => void this.openPlannerView()));
    menu.addItem((item) => item.setTitle("\u0645\u0627\u062A\u0631\u06CC\u0633 \u0622\u06CC\u0632\u0646\u0647\u0627\u0648\u0631").setIcon("grid").onClick(() => void this.openEisenhowerMatrixView()));
    menu.addItem((item) => item.setTitle("\u0632\u0645\u0627\u0646\u200C\u0628\u0646\u062F\u06CC \u0648 \u0628\u0644\u0648\u06A9\u200C\u0647\u0627\u06CC \u0631\u0648\u0632\u0627\u0646\u0647").setIcon("clock").onClick(() => void this.openTimeblockingPlannerView()));
    menu.addItem((item) => item.setTitle("\u062A\u0627\u06CC\u0645\u200C\u0644\u0627\u06CC\u0646 \u0648 \u06AF\u0627\u0646\u062A \u067E\u0631\u0648\u0698\u0647\u200C\u0647\u0627").setIcon("calendar-range").onClick(() => void this.openTimelineView()));
    menu.addItem((item) => item.setTitle("\u0645\u0631\u0648\u0631 \u0647\u0641\u062A\u06AF\u06CC \u0648 \u067E\u06CC\u0634\u0631\u0641\u062A").setIcon("check-check").onClick(() => void this.openWeeklyReviewView()));
    menu.addItem((item) => item.setTitle("\u0646\u0642\u0634\u0647 \u0641\u0639\u0627\u0644\u06CC\u062A (\u0647\u06CC\u062A\u200C\u0645\u067E \u0633\u0627\u0644\u0627\u0646\u0647)").setIcon("flame").onClick(() => void this.openActivityHeatmapView()));
    menu.addSeparator();
    menu.addItem((item) => item.setTitle("\u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632").setIcon("check-square").onClick(() => void this.openTodayView()));
    menu.addItem((item) => item.setTitle("\u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0627\u0645\u0631\u0648\u0632").setIcon("activity").onClick(() => void this.openHabitView()));
    menu.addSeparator();
    menu.addItem((item) => item.setTitle("\u0645\u0631\u06A9\u0632 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0648 \u062A\u0639\u0627\u0631\u0636\u200C\u0647\u0627").setIcon("arrow-down-up").onClick(() => void this.openControlPage("sync")));
    menu.addItem((item) => item.setTitle("\u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 \u0627\u0646\u062A\u0642\u0627\u0644 \u06CC\u0627\u062F\u062F\u0627\u0634\u062A\u200C\u0647\u0627 (Notes)").setIcon("file-down").onClick(() => void this.openControlPage("notes")));
    menu.addItem((item) => item.setTitle("\u0645\u0631\u0648\u0631 \u0648 \u067E\u06CC\u0634\u200C\u0646\u0645\u0627\u06CC\u0634 \u0639\u0627\u062F\u062A\u200C\u0647\u0627\u06CC \u0645\u062D\u0644\u06CC").setIcon("sparkles").onClick(() => void this.openLocalHabitReviewModal()));
    menu.addItem((item) => item.setTitle("\u0686\u06A9\u200C\u0644\u06CC\u0633\u062A\u200C\u0647\u0627\u06CC \u062A\u0633\u06A9 (\u0641\u0642\u0637\u200C\u062E\u0648\u0627\u0646\u062F\u0646\u06CC)").setIcon("list-checks").onClick(() => void this.openControlPage("checklists")));
    menu.addItem((item) => item.setTitle("\u0622\u062E\u0631\u06CC\u0646 \u06AF\u0632\u0627\u0631\u0634 \u0648 \u067E\u0634\u062A\u06CC\u0628\u0627\u0646\u200C\u06AF\u06CC\u0631\u06CC (Backup)").setIcon("shield-check").onClick(() => void this.openControlPage("reports")));
    menu.showAtMouseEvent(event);
    const postDom = menu.dom;
    postDom?.addClass("ticktick-bridge-panel-menu");
    postDom?.setAttribute("dir", "rtl");
    const postScrollEl = menu.scrollEl;
    postDom?.addEventListener("mousemove", stopAutoScroll, { capture: true });
    postScrollEl?.addEventListener("mousemove", stopAutoScroll, { capture: true });
    if (postScrollEl) {
      postScrollEl.scrollTop = 0;
    }
    if (postDom) {
      const vh = window.innerHeight;
      const margin = 16;
      const rect = postDom.getBoundingClientRect();
      if (rect.top < margin) {
        postDom.style.top = `${margin}px`;
      } else if (rect.bottom > vh - margin) {
        const targetTop = Math.max(margin, vh - margin - rect.height);
        postDom.style.top = `${targetTop}px`;
      }
    }
  }
  setSyncRibbonState(syncing) {
    if (!this.syncRibbonIcon) return;
    (0, import_obsidian46.setIcon)(this.syncRibbonIcon, syncing ? "loader-circle" : "arrow-down-up");
    this.syncRibbonIcon.toggleClass("is-syncing", syncing);
    this.syncRibbonIcon.setAttribute("aria-label", syncing ? "TickTick Bridge: \u062F\u0631 \u062D\u0627\u0644 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC\u2026" : "TickTick Bridge: \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0628\u0627 TickTick");
  }
  async syncNow({ quiet = false, scheduled = false } = {}) {
    if (this.syncInProgress) {
      if (!quiet) new import_obsidian46.Notice("\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC TickTick \u0647\u0645\u06CC\u0646 \u062D\u0627\u0644\u0627 \u062F\u0631 \u062D\u0627\u0644 \u0627\u0646\u062C\u0627\u0645 \u0627\u0633\u062A.");
      return;
    }
    if (Date.now() < this.rateLimitedUntil) {
      if (!quiet) new import_obsidian46.Notice(`TickTick \u0645\u0648\u0642\u062A\u0627\u064B \u062F\u0631\u062E\u0648\u0627\u0633\u062A\u200C\u0647\u0627 \u0631\u0627 \u0645\u062D\u062F\u0648\u062F \u06A9\u0631\u062F\u0647 \u0627\u0633\u062A. \u0627\u0631\u0633\u0627\u0644 \u062A\u063A\u06CC\u06CC\u0631\u0647\u0627\u06CC \u0635\u0641\u200C\u0634\u062F\u0647 \u062D\u062F\u0648\u062F ${this.rateLimitWaitSeconds()} \u062B\u0627\u0646\u06CC\u0647\u0654 \u062F\u06CC\u06AF\u0631 \u062F\u0648\u0628\u0627\u0631\u0647 \u062A\u0644\u0627\u0634 \u0645\u06CC\u200C\u0634\u0648\u062F.`);
      return;
    }
    this.syncInProgress = true;
    this.setSyncRibbonState(true);
    try {
      const day = todayInZone(this.settings.timeZone);
      const pendingFlushed = await this.flushPendingMutations();
      if (!pendingFlushed) {
        if (!quiet) new import_obsidian46.Notice("\u062A\u063A\u06CC\u06CC\u0631\u0647\u0627 \u062F\u0631 \u0635\u0641 \u0627\u0645\u0646 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0645\u0627\u0646\u062F\u0646\u062F\u061B TickTick \u0641\u0639\u0644\u0627\u064B \u062F\u0631\u062E\u0648\u0627\u0633\u062A \u062A\u0627\u0632\u0647 \u0646\u0645\u06CC\u200C\u067E\u0630\u06CC\u0631\u062F.");
        return;
      }
      const refreshed = await this.refreshCacheFromTickTick(day, !scheduled);
      const tasks = this.cachedTasksForDay(day);
      const habits = this.cachedHabitsForDay(day);
      await this.refreshLocalSurfaces();
      if (!quiet && !refreshed.tasksFresh) {
        new import_obsidian46.Notice("\u0641\u0647\u0631\u0633\u062A \u062A\u0633\u06A9\u200C\u0647\u0627 \u0627\u0632 TickTick \u062F\u0631\u06CC\u0627\u0641\u062A \u0646\u0634\u062F\u061B \u062A\u0633\u06A9\u200C\u0647\u0627\u06CC \u06A9\u0634 \u0647\u0646\u0648\u0632 \u0628\u0647\u200C\u0631\u0648\u0632 \u0646\u06CC\u0633\u062A\u0646\u062F. \u0646\u0634\u0633\u062A \u0648\u0628 \u0631\u0627 \u062F\u0631 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646 \u0648 \u062F\u0648\u0628\u0627\u0631\u0647 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0628\u0632\u0646.");
      } else if (!quiet && refreshed.remote) {
        const notes = this.cache.tasks.filter((task) => String(task.kind ?? "").toUpperCase() === "NOTE").length;
        new import_obsidian46.Notice(`\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u06A9\u0627\u0645\u0644 \u0634\u062F: ${this.cache.projects.length} \u0644\u06CC\u0633\u062A\u060C ${this.cache.tasks.length} \u0631\u06A9\u0648\u0631\u062F (${notes} Note) \u0648 ${habits.length} \u0639\u0627\u062F\u062A \u0627\u0645\u0631\u0648\u0632.`);
      } else if (!quiet) {
        new import_obsidian46.Notice("\u0646\u0633\u062E\u0647\u0654 \u0645\u062D\u0644\u06CC \u0622\u0645\u0627\u062F\u0647 \u0627\u0633\u062A\u061B TickTick \u062F\u0627\u062F\u0647\u0654 \u062A\u0627\u0632\u0647\u200C\u0627\u06CC \u0628\u0631\u0646\u06AF\u0631\u062F\u0627\u0646\u062F. \u0627\u062A\u0635\u0627\u0644 \u0648\u0628 \u0631\u0627 \u062F\u0631 \u062A\u0646\u0638\u06CC\u0645\u0627\u062A \u0628\u0631\u0631\u0633\u06CC \u06A9\u0646.");
      }
    } catch (error) {
      if (this.isRateLimitError(error)) {
        this.deferForRateLimit(error);
        await this.saveSettings();
      }
      if (!quiet) new import_obsidian46.Notice(error instanceof Error ? error.message : "\u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC TickTick \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
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
    for (const type of [VIEW_TYPE, HABIT_VIEW_TYPE, PLANNER_VIEW_TYPE, PROJECT_BOARD_VIEW_TYPE, TIMELINE_VIEW_TYPE, WEEKLY_REVIEW_VIEW_TYPE, EISENHOWER_MATRIX_VIEW_TYPE, TIMEBLOCK_PLANNER_VIEW_TYPE, HEATMAP_VIEW_TYPE]) {
      for (const leaf of this.app.workspace.getLeavesOfType(type)) {
        const view = leaf.view;
        if (typeof view.render === "function") await view.render();
      }
    }
    this.updateTimeblockStatusBar();
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
  async refreshCacheFromTickTick(today, refreshRemoteMetadata = false) {
    const client = this.client();
    const cacheAvailable = this.hasCache();
    const webTasks = await this.webOpenTasks();
    const projects = !cacheAvailable || refreshRemoteMetadata ? await client.listProjects() : this.cache.projects;
    let habits = !cacheAvailable || refreshRemoteMetadata ? await client.listHabits() : this.cache.habits;
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
    const tasks = reconcileOpenTasks([...taskIndex.values()], webTasks);
    for (const [projectId, board] of Object.entries(projectBoards)) {
      const prior = new Map((board.tasks ?? []).map((task) => [String(task.id), task]));
      board.tasks = tasks.filter((task) => projectId === "inbox" ? Boolean(task.isInbox) : String(task?.projectId ?? "") === projectId).map((task) => mergeTaskDetails(prior.get(String(task.id)), task));
    }
    const activeHabits = habits.filter((habit) => habit.status === void 0 || habit.status === 0);
    const fromDay = shiftIsoDay(today, -90);
    const officialDocuments = !cacheAvailable && activeHabits.length ? await client.getHabitCheckins(activeHabits.map((habit) => habit.id), fromDay, today) : [];
    const checkins = { ...this.cache.habitCheckins };
    for (const document2 of officialDocuments ?? []) {
      const habitId = String(document2?.habitId ?? "");
      if (!habitId) continue;
      checkins[habitId] = (document2.checkins ?? []).map((entry) => ({ stamp: Number(entry.stamp), value: Number(entry.value ?? 0), goal: Number(entry.goal ?? 1), status: Number(entry.status ?? 0) }));
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
    return { remote: webTasks !== null || webCheckins !== null || !cacheAvailable, tasksFresh: webTasks !== null };
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
    const applyLocal = (completedRecurring) => {
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
        const prior = this.cache.tasks.find((task) => task.id === updatePayload.id);
        const priorProjectId = prior?.projectId;
        if (updatePayload.projectId && priorProjectId && updatePayload.projectId !== priorProjectId) {
          const oldBoard = this.cache.projectBoards[priorProjectId];
          if (oldBoard) {
            oldBoard.tasks = (oldBoard.tasks ?? []).filter((task) => task.id !== updatePayload.id);
          }
          const newBoard = this.cache.projectBoards[updatePayload.projectId];
          if (newBoard) {
            const updatedTask = this.cache.tasks.find((t) => t.id === updatePayload.id);
            if (updatedTask && !(newBoard.tasks ?? []).some((t) => t.id === updatePayload.id)) {
              newBoard.tasks = [...newBoard.tasks ?? [], updatedTask];
            }
          }
        } else {
          for (const board of Object.values(this.cache.projectBoards)) board.tasks = (board.tasks ?? []).map((task) => task.id === updatePayload.id ? { ...task, ...updatePayload } : task);
        }
        bridgeEvents.emit("task:updated", { task: updatePayload });
      }
      if (type === "complete" || type === "delete") {
        const targetId = payload.id;
        const prior = this.cache.tasks.find((task) => task.id === targetId);
        if (type === "complete" && prior?.repeatFlag) {
          const next = { ...prior, ...completedRecurring, status: 0 };
          this.cache.tasks = this.cache.tasks.map((task) => task.id === targetId ? next : task);
          for (const board of Object.values(this.cache.projectBoards)) {
            board.tasks = (board.tasks ?? []).map((task) => task.id === targetId ? next : task);
          }
        } else {
          this.cache.tasks = this.cache.tasks.filter((task) => task.id !== targetId);
          for (const board of Object.values(this.cache.projectBoards)) board.tasks = (board.tasks ?? []).filter((task) => task.id !== targetId);
        }
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
      new import_obsidian46.Notice("\u0622\u0641\u0644\u0627\u06CC\u0646 \u0647\u0633\u062A\u06CC\u061B \u062A\u063A\u06CC\u06CC\u0631 \u062F\u0631 \u0635\u0641 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.");
      return { queued: true };
    }
    if (Date.now() < this.rateLimitedUntil) {
      this.cache.pending.push(operation);
      applyLocal();
      await this.saveSettings();
      await this.refreshLocalSurfaces();
      new import_obsidian46.Notice(`TickTick \u0645\u0648\u0642\u062A\u0627\u064B \u0645\u062D\u062F\u0648\u062F\u06CC\u062A \u06AF\u0630\u0627\u0634\u062A\u0647 \u0627\u0633\u062A\u061B \u062A\u063A\u06CC\u06CC\u0631 \u0645\u062D\u0644\u06CC \u062D\u0641\u0638 \u0634\u062F \u0648 \u062D\u062F\u0648\u062F ${this.rateLimitWaitSeconds()} \u062B\u0627\u0646\u06CC\u0647\u0654 \u062F\u06CC\u06AF\u0631 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0627\u0631\u0633\u0627\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F.`);
      return { queued: true };
    }
    try {
      const result = await execute();
      const completed = type === "complete" ? payload : void 0;
      let nextOccurrence;
      if (completed?.repeatFlag && completed.id && completed.projectId) {
        try {
          const fresh = await this.client().getTask(String(completed.projectId), String(completed.id));
          if (fresh && typeof fresh === "object") nextOccurrence = fresh;
        } catch {
        }
      }
      applyLocal(nextOccurrence);
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
      new import_obsidian46.Notice(status === 429 ? `TickTick \u0645\u0648\u0642\u062A\u0627\u064B \u0645\u062D\u062F\u0648\u062F\u06CC\u062A \u06AF\u0630\u0627\u0634\u062A\u0647 \u0627\u0633\u062A\u061B \u062A\u063A\u06CC\u06CC\u0631 \u0645\u062D\u0644\u06CC \u062D\u0641\u0638 \u0634\u062F \u0648 \u062D\u062F\u0648\u062F ${this.rateLimitWaitSeconds()} \u062B\u0627\u0646\u06CC\u0647\u0654 \u062F\u06CC\u06AF\u0631 \u062E\u0648\u062F\u06A9\u0627\u0631 \u0627\u0631\u0633\u0627\u0644 \u0645\u06CC\u200C\u0634\u0648\u062F.` : "\u0627\u062A\u0635\u0627\u0644 TickTick \u0628\u0631\u0642\u0631\u0627\u0631 \u0646\u06CC\u0633\u062A\u061B \u062A\u063A\u06CC\u06CC\u0631 \u062F\u0631 \u0635\u0641 \u0647\u0645\u06AF\u0627\u0645\u200C\u0633\u0627\u0632\u06CC \u0630\u062E\u06CC\u0631\u0647 \u0634\u062F.");
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
          new import_obsidian46.Notice("\u06CC\u06A9 \u062A\u063A\u06CC\u06CC\u0631 \u0622\u0641\u0644\u0627\u06CC\u0646 \u0628\u0627 \u0646\u0633\u062E\u0647\u0654 TickTick \u062A\u062F\u0627\u062E\u0644 \u062F\u0627\u0634\u062A \u0648 \u0627\u0631\u0633\u0627\u0644 \u0646\u0634\u062F.");
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
  availableTags() {
    const taskTags = (this.cache?.tasks ?? []).flatMap((t) => t.tags ?? []);
    const boardTags = Object.values(this.cache?.projectBoards ?? {}).flatMap((b) => (b.tasks ?? []).flatMap((t) => t.tags ?? []));
    return [...new Set([...taskTags, ...boardTags].filter(Boolean).map(String).map((t) => t.replace(/^[#＃]/, "").trim()))].filter(Boolean).sort((a, b) => a.localeCompare(b, "fa"));
  }
  async createTaskFromSurface(initial = {}) {
    const projects = this.cache.projects.length ? this.cache.projects : await this.client().listProjects();
    const draft = await openTaskEditor(
      this.app,
      projects,
      initial,
      this.availableTags(),
      this.cache.tasks,
      async (parentId, title) => {
        const pTask = this.cache.tasks.find((t) => String(t.id) === parentId);
        return this.createTask({
          title,
          parentId,
          projectId: pTask?.projectId ?? projects[0]?.id
        });
      }
    );
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
    const draft = await openTaskEditor(
      this.app,
      projects,
      current,
      this.availableTags(),
      this.cache.tasks,
      async (parentId, title) => {
        const pTask = this.cache.tasks.find((t) => String(t.id) === parentId);
        return this.createTask({
          title,
          parentId,
          projectId: pTask?.projectId ?? current.projectId ?? projects[0]?.id
        });
      }
    );
    if (!draft) return null;
    const payload = toTaskPayload({ ...current, ...draft }, this.settings.timeZone);
    await this.updateTask(payload);
    return { ...current, ...payload };
  }
  async unscheduleTaskFromPlanner(task) {
    const previous = { ...task };
    const payload = {
      id: task.id,
      projectId: task.projectId,
      dueDate: null,
      startDate: null,
      isAllDay: true
    };
    try {
      await this.updateTask(payload);
      return { ...task, ...payload };
    } catch (error) {
      this.cache.tasks = this.cache.tasks.map((t) => t.id === previous.id ? previous : t);
      for (const board of Object.values(this.cache.projectBoards)) {
        board.tasks = (board.tasks ?? []).map((t) => t.id === previous.id ? previous : t);
      }
      await this.managedStorage.writeReport("planner-unschedule-failure", {
        taskId: task.id,
        title: task.title,
        error: error instanceof Error ? error.message : String(error)
      });
      bridgeEvents.emit("state:changed", void 0);
      throw error;
    }
  }
  async rescheduleTaskFromPlanner(task, targetDay, targetTime) {
    const previous = { ...task };
    try {
      const start = toDateKey(task?.startDate, task?.timeZone || this.settings.timeZone);
      const due = toDateKey(task?.dueDate, task?.timeZone || this.settings.timeZone);
      const anchor = start ?? due;
      let payload;
      if (!anchor) {
        const isTimed = Boolean(targetTime);
        const timePart = targetTime ? targetTime.length === 5 ? `${targetTime}:00` : targetTime : "00:00:00";
        payload = {
          id: task.id,
          projectId: task.projectId,
          dueDate: isTimed ? `${targetDay}T${timePart}+0330` : `${targetDay}T00:00:00+0330`,
          startDate: null,
          isAllDay: !isTimed,
          timeZone: this.settings.timeZone
        };
      } else {
        const offset = Math.round((Date.parse(`${targetDay}T12:00:00Z`) - Date.parse(`${anchor}T12:00:00Z`)) / 864e5);
        const isTimed = Boolean(targetTime || !task.isAllDay && String(task.dueDate ?? task.startDate ?? "").includes("T"));
        const timePart = targetTime ? targetTime.length === 5 ? `${targetTime}:00` : targetTime : String(task.startDate ?? task.dueDate ?? "").match(/T(\d{2}:\d{2}:\d{2})/)?.[1] ?? "00:00:00";
        const moveValue = (value, fallback) => {
          if (!fallback) return null;
          const moved = shiftIsoDay(fallback, offset);
          return isTimed ? `${moved}T${timePart}+0330` : `${moved}T00:00:00+0330`;
        };
        payload = toTaskPayload({ ...task, dueDate: due ? shiftIsoDay(due, offset) : null }, this.settings.timeZone);
        payload.startDate = moveValue(task.startDate, start);
        payload.dueDate = moveValue(task.dueDate, due);
        payload.isAllDay = !isTimed;
      }
      await this.updateTask(payload);
      return { ...task, ...payload };
    } catch (error) {
      this.cache.tasks = this.cache.tasks.map((t) => t.id === previous.id ? previous : t);
      for (const board of Object.values(this.cache.projectBoards)) {
        board.tasks = (board.tasks ?? []).map((t) => t.id === previous.id ? previous : t);
      }
      await this.managedStorage.writeReport("planner-reschedule-failure", {
        taskId: task.id,
        title: task.title,
        targetDay,
        targetTime,
        error: error instanceof Error ? error.message : String(error)
      });
      bridgeEvents.emit("state:changed", void 0);
      throw error;
    }
  }
  async rescheduleTaskRange(task, newStartDate, newDueDate) {
    const previous = { ...task };
    try {
      const isTimed = !task.isAllDay && String(task.startDate ?? task.dueDate ?? "").includes("T");
      const startTimePart = String(task.startDate ?? "").match(/T(\d{2}:\d{2}:\d{2})/)?.[1] ?? "00:00:00";
      const dueTimePart = String(task.dueDate ?? "").match(/T(\d{2}:\d{2}:\d{2})/)?.[1] ?? "00:00:00";
      const tzOffset = "+0330";
      const formattedStart = newStartDate ? isTimed ? `${newStartDate}T${startTimePart}${tzOffset}` : `${newStartDate}T00:00:00${tzOffset}` : null;
      const formattedDue = newDueDate ? isTimed ? `${newDueDate}T${dueTimePart}${tzOffset}` : `${newDueDate}T00:00:00${tzOffset}` : null;
      const payload = {
        id: task.id,
        projectId: task.projectId,
        startDate: formattedStart,
        dueDate: formattedDue,
        isAllDay: !isTimed,
        timeZone: this.settings.timeZone
      };
      this.cache.tasks = this.cache.tasks.map((t) => t.id === task.id ? { ...t, ...payload } : t);
      for (const board of Object.values(this.cache.projectBoards)) {
        board.tasks = (board.tasks ?? []).map((t) => t.id === task.id ? { ...t, ...payload } : t);
      }
      bridgeEvents.emit("state:changed", void 0);
      await this.updateTask(payload);
      return { ...task, ...payload };
    } catch (error) {
      this.cache.tasks = this.cache.tasks.map((t) => t.id === previous.id ? previous : t);
      for (const board of Object.values(this.cache.projectBoards)) {
        board.tasks = (board.tasks ?? []).map((t) => t.id === previous.id ? previous : t);
      }
      await this.managedStorage.writeReport("timeline-reschedule-failure", {
        taskId: task.id,
        title: task.title,
        previousStart: task.startDate,
        previousDue: task.dueDate,
        targetStart: newStartDate,
        targetDue: newDueDate,
        error: error instanceof Error ? error.message : String(error)
      });
      bridgeEvents.emit("state:changed", void 0);
      throw error;
    }
  }
  async executeBulkOperation(taskIds, operationType, parameters = {}) {
    const allTasks = this.cache.tasks;
    const taskMap = new Map(allTasks.map((t) => [String(t.id), t]));
    const targetTasks = taskIds.map((id) => taskMap.get(String(id))).filter(Boolean);
    if (targetTasks.length === 0) return null;
    const manifest = createBulkOperationManifest(targetTasks, operationType, parameters);
    const queueResults = await runBoundedQueue(targetTasks, async (task) => {
      if (operationType === "delete") {
        await this.deleteTask(task);
        return { deleted: true };
      }
      if (operationType === "complete") {
        await this.completeTask(task);
        return { status: 2 };
      }
      if (operationType === "reopen") {
        const payload2 = { ...task, status: 0 };
        await this.updateTask(payload2);
        return { status: 0 };
      }
      const mutation = computeBulkTaskMutation(task, operationType, parameters, this.settings.timeZone);
      if (!mutation) return { noop: true };
      const payload = { ...task, ...mutation };
      await this.updateTask(payload);
      return mutation;
    }, 3);
    const report = formatBulkOutcomeReport(manifest, queueResults);
    await this.managedStorage.writeReport(`bulk-${operationType}`, report);
    bridgeEvents.emit("state:changed", void 0);
    const noticeText = `\u0639\u0645\u0644\u06CC\u0627\u062A \u06AF\u0631\u0648\u0647\u06CC \u0631\u0648\u06CC ${targetTasks.length} \u062A\u0633\u06A9: ${report.succeeded} \u0645\u0648\u0641\u0642\u060C ${report.failed} \u0646\u0627\u0645\u0648\u0641\u0642.`;
    new import_obsidian46.Notice(noticeText);
    return report;
  }
  async probeTaskHierarchyAndReport() {
    const report = probeTaskHierarchy(this.cache.tasks);
    const reportPath2 = await this.managedStorage.writeReport("hierarchy-probe", report);
    const notice = `\u0628\u0631\u0631\u0633\u06CC \u0633\u0627\u062E\u062A\u0627\u0631 \u0633\u0644\u0633\u0644\u0647\u200C\u0645\u0631\u0627\u062A\u0628\u06CC: ${report.totalTasksScanned} \u062A\u0633\u06A9 \u0627\u0633\u06A9\u0646 \u0634\u062F (${report.parentChildCount} \u0632\u06CC\u0631\u062A\u0633\u06A9\u060C ${report.dependencyCount} \u0648\u0627\u0628\u0633\u062A\u06AF\u06CC). \u06AF\u0632\u0627\u0631\u0634 \u062F\u0631 ${reportPath2} \u062B\u0628\u062A \u0634\u062F.`;
    new import_obsidian46.Notice(notice);
    return report;
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
        const remote = (documents ?? []).find((document2) => String(document2?.habitId) === habitId)?.checkins ?? [];
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
        const response = await (0, import_obsidian46.requestUrl)({ url, method: init.method, headers: init.headers, body: init.body, throw: false });
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
    const response = await (0, import_obsidian46.requestUrl)({
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
      const response = await (0, import_obsidian46.requestUrl)({
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
      const response = await (0, import_obsidian46.requestUrl)({
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
    const document2 = await this.webRequest("batch/check/0");
    if (!document2) return null;
    const profiles = Array.isArray(document2.projectProfiles) ? document2.projectProfiles : [];
    const projectNames = new Map(profiles.map((project) => [String(project.id ?? ""), String(project.name ?? "")]));
    if (!Array.isArray(document2.syncTaskBean?.update)) return null;
    const updates = document2.syncTaskBean.update;
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
  async openTimelineView() {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: TIMELINE_VIEW_TYPE, active: true });
  }
  async openWeeklyReviewView() {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: WEEKLY_REVIEW_VIEW_TYPE, active: true });
  }
  async openEisenhowerMatrixView() {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: EISENHOWER_MATRIX_VIEW_TYPE, active: true });
  }
  async openTimeblockingPlannerView() {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: TIMEBLOCK_PLANNER_VIEW_TYPE, active: true });
  }
  async openActivityHeatmapView() {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: HEATMAP_VIEW_TYPE, active: true });
  }
  updateTimeblockStatusBar() {
    if (!this.timeblockStatusBarItem) return;
    const today = todayInZone(this.settings.timeZone);
    const now = /* @__PURE__ */ new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const agendaData = computeDayTimeSlots(this.cache.tasks, today, {
      startHour: 7,
      endHour: 23,
      slotMinutes: 30,
      timeZone: this.settings.timeZone
    });
    const active = findCurrentActiveBlock(agendaData.timed, currentMinutes);
    if (active) {
      this.timeblockStatusBarItem.setText(`\u{1F3AF} \u062F\u0631 \u062D\u0627\u0644 \u0627\u0646\u062C\u0627\u0645: ${cleanTaskTitle(active.task.title)} (\u062A\u0627 ${active.range.endTime})`);
      this.timeblockStatusBarItem.style.display = "";
    } else {
      this.timeblockStatusBarItem.setText("");
      this.timeblockStatusBarItem.style.display = "none";
    }
  }
  openPomodoroModal(task) {
    if (!this.pomodoroService) return;
    if (task) {
      this.pomodoroService.setTask(task);
    }
    const host = {
      app: this.app,
      timeZone: this.settings.timeZone,
      dailyNoteFolder: this.settings.dailyNoteFolder,
      tasks: () => this.cache.tasks,
      updateTask: async (mutation) => this.updateTask(mutation),
      logPomodoroToDailyNote: async (session) => this.logPomodoroToDailyNote(session)
    };
    new PomodoroModal(this.app, this.pomodoroService, host).open();
  }
  updatePomodoroStatusBar(state) {
    if (!this.pomodoroStatusBarItem) return;
    if (state.isRunning) {
      const mins = Math.floor(state.remainingSeconds / 60);
      const secs = state.remainingSeconds % 60;
      const timeStr = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
      const taskTitle = state.activeTask?.title ? ` [${cleanTaskTitle(state.activeTask.title)}]` : "";
      const icon = state.mode === "focus" ? "\u{1F345}" : state.mode === "shortBreak" ? "\u2615" : "\u{1F334}";
      this.pomodoroStatusBarItem.setText(`${icon} ${timeStr}${taskTitle}`);
      this.pomodoroStatusBarItem.style.display = "";
    } else {
      this.pomodoroStatusBarItem.style.display = "none";
    }
  }
  async logPomodoroToDailyNote(session) {
    const today = todayInZone(this.settings.timeZone);
    const jalaliKey = gregorianDateKeyToJalali(today);
    if (!jalaliKey) return false;
    const folder = this.settings.dailyNoteFolder.replace(/^[\\/]+|[\\/]+$/g, "");
    const expectedPath = `${folder}/${jalaliKey}.md`;
    let file = this.app.vault.getAbstractFileByPath(expectedPath);
    if (!(file instanceof import_obsidian46.TFile)) {
      const mdFiles = this.app.vault.getMarkdownFiles();
      file = mdFiles.find((f) => f.path.startsWith(folder) && f.basename === jalaliKey) ?? null;
    }
    if (file instanceof import_obsidian46.TFile) {
      const original = await this.app.vault.read(file);
      const line = formatPomodoroLogEntry(session, this.settings.timeZone);
      const updated = appendPomodoroLogToDailyNoteMarkdown(original, line);
      await this.app.vault.modify(file, updated);
      new import_obsidian46.Notice(`\u062C\u0644\u0633\u0647 \u062A\u0645\u0631\u06A9\u0632 \u062F\u0631 \u06CC\u0627\u062F\u062F\u0627\u0634\u062A \u0631\u0648\u0632\u0627\u0646\u0647 (${file.name}) \u062B\u0628\u062A \u0634\u062F.`);
      return true;
    }
    return false;
  }
  getCacheTasks() {
    return this.cache.tasks;
  }
  getCacheHabits() {
    return this.cache.habits;
  }
  getCacheProjects() {
    return this.cache.projects;
  }
  openMorningBriefing() {
    new MorningBriefingModal(this.app, this).open();
  }
  openCanvasExportModal() {
    new CanvasExportModal(this.app, this).open();
  }
  async logMorningBriefingToDailyNote(briefingMarkdown) {
    const today = todayInZone(this.settings.timeZone);
    const jalaliKey = gregorianDateKeyToJalali(today);
    if (!jalaliKey) return false;
    const folder = this.settings.dailyNoteFolder.replace(/^[\\/]+|[\\/]+$/g, "");
    const expectedPath = `${folder}/${jalaliKey}.md`;
    let file = this.app.vault.getAbstractFileByPath(expectedPath);
    if (!(file instanceof import_obsidian46.TFile)) {
      const mdFiles = this.app.vault.getMarkdownFiles();
      file = mdFiles.find((f) => f.path.startsWith(folder) && f.basename === jalaliKey) ?? null;
    }
    if (file instanceof import_obsidian46.TFile) {
      const original = await this.app.vault.read(file);
      const updated = injectBriefingIntoDailyNote(original, briefingMarkdown);
      await this.app.vault.modify(file, updated);
      new import_obsidian46.Notice(`\u067E\u06CC\u0634\u062E\u0648\u0627\u0646 \u0635\u0628\u062D\u06AF\u0627\u0647\u06CC \u062F\u0631 \u06CC\u0627\u062F\u062F\u0627\u0634\u062A \u0631\u0648\u0632\u0627\u0646\u0647 (${file.name}) \u062B\u0628\u062A \u0634\u062F.`);
      return true;
    } else {
      const fullPath = `${folder ? folder + "/" : ""}${jalaliKey}.md`;
      await this.app.vault.create(fullPath, briefingMarkdown);
      new import_obsidian46.Notice(`\u06CC\u0627\u062F\u062F\u0627\u0634\u062A \u0631\u0648\u0632\u0627\u0646\u0647 (${jalaliKey}.md) \u0627\u06CC\u062C\u0627\u062F \u0648 \u067E\u06CC\u0634\u062E\u0648\u0627\u0646 \u0635\u0628\u062D\u06AF\u0627\u0647\u06CC \u062F\u0631 \u0622\u0646 \u062F\u0631\u062C \u0634\u062F.`);
      return true;
    }
  }
  async openControlPage(screen) {
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: CONTROL_VIEW_TYPE, active: true, state: { screen } });
  }
  openQuickCaptureModal() {
    new QuickCaptureModal(this.app, {
      projects: async () => this.cache.projects.length ? this.cache.projects : this.client().listProjects(),
      timeZone: this.settings.timeZone,
      createTask: async (payload) => this.createTask(toTaskPayload(payload, this.settings.timeZone))
    }).open();
  }
  openLocalHabitReviewModal() {
    new LocalHabitMigrationModal(this.app).open();
  }
  async renderTodayBlock(element, dayOverride) {
    element.replaceChildren();
    const root = element.createDiv({ cls: "daily-tasks-output ticktick-task-grid" });
    try {
      const client = this.client();
      const day = dayOverride ?? todayInZone(this.settings.timeZone);
      const toolbar = root.createDiv({ cls: "daily-task-toolbar" });
      const addButton = toolbar.createEl("button", {
        cls: "daily-task-add tb-action-add-task",
        attr: { type: "button", "aria-label": "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u062C\u062F\u06CC\u062F" }
      });
      const addIcon = addButton.createSpan({ cls: "ticktick-btn-icon" });
      (0, import_obsidian46.setIcon)(addIcon, "plus");
      addButton.createSpan({ text: "+ \u062A\u0633\u06A9 \u062C\u062F\u06CC\u062F" });
      addButton.addEventListener("click", async () => {
        addButton.disabled = true;
        try {
          const projects = await client.listProjects();
          const draft = await openTaskEditor(this.app, projects, { dueDate: day }, this.availableTags(), this.cache.tasks);
          if (!draft) return;
          await this.createTask(toTaskPayload(draft, this.settings.timeZone));
          new import_obsidian46.Notice("\u062A\u0633\u06A9 \u0628\u0647 TickTick \u0627\u0636\u0627\u0641\u0647 \u0634\u062F.");
          await this.renderTodayBlock(element, dayOverride);
        } catch (error) {
          new import_obsidian46.Notice(error instanceof Error ? error.message : "\u0627\u0641\u0632\u0648\u062F\u0646 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
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
        await import_obsidian46.MarkdownRenderer.renderMarkdown(cleanTaskDescription(task.desc || task.content) || "\u062A\u0648\u0636\u06CC\u062D\u06CC \u0628\u0631\u0627\u06CC \u0627\u06CC\u0646 \u062A\u0633\u06A9 \u062B\u0628\u062A \u0646\u0634\u062F\u0647 \u0627\u0633\u062A.", description, "", this);
        const due = toDateKey(task.dueDate, task.timeZone || this.settings.timeZone) ?? "";
        const start = toDateKey(task.startDate, task.timeZone || this.settings.timeZone) ?? "";
        row.createSpan({ cls: `daily-task-date${due && due < day ? " is-overdue" : ""}`, text: formatTaskSchedule(start, due, day) });
        const actions = row.createDiv({ cls: "daily-task-actions" });
        const descriptionButton = actions.createEl("button", { cls: "daily-task-action mod-icon", attr: { "aria-label": "\u062A\u0648\u0636\u06CC\u062D\u0627\u062A" } });
        (0, import_obsidian46.setIcon)(descriptionButton, "file-text");
        const edit = actions.createEl("button", { cls: "daily-task-action mod-icon", attr: { "aria-label": "\u0648\u06CC\u0631\u0627\u06CC\u0634" } });
        (0, import_obsidian46.setIcon)(edit, "pencil");
        const remove = actions.createEl("button", { cls: "daily-task-action is-danger mod-icon", attr: { "aria-label": "\u062D\u0630\u0641" } });
        (0, import_obsidian46.setIcon)(remove, "trash-2");
        descriptionButton.addEventListener("click", () => {
          const hidden = description.hasClass("is-hidden");
          description.toggleClass("is-hidden", !hidden);
        });
        check.addEventListener("change", async () => {
          check.disabled = true;
          row.addClass("is-completed");
          try {
            await this.completeTask(task, element);
            new import_obsidian46.Notice("\u0646\u0648\u0628\u062A \u062A\u0633\u06A9 \u062F\u0631 TickTick \u062A\u06A9\u0645\u06CC\u0644 \u0634\u062F.");
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
            new import_obsidian46.Notice(error instanceof Error ? error.message : "\u062A\u06A9\u0645\u06CC\u0644 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
        edit.addEventListener("click", async () => {
          try {
            const projects = await client.listProjects();
            const draft = await openTaskEditor(this.app, projects, task, this.availableTags(), this.cache.tasks);
            if (!draft) return;
            await this.updateTask(toTaskPayload({ ...task, ...draft }, this.settings.timeZone));
            new import_obsidian46.Notice("\u062A\u0633\u06A9 \u062F\u0631 TickTick \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u062F.");
            await this.renderTodayBlock(element, dayOverride);
          } catch (error) {
            new import_obsidian46.Notice(error instanceof Error ? error.message : "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
          }
        });
        remove.addEventListener("click", async () => {
          if (!await confirmDelete(this.app, title)) return;
          row.addClass("is-leaving");
          try {
            await this.deleteTask(task, element);
            new import_obsidian46.Notice("\u062A\u0633\u06A9 \u0627\u0632 TickTick \u062D\u0630\u0641 \u0634\u062F.");
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
            new import_obsidian46.Notice(error instanceof Error ? error.message : "\u062D\u0630\u0641 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
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
        (0, import_obsidian46.setIcon)(previous, "chevron-left");
        const now = navigator2.createEl("button", { text: "\u0627\u0645\u0631\u0648\u0632", attr: { type: "button" } });
        navigator2.createEl("strong", { text: new Intl.DateTimeFormat("fa-IR-u-ca-persian", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(/* @__PURE__ */ new Date(`${day}T12:00:00`)) });
        const next = navigator2.createEl("button", { cls: "mod-icon", attr: { type: "button", "aria-label": "\u0631\u0648\u0632 \u0628\u0639\u062F", title: "\u0631\u0648\u0632 \u0628\u0639\u062F" } });
        (0, import_obsidian46.setIcon)(next, "chevron-right");
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
            new import_obsidian46.Notice(completed ? "\u062B\u0628\u062A \u0627\u0645\u0631\u0648\u0632 \u0639\u0627\u062F\u062A \u062F\u0631 TickTick \u0628\u0631\u062F\u0627\u0634\u062A\u0647 \u0634\u062F." : nextStatus === 2 ? "\u0639\u0627\u062F\u062A \u062F\u0631 TickTick \u06A9\u0627\u0645\u0644 \u0634\u062F." : `\u06CC\u06A9 \u0645\u0631\u062D\u0644\u0647 \u062B\u0628\u062A \u0634\u062F: ${nextValue}/${goal}`);
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
              const draft = await openTaskEditor(this.app, projects, task, this.availableTags(), this.cache.tasks);
              if (!draft) return;
              await this.updateTask(toTaskPayload({ ...task, ...draft }, this.settings.timeZone));
              new import_obsidian46.Notice("\u062A\u0633\u06A9 \u062A\u06A9\u0631\u0627\u0631\u0634\u0648\u0646\u062F\u0647 \u062F\u0631 TickTick \u0648\u06CC\u0631\u0627\u06CC\u0634 \u0634\u062F.");
              await this.renderRecurringBlock(element);
            } catch (error) {
              new import_obsidian46.Notice(error instanceof Error ? error.message : "\u0648\u06CC\u0631\u0627\u06CC\u0634 \u062A\u0633\u06A9 \u0646\u0627\u0645\u0648\u0641\u0642 \u0628\u0648\u062F.");
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
