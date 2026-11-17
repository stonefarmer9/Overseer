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

## 5. Phase 4: Campaign Server Logic

### What

Server-side functions that:

- List campaigns (for the sidebar) and read one campaign with its hexes and players.
- Create a campaign, its two players, and its hexes in one write.
- Assign a hex to a player (or clear it). This works at any time, because hexes stay editable (D5).

### Why

- Database writes happen on the server (AGENTS.md section 6). The existing `assignHexOwner` in `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/assign-hex-owner/api/assign-hex-owner.ts` already follows this with `'use server'`.
- A nested Prisma `create` writes the campaign, players, and hexes in one operation, so a crash can't leave a half-built board.
- Every rule is checked on the server, because the browser can be bypassed.

### Where (FSD layers)

- Read functions: `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/campaign/api/campaign-queries.ts`, exported through `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/campaign/server.ts`. This mirrors `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/hex/server.ts`, which keeps database code out of client bundles.
- Create action: `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/create-campaign/api/create-campaign.ts`
- Assign action: `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/assign-hex-owner/api/assign-hex-owner.ts` (existing, updated in Phase 7).

### How: create action

Sketch, following the shape of `assignHexOwner`:

```ts
'use server';

import { prisma } from '@/shared/api/db';
import { hexesInRadius } from '@/shared/lib/hex-grid';
import { CAMPAIGN_SIZES, radiusFor, type CampaignSize } from '@/entities/campaign';
import { getFaction } from '@/entities/faction';

type CreateCampaignInput = {
  name: string;
  size: CampaignSize;
  attacker: { name: string; factionId: string };
  defender: { name: string; factionId: string };
};

type CreateCampaignResult = { ok: true; campaignId: string } | { ok: false; error: string };

export async function createCampaign(input: CreateCampaignInput): Promise<CreateCampaignResult> {
  if (!input.name.trim()) return { ok: false, error: 'Campaign name is required' };
  if (!CAMPAIGN_SIZES.includes(input.size)) return { ok: false, error: 'Unknown size' };
  if (!input.attacker.name.trim() || !input.defender.name.trim()) {
    return { ok: false, error: 'Both players need a name' };
  }
  if (!getFaction(input.attacker.factionId) || !getFaction(input.defender.factionId)) {
    return { ok: false, error: 'Unknown faction' };
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: input.name.trim(),
      size: input.size,
      players: {
        create: [
          {
            role: 'attacker',
            name: input.attacker.name.trim(),
            factionId: input.attacker.factionId,
          },
          {
            role: 'defender',
            name: input.defender.name.trim(),
            factionId: input.defender.factionId,
          },
        ],
      },
      hexes: { create: hexesInRadius(radiusFor(input.size)).map(({ q, r }) => ({ q, r })) },
    },
  });

  return { ok: true, campaignId: campaign.id };
}
```

Notes:

- The server re-checks everything the form checks. The browser is never trusted.
- Validation is pulled into its own function so it can be unit tested without a database.
- Before writing this code, check the Prisma docs for nested writes in the installed version (AGENTS.md asks for this with Next.js, and it applies to Prisma too).

### How: assign action (Phase 7)

The existing function only checks `getOwner`. It will check that the player belongs to the hex's campaign, and that the hex belongs to that campaign too.

### Verify

- Validation tests: empty name, bad size, missing player name, bad faction.
- Manual: create a campaign and check Prisma Studio shows 1 campaign, 2 players, and the right hex count.

---

## 6. Phase 5: Create Campaign UI

### What

A form at `/campaigns/new`:

- Campaign name (text)
- Size (four options, Large selected by default)
- Attacker: name and faction
- Defender: name and faction
- Submit button

On success, redirect to `/campaigns/[campaignId]`.

Faction choices are grouped under their three headings, matching `FACTION_GROUPS`.

### Why

- Forms are the main way users create things, so this is the core of the feature.
- The options come from `CAMPAIGN_SIZES` and `FACTION_GROUPS`, so the UI can't offer something the server rejects.

### Where

- Form: `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/create-campaign/ui/create-campaign-form.tsx`
- Public API: `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/create-campaign/index.ts`
- Test: `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/create-campaign/ui/create-campaign-form.test.tsx`
- Page: `/Users/georgeslevaillant/Projects/overseer/apps/web/src/app/campaigns/new/page.tsx`

