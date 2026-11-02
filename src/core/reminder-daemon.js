/**
 * @file reminder-daemon.js
 * Pure in-memory scheduler and due reminder checker for upcoming tasks.
 */

import { extractTaskTimeRange, minutesToTimeString, timeStringToMinutes } from './timeblocking.js';
import { todayInZone } from './date.js';

/**
 * Checks which tasks are due for a reminder alert.
 * @param {Array<Object>} tasks
 * @param {Object} options
 * @param {string} options.today YYYY-MM-DD
 * @param {number} options.currentMinutes Current time of day in minutes (0..1439)
 * @param {Set<string>|Array<string>} [options.acknowledgedIds] Set of task IDs already alerted
 * @param {number} [options.leadMinutes=5] Minutes before due time to trigger alert
 * @param {string} [options.timeZone='Asia/Tehran']
 * @returns {Array<{ task: Object, dueMinutes: number, diffMinutes: number }>}
 */
export function checkDueReminders(tasks, options) {
  const today = options.today || todayInZone(options.timeZone || 'Asia/Tehran');
  const currentMinutes = options.currentMinutes;
  const leadMinutes = Number(options.leadMinutes ?? 5);
  const timeZone = options.timeZone || 'Asia/Tehran';
  const ackSet = options.acknowledgedIds instanceof Set
    ? options.acknowledgedIds
    : new Set(options.acknowledgedIds || []);

  if (!Array.isArray(tasks) || typeof currentMinutes !== 'number') {
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

    // Trigger alert if within lead window up to 15 minutes past due
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

/**
 * Computes a mutation payload to snooze a task by N minutes.
 * @param {Object} task
 * @param {string} today YYYY-MM-DD
 * @param {number} currentMinutes Current time of day in minutes
 * @param {number} [snoozeMinutes=15]
 * @param {string} [timeZone='Asia/Tehran']
 * @returns {Object} Mutation payload for updateTask
 */
export function computeSnoozeMutation(task, today, currentMinutes, snoozeMinutes = 15, timeZone = 'Asia/Tehran') {
  const newStartMin = Math.min(1439, currentMinutes + snoozeMinutes);
  const newEndMin = Math.min(1439, newStartMin + 30);
  const tzOffset = '+0330';

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
