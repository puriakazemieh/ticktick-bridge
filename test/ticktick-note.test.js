import test from "node:test";
import assert from "node:assert/strict";
import { normalizeTickTickNote, noteFileName, noteMarkdown } from "../src/core/ticktick-note.js";
test("only a positively identified NOTE becomes an import candidate", () => {
  assert.equal(normalizeTickTickNote({ id: "x", title: "task", kind: "TEXT", content: "- [ ] no" }), null);
  const note = normalizeTickTickNote({ id: "n1", title: "یادداشت/جلسه", kind: "NOTE", content: "# متن\n- [ ] فقط متن" }, { id: "p", name: "کار" });
  assert.equal(note.projectName, "کار"); assert.match(noteFileName(note), /n1\.md$/); assert.match(noteMarkdown(note), /ticktick-bridge:note:start/);
});