### How

1. **Client component.** The form uses state and events, so it starts with `'use client';`, as `/Users/georgeslevaillant/Projects/overseer/apps/web/src/widgets/hex-map/ui/hex-map.tsx` does. The page stays a server component.
2. **State.** One typed object with `useState`. We are not adding a form library (react-hook-form, zod), because that is a new dependency and AGENTS.md requires approval for it.
3. **Submit.** `useTransition`, as in `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/assign-hex-owner/ui/assign-owner-drawer.tsx`. This disables the button while the server call runs.
4. **Errors.** Show `result.error` in a `role="alert"` paragraph, as the drawer already does.
5. **Components.** Check `/Users/georgeslevaillant/Projects/overseer/packages/ui/src/components/ui` for existing ShadCN pieces (Select, RadioGroup, Input, Label) before adding anything.
6. **Redirect.** `router.push` from `next/navigation` after success.

### Tests (AGENTS.md section 7)

Use Testing Library queries by role and label:

- `it("shows an error when the campaign name is empty")`
- `it("selects a large board by default")`
- `it("groups factions under Imperium, Chaos, and Xenos")`
- `it("calls createCampaign with the chosen size and both players")` (mock the server action, as the drawer test does)

### Verify

- `npm test` passes.
- In the browser, create a small campaign. Seven hexes appear in Prisma Studio.

---

## 7. Phase 6: Routes and Sidebar

### What

- `/campaigns`: list of campaigns.
- `/campaigns/[campaignId]`: one campaign, showing its board.
- The sidebar's "Campaigns" section lists every campaign by its **name**, each linking to its page (D8). This replaces "Campaign 1 / 2 / 3".

The sidebar shows all campaigns for now (Section 1, D8).

### Why

- Next.js maps folders to URLs (see `/Users/georgeslevaillant/Projects/overseer/apps/web/src/app/map/page.tsx`). Square brackets mark a dynamic segment.
- The sidebar is a **widget** (`/Users/georgeslevaillant/Projects/overseer/apps/web/src/widgets/app-shell/ui/app-sidebar.tsx`). It should read campaigns through the `entities/campaign` public API, not query the database itself.
- The sidebar currently has a hardcoded `SECTIONS` array. Campaigns come from the database, so that one section becomes data-driven, while the other three stay as placeholders.

### Where

- `/Users/georgeslevaillant/Projects/overseer/apps/web/src/app/campaigns/page.tsx`
- `/Users/georgeslevaillant/Projects/overseer/apps/web/src/app/campaigns/[campaignId]/page.tsx`
- `/Users/georgeslevaillant/Projects/overseer/apps/web/src/widgets/app-shell/ui/app-sidebar.tsx`

### How

- In Next.js 15+, `params` is a **Promise**. The page signature is `params: Promise<{ campaignId: string }>`, and you `await` it. Check the installed Next.js docs (`/Users/georgeslevaillant/Projects/overseer/node_modules/next/dist/docs/`) before writing it, as AGENTS.md instructs.
- The map page calls `await connection();` before reading the database. Campaigns change, so use the same pattern.
- If a campaign id doesn't exist, call `notFound()` from `next/navigation`.
- The sidebar needs the campaign list, so the layout that renders it fetches campaigns on the server and passes them in as props. The sidebar itself stays simple.

### Verify

- Create two campaigns. Both show in the sidebar by name.
- Each link opens the right campaign.

---

## 8. Phase 7: Board Setup (assigning hexes and faction colours)

### What

On the campaign page, show the hex board. Clicking a hex opens the existing drawer, which lists the two players. A hex can be reassigned at any time (D5). Each hex is drawn in its owner's faction colours (D7).

### Why

- The board, drawer, and assign action already exist. Reusing them is less work and less risk than new UI.
- Passing in a `players` list instead of the fixed `OWNERS` list is what lets one board serve every campaign.
- Faction colours are a display concern, so they belong in the hex cell's props, not in a database lookup inside the cell.

### Colour rendering

Each hex is a polygon. Using the faction colours:

