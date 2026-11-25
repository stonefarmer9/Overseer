import { act, renderHook } from '@testing-library/react';
import { useIsMobile } from './use-mobile';

function mockViewport(initiallyMobile: boolean) {
  let matches = initiallyMobile;
  const listeners = new Set<() => void>();

  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    get matches() {
      return matches;
    },
    media: query,
    addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
  }));

  return {
    resize(mobile: boolean) {
      matches = mobile;
      listeners.forEach((listener) => listener());
    },
    listenerCount: () => listeners.size,
  };
}

it('returns true when the viewport is below the mobile breakpoint', () => {
  mockViewport(true);

  const { result } = renderHook(() => useIsMobile());

  expect(result.current).toBe(true);
});

it('returns false on a desktop-sized viewport', () => {
  mockViewport(false);

  const { result } = renderHook(() => useIsMobile());

  expect(result.current).toBe(false);
});

it('updates when the viewport crosses the breakpoint', () => {
  const viewport = mockViewport(false);
  const { result } = renderHook(() => useIsMobile());

  act(() => viewport.resize(true));
  expect(result.current).toBe(true);

  act(() => viewport.resize(false));
  expect(result.current).toBe(false);
});

it('stops listening for viewport changes after unmounting', () => {
  const viewport = mockViewport(false);
  const { unmount } = renderHook(() => useIsMobile());

  unmount();

  expect(viewport.listenerCount()).toBe(0);
});
