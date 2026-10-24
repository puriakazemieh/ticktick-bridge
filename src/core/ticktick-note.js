export function normalizeTickTickNote(record, project = {}) {
  if (!record || String(record.kind ?? "").toUpperCase() !== "NOTE") return null;
  const id = String(record.id ?? "").trim(); const title = String(record.title ?? "").trim();
  if (!id || !title) return null;
  return { id, title, projectId: String(record.projectId ?? project.id ?? ""), projectName: String(record.projectName ?? project.name ?? ""), kind: "NOTE", content: String(record.content ?? record.desc ?? ""), modifiedTime: record.modifiedTime ?? record.modifiedAt ?? null, tags: Array.isArray(record.tags) ? record.tags.map(String) : [] };
}
export function noteFileName(note) { return `${String(note.title).replace(/[\\/:*?"<>|]/g, "-").trim().slice(0, 80) || "TickTick Note"}-${note.id}.md`; }
export function noteMarkdown(note, importedAt = new Date().toISOString()) { return `---\nticktickNoteId: ${note.id}\nticktickProjectId: ${note.projectId}\nticktickKind: NOTE\nticktickImportedAt: ${importedAt}\n---\n\n<!-- ticktick-bridge:note:start -->\n${note.content}\n<!-- ticktick-bridge:note:end -->\n`; }
