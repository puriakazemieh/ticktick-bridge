import { App, MarkdownPostProcessorContext, Notice } from 'obsidian';
import { parseQueryBlockSpec, executeTaskQuery, QueryBlockSpec } from '../core/query-engine.js';
import { todayInZone } from '../core/date.js';
import { TaskDetailsModal } from './task-details-modal';
import type { TickTickTask, TickTickProject } from './types';

export interface QueryBlockHost {
  app: App;
  tasks: () => TickTickTask[];
  projects: () => TickTickProject[];
  timeZone: string;
  edit: (task: TickTickTask) => Promise<unknown> | void;
  load: (task: TickTickTask) => Promise<TickTickTask | undefined>;
  complete: (task: TickTickTask) => Promise<unknown>;
  updateTask?: (task: Partial<TickTickTask> & { id: string }) => Promise<unknown>;
}

export class QueryBlockRenderer {
  constructor(private host: QueryBlockHost) {}

  async render(source: string, el: HTMLElement, _ctx: MarkdownPostProcessorContext): Promise<void> {
    el.empty();
    el.addClass('ticktick-query-container');
    el.setAttribute('dir', 'rtl');

    const spec: QueryBlockSpec = parseQueryBlockSpec(source);
    const today = todayInZone(this.host.timeZone);
    const projectsMap: Record<string, string> = {};
    for (const p of this.host.projects()) {
      projectsMap[p.id] = p.name;
    }

    const tasks = this.host.tasks();
    const result = executeTaskQuery(tasks, spec, {
      today,
      timeZone: this.host.timeZone,
      projectsMap
    });

    const typedTasks = result.matchedTasks as TickTickTask[];

    // Header
    const headerEl = el.createDiv({ cls: 'ticktick-query-header' });
    const titleText = spec.title || 'فهرست تسک‌ها';
    const titleEl = headerEl.createDiv({ cls: 'ticktick-query-title' });
    titleEl.setText(titleText);

    const countEl = headerEl.createSpan({ cls: 'ticktick-query-count-badge' });
    countEl.setText(`${typedTasks.length} از ${result.totalCount}`);

    if (typedTasks.length === 0) {
      const emptyEl = el.createDiv({ cls: 'ticktick-query-empty' });
      emptyEl.setText('هیچ تسکی با فیلترهای مشخص‌شده یافت نشد.');
      return;
    }

    // List / Cards container
    const viewClass = spec.view === 'cards' 
      ? 'ticktick-query-cards' 
      : spec.view === 'compact' 
        ? 'ticktick-query-compact' 
        : 'ticktick-query-list';
    
    const listEl = el.createDiv({ cls: `ticktick-query-body ${viewClass}` });

    for (const task of typedTasks) {
      const itemEl = listEl.createDiv({ cls: 'ticktick-query-item' });
      if (task.priority === 5) itemEl.addClass('priority-high');
      else if (task.priority === 3) itemEl.addClass('priority-med');
      else if (task.priority === 1) itemEl.addClass('priority-low');

      // Checkbox
      const checkEl = itemEl.createEl('input', {
        type: 'checkbox',
        cls: 'task-list-item-checkbox ticktick-checkbox'
      });
      checkEl.checked = task.status !== 0;

      checkEl.addEventListener('change', async (e) => {
        e.stopPropagation();
        const markCompleted = checkEl.checked;
        try {
          if (markCompleted) {
            await this.host.complete(task);
            itemEl.addClass('is-completed');
            new Notice(`تسک انجام شد: ${task.title}`);
          } else {
            if (this.host.updateTask) {
              await this.host.updateTask({ id: task.id, status: 0 });
            }
            task.status = 0;
            itemEl.removeClass('is-completed');
            new Notice(`تسک مجدداً فعال شد: ${task.title}`);
          }
        } catch (err: any) {
          checkEl.checked = !markCompleted;
          new Notice(`خطا در تغییر وضعیت تسک: ${err.message}`);
        }
      });

      // Content info
      const contentEl = itemEl.createDiv({ cls: 'ticktick-query-item-content' });
      const titleSpan = contentEl.createSpan({ cls: 'ticktick-query-item-title' });
      titleSpan.setText(task.title || 'بدون عنوان');

      // Clicking title opens Task Details Modal
      titleSpan.addEventListener('click', () => {
        new TaskDetailsModal(this.host.app, task, {
          edit: async (t: TickTickTask) => { await this.host.edit(t); },
          load: async (t: TickTickTask) => {
            const loaded = await this.host.load(t);
            return loaded || t;
          },
          complete: async () => {
            await this.host.complete(task);
          },
          updateTask: this.host.updateTask ? (m) => this.host.updateTask!(m as any) : undefined,
          allTasks: () => this.host.tasks()
        }).open();
      });

      // Metadata chips row
      const metaRow = contentEl.createDiv({ cls: 'ticktick-query-item-meta' });

      // Project chip
      if (task.projectId && projectsMap[task.projectId]) {
        const projBadge = metaRow.createSpan({ cls: 'ticktick-query-chip chip-project' });
        projBadge.setText(`📁 ${projectsMap[task.projectId]}`);
      }

      // Priority indicator
      if (typeof task.priority === 'number' && task.priority > 0) {
        const prioBadge = metaRow.createSpan({ cls: 'ticktick-query-chip chip-priority' });
        const prioLabel = task.priority === 5 ? '🚩 بالا' : task.priority === 3 ? '🚩 متوسط' : '🚩 پایین';
        prioBadge.setText(prioLabel);
      }

      // Due date chip
      if (task.dueDate) {
        const dueBadge = metaRow.createSpan({ cls: 'ticktick-query-chip chip-due' });
        const dueStr = task.dueDate.slice(0, 10);
        const isOverdue = dueStr < today && task.status === 0;
        if (isOverdue) dueBadge.addClass('is-overdue');
        const dueLabel = dueStr === today ? 'امروز' : dueStr;
        dueBadge.setText(`📅 ${dueLabel}`);
      }

      // Tags
      if (Array.isArray(task.tags) && task.tags.length > 0) {
        for (const tag of task.tags) {
          const tagBadge = metaRow.createSpan({ cls: 'ticktick-query-chip chip-tag' });
          tagBadge.setText(`#${tag}`);
        }
      }
    }
  }
}
