import { toDateKey } from "./date.js";

export function shiftCalendarDay(day, amount) {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function weekdayIndex(day) { return new Date(`${day}T12:00:00.000Z`).getUTCDay(); }
export function weekRange(day, firstWeekday = 1) {
  const offset = (weekdayIndex(day) - firstWeekday + 7) % 7;
  const start = shiftCalendarDay(day, -offset);
  return Array.from({ length: 7 }, (_, index) => shiftCalendarDay(start, index));
}
export function monthRange(day, firstWeekday = 1) {
  const monthStart = `${String(day).slice(0, 7)}-01`;
  const offset = (weekdayIndex(monthStart) - firstWeekday + 7) % 7;
  const start = shiftCalendarDay(monthStart, -offset);
  return Array.from({ length: 42 }, (_, index) => shiftCalendarDay(start, index));
}
function taskDay(task, timeZone) { return toDateKey(task.dueDate, task.timeZone || timeZone) ?? toDateKey(task.startDate, task.timeZone || timeZone); }
function taskTime(task) { return String(task.startDate ?? task.dueDate ?? "").match(/T(\d{2}:\d{2})/)?.[1] ?? ""; }
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
  const buckets = planningBuckets(tasks, day, timeZone, showCompleted);
  return [...sortPlanningTasks(buckets.allDay.filter(task => taskDay(task, timeZone) === day)), ...sortPlanningTasks(buckets.timed.filter(task => taskDay(task, timeZone) === day)), ...sortPlanningTasks(buckets.overdue)];
}
