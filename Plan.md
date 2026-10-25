# Hex Map MVP: Code-Along Guide (FSD)

Goal: render a map of hexes, let a player select a hex, open a drawer, assign an owner, and show the owner as a coloured overlay.

This is a code-along. Each step says what we are doing, why, and gives the code. Type it yourself rather than pasting, so the reasons sink in.

All paths are relative to `apps/web/src/` unless stated otherwise.

**Assumptions used in the code below** (change them and the code follows):

- Axial coordinates, pointy-top hexes, radius 3 (37 hexes).
- The empty hex-grid files move from `shared/api/lib/hex-grid` to `shared/lib/hex-grid`.
- A new `/map` route, so the placeholder home page stays.
- `Dialog` for the drawer.
- Owners are a code constant. Ownership is stored in Prisma.

---

## Step 0: Start from a clean tree

**What:** Make sure the repo is in a known state before adding code.

**Why:** `AGENTS.md` has an uncommitted change and `server-only` is already a dependency. If they're mixed into your feature diff, review gets harder and a bad change is harder to revert.

```bash
git status
# Commit or stash the AGENTS.md change, then:
cd apps/web
npm run dev
```

Open the page and confirm the placeholder loads.

Before writing code, skim `node_modules/next/dist/docs/` for App Router, Server Actions and caching. `AGENTS.md` says this version of Next.js has breaking changes, and training data may be out of date.

---

## Step 1: Hex maths in `shared/lib/hex-grid`

**What:** Pure functions for the grid: neighbours, distance, a list of hexes in a radius, and conversion to pixels.

**Why it goes in `shared/lib`:** It's geometry with no game rules, so any feature can use it. `shared/api` is for infrastructure clients like the database, so the existing empty files there are in the wrong place. Move them first:

```bash
mkdir -p apps/web/src/shared/lib/hex-grid
git mv apps/web/src/shared/api/lib/hex-grid/* apps/web/src/shared/lib/hex-grid/
rmdir apps/web/src/shared/api/lib/hex-grid apps/web/src/shared/api/lib
```

**Why axial coordinates:** Each hex is `{ q, r }`. Neighbours and distance are simple arithmetic with no special cases. A third value `s = -q - r` is implied, which is why the maths below uses `dq + dr`.

### `coords.ts`

```ts
export type Hex = { q: number; r: number };

// Six steps around a hex, in axial coordinates.
const DIRECTIONS: Hex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function neighbours(h: Hex): Hex[] {
  return DIRECTIONS.map((d) => ({ q: h.q + d.q, r: h.r + d.r }));
}

export function distance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

// All hexes whose distance from {0,0} is at most `radius`.
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
```

**Why the `rMin`/`rMax` lines:** For a given `q`, `r` can only range over values that keep the implied `s = -q - r` within `[-radius, radius]`. Without that bound you'd get a hexagon-shaped hole or extra hexes.

### `layout.ts`

```ts
import type { Hex } from './coords';

const SQRT3 = Math.sqrt(3);

export type Point = { x: number; y: number };

// Pointy-top: the top of each hex is a point.
export function hexToPixel(h: Hex, size: number): Point {
  return {
    x: size * (SQRT3 * h.q + (SQRT3 / 2) * h.r),
    y: size * (1.5 * h.r),
  };
}

// The six corners of a hex, for an SVG <polygon>.
export function hexCorners(centre: Point, size: number): Point[] {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 30);
    return {
      x: centre.x + size * Math.cos(angle),
      y: centre.y + size * Math.sin(angle),
    };
  });
}
```

**Why `- 30`:** Pointy-top hexes have a corner pointing straight up. With SVG's y-down coordinates, the offset puts the corners at the right angles.

### `index.ts`

```ts
export * from './coords';
export * from './layout';
```

### Tests

Put these next to the code, as `hex-grid.test.ts`:

```ts
import { distance, hexesInRadius, neighbours } from './index';

describe('hex-grid', () => {
  it('returns six distinct neighbours of the origin', () => {
    const n = neighbours({ q: 0, r: 0 });
    const unique = new Set(n.map((h) => `${h.q},${h.r}`));
    expect(unique.size).toBe(6);
  });

  it('measures distance between two hexes', () => {
    expect(distance({ q: 0, r: 0 }, { q: 2, r: -1 })).toBe(2);
  });

  it('builds a radius-3 map with 37 hexes', () => {
    expect(hexesInRadius(3)).toHaveLength(37);
  });
});
```

**Check:** `npm run test` passes.

---

## Step 2: Store ownership in Prisma (needs approval)

**What:** Add a `Hex` table with a row per hex, and a seed script that creates all of them.

**Why a table and not local storage or memory:** Local storage only shows one person's view. An in-memory store resets on restart. A table survives reloads and can be shared later.

