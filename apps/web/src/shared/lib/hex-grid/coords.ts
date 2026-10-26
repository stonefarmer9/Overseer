export type Hex = {
  q: number;
  r: number;
};
/**
 * A hex position in axial coordinates.
 * q = column axis, r = row axis.
 *  The third axis is implied: s = -q - r.
 */
const NEIGHBOUR_OFFSETS: Hex[] = [
  { q: 1, r: 0 }, // east
  { q: 1, r: -1 }, // north-east
  { q: 0, r: -1 }, // north-west
  { q: -1, r: 0 }, // west
  { q: -1, r: 1 }, // south-west
  { q: 0, r: 1 }, // south-east
];

export function neighbours(hex: Hex): Hex[] {
  return NEIGHBOUR_OFFSETS.map((offset) => ({
    q: hex.q + offset.q,
    r: hex.r + offset.r,
  }));
}

// Number of steps between two hexes.
export function distance(from: Hex, to: Hex): number {
  const qDifference = from.q - to.q;
  const rDifference = from.r - to.r;
  const sDifference = -(qDifference + rDifference); // the implied third axis

  return (Math.abs(qDifference) + Math.abs(rDifference) + Math.abs(sDifference)) / 2;
}

export function hexesInRadius(radius: number): Hex[] {
  const result: Hex[] = [];
  for (let q = -radius; q <= radius; q++) {
    const rMin = Math.max(-radius, -q - radius);
    const rMax = Math.min(radius, -q + radius);
    for (let r = rMin; r <= rMax; r++) {
      result.push({ q, r });
    }
  }
  return result;
}

// What it does

// A hex is within radius of the centre when all three axes stay within the radius: |q| ≤ radius, |r| ≤ radius and |s| ≤ radius, where s = -q - r.

// The function walks column by column (q from -radius to radius). For each column it works out which r values are allowed, then pushes a hex for each one.

// The two bounds come from the s rule. Requiring -radius ≤ -q - r ≤ radius and rearranging for r gives -q - radius ≤ r ≤ -q + radius. Combine that with the plain |r| ≤ radius rule and you get:

// rMin = max(-radius, -q - radius): the larger of the two lower limits
// rMax = min(radius, -q + radius): the smaller of the two upper limits

// Worked example with radius = 3 and q = -2:

// rMin = max(-3, 2 - 3) = -1
// rMax = min(3, 2 + 3) = 3
// So r runs from -1 to 3, which is 5 hexes. r = -2 would give s = 4, outside the radius.

// Across all seven columns you get 4 + 5 + 6 + 7 + 6 + 5 + 4 = 37 hexes, matching the test.

// Correction to the plan’s explanation: without the rMin/rMax clamp you don’t get a hole.
// You get a diamond of 7 × 7 = 49 hexes, because looping q and r independently from -radius to radius produces a parallelogram.
// The clamp trims its two opposite corners to leave a hexagon.
