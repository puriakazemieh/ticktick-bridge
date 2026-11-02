import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTaskHierarchy,
  calculateHierarchyProgress,
  resolveTaskDependencies,
  formatTaskEstimate,
  probeTaskHierarchy,
  isHierarchyWritePermitted
} from "../src/core/task-hierarchy.js";

test("buildTaskHierarchy groups children under parents and retains orphaned subtasks", () => {
  const tasks = [
    { id: "parent1", title: "Parent Task 1" },
    { id: "child1", title: "Child 1", parentId: "parent1", status: 2 },
    { id: "child2", title: "Child 2", parentId: "parent1", status: 0 },
    { id: "orphan1", title: "Orphaned Child", parentId: "nonexistent", status: 0 },
    { id: "root2", title: "Independent Root Task" }
  ];

  const hierarchy = buildTaskHierarchy(tasks);

  assert.equal(hierarchy.rootTasks.length, 3); // parent1, orphan1, root2
  assert.equal(hierarchy.orphanedSubtasks.length, 1);
  assert.equal(hierarchy.orphanedSubtasks[0].id, "orphan1");
  assert.equal(hierarchy.totalSubtasksCount, 3);

  const children = hierarchy.getChildTasks("parent1");
  assert.equal(children.length, 2);
  assert.equal(children[0].id, "child1");
  assert.equal(children[1].id, "child2");

  const parent = hierarchy.getParentTask({ id: "child1", parentId: "parent1" });
  assert.equal(parent.id, "parent1");
});

test("calculateHierarchyProgress calculates accurate completion rollups", () => {
  // 1. From subtasks
  const parent = { id: "p1", title: "Parent" };
  const subtasks = [
    { id: "c1", status: 2 },
    { id: "c2", status: 2 },
    { id: "c3", status: 0 },
    { id: "c4", status: 0 }
  ];
  const progressFromSubtasks = calculateHierarchyProgress(parent, subtasks);
  assert.deepEqual(progressFromSubtasks, {
    total: 4,
    completed: 2,
    percent: 50,
    source: "subtasks"
  });

  // 2. From checklists
  const checklistParent = {
    id: "p2",
    items: [
      { id: "i1", status: 1 },
      { id: "i2", status: 0 },
      { id: "i3", status: 0 }
    ]
  };
  const progressFromChecklist = calculateHierarchyProgress(checklistParent, []);
  assert.deepEqual(progressFromChecklist, {
    total: 3,
    completed: 1,
    percent: 33,
    source: "checklists"
  });

  // 3. From explicit progress field
  const explicitParent = { id: "p3", progress: 85 };
  const progressExplicit = calculateHierarchyProgress(explicitParent, []);
  assert.deepEqual(progressExplicit, {
    total: 100,
    completed: 85,
    percent: 85,
    source: "explicit"
  });
});

test("resolveTaskDependencies resolves forward and backward links and blocked status", () => {
  const allTasks = [
    { id: "taskA", title: "Task A (Prerequisite)", status: 0 },
    { id: "taskB", title: "Task B (Depends on A)", blockedBy: ["taskA"], status: 0 },
    { id: "taskC", title: "Task C (Prerequisite Done)", status: 2 },
    { id: "taskD", title: "Task D (Depends on C)", blockedBy: ["taskC"], status: 0 }
  ];

  // taskB is blocked by taskA (which is unfinished)
  const depsB = resolveTaskDependencies(allTasks[1], allTasks);
  assert.equal(depsB.isBlocked, true);
  assert.equal(depsB.blockedBy.length, 1);
  assert.equal(depsB.blockedBy[0].id, "taskA");
  assert.equal(depsB.blockedBy[0].completed, false);

  // taskA blocks taskB
  const depsA = resolveTaskDependencies(allTasks[0], allTasks);
  assert.equal(depsA.isBlocked, false);
  assert.equal(depsA.blocks.length, 1);
  assert.equal(depsA.blocks[0].id, "taskB");

  // taskD is unblocked because taskC is completed
  const depsD = resolveTaskDependencies(allTasks[3], allTasks);
  assert.equal(depsD.isBlocked, false);
  assert.equal(depsD.blockedBy[0].completed, true);
});

test("formatTaskEstimate formats minutes, pomodoros, and text estimates", () => {
  assert.equal(formatTaskEstimate({ timeEstimate: 45 }), "⏳ 45 دقیقه");
  assert.equal(formatTaskEstimate({ timeEstimate: 120 }), "⏳ 2 ساعت");
  assert.equal(formatTaskEstimate({ timeEstimate: 150 }), "⏳ 2س 30د");
  assert.equal(formatTaskEstimate({ pomodoroCount: 3 }), "🍅 3 پومودورو");
  assert.equal(formatTaskEstimate({ estimate: "2d" }), "⏳ تخمین: 2d");
  assert.equal(formatTaskEstimate({ title: "No estimate" }), null);
});

test("probeTaskHierarchy detects field occurrences and ambiguity safely", () => {
  const tasks = [
    { id: "t1", parentId: "p1" },
    { id: "t2", items: [{ title: "sub" }] },
    { id: "t3", blockedBy: ["t1"] },
    { id: "t4", timeEstimate: 60 },
    { id: "t5", parentId: "p2", items: [{ title: "ambiguous" }] } // ambiguous
  ];

  const probe = probeTaskHierarchy(tasks);
  assert.equal(probe.totalTasksScanned, 5);
  assert.equal(probe.parentChildCount, 2);
  assert.equal(probe.checklistCount, 2);
  assert.equal(probe.dependencyCount, 1);
  assert.equal(probe.estimateCount, 1);
  assert.equal(probe.ambiguousCount, 1);
  assert.equal(probe.ambiguousSamples[0].taskId, "t5");
  assert.equal(probe.writeSafety.readOnlyByDefault, true);
});

test("isHierarchyWritePermitted enforces read-only guardrails by default", () => {
  // Default: setting is off -> false
  assert.equal(isHierarchyWritePermitted({ experimentalHierarchyWrites: false }), false);
  assert.equal(isHierarchyWritePermitted({}), false);
  assert.equal(isHierarchyWritePermitted(null), false);

  // Setting is on, but unconfirmed -> false
  assert.equal(isHierarchyWritePermitted({ experimentalHierarchyWrites: true }, false), false);

  // Setting is on AND confirmed -> true
  assert.equal(isHierarchyWritePermitted({ experimentalHierarchyWrites: true }, true), true);
});
