/**
 * @file query-engine.js
 * Pure in-memory query engine for embedding dynamic TickTick task blocks inside Markdown.
 */

import { normalizeSearchText } from './task-filter.js';

/**
 * @typedef {Object} QueryBlockSpec
 * @property {string|null} [title]
 * @property {string|null} [project]
 * @property {string[]} [tags]
 * @property {string|null} [priority]
 * @property {'uncompleted'|'completed'|'all'} [status]
 * @property {'today'|'overdue'|'tomorrow'|'this-week'|'unscheduled'|'any'} [due]
 * @property {string|null} [search]
 * @property {Array<{ field: string, order: 'asc'|'desc' }>} [sort]
 * @property {number} [limit]
 * @property {'list'|'compact'|'cards'} [view]
 */

/**
 * Parses raw YAML/KV code block text into a structured QueryBlockSpec.
 * @param {string} rawText
 * @returns {QueryBlockSpec}
 */
export function parseQueryBlockSpec(rawText) {
  /** @type {QueryBlockSpec} */
  const spec = {
    title: null,
    project: null,
    tags: [],
    priority: null,
    status: 'uncompleted',
    due: 'any',
    search: null,
    sort: [{ field: 'dueDate', order: 'asc' }, { field: 'priority', order: 'desc' }],
    limit: 50,
    view: 'list'
  };

  if (!rawText || typeof rawText !== 'string') {
    return spec;
  }

  const lines = rawText.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim().toLowerCase();
    const val = line.slice(colonIdx + 1).trim();
    const cleanVal = val.replace(/^["']|["']$/g, '').trim();

    switch (key) {
      case 'title':
        spec.title = cleanVal;
        break;
      case 'project':
        spec.project = cleanVal;
        break;
      case 'tags':
      case 'tag': {
        if (cleanVal.startsWith('[') && cleanVal.endsWith(']')) {
          const inner = cleanVal.slice(1, -1);
          spec.tags = inner
            .split(',')
            .map(t => t.trim().replace(/^["']|["']$/g, '').replace(/^#/, ''))
            .filter(Boolean);
        } else {
          spec.tags = cleanVal
            .split(',')
            .map(t => t.trim().replace(/^["']|["']$/g, '').replace(/^#/, ''))
            .filter(Boolean);
        }
        break;
      }
      case 'priority':
        spec.priority = cleanVal.toLowerCase();
        break;
      case 'status': {
        const s = cleanVal.toLowerCase();
        if (s === 'completed' || s === 'done') spec.status = 'completed';
        else if (s === 'all') spec.status = 'all';
        else spec.status = 'uncompleted';
        break;
      }
      case 'due':
      case 'date': {
        const d = cleanVal.toLowerCase();
        if (['today', 'overdue', 'tomorrow', 'this-week', 'unscheduled', 'any'].includes(d)) {
          spec.due = /** @type {any} */ (d);
        }
        break;
      }
      case 'search':
      case 'query':
        spec.search = cleanVal;
        break;
      case 'sort': {
        // e.g. "priority desc, dueDate asc"
        const sortTokens = cleanVal.split(',');
        const parsedSorts = [];
        for (const token of sortTokens) {
          const parts = token.trim().split(/\s+/);
          if (parts[0]) {
            parsedSorts.push({
              field: parts[0],
              order: parts[1] && parts[1].toLowerCase() === 'desc' ? 'desc' : 'asc'
            });
          }
        }
        if (parsedSorts.length > 0) {
          spec.sort = parsedSorts;
        }
        break;
      }
      case 'limit': {
        const parsedNum = parseInt(cleanVal, 10);
        if (!isNaN(parsedNum) && parsedNum > 0) {
          spec.limit = parsedNum;
        }
        break;
      }
      case 'view':
      case 'layout': {
        const v = cleanVal.toLowerCase();
        if (v === 'compact' || v === 'cards' || v === 'list') {
          spec.view = v;
        }
        break;
      }
    }
  }

  return spec;
}

/**
 * Checks if a task priority matches the priority filter string.
 * Supports: "5", "3", "1", "0", "high", "medium", "low", "none", ">=3", ">0", "<=3".
 * @param {number} taskPriority
 * @param {string|null} filterStr
 * @returns {boolean}
 */
export function matchesPriority(taskPriority, filterStr) {
  if (!filterStr) return true;
  const p = Number(taskPriority) || 0;
  const f = filterStr.trim().toLowerCase();

  if (f === 'high') return p === 5;
  if (f === 'medium' || f === 'med') return p === 3;
  if (f === 'low') return p === 1;
  if (f === 'none') return p === 0;

  if (f.startsWith('>=')) {
    const num = parseInt(f.slice(2), 10);
    return !isNaN(num) && p >= num;
  }
  if (f.startsWith('>')) {
    const num = parseInt(f.slice(1), 10);
    return !isNaN(num) && p > num;
  }
  if (f.startsWith('<=')) {
    const num = parseInt(f.slice(2), 10);
    return !isNaN(num) && p <= num;
  }
  if (f.startsWith('<')) {
    const num = parseInt(f.slice(1), 10);
    return !isNaN(num) && p < num;
  }

  const exact = parseInt(f, 10);
  if (!isNaN(exact)) {
    return p === exact;
  }

  return true;
}

/**
 * Evaluates whether a task matches the due date filter.
 * @param {Object} task
 * @param {'today'|'overdue'|'tomorrow'|'this-week'|'unscheduled'|'any'} dueFilter
 * @param {string} today YYYY-MM-DD
 * @returns {boolean}
 */
export function matchesDue(task, dueFilter, today) {
  if (dueFilter === 'any') return true;

  const due = task.dueDate ? task.dueDate.slice(0, 10) : null;

  if (dueFilter === 'unscheduled') {
    return !due;
  }

  if (!due) return false;

  if (dueFilter === 'today') {
    return due === today;
  }

  if (dueFilter === 'overdue') {
    return due < today;
  }

  if (dueFilter === 'tomorrow') {
    const todayDate = new Date(`${today}T00:00:00Z`);
    const tmrDate = new Date(todayDate.getTime() + 86400000);
    const tmrStr = tmrDate.toISOString().slice(0, 10);
    return due === tmrStr;
  }

  if (dueFilter === 'this-week') {
    // Current 7-day window from today
    const todayDate = new Date(`${today}T00:00:00Z`);
    const weekEnd = new Date(todayDate.getTime() + 7 * 86400000);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    return due >= today && due <= weekEndStr;
  }

  return true;
}

/**
 * Executes a parsed query block spec against in-memory tasks.
 * @param {Array<Object>} tasks
 * @param {QueryBlockSpec} spec
 * @param {Object} [options]
 * @param {string} [options.today]
 * @param {string} [options.timeZone]
 * @param {Record<string, string>} [options.projectsMap] Map of projectId -> projectName
 * @returns {{ matchedTasks: Array<Object>, totalCount: number, spec: QueryBlockSpec }}
 */
export function executeTaskQuery(tasks, spec, options = {}) {
  const today = options.today || new Date().toISOString().slice(0, 10);
  const projectsMap = options.projectsMap || {};

  if (!Array.isArray(tasks)) {
    return { matchedTasks: [], totalCount: 0, spec };
  }

  const filtered = tasks.filter(task => {
    // 1. Status filter
    if (spec.status === 'uncompleted' && task.status !== 0) return false;
    if (spec.status === 'completed' && task.status === 0) return false;

    // 2. Project filter (by ID or Project Name)
    if (spec.project) {
      const targetProj = spec.project.toLowerCase();
      const projId = (task.projectId || '').toLowerCase();
      const projName = (projectsMap[task.projectId] || '').toLowerCase();
      if (projId !== targetProj && projName !== targetProj) {
        return false;
      }
    }

    // 3. Tags filter (AND condition: task must have all requested tags)
    if (spec.tags && spec.tags.length > 0) {
      const taskTags = Array.isArray(task.tags) ? task.tags.map(t => t.toLowerCase()) : [];
      const hasAll = spec.tags.every(st => taskTags.includes(st.toLowerCase()));
      if (!hasAll) return false;
    }

    // 4. Priority filter
    if (!matchesPriority(task.priority, spec.priority)) {
      return false;
    }

    // 5. Due date filter
    if (!matchesDue(task, spec.due, today)) {
      return false;
    }

    // 6. Search text filter
    if (spec.search) {
      const normSearch = normalizeSearchText(spec.search);
      const titleNorm = normalizeSearchText(task.title || '');
      const contentNorm = normalizeSearchText(task.content || '');
      if (!titleNorm.includes(normSearch) && !contentNorm.includes(normSearch)) {
        return false;
      }
    }

    return true;
  });

  // Sort tasks
  const sorted = [...filtered].sort((a, b) => {
    for (const s of spec.sort) {
      let valA = a[s.field];
      let valB = b[s.field];

      if (s.field === 'priority') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else if (s.field === 'dueDate') {
        valA = valA || '9999-99-99';
        valB = valB || '9999-99-99';
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return s.order === 'asc' ? -1 : 1;
      if (valA > valB) return s.order === 'asc' ? 1 : -1;
    }
    return 0;
  });

  const totalCount = sorted.length;
  const matchedTasks = sorted.slice(0, spec.limit);

  return {
    matchedTasks,
    totalCount,
    spec
  };
}
