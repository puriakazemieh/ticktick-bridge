/**
 * @file editor-suggest-matcher.js
 * Pure in-memory matcher and token extractor for EditorSuggest task autocomplete.
 */

import { normalizeSearchText } from './task-filter.js';

export const SUGGEST_TRIGGERS = ['[[tt:', '@task:', '#tt:'];

/**
 * Extracts trigger query and character bounds from a line of text at cursor position.
 * @param {string} lineText
 * @param {number} cursorCh 0-indexed column
 * @returns {{ query: string, startCh: number, endCh: number, trigger: string } | null}
 */
export function extractSuggestQuery(lineText, cursorCh) {
  if (typeof lineText !== 'string' || cursorCh < 0) return null;

  const textBeforeCursor = lineText.slice(0, cursorCh);

  for (const trigger of SUGGEST_TRIGGERS) {
    const lastIndex = textBeforeCursor.lastIndexOf(trigger);
    if (lastIndex !== -1) {
      // Must not have a closing bracket or newline between trigger and cursor
      const candidate = textBeforeCursor.slice(lastIndex + trigger.length);
      if (!candidate.includes(']]') && !candidate.includes('\n')) {
        return {
          query: candidate.trim(),
          startCh: lastIndex,
          endCh: cursorCh,
          trigger
        };
      }
    }
  }

  return null;
}

/**
 * Searches and ranks tasks matching the suggest query.
 * @param {Array<Object>} tasks
 * @param {string} rawQuery
 * @param {Object} [options]
 * @param {number} [options.limit=10]
 * @param {Record<string, string>} [options.projectsMap={}]
 * @returns {Array<Object>}
 */
export function searchTasksForSuggest(tasks, rawQuery, options = {}) {
  const limit = options.limit || 10;
  const projectsMap = options.projectsMap || {};

  if (!Array.isArray(tasks)) return [];

  const query = (rawQuery || '').trim();
  const normQuery = normalizeSearchText(query);

  if (!normQuery) {
    // Return top priority uncompleted tasks if query is empty
    return tasks
      .filter(t => t.status === 0)
      .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0))
      .slice(0, limit);
  }

  const scored = [];

  for (const task of tasks) {
    // Exclude completed tasks unless explicitly asked
    if (task.status !== 0) continue;

    const normTitle = normalizeSearchText(task.title || '');
    const projName = projectsMap[task.projectId] || '';
    const normProj = normalizeSearchText(projName);
    const tagsStr = Array.isArray(task.tags) ? task.tags.join(' ') : '';
    const normTags = normalizeSearchText(tagsStr);

    let score = 0;

    if (normTitle.startsWith(normQuery)) {
      score += 100;
    } else if (normTitle.includes(normQuery)) {
      score += 50;
    }

    if (normTags.includes(normQuery)) {
      score += 30;
    }

    if (normProj.includes(normQuery)) {
      score += 20;
    }

    if (score > 0) {
      // Add priority weight
      score += (Number(task.priority) || 0) * 2;
      scored.push({ task, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(item => item.task);
}

/**
 * Formats a selected task into a Markdown link.
 * @param {Object} task
 * @param {Object} [options]
 * @param {string} [options.protocol='obsidian'] 'obsidian' | 'ticktick'
 * @returns {string}
 */
export function formatTaskMarkdownLink(task, options = {}) {
  const title = (task.title || 'بدون عنوان').replace(/[\[\]]/g, '');
  const id = String(task.id || '');

  if (options.protocol === 'ticktick') {
    return `[🎯 ${title}](ticktick://task/${id})`;
  }

  return `[🎯 ${title}](obsidian://ticktick-bridge?taskId=${id})`;
}
