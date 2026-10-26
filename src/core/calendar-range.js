import { jalaliDateKeyToGregorian, toDateKey } from "./date.js";

export function shiftCalendarDay(day, amount) {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function weekdayIndex(day) { return new Date(`${day}T12:00:00.000Z`).getUTCDay(); }
export function weekRange(day, firstWeekday = 6) {
  const offset = (weekdayIndex(day) - firstWeekday + 7) % 7;
  const start = shiftCalendarDay(day, -offset);
  return Array.from({ length: 7 }, (_, index) => shiftCalendarDay(start, index));
}
export function monthRange(day, firstWeekday = 6) {
  const monthStart = `${String(day).slice(0, 7)}-01`;
  const offset = (weekdayIndex(monthStart) - firstWeekday + 7) % 7;
  const start = shiftCalendarDay(monthStart, -offset);
  return Array.from({ length: 42 }, (_, index) => shiftCalendarDay(start, index));
}
function persianParts(day) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US-u-ca-persian", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(new Date(`${day}T12:00:00Z`)).filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
  return { year: parts.year, month: parts.month, day: parts.day };
}
function pad(value) { return String(value).padStart(2, "0"); }
function persianMonthStart(year, month) { return jalaliDateKeyToGregorian(`${year}-${pad(month)}-01`); }
function shiftedPersianMonth(year, month, amount) {
  const index = (year * 12) + (month - 1) + amount;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}
export function isSamePersianMonth(day, referenceDay) {
  const left = persianParts(day); const right = persianParts(referenceDay);
  return left.year === right.year && left.month === right.month;
}
export function persianMonthRange(day, firstWeekday = 6) {
  const current = persianParts(day); const monthStart = persianMonthStart(current.year, current.month);
  if (!monthStart) return monthRange(day, firstWeekday);
  const next = shiftedPersianMonth(current.year, current.month, 1);
  const nextStart = persianMonthStart(next.year, next.month);
  const last = nextStart ? shiftCalendarDay(nextStart, -1) : shiftCalendarDay(monthStart, 30);
  const offset = (weekdayIndex(monthStart) - firstWeekday + 7) % 7;
  const start = shiftCalendarDay(monthStart, -offset);
  const needed = Math.ceil((dayNumber(last) - dayNumber(start) + 1) / 7) * 7;
  return Array.from({ length: Math.max(35, needed) }, (_, index) => shiftCalendarDay(start, index));
}
export function shiftPersianMonth(day, amount) {
  const current = persianParts(day); const target = shiftedPersianMonth(current.year, current.month, amount);
  const start = persianMonthStart(target.year, target.month);
  const following = shiftedPersianMonth(target.year, target.month, 1);
  const nextStart = persianMonthStart(following.year, following.month);
  if (!start || !nextStart) return shiftCalendarDay(day, amount * 30);
  const length = dayNumber(nextStart) - dayNumber(start);
  return shiftCalendarDay(start, Math.min(current.day, length) - 1);
}
function taskDay(task, timeZone) { return toDateKey(task.dueDate, task.timeZone || timeZone) ?? toDateKey(task.startDate, task.timeZone || timeZone); }
/** A task with distinct start/end dates can be painted as one continuous calendar bar.
 * TickTick keeps this visual span even when the task also has a repeat rule. */
