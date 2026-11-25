import type { Hex } from './coords';

const SQRT3 = Math.sqrt(3);

export type Point = { x: number; y: number };

// Flat-top: the top and bottom of each hex are flat edges.

export function hexToPixel(h: Hex, size: number): Point {
  return {
    x: size * 1.5 * h.q,
    y: size * ((SQRT3 / 2) * h.q + SQRT3 * h.r),
  };
}

// The six corners of a hex, for an SVG <polygon>.

export function hexCorners(centre: Point, size: number): Point[] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i);
    return {
      x: centre.x + size * Math.cos(angle),
      y: centre.y + size * Math.sin(angle),
    };
  });
}
