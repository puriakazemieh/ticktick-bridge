/**
 * TickTick Bridge — Safe Bulk Operations Core Engine
 * Provides pure task mutation computation, bounded-concurrency execution,
 * operation manifests, and secret-free audit reports.
 */

import { toDateKey } from "./date.js";
import { shiftCalendarDay } from "./calendar-range.js";

export const ALLOWED_BULK_OPERATIONS = [
  "project",
  "tag-add",
  "tag-remove",
  "priority",
  "schedule-date",
  "shift-date",
  "clear-date",
  "complete",
  "reopen",
  "delete"
];

/**
 * Computes payload or delta for a single task given a bulk operation type and parameters.
 */
export function computeBulkTaskMutation(task, operationType, parameters = {}, timeZone = "Asia/Tehran") {
  if (!task) return null;
  const taskId = String(task.id);
  const projectId = String(task.projectId || "inbox");

  switch (operationType) {
    case "project": {
      const targetProjectId = String(parameters.projectId || "");
      if (!targetProjectId) throw new Error("شناسهٔ پروژهٔ مقصد مشخص نشده است.");
      return {
        id: taskId,
        projectId: targetProjectId,
        columnId: null // reset board column when moving projects
      };
    }

    case "tag-add": {
      const tag = String(parameters.tag || "").trim().replace(/^#/, "");
      if (!tag) throw new Error("نام برچسب برای افزودن مشخص نشده است.");
      const currentTags = Array.isArray(task.tags) ? task.tags : [];
      if (currentTags.includes(tag)) return null; // already has tag, noop
      return {
        id: taskId,
        projectId,
        tags: [...currentTags, tag]
      };
    }

    case "tag-remove": {
      const tag = String(parameters.tag || "").trim().replace(/^#/, "");
      if (!tag) throw new Error("نام برچسب برای حذف مشخص نشده است.");
      const currentTags = Array.isArray(task.tags) ? task.tags : [];
      if (!currentTags.includes(tag)) return null; // doesn't have tag, noop
      return {
        id: taskId,
        projectId,
        tags: currentTags.filter(t => t !== tag)
      };
    }

    case "priority": {
      const priority = Number(parameters.priority ?? 0);
      return {
        id: taskId,
        projectId,
        priority
      };
    }

    case "schedule-date": {
      const targetDay = String(parameters.targetDay || parameters.dueDate || "");
      if (!targetDay) throw new Error("تاریخ مقصد مشخص نشده است.");
      const tzOffset = "+0330";
      const isTimed = Boolean(parameters.time);
      const timePart = parameters.time ? (parameters.time.length === 5 ? `${parameters.time}:00` : parameters.time) : "00:00:00";
      const due = isTimed ? `${targetDay}T${timePart}${tzOffset}` : `${targetDay}T00:00:00${tzOffset}`;
      
      let start = null;
      if (parameters.startDate) {
        start = isTimed ? `${parameters.startDate}T${timePart}${tzOffset}` : `${parameters.startDate}T00:00:00${tzOffset}`;
      }

      return {
        id: taskId,
        projectId,
        dueDate: due,
        startDate: start,
        isAllDay: !isTimed,
        timeZone
      };
    }

    case "shift-date": {
      const deltaDays = Number(parameters.deltaDays ?? 0);
      if (!deltaDays) return null;
      const curDue = toDateKey(task.dueDate, task.timeZone || timeZone);
      const curStart = toDateKey(task.startDate, task.timeZone || timeZone);
      if (!curDue && !curStart) return null; // unscheduled, cannot shift

      const tzOffset = "+0330";
      const isTimed = !task.isAllDay && (String(task.startDate ?? task.dueDate ?? "").includes("T"));
      const dueTime = String(task.dueDate ?? "").match(/T(\d{2}:\d{2}:\d{2})/)?.[1] ?? "00:00:00";
      const startTime = String(task.startDate ?? "").match(/T(\d{2}:\d{2}:\d{2})/)?.[1] ?? "00:00:00";

      const nextDue = curDue ? (isTimed ? `${shiftCalendarDay(curDue, deltaDays)}T${dueTime}${tzOffset}` : `${shiftCalendarDay(curDue, deltaDays)}T00:00:00${tzOffset}`) : null;
      const nextStart = curStart ? (isTimed ? `${shiftCalendarDay(curStart, deltaDays)}T${startTime}${tzOffset}` : `${shiftCalendarDay(curStart, deltaDays)}T00:00:00${tzOffset}`) : null;

      return {
        id: taskId,
        projectId,
        dueDate: nextDue,
        startDate: nextStart,
        isAllDay: !isTimed,
        timeZone
      };
    }

    case "clear-date": {
      return {
        id: taskId,
        projectId,
        dueDate: null,
        startDate: null,
        isAllDay: true
      };
    }

    case "complete": {
      return {
        id: taskId,
        projectId,
        status: 2
      };
    }

    case "reopen": {
      return {
        id: taskId,
        projectId,
        status: 0
      };
    }

    case "delete": {
      return {
        id: taskId,
        projectId,
        isDelete: true
      };
    }

    default:
      throw new Error(`عملیات گروهی ناشناخته: ${operationType}`);
  }
}

/**
 * Creates an audit manifest for a bulk operation.
 * Guarantees no tokens, cookies, or secrets are included.
 */
export function createBulkOperationManifest(tasks = [], operationType, parameters = {}) {
  return {
    manifestId: `bulk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    operationType,
    parameters: sanitizeParameters(parameters),
    timestamp: new Date().toISOString(),
    totalCount: tasks.length,
    targets: tasks.map(t => ({
      id: String(t.id),
      title: String(t.title || "بدون عنوان"),
      projectId: String(t.projectId || ""),
      before: {
        projectId: t.projectId,
        priority: t.priority,
        status: t.status,
        dueDate: t.dueDate,
        startDate: t.startDate,
        tags: Array.isArray(t.tags) ? [...t.tags] : []
      }
    }))
  };
}

/**
 * Executes a worker async function across items with bounded concurrency.
 * Ensures an individual item failure never stops or crashes the entire batch.
 */
export async function runBoundedQueue(items, workerFn, concurrency = 3) {
  const results = [];
  const activeConcurrency = Math.max(1, concurrency);
  let index = 0;

  async function next() {
    while (index < items.length) {
      const currentIndex = index++;
      const item = items[currentIndex];
      try {
        const result = await workerFn(item, currentIndex);
        results[currentIndex] = {
          success: true,
          item,
          result
        };
      } catch (error) {
        results[currentIndex] = {
          success: false,
          item,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
  }

  const pool = Array.from(
    { length: Math.min(items.length, activeConcurrency) },
    () => next()
  );

  await Promise.all(pool);
  return results;
}

/**
 * Formats secret-free final report for .ticktick/reports/.
 */
export function formatBulkOutcomeReport(manifest, queueResults = []) {
  const succeeded = queueResults.filter(r => r.success).length;
  const failed = queueResults.filter(r => !r.success).length;

  return {
    manifestId: manifest.manifestId,
    operationType: manifest.operationType,
    parameters: manifest.parameters,
    startedAt: manifest.timestamp,
    completedAt: new Date().toISOString(),
    total: manifest.totalCount,
    succeeded,
    failed,
    items: queueResults.map(r => ({
      id: r.item.id,
      title: r.item.title,
      success: r.success,
      before: r.item.before,
      after: r.result ?? null,
      error: r.error ?? null
    }))
  };
}

function sanitizeParameters(params) {
  const safe = {};
  for (const [key, val] of Object.entries(params)) {
    if (["token", "cookie", "password", "secret", "auth"].some(s => key.toLowerCase().includes(s))) {
      continue;
    }
    safe[key] = val;
  }
  return safe;
}
