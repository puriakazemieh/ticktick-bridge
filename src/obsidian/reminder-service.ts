import { Notice } from 'obsidian';
import type TickTickBridgePlugin from './main';
import { checkDueReminders, computeSnoozeMutation } from '../core/reminder-daemon.js';
import { todayInZone } from '../core/date.js';
import type { TickTickTask } from './types';

export class ReminderService {
  private timer: number | null = null;
  private acknowledgedIds = new Set<string>();

  constructor(private plugin: TickTickBridgePlugin) {}

  start() {
    this.stop();
    // Run initial check after 5 seconds, then every 30 seconds
    window.setTimeout(() => this.check(), 5000);
    this.timer = window.setInterval(() => this.check(), 30000);
  }

  stop() {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  check() {
    if (this.plugin.settings.enableDueReminders === false) {
      return;
    }

    const tasks = this.plugin.getCacheTasks();
    const timeZone = this.plugin.settings.timeZone || 'Asia/Tehran';
    const today = todayInZone(timeZone);

    const now = new Date();
    // Use target timezone to calculate current minutes of the day
    const timeParts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }).formatToParts(now);

    const hourPart = timeParts.find(p => p.type === 'hour')?.value ?? '0';
    const minPart = timeParts.find(p => p.type === 'minute')?.value ?? '0';
    const currentMinutes = parseInt(hourPart, 10) * 60 + parseInt(minPart, 10);

    const alerts = checkDueReminders(tasks, {
      today,
      currentMinutes,
      acknowledgedIds: this.acknowledgedIds,
      leadMinutes: this.plugin.settings.reminderLeadMinutes ?? 5,
      timeZone
    });

    for (const alert of alerts) {
      const task = alert.task as TickTickTask;
      this.acknowledgedIds.add(String(task.id));

      if (this.plugin.settings.enableReminderChime !== false) {
        this.playReminderChime();
      }

      this.showReminderNotice(task, alert.diffMinutes, today, currentMinutes);
    }
  }

  playReminderChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Tone 1: D5 (587.33 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.12, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Tone 2: A5 (880.00 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880.00, now + 0.12);
      gain2.gain.setValueAtTime(0.15, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.55);
    } catch {
      // AudioContext unavailable
    }
  }

  showReminderNotice(task: TickTickTask, diffMinutes: number, today: string, currentMinutes: number) {
    const notice = new Notice('', 20000);
    const el = notice.noticeEl;
    el.empty();
    el.addClass('ticktick-reminder-notice');
    el.setAttribute('dir', 'rtl');

    const titleEl = el.createDiv({ cls: 'reminder-notice-title' });
    titleEl.setText(`⏰ یادآوری سررسید: ${task.title || 'بدون عنوان'}`);

    const diffText = diffMinutes <= 0 ? 'هم‌اکنون' : `تا ${diffMinutes} دقیقه دیگر`;
    const metaEl = el.createDiv({ cls: 'reminder-notice-meta' });
    metaEl.setText(`موعد سررسید: ${diffText}`);

    const btnRow = el.createDiv({ cls: 'reminder-notice-buttons' });

    const completeBtn = btnRow.createEl('button', { text: '✅ انجام شد', cls: 'mod-cta' });
    completeBtn.onclick = async () => {
      notice.hide();
      await this.plugin.completeTask(task);
      new Notice(`تسک انجام شد: ${task.title}`);
    };

    const snoozeBtn = btnRow.createEl('button', { text: '💤 تعویق ۱۵ د' });
    snoozeBtn.onclick = async () => {
      notice.hide();
      const mutation = computeSnoozeMutation(task, today, currentMinutes, 15, this.plugin.settings.timeZone);
      await this.plugin.updateTask(mutation as Partial<TickTickTask>);
      new Notice(`تسک ۱۵ دقیقه به تعویق افتاد: ${task.title}`);
    };

    const dismissBtn = btnRow.createEl('button', { text: '✕' });
    dismissBtn.onclick = () => {
      notice.hide();
    };
  }
}
