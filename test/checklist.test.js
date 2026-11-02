import test from "node:test";
import assert from "node:assert/strict";
import {
  CHECKLIST_CAPABILITY,
  checklistSummary,
  diffChecklist,
  isChecklistMutationPermitted,
  normalizeChecklist
} from "../src/core/checklist.js";

test("checklists preserve duplicate labels, IDs, completion, and unknown fields", () => {
  const items = normalizeChecklist([
    { id: "a", title: "کار", status: 0, color: "red", sortOrder: 1 },
    { id: "b", title: "کار", status: 2, sortOrder: 0 }
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0].id, "b");
  assert.equal(items[1].unknown.color, "red");
  assert.deepEqual(checklistSummary(items), { total: 2, completed: 1 });
});

test("checklists handle null, empty arrays, missing IDs, and markdown-like checkboxes in title", () => {
  assert.deepEqual(normalizeChecklist(null), []);
  assert.deepEqual(normalizeChecklist([]), []);

  const items = normalizeChecklist([
    { title: "- [ ] markdown checkbox", completed: false },
    { content: "- [x] completed markdown checkbox", status: 2 }
  ]);
  assert.equal(items.length, 2);
  assert.equal(items[0].id, null);
  assert.equal(items[0].title, "- [ ] markdown checkbox");
  assert.equal(items[0].completed, false);
  assert.equal(items[1].title, "- [x] completed markdown checkbox");
  assert.equal(items[1].completed, true);
});

test("diffChecklist calculates added, removed, modified, and unchanged items", () => {
  const baseline = [
    { id: "1", title: "تسک یک", status: 0, sortOrder: 0 },
    { id: "2", title: "تسک دو", status: 0, sortOrder: 1 },
    { id: "3", title: "تسک سه", status: 0, sortOrder: 2 }
  ];
  const current = [
    { id: "1", title: "تسک یک (ویرایش)", status: 2, sortOrder: 0 }, // modified
    { id: "3", title: "تسک سه", status: 0, sortOrder: 1 },          // modified sortOrder
    { title: "تسک چهار جدید", status: 0, sortOrder: 2 }            // added (no id)
    // "2" was removed
  ];

  const diff = diffChecklist(baseline, current);
  assert.equal(diff.hasChanges, true);
  assert.equal(diff.removed.length, 1);
  assert.equal(diff.removed[0].id, "2");
  assert.equal(diff.added.length, 1);
  assert.equal(diff.added[0].title, "تسک چهار جدید");
  assert.equal(diff.modified.length, 2);
  assert.equal(diff.modified[0].before.id, "1");
  assert.equal(diff.modified[0].after.completed, true);
});

test("checklist write operations are blocked pending official API characterization", () => {
  // Safety gate: default is read-only
  assert.equal(isChecklistMutationPermitted(), false);
  assert.equal(isChecklistMutationPermitted(CHECKLIST_CAPABILITY.READ_ONLY), false);
  assert.equal(isChecklistMutationPermitted(CHECKLIST_CAPABILITY.UNAVAILABLE), false);
  assert.equal(isChecklistMutationPermitted(CHECKLIST_CAPABILITY.ENABLED_UNVERIFIED), false);

  // Only verified state allows write mutations
  assert.equal(isChecklistMutationPermitted(CHECKLIST_CAPABILITY.VERIFIED, "add"), true);
  assert.equal(isChecklistMutationPermitted(CHECKLIST_CAPABILITY.VERIFIED, "complete"), true);
});
