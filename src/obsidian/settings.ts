import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { normalizeWebSessionCookie } from "../core/ticktick-web-habits.js";
import { todayInZone } from "../core/date.js";
import { TickTickWebLoginModal } from "./modals/web-login-modal";
import { LegacyBackupMigrationModal } from "./modals/legacy-backup-migration-modal";
import { ManagedReportModal } from "./modals/managed-report-modal";
import type TickTickBridgePlugin from "./main";

export class TickTickBridgeSettings extends PluginSettingTab {
  constructor(app: App, private plugin: TickTickBridgePlugin) {
    super(app, plugin);
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName("تنظیمات اتصال و همگام‌سازی").setHeading();
    const cachedAt = this.plugin.cacheSnapshotTime();
    new Setting(containerEl).setName("نسخهٔ محلی داده‌ها").setDesc(cachedAt
      ? `آخرین دریافت: ${cachedAt} — پنل‌ها ابتدا از این نسخهٔ سریع نمایش داده می‌شوند.`
      : "هنوز نسخهٔ محلی ساخته نشده است. یک‌بار «همگام‌سازی الآن» را بزن.");
    new Setting(containerEl).setName("مرکز سادهٔ همگام‌سازی").setDesc("یک صفحهٔ کامل برای sync عادی، preview/apply Markdown و حل تعارض‌ها.").addButton(button => button.setButtonText("باز کردن مرکز Sync").setCta().onClick(() => void this.plugin.openControlPage("sync")));
    if (this.plugin.cacheConflictCount()) new Setting(containerEl).setName("تداخل‌های نیازمند بررسی").setDesc(`${this.plugin.cacheConflictCount()} تغییر آفلاین در TickTick قابل اعمال نبود و برای جلوگیری از بازنویسی دادهٔ جدید، نگه داشته شده است.`);
    new Setting(containerEl).setName("فضای مدیریت‌شدهٔ TickTick").setDesc(`/.ticktick/ — نسخه‌های پشتیبان تا ۱۰ روز تقویمی UTC نگه داشته می‌شوند. آخرین گزارش: ${this.plugin.managedStorageReport()}`);
    new Setting(containerEl).setName("آخرین گزارش مدیریت‌شده").setDesc("آخرین گزارش غیرمحرمانهٔ عملیات ذخیره‌شده در .ticktick/reports/ را نمایش می‌دهد.").addButton(button => button
      .setButtonText("باز کردن گزارش آخر")
      .onClick(async () => {
        button.setDisabled(true);
        try { new ManagedReportModal(this.app, await this.plugin.latestManagedReport()).open(); }
        finally { button.setDisabled(false); }
      }));
    new Setting(containerEl).setName("انتقال پشتیبان‌های قدیمی ریشهٔ Vault").setDesc("فقط فایل‌های دقیق ticktick-backup-*.csv را پس از تأیید و بررسی طول بایت کپی می‌کند.").addButton(button => button
      .setButtonText("Move legacy root backups")
      .onClick(async () => {
        button.setDisabled(true);
        try {
          const files = await this.plugin.previewLegacyRootBackups();
          const size = files.reduce((total, file) => total + file.size, 0);
          if (!files.length) { new Notice("پشتیبان قدیمی در ریشهٔ Vault پیدا نشد."); return; }
          const confirmed = await new LegacyBackupMigrationModal(this.app, files.length, size).openAndWait();
          if (!confirmed) return;
          const result = await this.plugin.migrateLegacyRootBackups();
          new Notice(`${result.migrated.length} از ${result.sources.length} پشتیبان قدیمی منتقل شد.`);
          this.display();
        } finally { button.setDisabled(false); }
      }));
    new Setting(containerEl).setName("API Token").setDesc("توکن شخصی TickTick؛ فقط در تنظیمات افزونه نگهداری می‌شود.").addText(input => {
      input.inputEl.type = "password";
      input.setValue(this.plugin.settings.apiToken).onChange(async value => { this.plugin.settings.apiToken = value.trim(); await this.plugin.saveSettings(); });
    });
    new Setting(containerEl).setName("تگ چک‌باکس TickTick").setDesc("چک‌باکس‌های دارای این تگ ابتدا فقط پیش‌نمایش می‌شوند؛ سپس با فرمان اعمال، binding امن TickTick می‌گیرند.").addText(input => {
      input.setValue(this.plugin.settings.checkboxImportTag).onChange(async value => {
        this.plugin.settings.checkboxImportTag = value.trim().replace(/^#/, "") || "ticktick";
        await this.plugin.saveSettings();
      });
    }).addButton(button => button.setButtonText("پیش‌نمایش همهٔ یادداشت‌ها").onClick(async () => {
      button.setDisabled(true);
      try { await this.plugin.importAllTaggedCheckboxes(); } finally { button.setDisabled(false); }
    })).addButton(button => button.setButtonText("اعمال پیش‌نمایش").setCta().onClick(async () => {
      button.setDisabled(true);
      try { await this.plugin.applyMarkdownSync(); } finally { button.setDisabled(false); }
    }));
    new Setting(containerEl).setName("Checklist و Subtask آزمایشی").setDesc("فعلاً فقط خواندنی است؛ API رسمی برای ویرایش امن child item تأیید نشده و هیچ checkboxای در این بخش چیزی را تغییر نمی‌دهد.").addToggle(toggle => toggle.setValue(this.plugin.settings.experimentalChecklistReadOnly).setDisabled(true));
    new Setting(containerEl).setName("انتقال TickTick Notes").setDesc("فقط Noteهای دارای kind: NOTE را پس از انتخاب شما در فولدر قابل‌مشاهده وارد می‌کند؛ یک‌طرفه و بدون overwrite.").addText(input => input.setValue(this.plugin.settings.ticktickNotesFolder).onChange(async value => { this.plugin.settings.ticktickNotesFolder = value.trim().replace(/^\/+|\/+$/g, "") || "TickTick Notes"; await this.plugin.saveSettings(); })).addButton(button => button.setButtonText("انتخاب Noteها").onClick(() => void this.plugin.previewTickTickNotes()));
    new Setting(containerEl).setName("ورود مستقل برای عادت‌ها").setDesc("مستقیم وارد TickTick می‌شود و نشست لازم را در خود Bridge نگه می‌دارد. نام کاربری و رمز ذخیره نمی‌شوند.").addButton(button => button
      .setButtonText("ورود به TickTick")
      .setCta()
      .onClick(async () => {
        const credentials = await new TickTickWebLoginModal(this.app).openAndWait();
        if (!credentials) return;
        button.setDisabled(true);
        try {
          await this.plugin.loginToTickTickWeb(credentials.username, credentials.password);
          new Notice("ورود مستقل TickTick انجام شد. حالا اتصال عادت‌ها را بررسی یا همگام‌سازی کن.");
          this.display();
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "ورود به TickTick ناموفق بود.");
        } finally { button.setDisabled(false); }
      }));
    new Setting(containerEl).setName("اتصال آسان از TickTickSync").setDesc("نشست فعال TickTickSync را وارد می‌کند تا چک‌این عادت‌ها فوری و دقیق خوانده شوند. رمز عبور خوانده، نمایش داده یا ذخیره نمی‌شود.").addButton(button => button
      .setButtonText("وارد کردن اتصال TickTickSync")
      .setCta()
      .onClick(async () => {
        button.setDisabled(true);
        try {
          const result = await this.plugin.importTickTickSyncSession();
          new Notice(result.hasCookie ? "اتصال TickTickSync وارد شد." : "اتصال TickTickSync وارد شد؛ در صورت خطا یک‌بار افزونهٔ قدیمی را باز کن و دوباره امتحان کن.");
          this.display();
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "وارد کردن اتصال TickTickSync ناموفق بود.");
        } finally { button.setDisabled(false); }
      }));
    new Setting(containerEl).setName("Cookie تکمیلی وب (اختیاری)").setDesc("فقط اگر اتصال خودکار جواب نداد، Cookie نشست وب TickTick را اینجا وارد کن. این مقدار مانند رمز عبور است.").addText(input => {
      input.inputEl.type = "password";
      input.inputEl.addClass("ticktick-input-cookie");
      input.setValue(this.plugin.settings.webSessionCookie).onChange(async value => { this.plugin.settings.webSessionCookie = normalizeWebSessionCookie(value); await this.plugin.saveSettings(); });
    });
    new Setting(containerEl).setName("بررسی اتصال وب عادت‌ها").setDesc("چک‌این‌های امروز را مستقیماً از سرویس وب TickTick می‌خواند.").addButton(button => button
      .setButtonText("اتصال عادت‌ها را بررسی کن")
      .onClick(async () => {
        button.setDisabled(true);
        try {
          const habits = await this.plugin.client().listHabits();
          const checkins = await this.plugin.webHabitCheckins(habits.map((habit: { id: string }) => habit.id), todayInZone(this.plugin.settings.timeZone));
          if (!checkins) throw new Error("نشست وب معتبر نیست یا TickTick پاسخ نداد.");
          const count = [...checkins.values()].flat().filter(entry => entry.status === 2).length;
          new Notice(`اتصال وب برقرار است: ${count} چک‌این امروز خوانده شد.`);
        } catch (error) { new Notice(error instanceof Error ? error.message : "اتصال وب عادت‌ها ناموفق بود."); }
        finally { button.setDisabled(false); }
      }));
    new Setting(containerEl).setName("بررسی اتصال").setDesc("با توکن واردشده، پروژه‌ها و عادت‌ها را از TickTick می‌خواند.").addButton(button => button
      .setButtonText("اتصال را بررسی کن")
      .onClick(async () => {
        button.setDisabled(true);
        try {
          const client = this.plugin.client();
          const [projects, habits] = await Promise.all([client.listProjects(), client.listHabits()]);
          new Notice(`اتصال برقرار است: ${projects.length} پروژه و ${habits.length} عادت پیدا شد.`);
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "اتصال به TickTick ناموفق بود.");
        } finally {
          button.setDisabled(false);
        }
      }));
    new Setting(containerEl).setName("همگام‌سازی خودکار").setDesc("فاصلهٔ زمانی بر حسب ثانیه (پیش‌فرض و حداقل: ۳۰ ثانیه). صفر یعنی خاموش. sync بعدی فقط پس از پایان sync قبلی و گذشت این مدت آغاز می‌شود.").addText(input => {
      input.inputEl.type = "number";
      input.inputEl.min = "0";
      input.setValue(String(this.plugin.settings.syncIntervalSeconds || this.plugin.settings.syncIntervalMinutes * 60)).onChange(async value => {
        const requested = Math.floor(Number(value) || 0);
        const seconds = requested > 0 ? Math.max(30, requested) : 0;
        this.plugin.settings.syncIntervalSeconds = seconds;
        this.plugin.settings.syncIntervalMinutes = 0;
        await this.plugin.saveSettings();
        this.plugin.configureAutomaticSync();
      });
    });
    new Setting(containerEl).setName("همگام‌سازی دستی").setDesc("نسخهٔ محلی تسک‌ها، عادت‌ها و تاریخچهٔ ۹۰ روز اخیر را همین حالا از TickTick تازه می‌کند.").addButton(button => button
      .setButtonText("همگام‌سازی الآن")
      .onClick(async () => {
        button.setDisabled(true);
        try { await this.plugin.syncNow(); } finally { button.setDisabled(false); }
      }));
    new Setting(containerEl).setName("تقویم برنامه‌ریزی").setDesc("هفته و شبکهٔ ماه همیشه از شنبه شروع می‌شوند و تسک تکمیل‌شده به‌صورت پیش‌فرض پنهان است.").addToggle(toggle => toggle.setValue(this.plugin.settings.plannerShowCompleted).setTooltip("نمایش تسک‌های تکمیل‌شده در تقویم").onChange(async value => { this.plugin.settings.plannerShowCompleted = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("آیکون‌های اضافی نوار کناری").setDesc("آیکون همگام‌سازی همیشه نمایش داده می‌شود. با روشن‌کردن این گزینه، میانبر تسک‌ها و عادت‌ها هم نمایش داده می‌شوند.").addToggle(toggle => toggle
      .setValue(this.plugin.settings.showRibbonIcons)
      .onChange(async value => {
        this.plugin.settings.showRibbonIcons = value;
        await this.plugin.saveSettings();
        this.plugin.configureRibbonIcons();
      }));
    new Setting(containerEl).setName("Time zone").addText(input => input.setValue(this.plugin.settings.timeZone).onChange(async value => { this.plugin.settings.timeZone = value || "Asia/Tehran"; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName("Daily notes folder").addText(input => input.setValue(this.plugin.settings.dailyNoteFolder).onChange(async value => { this.plugin.settings.dailyNoteFolder = value; await this.plugin.saveSettings(); }));
  }
}
