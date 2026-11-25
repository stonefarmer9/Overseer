import { render } from '@testing-library/react';
import { SidebarMenuSkeleton } from './sidebar';

function skeletonWidthOf(container: HTMLElement) {
  const text = container.querySelector<HTMLElement>('[data-sidebar="menu-skeleton-text"]');
  return text?.style.getPropertyValue('--skeleton-width') ?? '';
}

it('gives the menu skeleton a width between 50% and 90%', () => {
  const { container } = render(<SidebarMenuSkeleton />);

  const width = Number.parseInt(skeletonWidthOf(container), 10);

  expect(width).toBeGreaterThanOrEqual(50);
  expect(width).toBeLessThan(90);
});

it('keeps the same skeleton width across re-renders', () => {
  const { container, rerender } = render(<SidebarMenuSkeleton />);
  const firstWidth = skeletonWidthOf(container);

  rerender(<SidebarMenuSkeleton />);

  expect(skeletonWidthOf(container)).toBe(firstWidth);
});
