const textFields = ["desc", "content", "description", "note", "text", "body"];

export function taskDescription(task) {
  for (const field of textFields) {
    const value = task?.[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

/** Some project-task reads omit Note content or return it as an empty string.
 * Keep the richer cached record instead of treating that omission as a delete. */
export function mergeTaskDetails(cached = {}, fresh = {}) {
  if (!cached || typeof cached !== "object") return { ...fresh };
  if (!fresh || typeof fresh !== "object") return { ...cached };
  const merged = { ...cached, ...fresh };
  // Structural properties from TickTick must reflect the fresh state.
  // TickTick omits parentId, columnId, etc. when not applicable; do not retain stale cached values.
  if (!fresh.parentId && cached.parentId) {
    delete merged.parentId;
  }
  if (!fresh.columnId && cached.columnId) {
    delete merged.columnId;
  }
  if (!fresh.childIds && cached.childIds) {
    delete merged.childIds;
  }
  if (Number(fresh.status ?? 0) === 0 && cached.completedTime && !fresh.completedTime) {
    delete merged.completedTime;
  }
  if (taskDescription(fresh) || !taskDescription(cached)) return merged;
  for (const field of textFields) {
    if ((!merged[field] || typeof merged[field] !== "string") && typeof cached[field] === "string" && cached[field].trim()) merged[field] = cached[field];
  }
  return merged;
}

/** A check/0 response is a full task snapshot. Only its open tasks may remain
 * visible; cached project documents supply details, never membership. */
/** @param {any[]} cached
 * @param {any[] | null} fresh */
export function reconcileOpenTasks(cached = [], fresh = null) {
  if (fresh === null) return cached.filter(task => Number(task?.status ?? 0) === 0);
  const details = new Map(cached.filter(task => task?.id).map(task => [String(task.id), task]));
  return fresh
    .filter(task => task?.id && Number(task.status ?? 0) === 0)
    .map(task => mergeTaskDetails(details.get(String(task.id)), task));
}
