# Campaign Create Flow: Step-by-Step Guide

This guide walks through building the campaign feature for Overseer. Each step explains **what** we are doing, **why** we are doing it that way, and **how** to check it worked. Nothing here has been implemented yet.

Repository root: `/Users/georgeslevaillant/Projects/overseer`
Web app: `/Users/georgeslevaillant/Projects/overseer/apps/web`
Faction source: `/Users/georgeslevaillant/Projects/overseer/Factions.md`

---

## 0. Goal and Scope

### What the user can do when this is finished

1. Open a **Create campaign** page.
2. Give the campaign a name.
3. Choose a size: **Small**, **Medium**, **Large** (default), or **Huge**. The size decides how many hexes the board has.
4. Name the attacker and defender, and pick a Warhammer 40k faction for each.
5. Create the campaign. The board is generated automatically.
6. On the campaign page, assign hexes to the attacker or the defender. Hexes can be reassigned at any time, so a hex can change hands after a battle.
7. Each hex is drawn in its owner's faction colours.
8. The sidebar lists campaigns, using each campaign's name.

### Not covered here

- Real user accounts and login. That is the next step, see `/Users/georgeslevaillant/.opencode/plan/long-term-plan.md`. Until then, players are just names.
- The "creator only" and "campaigns you are part of" rules. These need user accounts to enforce, so they are deferred (see Section 1).

### Why this order

- **Pure logic first** (sizes, factions): easy to test, needs no database.
- **Database second**: needs your approval (AGENTS.md section 8), and everything after depends on it.
- **Server code third**: turns data into actions the UI can call.
- **UI last**: the easiest part to change, so it goes last.

---

## 1. Decisions (all final)

| #   | Decision                   | Your answer                                                                                                                                                    | What it means for the code                                                                                                               |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | How players are identified | Names only for now. Full profiles are the next step.                                                                                                           | `Player` stores a `name`. No `User` model yet.                                                                                           |
| D2  | Board sizes                | Small 1 (7 hexes), Medium 2 (19), Large 3 (37, default), Huge 4 (61)                                                                                           | `radiusFor` in Phase 1.                                                                                                                  |
| D3  | Factions                   | Full list from `Factions.md`, grouped Imperium / Chaos / Xenos                                                                                                 | Grouped data in Phase 2.                                                                                                                 |
| D4  | Who sets up the board      | Only the creator. Done together at one laptop, or by one person in advance.                                                                                    | Laptop convention for now: the app does not enforce it. Shown as a note on the campaign page. No server check until user profiles exist. |
| D5  | Lock after start           | **No lock.** Hexes stay editable and can be reassigned after battles.                                                                                          | No `status` field. Simpler schema.                                                                                                       |
| D6  | Old global hexes           | Remove them and re-seed per campaign.                                                                                                                          | Phase 3 migration.                                                                                                                       |
| D7  | Colours                    | Colour by faction. Factions with `&` show a main colour (fill) and a second colour (thicker outline).                                                          | Colour data in Phase 2.                                                                                                                  |
| D8  | Sidebar                    | Lists campaigns, using each campaign's name instead of "Campaign 1/2/3". For now it shows **all** campaigns. Filtering by membership comes with user profiles. | Campaign `name` is required. Sidebar reads every campaign.                                                                               |

### Deferred to user profiles

- **"Only the creator sets up the board" (D4)** is a laptop convention until accounts exist. The app does not block other people from editing hexes.
- **"Sidebar shows only my campaigns" (D8)** waits for accounts. Until then, every campaign shows in the sidebar.

---

## 2. Phase 1: Campaign Size Rules (pure logic)

### What

One file that maps size names to hex radius, and gives a fixed list of sizes for the UI.

### Why

- The size rules are business logic. Keeping them in one place means the form, the server action, and the tests all use the same numbers.
- Pure functions (no database, no React) are the easiest to test.
- `hexesInRadius` already exists and is tested (`/Users/georgeslevaillant/Projects/overseer/apps/web/src/shared/lib/hex-grid/hex-grid.test.ts`), so we reuse it instead of writing new grid code.

### Where (FSD layer: entities)

A campaign is a domain concept, so it lives in `entities`. A **feature** is an action a user takes (like "create campaign"), and an **entity** is a thing in the domain (like "campaign"). FSD allows `features` to import from `entities`, but not the other way round.

- Create: `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/campaign/model/size.ts`
- Create: `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/campaign/model/size.test.ts`
- Create: `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/campaign/index.ts`

### How

`size.ts`:

```ts
export const CAMPAIGN_SIZES = ['small', 'medium', 'large', 'huge'] as const;
export type CampaignSize = (typeof CAMPAIGN_SIZES)[number];

export const DEFAULT_CAMPAIGN_SIZE: CampaignSize = 'large';

const RADIUS_BY_SIZE: Record<CampaignSize, number> = {
  small: 1,
  medium: 2,
  large: 3,
  huge: 4,
};

export function radiusFor(size: CampaignSize): number {
  return RADIUS_BY_SIZE[size];
}
```

Why `as const` plus a derived type: the array gives the UI a list to loop over, and the type comes from the same array, so they can never disagree.

Why `Record<CampaignSize, number>`: TypeScript fails to compile if a size is missing from the map.

`size.test.ts` should check:

- `hexesInRadius(radiusFor('large')).length` is 37.
- The four sizes give 7, 19, 37, and 61 hexes.
- `DEFAULT_CAMPAIGN_SIZE` is `'large'`.

Test names describe behaviour, for example `it("builds a 37 hex board for a large campaign")`, as AGENTS.md asks.

### Verify

```bash
cd /Users/georgeslevaillant/Projects/overseer/apps/web && npm test
```

---

## 3. Phase 2: Factions and Colours (static data)

### What

Factions from `Factions.md`, grouped into three sections (Imperium, Chaos, Xenos), each with a **primary** colour (the fill) and an optional **secondary** colour (a thicker outline).

### Why

- Factions don't change during a campaign, so a code list avoids a database table and a migration.
- Grouping mirrors how your `Factions.md` is written, which makes the list easy to check against the source.
- Storing colours with the faction means the board code never has to know about factions. It just asks for a faction's colours.

### Where (FSD layer: entities)

- Create: `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/faction/model/factions.ts`
- Create: `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/faction/model/factions.test.ts`
- Create: `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/faction/index.ts`

### How

Shape of the data:

```ts
export type FactionColours = { primary: string; secondary?: string };

export type Faction = {
  id: string;
  name: string;
  colours: FactionColours;
};

export type FactionGroup = {
  name: string;
  factions: Faction[];
};

export const FACTION_GROUPS: FactionGroup[] = [
  {
    name: 'The Imperium of Man',
    factions: [/* see table below */],
  },
  { name: 'Chaos', factions: [/* ... */] },
  { name: 'Xenos', factions: [/* ... */] },
];

export const FACTIONS: Faction[] = FACTION_GROUPS.flatMap((group) => group.factions);

export function getFaction(id: string): Faction | undefined {
  return FACTIONS.find((faction) => faction.id === id);
}
```

Why `FACTIONS` is derived from `FACTION_GROUPS`: there is only one source of truth. The flat list used by lookups and the grouped list used by the UI can't drift apart.

Why `secondary` is optional: most factions have one colour, and the type should say so.

Why string `id`s with dashes: stable keys for the database and URLs, while `name` can change wording without breaking stored data.

### Faction colour table

Colour values are my best match for each descriptor. Adjust any you don't like; they are one line each.

**The Imperium of Man**

