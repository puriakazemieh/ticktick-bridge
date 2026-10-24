/** Make wide board/calendar surfaces usable with a mouse, trackpad, and touch.
 * Dragging begins only from empty space, so task controls keep their normal click behavior. */
export function enhanceHorizontalScroll(element: HTMLElement) {
  let pointerId: number | null = null;
  let originX = 0;
  let originLeft = 0;
  let moved = false;
  const interactive = "button, input, select, textarea, a, label";

  element.addEventListener("pointerdown", event => {
    if (event.button !== 0 || element.scrollWidth <= element.clientWidth) return;
    if (event.target instanceof HTMLElement && event.target.closest(interactive)) return;
    pointerId = event.pointerId;
    originX = event.clientX;
    originLeft = element.scrollLeft;
    moved = false;
    element.setPointerCapture(event.pointerId);
  });

  element.addEventListener("pointermove", event => {
    if (pointerId !== event.pointerId) return;
    const distance = event.clientX - originX;
    if (Math.abs(distance) > 3) {
      moved = true;
      element.addClass("is-horizontal-dragging");
    }
    if (moved) {
      element.scrollLeft = originLeft - distance;
    }
  });

  const release = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    pointerId = null;
    element.removeClass("is-horizontal-dragging");
  };

  element.addEventListener("pointerup", release);
  element.addEventListener("pointercancel", release);

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
