import { App, Menu, Notice, setIcon } from "obsidian";
import { boardColumns, COMPLETED_BOARD_VIEW_ID, INBOX_BOARD_VIEW_ID, RECURRING_BOARD_VIEW_ID, SAVED_BOARD_VIEW_PREFIX, sidebarTree, TAG_BOARD_VIEW_PREFIX, virtualBoardData, virtualBoardEntries } from "../core/project-board.js";
import { TaskDetailsModal } from "./task-details-modal";
import { taskPriority } from "./task-priority";
import { ProjectEditorModal } from "./project-editor-modal";
import { CreateTagModal } from "./modals/create-tag-modal";
import { CreateSmartViewModal } from "./modals/create-smart-view-modal";
import { taskDescription } from "../core/task-description.js";
import { formatPersianDate } from "../core/persian-date.js";
import { sortPlanningTasks, shiftCalendarDay } from "../core/calendar-range.js";
import { todayInZone } from "../core/date.js";
import { enhanceHorizontalScroll, scrollToStart } from "./horizontal-scroll";
import { HabitDetailsModal } from "./planning-calendar";
import { renderUnifiedHabitCard } from "./habit-card";
import { FilterBar, type FilterBarHost } from "./filter-bar";
import { bulkSelectionStore } from "./selection-store";
import { BulkActionBar } from "./bulk-action-bar";
import { matchesTaskFilter } from "../core/task-filter.js";
import { formatTaskEstimate } from "../core/task-hierarchy.js";
import { cleanTaskTitle } from "./helpers";
import { renderTaskCard } from "./components/task-card-element";
import type { TickTickTask, TickTickProject, TickTickHabit, CachedHabitCheckin, ProjectBoardData, HabitHistoryEntry, SavedView, TaskFilterState, TaskDraft } from "./types";

const HABIT_BOARD_VIEW_ID = "ticktick:view:habits";

function habitGlyph(habit: Partial<TickTickHabit>) {
  const value = String(habit?.iconRes ?? habit?.icon ?? "").toLowerCase();
  if (/language|book|read|learn/.test(value)) return "📚";
  if (/sport|run|fitness|exercise/.test(value)) return "🏃";
  if (/meditat|mind|sleep/.test(value)) return "🧘";
  if (/water|drink/.test(value)) return "💧";
  if (/music|listen/.test(value)) return "🎵";
  if (/write|note/.test(value)) return "✍️";
  return "✓";
}

export type ProjectBoardHost = {
  app: App;
  projects: () => Promise<TickTickProject[]>;
  createProject: (project: Partial<TickTickProject>) => Promise<TickTickProject>;
  updateProject: (project: Partial<TickTickProject>) => Promise<unknown>;
  deleteProject: (projectId: string) => Promise<unknown>;
  createTask: (initial: Partial<TickTickTask>) => Promise<unknown>;
  updateTask?: (mutation: Partial<TickTickTask>) => Promise<unknown>;
  tasks: () => TickTickTask[];
  habits: () => TickTickHabit[];
  checkInHabit: (habit: TickTickHabit, day: string) => Promise<unknown>;
  habitHistory: (habitId: string, from: string, to: string) => HabitHistoryEntry[];
  setHabitProgress: (habit: TickTickHabit, day: string, value: number, goal: number) => Promise<unknown>;
  renderHabitBlock?: (element: HTMLElement, dashboard?: boolean, dayOverride?: string) => Promise<void>;
  firstWeekday: number;
  timeZone: string;
  board: (project: TickTickProject | undefined) => Promise<ProjectBoardData>;
  refresh: () => Promise<void>;
  complete: (task: TickTickTask) => Promise<unknown>;
  binding: (task: TickTickTask) => unknown;
  load: (task: TickTickTask) => Promise<TickTickTask | undefined>;
  edit: (task: TickTickTask) => Promise<unknown>;
  moveToColumn: (task: TickTickTask, columnId: string) => Promise<unknown>;
  showCompleted: () => boolean;
  preferences: () => { selected: string; collapsed: string[]; sidebarCollapsed?: boolean; sidebarPreferenceInitialized?: boolean; smartViewGrouping?: string };
  savePreferences: (value: { selected: string; collapsed: string[]; sidebarCollapsed: boolean; sidebarPreferenceInitialized?: boolean; smartViewGrouping?: string }) => Promise<void>;
  savedViews?: () => SavedView[];
  saveSavedViews?: (views: SavedView[]) => Promise<void>;
  executeBulkOperation?: (taskIds: string[], op: string, params: any) => Promise<any>;
};

export class ProjectBoard {
  private selected = "";
  private collapsed = new Set<string>();
  private initialized = false;
  private sortMode = "ticktick";
  private smartViewGrouping: "project" | "priority" | "date" | "tag" = "project";
  private sidebarCollapsed = false;
  private lastSelectedProject: string | null = null;
  private savedColumnsScrollLeft = 0;
  private savedBodyScrollTop = 0;
  private savedColumnScrolls = new Map<string, number>();
  private savedRailScrollTop = 0;
  private filterState: TaskFilterState = {
    projects: [],
    tags: [],
    statuses: [],
    priorities: [],
    dateRange: null,
    searchText: "",
    grouping: "none",
    sort: "ticktick"
  };
  private currentRawData: ProjectBoardData | null = null;
  private currentProject?: TickTickProject;
  private currentDisplayProject?: TickTickProject;
  private columnsContainer: HTMLElement | null = null;
  private headerBadgeEl: HTMLElement | null = null;
  private filterBarInstance: FilterBar | null = null;
  private bulkActionBar: BulkActionBar | null = null;
  private cachedProjects: TickTickProject[] = [];

  constructor(private element: HTMLElement, private host: ProjectBoardHost) {}

