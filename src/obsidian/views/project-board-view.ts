import { ItemView, WorkspaceLeaf } from "obsidian";
import { PROJECT_BOARD_VIEW_TYPE } from "../constants";
import { ProjectBoard } from "../project-board";
import type TickTickBridgePlugin from "../main";

export class ProjectBoardView extends ItemView {
  private board?: ProjectBoard;

  constructor(leaf: WorkspaceLeaf, private plugin: TickTickBridgePlugin) {
    super(leaf);
  }

  getViewType() { return PROJECT_BOARD_VIEW_TYPE; }
  getDisplayText() { return "برد پروژه‌های TickTick"; }
  getIcon() { return "kanban-square"; }

  async onOpen() { await this.render(); }

  async render() {
    this.contentEl.addClass("ticktick-project-board-panel");
    this.board ??= new ProjectBoard(this.contentEl, this.plugin.projectBoardHost());
    await this.board.render();
  }
}
