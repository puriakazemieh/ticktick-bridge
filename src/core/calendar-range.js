import { toDateKey } from "./date.js";

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
function taskDay(task, timeZone) { return toDateKey(task.dueDate, task.timeZone || timeZone) ?? toDateKey(task.startDate, task.timeZone || timeZone); }
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
 * calendar cells never repeat an overdue one-off task in later days. */
export function taskOccursOnCalendarDay(task, day, timeZone = "Asia/Tehran", showCompleted = false) {
  if (Number(task?.status ?? 0) !== 0) return showCompleted && taskDay(task, timeZone) === day;
  const due = toDateKey(task?.dueDate, task?.timeZone || timeZone);
  const start = toDateKey(task?.startDate, task?.timeZone || timeZone);
  const anchor = start ?? due;
  if (!anchor) return false;
  if (!task?.repeatFlag) return start && due ? day >= start && day <= due : day === anchor;
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
export function sortPlanningTasks(tasks) {
  return [...tasks].sort((left, right) => Number(left.sortOrder ?? left.order ?? 0) - Number(right.sortOrder ?? right.order ?? 0)
    || taskTime(left).localeCompare(taskTime(right)) || Number(right.priority ?? 0) - Number(left.priority ?? 0)
    || String(left.title ?? "").localeCompare(String(right.title ?? ""), "fa"));
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
export function tasksForCalendarDay(tasks, day, timeZone = "Asia/Tehran", showCompleted = false) {
  return sortPlanningTasks((tasks ?? []).filter(task => taskOccursOnCalendarDay(task, day, timeZone, showCompleted)));
}
