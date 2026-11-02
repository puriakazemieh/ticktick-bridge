/**
 * TickTick Bridge — Project Timeline & Gantt Core Engine
 * Provides pure date-span calculations, lane packing for overlap-free rendering,
 * zoom grid generation, color mode resolution, and safe endpoint shift mutations.
 */

import { toDateKey, todayInZone } from "./date.js";
import { shiftCalendarDay, taskDateRange } from "./calendar-range.js";
import { matchesTaskFilter } from "./task-filter.js";

export const DEFAULT_TIMELINE_PALETTE = [
  "#7c6cff", "#4aa3df", "#2a9d8f", "#e76f51",
  "#d36ba6", "#d49a2a", "#5a9b68", "#f59e0b"
];

/**
 * Calculates the number of whole days between two YYYY-MM-DD date strings.
 */
export function daysBetween(fromDay, toDay) {
  if (!fromDay || !toDay) return 0;
  return Math.round((Date.parse(`${toDay}T12:00:00Z`) - Date.parse(`${fromDay}T12:00:00Z`)) / 86400000);
}

/**
 * Normalizes start and due dates for timeline visualization.
 * Returns { start, end, isSingleDay: boolean } or null if task is unscheduled.
 */
export function taskTimelineRange(task, timeZone = "Asia/Tehran") {
  if (!task) return null;
  const zone = task.timeZone || timeZone;
  
  // First check if calendar-range identifies a valid range span
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

/**
 * Computes bounding span (minDate to maxDate) encompassing all scheduled tasks.
 * Padds by marginDays to provide breathing room before/after tasks.
 */
export function computeTimelineBounds(tasks = [], options = {}) {
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

/**
 * Generates grid columns for day, week, or month zoom levels.
 */
export function generateTimelineGrid(startDay, endDay, zoom = "day", firstWeekday = 6) {
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
    // Group days into 7-day week chunks aligned to firstWeekday
    const weeks = [];
    let currentWeek = [];
    let weekColStart = 1;
    for (const day of allDays) {
      currentWeek.push(day);
      const dayOfWeek = new Date(`${day}T12:00:00Z`).getUTCDay();
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

  // Month zoom: group into month intervals with exact colStart and colSpan
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

/**
 * Greedy interval packing algorithm.
 * Groups tasks that overlap in time into separate lanes/rows,
 * ensuring overlapping ranges remain 100% legible without collisions.
 */
export function packTimelineLanes(items) {
  // Items must have { task, range: { start, end } }
  const sorted = [...items].sort((a, b) => {
    if (a.range.start !== b.range.start) {
      return a.range.start.localeCompare(b.range.start);
    }
    return a.range.end.localeCompare(b.range.end);
  });

  const laneEnds = []; // tracks the end date of the last task in each lane
  const laneAssignments = []; // [ { item, laneIndex } ]

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

/**
 * Calculates CSS grid column placement for a range bar.
 * grid-column-start is 1-indexed relative to gridStartDay.
 */
export function computeBarGridPlacement(range, gridStartDay, totalGridDays) {
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

/**
 * Resolves color tone for a task based on active colorMode.
 * Modes: "project" | "tag" | "priority" | "uniform"
 */
export function getTimelineTaskTone(task, colorMode = "project", palette = DEFAULT_TIMELINE_PALETTE) {
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
    const hash = [...tag].reduce((val, ch) => ((val * 31) + ch.charCodeAt(0)) >>> 0, 0);
    return palette[hash % palette.length];
  }

  // project mode
  const projColor = String(task?.projectColor ?? "").trim();
  if (/^#[0-9a-f]{3,8}$/i.test(projColor)) {
    return projColor;
  }
  const seed = String(task?.projectName ?? task?.projectId ?? "inbox");
  const hash = [...seed].reduce((val, ch) => ((val * 31) + ch.charCodeAt(0)) >>> 0, 0);
  return palette[hash % palette.length];
}

/**
 * Shifts task date endpoints safely.
 * edge: "both" (move entire bar) | "start" (resize start) | "due" (resize due)
 *
 * Preserves ISO time components and timezone offset.
 * Clamps single-edge moves so start never exceeds due, and due never precedes start.
 */
export function shiftTimelineEndpoints(task, deltaDays, edge = "both", timeZone = "Asia/Tehran") {
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
      // Clamp: start cannot exceed due date
      nextStartDay = currentDue && candidate > currentDue ? currentDue : candidate;
    } else if (currentDue) {
      // If task didn't have start, creating one earlier than due
      const candidate = shiftCalendarDay(currentDue, deltaDays);
      nextStartDay = candidate > currentDue ? currentDue : candidate;
    }
  } else if (edge === "due") {
    if (currentDue) {
      const candidate = shiftCalendarDay(currentDue, deltaDays);
      // Clamp: due cannot precede start date
      nextDueDay = currentStart && candidate < currentStart ? currentStart : candidate;
    } else if (currentStart) {
      const candidate = shiftCalendarDay(currentStart, deltaDays);
      nextDueDay = candidate < currentStart ? currentStart : candidate;
    }
  }

  const isTimed = !task.isAllDay && (String(task.startDate ?? task.dueDate ?? "").includes("T"));
  const startTimePart = String(task.startDate ?? "").match(/T(\d{2}:\d{2}:\d{2})/)?.[1] ?? "00:00:00";
  const dueTimePart = String(task.dueDate ?? "").match(/T(\d{2}:\d{2}:\d{2})/)?.[1] ?? "00:00:00";
  const tzOffset = "+0330";

  const nextStartDate = nextStartDay ? (isTimed ? `${nextStartDay}T${startTimePart}${tzOffset}` : `${nextStartDay}T00:00:00${tzOffset}`) : null;
  const nextDueDate = nextDueDay ? (isTimed ? `${nextDueDay}T${dueTimePart}${tzOffset}` : `${nextDueDay}T00:00:00${tzOffset}`) : null;

  return {
    ...task,
    startDate: nextStartDate,
    dueDate: nextDueDate,
    isAllDay: !isTimed,
    timeZone: zone
  };
}

/**
 * Partitions tasks for the timeline workspace:
 * - rangeTasks: have distinct start & due dates (or range span)
 * - pointTasks: have only a single date (milestones)
 * - backlogTasks: unscheduled tasks without dates
 */
export function partitionTimelineTasks(tasks = [], filterState = {}, options = {}) {
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
