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
      cls: "tb-btn tb-btn-primary ticktick-workspace-quick-add tb-action-add-task",
      attr: { type: "button", "aria-label": "افزودن تسک جدید", title: "افزودن تسک جدید (کلیک: مودال | راست‌کلیک: ثبت سریع زبان طبیعی)" }
    });
    const addIcon = addBtn.createSpan();
    setIcon(addIcon, "plus");
    addBtn.createSpan({ text: "+ تسک جدید" });
    addBtn.addEventListener("click", () => {
      if (this.options.onQuickAdd) {
        this.options.onQuickAdd();
      } else {
        void this.options.plugin.createTaskFromSurface();
      }
    });
    addBtn.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      this.options.plugin.openQuickCaptureModal();
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

    // ── Mobile Touch Drag & Gesture Shield (Prevents Obsidian Sidebar Swipe) ──
    let isTouchDragging = false;
    let touchStartX = 0;
    let touchStartY = 0;
    let isHorizontalSwipe = false;

    tabsBar.addEventListener(
      "touchstart",
      (e: TouchEvent) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        isTouchDragging = false;
        isHorizontalSwipe = false;
      },
      { passive: true }
    );

    tabsBar.addEventListener(
      "touchmove",
      (e: TouchEvent) => {
        if (e.touches.length !== 1) return;
        const touch = e.touches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;

        if (!isHorizontalSwipe && Math.abs(dx) > 4 && Math.abs(dx) > Math.abs(dy)) {
          isHorizontalSwipe = true;
        }

        if (isHorizontalSwipe) {
          // CRITICAL: Stop Obsidian's mobile drawer gesture from stealing horizontal tab scrolling!
          e.stopPropagation();
          if (Math.abs(dx) > 6) {
            isTouchDragging = true;
          }
        }
      },
      { passive: false }
    );

    const onTouchEnd = () => {
      if (isTouchDragging) {
        // Discard any synthesized click events on the tab buttons right after dragging
        setTimeout(() => {
          isTouchDragging = false;
          isHorizontalSwipe = false;
        }, 120);
      } else {
        isTouchDragging = false;
        isHorizontalSwipe = false;
      }
    };

    tabsBar.addEventListener("touchend", onTouchEnd, { passive: true });
    tabsBar.addEventListener("touchcancel", onTouchEnd, { passive: true });

    // ── Desktop Mouse Drag-To-Scroll (Windows/macOS) ──
    let isMouseDown = false;
    let mouseStartX = 0;
    let mouseStartScrollLeft = 0;
    let isMouseDragging = false;

    navWrapper.addEventListener("mousedown", (e: MouseEvent) => {
      if (e.button !== 0) return;
      isMouseDown = true;
      mouseStartX = e.clientX;
      mouseStartScrollLeft = navWrapper.scrollLeft;
      isMouseDragging = false;

      const onWindowMouseMove = (moveEv: MouseEvent) => {
        if (!isMouseDown) return;
        const dx = moveEv.clientX - mouseStartX;
        if (Math.abs(dx) > 5) {
          isMouseDragging = true;
          navWrapper.scrollLeft = mouseStartScrollLeft - dx;
        }
      };

      const onWindowMouseUp = () => {
        isMouseDown = false;
        window.removeEventListener("mousemove", onWindowMouseMove);
        window.removeEventListener("mouseup", onWindowMouseUp);
        if (isMouseDragging) {
          setTimeout(() => {
            isMouseDragging = false;
          }, 80);
        }
      };

      window.addEventListener("mousemove", onWindowMouseMove);
      window.addEventListener("mouseup", onWindowMouseUp);
    });

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
        tabBtn.addEventListener("click", (e) => {
          if (isTouchDragging || isMouseDragging) {
            e.preventDefault();
            e.stopPropagation();
          }
        });
      } else {
        tabBtn.addEventListener("click", async (e) => {
          if (isTouchDragging || isMouseDragging) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
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

    // Attach workspace-wide horizontal swipe containment to prevent Obsidian mobile drawer hijacking
    const viewRoot = this.container.closest<HTMLElement>(".ticktick-workspace-view-root") ?? this.container;
    attachHorizontalSwipeGuard(viewRoot);

    return header;
  }
}

/**
 * Attaches a gesture guard to a view root that prevents Obsidian Mobile's global
 * swipe-to-reveal drawer gesture from capturing horizontal scrolling inside
 * the plugin's horizontal scroll containers.
 */
export function attachHorizontalSwipeGuard(rootEl: HTMLElement): void {
  if (!rootEl || (rootEl as unknown as { _tbSwipeGuardAttached?: boolean })._tbSwipeGuardAttached) {
    return;
  }
  (rootEl as unknown as { _tbSwipeGuardAttached?: boolean })._tbSwipeGuardAttached = true;

  let startX = 0;
  let startY = 0;
  let isHorizontal = false;

  rootEl.addEventListener(
    "touchstart",
    (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isHorizontal = false;
    },
    { passive: true }
  );

  rootEl.addEventListener(
    "touchmove",
    (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (!isHorizontal && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
        isHorizontal = true;
      }

      if (isHorizontal) {
        const target = e.target as HTMLElement | null;
        const scrollableAncestor = target?.closest(
          ".ticktick-workspace-tabs-bar, .ticktick-workspace-nav-wrapper, .tb-segmented-control, .ticktick-project-columns, .ticktick-planner-days, .ticktick-planner-month, .ticktick-planner-days-scroll, .ticktick-planner-month-scroll, .overview-calendar, .ticktick-backlog-cards, .ticktick-timeblock-actions, .ticktick-timeblock-grid, .ticktick-activity-heatmap-scroll, .ticktick-review-horizontal-scroll, [data-horizontal-scroll]"
        );
        if (scrollableAncestor) {
          // Prevent Obsidian Mobile from opening the left/right drawer when user is scrolling content
          e.stopPropagation();
        }
      }
    },
    { passive: false }
  );

  const reset = () => {
    isHorizontal = false;
  };
  rootEl.addEventListener("touchend", reset, { passive: true });
  rootEl.addEventListener("touchcancel", reset, { passive: true });
}

export function renderWorkspaceHeader(container: HTMLElement, options: WorkspaceHeaderOptions): WorkspaceHeader {
  const header = new WorkspaceHeader(container, options);
  header.render();
  return header;
}
