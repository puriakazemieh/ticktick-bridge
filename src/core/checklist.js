export const CHECKLIST_CAPABILITY = Object.freeze({
  UNAVAILABLE: "unavailable",
  READ_ONLY: "read-only",
  ENABLED_UNVERIFIED: "enabled-unverified",
  VERIFIED: "verified"
});

export function normalizeChecklist(items) {
  return (Array.isArray(items) ? items : []).map((item, index) => ({
    id: item?.id ? String(item.id) : null,
    title: String(item?.title ?? item?.content ?? "").trim(),
    completed: item?.completed !== undefined ? Boolean(item.completed) : Number(item?.status ?? 0) !== 0,
    sortOrder: Number(item?.sortOrder ?? index),
    unknown: Object.fromEntries(
      Object.entries(item ?? {}).filter(
        ([key]) => !["id", "title", "content", "status", "sortOrder", "completed", "completedTime", "startDate", "dueDate", "isAllDay", "timeZone"].includes(key)
      )
    )
  })).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function checklistSummary(items) {
  const normalized = normalizeChecklist(items);
  return {
    total: normalized.length,
    completed: normalized.filter(item => item.completed).length
  };
}

export function isChecklistMutationPermitted(capability = CHECKLIST_CAPABILITY.READ_ONLY, operation = "any") {
  // Write operations are blocked pending API characterization against disposable corpus.
  if (capability !== CHECKLIST_CAPABILITY.VERIFIED) {
    return false;
  }
  return Boolean(operation);
}

export function diffChecklist(baseline = [], current = []) {
  const baseItems = normalizeChecklist(baseline);
  const curItems = normalizeChecklist(current);

  const baseById = new Map();
  const baseWithoutId = [];
  for (const item of baseItems) {
    if (item.id) baseById.set(item.id, item);
    else baseWithoutId.push(item);
  }

  const added = [];
  const modified = [];
  const unchanged = [];
  const matchedBaseIds = new Set();

  for (const cur of curItems) {
    if (cur.id && baseById.has(cur.id)) {
      matchedBaseIds.add(cur.id);
      const base = baseById.get(cur.id);
      const isDiff = base.title !== cur.title || base.completed !== cur.completed || base.sortOrder !== cur.sortOrder;
      if (isDiff) {
        modified.push({ before: base, after: cur });
      } else {
        unchanged.push(cur);
      }
    } else if (!cur.id) {
      const matchIndex = baseWithoutId.findIndex(b => b.title === cur.title && b.completed === cur.completed);
      if (matchIndex >= 0) {
        unchanged.push(cur);
        baseWithoutId.splice(matchIndex, 1);
      } else {
        added.push(cur);
      }
    } else {
      added.push(cur);
    }
  }

  const removed = [
    ...baseItems.filter(b => b.id && !matchedBaseIds.has(b.id)),
    ...baseWithoutId
  ];

  return {
    added,
    removed,
    modified,
    unchanged,
    hasChanges: added.length > 0 || removed.length > 0 || modified.length > 0
  };
}
