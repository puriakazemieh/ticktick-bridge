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
    containerEl.addClass("ticktick-settings-container");

    // ══════════════════════════════════════════════════════════
    // وضعیت زنده اتصال و احراز هویت (Live Status Banner)
    // ══════════════════════════════════════════════════════════
    const banner = containerEl.createDiv({
      cls: `ticktick-settings-status-banner is-${this.plugin.authStatus}`
    });

    const bannerContent = banner.createDiv({ cls: "ticktick-settings-banner-content" });
    const bannerIcon = bannerContent.createDiv({ cls: "ticktick-settings-banner-icon" });
    const bannerText = bannerContent.createDiv({ cls: "ticktick-settings-banner-text" });
    const bannerTitle = bannerText.createDiv({ cls: "ticktick-settings-banner-title" });
    const bannerDesc = bannerText.createDiv({ cls: "ticktick-settings-banner-desc" });

    const cachedAt = this.plugin.cacheSnapshotTime();
    const projCount = this.plugin.cachedProjectsCount();
    const taskCount = this.plugin.cachedTasksCount();

    if (this.plugin.authStatus === "connected") {
      bannerIcon.setText("✅");
      bannerTitle.setText("اتصال به TickTick برقرار و فعال است");
      bannerDesc.setText(cachedAt
        ? `توکن رسمی معتبر است. آخرین همگام‌سازی: ${cachedAt} (${projCount} لیست، ${taskCount} تسک).`
        : "توکن رسمی تایید شد و داده‌ها آماده همگام‌سازی هستند.");
    } else if (this.plugin.authStatus === "needs_auth") {
      bannerIcon.setText("⚠️");
      bannerTitle.setText("نیاز به اتصال مجدد: خطای احراز هویت");
      bannerDesc.setText(this.plugin.lastAuthErrorMessage || "توکن دسترسی نامعتبر یا منقضی است. لطفاً API Token را در بخش زیر بررسی یا مجدداً وارد کنید.");
    } else {
      bannerIcon.setText("⚪");
      bannerTitle.setText("وضعیت اتصال: بررسی نشده");
      bannerDesc.setText("برای سنجش ارتباط با سرورهای TickTick روی دکمه «تست اتصال» کلیک کنید.");
    }

    const bannerActions = banner.createDiv({ cls: "ticktick-settings-banner-actions" });
    const testConnBtn = bannerActions.createEl("button", { text: "تست اتصال", cls: "mod-cta" });
    testConnBtn.addEventListener("click", async () => {
      testConnBtn.disabled = true;
      testConnBtn.setText("در حال بررسی...");
      try {
        const res = await this.plugin.testConnection();
        if (res.success) {
          new Notice(`✅ ${res.message}`);
        } else {
          new Notice(`❌ ${res.message}`);
        }
        this.display();
      } finally {
        testConnBtn.disabled = false;
        testConnBtn.setText("تست اتصال");
      }
    });

    // ══════════════════════════════════════════════════════════
    // ۱. احراز هویت و اتصال رسمی (Authentication)
    // ══════════════════════════════════════════════════════════
    new Setting(containerEl)
      .setName("🔑 احراز هویت و اتصال رسمی (TickTick Open API)")
      .setHeading();

    new Setting(containerEl)
      .setName("API Token (توکن اصلی و دائمی)")
      .setDesc("توکن شخصی رسمی TickTick؛ این توکن دائمی است، منقضی نمی‌شود و تمامی امکانات (پروژه‌ها، تسک‌ها، ستون‌های کانبان، زیرتسک‌ها، چک‌لیست‌ها و عادت‌ها) را به طور کامل پوشش می‌دهد.")
      .addText(input => {
        input.inputEl.type = "password";
        input.setValue(this.plugin.settings.apiToken).onChange(async value => {
          this.plugin.settings.apiToken = value.trim();
          await this.plugin.saveSettings();
        });
      })
      .addButton(button => button
        .setButtonText("بررسی و تایید توکن")
        .onClick(async () => {
          button.setDisabled(true);
          button.setButtonText("در حال بررسی...");
          try {
            const res = await this.plugin.testConnection();
            if (res.success) {
              new Notice(`✅ ${res.message}`);
            } else {
              new Notice(`❌ ${res.message}`);
            }
            this.display();
          } finally {
            button.setDisabled(false);
            button.setButtonText("بررسی و تایید توکن");
          }
        }));

    // زیربخش نشست وب (اختیاری)
    const webSubcard = containerEl.createDiv({ cls: "ticktick-settings-subcard" });
    const webTitle = webSubcard.createDiv({ cls: "ticktick-settings-subcard-title" });
    webTitle.createSpan({ text: "🌐 نشست وب (Web Session) — اختیاری" });
    const webDesc = webSubcard.createDiv({ cls: "ticktick-settings-subcard-desc" });
    webDesc.setText("توجه: این بخش اختیاری است و برای استفاده عادی نیازی به آن نیست، چرا که تمام امکانات توسط API Token بالا پشتیبانی می‌شوند.");

    new Setting(webSubcard)
      .setName("ورود مستقیم به حساب وب TickTick")
      .setDesc("مستقیماً با نام کاربری و رمز وارد TickTick می‌شود؛ اطلاعات ورود ذخیره نمی‌شوند.")
      .addButton(button => button
        .setButtonText("ورود به حساب وب")
        .onClick(async () => {
          const credentials = await new TickTickWebLoginModal(this.app).openAndWait();
          if (!credentials) return;
          button.setDisabled(true);
          try {
            await this.plugin.loginToTickTickWeb(credentials.username, credentials.password);
            new Notice("ورود به حساب وب TickTick با موفقیت انجام شد.");
            this.display();
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "ورود به حساب وب ناموفق بود.");
          } finally {
            button.setDisabled(false);
          }
        }));

    new Setting(webSubcard)
      .setName("انتقال اتصال از افزونه TickTickSync")
      .setDesc("در صورت نصب بودن افزونه قدیمی TickTickSync، نشست آن را وارد می‌کند.")
      .addButton(button => button
        .setButtonText("وارد کردن از TickTickSync")
        .onClick(async () => {
          button.setDisabled(true);
          try {
            const result = await this.plugin.importTickTickSyncSession();
            new Notice(result.hasCookie ? "اتصال TickTickSync وارد شد." : "اتصال وارد شد؛ در صورت خطا افزونه قدیمی را یک بار باز کن.");
            this.display();
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "وارد کردن اتصال ناموفق بود.");
          } finally {
            button.setDisabled(false);
          }
        }));

    new Setting(webSubcard)
      .setName("Cookie وب تکمیلی (دستی)")
      .setDesc("فقط در صورتی که ورود خودکار ممکن نباشد، کوکی وب TickTick را اینجا وارد کنید.")
      .addText(input => {
        input.inputEl.type = "password";
        input.inputEl.addClass("ticktick-input-cookie");
        input.setValue(this.plugin.settings.webSessionCookie).onChange(async value => {
          this.plugin.settings.webSessionCookie = normalizeWebSessionCookie(value);
          await this.plugin.saveSettings();
        });
      });

    new Setting(webSubcard)
      .setName("تست فید وب عادت‌ها")
      .setDesc("بررسی دریافت چک‌این‌های امروز از طریق سرویس وب TickTick.")
      .addButton(button => button
        .setButtonText("تست اتصال وب")
        .onClick(async () => {
          button.setDisabled(true);
          try {
            const habits = await this.plugin.client().listHabits();
            const checkins = await this.plugin.webHabitCheckins(habits.map((h: { id: string }) => h.id), todayInZone(this.plugin.settings.timeZone));
            if (!checkins) throw new Error("نشست وب منقضی شده یا پاسخی دریافت نشد.");
            const count = [...checkins.values()].flat().filter(e => e.status === 2).length;
            new Notice(`اتصال وب برقرار است: ${count} چک‌این امروز خوانده شد.`);
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "اتصال وب عادت‌ها ناموفق بود.");
          } finally {
            button.setDisabled(false);
          }
        }));

    // ══════════════════════════════════════════════════════════
    // ۲. همگام‌سازی و زمان‌بندی (Sync & Schedule)
    // ══════════════════════════════════════════════════════════
    new Setting(containerEl)
      .setName("🔄 همگام‌سازی و خودکارسازی (Sync & Schedule)")
      .setHeading();

    new Setting(containerEl)
      .setName("همگام‌سازی دستی")
      .setDesc(cachedAt
        ? `آخرین دریافت: ${cachedAt} — برای به‌روزرسانی فوری کل تسک‌ها، پروژه‌ها و عادت‌ها از سرور کلیک کنید.`
        : "هنوز نسخه محلی ساخته نشده است؛ روی همگام‌سازی الآن کلیک کنید.")
      .addButton(button => button
        .setButtonText("همگام‌سازی الآن")
        .setCta()
        .onClick(async () => {
          button.setDisabled(true);
          button.setButtonText("در حال دریافت...");
          try {
            await this.plugin.syncNow();
            this.display();
          } finally {
            button.setDisabled(false);
            button.setButtonText("همگام‌سازی الآن");
          }
        }));

    new Setting(containerEl)
      .setName("همگام‌سازی خودکار در پس‌زمینه")
      .setDesc("فاصله زمانی بررسی تغییرات بر حسب ثانیه (پیش‌فرض: ۳۰ ثانیه؛ عدد ۰ یعنی غیرفعال).")
      .addText(input => {
        input.inputEl.type = "number";
        input.inputEl.min = "0";
        input.setValue(String(this.plugin.settings.syncIntervalSeconds || this.plugin.settings.syncIntervalMinutes * 60))
          .onChange(async value => {
            const requested = Math.floor(Number(value) || 0);
            const seconds = requested > 0 ? Math.max(30, requested) : 0;
            this.plugin.settings.syncIntervalSeconds = seconds;
            this.plugin.settings.syncIntervalMinutes = 0;
            await this.plugin.saveSettings();
            this.plugin.configureAutomaticSync();
          });
      });

    new Setting(containerEl)
      .setName("مرکز مدیریت همگام‌سازی (Sync Control Center)")
      .setDesc("صفحه جامع برای مشاهده جزئیات همگام‌سازی، تاریخچه تغییرات، پیش‌نمایش و حل تعارض‌های آفلاین.")
      .addButton(button => button
        .setButtonText("باز کردن مرکز مدیریت")
        .onClick(() => void this.plugin.openControlPage("sync")));

    if (this.plugin.cacheConflictCount() > 0) {
      new Setting(containerEl)
        .setName("⚠️ تعارض‌های آفلاین نیازمند بررسی")
        .setDesc(`${this.plugin.cacheConflictCount()} تغییر آفلاین با نسخه جدیدتر سرور مغایرت دارد و برای جلوگیری از حذف داده نگه داشته شده است.`);
    }

    // ══════════════════════════════════════════════════════════
    // ۳. نماها و تنظیمات ظاهری (Views & Appearance)
    // ══════════════════════════════════════════════════════════
    new Setting(containerEl)
      .setName("🎨 نماها و ترجیحات ظاهری (Views & Appearance)")
      .setHeading();

    new Setting(containerEl)
      .setName("آیکون‌های نوار کناری (Sidebar Ribbon Icons)")
      .setDesc("نمایش آیکون‌های میانبر تسک‌ها، عادت‌ها و کانبان در نوار عمودی سمت چپ ابزیدین.")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showRibbonIcons)
        .onChange(async value => {
          this.plugin.settings.showRibbonIcons = value;
          await this.plugin.saveSettings();
          this.plugin.configureRibbonIcons();
        }));

    new Setting(containerEl)
      .setName("تقویم برنامه‌ریزی: نمایش تسک‌های تکمیل‌شده")
      .setDesc("در نماهای تقویم و تایم‌لاین، تسک‌های انجام‌شده نیز نمایش داده شوند (پیش‌فرض: شنبه اول هفته است).")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.plannerShowCompleted)
        .onChange(async value => {
          this.plugin.settings.plannerShowCompleted = value;
          await this.plugin.saveSettings();
        }));

    const savedViews = this.plugin.settings.savedViews || [];
    const savedSetting = new Setting(containerEl)
      .setName("نماهای فیلتر ذخیره‌شده (Saved Views)")
      .setDesc(`${savedViews.length} نمای سفارشی ذخیره شده است. این نماها ترکیب‌های فیلتر و جست‌وجوی شما در کانبان را نگهداری می‌کنند.`);
    if (savedViews.length > 0) {
      savedSetting.addButton(btn => btn
        .setButtonText("پاک‌سازی همه نماها")
        .setWarning()
        .onClick(async () => {
          this.plugin.settings.savedViews = [];
          await this.plugin.saveSettings();
          this.display();
          new Notice("همهٔ نماهای فیلتر ذخیره‌شده پاک شدند.");
        }));
    }

    new Setting(containerEl)
      .setName("منطقه زمانی (Time Zone)")
      .setDesc("منطقه زمانی برای تطابق تاریخ سررسید و تقویم شمسی.")
      .addText(input => input
        .setValue(this.plugin.settings.timeZone)
        .onChange(async value => {
          this.plugin.settings.timeZone = value.trim() || "Asia/Tehran";
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("پوشه یادداشت‌های روزانه (Daily Notes Folder)")
      .setDesc("مسیر پوشه یادداشت‌های روزانه جهت پیوند خودکار تسک‌ها و بلوک‌های عادت.")
      .addText(input => input
        .setValue(this.plugin.settings.dailyNoteFolder)
        .onChange(async value => {
          this.plugin.settings.dailyNoteFolder = value.trim();
          await this.plugin.saveSettings();
        }));

    // ══════════════════════════════════════════════════════════
    // ۴. یادآورها و زنگ هشدار (Reminders & Audio Alerts)
    // ══════════════════════════════════════════════════════════
    new Setting(containerEl)
      .setName("🔔 یادآورها و زنگ هشدار (Reminders & Alerts)")
      .setHeading();

    new Setting(containerEl)
      .setName("یادآورهای سررسید تسک‌ها (Due Reminders)")
      .setDesc("بررسی خودکار موعد سررسید تسک‌ها و نمایش نوتیفیکیشن با قابلیت انجام یا تعویق (Snooze).")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableDueReminders !== false)
        .onChange(async value => {
          this.plugin.settings.enableDueReminders = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("صدای زنگ هشدار (Audio Chime)")
      .setDesc("پخش صدای زنگ هنگام سررسید تسک یا پایان تایمر تمرکز پومودورو.")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableReminderChime !== false)
        .onChange(async value => {
          this.plugin.settings.enableReminderChime = value;
          await this.plugin.saveSettings();
        }))
      .addButton(btn => btn
        .setButtonText("تست صدای زنگ 🔔")
        .onClick(() => {
          this.plugin.reminderService?.playReminderChime();
          new Notice("صدای زنگ هشدار پخش شد 🔔");
        }));

    // ══════════════════════════════════════════════════════════
    // ۵. یکپارچه‌سازی یادداشت‌ها و Markdown (Notes & Markdown)
    // ══════════════════════════════════════════════════════════
    new Setting(containerEl)
      .setName("📝 یادداشت‌ها و فایل‌های Markdown (Markdown Integration)")
      .setHeading();

    new Setting(containerEl)
      .setName("تگ چک‌باکس TickTick")
      .setDesc("چک‌باکس‌های دارای این تگ در یادداشت‌ها ابتدا پیش‌نمایش شده و با اعمال به تسک TickTick متصل می‌شوند.")
      .addText(input => {
        input.setValue(this.plugin.settings.checkboxImportTag).onChange(async value => {
          this.plugin.settings.checkboxImportTag = value.trim().replace(/^#/, "") || "ticktick";
          await this.plugin.saveSettings();
        });
      })
      .addButton(button => button
        .setButtonText("پیش‌نمایش همهٔ یادداشت‌ها")
        .onClick(async () => {
          button.setDisabled(true);
          try {
            await this.plugin.importAllTaggedCheckboxes();
          } finally {
            button.setDisabled(false);
          }
        }))
      .addButton(button => button
        .setButtonText("اعمال پیش‌نمایش")
        .setCta()
        .onClick(async () => {
          button.setDisabled(true);
          try {
            await this.plugin.applyMarkdownSync();
          } finally {
            button.setDisabled(false);
          }
        }));

    new Setting(containerEl)
      .setName("انتقال TickTick Notes")
      .setDesc("فولدر ذخیره‌سازی نوت‌های TickTick در ابزیدین (بدون بازنویسی فایل‌های موجود).")
      .addText(input => input
        .setValue(this.plugin.settings.ticktickNotesFolder)
        .onChange(async value => {
          this.plugin.settings.ticktickNotesFolder = value.trim().replace(/^\/+|\/+$/g, "") || "TickTick Notes";
          await this.plugin.saveSettings();
        }))
      .addButton(button => button
        .setButtonText("انتخاب و انتقال Noteها")
        .onClick(() => void this.plugin.previewTickTickNotes()));

    // ══════════════════════════════════════════════════════════
    // ۶. پشتیبان‌گیری و ذخیره‌سازی محلی (Backups & Storage)
    // ══════════════════════════════════════════════════════════
    new Setting(containerEl)
      .setName("💾 پشتیبان‌گیری و گزارش‌ها (Backups & Storage)")
      .setHeading();

    new Setting(containerEl)
      .setName("فضای مدیریت‌شدهٔ پشتیبان")
      .setDesc(`پشتیبان‌ها به مدت ۱۰ روز تقویمی در مسیر /.ticktick/ نگهداری می‌شوند. آخرین گزارش: ${this.plugin.managedStorageReport()}`)
      .addButton(button => button
        .setButtonText("مشاهده آخرین گزارش")
        .onClick(async () => {
          button.setDisabled(true);
          try {
            new ManagedReportModal(this.app, await this.plugin.latestManagedReport()).open();
          } finally {
            button.setDisabled(false);
          }
        }));

    new Setting(containerEl)
      .setName("انتقال پشتیبان‌های قدیمی ریشه Vault")
      .setDesc("فایل‌های قدیمی ticktick-backup-*.csv در ریشه والت را به ساختار امن جدید منتقل می‌کند.")
      .addButton(button => button
        .setButtonText("انتقال پشتیبان‌های قدیمی")
        .onClick(async () => {
          button.setDisabled(true);
          try {
            const files = await this.plugin.previewLegacyRootBackups();
            const size = files.reduce((total, file) => total + file.size, 0);
            if (!files.length) {
              new Notice("پشتیبان قدیمی در ریشه والت یافت نشد.");
              return;
            }
            const confirmed = await new LegacyBackupMigrationModal(this.app, files.length, size).openAndWait();
            if (!confirmed) return;
            const result = await this.plugin.migrateLegacyRootBackups();
            new Notice(`${result.migrated.length} از ${result.sources.length} پشتیبان قدیمی منتقل شد.`);
            this.display();
          } finally {
            button.setDisabled(false);
          }
        }));

    // ══════════════════════════════════════════════════════════
    // ۷. قابلیت‌های پیشرفته و آزمایشی (Experimental)
    // ══════════════════════════════════════════════════════════
    new Setting(containerEl)
      .setName("🧪 قابلیت‌های پیشرفته و آزمایشی (Experimental)")
      .setHeading();

    new Setting(containerEl)
      .setName("نوشتن در ساختار زیرتسک‌ها و سلسله‌مراتب")
      .setDesc("هشدار: API رسمی TickTick برای ساخت زیرتسک به صورت آزمایشی است. در حالت پیش‌فرض نمایش زیرتسک‌ها فقط‌خواندنی است.")
      .addToggle(toggle => toggle
        .setValue(Boolean(this.plugin.settings.experimentalHierarchyWrites))
        .onChange(async value => {
          this.plugin.settings.experimentalHierarchyWrites = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName("قفل ویرایش چک‌لیست‌ها")
      .setDesc("برای حفظ یکپارچگی آیتم‌های چک‌لیست با سرور.")
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.experimentalChecklistReadOnly)
        .setDisabled(true));
  }
}
