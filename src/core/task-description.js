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
  const merged = { ...cached, ...fresh };
  if (taskDescription(fresh) || !taskDescription(cached)) return merged;
  for (const field of textFields) {
    if ((!merged[field] || typeof merged[field] !== "string") && typeof cached[field] === "string" && cached[field].trim()) merged[field] = cached[field];
  }
  return merged;
}