export function taskDateRange(task, timeZone = "Asia/Tehran") {
  const start = toDateKey(task?.startDate, task?.timeZone || timeZone);
  const end = toDateKey(task?.dueDate, task?.timeZone || timeZone);
  return start && end && start < end ? { start, end } : null;
}
function taskTime(task) { return String(task.startDate ?? task.dueDate ?? "").match(/T(\d{2}:\d{2})/)?.[1] ?? ""; }
function dayNumber(day) { return Math.floor(Date.parse(`${day}T12:00:00Z`) / 86400000); }
function ruleParts(task) {
  const source = String(task.repeatFlag ?? "").toUpperCase().replace(/^RRULE:/, "");
  return Object.fromEntries(source.split(";").map(part => part.split("=", 2)).filter(([key, value]) => key && value));
}
function ruleDate(value) {
  const match = String(value ?? "").match(/^(\d{4})(\d{2})(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}
function weekdayCode(day) { return ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][weekdayIndex(day)]; }
function excluded(task, day) {
  const values = [task.exDates, task.exDate, task.exdate].flatMap(value => Array.isArray(value) ? value : value == null ? [] : String(value).split(","));
  return values.some(value => ruleDate(value) === day || String(value).replaceAll("-", "").slice(0, 8) === day.replaceAll("-", ""));
}

/** Whether this exact cell contains an occurrence. Unlike the daily agenda,
 * calendar cells never repeat an overdue one-off task in later days.
 *
 * TickTick advances a recurring task's `dueDate` to its next unfinished
 * occurrence when an occurrence is completed. The calendar must therefore
 * display that next actionable day once, rather than expanding the RRULE into
 * prior completed days (or every later matching weekday). */
export function taskOccursOnCalendarDay(task, day, timeZone = "Asia/Tehran", showCompleted = false) {
  if (Number(task?.status ?? 0) !== 0) return showCompleted && taskDay(task, timeZone) === day;
  const due = toDateKey(task?.dueDate, task?.timeZone || timeZone);
  const start = toDateKey(task?.startDate, task?.timeZone || timeZone);
  const anchor = start ?? due;
  if (!anchor) return false;
  if (!task?.repeatFlag) return start && due ? day >= start && day <= due : day === anchor;
  // `dueDate` is the current, unfinished TickTick recurrence. For malformed
  // legacy records without it, fall back to the original start date.
  if (due) return day === due;
  if (day < anchor || excluded(task, day)) return false;
  const rule = ruleParts(task); const frequency = rule.FREQ ?? "DAILY"; const interval = Math.max(1, Number(rule.INTERVAL ?? 1));
  const until = ruleDate(rule.UNTIL); if (until && day > until) return false;
  const distance = dayNumber(day) - dayNumber(anchor);
  if (frequency === "DAILY") return distance % interval === 0;
  if (frequency === "WEEKLY") {
    const weeks = Math.floor(distance / 7); if (weeks % interval) return false;
    const days = rule.BYDAY ? rule.BYDAY.split(",").map(value => value.replace(/^[-+]?\d+/, "")) : [weekdayCode(anchor)];
    return days.includes(weekdayCode(day));
  }
  const value = new Date(`${day}T12:00:00Z`); const base = new Date(`${anchor}T12:00:00Z`);
  if (frequency === "MONTHLY") {
    const months = (value.getUTCFullYear() - base.getUTCFullYear()) * 12 + value.getUTCMonth() - base.getUTCMonth();
    const dates = (rule.BYMONTHDAY ?? String(base.getUTCDate())).split(",").map(Number);
    return months >= 0 && months % interval === 0 && dates.includes(value.getUTCDate());
  }
  if (frequency === "YEARLY") return value.getUTCFullYear() >= base.getUTCFullYear() && (value.getUTCFullYear() - base.getUTCFullYear()) % interval === 0 && value.getUTCMonth() === base.getUTCMonth() && value.getUTCDate() === base.getUTCDate();
  return day === anchor;
}
/** Expand the future occurrences of a recurring task for the calendar's
 * optional "all occurrences" view.  The normal calendar intentionally shows
 * only TickTick's next actionable occurrence. */
export function recurringTaskOccursOnDay(task, day, timeZone = "Asia/Tehran") {
  if (Number(task?.status ?? 0) !== 0 || !task?.repeatFlag || excluded(task, day)) return false;
  const due = toDateKey(task?.dueDate, task?.timeZone || timeZone);
  const start = toDateKey(task?.startDate, task?.timeZone || timeZone);
  const anchor = start ?? due;
  if (!anchor || day < anchor) return false;
  const rule = ruleParts(task); const frequency = rule.FREQ ?? "DAILY"; const interval = Math.max(1, Number(rule.INTERVAL ?? 1));
  const until = ruleDate(rule.UNTIL); if (until && day > until) return false;
  const distance = dayNumber(day) - dayNumber(anchor);
  if (frequency === "DAILY") return distance % interval === 0;
  if (frequency === "WEEKLY") {
    const weeks = Math.floor(distance / 7); if (weeks % interval) return false;
    const days = rule.BYDAY ? rule.BYDAY.split(",").map(value => value.replace(/^[-+]?\d+/, "")) : [weekdayCode(anchor)];
    return days.includes(weekdayCode(day));
  }
  const value = new Date(`${day}T12:00:00Z`); const base = new Date(`${anchor}T12:00:00Z`);
  if (frequency === "MONTHLY") {
    const months = (value.getUTCFullYear() - base.getUTCFullYear()) * 12 + value.getUTCMonth() - base.getUTCMonth();
    const dates = (rule.BYMONTHDAY ?? String(base.getUTCDate())).split(",").map(Number);
    return months >= 0 && months % interval === 0 && dates.includes(value.getUTCDate());
  }
  if (frequency === "YEARLY") return value.getUTCFullYear() >= base.getUTCFullYear() && (value.getUTCFullYear() - base.getUTCFullYear()) % interval === 0 && value.getUTCMonth() === base.getUTCMonth() && value.getUTCDate() === base.getUTCDate();
  return day === anchor;
}
export function sortPlanningTasks(tasks, mode = "ticktick") {
  const byTickTick = (left, right) => Number(left.sortOrder ?? left.order ?? 0) - Number(right.sortOrder ?? right.order ?? 0)
    || taskTime(left).localeCompare(taskTime(right)) || Number(right.priority ?? 0) - Number(left.priority ?? 0)
    || String(left.title ?? "").localeCompare(String(right.title ?? ""), "fa");
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
export function planningBuckets(tasks, day, timeZone = "Asia/Tehran", showCompleted = false) {
  const result = { allDay: [], timed: [], overdue: [], recurring: [], completed: [], unscheduled: [] };
  for (const task of tasks ?? []) {
    const completed = Number(task.status ?? 0) !== 0;
    if (completed) { if (showCompleted) result.completed.push(task); continue; }
    const key = taskDay(task, timeZone);
    if (!key) { result.unscheduled.push(task); continue; }
    if (task.repeatFlag) result.recurring.push(task);
    if (key < day) result.overdue.push(task);
    else if (String(task.startDate ?? task.dueDate ?? "").includes("T") && !Boolean(task.isAllDay)) result.timed.push(task);
    else result.allDay.push(task);
  }
  for (const key of Object.keys(result)) result[key] = sortPlanningTasks(result[key]);
  return result;
}
export function tasksForCalendarDay(tasks, day, timeZone = "Asia/Tehran", showCompleted = false, sortMode = "ticktick") {
  return sortPlanningTasks((tasks ?? []).filter(task => taskOccursOnCalendarDay(task, day, timeZone, showCompleted)), sortMode);
}
