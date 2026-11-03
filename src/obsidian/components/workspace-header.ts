import { setIcon, WorkspaceLeaf, Notice } from "obsidian";
import {
  PROJECT_BOARD_VIEW_TYPE,
  PLANNER_VIEW_TYPE,
  EISENHOWER_MATRIX_VIEW_TYPE,
  TIMEBLOCK_PLANNER_VIEW_TYPE,
  TIMELINE_VIEW_TYPE,
  WEEKLY_REVIEW_VIEW_TYPE,
  HEATMAP_VIEW_TYPE
} from "../constants";
import type TickTickBridgePlugin from "../main";

export interface WorkspaceNavTab {
  id: string;
  label: string;
  icon: string;
  viewType: string;
}

export const WORKSPACE_NAV_TABS: WorkspaceNavTab[] = [
  { id: "board", label: "کانبان", icon: "kanban-square", viewType: PROJECT_BOARD_VIEW_TYPE },
  { id: "planner", label: "تقویم", icon: "calendar", viewType: PLANNER_VIEW_TYPE },
  { id: "matrix", label: "آیزنهاور", icon: "grid", viewType: EISENHOWER_MATRIX_VIEW_TYPE },
  { id: "timeblock", label: "زمان‌بندی", icon: "clock", viewType: TIMEBLOCK_PLANNER_VIEW_TYPE },
  { id: "timeline", label: "تایم‌لاین", icon: "calendar-range", viewType: TIMELINE_VIEW_TYPE },
  { id: "review", label: "مرور هفتگی", icon: "check-check", viewType: WEEKLY_REVIEW_VIEW_TYPE },
  { id: "heatmap", label: "نقشه فعالیت", icon: "flame", viewType: HEATMAP_VIEW_TYPE },
];

export interface WorkspaceHeaderOptions {
  plugin: TickTickBridgePlugin;
  leaf: WorkspaceLeaf;
  activeViewType: string;
  onQuickAdd?: () => void;
  onMorningBriefing?: () => void;
  onSync?: () => void;
}

export class WorkspaceHeader {
  private syncBtn?: HTMLElement;

  constructor(private container: HTMLElement, private options: WorkspaceHeaderOptions) {}

