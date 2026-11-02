import { App, Modal, Notice } from 'obsidian';
import type TickTickBridgePlugin from '../main';
import {
  computeMorningBriefing,
  formatMorningBriefingMarkdown,
  injectBriefingIntoDailyNote
} from '../../core/morning-briefing.js';
import { todayInZone, gregorianDateKeyToJalali } from '../../core/date.js';
import type { TickTickTask, TickTickHabit } from '../types';

export class MorningBriefingModal extends Modal {
  constructor(app: App, private plugin: TickTickBridgePlugin) {
    super(app);
  }

  onOpen() {
    this.render();
  }

  onClose() {
    this.contentEl.empty();
  }

  render() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('ticktick-briefing-modal');
    contentEl.setAttribute('dir', 'rtl');

    const today = todayInZone(this.plugin.settings.timeZone);
    const jalaliDate = gregorianDateKeyToJalali(today) || today;
    const tasks = this.plugin.getCacheTasks();
    const habits = this.plugin.getCacheHabits();

    const briefing = computeMorningBriefing(tasks, habits, {
      today,
      timeZone: this.plugin.settings.timeZone
    });

    const overdueTasks = briefing.overdueTasks as TickTickTask[];
    const todayUntimedTasks = briefing.todayUntimedTasks as TickTickTask[];
    const todayHabits = briefing.todayHabits as TickTickHabit[];
    const todayTimedTasks = briefing.todayTimedTasks as Array<{ task: TickTickTask; timeLabel: string; startMinutes: number }>;

    // Header
    const headerEl = contentEl.createDiv({ cls: 'briefing-header' });
    headerEl.createEl('h2', { text: `🌅 پیشخوان مرور صبحگاهی (${jalaliDate})` });

    // Quote banner
    const quoteEl = contentEl.createDiv({ cls: 'briefing-quote-card' });
    quoteEl.createDiv({ cls: 'quote-icon', text: '💡' });
    quoteEl.createDiv({ cls: 'quote-text', text: briefing.motivationalQuote });

    // KPI Metrics row
    const kpiRow = contentEl.createDiv({ cls: 'briefing-kpi-row' });

    const createKpi = (label: string, value: number, tone: string) => {
      const card = kpiRow.createDiv({ cls: `briefing-kpi-card tone-${tone}` });
      card.createDiv({ cls: 'kpi-value', text: String(value) });
      card.createDiv({ cls: 'kpi-label', text: label });
    };

    createKpi('تسک‌های امروز', briefing.totalTodayTasksCount, 'blue');
    createKpi('تسک‌های معوقه', overdueTasks.length, overdueTasks.length > 0 ? 'red' : 'green');
    createKpi('عادت‌های امروز', todayHabits.length, 'purple');
    createKpi('موفقیت‌های دیروز', briefing.yesterdayCompletedCount, 'emerald');

    // Sections container
    const bodyEl = contentEl.createDiv({ cls: 'briefing-sections-body' });

    // 1. Overdue section
    if (overdueTasks.length > 0) {
      const overdueSec = bodyEl.createDiv({ cls: 'briefing-section section-overdue' });
      const secHeader = overdueSec.createDiv({ cls: 'section-header' });
      secHeader.createEl('h3', { text: `🚨 تسک‌های معوقه (${overdueTasks.length})` });

      const reschedBtn = secHeader.createEl('button', {
        text: '⚡ انتقال همه به امروز',
        cls: 'briefing-action-btn'
      });
      reschedBtn.onclick = async () => {
        reschedBtn.disabled = true;
        reschedBtn.setText('در حال انتقال...');
        try {
          const taskIds = overdueTasks.map(t => String(t.id));
          await this.plugin.executeBulkOperation(taskIds, 'schedule', { dueDate: today });
          new Notice(`${taskIds.length} تسک معوقه به امروز منتقل شدند.`);
          this.render();
        } catch (err: any) {
          new Notice(`خطا: ${err.message}`);
          reschedBtn.disabled = false;
          reschedBtn.setText('⚡ انتقال همه به امروز');
        }
      };

      const taskList = overdueSec.createDiv({ cls: 'briefing-task-list' });
      for (const t of overdueTasks.slice(0, 10)) {
        const item = taskList.createDiv({ cls: 'briefing-task-item is-overdue' });
        item.createSpan({ cls: 'task-title', text: t.title || 'بدون عنوان' });
        item.createSpan({ cls: 'task-meta', text: `📅 ${t.dueDate ? t.dueDate.slice(0, 10) : ''}` });
      }
    }

    // 2. Timed schedule
    if (todayTimedTasks.length > 0) {
      const timedSec = bodyEl.createDiv({ cls: 'briefing-section section-timed' });
      timedSec.createEl('h3', { text: '⏰ برنامه زمان‌بندی امروز' });
      const taskList = timedSec.createDiv({ cls: 'briefing-task-list' });
      for (const item of todayTimedTasks) {
        const row = taskList.createDiv({ cls: 'briefing-task-item' });
        row.createSpan({ cls: 'task-time-badge', text: item.timeLabel });
        row.createSpan({ cls: 'task-title', text: item.task.title || 'بدون عنوان' });
      }
    }

    // 3. Priorities
    if (todayUntimedTasks.length > 0) {
      const prioSec = bodyEl.createDiv({ cls: 'briefing-section section-priorities' });
      prioSec.createEl('h3', { text: '🎯 اولویت‌های امروز' });
      const taskList = prioSec.createDiv({ cls: 'briefing-task-list' });
      for (const t of todayUntimedTasks) {
        const row = taskList.createDiv({ cls: 'briefing-task-item' });
        const prioTag = t.priority === 5 ? '🚩 بالا' : t.priority === 3 ? '🚩 متوسط' : '🚩 عادی';
        row.createSpan({ cls: `task-prio-badge prio-${t.priority}`, text: prioTag });
        row.createSpan({ cls: 'task-title', text: t.title || 'بدون عنوان' });
      }
    }

    // 4. Habits
    if (todayHabits.length > 0) {
      const habitsSec = bodyEl.createDiv({ cls: 'briefing-section section-habits' });
      habitsSec.createEl('h3', { text: '🌿 عادت‌های امروز' });
      const habitsList = habitsSec.createDiv({ cls: 'briefing-task-list' });
      for (const h of todayHabits) {
        const row = habitsList.createDiv({ cls: 'briefing-task-item' });
        row.createSpan({ cls: 'habit-name', text: `• ${h.name || 'عادت'}` });
        if (h.goal) {
          row.createSpan({ cls: 'task-meta', text: `(هدف: ${h.goal} ${h.unit || ''})` });
        }
      }
    }

    // Footer actions
    const footerEl = contentEl.createDiv({ cls: 'briefing-modal-footer' });

    const logToDailyBtn = footerEl.createEl('button', {
      text: '📝 ثبت در دیلی‌نوت امروز',
      cls: 'mod-cta'
    });
    logToDailyBtn.onclick = async () => {
      const md = formatMorningBriefingMarkdown(briefing, { jalaliDateStr: jalaliDate });
      const success = await this.plugin.logMorningBriefingToDailyNote(md);
      if (success) {
        this.close();
      }
    };

    const closeBtn = footerEl.createEl('button', { text: 'بستن' });
    closeBtn.onclick = () => this.close();
  }
}