  async render() {
    if (!this.initialized) {
      const saved = this.host.preferences();
      this.selected = saved.selected;
      this.collapsed = new Set(saved.collapsed);
      this.sidebarCollapsed = saved.sidebarPreferenceInitialized ? Boolean(saved.sidebarCollapsed) : false;
      if (saved.smartViewGrouping && ["project", "priority", "date", "tag"].includes(saved.smartViewGrouping)) {
        this.smartViewGrouping = saved.smartViewGrouping as "project" | "priority" | "date" | "tag";
      }
      this.initialized = true;
      if (!saved.sidebarPreferenceInitialized) void this.host.savePreferences({ selected: this.selected, collapsed: [...this.collapsed], sidebarCollapsed: false, sidebarPreferenceInitialized: true, smartViewGrouping: this.smartViewGrouping });
    }

    const existingCols = this.element.querySelector<HTMLElement>(".ticktick-project-columns");
    if (existingCols && this.lastSelectedProject === this.selected) {
      this.savedColumnsScrollLeft = existingCols.scrollLeft;
    }
    const bodySlot = this.element.closest<HTMLElement>(".ticktick-workspace-body-slot") ?? this.element;
    if (bodySlot && this.lastSelectedProject === this.selected) {
      this.savedBodyScrollTop = bodySlot.scrollTop;
    }
    if (bodySlot && !(bodySlot as any)._ttbScrollTrackingAttached) {
      (bodySlot as any)._ttbScrollTrackingAttached = true;
      bodySlot.addEventListener("scroll", () => {
        if (this.lastSelectedProject === this.selected) {
          this.savedBodyScrollTop = bodySlot.scrollTop;
        }
      }, { passive: true });
    }
    const existingColEls = this.element.querySelectorAll<HTMLElement>(".ticktick-project-column");
    existingColEls.forEach(col => {
      const colId = col.dataset.columnId;
      const cards = col.querySelector<HTMLElement>(".ticktick-column-cards");
      if (colId) {
        const top = cards?.scrollTop || col.scrollTop || 0;
        if (top > 0) this.savedColumnScrolls.set(colId, top);
      }
    });

    const existingRailContent = this.element.querySelector<HTMLElement>(".ticktick-rail-content");
    if (existingRailContent) {
      this.savedRailScrollTop = existingRailContent.scrollTop;
    }

    this.element.empty();
    this.element.addClass("ticktick-project-board");
    const root = this.element.createDiv({ cls: "ticktick-project-board-root" });
    root.toggleClass("is-rail-collapsed", this.sidebarCollapsed);

    try {
      const projects = await this.host.projects();
      this.cachedProjects = projects;
      // The board opens focused on a real list.  "همهٔ لیست‌ها" was a
      // confusing synthetic board and is intentionally no longer shown.
      if (!this.selected || this.selected === "ticktick:view:all") this.selected = String(projects[0]?.id ?? INBOX_BOARD_VIEW_ID);

      // ── 1. Sidebar Rail ──
      if (!this.sidebarCollapsed) {
        this.renderSidebarRail(root, projects);
      }

      // ── 2. Main Board Area ──
      const main = root.createDiv({ cls: "ticktick-project-main" });

      if (this.selected === HABIT_BOARD_VIEW_ID) {
        await this.renderHabitBoard(main, projects);
        return;
      }

      const project = projects.find(item => String(item.id) === this.selected);
      const virtualData = virtualBoardData(this.selected, this.host.tasks(), projects, {
        grouping: this.smartViewGrouping,
        timeZone: this.host.timeZone,
        savedViews: this.host.savedViews ? this.host.savedViews() : [],
      });
      const displayProject = (virtualData?.project ?? project) as TickTickProject | undefined;
      if (!displayProject) {
        const emptyState = main.createDiv({ cls: "ticktick-board-empty" });
        const emptyIcon = emptyState.createSpan({ cls: "ticktick-empty-icon" });
        setIcon(emptyIcon, "folder-open");
        emptyState.createEl("h3", { text: "یک لیست را انتخاب کنید" });
        emptyState.createEl("p", { text: "برای مشاهده کارت‌ها، یکی از لیست‌های نوار کناری را انتخاب فرمایید." });
        return;
      }

      // Project Header Bar
      const projectHeader = main.createDiv({ cls: "ticktick-project-header" });

      // Leading Section: Navigation & Current Project Context
      const headerLead = projectHeader.createDiv({ cls: "ticktick-project-header-lead" });

      // Toggle Lists Sidebar Button (UI/UX Pro Max navigation anchor)
      const listsBtn = headerLead.createEl("button", {
        cls: `ticktick-lists-toggle-btn ${!this.sidebarCollapsed ? "is-active" : ""}`,
        attr: {
          type: "button",
          "aria-expanded": String(!this.sidebarCollapsed),
          "aria-label": !this.sidebarCollapsed ? "بستن منوی کناری لیست‌ها" : "مشاهده و باز کردن منوی کناری لیست‌ها",
          title: !this.sidebarCollapsed ? "بستن منوی کناری لیست‌ها" : "مشاهده و انتخاب لیست‌ها"
        }
      });
      const lIcon = listsBtn.createSpan({ cls: "ticktick-btn-icon" });
      setIcon(lIcon, "folders");
      listsBtn.createSpan({ cls: "ticktick-lists-btn-label", text: "لیست‌ها" });
      listsBtn.createSpan({ cls: "ticktick-lists-toggle-badge", text: String(projects.length) });
      listsBtn.addEventListener("click", () => {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        void this.persistAndRender();
      });

      headerLead.createDiv({ cls: "ticktick-header-separator" });

      const headerInfo = headerLead.createDiv({ cls: "ticktick-project-header-info" });
      if (displayProject.color) {
        const pDot = headerInfo.createSpan({ cls: "ticktick-header-dot" });
        pDot.style.setProperty("--project-color", displayProject.color);
      }
      headerInfo.createEl("h2", { cls: "ticktick-project-title", text: displayProject.name });
      const isCompletedView = displayProject.id === COMPLETED_BOARD_VIEW_ID;
      const countLabel = isCompletedView
        ? `${virtualData?.tasks.length ?? 0} تسک تکمیل‌شده`
        : `${virtualData ? virtualData.tasks.filter(task => Number(task.status ?? 0) === 0).length : project?.openCount ?? 0} تسک باز`;
      this.headerBadgeEl = headerInfo.createSpan({
        cls: "ticktick-project-badge",
        text: countLabel
      });

      // Grouping Menu Dropdown Pill (for smart views and virtual boards)
      if (displayProject.virtual) {
        const groupLabels: Record<string, string> = {
          project: "پروژه",
          priority: "اولویت",
          date: "تاریخ",
          tag: "برچسب",
        };
        const groupBtn = headerLead.createDiv({
          cls: "ticktick-filter-select-wrapper",
          attr: { role: "button", tabindex: "0", "aria-label": "ستون‌بندی کارت‌های نما" }
        });
        const groupIcon = groupBtn.createSpan({ cls: "ticktick-select-icon" });
        setIcon(groupIcon, "columns-3");
        groupBtn.createSpan({
          cls: "ticktick-filter-select-label",
          text: `ستون‌بندی: ${groupLabels[this.smartViewGrouping] ?? "پروژه"}`
        });
        const groupChevron = groupBtn.createSpan({ cls: "ticktick-select-chevron" });
        setIcon(groupChevron, "chevron-down");

        const openGroupMenu = (event: MouseEvent | KeyboardEvent) => {
          const menu = new Menu();
          for (const [value, label] of [["project", "بر اساس پروژه"], ["priority", "بر اساس اولویت"], ["date", "بر اساس تاریخ"], ["tag", "بر اساس برچسب"]]) {
            menu.addItem(item => {
              item.setTitle(label)
                  .setChecked(this.smartViewGrouping === value)
                  .onClick(() => {
                    this.smartViewGrouping = value as "project" | "priority" | "date" | "tag";
                    void this.persistAndRender();
                  });
            });
          }
          if (event instanceof MouseEvent) {
            menu.showAtMouseEvent(event);
          } else {
            const rect = groupBtn.getBoundingClientRect();
            menu.showAtPosition({ x: rect.right, y: rect.bottom });
          }
        };
        groupBtn.addEventListener("click", openGroupMenu);
        groupBtn.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openGroupMenu(event);
          }
        });
      }

      // ── Filter Bar (Unified inside header) ──
      const filterBarHost: FilterBarHost = {
        app: this.host.app,
        scope: "board",
        projects: () => projects.map(p => ({ id: String(p.id), name: p.name })),
        tags: () => this.availableTags(),
        savedViews: () => this.host.savedViews ? this.host.savedViews() : [],
        saveSavedViews: async (views: SavedView[]) => {
          if (this.host.saveSavedViews) await this.host.saveSavedViews(views);
        },
        filterState: () => this.filterState,
        onFilterChange: (nextState: TaskFilterState) => {
          this.applyFilter(nextState);
        },
        sortMode: () => this.sortMode,
        onSortChange: (val: string) => {
          this.sortMode = val;
          if (this.columnsContainer && this.currentRawData) {
            this.renderColumnsContainer(
              this.columnsContainer,
              this.currentRawData,
              this.currentProject,
              this.currentDisplayProject
            );
          } else {
            void this.render();
          }
        }
      };
      this.filterBarInstance = new FilterBar(projectHeader, filterBarHost);
      this.filterBarInstance.render();

      // ── 3. Kanban Columns ──
      const rawData = virtualData ?? await this.host.board(project!);
      if (!rawData) return;
      this.currentRawData = rawData;
      this.currentProject = project;
      this.currentDisplayProject = displayProject;

      const columns = main.createDiv({ cls: "ticktick-project-columns" });
      this.columnsContainer = columns;
      this.renderColumnsContainer(columns, rawData, project, displayProject);
      this.bulkActionBar ??= new BulkActionBar(main, {
        app: this.host.app,
        timeZone: this.host.timeZone,
        tasks: () => this.host.tasks(),
        projects: () => this.host.projects(),
        executeBulkOperation: async (ids, op, params) => this.host.executeBulkOperation ? this.host.executeBulkOperation(ids, op, params) : null,
        onChanged: async () => {
          await this.host.refresh();
          await this.render();
        }
      });
      void this.bulkActionBar.render();
    } catch (error) {
      root.createEl("p", { text: error instanceof Error ? error.message : "دادهٔ پروژه در دسترس نیست." });
    }
  }

  private applyFilter(nextState: TaskFilterState) {
    this.filterState = nextState;
    if (this.columnsContainer && this.currentRawData) {
      this.renderColumnsContainer(
        this.columnsContainer,
        this.currentRawData,
        this.currentProject,
        this.currentDisplayProject
      );
    } else {
      void this.render();
    }
  }

  private getInitialTaskForColumn(
    column: { id: string | number; name: string; synthetic?: boolean },
    project?: TickTickProject,
    currentTag?: string | null
  ): TaskDraft {
    const payload: TaskDraft = {};

    if (currentTag) {
      payload.tags = [currentTag];
    }

    if (project && !column.synthetic) {
      payload.projectId = project.id;
      payload.columnId = String(column.id);
      return payload;
    }

    if (project) {
      payload.projectId = project.id;
      return payload;
    }

    // Virtual board (Tag view, Smart view, Saved view)
    if (this.smartViewGrouping === "priority") {
      const prioMap: Record<string, number> = { "p-high": 5, "p-medium": 3, "p-low": 1, "p-none": 0 };
      if (String(column.id) in prioMap) {
        payload.priority = prioMap[String(column.id)];
      }
      if (this.cachedProjects.length > 0) {
        payload.projectId = this.cachedProjects[0].id;
      }
    } else if (this.smartViewGrouping === "date") {
      const today = todayInZone(this.host.timeZone);
      if (column.id === "d-today") payload.dueDate = today;
      else if (column.id === "d-tomorrow") payload.dueDate = shiftCalendarDay(today, 1);
      else if (column.id === "d-week") payload.dueDate = shiftCalendarDay(today, 3);
      if (this.cachedProjects.length > 0) {
        payload.projectId = this.cachedProjects[0].id;
      }
    } else if (this.smartViewGrouping === "tag") {
      const colTag = String(column.id).startsWith("t-") && column.id !== "t-none"
        ? decodeURIComponent(String(column.id).slice(2))
        : null;
      const combinedTags = [...new Set([currentTag, colTag].filter(Boolean) as string[])];
      if (combinedTags.length > 0) payload.tags = combinedTags;
      if (this.cachedProjects.length > 0) {
        payload.projectId = this.cachedProjects[0].id;
      }
    } else {
      // Default grouping: "project" (each column represents a project)
      const matchingProj = this.cachedProjects.find(p => String(p.id) === String(column.id));
      if (matchingProj) {
        payload.projectId = matchingProj.id;
      } else if (String(column.id).toLowerCase() === "inbox") {
        payload.projectId = "inbox";
      } else if (column.id && !String(column.id).startsWith("p-") && !String(column.id).startsWith("d-") && !String(column.id).startsWith("t-")) {
        payload.projectId = String(column.id);
      } else if (this.cachedProjects.length > 0) {
        payload.projectId = this.cachedProjects[0].id;
      }
    }

    return payload;
  }

  private renderColumnsContainer(
    columns: HTMLElement,
    rawData: ProjectBoardData,
    project?: TickTickProject,
    displayProject?: TickTickProject
  ) {
    if (this.lastSelectedProject === this.selected && columns.scrollLeft !== 0) {
      this.savedColumnsScrollLeft = columns.scrollLeft;
    }
    columns.empty();
    enhanceHorizontalScroll(columns);
    columns.addEventListener("scroll", () => {
      if (this.lastSelectedProject === this.selected) {
        this.savedColumnsScrollLeft = columns.scrollLeft;
      }
    }, { passive: true });

    const filteredTasks = rawData.tasks.filter(task =>
      matchesTaskFilter(task, this.filterState, { timeZone: this.host.timeZone })
    );
    const data = {
      ...rawData,
      tasks: filteredTasks
    };

    if (this.headerBadgeEl) {
      const isCompletedView = displayProject?.id === COMPLETED_BOARD_VIEW_ID;
      const countLabel = isCompletedView
        ? `${data.tasks.length} تسک تکمیل‌شده`
        : `${data.tasks.filter(task => Number(task.status ?? 0) === 0).length} تسک باز`;
      const isFiltered = Boolean(
        this.filterState.searchText ||
        (this.filterState.projects && this.filterState.projects.length) ||
        (this.filterState.tags && this.filterState.tags.length) ||
        (this.filterState.priorities && this.filterState.priorities.length) ||
        (this.filterState.statuses && this.filterState.statuses.length)
      );
      this.headerBadgeEl.setText(isFiltered ? `${countLabel} (فیلتر شده)` : countLabel);
    }

    const allKnownTasks = this.host.tasks();
    const taskMap = new Map<string, TickTickTask>();
    for (const t of allKnownTasks) {
      if (t?.id) taskMap.set(String(t.id), t);
    }
    for (const t of data.tasks) {
      if (t?.id) taskMap.set(String(t.id), t);
    }

    // Map parentId -> child subtasks
    const childrenMap = new Map<string, TickTickTask[]>();
    for (const t of data.tasks) {
      if (t?.parentId) {
        const pId = String(t.parentId);
        if (!childrenMap.has(pId)) childrenMap.set(pId, []);
        childrenMap.get(pId)!.push(t);
      }
    }

    const isTagView = String(this.selected).startsWith(TAG_BOARD_VIEW_PREFIX);
    const currentTag = isTagView
      ? decodeURIComponent(String(this.selected).slice(TAG_BOARD_VIEW_PREFIX.length))
      : null;
    const isCompletedView = displayProject?.id === COMPLETED_BOARD_VIEW_ID;

    for (const column of boardColumns(data, this.host.showCompleted())) {
      const shell = columns.createDiv({ cls: "ticktick-project-column" });
      shell.dataset.columnId = String(column.id);

      const colHeader = shell.createDiv({ cls: "ticktick-column-header" });
      colHeader.createEl("strong", { cls: "ticktick-column-name", text: column.name });
      colHeader.createSpan({ cls: "ticktick-column-count", text: String(column.count) });

      const movableColumn = Boolean(project) && !column.synthetic;
      const canAddToColumn = !isCompletedView && (movableColumn || isTagView || Boolean(displayProject?.virtual));
      if (canAddToColumn) {
        const addToColumn = colHeader.createEl("button", {
          cls: "ticktick-column-add mod-icon",
          attr: {
            type: "button",
            "aria-label": `افزودن تسک به ستون ${column.name}`,
            title: isTagView && currentTag ? `افزودن تسک با برچسب #${currentTag} به ${column.name}` : `افزودن تسک به این ستون`
          }
        });
        setIcon(addToColumn, "plus");
        addToColumn.addEventListener("click", async event => {
          event.stopPropagation();
          addToColumn.disabled = true;
          try {
            const initial = this.getInitialTaskForColumn(column, project, currentTag);
            const res = await this.host.createTask(initial);
            if (res) {
              new Notice(`تسک جدید به ستون «${column.name}» اضافه شد.`);
              await this.render();
            }
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "ساخت تسک ناموفق بود.");
          } finally {
            addToColumn.disabled = false;
          }
        });
      }

      const listWrap = shell.createDiv({ cls: "ticktick-column-cards" });
      listWrap.addEventListener("scroll", () => {
        if (this.lastSelectedProject === this.selected && listWrap.scrollTop > 0) {
          this.savedColumnScrolls.set(String(column.id), listWrap.scrollTop);
        }
      }, { passive: true });

      shell.addEventListener("dragover", event => {
        if (!movableColumn) return;
        event.preventDefault();
        event.dataTransfer!.dropEffect = "move";
        shell.addClass("is-drag-over");
      });
      shell.addEventListener("dragleave", event => {
        if (!shell.contains(event.relatedTarget as Node | null)) shell.removeClass("is-drag-over");
      });
      shell.addEventListener("drop", event => {
        event.preventDefault();
        shell.removeClass("is-drag-over");
        if (!movableColumn) {
          new Notice("این ستون نمایشی است و مقصد انتقال نیست.");
          return;
        }
        const id = event.dataTransfer?.getData("text/ticktick-board-task");
        const allTasks = this.currentRawData?.tasks ?? data.tasks;
        const task = allTasks.find((item: TickTickTask) => String(item.id) === id);
        if (!task) return;

        // If the dragged task was a subtask, dropping it on a column unnests it into a top-level task
        if (task.parentId) {
          void this.unparentTask(task, String(column.id));
          return;
        }

        if (String(task.columnId ?? "") === String(column.id)) return;
        const cardEl = this.element.querySelector<HTMLElement>(`[data-task-id="${task.id}"]`);
        const sourceCol = cardEl?.closest(".ticktick-project-column");
        const oldColumnId = task.columnId;
        if (cardEl && listWrap) {
          listWrap.appendChild(cardEl);
          const srcBadge = sourceCol?.querySelector(".ticktick-column-count");
          if (srcBadge) {
            const count = parseInt(srcBadge.textContent || "0", 10);
            if (count > 0) srcBadge.textContent = String(count - 1);
          }
          const tgtBadge = shell.querySelector(".ticktick-column-count");
          if (tgtBadge) {
            const count = parseInt(tgtBadge.textContent || "0", 10);
            tgtBadge.textContent = String(count + 1);
          }
        }
        task.columnId = String(column.id);
        void this.moveTask(task, String(column.id), cardEl, sourceCol, oldColumnId);
      });

      let colTaskCount = 0;
      for (const group of column.groups) {
        if (group.name) {
          listWrap.createEl("h4", { cls: "ticktick-group-heading", text: group.name });
        }
        for (const task of sortPlanningTasks(group.tasks, this.sortMode)) {
          // If this task is a subtask whose parent exists in the board, render it nested inside parent's card
          if (task.parentId && taskMap.has(String(task.parentId))) {
            continue;
          }
          colTaskCount++;
          const subtasks = childrenMap.get(String(task.id)) ?? [];
          this.card(listWrap, task, task.projectColor || displayProject?.color, Boolean(project), subtasks);
        }
      }

      if (colTaskCount === 0 && canAddToColumn) {
        const emptyCard = listWrap.createDiv({
          cls: "ticktick-column-empty-card",
          attr: {
            role: "button",
            tabindex: "0",
            "aria-label": `افزودن تسک به ستون ${column.name}`,
            title: isTagView && currentTag ? `افزودن تسک با برچسب #${currentTag} به ${column.name}` : `افزودن تسک به ستون ${column.name}`
          }
        });
        const plusIcon = emptyCard.createSpan({ cls: "ticktick-empty-plus" });
        setIcon(plusIcon, "plus");
        emptyCard.createSpan({
          text: isTagView && currentTag ? `+ افزودن تسک با #${currentTag}` : "افزودن تسک به این ستون"
        });
        const onEmptyAdd = async () => {
          try {
            const initial = this.getInitialTaskForColumn(column, project, currentTag);
            const res = await this.host.createTask(initial);
            if (res) await this.render();
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "ساخت تسک ناموفق بود.");
          }
        };
        emptyCard.addEventListener("click", onEmptyAdd);
        emptyCard.addEventListener("keydown", (event: KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            void onEmptyAdd();
          }
        });
      }
    }

    if (data.tasks.length === 0) {
      const emptyState = columns.createDiv({ cls: "ticktick-board-empty ticktick-smart-view-empty" });
      const emptyIcon = emptyState.createSpan({ cls: "ticktick-empty-icon" });
      setIcon(emptyIcon, "check-circle");
      emptyState.createEl("h3", { text: `هیچ تسکی در نمای «${displayProject?.name ?? ""}» نیست` });
      emptyState.createEl("p", { text: "همهٔ تسک‌ها انجام شده‌اند یا تسکی مطابق این نما یا فیلترهای انتخابی در کش محلی وجود ندارد." });
      if (isTagView && currentTag) {
        const addBtn = emptyState.createEl("button", {
          cls: "mod-cta ticktick-empty-add-btn",
          text: `+ افزودن اولین تسک با #${currentTag}`
        });
        addBtn.addEventListener("click", async () => {
          const initial: TaskDraft = { tags: [currentTag] };
          if (this.cachedProjects.length > 0) initial.projectId = this.cachedProjects[0].id;
          const res = await this.host.createTask(initial);
          if (res) await this.render();
        });
      }
    }

    const restoreScrolls = () => {
      if (this.lastSelectedProject === this.selected) {
        columns.scrollLeft = this.savedColumnsScrollLeft;
        if (this.savedBodyScrollTop !== 0) {
          const body = this.element.closest<HTMLElement>(".ticktick-workspace-body-slot") ?? this.element;
          if (body) body.scrollTop = this.savedBodyScrollTop;
        }
        if (this.savedColumnScrolls.size > 0) {
          for (const [colId, top] of this.savedColumnScrolls.entries()) {
            const col = columns.querySelector<HTMLElement>(`[data-column-id="${colId}"]`);
            const cards = col?.querySelector<HTMLElement>(".ticktick-column-cards");
            if (cards && top > 0) cards.scrollTop = top;
            else if (col && top > 0) col.scrollTop = top;
          }
        }
      } else {
        scrollToStart(columns);
      }
      this.lastSelectedProject = this.selected;
    };

    restoreScrolls();
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        restoreScrolls();
      });
    }
    setTimeout(() => {
      restoreScrolls();
    }, 40);
  }

  private async persistAndRender() {
    await this.host.savePreferences({ selected: this.selected, collapsed: [...this.collapsed], sidebarCollapsed: this.sidebarCollapsed, sidebarPreferenceInitialized: true, smartViewGrouping: this.smartViewGrouping });
    await this.render();
  }

  private async renderHabitBoard(main: HTMLElement, projects: TickTickProject[]) {
    const habits = this.host.habits();
    const header = main.createDiv({ cls: "ticktick-project-header" });

    // Leading Section: Navigation & Habit Board Title
    const headerLead = header.createDiv({ cls: "ticktick-project-header-lead" });
    const listsBtn = headerLead.createEl("button", {
      cls: `ticktick-lists-toggle-btn ${!this.sidebarCollapsed ? "is-active" : ""}`,
      attr: {
        type: "button",
        "aria-expanded": String(!this.sidebarCollapsed),
        "aria-label": !this.sidebarCollapsed ? "بستن منوی کناری لیست‌ها" : "مشاهده و باز کردن منوی کناری لیست‌ها",
        title: !this.sidebarCollapsed ? "بستن منوی کناری لیست‌ها" : "مشاهده و انتخاب لیست‌ها"
      }
    });
    const lIcon = listsBtn.createSpan({ cls: "ticktick-btn-icon" });
    setIcon(lIcon, "folders");
    listsBtn.createSpan({ cls: "ticktick-lists-btn-label", text: "لیست‌ها" });
    listsBtn.createSpan({ cls: "ticktick-lists-toggle-badge", text: String(projects.length) });
    listsBtn.addEventListener("click", () => {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      void this.persistAndRender();
    });

    headerLead.createDiv({ cls: "ticktick-header-separator" });

    const info = headerLead.createDiv({ cls: "ticktick-project-header-info" });
    info.createEl("h2", { cls: "ticktick-project-title", text: "عادت‌ها" });
    info.createSpan({ cls: "ticktick-project-badge", text: `${habits.length} عادت` });

    // Trailing Section: Header Actions (Refresh)
    const headerActions = header.createDiv({ cls: "ticktick-project-header-actions" });
    const refreshBtn = headerActions.createEl("button", {
      cls: "ticktick-board-refresh-btn",
      text: "به‌روزرسانی",
      attr: {
        type: "button",
        "aria-label": "همگام‌سازی و به‌روزرسانی عادت‌ها",
        title: "همگام‌سازی و به‌روزرسانی عادت‌ها"
      }
    });
    const rIcon = refreshBtn.createSpan({ cls: "ticktick-btn-icon" });
    setIcon(rIcon, "refresh-cw");
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      try {
        await this.host.refresh();
        await this.render();
      } finally {
        refreshBtn.disabled = false;
      }
    });

    const boardBody = main.createDiv({ cls: "ticktick-habit-board-body" });
    if (this.host.renderHabitBlock) {
      await this.host.renderHabitBlock(boardBody, true);
      return;
    }

    const cards = boardBody.createDiv({ cls: "ticktick-habit-board-cards" });
    if (!habits.length) { cards.createDiv({ cls: "ticktick-board-empty", text: "عادتی در کش محلی نیست؛ یک بار همگام‌سازی کنید." }); return; }
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: this.host.timeZone }).format(new Date());

    for (const habit of habits) {
      const goal = Math.max(1, Number(habit.goal ?? habit.target ?? 1));
      const entry = (this.host.habitHistory(String(habit.id), today, today)[0] ?? {});
      const value = Number(entry.value ?? 0);
      const completed = entry.completed || value >= goal;
      const habitWithCheckin: TickTickHabit = {
        ...habit,
        checkin: {
          value,
          goal,
          status: completed ? 2 : 0,
          ...habit.checkin
        }
      };
      renderUnifiedHabitCard(cards, {
        habit: habitWithCheckin,
        day: today,
        variant: "board",
        onCheckIn: async (h, d) => {
          await this.host.checkInHabit(h, d);
          await this.render();
        },
        onOpenDetails: (h, d) => {
          new HabitDetailsModal(this.host.app, habit, {
            firstWeekday: this.host.firstWeekday,
            habits: day => this.host.habits().filter(item => String(item.id) === String(habit.id) || false),
            habitHistory: this.host.habitHistory,
            setHabitProgress: this.host.setHabitProgress,
          }, d).open();
        }
      });
    }
  }

  private availableTags(): string[] {
    const set = new Set<string>();
    for (const t of this.host.tasks()) {
      for (const tag of (Array.isArray(t.tags) ? t.tags : [])) {
        const clean = String(tag ?? "").trim().replace(/^[#＃]/, "");
        if (clean) set.add(clean);
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, "fa"));
  }

  private renderSidebarRail(parent: HTMLElement, projects: TickTickProject[]) {
    const rail = parent.createDiv({ cls: "ticktick-project-rail" });

    const railHeader = rail.createDiv({ cls: "ticktick-rail-header" });
    const titleWrap = railHeader.createDiv({ cls: "ticktick-rail-title" });
    const headerIcon = titleWrap.createSpan({ cls: "ticktick-rail-icon" });
    setIcon(headerIcon, "folders");
    titleWrap.createSpan({ text: "پروژه‌ها و لیست‌ها" });
    titleWrap.createSpan({ cls: "ticktick-rail-counter", text: `${projects.length} لیست` });

    const headerActions = railHeader.createDiv({ cls: "ticktick-rail-actions" });
    const collapseBtn = headerActions.createEl("button", {
      cls: "ticktick-rail-collapse-btn mod-icon",
      attr: { type: "button", "aria-label": "بستن منوی لیست‌ها", title: "بستن منوی کناری لیست‌ها" }
    });
    setIcon(collapseBtn, "panel-right-close");
    collapseBtn.addEventListener("click", () => {
      this.sidebarCollapsed = true;
      void this.persistAndRender();
    });

    const railBody = rail.createDiv({ cls: "ticktick-rail-content" });
    railBody.addEventListener("scroll", () => {
      this.savedRailScrollTop = railBody.scrollTop;
    }, { passive: true });

    const virtual = virtualBoardEntries(this.host.tasks(), {
      timeZone: this.host.timeZone,
      savedViews: this.host.savedViews ? this.host.savedViews() : []
    });
    const habits = railBody.createDiv({
      cls: `ticktick-project-row ${this.selected === HABIT_BOARD_VIEW_ID ? "is-selected" : ""}`,
      attr: { role: "button", tabindex: "0", "aria-label": `عادت‌ها، ${this.host.habits().length} عادت` }
    });
    const habitsLead = habits.createDiv({ cls: "ticktick-project-row-lead" });
    const habitsIcon = habitsLead.createSpan({ cls: "ticktick-project-row-icon" });
    setIcon(habitsIcon, "activity");
    habitsLead.createSpan({ cls: "ticktick-project-name", text: "عادت‌ها" });

    const habitsTrailing = habits.createDiv({ cls: "ticktick-project-row-trailing" });
    habitsTrailing.createSpan({ cls: "ticktick-project-count", text: String(this.host.habits().length) });
    habits.addEventListener("click", () => {
      this.selected = HABIT_BOARD_VIEW_ID;
      this.savedColumnsScrollLeft = 0;
      this.savedBodyScrollTop = 0;
      this.savedColumnScrolls.clear();
      void this.persistAndRender();
    });
    habits.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.selected = HABIT_BOARD_VIEW_ID;
        void this.persistAndRender();
      }
    });

    // ─── Smart Views Section ───
    const isSmartCollapsed = this.collapsed.has("smart-views") || this.collapsed.has("virtual-views");
    const smartGroupRow = railBody.createDiv({ cls: "ticktick-group-header-row" });
    const smartHeading = smartGroupRow.createEl("button", {
      cls: `ticktick-project-group ${isSmartCollapsed ? "is-collapsed" : ""}`,
      attr: { type: "button" }
    });
    const smartChevron = smartHeading.createSpan({ cls: "ticktick-group-chevron" });
    setIcon(smartChevron, isSmartCollapsed ? "chevron-left" : "chevron-down");
    smartHeading.createSpan({ cls: "ticktick-group-title", text: "نماهای هوشمند" });
    smartHeading.addEventListener("click", () => {
      if (isSmartCollapsed) {
        this.collapsed.delete("smart-views");
        this.collapsed.delete("virtual-views");
      } else {
        this.collapsed.add("smart-views");
        this.collapsed.add("virtual-views");
      }
      void this.persistAndRender();
    });

    const addSmartViewBtn = smartGroupRow.createEl("button", {
      cls: "ticktick-group-add-btn mod-icon",
      attr: { type: "button", "aria-label": "افزودن نمای هوشمند جدید", title: "افزودن نمای هوشمند جدید" }
    });
    setIcon(addSmartViewBtn, "plus");
    addSmartViewBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      new CreateSmartViewModal(this.host.app, {
        projects,
        tags: this.availableTags(),
        onSave: async (newView) => {
          const currentSavedViews = this.host.savedViews ? this.host.savedViews() : [];
          if (this.host.saveSavedViews) {
            await this.host.saveSavedViews([...currentSavedViews, newView]);
          }
          this.selected = `${SAVED_BOARD_VIEW_PREFIX}${newView.id}`;
          this.collapsed.delete("smart-views");
          this.collapsed.delete("virtual-views");
          this.savedColumnsScrollLeft = 0;
          this.savedBodyScrollTop = 0;
          this.savedColumnScrolls.clear();
          await this.persistAndRender();
          new Notice(`نمای هوشمند «${newView.name}» ایجاد و ذخیره شد.`);
        }
      }).open();
    });

    if (!isSmartCollapsed) {
      for (const view of virtual.smartViews) {
        const row = railBody.createDiv({
          cls: `ticktick-project-row ${this.selected === view.id ? "is-selected" : ""}`,
          attr: { role: "button", tabindex: "0", "aria-label": `${view.name}، ${view.count} تسک` }
        });
        const lead = row.createDiv({ cls: "ticktick-project-row-lead" });
        const rowIcon = lead.createSpan({ cls: "ticktick-project-row-icon" });
        setIcon(rowIcon, view.icon);
        lead.createSpan({ cls: "ticktick-project-name", text: view.name });

        const trailing = row.createDiv({ cls: "ticktick-project-row-trailing" });
        trailing.createSpan({ cls: "ticktick-project-count", text: String(view.count) });
        row.addEventListener("click", () => {
          this.selected = view.id;
          this.savedColumnsScrollLeft = 0;
          this.savedBodyScrollTop = 0;
          this.savedColumnScrolls.clear();
          void this.persistAndRender();
        });
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.selected = view.id;
            void this.persistAndRender();
          }
        });
      }

      for (const view of (virtual.savedViews ?? [])) {
        const row = railBody.createDiv({
          cls: `ticktick-project-row ticktick-saved-view-row ${this.selected === view.id ? "is-selected" : ""}`,
          attr: { role: "button", tabindex: "0", "aria-label": `نمای هوشمند ${view.name}، ${view.count} تسک` }
        });
        const lead = row.createDiv({ cls: "ticktick-project-row-lead" });
        const rowIcon = lead.createSpan({ cls: "ticktick-project-row-icon" });
        setIcon(rowIcon, "bookmark");
        lead.createSpan({ cls: "ticktick-project-name", text: view.name });

        const trailing = row.createDiv({ cls: "ticktick-project-row-trailing" });
        trailing.createSpan({ cls: "ticktick-project-count", text: String(view.count) });

        const deleteSavedView = async () => {
          const currentSavedViews = this.host.savedViews ? this.host.savedViews() : [];
          const next = currentSavedViews.filter(v => v.id !== view.viewId);
          if (this.host.saveSavedViews) await this.host.saveSavedViews(next);
          if (this.selected === view.id) {
            this.selected = String(projects[0]?.id ?? INBOX_BOARD_VIEW_ID);
          }
          await this.persistAndRender();
          new Notice(`نمای «${view.name}» حذف شد.`);
        };

        const menuBtn = trailing.createEl("button", {
          cls: "ticktick-project-row-menu-btn mod-icon",
          attr: { type: "button", "aria-label": `حذف نمای ${view.name}`, title: "حذف نما" }
        });
        setIcon(menuBtn, "trash-2");
        menuBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          void deleteSavedView();
        });

        row.addEventListener("click", () => {
          this.selected = view.id;
          this.savedColumnsScrollLeft = 0;
          this.savedBodyScrollTop = 0;
          this.savedColumnScrolls.clear();
          void this.persistAndRender();
        });
        row.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          const menu = new Menu();
          menu.addItem(item => {
            item.setTitle(`حذف نمای «${view.name}»`)
              .setIcon("trash-2")
              .onClick(() => void deleteSavedView());
          });
          menu.showAtMouseEvent(e);
        });
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.selected = view.id;
            void this.persistAndRender();
          }
        });
      }
    }

    // ─── Tags Section ───
    const tagGroupRow = railBody.createDiv({ cls: "ticktick-group-header-row" });
    const tagHeading = tagGroupRow.createEl("button", {
      cls: `ticktick-project-group ${this.collapsed.has("virtual-tags") ? "is-collapsed" : ""}`,
      attr: { type: "button" }
    });
    const tagChevron = tagHeading.createSpan({ cls: "ticktick-group-chevron" });
    setIcon(tagChevron, this.collapsed.has("virtual-tags") ? "chevron-left" : "chevron-down");
    tagHeading.createSpan({ cls: "ticktick-group-title", text: "برچسب‌ها" });
    tagHeading.addEventListener("click", () => {
      this.collapsed.has("virtual-tags") ? this.collapsed.delete("virtual-tags") : this.collapsed.add("virtual-tags");
      void this.persistAndRender();
    });

    const addTagBtn = tagGroupRow.createEl("button", {
      cls: "ticktick-group-add-btn mod-icon",
      attr: { type: "button", "aria-label": "افزودن برچسب جدید", title: "افزودن برچسب جدید" }
    });
    setIcon(addTagBtn, "plus");
    addTagBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      new CreateTagModal(this.host.app, {
        projects,
        onCreate: async ({ tag, taskTitle, projectId }) => {
          addTagBtn.disabled = true;
          try {
            const finalProjectId = projectId || String(projects[0]?.id ?? "");
            await this.host.createTask({
              title: taskTitle || `تسک #${tag}`,
              tags: [tag],
              projectId: finalProjectId
            });
            await this.host.refresh();
            this.selected = `${TAG_BOARD_VIEW_PREFIX}${encodeURIComponent(tag)}`;
            this.collapsed.delete("virtual-tags");
            this.savedColumnsScrollLeft = 0;
            this.savedBodyScrollTop = 0;
            this.savedColumnScrolls.clear();
            await this.persistAndRender();
            new Notice(`برچسب #${tag} با موفقیت در TickTick ثبت شد.`);
          } finally {
            addTagBtn.disabled = false;
          }
        }
      }).open();
    });

    if (!this.collapsed.has("virtual-tags")) {
      for (const tag of virtual.tags) {
        const row = railBody.createDiv({
          cls: `ticktick-project-row ticktick-tag-view-row ${this.selected === tag.id ? "is-selected" : ""}`,
          attr: { role: "button", tabindex: "0", "aria-label": `برچسب ${tag.name}، ${tag.count} تسک باز` }
        });
        const lead = row.createDiv({ cls: "ticktick-project-row-lead" });
        const tagIcon = lead.createSpan({ cls: "ticktick-project-row-icon" });
        setIcon(tagIcon, "tag");
        lead.createSpan({ cls: "ticktick-project-name", text: `#${tag.name}` });

        const trailing = row.createDiv({ cls: "ticktick-project-row-trailing" });
        trailing.createSpan({ cls: "ticktick-project-count", text: String(tag.count) });
        row.addEventListener("click", () => {
          this.selected = tag.id;
          this.savedColumnsScrollLeft = 0;
          this.savedBodyScrollTop = 0;
          this.savedColumnScrolls.clear();
          void this.persistAndRender();
        });
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.selected = tag.id;
            void this.persistAndRender();
          }
        });
      }
    }

    // ─── Lists / Projects Tree ───
    for (const group of sidebarTree(projects, this.host.tasks())) {
      const key = group.name || "flat";
      const groupRow = railBody.createDiv({ cls: "ticktick-group-header-row" });
      const groupHeading = groupRow.createEl("button", {
        cls: `ticktick-project-group ${this.collapsed.has(key) ? "is-collapsed" : ""}`,
        attr: { type: "button" }
      });
      const groupChevron = groupHeading.createSpan({ cls: "ticktick-group-chevron" });
      setIcon(groupChevron, this.collapsed.has(key) ? "chevron-left" : "chevron-down");
      groupHeading.createSpan({ cls: "ticktick-group-title", text: group.name || "لیست‌ها" });
      groupHeading.addEventListener("click", () => {
        this.collapsed.has(key) ? this.collapsed.delete(key) : this.collapsed.add(key);
        void this.persistAndRender();
      });

      const addProjectBtn = groupRow.createEl("button", {
        cls: "ticktick-group-add-btn mod-icon",
        attr: { type: "button", "aria-label": `افزودن لیست جدید به ${group.name || "لیست‌ها"}`, title: "افزودن لیست جدید" }
      });
      setIcon(addProjectBtn, "plus");
      addProjectBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const draft = await new ProjectEditorModal(this.host.app).openAndWait();
        if (!draft) return;
        addProjectBtn.disabled = true;
        try {
          const project = await this.host.createProject(draft);
          this.selected = String(project?.id ?? "");
          this.collapsed.delete(key);
          this.savedColumnsScrollLeft = 0;
          this.savedBodyScrollTop = 0;
          this.savedColumnScrolls.clear();
          await this.host.refresh();
          await this.persistAndRender();
          new Notice("لیست در TickTick ساخته شد.");
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "ساخت لیست ناموفق بود.");
        } finally {
          addProjectBtn.disabled = false;
        }
      });

      if (this.collapsed.has(key)) continue;

      for (const project of group.projects) {
        const row = railBody.createDiv({
          cls: `ticktick-project-row ${this.selected === String(project.id) ? "is-selected" : ""}`,
          attr: { role: "button", tabindex: "0", "aria-label": `${project.name}، ${project.openCount} تسک باز` }
        });
        const lead = row.createDiv({ cls: "ticktick-project-row-lead" });
        const dot = lead.createSpan({ cls: "ticktick-project-dot" });
        dot.style.setProperty("--project-color", project.color ?? "var(--interactive-accent)");
        lead.createSpan({ cls: "ticktick-project-name", text: project.name });

        const trailing = row.createDiv({ cls: "ticktick-project-row-trailing" });
        trailing.createSpan({ cls: "ticktick-project-count", text: String(project.openCount) });

        const menuBtn = trailing.createEl("button", {
          cls: "ticktick-project-row-menu-btn mod-icon",
          attr: { type: "button", "aria-label": `عملیات لیست ${project.name}`, title: "عملیات لیست" }
        });
        setIcon(menuBtn, "more-horizontal");

        const handleEditProject = async () => {
          const draft = await new ProjectEditorModal(this.host.app, project).openAndWait();
          if (!draft) return;
          try {
            await this.host.updateProject({ ...project, ...draft });
            await this.host.refresh();
            await this.render();
            new Notice("لیست در TickTick ویرایش شد.");
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "ویرایش لیست ناموفق بود.");
          }
        };

        const handleDeleteProject = async () => {
          const isInbox = project.isInbox || project.name === "Inbox" || project.name === "ورودی";
          if (isInbox) {
            new Notice("لیست ورودی (Inbox) قابل حذف نیست.");
            return;
          }
          if (!window.confirm(`لیست «${project.name}» و تسک‌های آن در TickTick حذف شود؟`)) return;
          try {
            await this.host.deleteProject(String(project.id));
            if (this.selected === String(project.id)) {
              this.selected = String(projects[0]?.id ?? INBOX_BOARD_VIEW_ID);
            }
            this.savedColumnsScrollLeft = 0;
            this.savedBodyScrollTop = 0;
            this.savedColumnScrolls.clear();
            await this.host.refresh();
            await this.persistAndRender();
            new Notice("لیست از TickTick حذف شد.");
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "حذف لیست ناموفق بود.");
          }
        };

        const openMenu = (event: MouseEvent) => {
          event.stopPropagation();
          event.preventDefault();
          const menu = new Menu();

          menu.addItem(item => {
            item.setTitle("ویرایش لیست")
              .setIcon("pencil")
              .onClick(() => void handleEditProject());
          });

          const isInbox = project.isInbox || project.name === "Inbox" || project.name === "ورودی";
          if (!isInbox) {
            menu.addItem(item => {
              item.setTitle("حذف لیست")
                .setIcon("trash-2")
                .onClick(() => void handleDeleteProject());
            });
          }

          menu.showAtMouseEvent(event);
        };

        menuBtn.addEventListener("click", openMenu);
        row.addEventListener("contextmenu", openMenu);

        row.addEventListener("click", () => {
          this.selected = String(project.id);
          this.savedColumnsScrollLeft = 0;
          this.savedBodyScrollTop = 0;
          this.savedColumnScrolls.clear();
          void this.persistAndRender();
        });
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            this.selected = String(project.id);
            void this.persistAndRender();
          }
        });
      }
    }

    if (this.savedRailScrollTop > 0) {
      railBody.scrollTop = this.savedRailScrollTop;
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => {
          railBody.scrollTop = this.savedRailScrollTop;
        });
      }
      setTimeout(() => {
        railBody.scrollTop = this.savedRailScrollTop;
      }, 40);
    }
  }

  private card(parent: HTMLElement, task: TickTickTask, projectColor?: string, movable = true, subtasks: TickTickTask[] = []) {
    const bound = this.host.binding(task);
    const hideCompleted = !this.host.showCompleted();

    const card = renderTaskCard(parent, {
      task,
      timeZone: this.host.timeZone,
      projectColor,
      movable,
      dragType: "text/ticktick-board-task",
      isBound: Boolean(bound),
      variant: "board",
      subtasks,
      onCompleteSubtask: async (child) => {
        try {
          await this.host.complete(child);
          child.status = 2;
          new Notice("زیرتسک در TickTick تکمیل شد.");
          if (hideCompleted) {
            await this.render();
          }
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "خطا در تکمیل زیرتسک.");
        }
      },
      onOpenSubtaskDetails: (child) => {
        new TaskDetailsModal(this.host.app, child, {
          complete: async () => {
            await this.host.complete(child);
            await this.render();
          },
          load: item => this.host.load(item),
          edit: item => this.host.edit(item),
          changed: async () => {
            await this.host.refresh();
            await this.render();
          },
          allTasks: () => this.host.tasks(),
        }).open();
      },
      onComplete: async (t) => {
        card.addClass("is-completed");
        if (hideCompleted) {
          card.addClass("is-leaving");
        }
        try {
          await this.host.complete(t);
          t.status = 2;
          new Notice(bound ? "تسک در فایل مارک‌داون و TickTick تکمیل شد." : "تسک در TickTick تکمیل شد.");
          if (hideCompleted) {
            setTimeout(() => {
              const col = card.closest(".ticktick-project-column");
              const badge = col?.querySelector(".ticktick-column-count");
              card.remove();
              if (badge) {
                const current = parseInt(badge.textContent || "0", 10);
                if (current > 0) badge.textContent = String(current - 1);
              }
            }, 220);
          }
        } catch (error) {
          card.removeClass("is-completed");
          card.removeClass("is-leaving");
          new Notice(error instanceof Error ? error.message : "خطا در تکمیل تسک.");
        }
      },
      onOpenDetails: (t) => {
        new TaskDetailsModal(this.host.app, t, {
          complete: async () => {
            await this.host.complete(t);
            await this.render();
          },
          load: item => this.host.load(item),
          edit: item => this.host.edit(item),
          changed: async () => {
            await this.host.refresh();
            await this.render();
          },
          allTasks: () => this.host.tasks(),
        }).open();
      },
      onAddSubtask: async (parentTask) => {
        try {
          await this.host.createTask({
            projectId: parentTask.projectId,
            parentId: String(parentTask.id),
            columnId: parentTask.columnId
          });
          await this.render();
        } catch (error) {
          new Notice(error instanceof Error ? error.message : "ایجاد زیرتسک ناموفق بود.");
        }
      },
      onToggleBulkSelect: (id) => {
        const sel = bulkSelectionStore.toggle(id);
        card.toggleClass("is-bulk-selected", sel);
      }
    });

    if (movable) {
      card.addEventListener("dragover", (e) => {
        const types = e.dataTransfer?.types ?? [];
        if (!types.includes("text/ticktick-board-task")) return;
        e.preventDefault();
        e.stopPropagation();
        card.addClass("is-subtask-drop-target");
      });
      card.addEventListener("dragleave", (e) => {
        if (!card.contains(e.relatedTarget as Node | null)) {
          card.removeClass("is-subtask-drop-target");
        }
      });
      card.addEventListener("drop", async (e) => {
        const draggedId = e.dataTransfer?.getData("text/ticktick-board-task");
        if (!draggedId || draggedId === String(task.id)) return;
        e.preventDefault();
        e.stopPropagation();
        card.removeClass("is-subtask-drop-target");

        const allTasks = this.currentRawData?.tasks ?? this.host.tasks();
        const draggedTask = allTasks.find(t => String(t.id) === draggedId);
        if (!draggedTask) return;

        await this.reparentTask(draggedTask, task);
      });
    }

    return card;
  }

  private isDescendant(potentialParentId: string, potentialChildId: string): boolean {
    const allTasks = this.currentRawData?.tasks ?? this.host.tasks();
    const children = allTasks.filter(t => String(t.parentId) === potentialParentId);
    for (const c of children) {
      if (String(c.id) === potentialChildId) return true;
      if (this.isDescendant(String(c.id), potentialChildId)) return true;
    }
    return false;
  }

  private async reparentTask(child: TickTickTask, parentTask: TickTickTask) {
    if (String(child.id) === String(parentTask.id)) return;
    if (this.isDescendant(String(child.id), String(parentTask.id))) {
      new Notice("نمی‌توان یک تسک را زیرتسکِ فرزند خود قرار داد.");
      return;
    }

    try {
      if (this.host.updateTask) {
        await this.host.updateTask({
          id: child.id,
          parentId: String(parentTask.id),
          projectId: parentTask.projectId,
          columnId: parentTask.columnId
        });
      }
      child.parentId = String(parentTask.id);
      child.projectId = parentTask.projectId;
      child.columnId = parentTask.columnId;
      new Notice(`تسک «${cleanTaskTitle(child.title)}» به عنوان زیرتسک «${cleanTaskTitle(parentTask.title)}» تنظیم شد.`);
      await this.render();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "تنظیم زیرتسک ناموفق بود.");
    }
  }

  private async unparentTask(task: TickTickTask, targetColumnId: string) {
    try {
      if (this.host.updateTask) {
        await this.host.updateTask({
          id: task.id,
          parentId: null,
          columnId: targetColumnId
        });
      }
      task.parentId = null;
      task.columnId = targetColumnId;
      new Notice(`تسک «${cleanTaskTitle(task.title)}» از حالت زیرتسک خارج شد و به تسک مستقل تبدیل گردید.`);
      await this.render();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "خارج کردن تسک از حالت زیرتسک ناموفق بود.");
    }
  }

  private async moveTask(
    task: TickTickTask,
    columnId: string,
    optimisticCard?: HTMLElement | null,
    sourceCol?: Element | null,
    oldColumnId?: string | null
  ) {
    try {
      await this.host.moveToColumn(task, columnId);
      new Notice("تسک به ستون جدید منتقل و با TickTick همگام شد.");
    } catch (error) {
      if (optimisticCard && sourceCol) {
        const srcList = sourceCol.querySelector(".ticktick-column-cards");
        srcList?.appendChild(optimisticCard);
        task.columnId = oldColumnId;
      }
      new Notice(error instanceof Error ? error.message : "انتقال تسک ناموفق بود.");
    }
  }
}
