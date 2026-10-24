import { parseTaskBinding } from "./task-binding.js";

const taskPattern = /^(\s*[-*+]\s+\[([ xX])\]\s+)(.*)$/;

export function parseMarkdownTask(line, sourcePath, lineNumber = 0) {
  const task = String(line).match(taskPattern);
  if (!task) return null;
  const binding = parseTaskBinding(line);
  const text = task[3]
    .replace(/%%\[ticktick_id::\s*[\w-]+\]%%/, "")
    .replace(/\s*<!--\s*ticktick-bridge:task\b[^>]*-->/i, "")
    .replace(/(?:📅|🛫|✅)\s*\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?/g, "")
    .replace(/🔁[^#📅🛫✅]*$/, "")
    .replace(/#ticktick\b/gi, "")
    .trim();
  return { id: binding?.id ?? null, binding, sourcePath, lineNumber, title: text, completed: task[2].toLowerCase() === "x", raw: String(line), prefix: task[1] };
}

export function scanMarkdownTasks(markdown, sourcePath) {
  return String(markdown).split(/\r?\n/).map((line, index) => parseMarkdownTask(line, sourcePath, index)).filter(Boolean);
}
