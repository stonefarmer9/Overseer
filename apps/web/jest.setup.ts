import '@testing-library/jest-dom';

// jsdom doesn't implement these, but vaul (used by the shadcn Drawer) calls them.
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};
Element.prototype.hasPointerCapture = () => false;

const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (element: Element, pseudoElt?: string | null) => {
  const style = originalGetComputedStyle(element, pseudoElt);
  if (!style.transform) {
    Object.defineProperty(style, 'transform', { value: 'none' });
  }
  return style;
};
