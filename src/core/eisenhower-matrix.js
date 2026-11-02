/**
 * TickTick Bridge — Eisenhower Decision Matrix Core
 * Pure 2x2 prioritization engine: Do First (Q1), Schedule (Q2), Delegate (Q3), Eliminate (Q4).
 * Handles classification, quadrant bounds, and drop mutation calculation.
 */

import { toDateKey, todayInZone } from "./date.js";
import { shiftCalendarDay } from "./calendar-range.js";

export const QUADRANT_IDS = ["q1", "q2", "q3", "q4"];

export const QUADRANTS = {
  q1: {
    id: "q1",
    title: "اقدام فوری (Do First)",
    subtitle: "فوری و مهم",
    shortName: "فوری و مهم",
    color: "var(--text-error, #d32f2f)",
    accentBg: "rgba(211, 47, 47, 0.08)",
    icon: "alert-triangle"
  },
  q2: {
    id: "q2",
    title: "برنامه‌ریزی (Schedule)",
    subtitle: "مهم و غیرفوری",
    shortName: "مهم / برنامه‌ریزی",
    color: "var(--interactive-accent, #1976d2)",
    accentBg: "rgba(25, 118, 210, 0.08)",
    icon: "calendar"
  },
  q3: {
    id: "q3",
    title: "واگذاری / اقدام سریع (Delegate)",
    subtitle: "فوری و غیرمهم",
    shortName: "فوری / واگذاری",
    color: "var(--text-warning, #f57c00)",
    accentBg: "rgba(245, 124, 0, 0.08)",
    icon: "users"
  },
  q4: {
    id: "q4",
    title: "حذف / بک‌لاگ (Eliminate)",
    subtitle: "نه فوری و نه مهم",
    shortName: "بک‌لاگ / کم‌اولویت",
    color: "var(--text-muted, #757575)",
    accentBg: "rgba(117, 117, 117, 0.08)",
    icon: "archive"
  }
};

/**
 * Checks if a task is considered urgent (due today, overdue, or due within thresholdDays).
 */
export function isTaskUrgent(task, today, timeZone = "Asia/Tehran", thresholdDays = 2) {
  if (!task) return false;
  const dueDay = toDateKey(task.dueDate || task.startDate, task.timeZone || timeZone);
  if (!dueDay) return false; // Unscheduled tasks are not urgent
  const urgentThreshold = shiftCalendarDay(today, thresholdDays);
  return dueDay <= urgentThreshold;
}

/**
 * Checks if a task is considered important (High 5 or Medium 3 priority, or tagged #important / #مهم).
 */
export function isTaskImportant(task) {
  if (!task) return false;
  const priority = Number(task.priority ?? 0);
  if (priority >= 3) return true;
  if (Array.isArray(task.tags)) {
    const importantTags = ["important", "مهم", "priority", "critical"];
    return task.tags.some(t => importantTags.includes(String(t).toLowerCase().replace(/^#/, "")));
  }
  return false;
}

/**
 * Partitions tasks into 4 Eisenhower quadrants.
 * Excludes completed tasks by default.
 */
export function partitionEisenhowerMatrix(tasks = [], options = {}) {
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

  // Sort tasks within each quadrant by priority desc, then date asc
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

/**
 * Computes mutation payload for dragging a task into targetQuadrant.
 */
export function computeQuadrantDropMutation(task, targetQuadrant, today, timeZone = "Asia/Tehran") {
  if (!task || !QUADRANT_IDS.includes(targetQuadrant)) return null;

  const tzOffset = "+0330";
  const currentDue = toDateKey(task.dueDate, task.timeZone || timeZone);

  switch (targetQuadrant) {
    case "q1": {
      // Do First: High priority (5) + due today (or keep overdue/today)
      const due = (currentDue && currentDue <= today) ? currentDue : today;
      return {
        id: String(task.id),
        projectId: task.projectId,
        priority: 5,
        dueDate: `${due}T00:00:00${tzOffset}`,
        isAllDay: true
      };
    }

    case "q2": {
      // Schedule: High priority (5) + scheduled in future (> 2 days)
      const targetDay = (currentDue && currentDue > shiftCalendarDay(today, 2))
        ? currentDue
        : shiftCalendarDay(today, 3);
      return {
        id: String(task.id),
        projectId: task.projectId,
        priority: 5,
        dueDate: `${targetDay}T00:00:00${tzOffset}`,
        isAllDay: true
      };
    }

    case "q3": {
      // Delegate: Low priority (1) + due today (needs immediate attention without high personal priority)
      const due = (currentDue && currentDue <= today) ? currentDue : today;
      return {
        id: String(task.id),
        projectId: task.projectId,
        priority: 1,
        dueDate: `${due}T00:00:00${tzOffset}`,
        isAllDay: true
      };
    }

    case "q4": {
      // Eliminate / Backlog: No priority (0) + clear due date
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
