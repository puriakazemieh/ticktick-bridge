/**
 * TickTick Bridge — Unified Habit Card Component
 * Standardizes the design, layout, progress ring, and micro-interactions of habits
 * across all surfaces: Today Habits, Dashboard, Project Board, and Planning Calendar.
 */

import { Notice, setIcon } from "obsidian";
import type { TickTickHabit } from "../types/ticktick";
import { habitDashboardSection } from "./helpers";

export interface UnifiedHabitOptions {
  habit: TickTickHabit;
  day: string;
  variant?: "dashboard" | "board" | "planner";
  streak?: number;
  historyComplete?: number;
  historyTotal?: number;
  showHistoryDots?: boolean;
  onCheckIn: (habit: TickTickHabit, day: string) => Promise<unknown>;
  onOpenDetails?: (habit: TickTickHabit, day: string) => void;
  onEditHabit?: (habit: TickTickHabit) => void;
}

/** Determines semantic category color based on habit name or section */
export function habitCategoryTone(category: string): string {
  const cat = String(category).toLowerCase();
  if (/زبان|انگلیسی|کتاب|مطالعه|learn|english|language|book|read/.test(cat)) {
    return "var(--tb-habit-language, #eab308)";
  }
  if (/سلامت|ورزش|بدنسازی|تمرین|fitness|sport|health|workout|run|gym/.test(cat)) {
    return "var(--tb-habit-health, #10b981)";
  }
  if (/شخصی|خواب|آب|water|drink|sleep|routine|نوشیدن|استراحت/.test(cat)) {
    return "var(--tb-habit-personal, #3b82f6)";
  }
  if (/کار|توسعه|پروژه|کد|work|dev|code|productiv|برنامه‌نویسی/.test(cat)) {
    return "var(--tb-habit-work, #8b5cf6)";
  }
  if (/ذهن|مدیتیشن|آرامش|mind|meditat|calm|تمرکز/.test(cat)) {
    return "var(--tb-habit-mind, #06b6d4)";
  }
  return "var(--interactive-accent)";
}

/** Resolves an intuitive emoji glyph for a habit based on iconRes, icon, and name */
export function resolveHabitGlyph(habit: Partial<TickTickHabit>): string {
  const iconStr = String(habit.iconRes ?? habit.icon ?? "").toLowerCase();
  const nameStr = String(habit.name ?? "").toLowerCase();
  const combined = `${iconStr} ${nameStr}`;

  if (/language|book|read|learn|کتاب|مطالعه|زبان|انگلیسی/.test(combined)) return "📚";
  if (/sport|run|fitness|exercise|gym|ورزش|دویدن|تمرین|بدنسازی/.test(combined)) return "🏃";
  if (/meditat|mind|calm|ذهن|مدیتیشن|آرامش|تمرکز/.test(combined)) return "🧘";
  if (/water|drink|آب|نوشیدن/.test(combined)) return "💧";
  if (/sleep|خواب|استراحت/.test(combined)) return "🌙";
  if (/music|listen|پادکست|موسیقی|اهنگ|audio/.test(combined)) return "🎧";
  if (/write|note|نویسندگی|نوشتن|یادداشت|قلم/.test(combined)) return "✍️";
  if (/code|dev|work|برنامه‌نویسی|کد|کار|توسعه/.test(combined)) return "💻";
  return "⚡";
}

