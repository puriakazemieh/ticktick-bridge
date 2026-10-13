import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { parseProjectNote, summarizeProjectNotes } from "../src/core/project-notes.js";

const root = join(process.cwd(), "..", "برنامه کلان ۱۴۰۵");

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    if (!entry.isFile() || !entry.name.endsWith(".md")) return [];
    const parsed = parseProjectNote(await readFile(path, "utf8"), relative(root, path));
    return parsed ? [parsed] : [];
  }));
  return nested.flat();
}

const notes = await walk(root);
console.log(JSON.stringify(summarizeProjectNotes(notes), null, 2));
