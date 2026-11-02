/**
 * TickTick Bridge — Focus & Pomodoro Engine Core
 * State transitions, interval calculation, markdown daily-note formatting and heading insertion.
 */

export const POMODORO_MODES = {
  FOCUS: "focus",
  SHORT_BREAK: "shortBreak",
  LONG_BREAK: "longBreak",
  IDLE: "idle"
};

export const DEFAULT_POMODORO_SETTINGS = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  dailyNoteHeading: "## جلسات تمرکز (Pomodoro)"
};

/**
 * Initializes a new pomodoro state.
 */
export function createPomodoroState(settings = {}) {
  const merged = { ...DEFAULT_POMODORO_SETTINGS, ...settings };
  return {
    mode: POMODORO_MODES.IDLE,
    activeTask: null,
    totalSeconds: merged.focusMinutes * 60,
    remainingSeconds: merged.focusMinutes * 60,
    isRunning: false,
    completedPomodoros: 0,
    settings: merged,
    history: []
  };
}

/**
 * Starts a focus session for a task or general focus.
 */
export function startFocusSession(state, task = null) {
  const durationSec = state.settings.focusMinutes * 60;
  return {
    ...state,
    mode: POMODORO_MODES.FOCUS,
    activeTask: task,
    totalSeconds: durationSec,
    remainingSeconds: durationSec,
    isRunning: true
  };
}

/**
 * Starts a break session.
 */
export function startBreakSession(state, isLong = false) {
  const minutes = isLong ? state.settings.longBreakMinutes : state.settings.shortBreakMinutes;
  const durationSec = minutes * 60;
  return {
    ...state,
    mode: isLong ? POMODORO_MODES.LONG_BREAK : POMODORO_MODES.SHORT_BREAK,
    totalSeconds: durationSec,
    remainingSeconds: durationSec,
    isRunning: true
  };
}

/**
 * Ticks the timer by deltaSeconds (default 1).
 * Returns { state, event } where event can be "focusCompleted", "breakCompleted", or null.
 */
export function tickPomodoro(state, deltaSeconds = 1) {
  if (!state.isRunning) return { state, event: null };

  const nextRemaining = Math.max(0, state.remainingSeconds - deltaSeconds);

  if (nextRemaining > 0) {
    return {
      state: { ...state, remainingSeconds: nextRemaining },
      event: null
    };
  }

  // Timer reached 0
  if (state.mode === POMODORO_MODES.FOCUS) {
    const nextCompleted = state.completedPomodoros + 1;
    const isLong = (nextCompleted % state.settings.sessionsBeforeLongBreak) === 0;
    const sessionRecord = {
      task: state.activeTask,
      durationMinutes: state.settings.focusMinutes,
      completedAt: new Date().toISOString()
    };

    const nextBreakState = startBreakSession({
      ...state,
      completedPomodoros: nextCompleted,
      history: [...state.history, sessionRecord]
    }, isLong);

    return {
      state: nextBreakState,
      event: "focusCompleted",
      session: sessionRecord
    };
  } else {
    // Break completed
    return {
      state: {
        ...state,
        mode: POMODORO_MODES.IDLE,
        isRunning: false,
        remainingSeconds: state.settings.focusMinutes * 60,
        totalSeconds: state.settings.focusMinutes * 60
      },
      event: "breakCompleted"
    };
  }
}

/**
 * Pauses timer.
 */
export function pausePomodoro(state) {
  return { ...state, isRunning: false };
}

/**
 * Resumes timer.
 */
export function resumePomodoro(state) {
  if (state.remainingSeconds <= 0) return state;
  return { ...state, isRunning: true };
}

/**
 * Resets timer to idle.
 */
export function resetPomodoro(state) {
  const initialSec = state.settings.focusMinutes * 60;
  return {
    ...state,
    mode: POMODORO_MODES.IDLE,
    remainingSeconds: initialSec,
    totalSeconds: initialSec,
    isRunning: false,
    activeTask: null
  };
}

/**
 * Skips current phase.
 */
export function skipPomodoro(state) {
  if (state.mode === POMODORO_MODES.FOCUS) {
    const nextCompleted = state.completedPomodoros + 1;
    const isLong = (nextCompleted % state.settings.sessionsBeforeLongBreak) === 0;
    return startBreakSession({ ...state, completedPomodoros: nextCompleted }, isLong);
  } else {
    return resetPomodoro(state);
  }
}

/**
 * Formats a clean Persian markdown log entry for a completed session.
 */
export function formatPomodoroLogEntry(session, timeZone = "Asia/Tehran") {
  const duration = session.durationMinutes || 25;
  const taskTitle = session.task?.title ? String(session.task.title).trim() : "تمرکز عمومی";
  
  let timeStr = "";
  try {
    const dt = session.completedAt ? new Date(session.completedAt) : new Date();
    timeStr = new Intl.DateTimeFormat("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone
    }).format(dt);
  } catch {
    timeStr = "ثبت‌شده";
  }

  return `- 🍅 ${duration} دقیقه: ${taskTitle} (ساعت ${timeStr})`;
}

/**
 * Appends a pomodoro log entry under user-configured heading in Daily Note markdown.
 * If heading does not exist, appends heading and entry at the end safely.
 */
export function appendPomodoroLogToDailyNoteMarkdown(markdownContent = "", logEntry, heading = "## جلسات تمرکز (Pomodoro)") {
  const cleanHeading = heading.trim();
  const cleanEntry = logEntry.trim();
  const lines = markdownContent.split(/\r?\n/);

  // Locate heading in markdown
  const headingIdx = lines.findIndex(line => line.trim().toLowerCase() === cleanHeading.toLowerCase());

  if (headingIdx !== -1) {
    // Find next heading or end of file to append under current heading
    let insertIdx = headingIdx + 1;
    while (insertIdx < lines.length && !lines[insertIdx].trim().startsWith("#")) {
      insertIdx++;
    }

    // Insert logEntry right before the next heading or at the end
    // Check if previous line is empty, otherwise insert cleanly
    const before = lines.slice(0, insertIdx);
    const after = lines.slice(insertIdx);

    // If there's an empty line right before next heading, put it before the empty line or after
    return [...before, cleanEntry, ...after].join("\n");
  } else {
    // Heading not found, append at the end of note
    const trimmed = markdownContent.trimEnd();
    const separator = trimmed ? "\n\n" : "";
    return `${trimmed}${separator}${cleanHeading}\n\n${cleanEntry}\n`;
  }
}