| id                   | Name               | primary                 | secondary         |
| -------------------- | ------------------ | ----------------------- | ----------------- |
| `space-marines`      | Space Marines      | `#0047AB` (cobalt blue) |                   |
| `blood-angels`       | Blood Angels       | `#DC2626` (red)         |                   |
| `dark-angels`        | Dark Angels        | `#14532D` (dark green)  |                   |
| `space-wolves`       | Space Wolves       | `#6B7B8C` (blue-grey)   |                   |
| `black-templars`     | Black Templars     | `#000000` (black)       | `#FFFFFF` (white) |
| `deathwatch`         | Deathwatch         | `#000000` (black)       | `#DC2626` (red)   |
| `grey-knights`       | Grey Knights       | `#C0C0C0` (silver)      |                   |
| `astra-militarum`    | Astra Militarum    | `#808000` (olive)       |                   |
| `adepta-sororitas`   | Adepta Sororitas   | `#FFFFFF` (white)       | `#DC2626` (red)   |
| `adeptus-mechanicus` | Adeptus Mechanicus | `#7F1D1D` (dark red)    |                   |
| `adeptus-custodes`   | Adeptus Custodes   | `#D4AF37` (gold)        |                   |
| `imperial-knights`   | Imperial Knights   | `#1D4ED8` (royal blue)  |                   |
| `imperial-agents`    | Imperial Agents    | `#FACC15` (yellow)      |                   |

**Chaos**

| id                    | Name                | primary                    | secondary        |
| --------------------- | ------------------- | -------------------------- | ---------------- |
| `chaos-space-marines` | Chaos Space Marines | `#000000` (black)          | `#D4AF37` (gold) |
| `world-eaters`        | World Eaters        | `#8B0000` (blood red)      |                  |
| `thousand-sons`       | Thousand Sons       | `#1E90FF` (bright blue)    |                  |
| `death-guard`         | Death Guard         | `#7C9A3B` (sickly green)   |                  |
| `emperors-children`   | Emperor's Children  | `#F472B6` (pink)           |                  |
| `chaos-daemons`       | Chaos Daemons       | `#7E22CE` (purple)         |                  |
| `chaos-knights`       | Chaos Knights       | `#0B1F3A` (very dark blue) |                  |

**Xenos**

| id                  | Name              | primary                    | secondary |
| ------------------- | ----------------- | -------------------------- | --------- |
| `tyranids`          | Tyranids          | `#E8A87C` (flesh)          |           |
| `orks`              | Orks              | `#22C55E` (bright green)   |           |
| `necrons`           | Necrons           | `#0F3D2E` (black-green)    |           |
| `aeldari`           | Aeldari           | `#FDE047` (yellow)         |           |
| `drukhari`          | Drukhari          | `#14B8A6` (turquoise)      |           |
| `tau-empire`        | T'au Empire       | `#F97316` (orange)         |           |
| `genestealer-cults` | Genestealer Cults | `#C084C8` (pinkish purple) |           |
| `leagues-of-votann` | Leagues of Votann | `#4C1D95` (dark purple)    |           |

Note: `Factions.md` spells "Turqouise" and "Orrange" with typos. The names above are corrected. The `id`s don't change, so this won't affect stored data.

### Verify

- `getFaction('orks')?.name` is `'Orks'`.
- An unknown id returns `undefined`.
- Every `id` is unique.
- Every group contains the factions you listed in `Factions.md` (13 Imperium, 7 Chaos, 8 Xenos = 28 total).
- Every faction with an `&` in `Factions.md` has a `secondary` colour.

---

## 4. Phase 3: Database Changes (REQUIRES YOUR APPROVAL)

> **Stop point.** AGENTS.md section 8 requires explicit permission for schema and database changes. Do not start this phase until you approve.

### What

Edit `/Users/georgeslevaillant/Projects/overseer/apps/web/prisma/schema.prisma` to add:

1. `Campaign`: name, size, created date.
2. `Player`: one attacker and one defender per campaign, each with a name and a faction.
3. `campaignId` on `Hex`, with uniqueness per campaign.

### Why

- Hexes are currently global. Every campaign would share the same ownership. A `campaignId` on each hex fixes that.
- The attacker and defender are a fixed pair, so a unique `(campaignId, role)` pair enforces it in the database, not only in the UI.
- `@@unique([campaignId, q, r])` is needed because two campaigns will both have a hex at `(0, 0)`.
- No `status` field, because there is no lock (D5).

### Proposed schema

```prisma
model Campaign {
  id        String   @id @default(cuid())
  name      String
  size      String
  createdAt DateTime @default(now())
  players   Player[]
  hexes     Hex[]
}

model Player {
  id         String   @id @default(cuid())
  campaignId String
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  role       String
  name       String
  factionId  String
  hexes      Hex[]

  @@unique([campaignId, role])
}

model Hex {
  id         String    @id @default(cuid())
  q          Int
  r          Int
  campaignId String
  campaign   Campaign  @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  ownerId    String?
  owner      Player?   @relation(fields: [ownerId], references: [id])

  @@unique([campaignId, q, r])
}
```

### Explaining the choices

- **Strings, not enums, for `size` and `role`:** SQLite (the provider in `schema.prisma`) does not support Prisma enums. The allowed values live in code (`CAMPAIGN_SIZES` in Phase 1, and the `'attacker' | 'defender'` roles). If you move to Postgres later, enums can replace them.
- **`onDelete: Cascade`:** deleting a campaign deletes its players and hexes. Without it, deleting a campaign would fail while it still has hexes.
- **`ownerId` is a relation to `Player`:** the database refuses an owner that doesn't exist. The old values `red` / `blue` / `green` are not `Player` ids, so the old hex data becomes invalid. D6 says to remove it anyway.
- **`Player.hexes`:** the other side of `Hex.owner`. Prisma needs both sides of a relation declared.
- **Reassignment is just an update.** Changing `ownerId` moves a hex from one player to the other. No extra table is needed for now. Battle history (in `/Users/georgeslevaillant/.opencode/plan/long-term-plan.md`) would add one later.

### Migration steps

```bash
cd /Users/georgeslevaillant/Projects/overseer/apps/web
npx prisma migrate dev --name add_campaigns
```

Then:

1. Prisma will warn about existing hexes that don't have a `campaignId`. Confirm the reset. This is a local SQLite file, so only local data is affected (D6).
2. Update `/Users/georgeslevaillant/Projects/overseer/apps/web/prisma/seed.ts` so it no longer creates global hexes. Hexes are created per campaign in Phase 4.
3. `npx prisma generate` if the client isn't regenerated automatically.

### Verify

- `npx prisma migrate status` reports the database is up to date.
- `npx prisma studio` shows the `Campaign`, `Player`, and `Hex` tables.

---

## EDITS TO PREVIOUS

Line numbers below refer to `campaign-create-flow.md` **before** these edits. Sections 0 to 4 are otherwise unchanged. Everything from Section 5 onwards has been rewritten.

### E1. Phase 1: `apps/web/src/entities/campaign/index.ts` (original lines 58 to 76)

Status: complete. The current file already has the export the later steps need. No change is required:

```ts
export { CAMPAIGN_SIZES, DEFAULT_CAMPAIGN_SIZE, radiusFor, type CampaignSize } from './model/size';
```

Phase 4 step 2 adds the type exports to this file.

### E2. Phase 2: folder name and `FACTION_GROUPS` shape (original lines 120 to 237)

Status: complete. Three things differ from the original text:

1. **Name is `factions` (plural), and it stays that way.** Replace every `entities/faction/` path in this section (original lines 134 to 136) with `entities/factions/`, and every import `@/entities/faction` with `@/entities/factions`. The plural name is deliberate: this entity will hold more than one faction-type concept later on, so the folder is `apps/web/src/entities/factions/` and nothing should be renamed to `faction`.

2. **Shape of the data.** Replace the code block at original lines 140 to 172 with the block below. The colour rows from the table at original lines 184 to 225 go inside the group `factions` arrays, unchanged. Each row looks like `{ id: 'space-marines', name: 'Space Marines', colours: { primary: '#0047AB' } }`, and a faction with a `&` gets `secondary` too. The file `apps/web/src/entities/factions/model/factions.ts` is the working reference.

