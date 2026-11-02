/**
 * TickTick Bridge — Unified Filter Bar Component
 * Responsive, compact filter control for Board, Weekly Planner, and Monthly Calendar.
 * Supports multiple projects, multiple tags, priority, status, search, and saved views.
 */

import { App, Menu, Modal, Notice, setIcon } from "obsidian";
import { createSavedView, DEFAULT_TASK_FILTER } from "../core/task-filter.js";
import type { SavedView, TaskFilterState } from "./types";

export interface FilterBarHost {
  app: App;
  scope: "all" | "board" | "calendar";
  projects: () => Array<{ id: string; name: string }>;
  tags: () => string[];
  savedViews: () => SavedView[];
  saveSavedViews: (views: SavedView[]) => Promise<void>;
  filterState: () => TaskFilterState;
  onFilterChange: (state: TaskFilterState) => void;
}

export class MultiChoiceModal extends Modal {
  private answer: Set<string> | null = null;

  constructor(
    app: App,
    private label: string,
    private items: Array<{ id: string; label: string }>,
    private selected: Set<string>,
    private onApply: (selected: Set<string>) => void
  ) {
    super(app);
  }

  onOpen() {
    this.modalEl.addClass("ticktick-filter-modal-dialog");
    this.titleEl.setText(`فیلتر ${this.label}`);
    const choices = new Set(this.selected);

    const searchBox = this.contentEl.createDiv({ cls: "ticktick-filter-search-box" });
    const searchInput = searchBox.createEl("input", {
      type: "search",
      placeholder: `جستجو در ${this.label}…`,
      cls: "ticktick-filter-search-input"
    });

    const list = this.contentEl.createDiv({ cls: "ticktick-planner-filter-modal" });

    const renderList = (filterText = "") => {
      list.empty();
      const filtered = this.items.filter(item =>
        !filterText || item.label.toLowerCase().includes(filterText.toLowerCase())
      );
      if (!filtered.length) {
        list.createDiv({ cls: "ticktick-filter-empty", text: "موردی پیدا نشد" });
        return;
      }
      for (const item of filtered) {
        const row = list.createEl("label", { cls: "ticktick-filter-item" });
        const check = row.createEl("input", { type: "checkbox", cls: "ticktick-filter-checkbox" });
        check.checked = choices.has(item.id);
        row.createSpan({ cls: "ticktick-filter-item-text", text: item.label });
        check.addEventListener("change", () => {
          check.checked ? choices.add(item.id) : choices.delete(item.id);
        });
      }
    };

    searchInput.addEventListener("input", () => renderList(searchInput.value.trim()));
    renderList();

    const actions = this.contentEl.createDiv({ cls: "modal-button-container ticktick-filter-actions" });
    const selectAllBtn = actions.createEl("button", { text: "انتخاب همه", cls: "ticktick-filter-quick-btn" });
    selectAllBtn.addEventListener("click", () => {
      this.items.forEach(i => choices.add(i.id));
      renderList(searchInput.value.trim());
    });

    const clearBtn = actions.createEl("button", { text: "حذف همه", cls: "ticktick-filter-quick-btn" });
    clearBtn.addEventListener("click", () => {
      choices.clear();
      renderList(searchInput.value.trim());
    });

    actions.createEl("button", { text: "لغو" }).addEventListener("click", () => this.close());
    actions.createEl("button", { text: "اعمال فیلتر", cls: "mod-cta" }).addEventListener("click", () => {
      this.answer = choices;
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
    if (this.answer) {
      this.onApply(this.answer);
    }
  }
}

export class SaveViewModal extends Modal {
  private name = "";

  constructor(app: App, defaultName: string, private onSave: (name: string) => void) {
    super(app);
    this.name = defaultName;
  }

  onOpen() {
    this.titleEl.setText("ذخیرهٔ نمای فعلی (Saved View)");
    this.contentEl.createEl("p", {
      text: "ترکیب فیلترها، جست‌وجو و چیدمان فعلی را با یک نام دلخواه ذخیره کنید تا همیشه در دسترس باشد."
    });

    const input = this.contentEl.createEl("input", {
      type: "text",
      value: this.name,
      cls: "ticktick-saved-view-input",
      attr: { placeholder: "مثال: توسن‌تکنو + #فوری" }
    });
    input.focus();
    input.addEventListener("input", () => {
      this.name = input.value;
    });

    const actions = this.contentEl.createDiv({ cls: "modal-button-container" });
    actions.createEl("button", { text: "انصراف" }).addEventListener("click", () => this.close());
    const saveBtn = actions.createEl("button", { text: "ذخیره نما", cls: "mod-cta" });
    saveBtn.addEventListener("click", () => {
      if (!this.name.trim()) {
        new Notice("لطفاً یک نام برای نما وارد کنید.");
        return;
      }
      this.onSave(this.name.trim());
      this.close();
    });
  }

  onClose() {
    this.contentEl.empty();
  }
}

export class FilterBar {
  private element: HTMLElement;
  private searchInput: HTMLInputElement | null = null;
  private searchClearBtn: HTMLElement | null = null;
  private chipsContainer: HTMLElement | null = null;
  private debounceTimer: number | null = null;

  constructor(private parent: HTMLElement, private host: FilterBarHost) {
    this.element = this.parent.createDiv({ cls: "ticktick-shared-filter-bar" });
  }

  render() {
    const wasSearchFocused = this.searchInput === document.activeElement;
    const selStart = this.searchInput?.selectionStart ?? null;
    const selEnd = this.searchInput?.selectionEnd ?? null;
    const prevText = this.searchInput ? this.searchInput.value : null;

    this.element.empty();
    const state = this.host.filterState();

    // 1. Search Box
    const searchWrapper = this.element.createDiv({ cls: "ticktick-filter-search-pill" });
    const sIcon = searchWrapper.createSpan({ cls: "ticktick-search-icon" });
    setIcon(sIcon, "search");

    const inputVal = prevText !== null ? prevText : (state.searchText || "");
    this.searchInput = searchWrapper.createEl("input", {
      type: "search",
      placeholder: "جست‌وجوی تسک‌ها…",
      value: inputVal,
      cls: "ticktick-filter-search-field"
    });

    this.searchClearBtn = searchWrapper.createEl("button", {
      cls: "ticktick-filter-clear-search",
      attr: { type: "button", "aria-label": "پاک کردن متن" }
    });
    setIcon(this.searchClearBtn, "x");
    this.updateSearchClearButton();

    this.searchClearBtn.addEventListener("click", () => {
      if (this.searchInput) {
        this.searchInput.value = "";
        this.searchInput.focus();
      }
      this.updateSearchClearButton();
      this.notifyFilterChange({ ...this.host.filterState(), searchText: "" });
      this.renderChips();
    });

    this.searchInput.addEventListener("input", () => {
      this.updateSearchClearButton();
      if (this.debounceTimer !== null) {
        window.clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = window.setTimeout(() => {
        this.debounceTimer = null;
        this.notifyFilterChange({
          ...this.host.filterState(),
          searchText: this.searchInput?.value || ""
        });
        this.renderChips();
      }, 120);
    });

    this.searchInput.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (this.debounceTimer !== null) {
          window.clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
        }
        this.notifyFilterChange({
          ...this.host.filterState(),
          searchText: this.searchInput?.value || ""
        });
        this.renderChips();
      } else if (e.key === "Escape") {
        if (this.debounceTimer !== null) {
          window.clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
        }
        if (this.searchInput) {
          this.searchInput.value = "";
        }
        this.updateSearchClearButton();
        this.notifyFilterChange({
          ...this.host.filterState(),
          searchText: ""
        });
        this.renderChips();
      }
    });

    // 2. Chips Container (Projects, Tags, Priority, Status, Saved Views, Reset)
    this.chipsContainer = this.element.createDiv({ cls: "ticktick-filter-chips-container" });
    this.renderChips();

    if (wasSearchFocused && this.searchInput) {
      this.searchInput.focus();
      if (selStart !== null && selEnd !== null) {
        this.searchInput.setSelectionRange(selStart, selEnd);
      }
    }
  }

