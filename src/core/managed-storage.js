const ROOT = ".ticktick";

function utcDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("A valid capture time is required.");
  return date;
}

function dateKey(value) { return utcDate(value).toISOString().slice(0, 10); }
function safeTimestamp(value) { return utcDate(value).toISOString().replace(/[:.]/g, "-"); }
function safeSegment(value, fallback) {
  const result = String(value ?? fallback).trim().replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return result || fallback;
}

export function managedRoot() { return ROOT; }
export function backupPath(capturedAt, purpose) {
  return `${ROOT}/backups/${dateKey(capturedAt)}/${safeTimestamp(capturedAt)}-${safeSegment(purpose, "snapshot")}.json`;
}
export function reportPath(capturedAt, operation) {
  return `${ROOT}/reports/${safeTimestamp(capturedAt)}-${safeSegment(operation, "operation")}.json`;
}
export function journalPath(operationId) { return `${ROOT}/journal/${safeSegment(operationId, "operation")}.json`; }
export function privateCachePath() { return `${ROOT}/cache/full-cache.json`; }

export function publicManagedMetadata(value) {
  if (Array.isArray(value)) return value.map(publicManagedMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).flatMap(([key, nested]) => /token|cookie|authorization|password|secret|headers?|content|desc|body|raw/i.test(key) ? [] : [[key, publicManagedMetadata(nested)]]));
}

export function parseManagedBackupPath(path) {
  const match = /^\.ticktick\/backups\/(\d{4}-\d{2}-\d{2})\/[^/]+\.json$/.exec(String(path));
  if (!match || Number.isNaN(new Date(`${match[1]}T00:00:00.000Z`).getTime())) return null;
  return { path: String(path), date: match[1] };
}

export function selectExpiredBackups(entries, now, keepCalendarDays = 10) {
  const keep = Math.max(1, Math.floor(keepCalendarDays));
  const current = utcDate(now);
  const retained = new Set(Array.from({ length: keep }, (_, index) => {
    const day = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() - index));
    return day.toISOString().slice(0, 10);
  }));
  return entries.filter(entry => {
    const parsed = parseManagedBackupPath(typeof entry === "string" ? entry : entry?.path);
    return parsed && !retained.has(parsed.date);
  });
}