```ts
export type FactionColours = { readonly primary: string; readonly secondary?: string };

export type Faction = {
  readonly id: string;
  readonly name: string;
  readonly colours: FactionColours;
};

export type FactionGroup = {
  readonly name: string;
  readonly factions: readonly Faction[];
};

export const FACTION_GROUPS = [
  {
    name: 'The Imperium of Man',
    factions: [/* rows from the Imperium table */],
  },
  {
    name: 'Chaos',
    factions: [/* rows from the Chaos table */],
  },
  {
    name: 'Xenos',
    factions: [/* rows from the Xenos table */],
  },
] as const satisfies readonly FactionGroup[];

export type FactionId = (typeof FACTION_GROUPS)[number]['factions'][number]['id'];

type FactionEntry = (typeof FACTION_GROUPS)[number]['factions'][number];

export const FACTIONS: readonly FactionEntry[] = FACTION_GROUPS.reduce<FactionEntry[]>(
  (all, group) => [...all, ...group.factions],
  []
);

const FACTIONS_BY_ID = Object.fromEntries(
  FACTIONS.map((faction) => [faction.id, faction] as const)
) as Record<FactionId, Faction>;

export function getFaction(id: FactionId): Faction {
  return FACTIONS_BY_ID[id];
}

function isFactionId(value: unknown): value is FactionId {
  return typeof value === 'string' && Object.hasOwn(FACTIONS_BY_ID, value);
}

export function parseFactionId(raw: unknown): FactionId | null {
  return isFactionId(raw) ? raw : null;
}
```

Why `getFaction` takes a `FactionId`: callers that receive an id from outside the code (a form, a URL, the database) must first pass it through `parseFactionId`. Everything after that is type-safe and never sees `undefined`.

3. **Verify list.** Replace original lines 231 and 232 with:

```text
- `getFaction('orks').name` is `'Orks'`.
- `parseFactionId('not-a-faction')` returns `null`.
```

The other verify lines (original 233 to 235) are unchanged.

### E3. Phase 3: database (original lines 239 to 314)

Status: complete. Schema and migration are applied locally and the Phase 3 verify checks pass.

1. **Heading (original line 239).** Replace with:

```md
## 4. Phase 3: Database Changes (DONE)
```

2. **Stop point (original line 241).** Replace with:

```md
> **Status: complete.** Approved and applied to the local SQLite database.
```

3. **Schema header.** `apps/web/prisma/schema.prisma` must start with the `generator` and `datasource` blocks. The models follow them:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
}
```

4. **Migration steps (original lines 303 to 314).** Replace the whole block with:

```bash
cd /Users/georgeslevaillant/Projects/overseer/apps/web
npx prisma migrate dev --create-only --name add_campaigns
```

Open the generated `prisma/migrations/<timestamp>_add_campaigns/migration.sql`. Prisma rebuilds the `Hex` table, and the copy step fails on the new required `campaignId`. Add a delete before the copy, directly after `PRAGMA foreign_keys=OFF;`:

```sql
PRAGMA foreign_keys=OFF;

DELETE FROM "Hex";
```

Then apply it:

```bash
npx prisma migrate dev
npx prisma migrate status
```

Local data only. The existing global hexes are removed (D6). Confirm with the user before running this against any other database.

5. **Seed removed.** `apps/web/prisma/seed.ts` is deleted, and so is the seed command. Hexes are created per campaign in Phase 4. The `apps/web/prisma.config.ts` file has no seed entry. It should look like this:

```ts
import 'dotenv/config';
import { defineConfig, env } from '@prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },

  datasource: {
    url: env('DATABASE_URL'),
  },
});
```

### E4. Sections 10 and 11 (original lines 580 to 587 and 597 to 598)

Rewritten at the end of this document. The Phase 1 to 3 checkboxes are ticked, and the approval gate is marked done.

---

## 5. Phase 4: Campaign Server Logic

### What

Server-side functions that:

- List campaigns (for the sidebar) and read one campaign with its hexes and players.
- Create a campaign, its two players, and its hexes in one write.
- Assign a hex to a player (or clear it). This works at any time, because hexes stay editable (D5). This is changed in Phase 7.

### Why

- Database access stays on the server (AGENTS.md section 6). The existing `assignHexOwner` already uses `'use server'`, and the create action follows the same pattern.
- A nested Prisma `create` writes the campaign, players, and hexes in one transaction, so a crash can't leave a half-built board.
- Every rule is checked on the server, because the browser can be bypassed.
- Validation is a plain function with no database, so it can be unit tested on its own.

### Files

| #   | Action                   | File                                                                                                             |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| 1   | Create                   | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/campaign/model/types.ts`                       |
| 2   | Edit                     | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/campaign/index.ts`                             |
| 3   | Delete typo, then create | `.../entities/campaign/api/campaign-queires.ts` → `.../entities/campaign/api/campaign-queries.ts`                |
| 4   | Edit (currently empty)   | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/campaign/server.ts`                            |
| 5   | Create                   | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/create-campaign/lib/validate-campaign.ts`      |
| 6   | Create                   | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/create-campaign/lib/validate-campaign.test.ts` |
| 7   | Edit (currently empty)   | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/create-campaign/api/create-campaign.ts`        |

The file in row 3 is misspelled `campaign-queires.ts` on disk. Delete it and create the correctly spelled file.

Paths are shown relative to `/Users/georgeslevaillant/Projects/overseer/apps/web/src/` where the full path would be repetitive.

### Step 1: `entities/campaign/model/types.ts` (new)

```ts
export type CampaignSummary = { id: string; name: string };

export type PlayerRecord = {
  id: string;
  role: string;
  name: string;
  factionId: string;
};

export type CampaignHexRecord = {
  id: string;
  q: number;
  r: number;
  ownerId: string | null;
};

export type CampaignDetail = {
  id: string;
  name: string;
  size: string;
  players: PlayerRecord[];
  hexes: CampaignHexRecord[];
};
```

`factionId` is a plain string here. The UI turns it into a `FactionId` with `parseFactionId`, so this entity doesn't depend on the factions entity.

### Step 2: `entities/campaign/index.ts` (edit)

Replace the whole file with:

```ts
export { CAMPAIGN_SIZES, DEFAULT_CAMPAIGN_SIZE, radiusFor, type CampaignSize } from './model/size';
export type {
  CampaignDetail,
  CampaignHexRecord,
  CampaignSummary,
  PlayerRecord,
} from './model/types';
```

This file is imported by client components, so it must not import the database.

### Step 3: `entities/campaign/api/campaign-queries.ts` (new, replaces the typo file)

Delete `campaign-queires.ts`, then create:

```ts
import 'server-only';
import { prisma } from '@/shared/api/db';
import type { CampaignDetail, CampaignSummary } from '../model/types';

export async function listCampaigns(): Promise<CampaignSummary[]> {
  return prisma.campaign.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getCampaign(id: string): Promise<CampaignDetail | null> {
  return prisma.campaign.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      size: true,
      players: {
        select: { id: true, role: true, name: true, factionId: true },
        orderBy: { role: 'asc' },
      },
      hexes: {
        select: { id: true, q: true, r: true, ownerId: true },
        orderBy: [{ r: 'asc' }, { q: 'asc' }],
      },
    },
  });
}
```

`import 'server-only'` makes the build fail if a client component imports these functions by mistake.

### Step 4: `entities/campaign/server.ts` (edit)

Replace the whole file with:

```ts
export { getCampaign, listCampaigns } from './api/campaign-queries';
```

Import database reads from `@/entities/campaign/server` in server components only. Everything else uses `@/entities/campaign`.

### Step 5: `features/create-campaign/lib/validate-campaign.ts` (new)

```ts
import { CAMPAIGN_SIZES, type CampaignSize } from '@/entities/campaign';
import { parseFactionId, type FactionId } from '@/entities/factions';

type RawPlayer = { name?: unknown; factionId?: unknown };

export type CampaignFormInput = {
  name?: unknown;
  size?: unknown;
  attacker?: RawPlayer;
  defender?: RawPlayer;
};

export type CampaignDraft = {
  name: string;
  size: CampaignSize;
  attacker: { name: string; factionId: FactionId };
  defender: { name: string; factionId: FactionId };
};

