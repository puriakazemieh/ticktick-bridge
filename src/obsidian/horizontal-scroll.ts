/** Make wide board/calendar surfaces usable with a mouse, trackpad, and touch.
 * Dragging begins only from empty space, so task controls keep their normal click behavior. */
export function enhanceHorizontalScroll(element: HTMLElement) {
  let pointerId: number | null = null;
  let originX = 0;
  let originY = 0;
  let originLeft = 0;
  let moved = false;
  const interactive = [
    "button",
    "input",
    "select",
    "textarea",
    "a",
    "label",
    "[role='button']",
    ".ticktick-planner-task",
    ".ticktick-planner-month-task",
    ".ticktick-planner-range-task",
    ".ticktick-overflow-task",
    ".ticktick-project-card",
    ".ticktick-planner-day-header",
    ".ticktick-planner-month-header",
    ".ticktick-month-task-title",
    ".ticktick-task-title",
    ".ticktick-range-title",
    ".ticktick-overflow-task-title",
    ".ticktick-project-card-title"
  ].join(", ");

  element.addEventListener("pointerdown", event => {
    if (event.button !== 0 || element.scrollWidth <= element.clientWidth) return;
    // On touch, allow a swipe starting on a task card; a tap still reaches the
    // card because we only cancel its click after a real horizontal drag.
    if (event.pointerType !== "touch" && event.target instanceof HTMLElement && event.target.closest(interactive)) return;
    pointerId = event.pointerId;
    originX = event.clientX;
    originY = event.clientY;
    originLeft = element.scrollLeft;
    moved = false;
  });

  element.addEventListener("pointermove", event => {
    if (pointerId !== event.pointerId) return;
    const distance = event.clientX - originX;
    const verticalDistance = event.clientY - originY;
    // Never claim a vertical gesture.  On tablets this used to capture a
    // small sideways wobble while scrolling and made the page/drawer feel
    // stuck.  Horizontal panning begins only after a clearly horizontal move.
    if (!moved && Math.abs(distance) > 6 && Math.abs(distance) > Math.abs(verticalDistance)) {
      moved = true;
      element.addClass("is-horizontal-dragging");
      try {
        element.setPointerCapture(event.pointerId);
      } catch {}
    }
    if (moved) {
      element.scrollLeft = originLeft - distance;
      event.preventDefault();
      event.stopPropagation();
    }
  });

  const release = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    if (element.hasPointerCapture(event.pointerId)) {
      try {
        element.releasePointerCapture(event.pointerId);
      } catch {}
    }
    pointerId = null;
    element.removeClass("is-horizontal-dragging");
    setTimeout(() => { moved = false; }, 60);
  };

  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);

  // Obsidian's mobile/tablet sidebar gesture listens high in the tree. Keep
  // horizontal movement that starts on these surfaces from becoming a drawer
  // gesture while leaving vertical page scrolling untouched.
  element.addEventListener("touchmove", event => {
    if (!moved || event.touches.length !== 1) return;
    event.preventDefault();
    event.stopPropagation();
  }, { passive: false });

  element.addEventListener("click", event => {
    if (moved) {
      event.preventDefault();
      event.stopPropagation();
      moved = false;
    }
  }, { capture: true });

  element.addEventListener("wheel", event => {
    if (!event.shiftKey || element.scrollWidth <= element.clientWidth) return;
    const isRtl = getComputedStyle(element).direction === "rtl";
    let delta = 0;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      delta = event.deltaX;
    } else {
      // In RTL, moving forward in time (scroll down) advances to the left (negative scrollLeft).
      delta = isRtl ? -event.deltaY : event.deltaY;
    }
    element.scrollLeft += delta;
    event.preventDefault();
  }, { passive: false });
}

/** Ensure a horizontally scrollable container starts scrolled all the way to its start (far-right for RTL). */
export function scrollToStart(element: HTMLElement) {
  const align = () => {
    const isRtl = getComputedStyle(element).direction === "rtl";
    if (!isRtl) {
      element.scrollLeft = 0;
      return;
    }
    // In Chromium / Blink (Obsidian / Electron), RTL scrollLeft is 0 at the right edge.
    element.scrollLeft = 0;
    // Fallback if environment uses positive RTL scroll (0 at left, max at right):
    if (element.scrollLeft === 0 && element.scrollWidth > element.clientWidth) {
      element.scrollLeft = 1;
      if (element.scrollLeft > 0) {
        element.scrollLeft = element.scrollWidth - element.clientWidth;
      } else {
        element.scrollLeft = 0;
      }
    }
  };

  align();
  if (typeof requestAnimationFrame === "function") {
    requestAnimationFrame(align);
  }
}
