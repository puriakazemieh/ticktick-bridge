/**
 * TickTick Bridge — Weekly Review and Execution Dashboard Core
 * Pure cache-only metrics, Saturday–Friday boundaries, review categorizations,
 * and preview action builders.
 */

import { toDateKey, todayInZone } from "./date.js";
import { weekRange, shiftCalendarDay } from "./calendar-range.js";

/**
 * Computes week range starting on Saturday (firstWeekday = 6) and ending on Friday.
 * Supports week offsetting (e.g. -1 for previous week, +1 for next week).
 */
export function computeWeeklyReviewRange(anchorDay, weekOffset = 0) {
  const targetDay = weekOffset !== 0 ? shiftCalendarDay(anchorDay, weekOffset * 7) : anchorDay;
  const days = weekRange(targetDay, 6); // 6 is Saturday in JS (getUTCDay); returns 7-day array
  const start = days[0];
  const end = days[6];

  return {
    start, // Saturday (YYYY-MM-DD)
    end,   // Friday (YYYY-MM-DD)
    days,
    previousWeekAnchor: shiftCalendarDay(start, -7),
    nextWeekAnchor: shiftCalendarDay(start, 7)
  };
}

/**
 * Calculates review metrics from tasks cache for a Saturday–Friday week range.
 */
export function computeWeeklyReviewMetrics(tasks = [], weekRange, options = {}) {
  const timeZone = options.timeZone || "Asia/Tehran";
  const today = options.today || todayInZone(timeZone);
  const { start, end } = weekRange;

  const completed = [];
  const scheduledInWeek = [];
  const overdue = [];
  const moved = [];
  const unscheduled = [];
  const tagCounts = new Map();

  for (const task of tasks) {
    if (!task) continue;
    const isCompleted = Number(task.status ?? 0) !== 0;
    const dueDay = toDateKey(task.dueDate, task.timeZone || timeZone);
    const startDay = toDateKey(task.startDate, task.timeZone || timeZone);
    const completionDay = toDateKey(task.completedTime, task.timeZone || timeZone) || dueDay;

    // 1. Completed tasks in this week
    if (isCompleted) {
      if (completionDay && completionDay >= start && completionDay <= end) {
        completed.push(task);
        recordTags(task.tags, tagCounts);
      }
      continue;
    }

    // Active (open) tasks below:
    
    // 2. Unscheduled backlog (no dates at all)
    if (!dueDay && !startDay) {
      unscheduled.push(task);
      continue;
    }

    // 3. Overdue tasks (due strictly before today)
    const effectiveDue = dueDay || startDay;
    if (effectiveDue && effectiveDue < today) {
      overdue.push(task);
      recordTags(task.tags, tagCounts);
    }

    // 4. Scheduled within this week
    // Checks if task date interval intersects [start, end]
    const taskStart = startDay || dueDay;
    const taskEnd = dueDay || startDay;
    const intersectsWeek = (taskStart <= end && taskEnd >= start);
    
    if (intersectsWeek) {
      scheduledInWeek.push(task);
      recordTags(task.tags, tagCounts);

      // 5. Moved tasks:
      // A task is considered "moved" if it was rescheduled (e.g. multi-day range where start !== due,
      // modified after scheduled due date, or tagged with moved/rescheduled/postponed).
      const modifiedDay = toDateKey(task.modifiedTime, task.timeZone || timeZone);
      const isMoved = (taskStart && taskEnd && taskStart !== taskEnd) ||
                      (modifiedDay && effectiveDue && modifiedDay > effectiveDue) ||
                      (Array.isArray(task.tags) && task.tags.some(t => ["moved", "rescheduled", "postponed"].includes(String(t).toLowerCase())));
      if (isMoved) {
        moved.push(task);
      }
    }
  }

  // Calculate most used tags sorted descending by count
  const mostUsedTags = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);

  const totalReviewed = completed.length + scheduledInWeek.length;
  const completionRate = totalReviewed > 0 ? Math.round((completed.length / totalReviewed) * 100) : 0;

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

/**
 * Preview action plan to move overdue tasks to targetDay (e.g. today or next Saturday).
 */
export function planMoveOverdueAction(overdueTasks = [], targetDay) {
  if (!targetDay) throw new Error("تاریخ مقصد برای انتقال تسک‌های معوق مشخص نشده است.");
  return {
    operationType: "schedule-date",
    parameters: { targetDay },
    tasks: overdueTasks,
    description: `انتقال ${overdueTasks.length} تسک معوق به تاریخ ${targetDay}`
  };
}

/**
 * Preview action plan to clear scheduled dates for tasks in current week (moves to backlog).
 */
export function planClearWeeklyAction(scheduledTasks = []) {
  return {
    operationType: "clear-date",
    parameters: {},
    tasks: scheduledTasks,
    description: `لغو تاریخ و انتقال ${scheduledTasks.length} تسک این هفته به بک‌لاگ`
  };
}

/**
 * Preview action plan to schedule tasks for the next week's start (Saturday).
 */
export function planNextWeekAction(tasksToPlan = [], nextWeekStart) {
  if (!nextWeekStart) throw new Error("تاریخ آغاز هفته آینده مشخص نشده است.");
  return {
    operationType: "schedule-date",
    parameters: { targetDay: nextWeekStart },
    tasks: tasksToPlan,
    description: `برنامه‌ریزی ${tasksToPlan.length} تسک برای آغاز هفته آینده (${nextWeekStart})`
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
