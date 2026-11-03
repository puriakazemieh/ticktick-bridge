import { ItemView, WorkspaceLeaf } from "obsidian";
import { PROJECT_BOARD_VIEW_TYPE } from "../constants";
import { ProjectBoard } from "../project-board";
import { renderWorkspaceHeader } from "../components/workspace-header";
import type TickTickBridgePlugin from "../main";

export class ProjectBoardView extends ItemView {
  private board?: ProjectBoard;
  private headerSlot?: HTMLElement;
  private bodySlot?: HTMLElement;

  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) {
    super(leaf);
  }

  getViewType() { return PROJECT_BOARD_VIEW_TYPE; }
  getDisplayText() { return "برد پروژه‌های TickTick"; }
  getIcon() { return "kanban-square"; }

  async onOpen() { await this.render(); }

  async render() {
    this.contentEl.addClass("ticktick-workspace-view-root");
    this.contentEl.addClass("ticktick-project-board-panel");
    if (!this.headerSlot || !this.bodySlot) {
      this.contentEl.empty();
      this.headerSlot = this.contentEl.createDiv({ cls: "ticktick-workspace-header-slot" });
      this.bodySlot = this.contentEl.createDiv({ cls: "ticktick-workspace-body-slot" });
      renderWorkspaceHeader(this.headerSlot, {
        plugin: this.plugin,
        leaf: this.leaf,
        activeViewType: this.getViewType()
      });
      this.board = new ProjectBoard(this.bodySlot, this.plugin.projectBoardHost());
    }
    await this.board?.render();
  }

  async onClose() {
    this.board = undefined;
    this.headerSlot = undefined;
    this.bodySlot = undefined;
  }
}
