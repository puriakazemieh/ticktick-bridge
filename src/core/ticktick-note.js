/**
 * TickTick Bridge — TickTick Notes Normalizer, File Serialization & Safety Boundaries
 * Ensures only explicitly identified NOTE records are imported into Obsidian,
 * protects user-authored content outside managed boundaries, and blocks unverified writeback.
 */

export function normalizeTickTickNote(record, project = {}) {
  if (!record || String(record.kind ?? "").toUpperCase() !== "NOTE") {
    return null;
  }
  const id = String(record.id ?? "").trim();
  const title = String(record.title ?? "").trim();
  if (!id || !title) {
    return null;
  }

  return {
    id,
    title,
    projectId: String(record.projectId ?? project.id ?? ""),
    projectName: String(record.projectName ?? project.name ?? ""),
    kind: "NOTE",
    content: String(record.content ?? record.desc ?? ""),
    modifiedTime: record.modifiedTime ?? record.modifiedAt ?? null,
    tags: Array.isArray(record.tags) ? record.tags.map(String) : []
  };
}

export function noteFileName(note) {
  const safeTitle = String(note.title ?? "")
    .replace(/[\\/:*?"<>|]/g, "-")
    .trim()
    .slice(0, 80) || "TickTick Note";
  return `${safeTitle}-${note.id}.md`;
}

export function noteMarkdown(note, importedAt = new Date().toISOString()) {
  return [
    "---",
    `ticktickNoteId: ${note.id}`,
    `ticktickProjectId: ${note.projectId}`,
    "ticktickKind: NOTE",
    `ticktickImportedAt: ${importedAt}`,
    "---",
    "",
    "<!-- ticktick-bridge:note:start -->",
    note.content,
    "<!-- ticktick-bridge:note:end -->",
    ""
  ].join("\n");
}

export function parseNoteFile(fileContent) {
  if (typeof fileContent !== "string") return null;

  const startMarker = "<!-- ticktick-bridge:note:start -->";
  const endMarker = "<!-- ticktick-bridge:note:end -->";

  const noteIdMatch = fileContent.match(/ticktickNoteId:\s*([^\r\n]+)/);
  const projectIdMatch = fileContent.match(/ticktickProjectId:\s*([^\r\n]+)/);
  const kindMatch = fileContent.match(/ticktickKind:\s*([^\r\n]+)/);
  const importedAtMatch = fileContent.match(/ticktickImportedAt:\s*([^\r\n]+)/);

  if (!noteIdMatch) return null;

  const startIndex = fileContent.indexOf(startMarker);
  const endIndex = fileContent.indexOf(endMarker);

  let managedContent = "";
  let userTrailingContent = "";

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    managedContent = fileContent.slice(startIndex + startMarker.length, endIndex).trim();
    userTrailingContent = fileContent.slice(endIndex + endMarker.length).trim();
  }

  return {
    id: noteIdMatch[1].trim(),
    projectId: projectIdMatch ? projectIdMatch[1].trim() : "",
    kind: kindMatch ? kindMatch[1].trim() : "NOTE",
    importedAt: importedAtMatch ? importedAtMatch[1].trim() : null,
    managedContent,
    userTrailingContent
  };
}

export function updateNoteMarkdown(existingMarkdown, newRemoteContent) {
  const startMarker = "<!-- ticktick-bridge:note:start -->";
  const endMarker = "<!-- ticktick-bridge:note:end -->";
  const startIndex = existingMarkdown.indexOf(startMarker);
  const endIndex = existingMarkdown.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error("Managed note boundary markers not found.");
  }

  const before = existingMarkdown.slice(0, startIndex + startMarker.length);
  const after = existingMarkdown.slice(endIndex);
  return `${before}\n${newRemoteContent}\n${after}`;
}

export function diffNote(existingFileContent, remoteNote) {
  const parsed = parseNoteFile(existingFileContent);
  if (!parsed) return { status: "unmanaged" };
  if (!remoteNote) return { status: "remote-deleted", parsed };

  const remoteContent = String(remoteNote.content ?? remoteNote.desc ?? "").trim();
  const localContent = parsed.managedContent;

  if (localContent === remoteContent) {
    return { status: "synced", parsed, remoteNote };
  }

  return {
    status: "remote-updated",
    parsed,
    remoteNote,
    localContent,
    remoteContent
  };
}

export function isNoteWritebackPermitted() {
  // Writeback to TickTick for Notes is intentionally blocked in v1
  // until a verified official API characterization confirms reliability.
  return false;
}