export type ValidationResult = { ok: true; draft: CampaignDraft } | { ok: false; error: string };

type PlayerResult = { ok: true; player: CampaignDraft['attacker'] } | { ok: false; error: string };

function validatePlayer(raw: RawPlayer | undefined): PlayerResult {
  const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
  if (!name) return { ok: false, error: 'Both players need a name' };

  const factionId = parseFactionId(raw?.factionId);
  if (!factionId) return { ok: false, error: 'Unknown faction' };

  return { ok: true, player: { name, factionId } };
}

export function validateCampaign(input: CampaignFormInput): ValidationResult {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) return { ok: false, error: 'Campaign name is required' };

  const size = CAMPAIGN_SIZES.find((candidate) => candidate === input.size);
  if (!size) return { ok: false, error: 'Unknown size' };

  const attacker = validatePlayer(input.attacker);
  if (!attacker.ok) return attacker;

  const defender = validatePlayer(input.defender);
  if (!defender.ok) return defender;

  return {
    ok: true,
    draft: { name, size, attacker: attacker.player, defender: defender.player },
  };
}
```

Why `unknown` on the input: the server action receives whatever the browser sends, so every field is checked here, not just trusted from the form type.

### Step 6: `features/create-campaign/lib/validate-campaign.test.ts` (new)

```ts
import { validateCampaign, type CampaignFormInput } from './validate-campaign';

const valid: CampaignFormInput = {
  name: 'Ork Incursion',
  size: 'small',
  attacker: { name: 'Alex', factionId: 'orks' },
  defender: { name: 'Sam', factionId: 'space-marines' },
};

it('accepts a complete campaign and trims the name', () => {
  expect(validateCampaign({ ...valid, name: '  Ork Incursion  ' })).toEqual({
    ok: true,
    draft: {
      name: 'Ork Incursion',
      size: 'small',
      attacker: { name: 'Alex', factionId: 'orks' },
      defender: { name: 'Sam', factionId: 'space-marines' },
    },
  });
});

it('rejects a campaign with an empty name', () => {
  expect(validateCampaign({ ...valid, name: '   ' })).toEqual({
    ok: false,
    error: 'Campaign name is required',
  });
});

it('rejects an unknown size', () => {
  expect(validateCampaign({ ...valid, size: 'gigantic' })).toEqual({
    ok: false,
    error: 'Unknown size',
  });
});

it('rejects a player without a name', () => {
  expect(validateCampaign({ ...valid, attacker: { name: '', factionId: 'orks' } })).toEqual({
    ok: false,
    error: 'Both players need a name',
  });
});

it('rejects a faction that is not in the list', () => {
  expect(
    validateCampaign({ ...valid, defender: { name: 'Sam', factionId: 'not-a-faction' } })
  ).toEqual({ ok: false, error: 'Unknown faction' });
});
```

### Step 7: `features/create-campaign/api/create-campaign.ts` (edit)

This file is currently empty. Replace it with:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/api/db';
import { hexesInRadius } from '@/shared/lib/hex-grid';
import { radiusFor } from '@/entities/campaign';
import { validateCampaign, type CampaignFormInput } from '../lib/validate-campaign';

type CreateCampaignResult = { ok: true; campaignId: string } | { ok: false; error: string };

export async function createCampaign(input: CampaignFormInput): Promise<CreateCampaignResult> {
  const result = validateCampaign(input);
  if (!result.ok) return result;
  const { draft } = result;

  const campaign = await prisma.campaign.create({
    data: {
      name: draft.name,
      size: draft.size,
      players: {
        create: [
          { role: 'attacker', name: draft.attacker.name, factionId: draft.attacker.factionId },
          { role: 'defender', name: draft.defender.name, factionId: draft.defender.factionId },
        ],
      },
      hexes: {
        create: hexesInRadius(radiusFor(draft.size)).map(({ q, r }) => ({ q, r })),
      },
    },
  });

  revalidatePath('/', 'layout');
  return { ok: true, campaignId: campaign.id };
}
```

Notes:

- Hexes don't get a `campaignId` in this code. The nested create sets it.
- `revalidatePath('/', 'layout')` refreshes the sidebar, which is rendered by the root layout (Phase 6).
- `'use server'` files may only export async functions, which is why `CampaignFormInput` is imported from the validation file and not exported from here.

### Verify

```bash
cd /Users/georgeslevaillant/Projects/overseer/apps/web
npx tsc --noEmit
npm test
```

- `tsc` passes.
- The new validation tests pass.
- The create action is checked end to end in Phase 5, once the form exists.

---

## 6. Phase 5: Create Campaign UI

### What

A form at `/campaigns/new`:

- Campaign name (text)
- Size (four options, Large selected by default)
- Attacker: name and faction
- Defender: name and faction
- Submit button

On success, redirect to `/campaigns/[campaignId]`. That route is built in Phase 6, so until then the redirect shows a 404.

### Why

- Forms are the main way users create things, so this is the core of the feature.
- The options come from `CAMPAIGN_SIZES` and `FACTION_GROUPS`, so the UI can't offer anything the server rejects.
- The attacker and defender fields are the same component with a different role. `PlayerFields` lives in its own file so each file has one component and the role is a typed union, not a free-text title.
- `PlayerFields` is internal to this feature, so it isn't exported from `index.ts`. The form imports it directly.
- Uses the ShadCN `Select`, `Input`, `Label`, and `Button` from `@warmaster/ui`. The `Select` is built on Radix, which needs a few browser APIs that jsdom doesn't have. Step 0 adds them to the test setup.

### Files

| #   | Action | File                                                                                                                |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| 0   | Edit   | `/Users/georgeslevaillant/Projects/overseer/apps/web/jest.setup.ts`                                                 |
| 1   | Create | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/create-campaign/ui/player-fields.tsx`             |
| 2   | Create | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/create-campaign/ui/player-fields.test.tsx`        |
| 3   | Create | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/create-campaign/ui/create-campaign-form.tsx`      |
| 4   | Create | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/create-campaign/ui/create-campaign-form.test.tsx` |
| 5   | Create | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/create-campaign/index.ts`                         |
| 6   | Create | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/app/campaigns/new/page.tsx`                                |

The order matters: the form imports `PlayerFields`, so build the component and its test first.

No new dependencies are needed. `radix-ui` is already installed through `packages/ui`.

### Step 0: test setup for Radix Select (edit `apps/web/jest.setup.ts`)

The file already polyfills pointer capture for the Drawer. Add the two missing browser APIs that Radix `Select` calls: `ResizeObserver` (used by Radix Popper) and `scrollIntoView` (used when an item is highlighted). Replace the whole file with:

```ts
import '@testing-library/jest-dom';

// jsdom doesn't implement these, but vaul (used by the shadcn Drawer) calls them.
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};
Element.prototype.hasPointerCapture = () => false;

// Radix Select (used by the shadcn Select) needs these too.
Element.prototype.scrollIntoView = () => {};

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub;

const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (element: Element, pseudoElt?: string | null) => {
  const style = originalGetComputedStyle(element, pseudoElt);
  if (!style.transform) {
    Object.defineProperty(style, 'transform', { value: 'none' });
  }
  return style;
};
```

Then run:

```bash
cd /Users/georgeslevaillant/Projects/overseer/apps/web
npm test
```

The existing Drawer tests must still pass. If a Select test fails with `Unable to find an element with the role "option"`, the trigger didn't open, so check that these polyfills are present.

### Step 1: `features/create-campaign/ui/player-fields.tsx` (new)

