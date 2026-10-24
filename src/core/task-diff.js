const fields = ["title", "completed", "projectId", "priority", "tags", "startDate", "dueDate", "isAllDay", "repeatFlag", "description"];
function valueFor(task, field) {
  if (field === "completed") return task?.status !== undefined ? Number(task.status) !== 0 : Boolean(task?.completed);
  if (field === "description") return String(task?.description ?? task?.desc ?? "");
  if (field === "tags") return [...(task?.tags ?? [])].map(String).sort();
  return task?.[field] ?? null;
}
function same(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
export function normalizedTask(task = {}) { return Object.fromEntries(fields.map(field => [field, valueFor(task, field)])); }
export function diffTask(base, local, remote) {
  if (!remote) return { localOnly: [], remoteOnly: [], equal: [], conflicts: [], quarantine: "remote-missing", merged: normalizedTask(local) };
  const result = { localOnly: [], remoteOnly: [], equal: [], conflicts: [], quarantine: null, merged: {} };
  for (const field of fields) {
    const original = valueFor(base, field); const localValue = valueFor(local, field); const remoteValue = valueFor(remote, field);
    const localChanged = !same(original, localValue); const remoteChanged = !same(original, remoteValue);
    if (localChanged && remoteChanged && !same(localValue, remoteValue)) result.conflicts.push({ field, base: original, local: localValue, remote: remoteValue });
    else if (localChanged && !remoteChanged) { result.localOnly.push(field); result.merged[field] = localValue; }
    else if (!localChanged && remoteChanged) { result.remoteOnly.push(field); result.merged[field] = remoteValue; }
    else { result.equal.push(field); result.merged[field] = localValue; }
  }
  if (Boolean(remote.repeatFlag) && result.remoteOnly.includes("completed")) result.recurringRemoteCompletion = true;
  return result;
}
