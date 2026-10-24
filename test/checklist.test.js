import test from "node:test";
import assert from "node:assert/strict";
import { checklistSummary, normalizeChecklist } from "../src/core/checklist.js";
test("checklists preserve duplicate labels, IDs, completion, and unknown fields", () => {
  const items = normalizeChecklist([{ id: "a", title: "کار", status: 0, color: "red", sortOrder: 1 }, { id: "b", title: "کار", status: 2, sortOrder: 0 }]);
  assert.equal(items.length, 2); assert.equal(items[0].id, "b"); assert.equal(items[1].unknown.color, "red"); assert.deepEqual(checklistSummary(items), { total: 2, completed: 1 });
});
