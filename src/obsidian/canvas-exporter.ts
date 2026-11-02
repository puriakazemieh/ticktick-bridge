import { App, Modal, Notice, Setting, TFile } from 'obsidian';
import type TickTickBridgePlugin from './main';
import { generateCanvasFromTasks } from '../core/canvas-exporter.js';
import { todayInZone } from '../core/date.js';

export class CanvasExportModal extends Modal {
  private groupBy: 'projects' | 'eisenhower' | 'status' = 'projects';
  private fileName = 'TickTick Tasks Board.canvas';
  private includeCompleted = false;

  constructor(app: App, private plugin: TickTickBridgePlugin) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('ticktick-canvas-modal');
    contentEl.setAttribute('dir', 'rtl');

    contentEl.createEl('h2', { text: '🎨 خروجی گرفتن بوم بصری (Obsidian Canvas)' });

    contentEl.createEl('p', {
      text: 'تبدیل تسک‌های TickTick به کارت‌های تعاملی و متصل به هم در بوم بصری Obsidian.',
      cls: 'setting-item-description'
    });

    new Setting(contentEl)
      .setName('نحوه دسته‌بندی ستون‌ها')
      .setDesc('کارت‌ها در چه ستون‌ها یا کادرهایی قرار گیرند')
      .addDropdown(dd => {
        dd.addOption('projects', '📁 بر اساس پروژه‌ها (Projects)');
        dd.addOption('eisenhower', '🔥 بر اساس ماتریس آیزنهاور (Eisenhower Matrix)');
        dd.addOption('status', '⏳ بر اساس وضعیت (To Do / Done)');
        dd.setValue(this.groupBy);
        dd.onChange(val => {
          this.groupBy = val as 'projects' | 'eisenhower' | 'status';
        });
      });

    new Setting(contentEl)
      .setName('نام فایل بوم')
      .setDesc('مسیر فایل خروجی با پسوند .canvas')
      .addText(text => {
        text.setValue(this.fileName);
        text.onChange(val => {
          this.fileName = val.trim();
        });
      });

    new Setting(contentEl)
      .setName('شامل تسک‌های تکمیل‌شده')
      .setDesc('تسک‌های انجام‌شده نیز به بوم اضافه شوند')
      .addToggle(toggle => {
        toggle.setValue(this.includeCompleted);
        toggle.onChange(val => {
          this.includeCompleted = val;
        });
      });

    const footerEl = contentEl.createDiv({ cls: 'modal-button-container' });

    const exportBtn = footerEl.createEl('button', {
      text: '🎨 ایجاد و باز کردن Canvas',
      cls: 'mod-cta'
    });
    exportBtn.onclick = async () => {
      exportBtn.disabled = true;
      exportBtn.setText('در حال تولید بوم...');
      try {
        await this.performExport();
        this.close();
      } catch (err: any) {
        new Notice(`خطا در ایجاد Canvas: ${err.message}`);
        exportBtn.disabled = false;
        exportBtn.setText('🎨 ایجاد و باز کردن Canvas');
      }
    };

    const cancelBtn = footerEl.createEl('button', { text: 'انصراف' });
    cancelBtn.onclick = () => this.close();
  }

  private async performExport(): Promise<void> {
    const rawTasks = this.plugin.getCacheTasks();
    const tasks = this.includeCompleted
      ? rawTasks
      : rawTasks.filter(t => t.status === 0);

    const projectsMap: Record<string, string> = {};
    for (const p of this.plugin.getCacheProjects()) {
      projectsMap[p.id] = p.name;
    }

    const today = todayInZone(this.plugin.settings.timeZone);

    const canvasData = generateCanvasFromTasks(tasks, {
      groupBy: this.groupBy,
      projectsMap,
      today
    });

    const jsonText = JSON.stringify(canvasData, null, 2);

    let targetPath = this.fileName;
    if (!targetPath.endsWith('.canvas')) {
      targetPath += '.canvas';
    }

    let file = this.app.vault.getAbstractFileByPath(targetPath);
    if (file instanceof TFile) {
      await this.app.vault.modify(file, jsonText);
      new Notice(`بوم بصری ${targetPath} به‌روزرسانی شد.`);
    } else {
      file = await this.app.vault.create(targetPath, jsonText);
      new Notice(`بوم بصری ${targetPath} با موفقیت ایجاد شد.`);
    }

    // Open file in active workspace
    if (file instanceof TFile) {
      const leaf = this.app.workspace.getLeaf('tab');
      await leaf.openFile(file);
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}