  render(): HTMLElement {
    this.container.empty();
    const header = this.container.createDiv({ cls: "ticktick-workspace-header" });

    // ── Tier 1: Top Bar (Brand & Global Actions) ──
    const topBar = header.createDiv({ cls: "ticktick-workspace-topbar" });

    // Brand
    const brand = topBar.createDiv({ cls: "ticktick-workspace-brand" });
    const logoEl = brand.createSpan({ cls: "ticktick-workspace-brand-logo" });
    setIcon(logoEl, "check-circle-2");
    const brandTitle = brand.createSpan({ cls: "ticktick-workspace-brand-title", text: "فضای کار تیک‌تیک" });
    brandTitle.setAttribute("title", "سیستم یکپارچه مدیریت کار و تمرکز TickTick Bridge");

    // Global Actions
    const actions = topBar.createDiv({ cls: "ticktick-workspace-actions" });

    // Quick Add Button
    const addBtn = actions.createEl("button", {
      cls: "tb-btn tb-btn-primary ticktick-workspace-quick-add",
      attr: { type: "button", "aria-label": "ثبت سریع تسک جدید (زبان طبیعی)" }
    });
    const addIcon = addBtn.createSpan();
    setIcon(addIcon, "plus");
    addBtn.createSpan({ text: "تسک جدید" });
    addBtn.addEventListener("click", () => {
      if (this.options.onQuickAdd) {
        this.options.onQuickAdd();
      } else {
        this.options.plugin.openQuickCaptureModal();
      }
    });

    // Morning Briefing Button
    const briefingBtn = actions.createEl("button", {
      cls: "tb-btn-icon",
      attr: { type: "button", "aria-label": "بریفینگ صبحگاهی و اهداف روزانه" }
    });
    setIcon(briefingBtn, "sun");
    briefingBtn.addEventListener("click", () => {
      if (this.options.onMorningBriefing) {
        this.options.onMorningBriefing();
      } else {
        this.options.plugin.openMorningBriefing();
      }
    });

    // Sync Now Button
    this.syncBtn = actions.createEl("button", {
      cls: "tb-btn-icon ticktick-workspace-sync-btn",
      attr: { type: "button", "aria-label": "همگام‌سازی سریع با تیک‌تیک" }
    });
    setIcon(this.syncBtn, "refresh-cw");
    this.syncBtn.addEventListener("click", async () => {
      if (this.syncBtn) {
        this.syncBtn.addClass("is-syncing");
        setIcon(this.syncBtn, "loader-circle");
      }
      try {
        if (this.options.onSync) {
          await this.options.onSync();
        } else {
          await this.options.plugin.syncNow();
        }
      } finally {
        if (this.syncBtn) {
          this.syncBtn.removeClass("is-syncing");
          setIcon(this.syncBtn, "refresh-cw");
        }
      }
    });

    // ── Tier 2: Dedicated Navigation Tab Bar ──
    const tabsBar = header.createDiv({ cls: "ticktick-workspace-tabs-bar" });
    const navWrapper = tabsBar.createDiv({ cls: "ticktick-workspace-nav-wrapper" });
    const segmentedControl = navWrapper.createDiv({ cls: "tb-segmented-control" });

    // Enable horizontal mouse wheel scrolling in Windows!
    tabsBar.addEventListener(
      "wheel",
      (e: WheelEvent) => {
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.deltaY !== 0) {
          e.preventDefault();
          const isRtl = window.getComputedStyle(navWrapper).direction === "rtl";
          const scrollAmount = isRtl ? -e.deltaY : e.deltaY;
          navWrapper.scrollBy({ left: scrollAmount, behavior: "auto" });
        }
      },
      { passive: false }
    );

    let activeTabEl: HTMLElement | null = null;

    for (const tab of WORKSPACE_NAV_TABS) {
      const isActive = tab.viewType === this.options.activeViewType;
      const tabBtn = segmentedControl.createEl("button", {
        cls: `tb-segment-item ${isActive ? "is-active" : ""}`,
        attr: {
          type: "button",
          "aria-label": `نمای ${tab.label}`,
          "aria-current": isActive ? "page" : "false"
        }
      });

      const iconSpan = tabBtn.createSpan({ cls: "tb-segment-icon" });
      setIcon(iconSpan, tab.icon);
      tabBtn.createSpan({ cls: "tb-segment-label", text: tab.label });

      if (isActive) {
        activeTabEl = tabBtn;
      } else {
        tabBtn.addEventListener("click", async (e) => {
          e.preventDefault();
          try {
            await this.options.leaf.setViewState({ type: tab.viewType, active: true });
          } catch (err) {
            new Notice(`خطا در باز کردن نمای ${tab.label}: ${String(err)}`);
          }
        });
      }
    }

    // Ensure active tab is visible in view without jumping the main window
    if (activeTabEl) {
      window.requestAnimationFrame(() => {
        try {
          const navRect = navWrapper.getBoundingClientRect();
          const tabRect = activeTabEl?.getBoundingClientRect();
          if (tabRect && navRect) {
            if (tabRect.left < navRect.left) {
              navWrapper.scrollBy({ left: tabRect.left - navRect.left - 16, behavior: "smooth" });
            } else if (tabRect.right > navRect.right) {
              navWrapper.scrollBy({ left: tabRect.right - navRect.right + 16, behavior: "smooth" });
            }
          }
        } catch {
          activeTabEl?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
        }
      });
    }

    return header;
  }
}

export function renderWorkspaceHeader(container: HTMLElement, options: WorkspaceHeaderOptions): WorkspaceHeader {
  const header = new WorkspaceHeader(container, options);
  header.render();
  return header;
}
