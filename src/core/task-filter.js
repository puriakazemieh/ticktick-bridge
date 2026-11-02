/**
 * TickTick Bridge — Unified Task Filter & Saved Views Core Engine
 * Provides pure filter intersection/union logic, Persian/Arabic full-text normalization,
 * and durable saved view serialization across Board, Weekly Planner, and Monthly Calendar.
 */

import { toDateKey } from "./date.js";

export const DEFAULT_TASK_FILTER = Object.freeze({
  projects: [],
  tags: [],
  statuses: [],
  priorities: [],
  dateRange: null,
  searchText: "",
  grouping: "none",
  sort: "ticktick"
});

/**
 * Normalizes Persian and Arabic text for consistent searching:
 * - Unifies Arabic Kaf (ك) to Persian Keh (ک)
 * - Unifies Arabic Yeh (ي, ى) to Persian Yeh (ی)
 * - Unifies Ta Marbuta (ة) to Heh (ه)
 * - Removes Arabic/Persian diacritics / tashkeel
 * - Replaces zero-width spaces / half-spaces with normal space
 */
export function normalizeSearchText(text) {
  if (typeof text !== "string") return "";
  return text
    .replace(/\u0643/g, "\u06A9")
    .replace(/[\u0649\u064A]/g, "\u06CC")
    .replace(/\u0629/g, "\u0647")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[\u200C\u200B]/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * Checks if target text fuzzy-matches the query string,
 * taking into account half-spaces and normalized Persian/Arabic characters.
 */
export function fuzzyMatchesText(query, target) {
  const normQuery = normalizeSearchText(query);
  if (!normQuery) return true;
  const normTarget = normalizeSearchText(target);
  if (!normTarget) return false;

  if (normTarget.includes(normQuery)) return true;

  const queryNoSpace = normQuery.replace(/\s+/g, "");
  const targetNoSpace = normTarget.replace(/\s+/g, "");
  return targetNoSpace.includes(queryNoSpace);
}

/**
 * Evaluates whether a task matches the filter specification:
 * - Projects: OR within selected projects
 * - Tags: OR within selected tags
 * - Statuses: OR within selected statuses
 * - Priorities: OR within selected priorities
 * - DateRange: inclusive start and end date
 * - SearchText: matches title, content/desc, or tags
 * - AND relationship between all active filter groups
 */
export function matchesTaskFilter(task, filter = {}, options = {}) {
  if (!task) return false;

  // 1. Projects (OR within group)
  if (Array.isArray(filter.projects) && filter.projects.length > 0) {
    const taskProjId = String(task.projectId ?? "");
    const taskProjName = String(task.projectName ?? "");
    const matchesProj = filter.projects.some(p => p === taskProjId || p === taskProjName);
    if (!matchesProj) return false;
  }

  // 2. Tags (OR within group)
  if (Array.isArray(filter.tags) && filter.tags.length > 0) {
    const taskTags = Array.isArray(task.tags) ? task.tags.map(String) : [];
    const matchesTag = filter.tags.some(t => taskTags.includes(t));
    if (!matchesTag) return false;
  }

  // 3. Statuses (OR within group)
  if (Array.isArray(filter.statuses) && filter.statuses.length > 0) {
    const taskStatus = Number(task.status ?? 0);
    if (!filter.statuses.includes(taskStatus)) return false;
  }

  // 4. Priorities (OR within group)
  if (Array.isArray(filter.priorities) && filter.priorities.length > 0) {
    const taskPriority = Number(task.priority ?? 0);
    if (!filter.priorities.includes(taskPriority)) return false;
  }

  // 5. Date Range (inclusive)
  if (filter.dateRange && (filter.dateRange.start || filter.dateRange.end)) {
    const timeZone = options.timeZone || "Asia/Tehran";
    const due = task.dueDate ? toDateKey(task.dueDate, timeZone) : null;
    const start = task.startDate ? toDateKey(task.startDate, timeZone) : null;
    const effectiveDate = due || start;

    if (!effectiveDate) {
      return false;
    }
    if (filter.dateRange.start && effectiveDate < filter.dateRange.start) {
      return false;
    }
    if (filter.dateRange.end && effectiveDate > filter.dateRange.end) {
      return false;
    }
  }

  // 6. Full-text search
  if (filter.searchText && String(filter.searchText).trim()) {
    const query = String(filter.searchText).trim();
    const title = String(task.title ?? "");
    const content = String(task.content ?? task.desc ?? "");
    const tags = Array.isArray(task.tags) ? task.tags.join(" ") : "";
    const combined = `${title} ${content} ${tags}`;
    if (!fuzzyMatchesText(query, combined)) {
      return false;
    }
  }

  return true;
}

export function sortTasks(tasks, sortMode = "ticktick") {
  const list = [...tasks];
  if (sortMode === "priority") {
    return list.sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0));
  }
  if (sortMode === "date") {
    return list.sort((a, b) => String(a.dueDate ?? "9999").localeCompare(String(b.dueDate ?? "9999")));
  }
  if (sortMode === "title") {
    return list.sort((a, b) => String(a.title ?? "").localeCompare(String(b.title ?? ""), "fa-IR"));
  }
  return list.sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0));
}

export function filterAndSortTasks(tasks, filter = {}, options = {}) {
  const matching = (Array.isArray(tasks) ? tasks : []).filter(task =>
    matchesTaskFilter(task, filter, options)
  );
  return sortTasks(matching, filter.sort || "ticktick");
}

export function createSavedView(name, filterState = {}, options = {}) {
  const cleanName = String(name ?? "").trim() || "نمای ذخیره‌شده";
  const id = options.id || `view_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  return {
    id,
    name: cleanName,
    scope: options.scope || "all",
    filter: {
      projects: Array.isArray(filterState.projects) ? [...filterState.projects] : [],
      tags: Array.isArray(filterState.tags) ? [...filterState.tags] : [],
      statuses: Array.isArray(filterState.statuses) ? [...filterState.statuses] : [],
      priorities: Array.isArray(filterState.priorities) ? [...filterState.priorities] : [],
      dateRange: filterState.dateRange ? { ...filterState.dateRange } : null,
      searchText: String(filterState.searchText ?? "").trim(),
      grouping: filterState.grouping || "none",
      sort: filterState.sort || "ticktick"
    },
    createdAt: options.createdAt || now,
    updatedAt: now
  };
}

export function updateSavedView(existing, updates = {}) {
  return {
    ...existing,
    name: updates.name ? String(updates.name).trim() : existing.name,
    scope: updates.scope || existing.scope,
    filter: updates.filter ? { ...existing.filter, ...updates.filter } : existing.filter,
    updatedAt: new Date().toISOString()
  };
}

export function duplicateSavedView(existing, newName) {
  const baseName = newName || `${existing.name} (کپی)`;
  return createSavedView(baseName, existing.filter, {
    scope: existing.scope
  });
}
