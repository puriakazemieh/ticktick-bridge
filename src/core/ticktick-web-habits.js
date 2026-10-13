/** Parses the private TickTick web API shape without exposing session data. */
export function parseWebHabitCheckins(payload) {
  const output = new Map();
  const collections = payload && typeof payload === "object" ? payload.checkins : null;
  if (!collections || typeof collections !== "object") return output;
  for (const [habitId, entries] of Object.entries(collections)) {
    output.set(habitId, Array.isArray(entries) ? entries.map(entry => ({
      stamp: Number(entry?.checkinStamp ?? entry?.stamp),
      value: Number(entry?.value ?? 0),
      goal: Number(entry?.goal ?? 1),
      status: Number(entry?.status ?? 0),
    })).filter(entry => Number.isFinite(entry.stamp)) : []);
  }
  return output;
}

export function normalizeWebSessionCookie(value) {
  return String(value ?? "").replace(/^\s*cookie\s*:\s*/i, "").trim();
}