/** Renders a unified, modern habit card component */
export function renderUnifiedHabitCard(parent: HTMLElement, options: UnifiedHabitOptions): HTMLElement {
  const { habit, day, variant = "dashboard", onCheckIn, onOpenDetails } = options;
  const goal = Math.max(1, Number(habit.checkin?.goal ?? habit.goal ?? habit.target ?? 1));
  const currentValue = Number(habit.checkin?.value ?? 0);
  const completed = Number(habit.checkin?.status ?? 0) === 2 || currentValue >= goal;
  const progress = Math.min(1, Math.max(0, currentValue / goal));
  const sectionName = habit.sectionName || habitDashboardSection(habit);
  const tone = habitCategoryTone(sectionName || habit.name || "");

  const isPlanner = variant === "planner";
  const card = parent.createDiv({
    cls: `ticktick-habit-card ${isPlanner ? "is-planner-row" : "is-card"} ${completed ? "is-done is-success" : ""}`,
    attr: {
      role: "button",
      tabindex: "0",
      "aria-label": `عادت: ${habit.name}`
    }
  });
  card.style.setProperty("--card-tone", tone);
  card.dataset.habitId = String(habit.id);

  // 1. Progress ring & check-in icon button
  const progressRing = card.createEl("button", {
    cls: `ticktick-habit-progress ${completed ? "is-complete" : ""}`,
    attr: {
      type: "button",
      "aria-label": completed ? `لغو ثبت ${habit.name}` : `ثبت یک مرحله از ${habit.name}`,
      title: completed ? "برای لغو کلیک کنید" : "برای ثبت یک مرحله کلیک کنید"
    }
  });
  progressRing.style.setProperty("--ticktick-progress", `${Math.round(progress * 360)}deg`);
  progressRing.style.aspectRatio = "1 / 1";
  progressRing.style.borderRadius = "50%";

  const glyphSpan = progressRing.createSpan({
    cls: "ticktick-habit-glyph",
    text: completed ? "✓" : resolveHabitGlyph(habit)
  });

  // 2. Body: title, section badge, progress counter
  const body = card.createDiv({ cls: "ticktick-habit-body" });
  body.createDiv({ cls: "ticktick-habit-title", text: String(habit.name ?? "عادت") });

  const encouragementText = String(habit.encouragement ?? habit.notes ?? habit.desc ?? habit.description ?? habit.content ?? "").trim();
  if (encouragementText) {
    body.createDiv({
      cls: "ticktick-habit-encouragement",
      text: encouragementText,
      attr: { title: encouragementText }
    });
  }

  const meta = body.createDiv({ cls: "ticktick-habit-meta" });
  if (sectionName && sectionName !== "بدون دسته" && !isPlanner) {
    meta.createSpan({ cls: "ticktick-habit-tag", text: sectionName });
  }

  // Only multi-stage habits (goal > 1) display step progression (e.g. "1 از 3").
  // Single-stage habits (goal <= 1) display no text label — the icon checkmark alone represents status.
  if (goal > 1) {
    meta.createSpan({
      cls: `ticktick-habit-count ${completed ? "is-done" : ""}`,
      text: `${currentValue} از ${goal}`
    });
  }

  if (options.streak && options.streak > 1 && !isPlanner) {
    meta.createSpan({
      cls: "ticktick-habit-streak-pill",
      text: `🔥 ${options.streak} روز`,
      attr: { title: `${options.streak} روز پیوسته انجام شده` }
    });
  }

  if (!meta.hasChildNodes()) {
    meta.remove();
  }

  // 3. Optional history dots for month/week views
  if (options.showHistoryDots && habit.history?.length) {
    const dotsWrap = card.createDiv({ cls: "ticktick-habit-history-dots" });
    for (const entry of habit.history) {
      dotsWrap.createSpan({
        cls: `ticktick-habit-dot ${entry.completed ? "is-complete" : "is-missed"}`,
        attr: { title: `${entry.date}: ${entry.completed ? "انجام شد" : "انجام نشد"}` }
      });
    }
  }

  // 4. Quick edit button
  if (options.onEditHabit) {
    const editBtn = card.createEl("button", {
      cls: "ticktick-habit-edit-btn",
      attr: {
        type: "button",
        "aria-label": `ویرایش عادت ${habit.name ?? ""}`,
        title: "ویرایش عادت"
      }
    });
    try {
      setIcon(editBtn, "pencil");
    } catch {
      // Fallback
    }
    if (!editBtn.querySelector("svg")) {
      try {
        setIcon(editBtn, "edit");
      } catch {
        // Fallback
      }
    }
    if (!editBtn.querySelector("svg")) {
      editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="svg-icon"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
    }
    editBtn.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      options.onEditHabit!(habit);
    });
  }

  // Click on card opens details modal or triggers check-in
  const handleCardClick = () => {
    if (onOpenDetails) {
      onOpenDetails(habit, day);
    } else {
      void onCheckIn(habit, day);
    }
  };

  card.addEventListener("click", handleCardClick);
  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCardClick();
    }
  });

  // Click on progress ring triggers quick check-in
  progressRing.addEventListener("click", async event => {
    event.preventDefault();
    event.stopPropagation();
    progressRing.disabled = true;
    glyphSpan.addClass("is-checking");
    try {
      await onCheckIn(habit, day);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "ثبت عادت ناموفق بود.");
    } finally {
      glyphSpan.removeClass("is-checking");
      progressRing.disabled = false;
    }
  });

  return card;
}
