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
    pointerId = event.pointerId; originX = event.clientX; originLeft = element.scrollLeft; moved = false;
    element.setPointerCapture(event.pointerId);
  });
  element.addEventListener("pointermove", event => {
    if (pointerId !== event.pointerId) return;
    const distance = event.clientX - originX;
    if (Math.abs(distance) > 3) { moved = true; element.addClass("is-horizontal-dragging"); }
    if (moved) element.scrollLeft = originLeft - distance;
  });
  const release = (event: PointerEvent) => {
    if (pointerId !== event.pointerId) return;
    if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
    pointerId = null; element.removeClass("is-horizontal-dragging");
  };
  element.addEventListener("pointerup", release); element.addEventListener("pointercancel", release);
  element.addEventListener("wheel", event => {
    if (!event.shiftKey || element.scrollWidth <= element.clientWidth) return;
    const amount = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    element.scrollLeft += amount; event.preventDefault();
  }, { passive: false });
}