```tsx
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@warmaster/ui';
import { FACTION_GROUPS } from '@/entities/factions';

export type PlayerRole = 'attacker' | 'defender';

export type PlayerState = { name: string; factionId: string };

export type PlayerFieldsProps = {
  role: PlayerRole;
  value: PlayerState;
  onChange: (field: keyof PlayerState, value: string) => void;
};

const PLAYER_TITLES: Record<PlayerRole, string> = {
  attacker: 'Attacker',
  defender: 'Defender',
};

export function PlayerFields({ role, value, onChange }: PlayerFieldsProps) {
  const title = PLAYER_TITLES[role];

  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
      <legend className="px-1 font-medium">{title}</legend>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${role}-name`}>{title} name</Label>
        <Input
          id={`${role}-name`}
          value={value.name}
          onChange={(event) => onChange('name', event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${role}-faction`}>{title} faction</Label>
        <Select
          value={value.factionId}
          onValueChange={(factionId) => onChange('factionId', factionId)}
        >
          <SelectTrigger id={`${role}-faction`} className="w-full">
            <SelectValue placeholder="Choose a faction" />
          </SelectTrigger>
          <SelectContent>
            {FACTION_GROUPS.map((group) => (
              <SelectGroup key={group.name}>
                <SelectLabel>{group.name}</SelectLabel>
                {group.factions.map((faction) => (
                  <SelectItem key={faction.id} value={faction.id}>
                    {faction.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
    </fieldset>
  );
}
```

Notes:

- `PlayerRole` is a union, so `role="attacker"` is checked at compile time and the ids (`attacker-name`, `attacker-faction`) can't be mistyped.
- `PlayerState` and `PlayerRole` are exported because the form uses them. The form imports the types with `import { type ... }`.
- An empty `value` on the faction `Select` shows the placeholder. Radix doesn't allow an item with an empty value.
- `onChange` gets the field name as a typed key (`keyof PlayerState`), so a typo in a field name is a compile error.

### Step 2: `features/create-campaign/ui/player-fields.test.tsx` (new)

The faction grouping test lives here, because the groups are now rendered by this component.

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerFields, type PlayerFieldsProps } from './player-fields';

const emptyValue: PlayerFieldsProps['value'] = { name: '', factionId: '' };

function renderFields(overrides: Partial<PlayerFieldsProps> = {}) {
  const onChange = jest.fn();
  render(<PlayerFields role="attacker" value={emptyValue} onChange={onChange} {...overrides} />);
  return { onChange };
}

async function choose(triggerLabel: string, optionName: string) {
  await userEvent.click(screen.getByLabelText(triggerLabel));
  await userEvent.click(await screen.findByRole('option', { name: optionName }));
}

it('labels the fields with the role', () => {
  renderFields({ role: 'defender' });

  expect(screen.getByRole('group', { name: 'Defender' })).toBeInTheDocument();
  expect(screen.getByLabelText('Defender name')).toBeInTheDocument();
  expect(screen.getByLabelText('Defender faction')).toBeInTheDocument();
});

it('reports name changes', async () => {
  const { onChange } = renderFields();

  await userEvent.type(screen.getByLabelText('Attacker name'), 'A');

  expect(onChange).toHaveBeenCalledWith('name', 'A');
});

it('reports the chosen faction', async () => {
  const { onChange } = renderFields();

  await choose('Attacker faction', 'Orks');

  expect(onChange).toHaveBeenCalledWith('factionId', 'orks');
});

it('groups factions under Imperium, Chaos, and Xenos', async () => {
  renderFields();

  await userEvent.click(screen.getByLabelText('Attacker faction'));
  const list = await screen.findByRole('listbox');

  expect(within(list).getByRole('group', { name: 'The Imperium of Man' })).toHaveTextContent(
    'Space Marines'
  );
  expect(within(list).getByRole('group', { name: 'Chaos' })).toHaveTextContent(
    'Chaos Space Marines'
  );
  expect(within(list).getByRole('group', { name: 'Xenos' })).toHaveTextContent('Orks');
});
```

Why `PlayerFieldsProps` is exported and used in the test: the test's fixtures are typed against the real props, so if the props change, the test fails to compile instead of passing with stale data.

### Step 3: `features/create-campaign/ui/create-campaign-form.tsx` (new)

```tsx
'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@warmaster/ui';
import { CAMPAIGN_SIZES, DEFAULT_CAMPAIGN_SIZE, type CampaignSize } from '@/entities/campaign';
import { createCampaign } from '../api/create-campaign';
import { PlayerFields, type PlayerRole, type PlayerState } from './player-fields';

type FormState = {
  name: string;
  size: CampaignSize;
  attacker: PlayerState;
  defender: PlayerState;
};

const EMPTY_PLAYER: PlayerState = { name: '', factionId: '' };

const INITIAL_STATE: FormState = {
  name: '',
  size: DEFAULT_CAMPAIGN_SIZE,
  attacker: EMPTY_PLAYER,
  defender: EMPTY_PLAYER,
};

export function CreateCampaignForm() {
  const router = useRouter();
  const [values, setValues] = useState<FormState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updatePlayer(role: PlayerRole, field: keyof PlayerState, value: string) {
    setValues((prev) => ({ ...prev, [role]: { ...prev[role], [field]: value } }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createCampaign(values);
      if (result.ok) {
        router.push(`/campaigns/${result.campaignId}`);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">New campaign</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="campaign-name">Campaign name</Label>
          <Input
            id="campaign-name"
            value={values.name}
            onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="campaign-size">Size</Label>
          <Select
            value={values.size}
            onValueChange={(value) => {
              const size = CAMPAIGN_SIZES.find((candidate) => candidate === value);
              if (size) setValues((prev) => ({ ...prev, size }));
            }}
          >
            <SelectTrigger id="campaign-size" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CAMPAIGN_SIZES.map((size) => (
                <SelectItem key={size} value={size}>
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <PlayerFields
          role="attacker"
          value={values.attacker}
          onChange={(field, value) => updatePlayer('attacker', field, value)}
        />
        <PlayerFields
          role="defender"
          value={values.defender}
          onChange={(field, value) => updatePlayer('defender', field, value)}
        />

        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" disabled={pending}>
          Create campaign
        </Button>
      </form>
    </main>
  );
}
```

Notes:

- The form state is typed as strings. That's safe on the client, and the server validates the same values again (Phase 4 step 5).
- `updatePlayer` takes a `PlayerRole`, so the spread into `[role]` can only ever touch `attacker` or `defender`.

### Step 4: `features/create-campaign/ui/create-campaign-form.test.tsx` (new)

The faction grouping test moved to Step 2. The form tests cover the form-level behaviour: the name, the size, submitting, and the server's error.

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createCampaign } from '../api/create-campaign';
import { CreateCampaignForm } from './create-campaign-form';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../api/create-campaign', () => ({
  createCampaign: jest.fn(),
}));

const mockedCreate = jest.mocked(createCampaign);

beforeEach(() => {
  mockPush.mockReset();
  mockedCreate.mockReset();
  mockedCreate.mockResolvedValue({ ok: true, campaignId: 'campaign-1' });
});

async function choose(triggerLabel: string, optionName: string) {
  await userEvent.click(screen.getByLabelText(triggerLabel));
  await userEvent.click(await screen.findByRole('option', { name: optionName }));
}

it('shows an error when the campaign name is empty', async () => {
  mockedCreate.mockResolvedValue({ ok: false, error: 'Campaign name is required' });
  render(<CreateCampaignForm />);

  await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Campaign name is required');
});

it('selects a large board by default', () => {
  render(<CreateCampaignForm />);

  expect(screen.getByLabelText('Size')).toHaveTextContent('Large');
});

it('creates the campaign with the chosen size and both players', async () => {
  render(<CreateCampaignForm />);

  await userEvent.type(screen.getByLabelText('Campaign name'), 'Ork Incursion');
  await choose('Size', 'Small');
  await userEvent.type(screen.getByLabelText('Attacker name'), 'Alex');
  await choose('Attacker faction', 'Orks');
  await userEvent.type(screen.getByLabelText('Defender name'), 'Sam');
  await choose('Defender faction', 'Space Marines');
  await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }));

  await waitFor(() =>
    expect(mockedCreate).toHaveBeenCalledWith({
      name: 'Ork Incursion',
      size: 'small',
      attacker: { name: 'Alex', factionId: 'orks' },
      defender: { name: 'Sam', factionId: 'space-marines' },
    })
  );
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/campaigns/campaign-1'));
});
```

### Step 5: `features/create-campaign/index.ts` (new)

```ts
export { CreateCampaignForm } from './ui/create-campaign-form';
```

`PlayerFields` is not exported here. It's internal to the feature.

### Step 6: `app/campaigns/new/page.tsx` (new)

```tsx
import { CreateCampaignForm } from '@/features/create-campaign';

export default function NewCampaignPage() {
  return <CreateCampaignForm />;
}
```

`/campaigns/new` is a static segment, so Next.js matches it before the dynamic `/campaigns/[campaignId]` route built in Phase 6.

### Verify

```bash
cd /Users/georgeslevaillant/Projects/overseer/apps/web
npm test
npm run lint
npx tsc --noEmit
```

- All tests pass: the Drawer tests, the four `PlayerFields` tests, and the four form tests.
- In the browser, open `/campaigns/new`, create a small campaign, and check Prisma Studio shows 1 campaign, 2 players, and 7 hexes.
- The redirect 404s until Phase 6 is done. That is expected.

---

## 7. Phase 6: Routes and Sidebar

### What

- `/campaigns`: list of campaigns.
- `/campaigns/[campaignId]`: one campaign, with its details. The board is added in Phase 7.
- The sidebar's "Campaigns" section lists every campaign by its **name**, each linking to its page (D8). This replaces "Campaign 1 / 2 / 3".
- The old global `/map` page is removed, because hexes now belong to campaigns (D6).

The sidebar shows all campaigns for now (Section 1, D8).

### Why

- The sidebar is rendered by the root layout, which is a server component. The layout loads the campaign list once and passes it down as props, so the sidebar component stays simple.
- `connection()` tells Next.js the page depends on the database and must not be prerendered at build time. The map page already did this.
- Next.js maps folders to URLs. Square brackets mark a dynamic segment.

### Files

| #   | Action | File                                                                                           |
| --- | ------ | ---------------------------------------------------------------------------------------------- |
| 1   | Edit   | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/app/layout.tsx`                       |
| 2   | Edit   | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/widgets/app-shell/ui/app-shell.tsx`   |
| 3   | Edit   | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/widgets/app-shell/ui/app-sidebar.tsx` |
| 4   | Create | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/app/campaigns/page.tsx`               |
| 5   | Create | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/app/campaigns/[campaignId]/page.tsx`  |
| 6   | Delete | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/app/map/page.tsx`                     |
| 7   | Delete | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/hex/server.ts`               |
| 8   | Delete | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/hex/api/get-hexes.ts`        |

### Step 1: `app/layout.tsx` (edit)

Replace the whole file with:

```tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { connection } from 'next/server';
import { listCampaigns } from '@/entities/campaign/server';
import { AppShell } from '@/widgets/app-shell';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Warmaster',
  description: 'Warmaster web application',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  await connection();
  const campaigns = await listCampaigns();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <AppShell campaigns={campaigns}>{children}</AppShell>
      </body>
    </html>
  );
}
```

### Step 2: `widgets/app-shell/ui/app-shell.tsx` (edit)

Replace the whole file with:

```tsx
import type { ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@warmaster/ui';
import type { CampaignSummary } from '@/entities/campaign';
import { AppSidebar } from './app-sidebar';
import { TopBar } from './top-bar';

type AppShellProps = { children: ReactNode; campaigns: CampaignSummary[] };

export function AppShell({ children, campaigns }: AppShellProps) {
  return (
    <SidebarProvider className="h-svh">
      <AppSidebar campaigns={campaigns} />
      <SidebarInset className="min-h-0">
        <TopBar />
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

### Step 3: `widgets/app-shell/ui/app-sidebar.tsx` (edit)

Replace the whole file with:

```tsx
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@warmaster/ui';
import type { CampaignSummary } from '@/entities/campaign';

const PLACEHOLDER_SECTIONS = [
  { title: 'Battle History', items: ['Battle History 1', 'Battle History 2', 'Battle History 3'] },
  { title: 'Army List', items: ['Army List 1', 'Army List 2', 'Army List 3'] },
  { title: 'Settings', items: ['Settings 1', 'Settings 2', 'Settings 3'] },
];

type AppSidebarProps = { campaigns: CampaignSummary[] };

export function AppSidebar({ campaigns }: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarSection title="Campaigns">
              {campaigns.map((campaign) => (
                <SidebarMenuSubItem key={campaign.id}>
                  <SidebarMenuSubButton asChild>
                    <Link href={`/campaigns/${campaign.id}`}>{campaign.name}</Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
              <SidebarMenuSubItem>
                <SidebarMenuSubButton asChild>
                  <Link href="/campaigns/new">New campaign</Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            </SidebarSection>

            {PLACEHOLDER_SECTIONS.map((section) => (
              <SidebarSection key={section.title} title={section.title}>
                {section.items.map((item) => (
                  <SidebarMenuSubItem key={item}>
                    <SidebarMenuSubButton>{item}</SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarSection>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

type SidebarSectionProps = { title: string; children: ReactNode };

function SidebarSection({ title, children }: SidebarSectionProps) {
  return (
    <SidebarMenuItem>
      <Collapsible defaultOpen className="group/collapsible">
        <CollapsibleTrigger asChild>
          <SidebarMenuButton>
            {title}
            <ChevronDown className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-180" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>{children}</SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}
```

`SidebarMenuSubButton` supports `asChild` in `packages/ui`, so the link is the menu item itself.

### Step 4: `app/campaigns/page.tsx` (new)

```tsx
import Link from 'next/link';
import { connection } from 'next/server';
import { listCampaigns } from '@/entities/campaign/server';

export default async function CampaignsPage() {
  await connection();
  const campaigns = await listCampaigns();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <Link href="/campaigns/new" className="underline">
          New campaign
        </Link>
      </div>

      {campaigns.length === 0 ? (
        <p className="text-muted-foreground">No campaigns yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {campaigns.map((campaign) => (
            <li key={campaign.id}>
              <Link href={`/campaigns/${campaign.id}`} className="underline">
                {campaign.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
```

### Step 5: `app/campaigns/[campaignId]/page.tsx` (new)

```tsx
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { getCampaign } from '@/entities/campaign/server';
import { getFaction, parseFactionId } from '@/entities/factions';

type PageProps = { params: Promise<{ campaignId: string }> };

export default async function CampaignPage({ params }: PageProps) {
  await connection();
  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId);
  if (!campaign) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">{campaign.name}</h1>
      <p className="text-muted-foreground">
        {campaign.size} board, {campaign.hexes.length} hexes
      </p>
      <ul className="flex flex-col gap-1">
        {campaign.players.map((player) => (
          <li key={player.id}>
            {player.role}: {player.name} ({factionName(player.factionId)})
          </li>
        ))}
      </ul>
    </main>
  );
}

function factionName(raw: string): string {
  const factionId = parseFactionId(raw);
  return factionId ? getFaction(factionId).name : 'Unknown faction';
}
```

`params` is a Promise in the installed Next.js (16.3.1), so it must be awaited. `notFound()` returns `never`, so `campaign` is non-null after it.

### Step 6: delete the old global board

Delete these three files, which are the old board that has no campaign:

- `apps/web/src/app/map/page.tsx`
- `apps/web/src/entities/hex/server.ts`
- `apps/web/src/entities/hex/api/get-hexes.ts`

Then run:

```bash
cd /Users/georgeslevaillant/Projects/overseer/apps/web
npx tsc --noEmit
```

It should pass. If it reports that something still imports `@/entities/hex/server`, that file was missed.

### Verify

- Create two campaigns. Both appear in the sidebar by name.
- Each sidebar link opens the right campaign page.
- Creating a campaign updates the sidebar without a reload.
- An unknown id, such as `/campaigns/nope`, shows the 404 page.

---

## 8. Phase 7: Board Setup (assigning hexes and faction colours)

### What

On the campaign page, show the hex board. Clicking a hex opens the drawer, which lists the two players. A hex can be reassigned at any time (D5). Each hex is drawn in its owner's faction colours (D7).

### Why

- The board, drawer, and assign action already exist. Reusing them is less work and less risk than new UI.
- The board gets a `players` list instead of the fixed `OWNERS` list, which is what lets one board serve every campaign.
- The hex cell receives plain `fill` and `stroke` strings. It doesn't know about factions, so it can't depend on the factions entity.
- The assign action checks on the server that the hex and the player belong to the same campaign.

### Colour rendering

Each hex is a polygon:

- **Fill** = `primary`. If the hex has no owner, the neutral grey `#d4d4d8` is used.
- **Outline** = `secondary` if present, with a 3px stroke. Otherwise the current grey `#52525b` at 1px.

For a faction with `&` (for example Chaos Space Marines, black fill and gold outline), the gold ring shows the second colour without covering the fill.

### Files

| #   | Action  | File                                                                                                                |
| --- | ------- | ------------------------------------------------------------------------------------------------------------------- |
| 1   | Replace | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/hex/ui/hex-cell.tsx`                              |
| 2   | Replace | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/hex/ui/hex-cell.test.tsx`                         |
| 3   | Replace | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/assign-hex-owner/api/assign-hex-owner.ts`         |
| 4   | Replace | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/assign-hex-owner/ui/assign-owner-drawer.tsx`      |
| 5   | Replace | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/assign-hex-owner/ui/assign-owner-drawer.test.tsx` |
| 6   | Replace | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/widgets/hex-map/ui/hex-map.tsx`                            |
| 7   | Replace | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/app/campaigns/[campaignId]/page.tsx`                       |
| 8   | Delete  | `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/owner/` (after a search, see step 8)              |

### Step 1: `entities/hex/ui/hex-cell.tsx` (replace)

```tsx
import { hexCorners, hexToPixel } from '@/shared/lib/hex-grid';
import { HexRecord } from '../model/types';

const SIZE = 30;

type HexCellProps = {
  hex: HexRecord;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  onSelect: (id: string) => void;
};

export function HexCell({
  hex,
  fill = '#d4d4d8',
  stroke = '#52525b',
  strokeWidth = 1,
  onSelect,
}: HexCellProps) {
  const centre = hexToPixel(hex, SIZE);
  const points = hexCorners(centre, SIZE)
    .map((point) => `${point.x}, ${point.y}`)
    .join(' ');

  return (
    <g
      role="button"
      tabIndex={0}
      className="cursor-pointer outline-none focus-visible:[&>polygon]:stroke-3 focus-visible:[&>polygon]:stroke-blue-600"
      aria-label={`Hex ${hex.q},${hex.r}`}
      onClick={() => onSelect(hex.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onSelect(hex.id);
        }
      }}
    >
      <polygon points={points} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
    </g>
  );
}
```

### Step 2: `entities/hex/ui/hex-cell.test.tsx` (replace)

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { HexCell } from './hex-cell';

const hex = { id: 'a', q: 0, r: 0, ownerId: null };

function renderCell(ui: ReactElement) {
  return render(<svg>{ui}</svg>);
}

it('calls onSelect when the hex is clicked', async () => {
  const onSelect = jest.fn();
  renderCell(<HexCell hex={hex} onSelect={onSelect} />);

  await userEvent.click(screen.getByRole('button', { name: 'Hex 0,0' }));

  expect(onSelect).toHaveBeenCalledWith('a');
});

it('fills the hex with the primary colour and outlines it with the secondary colour', () => {
  const { container } = renderCell(
    <HexCell hex={hex} fill="#000000" stroke="#D4AF37" strokeWidth={3} onSelect={() => {}} />
  );

  const polygon = container.querySelector('polygon');
  expect(polygon).toHaveAttribute('fill', '#000000');
  expect(polygon).toHaveAttribute('stroke', '#D4AF37');
  expect(polygon).toHaveAttribute('stroke-width', '3');
});

it('uses the neutral colours when no faction colour is given', () => {
  const { container } = renderCell(<HexCell hex={hex} onSelect={() => {}} />);

  const polygon = container.querySelector('polygon');
  expect(polygon).toHaveAttribute('fill', '#d4d4d8');
  expect(polygon).toHaveAttribute('stroke', '#52525b');
});
```

### Step 3: `features/assign-hex-owner/api/assign-hex-owner.ts` (replace)

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/api/db';

type AssignInput = { hexId: string; playerId: string | null };
type AssignResult = { ok: true } | { ok: false; error: string };

export async function assignHexOwner(input: AssignInput): Promise<AssignResult> {
  if (!input.hexId) {
    return { ok: false, error: 'Missing Hex Id' };
  }

  const hex = await prisma.hex.findUnique({
    where: { id: input.hexId },
    select: { campaignId: true },
  });
  if (!hex) {
    return { ok: false, error: 'Hex not found' };
  }

  if (input.playerId !== null) {
    const player = await prisma.player.findUnique({
      where: { id: input.playerId },
      select: { campaignId: true },
    });
    if (!player || player.campaignId !== hex.campaignId) {
      return { ok: false, error: 'Player is not in this campaign' };
    }
  }

  await prisma.hex.update({
    where: { id: input.hexId },
    data: { ownerId: input.playerId },
  });
  revalidatePath(`/campaigns/${hex.campaignId}`);
  return { ok: true };
}
```

The campaign comes from the hex in the database, not from the browser, so the check can't be bypassed by sending a different campaign id.

### Step 4: `features/assign-hex-owner/ui/assign-owner-drawer.tsx` (replace)

```tsx
import { useState, useTransition } from 'react';
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@warmaster/ui';
import type { HexRecord } from '@/entities/hex';
import type { PlayerRecord } from '@/entities/campaign';
import { getFaction, parseFactionId } from '@/entities/factions';
import { assignHexOwner } from '../api/assign-hex-owner';

type Props = {
  hex: HexRecord | null;
  players: PlayerRecord[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: (hexId: string, playerId: string | null) => void;
};

export function AssignOwnerDrawer({ hex, players, open, onOpenChange, onAssigned }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function assign(playerId: string | null) {
    if (!hex) return;
    setError(null);
    startTransition(async () => {
      const result = await assignHexOwner({ hexId: hex.id, playerId });
      if (result.ok) {
        onAssigned(hex.id, playerId);
        onOpenChange(false);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <Drawer direction="right" open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Assign owner</DrawerTitle>
          <DrawerDescription>{hex ? `Hex ${hex.q},${hex.r}` : ''}</DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-2 p-4">
          {players.map((player) => (
            <Button key={player.id} disabled={pending} onClick={() => assign(player.id)}>
              {player.name} ({factionName(player.factionId)})
            </Button>
          ))}
          <Button variant="outline" disabled={pending} onClick={() => assign(null)}>
            Clear owner
          </Button>
        </div>

        {error && (
          <p role="alert" className="p-4 text-destructive">
            {error}
          </p>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function factionName(raw: string): string {
  const factionId = parseFactionId(raw);
  return factionId ? getFaction(factionId).name : 'Unknown faction';
}
```

### Step 5: `features/assign-hex-owner/ui/assign-owner-drawer.test.tsx` (replace)

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PlayerRecord } from '@/entities/campaign';
import { assignHexOwner } from '../api/assign-hex-owner';
import { AssignOwnerDrawer } from './assign-owner-drawer';

jest.mock('../api/assign-hex-owner', () => ({
  assignHexOwner: jest.fn(),
}));

const mockedAssign = jest.mocked(assignHexOwner);
const hex = { id: 'hex-1', q: 0, r: 0, ownerId: null };
const players: PlayerRecord[] = [
  { id: 'player-attacker', role: 'attacker', name: 'Alex', factionId: 'orks' },
  { id: 'player-defender', role: 'defender', name: 'Sam', factionId: 'space-marines' },
];

function renderDrawer() {
  const onOpenChange = jest.fn();
  const onAssigned = jest.fn();
  render(
    <AssignOwnerDrawer
      hex={hex}
      players={players}
      open
      onOpenChange={onOpenChange}
      onAssigned={onAssigned}
    />
  );
  return { onAssigned };
}

beforeEach(() => {
  mockedAssign.mockReset();
  mockedAssign.mockResolvedValue({ ok: true });
});

it('assigns the chosen player to the hex', async () => {
  const { onAssigned } = renderDrawer();

  await userEvent.click(screen.getByRole('button', { name: 'Alex (Orks)' }));

  expect(mockedAssign).toHaveBeenCalledWith({ hexId: 'hex-1', playerId: 'player-attacker' });
  expect(onAssigned).toHaveBeenCalledWith('hex-1', 'player-attacker');
});

it('clears the owner when Clear owner is chosen', async () => {
  const { onAssigned } = renderDrawer();

  await userEvent.click(screen.getByRole('button', { name: 'Clear owner' }));

  expect(mockedAssign).toHaveBeenCalledWith({ hexId: 'hex-1', playerId: null });
  expect(onAssigned).toHaveBeenCalledWith('hex-1', null);
});

it('shows an error message when the assignment fails', async () => {
  mockedAssign.mockResolvedValue({ ok: false, error: 'Hex not found' });
  const { onAssigned } = renderDrawer();

  await userEvent.click(screen.getByRole('button', { name: 'Sam (Space Marines)' }));

  expect(await screen.findByRole('alert')).toHaveTextContent('Hex not found');
  expect(onAssigned).not.toHaveBeenCalled();
});
```

### Step 6: `widgets/hex-map/ui/hex-map.tsx` (replace)

```tsx
'use client';

import { useState } from 'react';
import { HexCell, type HexRecord } from '@/entities/hex';
import type { PlayerRecord } from '@/entities/campaign';
import { getFaction, parseFactionId } from '@/entities/factions';
import { AssignOwnerDrawer } from '@/features/assign-hex-owner';
import { hexToPixel, hexCorners } from '@/shared/lib/hex-grid';

const SIZE = 30;

type Props = { hexes: HexRecord[]; players: PlayerRecord[] };

export function HexMap({ hexes: initial, players }: Props) {
  const [hexes, setHexes] = useState(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (hexes.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <p role="status" className="text-muted-foreground">
          No hexes to show yet.
        </p>
      </div>
    );
  }

  const selected = hexes.find((hex) => hex.id === selectedId) ?? null;

  const viewBox = computeViewBox(hexes, SIZE);

  return (
    <>
      <div className="h-full w-full p-4">
        <svg viewBox={viewBox} className="h-full w-full">
          {hexes.map((hex) => {
            const colours = coloursFor(hex, players);
            return (
              <HexCell
                key={hex.id}
                hex={hex}
                fill={colours?.primary}
                stroke={colours?.secondary}
                strokeWidth={colours?.secondary ? 3 : undefined}
                onSelect={setSelectedId}
              />
            );
          })}
        </svg>
      </div>
      <AssignOwnerDrawer
        hex={selected}
        players={players}
        open={selected !== null}
        onOpenChange={(open) => !open && setSelectedId(null)}
        onAssigned={(hexId, playerId) =>
          setHexes((prev) =>
            prev.map((hex) => (hex.id === hexId ? { ...hex, ownerId: playerId } : hex))
          )
        }
      />
    </>
  );
}

function coloursFor(hex: HexRecord, players: PlayerRecord[]) {
  const player = players.find((candidate) => candidate.id === hex.ownerId);
  const factionId = parseFactionId(player?.factionId);
  return factionId ? getFaction(factionId).colours : undefined;
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

`HexMap` no longer takes a campaign id. The drawer sends the hex id and player id, and the server works out the campaign.

### Step 7: `app/campaigns/[campaignId]/page.tsx` (replace)

```tsx
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { getCampaign } from '@/entities/campaign/server';
import { getFaction, parseFactionId } from '@/entities/factions';
import { HexMap } from '@/widgets/hex-map';

type PageProps = { params: Promise<{ campaignId: string }> };

export default async function CampaignPage({ params }: PageProps) {
  await connection();
  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId);
  if (!campaign) notFound();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-col gap-1 p-6 pb-0">
        <h1 className="text-2xl font-semibold">{campaign.name}</h1>
        <p className="text-muted-foreground">
          {campaign.size} board, {campaign.hexes.length} hexes
        </p>
        <ul className="flex flex-col gap-1">
          {campaign.players.map((player) => (
            <li key={player.id}>
              {player.role}: {player.name} ({factionName(player.factionId)})
            </li>
          ))}
        </ul>
      </header>
      <div className="h-[70vh] w-full">
        <HexMap hexes={campaign.hexes} players={campaign.players} />
      </div>
    </div>
  );
}

function factionName(raw: string): string {
  const factionId = parseFactionId(raw);
  return factionId ? getFaction(factionId).name : 'Unknown faction';
}
```

### Step 8: remove the old owner list

Search before deleting:

```bash
cd /Users/georgeslevaillant/Projects/overseer/apps/web
grep -rn "entities/owner" src
```

Expected output: nothing, because steps 4, 6, and the hex cell no longer import it. If anything is listed, fix that file first. Then delete `apps/web/src/entities/owner/`.

### Verify

```bash
cd /Users/georgeslevaillant/Projects/overseer/apps/web
npm test
npm run lint
npx tsc --noEmit
```

- Assign a hex to each player. It renders in the player's faction colours, with the secondary colour as a thicker outline.
- Reassign a hex from one player to the other. The colour changes.
- Clear a hex. It returns to the neutral grey.
- Try a player from another campaign in the drawer (if you have two campaigns). The error "Player is not in this campaign" should appear.

---

## 9. Phase 8: Names Only (temporary limitation)

### What

Players are typed-in names (D1). No account is linked to a player. Anyone with the URL can change a board.

### Why this is OK for now

- It lets us build and test the whole flow without touching security code.
- The limitation is clearly temporary. A short note on the campaign page makes sure nobody mistakes it for real access control.

### How

Add this paragraph inside the `<header>` in `apps/web/src/app/campaigns/[campaignId]/page.tsx`, directly after the `<ul>` of players:

```tsx
<p className="text-sm text-muted-foreground">
  Players are typed-in names. Anyone with this link can change the board until accounts exist.
</p>
```

### What comes next

User profiles, sign-in, and "only the creator" enforcement. See `/Users/georgeslevaillant/.opencode/plan/long-term-plan.md`. That work needs your approval because it touches auth and sessions (AGENTS.md section 6).

---

## 10. Testing and Quality Checklist

Run at the end of every phase:

```bash
cd /Users/georgeslevaillant/Projects/overseer/apps/web
npm test
npm run lint
npx tsc --noEmit
```

- [x] Phase 1: size rules tested (7, 19, 37, 61 hexes)
- [x] Phase 2: factions grouped correctly, all 28 present, `parseFactionId` used for untrusted ids
- [x] Phase 3: migration applied, schema and seed updated (approved)
- [ ] Phase 4: validation tested, create action writes a campaign with two players and all its hexes
- [ ] Phase 5: create form tested with Testing Library, works in the browser
- [ ] Phase 6: `/campaigns` and `/campaigns/[campaignId]` work, sidebar lists campaigns by name, old `/map` removed
- [ ] Phase 7: hexes assign and reassign, colours render with outlines, owner list removed
- [ ] Phase 8: the names-only limitation is noted on the campaign page

Run the `fsd-architecture` review after the frontend phases, since this work adds and moves files across layers. Each phase should be its own commit, and `prettier-on-commit` applies to every commit that touches frontend files.

---

## 11. Order of Work at a Glance

1. Section 1 decisions are final.
2. Phase 1: sizes and tests (done).
3. Phase 2: factions and colours, with tests (done).
4. Phase 3: schema and migration (done, approved).
5. Phase 4: server create and read logic.
6. Phase 5: create form and page.
7. Phase 6: campaign list, detail page, sidebar.
8. Phase 7: board with faction colours and reassignment.
9. Phase 8: names-only note, then the long-term plan.
