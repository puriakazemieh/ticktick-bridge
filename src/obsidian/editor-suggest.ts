import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  TFile
} from 'obsidian';
import type TickTickBridgePlugin from './main';
import type { TickTickTask } from './types';
import {
  extractSuggestQuery,
  searchTasksForSuggest,
  formatTaskMarkdownLink
} from '../core/editor-suggest-matcher.js';

export class TickTickEditorSuggest extends EditorSuggest<TickTickTask> {
  constructor(app: App, private plugin: TickTickBridgePlugin) {
    super(app);
  }

  onTrigger(cursor: EditorPosition, editor: Editor, _file: TFile | null): EditorSuggestTriggerInfo | null {
    const line = editor.getLine(cursor.line);
    const match = extractSuggestQuery(line, cursor.ch);
    if (!match) return null;

    return {
      start: { line: cursor.line, ch: match.startCh },
      end: { line: cursor.line, ch: match.endCh },
      query: match.query
    };
  }

  getSuggestions(context: EditorSuggestContext): TickTickTask[] {
    const tasks = this.plugin.getCacheTasks();
    const projectsMap: Record<string, string> = {};
    for (const p of this.plugin.getCacheProjects()) {
      projectsMap[p.id] = p.name;
    }

    return searchTasksForSuggest(tasks, context.query, {
      limit: 10,
      projectsMap
    }) as TickTickTask[];
  }

  renderSuggestion(task: TickTickTask, el: HTMLElement): void {
    el.empty();
    el.addClass('ticktick-suggest-item');
    el.setAttribute('dir', 'rtl');

    const mainRow = el.createDiv({ cls: 'suggest-main-row' });

    // Priority flag
    if (task.priority === 5) {
      mainRow.createSpan({ cls: 'suggest-prio-flag prio-high', text: '🚩' });
    } else if (task.priority === 3) {
      mainRow.createSpan({ cls: 'suggest-prio-flag prio-med', text: '🚩' });
    } else if (task.priority === 1) {
      mainRow.createSpan({ cls: 'suggest-prio-flag prio-low', text: '🚩' });
    }

    // Title
    const titleSpan = mainRow.createSpan({ cls: 'suggest-task-title', text: task.title || 'بدون عنوان' });

    // Meta chips
    const metaRow = el.createDiv({ cls: 'suggest-meta-row' });

    if (task.projectId) {
      const proj = this.plugin.getCacheProjects().find(p => p.id === task.projectId);
      if (proj) {
        metaRow.createSpan({ cls: 'suggest-chip chip-project', text: `📁 ${proj.name}` });
      }
    }

    if (task.dueDate) {
      const dueStr = task.dueDate.slice(0, 10);
      metaRow.createSpan({ cls: 'suggest-chip chip-due', text: `📅 ${dueStr}` });
    }

    if (Array.isArray(task.tags) && task.tags.length > 0) {
      for (const t of task.tags.slice(0, 3)) {
        metaRow.createSpan({ cls: 'suggest-chip chip-tag', text: `#${t}` });
      }
    }
  }

  selectSuggestion(task: TickTickTask, _evt: MouseEvent | KeyboardEvent): void {
    if (!this.context) return;
    const link = formatTaskMarkdownLink(task);
    this.context.editor.replaceRange(link, this.context.start, this.context.end);
  }
}
