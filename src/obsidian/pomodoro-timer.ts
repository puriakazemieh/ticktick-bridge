import { App, Modal, Notice, setIcon, TFile } from "obsidian";
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
  appendPomodoroLogToDailyNoteMarkdown,
  type DEFAULT_POMODORO_SETTINGS
} from "../core/pomodoro-engine.js";
import { cleanTaskTitle } from "./helpers";
import type { TickTickTask } from "./types";

export interface PomodoroHost {
  app: App;
  timeZone: string;
  dailyNoteFolder: string;
  tasks: () => TickTickTask[];
  updateTask: (mutation: Partial<TickTickTask>) => Promise<any>;
  logPomodoroToDailyNote: (session: any) => Promise<boolean>;
  onStateChanged?: (state: any) => void;
}

export interface PomodoroState {
  mode: string;
  activeTask: TickTickTask | null;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  completedPomodoros: number;
  settings: any;
  history: any[];
}

export class PomodoroTimerService {
  private state: PomodoroState = createPomodoroState() as PomodoroState;
  private timerId: number | null = null;
  private listeners = new Set<(state: any) => void>();

  constructor(private host: PomodoroHost) {}

  getState() {
    return this.state;
  }

  subscribe(callback: (state: any) => void): () => void {
    this.listeners.add(callback);
    callback(this.state);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch {
        // Listener safety
      }
    }
    this.host.onStateChanged?.(this.state);
  }

  start(task: TickTickTask | null = null) {
    this.state = startFocusSession(this.state, task as any) as PomodoroState;
    this.ensureTicker();
    this.notify();
  }

  pause() {
    this.state = pausePomodoro(this.state) as PomodoroState;
    this.notify();
  }

  resume() {
    this.state = resumePomodoro(this.state) as PomodoroState;
    this.ensureTicker();
    this.notify();
  }

  reset() {
    this.state = resetPomodoro(this.state) as PomodoroState;
    this.notify();
  }

  skip() {
    this.state = skipPomodoro(this.state) as PomodoroState;
    this.ensureTicker();
    this.notify();
  }

  setPreset(focusMinutes: number, breakMinutes: number) {
    this.state = createPomodoroState({
      ...this.state.settings,
      focusMinutes,
      shortBreakMinutes: breakMinutes
    }) as PomodoroState;
    this.notify();
  }

  setTask(task: TickTickTask | null) {
    this.state.activeTask = task;
    this.notify();
  }

  private ensureTicker() {
    if (this.timerId !== null) return;
    this.timerId = window.setInterval(() => {
      if (!this.state.isRunning) return;

      const { state, event, session } = tickPomodoro(this.state, 1);
      this.state = state as PomodoroState;
      this.notify();

      if (event === "focusCompleted" && session) {
        this.handleFocusCompleted(session);
      } else if (event === "breakCompleted") {
        new Notice("زمان استراحت به پایان رسید! آماده جلسه تمرکز بعدی؟ 🍅");
        this.playChime();
      }
    }, 1000);
  }

  private async handleFocusCompleted(session: any) {
    this.playChime();
    new Notice(`جلسه تمرکز ${session.durationMinutes} دقیقه‌ای تکمیل شد! 👏 وقت استراحت است.`);

    // 1. Increment pomodoro count on task if set
    if (session.task?.id) {
      const curCount = Number((session.task as any).pomodoroCount ?? 0);
      try {
        await this.host.updateTask({
          id: session.task.id,
          pomodoroCount: curCount + 1
        } as any);
      } catch {
        // non-blocking
      }
    }

    // 2. Auto-log into today's Jalali Daily Note
    try {
      await this.host.logPomodoroToDailyNote(session);
    } catch (err) {
      new Notice("ثبت جلسه تمرکز در یادداشت روزانه با خطا مواجه شد.");
    }
  }

  private playChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.start(now);
      osc.stop(now + 0.6);
    } catch {
      // Audio fallback silent
    }
  }

  destroy() {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    this.listeners.clear();
  }
}

export class PomodoroModal extends Modal {
  private unsubscribe: (() => void) | null = null;

  constructor(app: App, private service: PomodoroTimerService, private host: PomodoroHost) {
    super(app);
  }

  onOpen() {
    this.modalEl.addClass("ticktick-pomodoro-modal");
    this.render();
    this.unsubscribe = this.service.subscribe(() => {
      this.updateView();
    });
  }

  onClose() {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.contentEl.empty();
  }

