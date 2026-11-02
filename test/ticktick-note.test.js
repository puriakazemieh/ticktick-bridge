import test from "node:test";
import assert from "node:assert/strict";
import {
  diffNote,
  isNoteWritebackPermitted,
  normalizeTickTickNote,
  noteFileName,
  noteMarkdown,
  parseNoteFile,
  updateNoteMarkdown
} from "../src/core/ticktick-note.js";

test("only a positively identified NOTE becomes an import candidate", () => {
  assert.equal(normalizeTickTickNote(null), null);
  assert.equal(normalizeTickTickNote({ id: "x", title: "task", kind: "TEXT", content: "- [ ] no" }), null);
  assert.equal(normalizeTickTickNote({ id: "x", title: "task", kind: "CHECKLIST" }), null);
  assert.equal(normalizeTickTickNote({ id: "", title: "empty id", kind: "NOTE" }), null);
  assert.equal(normalizeTickTickNote({ id: "n1", title: "", kind: "NOTE" }), null);

  const note = normalizeTickTickNote(
    { id: "n1", title: "یادداشت/جلسه", kind: "NOTE", content: "# متن\n- [ ] چک‌باکس فقط متن است" },
    { id: "p", name: "کار" }
  );
  assert.ok(note);
  assert.equal(note.projectName, "کار");
  assert.equal(note.kind, "NOTE");
  assert.equal(note.content, "# متن\n- [ ] چک‌باکس فقط متن است");
  assert.match(noteFileName(note), /n1\.md$/);
  assert.match(noteMarkdown(note), /ticktick-bridge:note:start/);
});

test("noteFileName sanitizes invalid filesystem characters while preserving Persian titles", () => {
  const note = { id: "note123", title: "جلسه: راهبرد / طراحی * ۲۰۲۶" };
  const filename = noteFileName(note);
  assert.equal(filename, "جلسه- راهبرد - طراحی - ۲۰۲۶-note123.md");
  assert.ok(!/[\\/:*?"<>|]/.test(filename));
});

test("parseNoteFile extracts provenance, managed region, and user-owned trailing content", () => {
  const markdown = `---
ticktickNoteId: note-99
ticktickProjectId: proj-1
ticktickKind: NOTE
ticktickImportedAt: 2026-10-24T12:00:00.000Z
---

<!-- ticktick-bridge:note:start -->
محتوای همگام از تیک‌تیک
<!-- ticktick-bridge:note:end -->

## یادداشت‌های من در ابسیدین
این بخش توسط کاربر نوشته شده است و نباید پاک شود.`;

  const parsed = parseNoteFile(markdown);
  assert.ok(parsed);
  assert.equal(parsed.id, "note-99");
  assert.equal(parsed.projectId, "proj-1");
  assert.equal(parsed.kind, "NOTE");
  assert.equal(parsed.managedContent, "محتوای همگام از تیک‌تیک");
  assert.ok(parsed.userTrailingContent.includes("این بخش توسط کاربر نوشته شده است"));
});

test("updateNoteMarkdown replaces only managed region while preserving user-owned trailing content", () => {
  const original = `---
ticktickNoteId: note-99
ticktickProjectId: proj-1
ticktickKind: NOTE
ticktickImportedAt: 2026-10-24T12:00:00.000Z
---

<!-- ticktick-bridge:note:start -->
نسخه قدیمی
<!-- ticktick-bridge:note:end -->

## یادداشت‌های من
این متن شخصی است.`;

  const updated = updateNoteMarkdown(original, "نسخه جدید بروزرسانی‌شده از سرور");
  assert.ok(updated.includes("نسخه جدید بروزرسانی‌شده از سرور"));
  assert.ok(!updated.includes("نسخه قدیمی"));
  assert.ok(updated.includes("## یادداشت‌های من"));
  assert.ok(updated.includes("این متن شخصی است."));
});

test("diffNote distinguishes synced, remote-updated, and remote-deleted notes", () => {
  const fileContent = `---
ticktickNoteId: n1
ticktickProjectId: p1
ticktickKind: NOTE
---

<!-- ticktick-bridge:note:start -->
سلام دنیا
<!-- ticktick-bridge:note:end -->
`;

  // Synced
  const syncDiff = diffNote(fileContent, { id: "n1", content: "سلام دنیا" });
  assert.equal(syncDiff.status, "synced");

  // Remote updated
  const updatedDiff = diffNote(fileContent, { id: "n1", content: "سلام دنیا ویرایش جدید" });
  assert.equal(updatedDiff.status, "remote-updated");
  assert.equal(updatedDiff.localContent, "سلام دنیا");
  assert.equal(updatedDiff.remoteContent, "سلام دنیا ویرایش جدید");

  // Remote deleted / orphaned
  const deletedDiff = diffNote(fileContent, null);
  assert.equal(deletedDiff.status, "remote-deleted");
});

test("isNoteWritebackPermitted blocks writeback to remote in v1", () => {
  assert.equal(isNoteWritebackPermitted(), false);
});