**Why ask first:** `AGENTS.md` says schema changes need permission.

### `prisma/schema.prisma`

```prisma
model Hex {
  id      String  @id @default(cuid())
  q       Int
  r       Int
  ownerId String?

  @@unique([q, r])
}
```

**Why `ownerId` has no relation:** Owners are a code constant (Step 3), not a table. The server action checks that the id is valid. If you later move owners into the database, you can add a relation.

**Why `@@unique([q, r])`:** The database refuses duplicate coordinates, so the seed can't create the same hex twice.

Then create the migration:

```bash
cd apps/web
npx prisma migrate dev --name add-hex
npx prisma generate
```

### `prisma/seed.ts`

```ts
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import { hexesInRadius } from '../src/shared/lib/hex-grid';

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? 'file:./dev.db',
});
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const { q, r } of hexesInRadius(3)) {
    await prisma.hex.upsert({
      where: { q_r: { q, r } },
      update: {},
      create: { q, r },
    });
  }
}

main().finally(() => prisma.$disconnect());
```

**Why not import `db.ts`:** It imports `server-only`, which throws outside the Next.js server. A standalone script needs its own client.

**Why `upsert`:** Running the seed twice doesn't duplicate rows, and `update: {}` leaves existing owners alone.

Prisma 7 moved the seed command into `prisma.config.ts`. Check the current docs for the exact key before you add it. Then run `npx prisma db seed`.

**Check:** Open the database and confirm there are 37 rows.

---

## Step 3: The owner list (`entities/owner`)

**What:** A typed constant with the owners and their colours.

**Why a constant:** The list changes rarely and is small. A constant is typed, needs no database, and can be imported by client and server code.

### `model/owners.ts`

```ts
export const OWNERS = [
  { id: 'red', name: 'Red', colour: '#dc2626' },
  { id: 'blue', name: 'Blue', colour: '#2563eb' },
  { id: 'green', name: 'Green', colour: '#16a34a' },
] as const;

export type Owner = (typeof OWNERS)[number];
export type OwnerId = Owner['id'];

export function getOwner(id: string): Owner | undefined {
  return OWNERS.find((o) => o.id === id);
}
```

**Why `as const`:** It makes `OwnerId` a union of the exact ids (`'red' | 'blue' | 'green'`), so a typo is a compile error.

**Why `getOwner` takes a `string`:** Data from the browser is untyped, so the action has to check at runtime. The function returns `undefined` for unknown ids.

### `index.ts`

```ts
export * from './model/owners';
```

---

## Step 4: The hex entity (`entities/hex`)

**What:** The data type, a read function, and a single SVG cell.

### `model/types.ts`

```ts
export type HexRecord = {
  id: string;
  q: number;
  r: number;
  ownerId: string | null;
};
```

**Why not use Prisma's type directly:** The UI shouldn't depend on Prisma. This type is what crosses to the client.

### `api/get-hexes.ts`

```ts
import 'server-only';
import { prisma } from '@/shared/api/db';
import type { HexRecord } from '../model/types';

export async function getHexes(): Promise<HexRecord[]> {
  return prisma.hex.findMany({
    select: { id: true, q: true, r: true, ownerId: true },
    orderBy: [{ r: 'asc' }, { q: 'asc' }],
  });
}
```

**Why `select`:** It's explicit about what leaves the server.

**Why `server-only`:** It stops this file from being bundled into client code.

### `ui/hex-cell.tsx`

```tsx
import { hexCorners, hexToPixel } from '@/shared/lib/hex-grid';
import type { Owner } from '@/entities/owner';
import type { HexRecord } from '../model/types';

const SIZE = 30;

type HexCellProps = {
  hex: HexRecord;
  owner?: Owner;
  onSelect: (id: string) => void;
};

export function HexCell({ hex, owner, onSelect }: HexCellProps) {
  const centre = hexToPixel(hex, SIZE);
  const points = hexCorners(centre, SIZE)
    .map((p) => `${p.x},${p.y}`)
    .join(' ');

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Hex ${hex.q},${hex.r}`}
      onClick={() => onSelect(hex.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onSelect(hex.id);
      }}
    >
      <polygon points={points} fill={owner?.colour ?? '#d4d4d8'} stroke="#52525b" />
    </g>
  );
}
```

**Why a plain component:** It doesn't need its own `'use client'`. Only the parent that holds state (Step 7) is interactive. Keeping cells as plain components means fewer client boundaries.

**Why `owner` is a prop:** `HexCell` doesn't import from `entities/owner`. The widget looks the owner up and passes it in. This keeps entities from depending on each other, which FSD discourages.

**Why `role` and `aria-label`:** They make the cell reachable by keyboard and easy to query in tests.

### `index.ts`

```ts
export { HexCell } from './ui/hex-cell';
export { getHexes } from './api/get-hexes';
export type { HexRecord } from './model/types';
```

---

## Step 5: The assign-owner action (`features/assign-hex-owner`)

**What:** A server action that updates one hex, and a drawer that calls it.

**Why a server action:** The write happens on the server, so the browser never touches the database. `AGENTS.md` requires sensitive operations to run server-side.

**Why validate on the server:** Anything from the client can be forged. The UI only offers valid owners, but the action must check again.

### `api/assign-hex-owner.ts`

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/api/db';
import { getOwner, type OwnerId } from '@/entities/owner';

type AssignInput = { hexId: string; ownerId: OwnerId | null };
type AssignResult = { ok: true } | { ok: false; error: string };

export async function assignHexOwner(input: AssignInput): Promise<AssignResult> {
  if (!input.hexId) {
    return { ok: false, error: 'Missing hex id' };
  }
  if (input.ownerId !== null && !getOwner(input.ownerId)) {
    return { ok: false, error: 'Unknown owner' };
  }

  try {
    await prisma.hex.update({
      where: { id: input.hexId },
      data: { ownerId: input.ownerId },
    });
  } catch {
    return { ok: false, error: 'Hex not found' };
  }

  revalidatePath('/map');
  return { ok: true };
}
```

