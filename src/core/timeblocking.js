/**
 * TickTick Bridge — Daily Timeblocking & Agenda Core Engine
 * Computes grid slots, lane packing, duration resizing, and time assignment mutations.
 */

import { toDateKey } from "./date.js";

/**
 * Parses "HH:mm" or ISO string into minutes from midnight (0..1439).
 */
export function timeStringToMinutes(str) {
  if (!str) return null;
  const match = String(str).match(/(?:T|\s|^)(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

/**
 * Formats minutes from midnight into "HH:mm".
 */
export function minutesToTimeString(totalMinutes) {
  const clamped = Math.max(0, Math.min(1439, Math.floor(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Extracts start and end minutes for a task on targetDay.
 * Default duration is 45 minutes if only one timestamp is present.
 */
export function extractTaskTimeRange(task, targetDay, options = {}) {
  const defaultDuration = Number(options.defaultDurationMinutes ?? 45);
  const timeZone = options.timeZone || "Asia/Tehran";

  if (!task) return null;
  if (task.isAllDay) return null; // Explicitly all-day

  const startDay = toDateKey(task.startDate, task.timeZone || timeZone);
  const dueDay = toDateKey(task.dueDate, task.timeZone || timeZone);

  // Must touch targetDay
  const touchesTarget = (startDay === targetDay) || (dueDay === targetDay) || (!startDay && dueDay === targetDay);
  if (!touchesTarget) return null;

  const startMin = timeStringToMinutes(task.startDate);
  const dueMin = timeStringToMinutes(task.dueDate);

  if (startMin === null && dueMin === null) return null; // Untimed

  let start = 0;
  let end = 0;

  if (startMin !== null && dueMin !== null) {
    if (startDay === targetDay && dueDay === targetDay) {
      start = startMin;
      end = Math.max(start + 15, dueMin);
    } else if (startDay === targetDay) {
      start = startMin;
      end = 24 * 60; // Spans past midnight
    } else {
      start = 0;
      end = dueMin;
    }
  } else if (startMin !== null) {
    start = startMin;
    end = Math.min(24 * 60, start + defaultDuration);
  } else {
    // Only dueMin is present
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

/**
 * Computes vertical time slots and packs timed blocks into collision-free lanes.
 */
export function computeDayTimeSlots(tasks = [], targetDay, options = {}) {
  const startHour = Number(options.startHour ?? 7); // Default 07:00
  const endHour = Number(options.endHour ?? 23);     // Default 23:00 (up to 24:00)
  const slotMinutes = Number(options.slotMinutes ?? 30);
  const timeZone = options.timeZone || "Asia/Tehran";

  const dayStartMinutes = startHour * 60;
  const dayEndMinutes = (endHour + 1) * 60;
  const totalSlots = Math.ceil((dayEndMinutes - dayStartMinutes) / slotMinutes);

  // Generate slot metadata
  const slots = [];
  for (let i = 0; i < totalSlots; i++) {
    const slotMin = dayStartMinutes + i * slotMinutes;
    slots.push({
      index: i + 1, // 1-based for CSS Grid
      startMinutes: slotMin,
      endMinutes: slotMin + slotMinutes,
      timeLabel: minutesToTimeString(slotMin),
      isHourMark: (slotMin % 60) === 0
    });
  }

  const timed = [];
  const untimed = [];
  const overdue = [];

  for (const task of tasks) {
    if (!task) continue;
    const isCompleted = Number(task.status ?? 0) !== 0;
    if (isCompleted) continue; // Exclude completed from active agenda

    const dueDay = toDateKey(task.dueDate, task.timeZone || timeZone);
    const startDay = toDateKey(task.startDate, task.timeZone || timeZone);

    if (dueDay && dueDay < targetDay) {
      overdue.push(task);
      continue;
    }

    if (dueDay === targetDay || startDay === targetDay) {
      const range = extractTaskTimeRange(task, targetDay, { timeZone });
      if (range) {
        // Calculate grid coordinates (clamped to agenda hours)
        const effectiveStart = Math.max(dayStartMinutes, Math.min(dayEndMinutes - 15, range.startMinutes));
        const effectiveEnd = Math.max(effectiveStart + 15, Math.min(dayEndMinutes, range.endMinutes));

        // 1-indexed row start & span
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

  // Pack overlapping timed blocks into lanes
  timed.sort((a, b) => a.effectiveStart - b.effectiveStart || (b.effectiveEnd - a.effectiveEnd));

  const activeLanes = []; // array of end times
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

  // Compute total lanes for overlapping clusters
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

/**
 * Computes mutation payload to assign or move a task to a specific time block.
 */
export function computeTimeSlotDropMutation(task, targetDay, startHour, startMinute, durationMinutes = 45, timeZone = "Asia/Tehran") {
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

/**
 * Computes mutation payload to resize an existing timeblock's duration.
 */
export function computeResizeBlockMutation(task, targetDay, newDurationMinutes, timeZone = "Asia/Tehran") {
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

/**
 * Finds the currently active timed task given the current time in minutes.
 */
export function findCurrentActiveBlock(timedItems = [], currentMinutes) {
  if (!Array.isArray(timedItems)) return null;
  return timedItems.find(item => item.effectiveStart <= currentMinutes && currentMinutes < item.effectiveEnd) ?? null;
}
