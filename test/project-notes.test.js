import test from "node:test";
import assert from "node:assert/strict";
import { parseProjectNote, summarizeProjectNotes } from "../src/core/project-notes.js";

test("recognizes an eligible project task without changing it", () => {
  const note = parseProjectNote('---\ntitle: "تمرین"\ntype: "task"\nstatus: "todo"\n---\n', "زبان آلمانی/_tasks/تمرین.md");
  assert.deepEqual(note, { path: "زبان آلمانی/_tasks/تمرین.md", title: "تمرین", status: "todo", eligible: true });
});

test("excludes completed project tasks from migration candidates", () => {
  const notes = [
    parseProjectNote("---\ntitle: اول\ntype: task\nstatus: todo\n---", "بهبود فردی/_tasks/اول.md"),
    parseProjectNote("---\ntitle: دوم\ntype: task\nstatus: done\n---", "بهبود فردی/_tasks/دوم.md"),
  ];
  assert.deepEqual(summarizeProjectNotes(notes), { total: 2, eligible: 1, byArea: { "بهبود فردی": { total: 2, eligible: 1 } } });
});
