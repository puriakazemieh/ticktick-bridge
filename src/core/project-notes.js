export function parseProjectNote(markdown, path) {
  const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) return null;
  const value = (key) => frontmatter[1].match(new RegExp(`^${key}:\\s*[\"']?([^\\r\\n\"']+)[\"']?\\s*$`, "mi"))?.[1]?.trim() ?? "";
  const title = value("title");
  const type = value("type");
  const status = value("status").toLowerCase();
  if (!title || type !== "task") return null;
  return { path, title, status: status || "todo", eligible: !["done", "completed", "cancelled", "archived"].includes(status) };
}

export function summarizeProjectNotes(notes) {
  const summary = { total: notes.length, eligible: 0, byArea: {} };
  for (const note of notes) {
    const area = note.path.split(/[\\/]/).slice(-3, -2)[0] ?? "unknown";
    const entry = summary.byArea[area] ??= { total: 0, eligible: 0 };
    entry.total++;
    if (note.eligible) { summary.eligible++; entry.eligible++; }
  }
  return summary;
}
