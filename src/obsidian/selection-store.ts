/**
 * TickTick Bridge — Unified Bulk Selection Reactive Store
 * Keeps persistent multi-task selection synchronized across Board, Calendar, and Timeline.
 */

class BulkSelectionStore {
  private selected = new Set<string>();
  private listeners = new Set<() => void>();

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "Escape" && this.selected.size > 0) {
          // If no modal or editor is open, clear selection
          if (!document.querySelector(".modal-container")) {
            this.clear();
          }
        }
      });
    }
  }

  toggle(id: string, force?: boolean): boolean {
    if (!id) return false;
    const strId = String(id);
    let state: boolean;
    if (force !== undefined) {
      if (force) this.selected.add(strId);
      else this.selected.delete(strId);
      state = force;
    } else {
      if (this.selected.has(strId)) {
        this.selected.delete(strId);
        state = false;
      } else {
        this.selected.add(strId);
        state = true;
      }
    }
    this.notify();
    return state;
  }

  select(id: string) {
    this.toggle(id, true);
  }

  deselect(id: string) {
    this.toggle(id, false);
  }

  selectAll(ids: string[]) {
    for (const id of ids) {
      this.selected.add(String(id));
    }
    this.notify();
  }

  clear() {
    if (this.selected.size === 0) return;
    this.selected.clear();
    this.notify();
  }

  isSelected(id: string): boolean {
    return this.selected.has(String(id));
  }

  getSelection(): string[] {
    return Array.from(this.selected);
  }

  count(): number {
    return this.selected.size;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error("BulkSelectionStore listener error:", err);
      }
    }
  }
}

export const bulkSelectionStore = new BulkSelectionStore();