**Why return a result instead of throwing:** The drawer can show the error text directly. Thrown errors in Server Actions reach the client in a less friendly form.

**Why `revalidatePath`:** It tells Next.js the cached page is stale. The map also updates locally (Step 7), so this is for reloads.

**Why `catch {}` with no detail:** Prisma's error messages are for developers. A generic message avoids leaking internals.

### `ui/assign-owner-drawer.tsx`

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, Button } from '@warmaster/ui';
import { OWNERS, type OwnerId } from '@/entities/owner';
import type { HexRecord } from '@/entities/hex';
import { assignHexOwner } from '../api/assign-hex-owner';

type Props = {
  hex: HexRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: (hexId: string, ownerId: OwnerId | null) => void;
};

export function AssignOwnerDrawer({ hex, open, onOpenChange, onAssigned }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function assign(ownerId: OwnerId | null) {
    if (!hex) return;
    setError(null);
    startTransition(async () => {
      const result = await assignHexOwner({ hexId: hex.id, ownerId });
      if (result.ok) {
        onAssigned(hex.id, ownerId);
        onOpenChange(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign owner</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {OWNERS.map((o) => (
            <Button key={o.id} disabled={pending} onClick={() => assign(o.id)}>
              {o.name}
            </Button>
          ))}
          <Button variant="outline" disabled={pending} onClick={() => assign(null)}>
            Clear owner
          </Button>
        </div>

        {error && <p role="alert">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
```

**Why `useTransition`:** It marks the server call as pending so the buttons disable and the UI stays responsive.

**Why `onAssigned` and not a reload:** The map updates instantly. A full reload would lose the user's place.

**Why buttons:** With three owners, one tap is quicker than opening a select. Switch to `Select` (Decision H) when the list grows.

**Check the imports:** The names from `@warmaster/ui` are my best guess. Compare them with what that package actually exports.

### `index.ts`

```ts
export { AssignOwnerDrawer } from './ui/assign-owner-drawer';
export { assignHexOwner } from './api/assign-hex-owner';
```

---

## Step 6: Why `Dialog` for now

The drawer is a single component, so you can swap `Dialog` for a `Sheet` later by editing one file. Adding `Sheet` may need a new dependency (`vaul`), which needs approval. Start with `Dialog`.

---

## Step 7: The map widget (`widgets/hex-map`)

**What:** The client component that ties the grid, selection and drawer together.

**Why a widget:** It combines several entities and features into one block. FSD puts that kind of composition in `widgets`.

**Why it's a client component:** It holds `selectedId` and handles clicks.

### `ui/hex-map.tsx`

```tsx
'use client';

import { useState } from 'react';
import { HexCell, type HexRecord } from '@/entities/hex';
import { getOwner } from '@/entities/owner';
import { AssignOwnerDrawer } from '@/features/assign-hex-owner';
import { hexToPixel, hexCorners } from '@/shared/lib/hex-grid';

const SIZE = 30;

type Props = { hexes: HexRecord[] };

export function HexMap({ hexes: initial }: Props) {
  const [hexes, setHexes] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = hexes.find((h) => h.id === selectedId) ?? null;

  const viewBox = computeViewBox(hexes, SIZE);

  return (
    <>
      <svg viewBox={viewBox} className="w-full h-auto">
        {hexes.map((hex) => (
          <HexCell
            key={hex.id}
            hex={hex}
            owner={hex.ownerId ? getOwner(hex.ownerId) : undefined}
            onSelect={setSelectedId}
          />
        ))}
      </svg>

      <AssignOwnerDrawer
        hex={selected}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onAssigned={(hexId, ownerId) =>
          setHexes((prev) => prev.map((h) => (h.id === hexId ? { ...h, ownerId } : h)))
        }
      />
    </>
  );
}

function computeViewBox(hexes: HexRecord[], size: number): string {
  const corners = hexes.flatMap((h) => hexCorners(hexToPixel(h, size), size));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX;
  const height = Math.max(...ys) - minY;
  return `${minX} ${minY} ${width} ${height}`;
}
```

**Why `useState(initial)`:** The server gives the first version. After an assignment, the local copy changes so the colour updates without a reload. Props only seed the state.

**Why `selected` is derived:** Storing the hex object would go stale when its owner changes. Storing only the id and looking it up each render always gives current data.

**Why `computeViewBox`:** The map fits whatever size the hexes make, so changing the radius needs no other changes.

**Why `onOpenChange` ignores `true`:** The drawer only opens by selecting a hex. The `open` prop already handles that.

### `index.ts`

```ts
export { HexMap } from './ui/hex-map';
```

**Decision J:** If this component grows, move the state into `model/useHexSelection.ts`. Don't do it yet.

---

## Step 8: The page (`app/map/page.tsx`)

**What:** A Server Component that loads the data and renders the widget.

**Why a Server Component:** It can call `getHexes()` directly, with no API route and no client-side fetch.

```tsx
import { getHexes } from '@/entities/hex';
import { HexMap } from '@/widgets/hex-map';

export default async function MapPage() {
  const hexes = await getHexes();
  return <HexMap hexes={hexes} />;
}
```

**Why `/map`:** The placeholder home page stays. If you'd rather replace it, move this into `app/page.tsx`.

**Check the caching:** Next.js 16 changed some caching defaults. If the map shows stale data after a reload, check the docs for `dynamic` and fetch caching before adding `force-dynamic`.

---

## Step 9: Tests

**What:** Test the maths, the cell, and the assign flow.

**Why:** `AGENTS.md` requires tests for new components and non-trivial logic, and this also checks that the Jest setup works.

**Test behaviour through the UI.** Query by role and name, not CSS classes.

### `HexCell`

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HexCell } from './hex-cell';

const hex = { id: 'a', q: 0, r: 0, ownerId: null };

it('calls onSelect when the hex is clicked', async () => {
  const onSelect = jest.fn();
  render(<HexCell hex={hex} onSelect={onSelect} />);

  await userEvent.click(screen.getByRole('button', { name: 'Hex 0,0' }));

  expect(onSelect).toHaveBeenCalledWith('a');
});

it('fills the hex with the owner colour', () => {
  const { container } = render(
    <HexCell hex={hex} owner={{ id: 'red', name: 'Red', colour: '#dc2626' }} onSelect={() => {}} />
  );

  expect(container.querySelector('polygon')).toHaveAttribute('fill', '#dc2626');
});
```

**Why `userEvent` may need installing:** If `@testing-library/user-event` isn't in `package.json`, it's a new dependency and needs approval. Use `fireEvent.click` from `@testing-library/react` if you'd rather not add it.

### The assign flow

Mock the server action so the test doesn't touch the database:

```tsx
jest.mock('@/features/assign-hex-owner', () => ({
  AssignOwnerDrawer: jest.requireActual('@/features/assign-hex-owner').AssignOwnerDrawer,
  assignHexOwner: jest.fn().mockResolvedValue({ ok: true }),
}));
```

Then test that selecting a hex, then an owner, changes the cell's fill.

**Why mock:** The unit under test is the UI flow, not the database. Mocks also let you test the error path by returning `{ ok: false, error: 'Hex not found' }`.

**Why the mock is partial:** Only the action needs replacing. The drawer stays real.

**Test-file note:** Tests that import `db.ts` will hit `server-only`. Mock `@/shared/api/db` as well if a test pulls it in.

---

## Step 10: Verify

Run these in order:

1. `npm run lint`
2. `npm run test`
3. `npm run build`
4. `npm run dev`, open `/map`, click a hex, assign an owner, reload, and confirm the colour stays.

Run Prettier on staged files before each commit, as the `prettier-on-commit` skill requires.

---

## Decisions to confirm

1. **Step 2:** Approve the `Hex` model and migration?
2. **Step 1:** Pointy-top (as coded) or flat-top? Axial is the default.
3. **Step 1:** Radius 3, or another size?
4. **Step 3:** The three owners and colours above: correct, or different?
5. **Step 6:** `Dialog` (as coded), or a `Sheet` with a new dependency?
6. **Step 8:** `/map` (as coded), or replace the home page?
7. **Step 1:** Move the empty files to `shared/lib/hex-grid` (as coded)?
