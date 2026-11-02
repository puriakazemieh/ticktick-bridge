/**
 * @file reminder-daemon.test.js
 * Unit tests for reminder daemon and snooze mutations.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkDueReminders,
  computeSnoozeMutation
} from '../src/core/reminder-daemon.js';

test('checkDueReminders detects tasks within the lead time window', () => {
  // Current time: 10:00 (600 minutes)
  const currentMinutes = 600;
  const today = '2026-11-03';

  const tasks = [
    // Due at 10:04 (diff = 4 min <= lead 5 min) -> ALERT
    { id: '1', title: 'جلسه ۱۰:۰۴', dueDate: '2026-11-03T10:04:00+0330', status: 0 },
    // Due at 10:20 (diff = 20 min > lead 5 min) -> NO
    { id: '2', title: 'جلسه ۱۰:۲۰', dueDate: '2026-11-03T10:20:00+0330', status: 0 },
    // Due at 09:55 (diff = -5 min >= -15 min) -> ALERT (just started/overdue)
    { id: '3', title: 'جلسه ۰۹:۵۵', dueDate: '2026-11-03T09:55:00+0330', status: 0 },
    // Completed task -> NO
    { id: '4', title: 'انجام شده', dueDate: '2026-11-03T10:02:00+0330', status: 2 },
    // Untimed task -> NO
    { id: '5', title: 'بدون زمان', dueDate: '2026-11-03T00:00:00Z', isAllDay: true, status: 0 }
  ];

  const alerts = checkDueReminders(tasks, {
    today,
    currentMinutes,
    leadMinutes: 5,
    timeZone: 'Asia/Tehran'
  });

  assert.equal(alerts.length, 2);
  const ids = alerts.map(a => a.task.id);
  assert.ok(ids.includes('1'));
  assert.ok(ids.includes('3'));
});

test('checkDueReminders ignores tasks in acknowledgedIds set', () => {
  const currentMinutes = 600;
  const today = '2026-11-03';

  const tasks = [
    { id: '1', title: 'جلسه ۱۰:۰۴', dueDate: '2026-11-03T10:04:00+0330', status: 0 }
  ];

  const ackSet = new Set(['1']);

  const alerts = checkDueReminders(tasks, {
    today,
    currentMinutes,
    acknowledgedIds: ackSet,
    leadMinutes: 5,
    timeZone: 'Asia/Tehran'
  });

  assert.equal(alerts.length, 0);
});

test('computeSnoozeMutation calculates correct shifted timestamps', () => {
  const task = { id: 't1', projectId: 'p1', title: 'جلسه' };
  const today = '2026-11-03';
  const currentMinutes = 600; // 10:00

  // Snooze by 15 minutes -> new start 10:15 (615), end 10:45 (645)
  const mutation = computeSnoozeMutation(task, today, currentMinutes, 15, 'Asia/Tehran');

  assert.equal(mutation.id, 't1');
  assert.equal(mutation.startDate, '2026-11-03T10:15:00+0330');
  assert.equal(mutation.dueDate, '2026-11-03T10:45:00+0330');
  assert.equal(mutation.isAllDay, false);
});
