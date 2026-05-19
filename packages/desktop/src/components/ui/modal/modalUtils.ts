const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let modalOpenCount = 0;
let savedOverflow = "";
let savedPaddingRight = "";

export function getFocusableSelector() {
  return FOCUSABLE_SELECTOR;
}

export function lockBodyScroll() {
  if (modalOpenCount === 0) {
    savedOverflow = document.body.style.overflow;
    savedPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }
  modalOpenCount += 1;
  document.body.style.overflow = "hidden";

  return () => {
    modalOpenCount -= 1;
    if (modalOpenCount <= 0) {
      document.body.style.overflow = savedOverflow;
      document.body.style.paddingRight = savedPaddingRight;
      modalOpenCount = 0;
    }
  };
}

export function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => !el.hasAttribute("disabled"),
  );
}