  private updateSearchClearButton() {
    if (!this.searchClearBtn) return;
    const hasText = Boolean(this.searchInput?.value);
    this.searchClearBtn.style.display = hasText ? "flex" : "none";
  }

  private notifyFilterChange(nextState: TaskFilterState) {
    this.host.onFilterChange(nextState);
  }

  renderChips() {
    if (!this.chipsContainer) return;
    this.chipsContainer.empty();
    const state = this.host.filterState();

    // 2. Projects Pill
    const projects = this.host.projects();
    const selProjects = new Set(state.projects || []);
    const projBtn = this.chipsContainer.createEl("button", {
      cls: `ticktick-filter-chip ${selProjects.size ? "is-active" : ""}`,
      attr: { type: "button" }
    });
    const pIcon = projBtn.createSpan({ cls: "ticktick-chip-icon" });
    setIcon(pIcon, "folder");
    const projLabel = selProjects.size
      ? `پروژه‌ها (${selProjects.size})`
      : "همهٔ پروژه‌ها";
    projBtn.createSpan({ text: projLabel });
    projBtn.addEventListener("click", () => {
      new MultiChoiceModal(
        this.host.app,
        "پروژه‌ها",
        projects.map(p => ({ id: p.id, label: p.name })),
        selProjects,
        selected => {
          this.notifyFilterChange({
            ...state,
            projects: [...selected]
          });
          this.renderChips();
        }
      ).open();
    });

    // 3. Tags Pill
    const tags = this.host.tags();
    const selTags = new Set(state.tags || []);
    const tagBtn = this.chipsContainer.createEl("button", {
      cls: `ticktick-filter-chip ${selTags.size ? "is-active" : ""}`,
      attr: { type: "button" }
    });
    const tIcon = tagBtn.createSpan({ cls: "ticktick-chip-icon" });
    setIcon(tIcon, "tag");
    const tagLabel = selTags.size ? `برچسب‌ها (${selTags.size})` : "همهٔ برچسب‌ها";
    tagBtn.createSpan({ text: tagLabel });
    tagBtn.addEventListener("click", () => {
      new MultiChoiceModal(
        this.host.app,
        "برچسب‌ها",
        tags.map(t => ({ id: t, label: `#${t}` })),
        selTags,
        selected => {
          this.notifyFilterChange({
            ...state,
            tags: [...selected]
          });
          this.renderChips();
        }
      ).open();
    });

    // 4. Priority Dropdown Pill
    const selPriorities = new Set(state.priorities || []);
    const priorityBtn = this.chipsContainer.createEl("button", {
      cls: `ticktick-filter-chip ${selPriorities.size ? "is-active" : ""}`,
      attr: { type: "button" }
    });
    const prIcon = priorityBtn.createSpan({ cls: "ticktick-chip-icon" });
    setIcon(prIcon, "flag");
    const prLabel = selPriorities.size ? `اولویت (${selPriorities.size})` : "همهٔ اولویت‌ها";
    priorityBtn.createSpan({ text: prLabel });
    priorityBtn.addEventListener("click", (e: MouseEvent) => {
      const menu = new Menu();
      const priorityOptions: Array<[number, string]> = [
        [5, "🔴 فوری (High)"],
        [3, "🟡 بالا (Medium)"],
        [1, "🔵 متوسط (Low)"],
        [0, "⚪ بدون اولویت (None)"]
      ];
      for (const [pVal, pText] of priorityOptions) {
        menu.addItem(item => {
          item.setTitle(pText)
            .setChecked(selPriorities.has(pVal))
            .onClick(() => {
              const next = new Set(selPriorities);
              next.has(pVal) ? next.delete(pVal) : next.add(pVal);
              this.notifyFilterChange({
                ...state,
                priorities: [...next]
              });
              this.renderChips();
            });
        });
      }
      menu.addSeparator();
      menu.addItem(item => {
        item.setTitle("پاک کردن فیلتر اولویت").onClick(() => {
          this.notifyFilterChange({ ...state, priorities: [] });
          this.renderChips();
        });
      });
      menu.showAtMouseEvent(e);
    });

    // 5. Status Dropdown Pill
    const selStatuses = state.statuses || [];
    const statusBtn = this.chipsContainer.createEl("button", {
      cls: `ticktick-filter-chip ${selStatuses.length ? "is-active" : ""}`,
      attr: { type: "button" }
    });
    const stIcon = statusBtn.createSpan({ cls: "ticktick-chip-icon" });
    setIcon(stIcon, "check-circle");
    const stLabel = selStatuses.includes(2) && !selStatuses.includes(0)
      ? "تکمیل‌شده"
      : selStatuses.includes(0) && !selStatuses.includes(2)
      ? "تسک‌های باز"
      : "همهٔ وضعیت‌ها";
    statusBtn.createSpan({ text: stLabel });
    statusBtn.addEventListener("click", (e: MouseEvent) => {
      const menu = new Menu();
      menu.addItem(item => item.setTitle("همهٔ وضعیت‌ها").setChecked(!selStatuses.length).onClick(() => {
        this.notifyFilterChange({ ...state, statuses: [] });
        this.renderChips();
      }));
      menu.addItem(item => item.setTitle("فقط تسک‌های باز").setChecked(selStatuses.length === 1 && selStatuses[0] === 0).onClick(() => {
        this.notifyFilterChange({ ...state, statuses: [0] });
        this.renderChips();
      }));
      menu.addItem(item => item.setTitle("فقط تکمیل‌شده‌ها").setChecked(selStatuses.length === 1 && selStatuses[0] === 2).onClick(() => {
        this.notifyFilterChange({ ...state, statuses: [2] });
        this.renderChips();
      }));
      menu.showAtMouseEvent(e);
    });

    // 6. Saved Views Dropdown
    const savedViews = this.host.savedViews();
    const savedViewsBtn = this.chipsContainer.createEl("button", {
      cls: "ticktick-filter-chip ticktick-saved-views-chip",
      attr: { type: "button" }
    });
    const svIcon = savedViewsBtn.createSpan({ cls: "ticktick-chip-icon" });
    setIcon(svIcon, "bookmark");
    savedViewsBtn.createSpan({ text: "نماهای ذخیره‌شده" });
    const chevron = savedViewsBtn.createSpan({ cls: "ticktick-select-chevron" });
    setIcon(chevron, "chevron-down");

    savedViewsBtn.addEventListener("click", (e: MouseEvent) => {
      const menu = new Menu();
      menu.addItem(item => {
        item.setTitle("💾 ذخیرهٔ فیلترهای فعلی به عنوان نمای جدید…")
          .setIcon("plus")
          .onClick(() => {
            new SaveViewModal(this.host.app, "", async name => {
              const currentFilter = {
                ...state,
                searchText: this.searchInput?.value || ""
              };
              const newView = createSavedView(name, currentFilter, { scope: this.host.scope });
              await this.host.saveSavedViews([...savedViews, newView]);
              this.renderChips();
              new Notice(`نمای «${name}» با موفقیت ذخیره شد.`);
            }).open();
          });
      });

      if (savedViews.length) {
        menu.addSeparator();
        for (const view of savedViews) {
          menu.addItem(item => {
            item.setTitle(`📌 ${view.name}`)
              .onClick(() => {
                if (this.searchInput && view.filter.searchText !== undefined) {
                  this.searchInput.value = view.filter.searchText;
                }
                this.updateSearchClearButton();
                this.notifyFilterChange({
                  ...state,
                  ...view.filter
                });
                this.renderChips();
                new Notice(`نمای «${view.name}» اعمال شد.`);
              });
          });
        }
        menu.addSeparator();
        menu.addItem(item => {
          item.setTitle("مدیریت و حذف نماهای ذخیره‌شده…")
            .setIcon("trash-2")
            .onClick(() => {
              this.openManageSavedViewsMenu(e);
            });
        });
      }
      menu.showAtMouseEvent(e);
    });

    // 7. Clear All Filters Button (if any active filter)
    const activeSearch = Boolean(this.searchInput?.value || state.searchText);
    const hasActiveFilters = Boolean(
      activeSearch ||
      (state.projects && state.projects.length > 0) ||
      (state.tags && state.tags.length > 0) ||
      (state.priorities && state.priorities.length > 0) ||
      (state.statuses && state.statuses.length > 0) ||
      state.dateRange
    );

    if (hasActiveFilters) {
      const resetBtn = this.chipsContainer.createEl("button", {
        cls: "ticktick-filter-clear-btn",
        attr: { type: "button", title: "پاک کردن همهٔ فیلترها", "aria-label": "پاک کردن فیلترها" }
      });
      const rIcon = resetBtn.createSpan({ cls: "ticktick-chip-icon" });
      setIcon(rIcon, "rotate-ccw");
      resetBtn.createSpan({ text: "پاک‌سازی فیلترها" });
      resetBtn.addEventListener("click", () => {
        if (this.searchInput) {
          this.searchInput.value = "";
        }
        this.updateSearchClearButton();
        this.notifyFilterChange({
          projects: [],
          tags: [],
          statuses: [],
          priorities: [],
          dateRange: null,
          searchText: "",
          grouping: state.grouping || "none",
          sort: state.sort || "ticktick"
        });
        this.renderChips();
      });
    }
  }

  private openManageSavedViewsMenu(event: MouseEvent) {
    const savedViews = this.host.savedViews();
    const menu = new Menu();
    for (const view of savedViews) {
      menu.addItem(item => {
        item.setTitle(`حذف «${view.name}»`)
          .setIcon("trash")
          .onClick(async () => {
            const next = savedViews.filter(v => v.id !== view.id);
            await this.host.saveSavedViews(next);
            this.renderChips();
            new Notice(`نمای «${view.name}» حذف شد.`);
          });
      });
    }
    menu.showAtMouseEvent(event);
  }
}
