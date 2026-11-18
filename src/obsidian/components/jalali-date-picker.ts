import * as jalaali from "jalaali-js";

export const JALALI_MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
export const JALALI_WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

export const toEnDigits = (s: string) =>
  s.replace(/[۰-۹]/g, d => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[٠-٩]/g, d => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

export const pad = (n: number) => String(n).padStart(2, "0");
export const isIsoDate = (x: string) => /^\d{4}-\d{2}-\d{2}$/.test(x);
export const toIso = (g: { gy: number; gm: number; gd: number }) => `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;

export const parseJalali = (str: string): { jy: number; jm: number; jd: number; iso: string } | null => {
  if (!str) return null;
  const clean = toEnDigits(str).trim();
  const m = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (!m) return null;
  const jy = parseInt(m[1], 10), jm = parseInt(m[2], 10), jd = parseInt(m[3], 10);
  if (jy < 1300 || jy > 1500) return null;
  if (jm < 1 || jm > 12) return null;
  const maxDays = jalaali.jalaaliMonthLength(jy, jm);
  if (jd < 1 || jd > maxDays) return null;
  const g = jalaali.toGregorian(jy, jm, jd);
  return { jy, jm, jd, iso: toIso(g) };
};

export const isoToJalali = (iso: string): { jy: number; jm: number; jd: number; str: string; full: string } | null => {
  if (!isIsoDate(iso)) return null;
  const [gy, gm, gd] = iso.split("-").map(Number);
  const j = jalaali.toJalaali(gy, gm, gd);
  return {
    jy: j.jy,
    jm: j.jm,
    jd: j.jd,
    str: `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`,
    full: `${j.jd} ${JALALI_MONTHS[j.jm - 1]} ${j.jy}`
  };
};

export const getTodayJalali = () => {
  const now = new Date();
  return jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
};

export class JalaliDatePicker {
  container: HTMLElement;
  inputEl: HTMLInputElement;
  calBtn: HTMLButtonElement;
  helperEl: HTMLElement;
  cardEl: HTMLElement;

  currentIso: string = "";
  viewYear: number;
  viewMonth: number;
  isOpen: boolean = false;

  constructor(
    parent: HTMLElement,
    labelText: string,
    initialIso: string,
    private onChange: (iso: string) => void,
    options?: { allowClear?: boolean; defaultYear?: number }
  ) {
    this.container = parent.createDiv({ cls: "ticktick-jalali-date-wrap" });

    // Label if provided
    if (labelText) {
      this.container.createEl("label", { text: labelText, cls: "ticktick-form-label" });
    }

    // Input row
    const row = this.container.createDiv({ cls: "ticktick-jalali-input-row" });
    this.inputEl = row.createEl("input", {
      type: "text",
      cls: "ticktick-input ticktick-jalali-input",
      placeholder: "مثال: ۱۴۰۵/۰۱/۰۱"
    });
    this.calBtn = row.createEl("button", {
      type: "button",
      cls: "ticktick-jalali-cal-btn",
      text: "📅"
    });
    this.calBtn.setAttribute("title", "باز کردن تقویم شمسی");

    // Helper text
    this.helperEl = this.container.createDiv({ cls: "ticktick-jalali-helper-text" });

    // Calendar Card
    this.cardEl = this.container.createDiv({ cls: "ticktick-jalali-calendar-card is-hidden" });

    const todayJ = getTodayJalali();
    this.viewYear = options?.defaultYear || todayJ.jy;
    this.viewMonth = todayJ.jm;

    this.setValue(initialIso);

    // Event listeners
    this.inputEl.addEventListener("input", () => this.handleInput());
    this.inputEl.addEventListener("blur", () => this.handleBlur());
    this.calBtn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleCalendar();
    });

    document.addEventListener("pointerdown", e => {
      if (this.isOpen && !this.container.contains(e.target as Node)) {
        this.closeCalendar();
      }
    });
  }

  setValue(iso: string) {
    this.currentIso = iso ? iso.slice(0, 10) : "";
    const j = isoToJalali(this.currentIso);
    if (j) {
      this.inputEl.value = j.str;
      this.helperEl.setText(`${j.full} (معادل میلادی: ${this.currentIso})`);
      this.viewYear = j.jy;
      this.viewMonth = j.jm;
    } else {
      this.inputEl.value = "";
      this.helperEl.setText("بدون تاریخ سررسید");
    }
    if (this.isOpen) this.renderCalendar();
  }

  private handleInput() {
    const val = this.inputEl.value.trim();
    if (!val) {
      this.currentIso = "";
      this.helperEl.setText("بدون تاریخ سررسید");
      this.onChange("");
      return;
    }
    const parsed = parseJalali(val);
    if (parsed) {
      this.currentIso = parsed.iso;
      this.viewYear = parsed.jy;
      this.viewMonth = parsed.jm;
      this.helperEl.setText(`${parsed.jd} ${JALALI_MONTHS[parsed.jm - 1]} ${parsed.jy} (معادل میلادی: ${parsed.iso})`);
      this.onChange(parsed.iso);
      if (this.isOpen) this.renderCalendar();
    } else {
      this.helperEl.setText("فرمت تاریخ نامعتبر است (مثال: ۱۴۰۵/۰۷/۲۷)");
    }
  }

  private handleBlur() {
    const j = isoToJalali(this.currentIso);
    if (j) {
      this.inputEl.value = j.str;
    }
  }

  toggleCalendar() {
    if (this.isOpen) {
      this.closeCalendar();
    } else {
      document.querySelectorAll(".ticktick-jalali-calendar-card").forEach(el => {
        if (el !== this.cardEl) el.addClass("is-hidden");
      });
      this.openCalendar();
    }
  }

  openCalendar() {
    this.isOpen = true;
    this.cardEl.removeClass("is-hidden");
    this.renderCalendar();
  }

  closeCalendar() {
    this.isOpen = false;
    this.cardEl.addClass("is-hidden");
  }

  private renderCalendar() {
    this.cardEl.empty();

    // 1. Header
    const header = this.cardEl.createDiv({ cls: "ticktick-jalali-cal-header" });
    const prevBtn = header.createEl("button", { type: "button", text: "‹", cls: "ticktick-jalali-nav-btn", title: "ماه قبل" });
    prevBtn.onclick = e => {
      e.preventDefault();
      if (this.viewMonth === 1) {
        this.viewMonth = 12;
        this.viewYear--;
      } else {
        this.viewMonth--;
      }
      this.renderCalendar();
    };

    const controls = header.createDiv({ cls: "ticktick-jalali-header-selects" });

    // Month Select
    const monthSelect = controls.createEl("select", { cls: "ticktick-select ticktick-jalali-select" });
    JALALI_MONTHS.forEach((m, idx) => {
      const opt = monthSelect.createEl("option", { text: m, value: String(idx + 1) });
      if (idx + 1 === this.viewMonth) opt.selected = true;
    });
    monthSelect.onchange = () => {
      this.viewMonth = parseInt(monthSelect.value, 10);
      this.renderCalendar();
    };

    // Year Select
    const yearSelect = controls.createEl("select", { cls: "ticktick-select ticktick-jalali-select" });
    for (let y = this.viewYear - 5; y <= this.viewYear + 5; y++) {
      const opt = yearSelect.createEl("option", { text: String(y), value: String(y) });
      if (y === this.viewYear) opt.selected = true;
    }
    yearSelect.onchange = () => {
      this.viewYear = parseInt(yearSelect.value, 10);
      this.renderCalendar();
    };

    const nextBtn = header.createEl("button", { type: "button", text: "›", cls: "ticktick-jalali-nav-btn", title: "ماه بعد" });
    nextBtn.onclick = e => {
      e.preventDefault();
      if (this.viewMonth === 12) {
        this.viewMonth = 1;
        this.viewYear++;
      } else {
        this.viewMonth++;
      }
      this.renderCalendar();
    };

    // 2. Weekdays Header
    const weekdaysRow = this.cardEl.createDiv({ cls: "ticktick-jalali-weekdays" });
    JALALI_WEEKDAYS.forEach(w => weekdaysRow.createSpan({ text: w }));

    // 3. Days Grid (Unified 7x5 or 7x6 Matrix with filler days for perfect consistency)
    const grid = this.cardEl.createDiv({ cls: "ticktick-jalali-days-grid" });

    const { gy, gm, gd } = jalaali.toGregorian(this.viewYear, this.viewMonth, 1);
    const gDate = new Date(Date.UTC(gy, gm - 1, gd, 12, 0, 0));
    const startWeekday = (gDate.getUTCDay() + 1) % 7; // 0=Shanbe, ..., 6=Jomeh

    const monthLength = jalaali.jalaaliMonthLength(this.viewYear, this.viewMonth);
    const totalCells = (startWeekday + monthLength <= 35) ? 35 : 42;
    const selectedJ = isoToJalali(this.currentIso);
    const todayJ = getTodayJalali();

    // Previous month filler days
    const prevMonth = this.viewMonth === 1 ? 12 : this.viewMonth - 1;
    const prevYear = this.viewMonth === 1 ? this.viewYear - 1 : this.viewYear;
    const prevMonthLength = jalaali.jalaaliMonthLength(prevYear, prevMonth);

    for (let i = 0; i < startWeekday; i++) {
      const prevD = prevMonthLength - (startWeekday - 1 - i);
      const isSelected = selectedJ && selectedJ.jy === prevYear && selectedJ.jm === prevMonth && selectedJ.jd === prevD;
      const isToday = todayJ.jy === prevYear && todayJ.jm === prevMonth && todayJ.jd === prevD;

      const cell = grid.createEl("button", {
        type: "button",
        text: String(prevD),
        cls: `ticktick-jalali-day-cell is-other-month${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`,
        title: `${prevD} ${JALALI_MONTHS[prevMonth - 1]} ${prevYear}`
      });

      cell.onclick = e => {
        e.preventDefault();
        const g = jalaali.toGregorian(prevYear, prevMonth, prevD);
        const iso = toIso(g);
        this.setValue(iso);
        this.onChange(iso);
        this.closeCalendar();
      };
    }

    // Current month days
    for (let d = 1; d <= monthLength; d++) {
      const isSelected = selectedJ && selectedJ.jy === this.viewYear && selectedJ.jm === this.viewMonth && selectedJ.jd === d;
      const isToday = todayJ.jy === this.viewYear && todayJ.jm === this.viewMonth && todayJ.jd === d;

      const cell = grid.createEl("button", {
        type: "button",
        text: String(d),
        cls: `ticktick-jalali-day-cell${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`,
        title: `${d} ${JALALI_MONTHS[this.viewMonth - 1]} ${this.viewYear}`
      });

      cell.onclick = e => {
        e.preventDefault();
        const g = jalaali.toGregorian(this.viewYear, this.viewMonth, d);
        const iso = toIso(g);
        this.setValue(iso);
        this.onChange(iso);
        this.closeCalendar();
      };
    }

    // Next month filler days
    const nextMonth = this.viewMonth === 12 ? 1 : this.viewMonth + 1;
    const nextYear = this.viewMonth === 12 ? this.viewYear + 1 : this.viewYear;
    const trailingCount = totalCells - (startWeekday + monthLength);

    for (let d = 1; d <= trailingCount; d++) {
      const isSelected = selectedJ && selectedJ.jy === nextYear && selectedJ.jm === nextMonth && selectedJ.jd === d;
      const isToday = todayJ.jy === nextYear && todayJ.jm === nextMonth && todayJ.jd === d;

      const cell = grid.createEl("button", {
        type: "button",
        text: String(d),
        cls: `ticktick-jalali-day-cell is-other-month${isSelected ? " is-selected" : ""}${isToday ? " is-today" : ""}`,
        title: `${d} ${JALALI_MONTHS[nextMonth - 1]} ${nextYear}`
      });

      cell.onclick = e => {
        e.preventDefault();
        const g = jalaali.toGregorian(nextYear, nextMonth, d);
        const iso = toIso(g);
        this.setValue(iso);
        this.onChange(iso);
        this.closeCalendar();
      };
    }

    // 4. Quick Actions Footer
    const footer = this.cardEl.createDiv({ cls: "ticktick-jalali-cal-footer" });

    const todayBtn = footer.createEl("button", { type: "button", text: "امروز", cls: "ticktick-jalali-btn-sm" });
    todayBtn.onclick = e => {
      e.preventDefault();
      const t = getTodayJalali();
      const g = jalaali.toGregorian(t.jy, t.jm, t.jd);
      const iso = toIso(g);
      this.setValue(iso);
      this.onChange(iso);
      this.closeCalendar();
    };

    const tomorrowBtn = footer.createEl("button", { type: "button", text: "فردا", cls: "ticktick-jalali-btn-sm" });
    tomorrowBtn.onclick = e => {
      e.preventDefault();
      const now = new Date();
      now.setDate(now.getDate() + 1);
      const tj = jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
      const g = jalaali.toGregorian(tj.jy, tj.jm, tj.jd);
      const iso = toIso(g);
      this.setValue(iso);
      this.onChange(iso);
      this.closeCalendar();
    };

    const clearBtn = footer.createEl("button", { type: "button", text: "بدون تاریخ", cls: "ticktick-jalali-btn-sm" });
    clearBtn.onclick = e => {
      e.preventDefault();
      this.setValue("");
      this.onChange("");
      this.closeCalendar();
    };

    const closeBtn = footer.createEl("button", { type: "button", text: "بستن", cls: "ticktick-jalali-btn-sm mod-muted" });
    closeBtn.onclick = e => {
      e.preventDefault();
      this.closeCalendar();
    };
  }
}
