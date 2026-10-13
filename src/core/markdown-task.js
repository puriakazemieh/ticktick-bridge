const idPattern = /%%\[ticktick_id::\s*([\w-]+)\]%%/;
const taskPattern = /^(\s*[-*+]\s+\[([ xX])\]\s+)(.*)$/;

export function parseMarkdownTask(line, sourcePath) {
  const task = line.match(taskPattern);
  const id = line.match(idPattern)?.[1];
  if (!task || !id) return null;
  const text = task[3]
    .replace(idPattern, "")
    .replace(/(?:📅|🛫|✅)\s*\d{4}-\d{2}-\d{2}(?:\s+\d{2}:\d{2})?/g, "")
    .replace(/🔁[^#📅🛫✅]*$/, "")
    .replace(/#ticktick\b/g, "")
    .trim();
  return { id, sourcePath, title: text, completed: task[2].toLowerCase() === "x", raw: line };
}

export function scanMarkdownTasks(markdown, sourcePath) {
  return markdown.split(/\r?\n/).map(line => parseMarkdownTask(line, sourcePath)).filter(Boolean);
}
