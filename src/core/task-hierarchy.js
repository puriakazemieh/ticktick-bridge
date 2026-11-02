/**
 * TickTick Bridge — Task Hierarchy, Subtasks & Estimates Engine
 * Experimental pure core module for parent/child relationships, dependencies,
 * time estimates, progress rollups, and audit probe reports.
 */

/**
 * Builds a structured hierarchy tree from flat task list.
 * Identifies root tasks, subtasks, orphaned subtasks, and progress rollups.
 */
export function buildTaskHierarchy(tasks = []) {
  const taskMap = new Map();
  const childrenMap = new Map();
  const orphaned = [];
  const rootTasks = [];

  for (const task of tasks) {
    if (!task || !task.id) continue;
    const strId = String(task.id);
    taskMap.set(strId, task);
  }

  for (const task of tasks) {
    if (!task || !task.id) continue;
    const strId = String(task.id);
    const parentId = task.parentId ? String(task.parentId) : null;

    if (parentId) {
      if (taskMap.has(parentId)) {
        if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
        childrenMap.get(parentId).push(task);
      } else {
        orphaned.push(task);
        rootTasks.push(task); // Render orphaned subtasks as roots rather than hiding them
      }
    } else {
      rootTasks.push(task);
    }
  }

  return {
    rootTasks,
    orphanedSubtasks: orphaned,
    childrenMap,
    getChildTasks: (parentId) => childrenMap.get(String(parentId)) || [],
    getParentTask: (childTask) => childTask.parentId ? taskMap.get(String(childTask.parentId)) || null : null,
    totalSubtasksCount: tasks.filter(t => Boolean(t.parentId)).length
  };
}

/**
 * Calculates completion progress for a parent task based on child tasks or checklists.
 */
export function calculateHierarchyProgress(parentTask, childTasks = []) {
  if (!parentTask) return null;

  // 1. Roll-up from child subtasks if present
  if (Array.isArray(childTasks) && childTasks.length > 0) {
    const completed = childTasks.filter(c => Number(c?.status ?? 0) !== 0).length;
    const total = childTasks.length;
    const percent = Math.round((completed / total) * 100);
    return {
      total,
      completed,
      percent,
      source: "subtasks"
    };
  }

  // 2. Fallback to checklist items if present
  if (Array.isArray(parentTask.items) && parentTask.items.length > 0) {
    const completed = parentTask.items.filter(item => Boolean(item.completed) || Number(item.status ?? 0) !== 0).length;
    const total = parentTask.items.length;
    const percent = Math.round((completed / total) * 100);
    return {
      total,
      completed,
      percent,
      source: "checklists"
    };
  }

  // 3. Fallback to explicit progress percentage field
  if (parentTask.progress !== undefined && parentTask.progress !== null) {
    const p = Math.max(0, Math.min(100, Number(parentTask.progress) || 0));
    return {
      total: 100,
      completed: p,
      percent: p,
      source: "explicit"
    };
  }

  return null;
}

/**
 * Resolves blocked-by and blocks dependency links for a task.
 */
export function resolveTaskDependencies(task, allTasks = []) {
  if (!task) return { blockedBy: [], blocks: [], isBlocked: false };

  const taskMap = new Map(allTasks.map(t => [String(t.id), t]));
  const currentId = String(task.id);

  // 1. Tasks that block this task (this task depends on them)
  const rawBlockedBy = Array.isArray(task.blockedBy)
    ? task.blockedBy
    : Array.isArray(task.dependsOn)
      ? task.dependsOn
      : [];

  const blockedBy = rawBlockedBy.map(id => {
    const dep = taskMap.get(String(id));
    return {
      id: String(id),
      title: dep ? dep.title : `تسک ناشناس #${id}`,
      completed: dep ? Number(dep.status ?? 0) !== 0 : false
    };
  });

  // 2. Tasks that this task blocks
  const blocks = [];
  for (const other of allTasks) {
    if (!other || String(other.id) === currentId) continue;
    const otherDeps = Array.isArray(other.blockedBy)
      ? other.blockedBy
      : Array.isArray(other.dependsOn)
        ? other.dependsOn
        : [];
    if (otherDeps.map(String).includes(currentId)) {
      blocks.push({
        id: String(other.id),
        title: other.title || `تسک #${other.id}`,
        completed: Number(other.status ?? 0) !== 0
      });
    }
  }

  // Task is considered blocked if ANY blocking task is unfinished (status === 0)
  const isBlocked = blockedBy.some(dep => !dep.completed);

  return {
    blockedBy,
    blocks,
    isBlocked
  };
}

/**
 * Formats task estimate values (minutes, pomodoros, story points).
 */
export function formatTaskEstimate(task) {
  if (!task) return null;

  // 1. Time estimate in minutes
  if (task.timeEstimate !== undefined && task.timeEstimate !== null) {
    const mins = Number(task.timeEstimate);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const rem = mins % 60;
      return rem > 0 ? `⏳ ${hours}س ${rem}د` : `⏳ ${hours} ساعت`;
    }
    return `⏳ ${mins} دقیقه`;
  }

  // 2. Pomodoro count
  if (task.pomodoroCount !== undefined && task.pomodoroCount !== null) {
    return `🍅 ${task.pomodoroCount} پومودورو`;
  }

  // 3. Generic estimate field
  if (task.estimate !== undefined && task.estimate !== null) {
    return `⏳ تخمین: ${task.estimate}`;
  }

  return null;
}

/**
 * Probes task cache for hierarchy, dependency, and estimate fields.
 * Generates non-secret developer probe audit report.
 */
export function probeTaskHierarchy(tasks = []) {
  let parentChildCount = 0;
  let checklistCount = 0;
  let dependencyCount = 0;
  let estimateCount = 0;
  let progressCount = 0;

  const observedParentIds = new Set();
  const ambiguousFields = [];

  for (const task of tasks) {
    if (!task) continue;

    if (task.parentId) {
      parentChildCount++;
      observedParentIds.add(String(task.parentId));
    }
    if (Array.isArray(task.items) && task.items.length > 0) {
      checklistCount++;
    }
    if ((Array.isArray(task.blockedBy) && task.blockedBy.length > 0) || (Array.isArray(task.dependsOn) && task.dependsOn.length > 0)) {
      dependencyCount++;
    }
    if (task.estimate !== undefined || task.timeEstimate !== undefined || task.pomodoroCount !== undefined) {
      estimateCount++;
    }
    if (task.progress !== undefined) {
      progressCount++;
    }

    // Detect field ambiguity:
    if (task.parentId && Array.isArray(task.items) && task.items.length > 0) {
      ambiguousFields.push({
        taskId: String(task.id),
        issue: "Task has both parentId and checklist items"
      });
    }
  }

  return {
    timestamp: new Date().toISOString(),
    totalTasksScanned: tasks.length,
    parentChildCount,
    uniqueParentsCount: observedParentIds.size,
    checklistCount,
    dependencyCount,
    estimateCount,
    progressCount,
    ambiguousCount: ambiguousFields.length,
    ambiguousSamples: ambiguousFields.slice(0, 5),
    writeSafety: {
      readOnlyByDefault: true,
      writeRequiresExplicitSetting: true,
      journalingSupported: false
    }
  };
}

/**
 * Checks whether hierarchy write mutations (subtask creation, reparenting) are permitted.
 * Strict guardrail: requires settings.experimentalHierarchyWrites === true AND explicit confirmation.
 */
export function isHierarchyWritePermitted(settings, confirmed = false) {
  if (!settings || !settings.experimentalHierarchyWrites) {
    return false;
  }
  return Boolean(confirmed);
}
