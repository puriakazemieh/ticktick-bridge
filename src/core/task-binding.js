const modernPattern = /\s*<!--\s*ticktick-bridge:task\s+id=([A-Za-z0-9_-]+)\s+project=([A-Za-z0-9_-]+)\s+v=(\d+)(?:\s+kind=([A-Za-z0-9_-]+))?\s*-->/i;
const legacyPattern = /%%\[ticktick_id::\s*([\w-]+)\]%%/;

function safeIdentity(value, field) {
  const result = String(value ?? "").trim();
  if (!/^[A-Za-z0-9_-]+$/.test(result)) throw new Error(`Invalid TickTick ${field}.`);
  return result;
}

export function parseTaskBinding(line) {
  const modern = String(line).match(modernPattern);
  if (modern) return { id: modern[1], projectId: modern[2], version: Number(modern[3]), kind: modern[4] ?? "task", legacy: false };
  const legacy = String(line).match(legacyPattern);
  return legacy ? { id: legacy[1], projectId: null, version: 0, kind: "task", legacy: true } : null;
}

export function serializeTaskBinding({ id, projectId, version = 1, kind = "task" }) {
  return `<!-- ticktick-bridge:task id=${safeIdentity(id, "task id")} project=${safeIdentity(projectId, "project id")} v=${Number(version) || 1} kind=${safeIdentity(kind, "kind")} -->`;
}

export function attachTaskBinding(line, binding) {
  const ending = String(line).match(/\r?\n$/)?.[0] ?? "";
  const body = String(line).slice(0, String(line).length - ending.length).replace(modernPattern, "").replace(/[ \t]+$/, "");
  return `${body}${body ? " " : ""}${serializeTaskBinding(binding)}${ending}`;
}

export function removeTaskBinding(line) { return String(line).replace(modernPattern, "").replace(/[ \t]+(?=\r?\n?$)/, ""); }

export function lineLocator(lines, line) {
  return { line, before: String(lines[line - 1] ?? "").trim(), value: String(lines[line] ?? "").trim(), after: String(lines[line + 1] ?? "").trim() };
}

export function locateLine(lines, locator) {
  if (locator && String(lines[locator.line] ?? "").trim() === locator.value) return locator.line;
  const matches = lines.map((value, index) => ({ value: String(value).trim(), index })).filter(entry => entry.value === locator?.value && String(lines[entry.index - 1] ?? "").trim() === locator.before && String(lines[entry.index + 1] ?? "").trim() === locator.after);
  return matches.length === 1 ? matches[0].index : null;
}
