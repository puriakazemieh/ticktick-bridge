/**
 * @file canvas-exporter.test.js
 * Unit tests for Obsidian Canvas (.canvas) JSON generation.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPriorityCanvasColor,
  formatTaskCanvasText,
  generateCanvasFromTasks
} from '../src/core/canvas-exporter.js';

test('getPriorityCanvasColor maps priority numbers to canvas color strings', () => {
  assert.equal(getPriorityCanvasColor(5), '1'); // Red
  assert.equal(getPriorityCanvasColor(3), '2'); // Orange
  assert.equal(getPriorityCanvasColor(1), '5'); // Cyan
  assert.equal(getPriorityCanvasColor(0), '4'); // Green
});

test('formatTaskCanvasText creates markdown card with status, metadata chips and content', () => {
  const task = {
    id: 't1',
    title: 'توسعه ماژول گزارش',
    priority: 5,
    dueDate: '2026-11-04T12:00:00Z',
    projectId: 'p1',
    tags: ['گزارش', 'بک‌اند'],
    content: 'توضیحات تکمیلی تسک'
  };

  const md = formatTaskCanvasText(task, { p1: 'پروژه مالی' });
  assert.ok(md.includes('### [ ] توسعه ماژول گزارش'));
  assert.ok(md.includes('🚩 بالا'));
  assert.ok(md.includes('📅 2026-11-04'));
  assert.ok(md.includes('📁 پروژه مالی'));
  assert.ok(md.includes('#گزارش #بک‌اند'));
  assert.ok(md.includes('توضیحات تکمیلی تسک'));
});

test('generateCanvasFromTasks organizes nodes into Eisenhower quadrant groups', () => {
  const tasks = [
    { id: '1', title: 'فوری و مهم', priority: 5, dueDate: '2026-11-03T10:00:00Z', status: 0 },
    { id: '2', title: 'مهم بدون سررسید', priority: 5, status: 0 },
    { id: '3', title: 'فوری کم‌اهمیت', priority: 1, dueDate: '2026-11-03T10:00:00Z', status: 0 },
    { id: '4', title: 'بک‌لاگ', priority: 0, status: 0 }
  ];

  const canvas = generateCanvasFromTasks(tasks, {
    groupBy: 'eisenhower',
    today: '2026-11-03'
  });

  assert.ok(Array.isArray(canvas.nodes));
  assert.ok(Array.isArray(canvas.edges));

  const groups = canvas.nodes.filter(n => n.type === 'group');
  assert.equal(groups.length, 4);

  // Group IDs: group-Q1, group-Q2, group-Q3, group-Q4
  assert.ok(groups.some(g => g.id === 'group-Q1'));
  assert.ok(groups.some(g => g.id === 'group-Q2'));
  assert.ok(groups.some(g => g.id === 'group-Q3'));
  assert.ok(groups.some(g => g.id === 'group-Q4'));

  // Task cards
  const taskCards = canvas.nodes.filter(n => n.type === 'text');
  assert.equal(taskCards.length, 4);

  // Columns should not overlap (X coordinates increase)
  const xPositions = groups.map(g => g.x);
  assert.ok(xPositions[0] < xPositions[1]);
  assert.ok(xPositions[1] < xPositions[2]);
  assert.ok(xPositions[2] < xPositions[3]);
});

test('generateCanvasFromTasks connects parent and subtask edges', () => {
  const tasks = [
    { id: 'parent-1', title: 'تسک والد', priority: 3, status: 0 },
    { id: 'child-1', parentId: 'parent-1', title: 'زیرتسک اول', priority: 1, status: 0 }
  ];

  const canvas = generateCanvasFromTasks(tasks, { groupBy: 'projects' });
  assert.equal(canvas.edges.length, 1);
  assert.equal(canvas.edges[0].fromNode, 'task-parent-1');
  assert.equal(canvas.edges[0].toNode, 'task-child-1');
  assert.equal(canvas.edges[0].label, 'زیرتسک');
});
