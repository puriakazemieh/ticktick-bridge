/**
 * @file query-engine.test.js
 * Unit tests for pure query engine.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseQueryBlockSpec,
  matchesPriority,
  matchesDue,
  executeTaskQuery
} from '../src/core/query-engine.js';

test('parseQueryBlockSpec parses yaml-like input into structured spec', () => {
  const yaml = `
    title: "تسک‌های مهم امروز"
    project: "پروژه وب"
    tags: [کاری, فوری]
    priority: >= 3
    status: uncompleted
    due: today
    search: "طراحی"
    sort: priority desc, dueDate asc
    limit: 15
    view: cards
  `;

  const spec = parseQueryBlockSpec(yaml);

  assert.equal(spec.title, 'تسک‌های مهم امروز');
  assert.equal(spec.project, 'پروژه وب');
  assert.deepEqual(spec.tags, ['کاری', 'فوری']);
  assert.equal(spec.priority, '>= 3');
  assert.equal(spec.status, 'uncompleted');
  assert.equal(spec.due, 'today');
  assert.equal(spec.search, 'طراحی');
  assert.deepEqual(spec.sort, [
    { field: 'priority', order: 'desc' },
    { field: 'dueDate', order: 'asc' }
  ]);
  assert.equal(spec.limit, 15);
  assert.equal(spec.view, 'cards');
});

test('parseQueryBlockSpec applies sane defaults for empty or minimal input', () => {
  const spec = parseQueryBlockSpec('');
  assert.equal(spec.status, 'uncompleted');
  assert.equal(spec.due, 'any');
  assert.equal(spec.limit, 50);
  assert.equal(spec.view, 'list');
  assert.deepEqual(spec.tags, []);
});

test('matchesPriority evaluates keywords and numerical comparisons', () => {
  assert.equal(matchesPriority(5, 'high'), true);
  assert.equal(matchesPriority(3, 'high'), false);
  assert.equal(matchesPriority(3, 'med'), true);
  assert.equal(matchesPriority(1, 'low'), true);
  assert.equal(matchesPriority(0, 'none'), true);

  assert.equal(matchesPriority(5, '>=3'), true);
  assert.equal(matchesPriority(3, '>=3'), true);
  assert.equal(matchesPriority(1, '>=3'), false);
  assert.equal(matchesPriority(5, '>3'), true);
  assert.equal(matchesPriority(3, '>3'), false);

  assert.equal(matchesPriority(1, '<=1'), true);
  assert.equal(matchesPriority(0, '<=1'), true);
  assert.equal(matchesPriority(3, '<=1'), false);
});

test('matchesDue checks date ranges relative to today', () => {
  const today = '2026-11-03';

  // Today
  assert.equal(matchesDue({ dueDate: '2026-11-03T10:00:00Z' }, 'today', today), true);
  assert.equal(matchesDue({ dueDate: '2026-11-04T10:00:00Z' }, 'today', today), false);

  // Overdue
  assert.equal(matchesDue({ dueDate: '2026-11-01T10:00:00Z' }, 'overdue', today), true);
  assert.equal(matchesDue({ dueDate: '2026-11-03T10:00:00Z' }, 'overdue', today), false);

  // Tomorrow
  assert.equal(matchesDue({ dueDate: '2026-11-04T10:00:00Z' }, 'tomorrow', today), true);
  assert.equal(matchesDue({ dueDate: '2026-11-03T10:00:00Z' }, 'tomorrow', today), false);

  // This week
  assert.equal(matchesDue({ dueDate: '2026-11-05T10:00:00Z' }, 'this-week', today), true);
  assert.equal(matchesDue({ dueDate: '2026-11-20T10:00:00Z' }, 'this-week', today), false);

  // Unscheduled
  assert.equal(matchesDue({ dueDate: null }, 'unscheduled', today), true);
  assert.equal(matchesDue({ dueDate: '2026-11-03T10:00:00Z' }, 'unscheduled', today), false);
});

test('executeTaskQuery filters, sorts, limits, and resolves projects correctly', () => {
  const tasks = [
    { id: '1', title: 'تسک اول پروژه وب', projectId: 'p1', priority: 5, status: 0, dueDate: '2026-11-03T09:00:00Z', tags: ['کاری'] },
    { id: '2', title: 'تسک دوم فوری', projectId: 'p1', priority: 3, status: 0, dueDate: '2026-11-03T14:00:00Z', tags: ['کاری', 'فوری'] },
    { id: '3', title: 'تسک انجام شده', projectId: 'p1', priority: 5, status: 2, dueDate: '2026-11-03T08:00:00Z', tags: ['کاری'] },
    { id: '4', title: 'تسک پروژه دیگر', projectId: 'p2', priority: 5, status: 0, dueDate: '2026-11-03T11:00:00Z', tags: ['کاری'] },
    { id: '5', title: 'تسک فردا', projectId: 'p1', priority: 5, status: 0, dueDate: '2026-11-04T09:00:00Z', tags: ['کاری'] }
  ];

  const projectsMap = {
    p1: 'پروژه وب',
    p2: 'پروژه شخصی'
  };

  const spec = parseQueryBlockSpec(`
    project: "پروژه وب"
    priority: >= 3
    status: uncompleted
    due: today
    sort: priority desc, dueDate asc
    limit: 10
  `);

  const result = executeTaskQuery(tasks, spec, {
    today: '2026-11-03',
    projectsMap
  });

  assert.equal(result.totalCount, 2);
  assert.equal(result.matchedTasks.length, 2);
  // task 1 has priority 5, task 2 has priority 3 -> sorted by priority desc
  assert.equal(result.matchedTasks[0].id, '1');
  assert.equal(result.matchedTasks[1].id, '2');
});

test('executeTaskQuery respects tags and search text', () => {
  const tasks = [
    { id: '1', title: 'بررسی باگ لاگین', status: 0, tags: ['bug', 'auth'] },
    { id: '2', title: 'تست عملکرد سرور', status: 0, tags: ['perf'] },
    { id: '3', title: 'باگ گزارش هفتگی', status: 0, tags: ['bug'] }
  ];

  const spec = parseQueryBlockSpec(`
    tags: [bug]
    search: "لاگین"
  `);

  const result = executeTaskQuery(tasks, spec);
  assert.equal(result.totalCount, 1);
  assert.equal(result.matchedTasks[0].id, '1');
});
