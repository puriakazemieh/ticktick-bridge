import { setIcon } from "obsidian";
import { computeAnnualHeatmapData } from "../core/activity-heatmap.js";
import { todayInZone } from "../core/date.js";
import { formatPersianDate } from "../core/persian-date.js";
import type { TickTickTask, TickTickHabit, CachedHabitCheckin } from "./types";

export interface ActivityHeatmapHost {
  tasks: () => TickTickTask[];
  habits: () => TickTickHabit[];
  habitCheckins: () => Record<string, CachedHabitCheckin[]>;
  timeZone: string;
  refresh?: () => Promise<void>;
}

const PERSIAN_MONTH_NAMES: Record<string, string> = {
  "01": "فروردین",
  "02": "اردیبهشت",
  "03": "خرداد",
  "04": "تیر",
  "05": "مرداد",
  "06": "شهریور",
  "07": "مهر",
  "08": "آبان",
  "09": "آذر",
  "10": "دی",
  "11": "بهمن",
  "12": "اسفند"
};

const WEEKDAY_NAMES = ["ش", "ی", "د", "س", "چ", "پ", "ج"]; // Sat -> Fri

export class ActivityHeatmap {
  private tooltipEl: HTMLElement | null = null;

  constructor(private element: HTMLElement, private host: ActivityHeatmapHost) {
    this.element.addClass("ticktick-heatmap-root");
  }

  destroy() {
    this.removeTooltip();
    this.element.empty();
  }

  async render() {
    this.element.empty();
    this.removeTooltip();

    const today = todayInZone(this.host.timeZone);
    const tasks = this.host.tasks();
    const habits = this.host.habits();
    const checkins = this.host.habitCheckins();

    const data = computeAnnualHeatmapData(tasks, checkins, habits, {
      today,
      weeksCount: 52,
      timeZone: this.host.timeZone
    });

    // 1. Header Toolbar
    const header = this.element.createDiv({ cls: "ticktick-heatmap-header" });
    const titleGroup = header.createDiv({ cls: "ticktick-heatmap-title-group" });
    const title = titleGroup.createDiv({ cls: "ticktick-heatmap-title" });
    const iconSpan = title.createSpan();
    setIcon(iconSpan, "flame");
    title.createSpan({ text: "هیت‌مپ فعالیت و پیوستگی سالانه (Activity Heatmap)" });

    if (this.host.refresh) {
      const refreshBtn = header.createEl("button", {
        cls: "ticktick-matrix-btn",
        text: "بروزرسانی"
      });
      refreshBtn.addEventListener("click", async () => {
        refreshBtn.disabled = true;
        try {
          await this.host.refresh?.();
          await this.render();
        } finally {
          refreshBtn.disabled = false;
        }
      });
    }

    // 2. Summary KPI Cards
    const kpiGrid = this.element.createDiv({ cls: "ticktick-heatmap-kpi-grid" });

    this.renderKpi(kpiGrid, "🔥 پیوستگی جاری", `${data.summary.currentStreak} روز`);
    this.renderKpi(kpiGrid, "🏆 بهترین رکورد", `${data.summary.longestStreak} روز`);
    this.renderKpi(kpiGrid, "✅ تسک‌های تکمیل‌شده", String(data.summary.totalTasksCompleted));
    this.renderKpi(kpiGrid, "💎 عادت‌های ثبت‌شده", String(data.summary.totalHabitsCompleted));
    this.renderKpi(kpiGrid, "🎯 کل فعالیت‌ها", String(data.summary.totalActivities));

    // 3. Matrix Card
    const matrixCard = this.element.createDiv({ cls: "ticktick-heatmap-matrix-card" });
    const gridWrap = matrixCard.createDiv({ cls: "ticktick-heatmap-grid-wrap" });

    // Weekday Row Labels (Sat to Fri)
    const weekdaysCol = gridWrap.createDiv({ cls: "ticktick-heatmap-weekday-labels" });
    for (const name of WEEKDAY_NAMES) {
      weekdaysCol.createDiv({ cls: "ticktick-heatmap-weekday-label", text: name });
    }

    // Columns Container
    const colsContainer = gridWrap.createDiv({ cls: "ticktick-heatmap-columns-container" });

    // Month Labels Row
    const monthsRow = colsContainer.createDiv({ cls: "ticktick-heatmap-months-row" });
    for (const m of data.monthLabels) {
      const monthName = PERSIAN_MONTH_NAMES[m.monthCode] || m.monthCode;
      const monthPill = monthsRow.createSpan({ cls: "ticktick-heatmap-month-pill", text: monthName });
      // 15px per column (12px cell + 3px gap)
      monthPill.style.right = `${m.colIndex * 15}px`;
    }

    // Weeks Row (52 columns)
    const weeksRow = colsContainer.createDiv({ cls: "ticktick-heatmap-weeks-row" });

    for (const week of data.weeks) {
      const col = weeksRow.createDiv({ cls: "ticktick-heatmap-week-col" });
      col.dataset.weekIndex = String(week.weekIndex);

      for (const day of week.days) {
        const cell = col.createDiv({
          cls: `ticktick-heatmap-cell is-level-${day.level} ${day.isFuture ? "is-future" : ""}`
        });
        cell.dataset.date = day.dateKey;
        cell.dataset.jalali = day.jalaliKey;

        cell.addEventListener("mouseenter", e => {
          this.showTooltip(e, day);
        });

        cell.addEventListener("mouseleave", () => {
          this.removeTooltip();
        });
      }
    }

    // Legend
    const legend = matrixCard.createDiv({ cls: "ticktick-heatmap-legend" });
    legend.createSpan({ text: "کمتر" });
    const legendCells = legend.createDiv({ cls: "ticktick-heatmap-legend-cells" });
    for (let lvl = 0; lvl <= 4; lvl++) {
      legendCells.createDiv({ cls: `ticktick-heatmap-legend-cell is-level-${lvl}` });
    }
    legend.createSpan({ text: "بیشتر" });
  }