- **Fill** = `primary`.
- **Outline** = `secondary` if present, with a thicker stroke (for example 3px). If there is no secondary, use the current grey outline at 1px.

For a faction with `&` (for example Chaos Space Marines, black fill and gold outline), the gold ring shows the second colour without covering the fill.

A hex with no owner keeps the current neutral fill.

### What changes in existing code

| File                                                                                                           | Change                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/Users/georgeslevaillant/Projects/overseer/apps/web/src/widgets/hex-map/ui/hex-map.tsx`                       | Accept `campaignId` and `players` as props. Pass `players` to the drawer, and look up each owner's faction colours.                                         |
| `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/hex/ui/hex-cell.tsx`                         | Replace the `owner` prop (currently an owner colour) with `fill` and `stroke` props, so it doesn't depend on any list. Keep the focus styling from earlier. |
| `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/hex/ui/hex-cell.test.tsx`                    | Update the "owner colour" test to check the faction's primary colour fills the hex, and the secondary colour is the outline.                                |
| `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/assign-hex-owner/ui/assign-owner-drawer.tsx` | Replace `OWNERS` with the `players` prop. Buttons show the player's name and faction. Add a "Clear owner" button, as today.                                 |
| `/Users/georgeslevaillant/Projects/overseer/apps/web/src/features/assign-hex-owner/api/assign-hex-owner.ts`    | Check the hex and the player belong to the same campaign. Remove the `getOwner` check.                                                                      |
| `/Users/georgeslevaillant/Projects/overseer/apps/web/src/entities/owner/`                                      | Once nothing imports it, remove the `red` / `blue` / `green` list. Search first.                                                                            |

### Reassignment

Reassigning is the same action as the first assignment. The drawer sets the hex's `ownerId` to the new player, and the board redraws in the new colours. Nothing is stored about the change for now.

### Verify

- Assign a hex to each player. Each renders in the right faction colours, with the secondary colour as a thicker outline.
- Reassign a hex from one player to the other. The colour changes.
- The page is reachable and works for a campaign created in Phase 5.

---

## 9. Phase 8: Names Only (temporary limitation)

### What

Players are typed-in names (D1). No account is linked to a player. Anyone with the URL can change a board.

### Why this is OK for now

- It lets us build and test the whole flow without touching security code.
- The limitation is clearly temporary. Add a short note on the campaign page, so nobody mistakes it for real access control.

### What comes next

User profiles, sign-in, and "only the creator" enforcement. See `/Users/georgeslevaillant/.opencode/plan/long-term-plan.md`. That work needs your approval because it touches auth and sessions (AGENTS.md section 6).

---

## 10. Testing and Quality Checklist

Run at the end of every phase:

```bash
cd /Users/georgeslevaillant/Projects/overseer/apps/web
npm test
npm run lint
npm run build
```

- [ ] Phase 1: size rules tested (7, 19, 37, 61 hexes)
- [ ] Phase 2: factions grouped correctly, all 28 present, colours set, `&` factions have a secondary
- [ ] Phase 3: migration applied, Prisma Studio shows the three tables (after approval)
- [ ] Phase 4: create action validates input and creates a campaign with two players and all its hexes
- [ ] Phase 5: create form tested with Testing Library, works in the browser
- [ ] Phase 6: `/campaigns` and `/campaigns/[campaignId]` work, sidebar lists campaigns by name
- [ ] Phase 7: hexes assign and reassign, colours render with outlines
- [ ] Phase 8: the names-only limitation is noted on the campaign page

Run the `fsd-architecture` review after the frontend phases, since this work adds and moves files across layers. Each phase should be its own commit, and `prettier-on-commit` applies to every commit that touches frontend files.

---

## 11. Order of Work at a Glance

1. Section 1 decisions are final.
2. Phase 1: sizes and tests (no approval needed).
3. Phase 2: factions and colours, with tests (no approval needed).
4. **Approval gate**: Phase 3 schema and migration.
5. Phase 4: server create and read logic.
6. Phase 5: create form and page.
7. Phase 6: campaign list, detail page, sidebar.
8. Phase 7: board with faction colours and reassignment.
9. Phase 8: names-only note, then the long-term plan.
