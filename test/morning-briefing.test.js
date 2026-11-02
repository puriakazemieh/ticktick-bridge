/**
 * @file morning-briefing.test.js
 * Unit tests for morning briefing compilation and markdown injection.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMorningBriefing,
  formatMorningBriefingMarkdown,
  injectBriefingIntoDailyNote
} from '../src/core/morning-briefing.js';

test('computeMorningBriefing separates overdue, today timed, untimed priorities, habits, and yesterday wins', () => {
  const tasks = [
    { id: '1', title: 'تسک دیروز انجام نشده', status: 0, dueDate: '2026-11-02T10:00:00Z', priority: 5 },
    { id: '2', title: 'جلسه تیم', status: 0, dueDate: '2026-11-03T10:00:00+0330', priority: 3 },
    { id: '3', title: 'بررسی کد عصر', status: 0, dueDate: '2026-11-03T16:00:00+0330', priority: 5 },
    { id: '4', title: 'تسک بدون زمان اولویت بالا', status: 0, dueDate: '2026-11-03T00:00:00Z', isAllDay: true, priority: 5 },
    { id: '5', title: 'تسک بدون زمان اولویت پایین', status: 0, dueDate: '2026-11-03T00:00:00Z', isAllDay: true, priority: 1 },
    { id: '6', title: 'تسک دیروز انجام شده', status: 2, completedTime: '2026-11-02T15:00:00Z', dueDate: '2026-11-02T10:00:00Z' },
    { id: '7', title: 'تسک آینده', status: 0, dueDate: '2026-11-05T10:00:00Z' }
  ];

  const habits = [
    { id: 'h1', name: 'ورزش', goal: 30, unit: 'دقیقه', repeatRule: 'RRULE:FREQ=DAILY' }
  ];

  const briefing = computeMorningBriefing(tasks, habits, {
    today: '2026-11-03',
    timeZone: 'Asia/Tehran'
  });

  assert.equal(briefing.today, '2026-11-03');
  assert.equal(briefing.overdueTasks.length, 1);
  assert.equal(briefing.overdueTasks[0].id, '1');

  assert.equal(briefing.todayTimedTasks.length, 2);
  assert.equal(briefing.todayTimedTasks[0].task.id, '2'); // 10:00 before 16:00
  assert.equal(briefing.todayTimedTasks[1].task.id, '3');

  assert.equal(briefing.todayUntimedTasks.length, 2);
  assert.equal(briefing.todayUntimedTasks[0].id, '4'); // priority 5 before 1
  assert.equal(briefing.todayUntimedTasks[1].id, '5');

  assert.equal(briefing.yesterdayCompletedCount, 1);
  assert.equal(briefing.totalTodayTasksCount, 4);
  assert.ok(briefing.motivationalQuote.length > 0);
});

test('formatMorningBriefingMarkdown produces elegant markdown with checkboxes and badges', () => {
  const briefing = {
    today: '2026-11-03',
    overdueTasks: [{ title: 'پاسخ به تیکت', priority: 5, dueDate: '2026-11-01' }],
    todayTimedTasks: [{ task: { title: 'جلسه برنامه‌ریزی' }, timeLabel: '10:00 - 11:00', startMinutes: 600 }],
    todayUntimedTasks: [{ title: 'مستندسازی فیچر', priority: 3 }],
    todayHabits: [{ name: 'مطالعه', goal: 20, unit: 'صفحه' }],
    yesterdayCompletedCount: 3,
    totalTodayTasksCount: 2,
    motivationalQuote: 'تمرکز عمیق یعنی هنر نه گفتن.'
  };

  const md = formatMorningBriefingMarkdown(briefing, { jalaliDateStr: '۱۳ آبان ۱۴۰۵' });

  assert.ok(md.includes('## 🌅 پیشخوان مرور صبحگاهی (۱۳ آبان ۱۴۰۵)'));
  assert.ok(md.includes('تمرکز عمیق یعنی هنر نه گفتن.'));
  assert.ok(md.includes('### 🚨 تسک‌های معوقه نیازمند رسیدگی (1 مورد)'));
  assert.ok(md.includes('- [ ] پاسخ به تیکت 🚩 بالا *(سررسید: 2026-11-01)*'));
  assert.ok(md.includes('### ⏰ زمان‌بندی امروز'));
  assert.ok(md.includes('- [ ] **10:00 - 11:00**: جلسه برنامه‌ریزی'));
  assert.ok(md.includes('### 🎯 اولویت‌های امروز'));
  assert.ok(md.includes('- [ ] 🚩 متوسط: مستندسازی فیچر'));
  assert.ok(md.includes('### 🌿 عادت‌های امروز'));
  assert.ok(md.includes('- [ ] مطالعه (هدف: 20 صفحه)'));
});

test('injectBriefingIntoDailyNote handles prepending with and without frontmatter', () => {
  const briefingMd = '## 🌅 پیشخوان مرور صبحگاهی\n- [ ] تست ۱';

  // Note with frontmatter
  const noteWithFm = `---
date: 1405-08-13
tags: [daily]
---
# یادداشت‌های روز
یادداشت روزانه من.
`;

  const injectedFm = injectBriefingIntoDailyNote(noteWithFm, briefingMd);
  assert.ok(injectedFm.startsWith('---\ndate: 1405-08-13\ntags: [daily]\n---\n\n## 🌅 پیشخوان مرور صبحگاهی'));
  assert.ok(injectedFm.includes('# یادداشت‌های روز\nیادداشت روزانه من.'));

  // Updating existing heading
  const existingWithBriefing = injectedFm;
  const updatedBriefingMd = '## 🌅 پیشخوان مرور صبحگاهی\n- [ ] تست جدید به‌روزشده';
  const reinjected = injectBriefingIntoDailyNote(existingWithBriefing, updatedBriefingMd);

  assert.ok(reinjected.includes('تست جدید به‌روزشده'));
  assert.ok(!reinjected.includes('تست ۱'));
  assert.ok(reinjected.includes('# یادداشت‌های روز\nیادداشت روزانه من.'));
});