  private render() {
    this.contentEl.empty();

    const root = this.contentEl.createDiv({ cls: "ticktick-pomodoro-container" });

    // Mode Badge
    root.createDiv({ cls: "ticktick-pomodoro-badge" });

    // Countdown Display
    root.createDiv({ cls: "ticktick-pomodoro-timer-display" });

    // Progress Bar Wrap
    const progWrap = root.createDiv({ cls: "ticktick-pomodoro-progress-wrap" });
    progWrap.createDiv({ cls: "ticktick-pomodoro-progress-bar" });

    // Active Task Picker / Info
    const taskCard = root.createDiv({ cls: "ticktick-pomodoro-task-card" });
    taskCard.createDiv({ cls: "ticktick-pomodoro-task-label", text: "تسک در حال تمرکز:" });
    const select = taskCard.createEl("select", { cls: "ticktick-pomodoro-select" });

    const openTasks = this.host.tasks().filter(t => Number(t.status ?? 0) === 0);
    const defaultOpt = select.createEl("option", { text: "تمرکز عمومی (بدون تسک مشخص)", value: "" });

    for (const t of openTasks) {
      const opt = select.createEl("option", { text: cleanTaskTitle(t.title), value: String(t.id) });
      if (String(t.id) === String(this.service.getState().activeTask?.id)) {
        opt.selected = true;
      }
    }

    select.addEventListener("change", () => {
      const chosen = openTasks.find(t => String(t.id) === select.value) ?? null;
      this.service.setTask(chosen);
    });

    // Control Buttons
    const controls = root.createDiv({ cls: "ticktick-pomodoro-controls" });

    const resetBtn = controls.createEl("button", {
      cls: "ticktick-pomodoro-btn-subtle",
      text: "بازنشانی"
    });
    resetBtn.addEventListener("click", () => this.service.reset());

    const mainBtn = controls.createEl("button", {
      cls: "ticktick-pomodoro-btn-main"
    });
    mainBtn.addEventListener("click", () => {
      const st = this.service.getState();
      if (!st.isRunning) {
        if (st.remainingSeconds < st.totalSeconds && st.mode !== POMODORO_MODES.IDLE) {
          this.service.resume();
        } else {
          this.service.start(st.activeTask);
        }
      } else {
        this.service.pause();
      }
    });

    const skipBtn = controls.createEl("button", {
      cls: "ticktick-pomodoro-btn-subtle",
      text: "رد کردن"
    });
    skipBtn.addEventListener("click", () => this.service.skip());

    // Presets
    const presets = root.createDiv({ cls: "ticktick-pomodoro-presets" });
    const p25 = presets.createEl("button", { cls: "ticktick-pomodoro-preset-btn", text: "۲۵ / ۵ استاندارد" });
    p25.addEventListener("click", () => this.service.setPreset(25, 5));

    const p50 = presets.createEl("button", { cls: "ticktick-pomodoro-preset-btn", text: "۵۰ / ۱۰ تمرکز عمیق" });
    p50.addEventListener("click", () => this.service.setPreset(50, 10));

    this.updateView();
  }

  private updateView() {
    const st = this.service.getState();

    // 1. Badge
    const badge = this.contentEl.querySelector<HTMLElement>(".ticktick-pomodoro-badge");
    if (badge) {
      badge.className = `ticktick-pomodoro-badge is-${st.mode}`;
      switch (st.mode) {
        case POMODORO_MODES.FOCUS:
          badge.setText(`🍅 تمرکز عمیق (${st.completedPomodoros + 1})`);
          break;
        case POMODORO_MODES.SHORT_BREAK:
          badge.setText("☕ استراحت کوتاه");
          break;
        case POMODORO_MODES.LONG_BREAK:
          badge.setText("🌴 استراحت طولانی");
          break;
        default:
          badge.setText("آماده شروع 🎯");
          break;
      }
    }

    // 2. Countdown Display
    const timerDisplay = this.contentEl.querySelector<HTMLElement>(".ticktick-pomodoro-timer-display");
    if (timerDisplay) {
      const mins = Math.floor(st.remainingSeconds / 60);
      const secs = st.remainingSeconds % 60;
      timerDisplay.setText(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`);
    }

    // 3. Progress Bar
    const progBar = this.contentEl.querySelector<HTMLElement>(".ticktick-pomodoro-progress-bar");
    if (progBar && st.totalSeconds > 0) {
      const pct = Math.max(0, Math.min(100, ((st.totalSeconds - st.remainingSeconds) / st.totalSeconds) * 100));
      progBar.style.width = `${pct}%`;
    }

    // 4. Main Button
    const mainBtn = this.contentEl.querySelector<HTMLElement>(".ticktick-pomodoro-btn-main");
    if (mainBtn) {
      if (st.isRunning) {
        mainBtn.setText("⏸ توقف موقت");
      } else if (st.remainingSeconds < st.totalSeconds && st.mode !== POMODORO_MODES.IDLE) {
        mainBtn.setText("▶ ادامه");
      } else {
        mainBtn.setText("▶ شروع تمرکز");
      }
    }
  }
}
