/**
 * @file canvas-exporter.js
 * Pure in-memory generator for Obsidian Canvas (.canvas) files from TickTick tasks.
 */

import { partitionEisenhowerMatrix } from './eisenhower-matrix.js';

/**
 * Maps task priority to Obsidian Canvas preset colors:
 * "1": Red (High priority)
 * "2": Orange (Medium priority)
 * "5": Cyan/Blue (Low priority)
 * "4": Green (Normal / Completed)
 * @param {number} priority
 * @returns {string}
 */
export function getPriorityCanvasColor(priority) {
  const p = Number(priority) || 0;
  if (p === 5) return '1';
  if (p === 3) return '2';
  if (p === 1) return '5';
  return '4';
}

/**
 * Formats task card text in markdown for the canvas node.
 * @param {Object} task
 * @param {Record<string, string>} projectsMap
 * @returns {string}
 */
export function formatTaskCanvasText(task, projectsMap = {}) {
  const lines = [];
  const isDone = Number(task.status ?? 0) !== 0;
  const statusMark = isDone ? '~~[x]' : '[ ]';
  const closeMark = isDone ? '~~' : '';
  const title = (task.title || 'بدون عنوان').replace(/[\[\]]/g, '');

  lines.push(`### ${statusMark} ${title}${closeMark}`);

  const meta = [];
  if (task.priority === 5) meta.push('🚩 بالا');
  else if (task.priority === 3) meta.push('🚩 متوسط');
  else if (task.priority === 1) meta.push('🚩 پایین');

  if (task.dueDate) {
    meta.push(`📅 ${task.dueDate.slice(0, 10)}`);
  }

  if (task.projectId && projectsMap[task.projectId]) {
    meta.push(`📁 ${projectsMap[task.projectId]}`);
  }

  if (Array.isArray(task.tags) && task.tags.length > 0) {
    meta.push(task.tags.map(t => `#${t}`).join(' '));
  }

  if (meta.length > 0) {
    lines.push(`> ${meta.join(' • ')}`);
  }

  if (task.content && task.content.trim()) {
    lines.push('');
    lines.push(task.content.trim().slice(0, 140));
  }

  return lines.join('\n');
}

/**
 * Generates an Obsidian Canvas JSON object from tasks.
 * @param {Array<Object>} tasks
 * @param {Object} [options]
 * @param {'projects'|'eisenhower'|'status'} [options.groupBy='projects']
 * @param {Record<string, string>} [options.projectsMap={}]
 * @param {string} [options.today]
 * @returns {Object} JSON matching Obsidian .canvas specification
 */
export function generateCanvasFromTasks(tasks, options = {}) {
  const groupBy = options.groupBy || 'projects';
  const projectsMap = options.projectsMap || {};
  const today = options.today || new Date().toISOString().slice(0, 10);

  const nodes = [];
  const edges = [];

  const COLUMN_WIDTH = 340;
  const COLUMN_GAP = 80;
  const CARD_WIDTH = 300;
  const CARD_HEIGHT = 150;
  const CARD_GAP = 20;
  const TOP_PADDING = 70;
  const SIDE_PADDING = 20;

  /** @type {Map<string, { label: string, color: string, tasks: Array<Object> }>} */
  const groups = new Map();

  if (groupBy === 'eisenhower') {
    const partitioned = partitionEisenhowerMatrix(tasks, { today });
    groups.set('Q1', { label: '🔥 Q1: فوری و مهم (Do First)', color: '1', tasks: partitioned.q1 || [] });
    groups.set('Q2', { label: '🎯 Q2: مهم، غیرفوری (Schedule)', color: '2', tasks: partitioned.q2 || [] });
    groups.set('Q3', { label: '⚡ Q3: فوری، غیرمهم (Delegate)', color: '5', tasks: partitioned.q3 || [] });
    groups.set('Q4', { label: '📦 Q4: غیراولویت / بک‌لاگ (Backlog)', color: '4', tasks: partitioned.q4 || [] });
  } else if (groupBy === 'status') {
    const uncompleted = tasks.filter(t => t.status === 0);
    const completed = tasks.filter(t => t.status !== 0);
    groups.set('todo', { label: '⏳ در انتظار انجام (To Do)', color: '2', tasks: uncompleted });
    groups.set('done', { label: '✅ تکمیل‌شده (Completed)', color: '4', tasks: completed });
  } else {
    // Default: Group by Project
    const projGroups = new Map();
    const inboxTasks = [];

    for (const t of tasks) {
      if (t.projectId && projectsMap[t.projectId]) {
        if (!projGroups.has(t.projectId)) {
          projGroups.set(t.projectId, []);
        }
        projGroups.get(t.projectId).push(t);
      } else {
        inboxTasks.push(t);
      }
    }

    if (inboxTasks.length > 0) {
      groups.set('inbox', { label: '📥 اینباکس (Inbox)', color: '5', tasks: inboxTasks });
    }

    for (const [projId, pTasks] of projGroups) {
      const projName = projectsMap[projId] || 'پروژه';
      groups.set(projId, { label: `📁 ${projName}`, color: '6', tasks: pTasks });
    }
  }

  // Layout columns and cards
  let currentX = 0;
  const taskNodeMap = new Map();

  for (const [groupId, group] of groups) {
    const taskCount = group.tasks.length;
    const groupHeight = Math.max(300, TOP_PADDING + taskCount * (CARD_HEIGHT + CARD_GAP) + 20);

    // Group Node
    const groupNodeId = `group-${groupId}`;
    nodes.push({
      id: groupNodeId,
      x: currentX,
      y: 0,
      width: COLUMN_WIDTH,
      height: groupHeight,
      type: 'group',
      label: group.label,
      color: group.color
    });

    // Task Cards inside Group
    let currentY = TOP_PADDING;
    for (const task of group.tasks) {
      const cardNodeId = `task-${task.id}`;
      taskNodeMap.set(String(task.id), cardNodeId);

      nodes.push({
        id: cardNodeId,
        x: currentX + SIDE_PADDING,
        y: currentY,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        type: 'text',
        text: formatTaskCanvasText(task, projectsMap),
        color: getPriorityCanvasColor(task.priority)
      });

      currentY += CARD_HEIGHT + CARD_GAP;
    }

    currentX += COLUMN_WIDTH + COLUMN_GAP;
  }

  // Connect dependency / hierarchy edges
  let edgeCounter = 1;
  for (const task of tasks) {
    if (task.parentId && taskNodeMap.has(String(task.parentId)) && taskNodeMap.has(String(task.id))) {
      edges.push({
        id: `edge-${edgeCounter++}`,
        fromNode: taskNodeMap.get(String(task.parentId)),
        toNode: taskNodeMap.get(String(task.id)),
        fromSide: 'bottom',
        toSide: 'top',
        label: 'زیرتسک'
      });
    }
  }

  return {
    nodes,
    edges
  };
}
