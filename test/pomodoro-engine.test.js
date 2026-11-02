import test from "node:test";
import assert from "node:assert/strict";
import {
  POMODORO_MODES,
  createPomodoroState,
  startFocusSession,
  startBreakSession,
  tickPomodoro,
  pausePomodoro,
  resumePomodoro,
  resetPomodoro,
  skipPomodoro,
  formatPomodoroLogEntry,
  appendPomodoroLogToDailyNoteMarkdown
} from "../src/core/pomodoro-engine.js";

test("pomodoro state machine transitions and intervals", () => {
  const initial = createPomodoroState({ focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15 });
  assert.equal(initial.mode, POMODORO_MODES.IDLE);
  assert.equal(initial.remainingSeconds, 1500);

  // Start focus session
  const task = { id: "t1", title: "Complete report" };
  const focusing = startFocusSession(initial, task);
  assert.equal(focusing.mode, POMODORO_MODES.FOCUS);
  assert.equal(focusing.isRunning, true);
  assert.equal(focusing.activeTask?.id, "t1");
  assert.equal(focusing.remainingSeconds, 1500);

  // Tick 10 seconds
  const ticked = tickPomodoro(focusing, 10);
  assert.equal(ticked.state.remainingSeconds, 1490);
  assert.equal(ticked.event, null);

  // Pause and resume
  const paused = pausePomodoro(ticked.state);
  assert.equal(paused.isRunning, false);
  const noTick = tickPomodoro(paused, 10);
  assert.equal(noTick.state.remainingSeconds, 1490); // didn't change while paused
  const resumed = resumePomodoro(paused);
  assert.equal(resumed.isRunning, true);

  // Complete focus session (remaining 0)
  const almostDone = { ...focusing, remainingSeconds: 1 };
  const done = tickPomodoro(almostDone, 1);
  assert.equal(done.event, "focusCompleted");
  assert.equal(done.state.completedPomodoros, 1);
  assert.equal(done.state.mode, POMODORO_MODES.SHORT_BREAK);
  assert.equal(done.state.remainingSeconds, 300); // 5 mins break

  // 4th completed focus triggers long break
  const fourthAlmostDone = { ...focusing, completedPomodoros: 3, remainingSeconds: 1 };
  const fourthDone = tickPomodoro(fourthAlmostDone, 1);
  assert.equal(fourthDone.event, "focusCompleted");
  assert.equal(fourthDone.state.completedPomodoros, 4);
  assert.equal(fourthDone.state.mode, POMODORO_MODES.LONG_BREAK);
  assert.equal(fourthDone.state.remainingSeconds, 900); // 15 mins long break
});

test("formatPomodoroLogEntry produces clean markdown", () => {
  const session = {
    durationMinutes: 25,
    task: { title: "توسعه ماتریس آیزنهاور" },
    completedAt: "2026-11-02T14:30:00+0330"
  };

  const line = formatPomodoroLogEntry(session);
  assert.ok(line.includes("🍅 25 دقیقه"));
  assert.ok(line.includes("توسعه ماتریس آیزنهاور"));
});

test("appendPomodoroLogToDailyNoteMarkdown appends to existing heading or creates new heading", () => {
  const logLine = "- 🍅 25 دقیقه: تسک تست (ساعت ۱۴:۳۰)";

  // Case 1: Heading already exists in note
  const existingNote = `# یادداشت روزانه

## وظایف امروز
- [ ] تسک ۱

## جلسات تمرکز (Pomodoro)
- 🍅 ۲۵ دقیقه: تسک قبلی

## یادداشت‌ها
متن یادداشت
`;

  const updated1 = appendPomodoroLogToDailyNoteMarkdown(existingNote, logLine);
  assert.ok(updated1.includes(logLine));
  // Must be before ## یادداشت‌ها
  const logPos = updated1.indexOf(logLine);
  const nextHeadingPos = updated1.indexOf("## یادداشت‌ها");
  assert.ok(logPos < nextHeadingPos);

  // Case 2: Heading does not exist in note
  const noteWithoutHeading = `# یادداشت روزانه

یک متن ساده
`;

  const updated2 = appendPomodoroLogToDailyNoteMarkdown(noteWithoutHeading, logLine);
  assert.ok(updated2.includes("## جلسات تمرکز (Pomodoro)"));
  assert.ok(updated2.includes(logLine));
});