  private renderKpi(parent: HTMLElement, label: string, val: string) {
    const card = parent.createDiv({ cls: "ticktick-heatmap-kpi-card" });
    card.createDiv({ cls: "ticktick-heatmap-kpi-val", text: val });
    card.createDiv({ cls: "ticktick-heatmap-kpi-label", text: label });
  }

  private showTooltip(e: MouseEvent, day: any) {
    this.removeTooltip();

    const tooltip = document.body.createDiv({ cls: "ticktick-heatmap-tooltip" });
    this.tooltipEl = tooltip;

    const pDate = formatPersianDate(day.dateKey, this.host.timeZone);
    tooltip.createDiv({ cls: "ticktick-heatmap-tooltip-title", text: pDate });

    if (day.isFuture) {
      tooltip.createDiv({ text: "روز آینده" });
    } else if (day.score === 0) {
      tooltip.createDiv({ text: "بدون فعالیت ثبت‌شده" });
    } else {
      tooltip.createDiv({
        cls: "ticktick-heatmap-tooltip-score",
        text: `${day.score} فعالیت (${day.tasks.length} تسک، ${day.habits.length} عادت)`
      });

      const list = tooltip.createDiv({ cls: "ticktick-heatmap-tooltip-list" });
      for (const t of day.tasks.slice(0, 5)) {
        list.createDiv({ text: `✓ ${t}` });
      }
      if (day.tasks.length > 5) {
        list.createDiv({ text: `و ${day.tasks.length - 5} تسک دیگر…` });
      }

      for (const h of day.habits.slice(0, 5)) {
        list.createDiv({ text: `💎 ${h}` });
      }
    }

    // Position tooltip near cursor
    const x = e.clientX + 10;
    const y = e.clientY + 10;
    tooltip.style.left = `${Math.min(window.innerWidth - 250, x)}px`;
    tooltip.style.top = `${Math.min(window.innerHeight - 150, y)}px`;
  }

  private removeTooltip() {
    this.tooltipEl?.remove();
    this.tooltipEl = null;
  }
}
