# User Profiles and Sign-In: Code-Along Guide

Goal: people sign in with Google, choose a display name, and only see campaigns they are a player in. The campaign creator is always one of the two players, and invites the other by email. After this guide, every server action knows who is calling it.

This is a code-along. Each step says **what** we are doing, **why**, and gives the code. Type it yourself rather than pasting, so the reasons sink in.

Every file heading shows the full path from the repository root, for example `src/entities/campaign/model/roles.ts`. Create files at exactly the path shown.

Commands run from the repo root unless a step says otherwise.

---

## 0. Decisions (all final)

| #   | Decision            | Answer                                                                                                                                                                         |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| U1  | Sign-in provider    | Google only, through Auth.js v5 (`next-auth@beta`).                                                                                                                            |
| U2  | Session strategy    | JWT. No `Session` table.                                                                                                                                                       |
| U3  | Prisma adapter      | **None.** We own one `User` table. No `Account`, `Session` or `VerificationToken` tables.                                                                                      |
| U4  | Joining a campaign  | The creator types the opponent's **email** (required). The slot is claimed when that email signs in. If that person is already a user, the slot is linked immediately.         |
| U5  | The creator         | Always one of the two players. They pick their side (attacker or defender) when creating the campaign.                                                                         |
| U6  | Who can edit hexes  | Either player.                                                                                                                                                                 |
| U7  | Privacy             | Campaigns are private. If you are not a player, the campaign does not exist as far as you can tell (404).                                                                      |
| U8  | Display name        | Chosen on first sign-in (a `/welcome` page). Editable later on `/profile`.                                                                                                     |
| U9  | Signed-out visitors | Everything redirects to `/sign-in`.                                                                                                                                            |
| U10 | Existing data       | Reset the database. Migrations are squashed into one fresh `init`.                                                                                                             |
| U11 | Future friend list  | Picking a friend (the `@` list) will simply set `Player.userId` directly. `inviteEmail` stays as the fallback for people who are not users yet. No schema change needed later. |

### Approvals recorded (AGENTS.md sections 6 and 8)

You have approved the following. Nothing else is covered by this guide.

- A new dependency: `next-auth@beta`.
- A schema change: `User` model, `Campaign.creatorId`, `Player.userId`, `Player.inviteEmail`.
- Adding Google sign-in, JWT sessions, and authorisation checks in server actions.
- Deleting `dev.db` and the existing migrations.

### Assumptions I made that you did not explicitly decide

Read these. Change them before you start if you disagree.

1. **The NextAuth config lives in `shared/api/auth.ts`**, not `features/auth`. `AGENTS.md` suggests `features/auth`, but server actions in `features/create-campaign` and `features/assign-hex-owner` must call `requireProfile()`. Features may not import from each other, so the session helper has to live in a lower layer (`entities/user`), and that layer may only import from `shared`. The sign-in and sign-out **UI** still lives in `features/auth`.
2. **Users are created lazily.** The auth config does not touch the database. The first time a signed-in person loads a page, `getCurrentUser()` creates their `User` row. This keeps the config free of Prisma, so the same file works in the proxy.
3. **You cannot invite yourself.** The opponent's email must differ from yours. To test with one machine you need a second Google account.
4. **The opponent's name is typed by the creator** and stored in `Player.name`. It is not replaced by their display name when they join. That can come later.
5. **Gmail dots and aliases are not normalised.** `sam.smith@gmail.com` and `samsmith@gmail.com` are the same Google account but different strings, so a claim would silently fail. The future friend list removes this problem.
6. **There is no email sending.** The creator tells the opponent to sign in with the invited address.

### Not in this guide

- The attacker and defender views (the next guide). This guide ends with the server knowing who the viewer is and which side they play.
- Extracting UI strings for i18n (an item in `Notes.md`). New strings here are plain strings.
- Profile pictures, friend lists, more providers, deleting an account.

---

## 1. Phase 1: One home for attacker and defender (pure logic)

### What

A `PlayerRole` type, the list of roles, their labels, and two helpers, in `entities/campaign`.

### Why

`Notes.md` says "Attacker/attacker and Defender/defender need to be centralised so there is one point of control". Right now `'attacker' | 'defender'` is written in `player-fields.tsx`, the labels are in a second place, and `Player.role` is a plain `string` everywhere else. The attacker and defender views will use roles in many places, so we fix this before anything depends on it.

We only create the module and its test now. The places that use it (the form, the validation, the queries) get rewritten in later phases, and we swap them over there.

### `src/entities/campaign/model/roles.ts`

```ts
export const PLAYER_ROLES = ['attacker', 'defender'] as const;

export type PlayerRole = (typeof PLAYER_ROLES)[number];

export const ROLE_LABELS: Record<PlayerRole, string> = {
  attacker: 'Attacker',
  defender: 'Defender',
};

export function parsePlayerRole(value: unknown): PlayerRole | undefined {
  return PLAYER_ROLES.find((role) => role === value);
}

export function opposingRole(role: PlayerRole): PlayerRole {
  return role === 'attacker' ? 'defender' : 'attacker';
}
```

**Why `as const`:** it makes `PlayerRole` the union `'attacker' | 'defender'`, so a typo is a compile error.

**Why `parsePlayerRole` takes `unknown`:** the role arrives from a form or the database as a loose string. This is the one place that turns it into the safe type, the same idea as `parseFactionId`.

**Why `Record<PlayerRole, string>` for labels:** if a third role is ever added, TypeScript errors until it has a label.

### `src/entities/campaign/model/roles.test.ts`

```ts
import { opposingRole, parsePlayerRole, PLAYER_ROLES, ROLE_LABELS } from './roles';

describe('player roles', () => {
  it('lists attacker and defender', () => {
    expect(PLAYER_ROLES).toEqual(['attacker', 'defender']);
  });

  it('has a label for every role', () => {
    expect(ROLE_LABELS).toEqual({ attacker: 'Attacker', defender: 'Defender' });
  });

  it('parses a known role', () => {
    expect(parsePlayerRole('attacker')).toBe('attacker');
    expect(parsePlayerRole('defender')).toBe('defender');
  });

  it('rejects anything that is not exactly a role', () => {
    expect(parsePlayerRole('Attacker')).toBeUndefined();
    expect(parsePlayerRole('')).toBeUndefined();
    expect(parsePlayerRole(undefined)).toBeUndefined();
    expect(parsePlayerRole(7)).toBeUndefined();
  });

  it('gives the opposing role', () => {
    expect(opposingRole('attacker')).toBe('defender');
    expect(opposingRole('defender')).toBe('attacker');
  });
});
```

### `src/entities/campaign/index.ts`

Add one export block. The whole file becomes:

```ts
export { CAMPAIGN_SIZES, DEFAULT_CAMPAIGN_SIZE, radiusFor, type CampaignSize } from './model/size';
export {
  opposingRole,
  parsePlayerRole,
  PLAYER_ROLES,
  ROLE_LABELS,
  type PlayerRole,
} from './model/roles';
export type {
  CampaignDetail,
  CampaignHexRecord,
  CampaignSummary,
  PlayerRecord,
} from './model/types';
```

**Check:** `npm run test` passes, including the new `roles.test.ts`.

---

## 2. Phase 2: Install, environment variables, and Google

### 2.1 Install the library

**Why `@beta`:** on npm, the `latest` tag of `next-auth` is still version 4, which has a different API. Version 5 (Auth.js) is published under the `beta` tag. It lists Next 16 as a supported peer.

```bash
npm install next-auth@beta --save-exact
```

`--save-exact` pins the version, so a new beta cannot change behaviour under you. Check `package.json` now contains `"next-auth": "5.0.0-beta.xx"`.

### 2.2 Create a Google OAuth client

You do not have a Google Cloud account set up, so here are the steps. Google renames menu items now and then, so the wording may differ slightly.

1. Go to <https://console.cloud.google.com> and sign in with any Google account. Create a **new project** called `overseer`.
2. Open **APIs & Services**, then the **OAuth consent screen** (it may be called **Google Auth Platform**).
3. Choose **External** as the audience, fill in the app name (`Overseer`) and your email, and save.
4. Leave the publishing status as **Testing**. In Testing mode **only listed test users can sign in**, so add your own Google address and your opponent's (you will need a second account to test, see Phase 12). Add **Test users** under **Audience**.
5. Open **Credentials** (or **Clients**), then **Create credentials**, then **OAuth client ID**, and choose **Web application**.
6. Under **Authorised JavaScript origins**, add `http://localhost:3000`.
7. Under **Authorised redirect URIs**, add exactly:

   ```text
   http://localhost:3000/api/auth/callback/google
   ```

8. Create it, then copy the **Client ID** and **Client secret**.

**Why the redirect URI must match exactly:** after Google signs the user in, it sends the browser back to this address. If it is off by one character, Google refuses with `redirect_uri_mismatch`.

### 2.3 Environment variables

**Why these names:** Auth.js reads `AUTH_SECRET`, `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` automatically. With these names, we never pass credentials into the config in code (`AGENTS.md` forbids hardcoding secrets).

Generate a secret:

```bash
openssl rand -base64 33
```

Add to `.env` (this file is git-ignored):

```bash
AUTH_SECRET="paste-the-generated-secret"
AUTH_GOOGLE_ID="paste-the-client-id"
AUTH_GOOGLE_SECRET="paste-the-client-secret"
```

`AUTH_SECRET` is what signs and encrypts the session cookie. Anyone who knows it can forge a login, so never commit it.

Then update `.env.example`, which **is** committed, with the names only and no values:

```bash
DATABASE_URL="file:./dev.db"
AUTH_SECRET=""
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
```

**Why update `.env.example`:** it tells the next person (or you in six months) which variables the app needs.

---

## 3. Phase 3: Schema and database reset

### What

Add a `User` model and link it to `Campaign` and `Player`. Then wipe the database and start from one fresh migration.

### Why

- `User` is the person. `Player` stays the seat in one campaign (role, faction, name). One user has many players, one in each campaign they are in.
- `Player.userId` is **nullable**: an invited seat has no user until the invitee signs in.
- `Player.inviteEmail` holds the pending invite. It is cleared when the seat is claimed.
- `Campaign.creatorId` is **required** and explicit. "Who created it" is a permission and "attacker" is a role, and the two can diverge later, so we do not derive one from the other.
- `User.googleSub` is Google's permanent id for the person. The email can change, the `sub` does not, so we identify people by `sub`.
- `displayName` is nullable. A user exists from first sign-in, but has no name until they finish `/welcome`.

### `prisma/schema.prisma`

Replace the file with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
}

model User {
  id          String     @id @default(cuid())
  googleSub   String     @unique
  email       String     @unique
  displayName String?
  createdAt   DateTime   @default(now())
  players     Player[]
  campaigns   Campaign[] @relation("CampaignCreator")
}

model Campaign {
  id        String   @id @default(cuid())
  name      String
  size      String
  createdAt DateTime @default(now())
  creatorId String
  creator   User     @relation("CampaignCreator", fields: [creatorId], references: [id])
  players   Player[]
  hexes     Hex[]
}

model Player {
  id          String   @id @default(cuid())
  campaignId  String
  campaign    Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  role        String
  name        String
  factionId   String
  userId      String?
  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  inviteEmail String?
  hexes       Hex[]

  @@unique([campaignId, role])
  @@index([inviteEmail])
}

model Hex {
  id         String   @id @default(cuid())
  q          Int
  r          Int
  campaignId String
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)
  ownerId    String?
  owner      Player?  @relation(fields: [ownerId], references: [id])

  @@unique([campaignId, q, r])
}
```

**Why `@@index([inviteEmail])`:** when someone signs up we look up every seat waiting for their email. The index makes that lookup cheap.

**Why `onDelete: SetNull` on `Player.user`:** if a user row is ever deleted, the seat and its hexes survive and simply become unclaimed.

### Reset the database

Stop `npm run dev` first. Then:

```bash
rm dev.db
rm -rf prisma/migrations
npx prisma migrate dev --name init
npx prisma generate
```

**Why delete the migrations too:** the old migrations describe a schema with no users. Replaying them and adding a fourth migration would give a history that includes data shapes we no longer care about. One `init` is cleaner for a project with no real data.

**Why `generate` separately:** in Prisma 7, `migrate dev` no longer regenerates the client for you.

**Check:** `ls prisma/migrations` shows one folder ending in `_init` plus `migration_lock.toml`, and `dev.db` exists again.

### Expect red from here until Phase 8

`createCampaign` does not set `creatorId` yet, so `npm run typecheck` will fail until Phase 8. That is expected. Each phase says what to check; run the full typecheck at the end of Phase 8.

---

## 4. Phase 4: The auth core

### 4.1 The config: `src/shared/api/auth.ts`

**What:** one file that creates the Auth.js instance and exports `handlers`, `auth`, `signIn` and `signOut`.

**Why `shared/api`:** it is infrastructure, like `db.ts`. It does not import anything above `shared`. See assumption 1.

**Why no database here:** this file only turns Google's answer into a signed cookie. Turning it into a `User` row happens in `entities/user` (Phase 5).

```ts
import NextAuth, { type DefaultSession } from 'next-auth';
import Google from 'next-auth/providers/google';

declare module 'next-auth' {
  interface Session {
    user: { id: string } & DefaultSession['user'];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  session: { strategy: 'jwt' },
  pages: { signIn: '/sign-in', error: '/sign-in' },
  callbacks: {
    signIn({ account, profile }) {
      return account?.provider === 'google' && profile?.email_verified === true;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const signedIn = Boolean(auth?.user);
      if (nextUrl.pathname === '/sign-in') {
        return signedIn ? Response.redirect(new URL('/', nextUrl)) : true;
      }
      return signedIn;
    },
  },
});
```

Walking through it:

- **`providers: [Google]`:** with no options, it reads `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` from the environment.
- **`session: { strategy: 'jwt' }`:** decision U2. The session lives in an encrypted cookie. No table, and verifying it needs no database call.
- **`pages`:** Auth.js has its own default sign-in page. These lines send people to ours (Phase 6) and send errors there too, as `/sign-in?error=...`.
- **`signIn` callback:** it returns `false` to refuse the login. We only accept Google, and only when Google says the email is **verified**. **Why this matters:** the invite flow trusts the email. If an unverified address could sign in, someone could register `sam@example.com` without owning it and claim Sam's seat.
- **`session` callback:** with JWT sessions, Auth.js puts Google's permanent `sub` into `token.sub`. We copy it onto `session.user.id` so server code can read it. This id is the Google `sub`, **not** our `User.id`. Phase 5 maps one to the other.
- **`authorized` callback:** this one only runs when `auth` is used as the proxy (Phase 11). Returning `false` redirects to the sign-in page. A signed-in person who opens `/sign-in` is sent home.
- **`declare module 'next-auth'`:** teaches TypeScript that `session.user.id` exists.

### 4.2 The route handler: `src/app/api/auth/[...nextauth]/route.ts`

**Why:** Google sends the browser back to `/api/auth/callback/google`. This catch-all route is where Auth.js receives that and the other auth requests (sign-in, sign-out, session).

```ts
import { handlers } from '@/shared/api/auth';

export const { GET, POST } = handlers;
```

Create the `api/auth/[...nextauth]` folders exactly as written, including the square brackets and dots.

### A warning about Jest

`next-auth` is an ES module package, and this repo's Jest runs TypeScript as CommonJS. **If a test imports `@/shared/api/auth` for real, it will fail with `SyntaxError: Cannot use import statement outside a module`.** The rule for this guide: any test whose code touches auth mocks `@/shared/api/auth` with a factory, as the tests below do. A factory mock means Jest never loads the real file.

**Check:** nothing to run yet. `npm run dev` should still start, because nothing imports the new files. The app is not protected until Phase 11.

---

## 5. Phase 5: The user entity (`entities/user`)

### What

The user type, two small pure helpers (email and display-name validation), the database queries, and the session helpers every server action will call.

### Why `entities/user` and not `features/auth`

`features/create-campaign` and `features/assign-hex-owner` need the current user. Features cannot import each other, but both can import an entity. So the "who is calling" helper lives here.

The folder follows the same pattern as `entities/campaign`: `index.ts` is safe for the browser, `server.ts` is server-only.

### 5.1 `src/entities/user/model/types.ts`

```ts
export type UserRecord = {
  id: string;
  email: string;
  displayName: string | null;
};
```

**Why not the Prisma type:** same reason as for hexes. The UI should not depend on Prisma, and this is exactly the shape that crosses to components.

### 5.2 `src/entities/user/lib/email.ts`

```ts
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normaliseEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const email = input.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}
```

**Why lower-case:** invites are matched by exact string. We store and compare everything lower-case so `Sam@Example.com` and `sam@example.com` are the same person.

**Why such a loose pattern:** the only real test of an email is whether that person can sign in with it. This just catches typos like a missing `@`.

### 5.3 `src/entities/user/lib/email.test.ts`

```ts
import { normaliseEmail } from './email';

describe('normaliseEmail', () => {
  it('trims and lower-cases a valid email', () => {
    expect(normaliseEmail('  Sam@Example.COM ')).toBe('sam@example.com');
  });

  it('rejects text without an @ and a domain', () => {
    expect(normaliseEmail('sam')).toBeNull();
    expect(normaliseEmail('sam@')).toBeNull();
    expect(normaliseEmail('sam@example')).toBeNull();
  });

  it('rejects an email with spaces inside', () => {
    expect(normaliseEmail('sam smith@example.com')).toBeNull();
  });

  it('rejects values that are not text', () => {
    expect(normaliseEmail(undefined)).toBeNull();
    expect(normaliseEmail(42)).toBeNull();
  });
});
```

### 5.4 `src/entities/user/model/display-name.ts`

```ts
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 32;

export type DisplayNameResult = { ok: true; displayName: string } | { ok: false; error: string };

export function validateDisplayName(input: unknown): DisplayNameResult {
  const displayName = typeof input === 'string' ? input.trim().replace(/\s+/g, ' ') : '';

  if (displayName.length < DISPLAY_NAME_MIN) {
    return { ok: false, error: `Display name must be at least ${DISPLAY_NAME_MIN} characters` };
  }
  if (displayName.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `Display name must be at most ${DISPLAY_NAME_MAX} characters` };
  }
  return { ok: true, displayName };
}
```

**Why collapse repeated spaces:** `Sam    Smith` and `Sam Smith` should look the same everywhere.

**Why this is a pure function:** the form can use it for instant feedback later, and the server action uses it as the real check. Same pattern as `validateCampaign`.

### 5.5 `src/entities/user/model/display-name.test.ts`

```ts
import { validateDisplayName } from './display-name';

describe('validateDisplayName', () => {
  it('trims the name and collapses repeated spaces', () => {
    expect(validateDisplayName('  Sam   Smith ')).toEqual({ ok: true, displayName: 'Sam Smith' });
  });

  it('rejects a name that is too short', () => {
    expect(validateDisplayName('S')).toEqual({
      ok: false,
      error: 'Display name must be at least 2 characters',
    });
  });

  it('rejects a name made only of spaces', () => {
    expect(validateDisplayName('     ')).toEqual({
      ok: false,
      error: 'Display name must be at least 2 characters',
    });
  });

  it('rejects a name that is too long', () => {
    expect(validateDisplayName('x'.repeat(33))).toEqual({
      ok: false,
      error: 'Display name must be at most 32 characters',
    });
  });

  it('rejects a value that is not text', () => {
    expect(validateDisplayName(undefined).ok).toBe(false);
  });
});
```

### 5.6 `src/entities/user/api/user-queries.ts`

```ts
import 'server-only';
import { prisma } from '@/shared/api/db';
import type { UserRecord } from '../model/types';

const userSelect = { id: true, email: true, displayName: true } as const;

type GoogleIdentity = { googleSub: string; email: string };

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  return prisma.user.findUnique({ where: { email }, select: userSelect });
}

export async function findOrCreateUser(identity: GoogleIdentity): Promise<UserRecord> {
  const existing = await prisma.user.findUnique({
    where: { googleSub: identity.googleSub },
    select: userSelect,
  });
  if (existing) return existing;

  const email = identity.email.trim().toLowerCase();

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { googleSub: identity.googleSub, email },
        select: userSelect,
      });
      await tx.player.updateMany({
        where: { inviteEmail: email, userId: null },
        data: { userId: user.id, inviteEmail: null },
      });
      return user;
    });
  } catch {
    // Two requests can race to create the same user. The loser reads the winner's row.
    return prisma.user.findUniqueOrThrow({
      where: { googleSub: identity.googleSub },
      select: userSelect,
    });
  }
}

export async function setDisplayName(userId: string, displayName: string): Promise<UserRecord> {
  return prisma.user.update({
    where: { id: userId },
    data: { displayName },
    select: userSelect,
  });
}
```

Walking through `findOrCreateUser`:

1. Look the person up by Google `sub`. If they exist, return them. This is the path for almost every request.
2. If not, we create the row **and claim invites in one transaction**. `updateMany` finds every seat whose `inviteEmail` matches and links it to the new user, clearing the invite. This is decision U4.
3. **Why a transaction:** either both happen or neither does. We never end with a user whose invites were not claimed.
4. **Why the `catch`:** a layout and a prefetch can run at the same time for a brand new user, and both try to create. SQLite's unique constraint makes one fail. The loser simply reads the row the winner created. If the row genuinely is not there, `findUniqueOrThrow` throws, which surfaces the real problem.

**Why `userSelect` as a constant:** every function returns the same three fields, and the select is explicit about what leaves the server.

**Why claiming lives in the user entity and not the campaign entity:** entities should not import each other. We write to `Player` through Prisma directly, which is allowed, and the logic is one small `updateMany`.

**Why we only claim at creation time:** invites for someone who already has an account are linked straight away when the campaign is created (Phase 8). So the only time a pending invite can match is when that person first appears.

### 5.7 `src/entities/user/api/user-queries.test.ts`

```ts
import { prisma } from '@/shared/api/db';
import { findOrCreateUser, findUserByEmail, setDisplayName } from './user-queries';

jest.mock('server-only', () => ({}));

const mockTx = {
  user: { create: jest.fn() },
  player: { updateMany: jest.fn() },
};

jest.mock('@/shared/api/db', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (callback: (tx: typeof mockTx) => unknown) => callback(mockTx)),
  },
}));

const mockedFindUnique = jest.mocked(prisma.user.findUnique);
const mockedFindOrThrow = jest.mocked(prisma.user.findUniqueOrThrow);
const mockedUpdate = jest.mocked(prisma.user.update);

const user = { id: 'user-1', email: 'sam@example.com', displayName: null };
const identity = { googleSub: 'sub-1', email: 'Sam@Example.com' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('findUserByEmail', () => {
  it('looks the user up by email', async () => {
    mockedFindUnique.mockResolvedValue(user as never);

    await expect(findUserByEmail('sam@example.com')).resolves.toEqual(user);
    expect(mockedFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'sam@example.com' } })
    );
  });

  it('returns null when nobody has that email', async () => {
    mockedFindUnique.mockResolvedValue(null);

    await expect(findUserByEmail('nobody@example.com')).resolves.toBeNull();
  });
});

describe('findOrCreateUser', () => {
  it('returns the existing user without creating one', async () => {
    mockedFindUnique.mockResolvedValue(user as never);

    await expect(findOrCreateUser(identity)).resolves.toEqual(user);
    expect(mockTx.user.create).not.toHaveBeenCalled();
  });

  it('creates the user with a lower-case email', async () => {
    mockedFindUnique.mockResolvedValue(null);
    mockTx.user.create.mockResolvedValue(user);

    await findOrCreateUser(identity);

    expect(mockTx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { googleSub: 'sub-1', email: 'sam@example.com' } })
    );
  });

  it('claims every seat waiting for that email', async () => {
    mockedFindUnique.mockResolvedValue(null);
    mockTx.user.create.mockResolvedValue(user);

    await findOrCreateUser(identity);

    expect(mockTx.player.updateMany).toHaveBeenCalledWith({
      where: { inviteEmail: 'sam@example.com', userId: null },
      data: { userId: 'user-1', inviteEmail: null },
    });
  });

  it('reads the winning row when two requests race to create the user', async () => {
    mockedFindUnique.mockResolvedValue(null);
    mockTx.user.create.mockRejectedValue(new Error('Unique constraint failed'));
    mockedFindOrThrow.mockResolvedValue(user as never);

    await expect(findOrCreateUser(identity)).resolves.toEqual(user);
  });
});

describe('setDisplayName', () => {
  it('saves the display name for the user', async () => {
    mockedUpdate.mockResolvedValue({ ...user, displayName: 'Sam' } as never);

    await setDisplayName('user-1', 'Sam');

    expect(mockedUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' }, data: { displayName: 'Sam' } })
    );
  });
});
```

**Why the `mockTx` name:** Jest only lets a `jest.mock` factory use outer variables whose names start with `mock`. The `$transaction` stub calls the callback with our fake transaction client, so we can check what happened inside it.

### 5.8 `src/entities/user/api/session.ts`

```ts
import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/shared/api/auth';
import type { UserRecord } from '../model/types';
import { findOrCreateUser } from './user-queries';

export type ProfiledUser = UserRecord & { displayName: string };

export const getCurrentUser = cache(async (): Promise<UserRecord | null> => {
  const session = await auth();
  const googleSub = session?.user?.id;
  const email = session?.user?.email;
  if (!googleSub || !email) return null;

  return findOrCreateUser({ googleSub, email });
});

export async function requireUser(): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');
  return user;
}

export async function requireProfile(): Promise<ProfiledUser> {
  const user = await requireUser();
  if (!user.displayName) redirect('/welcome');
  return { ...user, displayName: user.displayName };
}
```

Three helpers, three levels:

- **`getCurrentUser()`** returns the person or `null`. Use it where being signed out is fine (the layout, the sign-in page).
- **`requireUser()`** redirects to `/sign-in` if signed out. Use it on `/welcome`, where the person has no display name yet.
- **`requireProfile()`** also redirects to `/welcome` if they have not chosen a display name. Use it everywhere else, and in every server action. It returns a `ProfiledUser`, so `user.displayName` is a plain `string`, not `string | null`.

**Why `cache` from React:** the layout and the page both ask for the user during one request. `cache` makes the second call reuse the first answer, so we do one lookup, not two.

**Why `redirect` narrows the type:** `redirect()` never returns, so TypeScript knows that after `if (!user) redirect(...)` the user exists.

**Why this is the real security boundary and the proxy (Phase 11) is not:** the Next.js docs say proxy checks are optimistic and should not be the only line of defence. Layouts are not reliable either, because they do not re-render on every client navigation. So **every page and every server action calls `requireProfile()` itself.**

### 5.9 `src/entities/user/api/session.test.ts`

```ts
import { redirect } from 'next/navigation';
import { auth } from '@/shared/api/auth';
import { getCurrentUser, requireProfile, requireUser } from './session';
import { findOrCreateUser } from './user-queries';

jest.mock('server-only', () => ({}));

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  cache: <T>(fn: T) => fn,
}));

jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

jest.mock('@/shared/api/auth', () => ({ auth: jest.fn() }));

jest.mock('./user-queries', () => ({ findOrCreateUser: jest.fn() }));

const mockedAuth = auth as unknown as jest.Mock;
const mockedFindOrCreate = jest.mocked(findOrCreateUser);
const mockedRedirect = jest.mocked(redirect);

const signedIn = { user: { id: 'sub-1', email: 'sam@example.com' } };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('getCurrentUser', () => {
  it('returns null when nobody is signed in', async () => {
    mockedAuth.mockResolvedValue(null);

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mockedFindOrCreate).not.toHaveBeenCalled();
  });

  it('finds or creates the user from the Google id and email in the session', async () => {
    mockedAuth.mockResolvedValue(signedIn);
    mockedFindOrCreate.mockResolvedValue({
      id: 'user-1',
      email: 'sam@example.com',
      displayName: 'Sam',
    });

    await expect(getCurrentUser()).resolves.toEqual({
      id: 'user-1',
      email: 'sam@example.com',
      displayName: 'Sam',
    });
    expect(mockedFindOrCreate).toHaveBeenCalledWith({
      googleSub: 'sub-1',
      email: 'sam@example.com',
    });
  });
});

describe('requireUser', () => {
  it('sends a signed-out visitor to the sign-in page', async () => {
    mockedAuth.mockResolvedValue(null);

    await expect(requireUser()).rejects.toThrow('NEXT_REDIRECT:/sign-in');
    expect(mockedRedirect).toHaveBeenCalledWith('/sign-in');
  });
});

describe('requireProfile', () => {
  it('sends a user without a display name to the welcome page', async () => {
    mockedAuth.mockResolvedValue(signedIn);
    mockedFindOrCreate.mockResolvedValue({
      id: 'user-1',
      email: 'sam@example.com',
      displayName: null,
    });

    await expect(requireProfile()).rejects.toThrow('NEXT_REDIRECT:/welcome');
  });

  it('returns the user once they have a display name', async () => {
    mockedAuth.mockResolvedValue(signedIn);
    mockedFindOrCreate.mockResolvedValue({
      id: 'user-1',
      email: 'sam@example.com',
      displayName: 'Sam',
    });

    await expect(requireProfile()).resolves.toEqual({
      id: 'user-1',
      email: 'sam@example.com',
      displayName: 'Sam',
    });
  });
});
```

**Why mock `react`'s `cache`:** a real `cache` would remember the first answer, and every later test would see stale data. Replacing it with a pass-through keeps each test independent.

**Why the mocked `redirect` throws:** the real one throws a special error to stop rendering. Our fake does the same, so code after `redirect(...)` does not run in a test either.

### 5.10 The public API

`src/entities/user/index.ts` (safe for the browser, no server code):

```ts
export { normaliseEmail } from './lib/email';
export { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN, validateDisplayName } from './model/display-name';
export type { UserRecord } from './model/types';
```

`src/entities/user/server.ts` (server only):

```ts
export { findOrCreateUser, findUserByEmail, setDisplayName } from './api/user-queries';
export { getCurrentUser, requireProfile, requireUser, type ProfiledUser } from './api/session';
```

**Why two files:** if a client component imported `session.ts`, the build would fail on `server-only`. Splitting the entrypoints makes the safe one the easy one to reach for. It is the same pattern as `entities/campaign/server.ts`.

**Check:** `npm run test` passes for the new `entities/user` tests. (The whole-repo typecheck is still red, see Phase 3.)

---

## 6. Phase 6: Sign in, sign out, welcome, and profile

### 6.1 The auth feature (`features/auth`)

**What:** two server actions and two small buttons.

**Why a feature:** signing in and out are things a user does, so they get their own slice.

#### `src/features/auth/api/auth-actions.ts`

```ts
'use server';

import { signIn, signOut } from '@/shared/api/auth';

export async function signInWithGoogle(): Promise<void> {
  await signIn('google', { redirectTo: '/' });
}

export async function signOutUser(): Promise<void> {
  await signOut({ redirectTo: '/sign-in' });
}
```

**Why server actions:** `signIn` and `signOut` need to set and clear cookies, which only server code can do. A form can call a server action directly, with no client JavaScript.

**Why `redirectTo: '/'`:** after Google sends the person back, Auth.js sends them here. A user with no display name will be bounced on to `/welcome` by `requireProfile()`.

#### `src/features/auth/ui/sign-in-button.tsx`

```tsx
import { Button } from '@/shared/ui';
import { signInWithGoogle } from '../api/auth-actions';

export function SignInButton() {
  return (
    <form action={signInWithGoogle}>
      <Button type="submit">Sign in with Google</Button>
    </form>
  );
}
```

#### `src/features/auth/ui/sign-out-button.tsx`

```tsx
import { Button } from '@/shared/ui';
import { signOutUser } from '../api/auth-actions';

export function SignOutButton() {
  return (
    <form action={signOutUser}>
      <Button type="submit" variant="ghost" size="sm">
        Sign out
      </Button>
    </form>
  );
}
```

**Why no `'use client'`:** a `<form action={serverAction}>` works in a Server Component. No browser JavaScript means fewer client boundaries.

#### `src/features/auth/index.ts`

```ts
export { SignInButton } from './ui/sign-in-button';
export { SignOutButton } from './ui/sign-out-button';
```

Note that `signInWithGoogle` and `signOutUser` are **not** exported. Nothing outside the slice needs them.

#### `src/features/auth/ui/auth-buttons.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import { SignInButton } from './sign-in-button';
import { SignOutButton } from './sign-out-button';

jest.mock('../api/auth-actions', () => ({
  signInWithGoogle: jest.fn(),
  signOutUser: jest.fn(),
}));

it('offers a Google sign-in button', () => {
  render(<SignInButton />);

  expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeInTheDocument();
});

it('offers a sign-out button', () => {
  render(<SignOutButton />);

  expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
});
```

**Why only render tests:** the buttons hold no logic. Whether the real sign-in works is checked by hand in Phase 12, because it needs Google.

### 6.2 The edit-profile feature (`features/edit-profile`)

**What:** a server action that saves the display name and one form, used by both `/welcome` and `/profile`.

**Why one form for two pages:** choosing a name at sign-up and changing it later are the same action. The page passes in where to go afterwards.

#### `src/features/edit-profile/api/save-display-name.ts`

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { validateDisplayName } from '@/entities/user';
import { requireUser, setDisplayName } from '@/entities/user/server';

type SaveDisplayNameInput = { displayName?: unknown };
type SaveDisplayNameResult = { ok: true } | { ok: false; error: string };

export async function saveDisplayName(input: SaveDisplayNameInput): Promise<SaveDisplayNameResult> {
  const user = await requireUser();

  const result = validateDisplayName(input.displayName);
  if (!result.ok) return result;

  await setDisplayName(user.id, result.displayName);
  revalidatePath('/', 'layout');
  return { ok: true };
}
```

**Why `requireUser`, not `requireProfile`:** this action is what gives a new user their display name. `requireProfile` would bounce them to `/welcome` forever.

**Why the user id comes from the session and not from the input:** anything from the browser can be forged. If the action accepted a `userId`, anyone could rename anyone.

**Why `revalidatePath('/', 'layout')`:** the top bar in the layout shows the display name. This tells Next.js to rebuild it.

#### `src/features/edit-profile/ui/display-name-form.tsx`

```tsx
'use client';

import { SyntheticEvent, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label } from '@/shared/ui';
import { saveDisplayName } from '../api/save-display-name';

type DisplayNameFormProps = {
  initialValue: string;
  redirectTo: string;
  submitLabel: string;
};

export function DisplayNameForm({ initialValue, redirectTo, submitLabel }: DisplayNameFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveDisplayName({ displayName: value });
      if (result.ok) {
        router.push(redirectTo);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="display-name">Display name</Label>
        <Input id="display-name" value={value} onChange={(event) => setValue(event.target.value)} />
      </div>

      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
```

This is the same shape as `CreateCampaignForm`: local state, `useTransition` for the pending flag, an `alert` for errors.

#### `src/features/edit-profile/index.ts`

```ts
export { DisplayNameForm } from './ui/display-name-form';
```

#### `src/features/edit-profile/ui/display-name-form.test.tsx`

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { saveDisplayName } from '../api/save-display-name';
import { DisplayNameForm } from './display-name-form';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('../api/save-display-name', () => ({
  saveDisplayName: jest.fn(),
}));

const mockedSave = jest.mocked(saveDisplayName);

function renderForm() {
  render(<DisplayNameForm initialValue="" redirectTo="/campaigns" submitLabel="Continue" />);
}

beforeEach(() => {
  mockPush.mockReset();
  mockedSave.mockReset();
  mockedSave.mockResolvedValue({ ok: true });
});

it('saves the typed name and moves on', async () => {
  renderForm();

  await userEvent.type(screen.getByLabelText('Display name'), 'Alex');
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

  expect(mockedSave).toHaveBeenCalledWith({ displayName: 'Alex' });
  expect(mockPush).toHaveBeenCalledWith('/campaigns');
});

it('starts with the current name filled in', () => {
  render(<DisplayNameForm initialValue="Sam" redirectTo="/profile" submitLabel="Save" />);

  expect(screen.getByLabelText('Display name')).toHaveValue('Sam');
});

it('shows the error and stays put when saving fails', async () => {
  mockedSave.mockResolvedValue({ ok: false, error: 'Display name must be at least 2 characters' });
  renderForm();

  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Display name must be at least 2 characters'
  );
  expect(mockPush).not.toHaveBeenCalled();
});
```

### 6.3 The pages (`app/`)

Each page calls `connection()` first. That is what the existing pages do: it marks the page as rendered per request, so nothing is cached between users.

#### `src/app/sign-in/page.tsx`

```tsx
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { getCurrentUser } from '@/entities/user/server';
import { SignInButton } from '@/features/auth';

type SignInPageProps = { searchParams: Promise<{ error?: string }> };

export default async function SignInPage({ searchParams }: SignInPageProps) {
  await connection();
  if (await getCurrentUser()) redirect('/');

  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Sign in to Overseer</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <p role="alert" className="text-destructive">
              Sign in failed. Check that your Google email is verified and try again.
            </p>
          )}
          <SignInButton />
        </CardContent>
      </Card>
    </main>
  );
}
```

**Why `searchParams` is a `Promise`:** in this version of Next.js, route params and search params are async, like `params` on the campaign page.

**Why any `error` shows one message:** Auth.js passes codes like `AccessDenied` (our `signIn` callback said no) or `Configuration`. None are useful to show a player, and the details go to the server log.

#### `src/app/welcome/page.tsx`

```tsx
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { requireUser } from '@/entities/user/server';
import { DisplayNameForm } from '@/features/edit-profile';

export default async function WelcomePage() {
  await connection();
  const user = await requireUser();
  if (user.displayName) redirect('/campaigns');

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Welcome to Overseer</h1>
      <p className="text-muted-foreground">
        Choose the name other players will see. You can change it later on your profile.
      </p>
      <DisplayNameForm initialValue="" redirectTo="/campaigns" submitLabel="Continue" />
    </main>
  );
}
```

**Why `requireUser` and the early redirect:** a user who already has a name should not see the welcome screen again.

#### `src/app/profile/page.tsx`

```tsx
import { connection } from 'next/server';
import { requireProfile } from '@/entities/user/server';
import { DisplayNameForm } from '@/features/edit-profile';

export default async function ProfilePage() {
  await connection();
  const user = await requireProfile();

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Profile</h1>
      <p className="text-muted-foreground">Signed in as {user.email}</p>
      <DisplayNameForm initialValue={user.displayName} redirectTo="/profile" submitLabel="Save" />
    </main>
  );
}
```

### 6.4 Guard the existing pages

Every page behind the sign-in needs to call `requireProfile()` so an incomplete profile is sent to `/welcome`.

#### `src/app/page.tsx`

```tsx
import { connection } from 'next/server';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui';
import { requireProfile } from '@/entities/user/server';

export default async function HomePage() {
  await connection();
  await requireProfile();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Overseer</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Clean slate. Start building here.</p>
        </CardContent>
      </Card>
    </main>
  );
}
```

#### `src/app/campaigns/new/page.tsx`

```tsx
import { connection } from 'next/server';
import { requireProfile } from '@/entities/user/server';
import { CreateCampaignForm } from '@/features/create-campaign';

export default async function NewCampaignPage() {
  await connection();
  await requireProfile();

  return <CreateCampaignForm />;
}
```

The campaigns list and the campaign page change in Phases 7 and 9, because they also need the user's id.

---

## 7. Phase 7: Campaign queries that know the viewer

### What

`listCampaigns` and `getCampaign` take a `userId` and only return campaigns that user plays in. `PlayerRecord` gets a typed role and a `joined` flag.

### Why

This is decision U7 (private campaigns). The filter is in the query, not in the page, so there is no code path that forgets it. A campaign you are not in comes back as `null`, and the page shows a 404, the same as a campaign that does not exist, so its existence is not revealed.

### `src/entities/campaign/model/types.ts`

```ts
import type { PlayerRole } from './roles';

export type CampaignSummary = { id: string; name: string };

export type PlayerRecord = {
  id: string;
  role: PlayerRole;
  name: string;
  factionId: string;
  joined: boolean;
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

**Why `role: PlayerRole`:** this is where the roles module pays off. Anything reading a player's role now gets `'attacker' | 'defender'`, not `string`.

**Why `joined`:** `false` means the seat is an invite nobody has accepted yet. The page can show that. We expose a boolean instead of the user id or email, so the UI never sees them.

### `src/entities/campaign/api/campaign-queries.ts`

```ts
import 'server-only';
import { prisma } from '@/shared/api/db';
import { parsePlayerRole, type PlayerRole } from '../model/roles';
import type { CampaignDetail, CampaignSummary } from '../model/types';

export async function listCampaigns(userId: string): Promise<CampaignSummary[]> {
  return prisma.campaign.findMany({
    where: { players: { some: { userId } } },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getCampaign(id: string, userId: string): Promise<CampaignDetail | null> {
  const campaign = await prisma.campaign.findFirst({
    where: { id, players: { some: { userId } } },
    select: {
      id: true,
      name: true,
      size: true,
      players: {
        select: { id: true, role: true, name: true, factionId: true, userId: true },
        orderBy: { role: 'asc' },
      },
      hexes: {
        select: { id: true, q: true, r: true, ownerId: true },
        orderBy: [{ r: 'asc' }, { q: 'asc' }],
      },
    },
  });
  if (!campaign) return null;

  return {
    ...campaign,
    players: campaign.players.map(({ userId: playerUserId, role, ...player }) => ({
      ...player,
      role: toPlayerRole(role),
      joined: playerUserId !== null,
    })),
  };
}

function toPlayerRole(value: string): PlayerRole {
  const role = parsePlayerRole(value);
  if (!role) throw new Error(`Unknown player role in the database: ${value}`);
  return role;
}
```

Walking through it:

- **`where: { players: { some: { userId } } }`:** "campaigns that have at least one player whose user is me". Because the creator is always a player (U5), this also covers the creator.
- **`findFirst`, not `findUnique`:** `findUnique` only accepts unique fields, and `{ id, players: ... }` is not one. `findFirst` takes any filter and returns the first match, which is at most one here.
- **`toPlayerRole`:** the database stores `role` as text. This is the one boundary where we convert it. If the database ever holds something else, we fail loudly instead of passing a bad value around.
- **Destructuring `userId: playerUserId`:** it strips the raw user id off the player and replaces it with the `joined` boolean. The new name avoids clashing with the `userId` parameter.

### `src/entities/campaign/api/campaign-queries.test.ts`

Replace the whole file:

```ts
import { prisma } from '@/shared/api/db';
import { getCampaign, listCampaigns } from './campaign-queries';

jest.mock('server-only', () => ({}));

jest.mock('@/shared/api/db', () => ({
  prisma: { campaign: { findMany: jest.fn(), findFirst: jest.fn() } },
}));

const mockedFindMany = jest.mocked(prisma.campaign.findMany);
const mockedFindFirst = jest.mocked(prisma.campaign.findFirst);

beforeEach(() => {
  jest.clearAllMocks();
});

describe('listCampaigns', () => {
  it('returns the campaigns found by Prisma', async () => {
    const rows = [
      { id: 'c1', name: 'Ork Incursion' },
      { id: 'c2', name: 'Siege of Vraks' },
    ];
    mockedFindMany.mockResolvedValue(rows as never);

    await expect(listCampaigns('user-1')).resolves.toEqual(rows);
  });

  it('only asks for campaigns the user plays in, oldest first', async () => {
    mockedFindMany.mockResolvedValue([] as never);

    await listCampaigns('user-1');

    expect(mockedFindMany).toHaveBeenCalledWith({
      where: { players: { some: { userId: 'user-1' } } },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('returns an empty list when the user is in no campaigns', async () => {
    mockedFindMany.mockResolvedValue([] as never);

    await expect(listCampaigns('user-1')).resolves.toEqual([]);
  });
});

describe('getCampaign', () => {
  const row = {
    id: 'c1',
    name: 'Ork Incursion',
    size: 'large',
    players: [
      { id: 'p1', role: 'attacker', name: 'Alex', factionId: 'orks', userId: 'user-1' },
      { id: 'p2', role: 'defender', name: 'Sam', factionId: 'space-marines', userId: null },
    ],
    hexes: [{ id: 'h1', q: 0, r: 0, ownerId: 'p1' }],
  };

  it('returns the campaign with typed roles and a joined flag instead of user ids', async () => {
    mockedFindFirst.mockResolvedValue(row as never);

    await expect(getCampaign('c1', 'user-1')).resolves.toEqual({
      id: 'c1',
      name: 'Ork Incursion',
      size: 'large',
      players: [
        { id: 'p1', role: 'attacker', name: 'Alex', factionId: 'orks', joined: true },
        { id: 'p2', role: 'defender', name: 'Sam', factionId: 'space-marines', joined: false },
      ],
      hexes: [{ id: 'h1', q: 0, r: 0, ownerId: 'p1' }],
    });
  });

  it('only finds the campaign when the user is one of its players', async () => {
    mockedFindFirst.mockResolvedValue(row as never);

    await getCampaign('c1', 'user-1');

    expect(mockedFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c1', players: { some: { userId: 'user-1' } } },
      })
    );
  });

  it('returns null when the campaign is missing or the user is not in it', async () => {
    mockedFindFirst.mockResolvedValue(null);

    await expect(getCampaign('c1', 'stranger')).resolves.toBeNull();
  });

  it('throws if the database holds a role we do not know', async () => {
    mockedFindFirst.mockResolvedValue({
      ...row,
      players: [{ ...row.players[0], role: 'referee' }],
    } as never);

    await expect(getCampaign('c1', 'user-1')).rejects.toThrow('Unknown player role');
  });
});
```

### Fix one fixture: `src/features/assign-hex-owner/ui/assign-owner-drawer.test.tsx`

`PlayerRecord` has a new required field. Update the fixture at the top of the file:

```tsx
const players: PlayerRecord[] = [
  { id: 'player-attacker', role: 'attacker', name: 'Alex', factionId: 'orks', joined: true },
  {
    id: 'player-defender',
    role: 'defender',
    name: 'Sam',
    factionId: 'space-marines',
    joined: true,
  },
];
```

### The campaigns list page: `src/app/campaigns/page.tsx`

```tsx
import Link from 'next/link';
import { connection } from 'next/server';
import { listCampaigns } from '@/entities/campaign/server';
import { requireProfile } from '@/entities/user/server';

export default async function CampaignsPage() {
  await connection();
  const user = await requireProfile();
  const campaigns = await listCampaigns(user.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <Link href="/campaigns/new" className="underline">
          New Campaign
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

Only the imports and the first two lines of the function changed.

---

## 8. Phase 8: Creating a campaign as a signed-in player

### What

The form now asks "which side are you?" and for the **opponent's** name, email and faction. Your own name comes from your profile. The server records you as the creator and as one of the two players.

### Why

Decisions U4 and U5. The server does not trust the form for who the creator is. It takes the user from the session.

### 8.1 Validation: `src/features/create-campaign/lib/validate-campaign.ts`

Replace the whole file:

```ts
import {
  CAMPAIGN_SIZES,
  parsePlayerRole,
  type CampaignSize,
  type PlayerRole,
} from '@/entities/campaign';
import { parseFactionId, type FactionId } from '@/entities/factions';
import { normaliseEmail } from '@/entities/user';

type OpponentInput = { name?: unknown; email?: unknown; factionId?: unknown };

export type CampaignFormInput = {
  name?: unknown;
  size?: unknown;
  creatorRole?: unknown;
  creatorFactionId?: unknown;
  opponent?: OpponentInput;
};

export type CampaignDraft = {
  name: string;
  size: CampaignSize;
  creatorRole: PlayerRole;
  creatorFactionId: FactionId;
  opponent: { name: string; email: string; factionId: FactionId };
};

export type ValidationResult = { ok: true; draft: CampaignDraft } | { ok: false; error: string };

export function validateCampaign(input: CampaignFormInput): ValidationResult {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!name) return { ok: false, error: 'Campaign name is required' };

  const size = CAMPAIGN_SIZES.find((size) => size === input.size);
  if (!size) return { ok: false, error: 'size unknown/unset' };

  const creatorRole = parsePlayerRole(input.creatorRole);
  if (!creatorRole) {
    return { ok: false, error: 'Choose whether you are the attacker or the defender' };
  }

  const creatorFactionId = parseFactionId(input.creatorFactionId);
  if (!creatorFactionId) return { ok: false, error: 'Choose your faction' };

  const opponentName = typeof input.opponent?.name === 'string' ? input.opponent.name.trim() : '';
  if (!opponentName) return { ok: false, error: 'Your opponent needs a name' };

  const opponentEmail = normaliseEmail(input.opponent?.email);
  if (!opponentEmail) return { ok: false, error: 'Your opponent needs a valid email address' };

  const opponentFactionId = parseFactionId(input.opponent?.factionId);
  if (!opponentFactionId) return { ok: false, error: "Choose your opponent's faction" };

  return {
    ok: true,
    draft: {
      name,
      size,
      creatorRole,
      creatorFactionId,
      opponent: { name: opponentName, email: opponentEmail, factionId: opponentFactionId },
    },
  };
}
```

**Why the shape changed:** there is no "attacker player" and "defender player" in the form any more. There is **you** (a side and a faction) and **your opponent**. The server decides which seat is which with `opposingRole`.

**Why the validator does not check "not yourself":** it only sees the form. It does not know who you are. That check is in the action, which has the session.

### `src/features/create-campaign/lib/validate-campaign.test.ts`

Replace the whole file:

```ts
import { validateCampaign, type CampaignFormInput } from './validate-campaign';

const valid: CampaignFormInput = {
  name: 'Waaagh BOA-field',
  size: 'small',
  creatorRole: 'attacker',
  creatorFactionId: 'orks',
  opponent: { name: ' Andy-T ', email: ' Andy@Example.com ', factionId: 'leagues-of-votann' },
};

describe('A campaign is validated at creation', () => {
  it('accepts a complete campaign, trimming names and lower-casing the email', () => {
    expect(validateCampaign({ ...valid, name: '   Waaagh BOA-field   ' })).toEqual({
      ok: true,
      draft: {
        name: 'Waaagh BOA-field',
        size: 'small',
        creatorRole: 'attacker',
        creatorFactionId: 'orks',
        opponent: { name: 'Andy-T', email: 'andy@example.com', factionId: 'leagues-of-votann' },
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
      error: 'size unknown/unset',
    });
  });

  it('rejects a side that is neither attacker nor defender', () => {
    expect(validateCampaign({ ...valid, creatorRole: 'referee' })).toEqual({
      ok: false,
      error: 'Choose whether you are the attacker or the defender',
    });
  });

  it('rejects a creator faction that is not in the list', () => {
    expect(validateCampaign({ ...valid, creatorFactionId: 'not-a-faction' })).toEqual({
      ok: false,
      error: 'Choose your faction',
    });
  });

  it('rejects an opponent without a name', () => {
    expect(validateCampaign({ ...valid, opponent: { ...valid.opponent, name: '' } })).toEqual({
      ok: false,
      error: 'Your opponent needs a name',
    });
  });

  it('rejects an opponent email that is not an email', () => {
    expect(validateCampaign({ ...valid, opponent: { ...valid.opponent, email: 'andy' } })).toEqual({
      ok: false,
      error: 'Your opponent needs a valid email address',
    });
  });

  it('rejects an opponent faction that is not in the list', () => {
    expect(
      validateCampaign({ ...valid, opponent: { ...valid.opponent, factionId: 'nope' } })
    ).toEqual({ ok: false, error: "Choose your opponent's faction" });
  });
});
```

### 8.2 The action: `src/features/create-campaign/api/create-campaign.ts`

Replace the whole file:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/api/db';
import { hexesInRadius } from '@/shared/lib/hex-grid';
import { opposingRole, radiusFor } from '@/entities/campaign';
import { findUserByEmail, requireProfile } from '@/entities/user/server';
import { validateCampaign, type CampaignFormInput } from '../lib/validate-campaign';

type CreateCampaignResult = { ok: true; campaignId: string } | { ok: false; error: string };

export async function createCampaign(input: CampaignFormInput): Promise<CreateCampaignResult> {
  const user = await requireProfile();

  const result = validateCampaign(input);
  if (!result.ok) return result;

  const { draft } = result;

  if (draft.opponent.email === user.email) {
    return { ok: false, error: 'You cannot invite yourself. Enter your opponent’s email.' };
  }

  const invitee = await findUserByEmail(draft.opponent.email);

  const campaign = await prisma.campaign.create({
    data: {
      name: draft.name,
      size: draft.size,
      creatorId: user.id,
      players: {
        create: [
          {
            role: draft.creatorRole,
            name: user.displayName,
            factionId: draft.creatorFactionId,
            userId: user.id,
          },
          {
            role: opposingRole(draft.creatorRole),
            name: draft.opponent.name,
            factionId: draft.opponent.factionId,
            userId: invitee?.id ?? null,
            inviteEmail: invitee ? null : draft.opponent.email,
          },
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

Walking through it:

1. **`requireProfile()` first,** before reading the input. Who is calling is the first question, always.
2. **`creatorId: user.id`** comes from the session. The form cannot choose who the creator is.
3. **The creator's seat** gets `userId: user.id`, so it is claimed from the start, and `name: user.displayName`, so you do not type your own name.
4. **The opponent's seat has two cases.**
   - If someone with that email already has an account, link the seat to them now (`userId`), with no pending invite.
   - If not, store the email in `inviteEmail`. `findOrCreateUser` (Phase 5) links it when that person first signs in.
   - **Why this keeps the friend list in mind (U11):** a future "pick a friend" feature will skip the lookup and set `userId` directly.
5. **`revalidatePath('/', 'layout')`** refreshes the sidebar, as before.

### `src/features/create-campaign/api/create-campaign.test.ts`

Replace the whole file:

```ts
import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/api/db';
import { findUserByEmail, requireProfile } from '@/entities/user/server';
import { createCampaign } from './create-campaign';

jest.mock('@/shared/api/db', () => ({
  prisma: { campaign: { create: jest.fn() } },
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/entities/user/server', () => ({
  requireProfile: jest.fn(),
  findUserByEmail: jest.fn(),
}));

const mockedCreate = jest.mocked(prisma.campaign.create);
const mockedRequireProfile = jest.mocked(requireProfile);
const mockedFindUserByEmail = jest.mocked(findUserByEmail);

const me = { id: 'user-me', email: 'alex@example.com', displayName: 'Alex' };

const valid = {
  name: 'Ork Incursion',
  size: 'large',
  creatorRole: 'attacker',
  creatorFactionId: 'orks',
  opponent: { name: 'Sam', email: 'sam@example.com', factionId: 'space-marines' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockedCreate.mockResolvedValue({ id: 'campaign-1' } as never);
  mockedRequireProfile.mockResolvedValue(me);
  mockedFindUserByEmail.mockResolvedValue(null);
});

it('records the signed-in user as the creator', async () => {
  await createCampaign(valid);

  const data = mockedCreate.mock.calls[0][0].data;
  expect(data).toEqual(expect.objectContaining({ name: 'Ork Incursion', creatorId: 'user-me' }));
});

it('seats the creator on their chosen side using their display name', async () => {
  await createCampaign(valid);

  const data = mockedCreate.mock.calls[0][0].data;
  expect(data.players?.create).toEqual([
    { role: 'attacker', name: 'Alex', factionId: 'orks', userId: 'user-me' },
    {
      role: 'defender',
      name: 'Sam',
      factionId: 'space-marines',
      userId: null,
      inviteEmail: 'sam@example.com',
    },
  ]);
});

it('gives the opponent the opposite side', async () => {
  await createCampaign({ ...valid, creatorRole: 'defender' });

  const data = mockedCreate.mock.calls[0][0].data;
  expect(data.players?.create).toEqual([
    expect.objectContaining({ role: 'defender', userId: 'user-me' }),
    expect.objectContaining({ role: 'attacker', name: 'Sam' }),
  ]);
});

it('links the opponent straight away when they already have an account', async () => {
  mockedFindUserByEmail.mockResolvedValue({
    id: 'user-sam',
    email: 'sam@example.com',
    displayName: 'Sam',
  });

  await createCampaign(valid);

  const data = mockedCreate.mock.calls[0][0].data;
  expect(data.players?.create).toEqual([
    expect.objectContaining({ userId: 'user-me' }),
    expect.objectContaining({ userId: 'user-sam', inviteEmail: null }),
  ]);
});

it('builds a 37 hex board for a large campaign', async () => {
  await createCampaign(valid);

  const data = mockedCreate.mock.calls[0][0].data;
  expect(data.hexes?.create).toHaveLength(37);
});

it('refuses to invite yourself and does not write to the database', async () => {
  const result = await createCampaign({
    ...valid,
    opponent: { ...valid.opponent, email: 'Alex@Example.com' },
  });

  expect(result).toEqual({
    ok: false,
    error: 'You cannot invite yourself. Enter your opponent’s email.',
  });
  expect(mockedCreate).not.toHaveBeenCalled();
});

it('returns the new campaign id', async () => {
  await expect(createCampaign(valid)).resolves.toEqual({ ok: true, campaignId: 'campaign-1' });
});

it('refreshes the layout so the sidebar shows the new campaign', async () => {
  await createCampaign(valid);

  expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
});

it('does not write to the database when the input is invalid', async () => {
  const result = await createCampaign({ ...valid, name: '' });

  expect(result).toEqual({ ok: false, error: 'Campaign name is required' });
  expect(mockedCreate).not.toHaveBeenCalled();
});

it('does not run at all for a signed-out visitor', async () => {
  mockedRequireProfile.mockRejectedValue(new Error('NEXT_REDIRECT:/sign-in'));

  await expect(createCampaign(valid)).rejects.toThrow('NEXT_REDIRECT:/sign-in');
  expect(mockedCreate).not.toHaveBeenCalled();
});
```

### 8.3 The fields: `src/features/create-campaign/ui/player-fields.tsx`

Replace the whole file. This now uses the roles module (`ROLE_LABELS`, `PlayerRole`) instead of its own copies, which closes the `Notes.md` item.

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
} from '@/shared/ui';
import { ROLE_LABELS, type PlayerRole } from '@/entities/campaign';
import { FACTION_GROUPS } from '@/entities/factions';

export type PlayerState = { name: string; email: string; factionId: string };

export type PlayerFieldsProps = {
  role: PlayerRole;
  value: PlayerState;
  onChange: (field: keyof PlayerState, value: string) => void;
  isYou?: boolean;
};

export function PlayerFields({ role, value, onChange, isYou = false }: PlayerFieldsProps) {
  const title = ROLE_LABELS[role];

  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
      <legend className="px-1 font-medium">{isYou ? `${title} (you)` : title}</legend>
      {!isYou && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${role}-name`}>{title} name</Label>
            <Input
              id={`${role}-name`}
              value={value.name}
              onChange={(event) => onChange('name', event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${role}-email`}>{title} email</Label>
            <Input
              id={`${role}-email`}
              type="email"
              value={value.email}
              onChange={(event) => onChange('email', event.target.value)}
            />
          </div>
        </>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${role}-faction`}>{isYou ? 'Your faction' : `${title} faction`}</Label>
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

**Why `isYou` hides the name and email:** your name comes from your profile and you do not invite yourself. Showing those boxes would be asking for data we already have.

### `src/features/create-campaign/ui/player-fields.test.tsx`

Replace the whole file:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlayerFields, type PlayerFieldsProps } from './player-fields';

const emptyValue: PlayerFieldsProps['value'] = { name: '', email: '', factionId: '' };

function renderFields(overrides: Partial<PlayerFieldsProps> = {}) {
  const onChange = jest.fn();
  render(<PlayerFields role="attacker" value={emptyValue} onChange={onChange} {...overrides} />);
  return { onChange };
}

it('asks for the name, email and faction of an opponent', () => {
  renderFields({ role: 'defender' });

  expect(screen.getByRole('group', { name: 'Defender' })).toBeInTheDocument();
  expect(screen.getByLabelText('Defender name')).toBeInTheDocument();
  expect(screen.getByLabelText('Defender email')).toBeInTheDocument();
  expect(screen.getByLabelText('Defender faction')).toBeInTheDocument();
});

it('only asks for a faction when the fields are for you', () => {
  renderFields({ role: 'attacker', isYou: true });

  expect(screen.getByRole('group', { name: 'Attacker (you)' })).toBeInTheDocument();
  expect(screen.getByLabelText('Your faction')).toBeInTheDocument();
  expect(screen.queryByLabelText('Attacker name')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Attacker email')).not.toBeInTheDocument();
});

it('reports what is typed into the email field', async () => {
  const { onChange } = renderFields({ role: 'defender' });

  await userEvent.type(screen.getByLabelText('Defender email'), 'a');

  expect(onChange).toHaveBeenCalledWith('email', 'a');
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

### 8.4 The form: `src/features/create-campaign/ui/create-campaign-form.tsx`

Replace the whole file:

```tsx
'use client';

import { SyntheticEvent, useState, useTransition } from 'react';
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
} from '@/shared/ui';
import {
  CAMPAIGN_SIZES,
  DEFAULT_CAMPAIGN_SIZE,
  parsePlayerRole,
  PLAYER_ROLES,
  ROLE_LABELS,
  type CampaignSize,
  type PlayerRole,
} from '@/entities/campaign';
import { createCampaign } from '../api/create-campaign';
import { PlayerFields, type PlayerState } from './player-fields';

type FormState = {
  name: string;
  size: CampaignSize;
  creatorRole: PlayerRole;
  creatorFactionId: string;
  opponent: PlayerState;
};

const EMPTY_PLAYER: PlayerState = { name: '', email: '', factionId: '' };

const INITIAL_STATE: FormState = {
  name: '',
  size: DEFAULT_CAMPAIGN_SIZE,
  creatorRole: 'attacker',
  creatorFactionId: '',
  opponent: EMPTY_PLAYER,
};

export function CreateCampaignForm() {
  const router = useRouter();
  const [values, setValues] = useState<FormState>(INITIAL_STATE);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateOpponent(field: keyof PlayerState, value: string) {
    setValues((prev) => ({ ...prev, opponent: { ...prev.opponent, [field]: value } }));
  }

  function handleSubmit(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
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
      <h1 className="text-2xl font-semibold">New Campaign</h1>

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
          <Label htmlFor="campaign-size">Campaign size</Label>
          <Select
            value={values.size}
            onValueChange={(value) => {
              const size = CAMPAIGN_SIZES.find((size) => size === value);
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
        <div className="flex flex-col gap-2">
          <Label htmlFor="creator-role">Your side</Label>
          <Select
            value={values.creatorRole}
            onValueChange={(value) => {
              const creatorRole = parsePlayerRole(value);
              if (creatorRole) setValues((prev) => ({ ...prev, creatorRole }));
            }}
          >
            <SelectTrigger id="creator-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAYER_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {PLAYER_ROLES.map((role) =>
          role === values.creatorRole ? (
            <PlayerFields
              key={role}
              role={role}
              isYou
              value={{ ...EMPTY_PLAYER, factionId: values.creatorFactionId }}
              onChange={(field, value) => {
                if (field === 'factionId') {
                  setValues((prev) => ({ ...prev, creatorFactionId: value }));
                }
              }}
            />
          ) : (
            <PlayerFields
              key={role}
              role={role}
              value={values.opponent}
              onChange={updateOpponent}
            />
          )
        )}

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

**Why state is "you" and "opponent", not "attacker" and "defender":** if the state were keyed by role, switching "Your side" from attacker to defender would leave your faction choice stuck on the wrong seat. With "you" and "opponent", switching sides just changes which heading each block gets.

**Why `PLAYER_ROLES.map`:** attacker is always listed first, whichever one is you. The block that is "you" shows only a faction.

**Why `createCampaign(values)` still works:** `FormState` has exactly the fields `CampaignFormInput` expects.

### Add one test to `src/features/create-campaign/ui/create-campaign-form.test.tsx`

Keep the two existing tests. Add this one at the end:

```tsx
it('sends the creator side and the opponent details to the server', async () => {
  render(<CreateCampaignForm />);

  await userEvent.type(screen.getByLabelText('Campaign name'), 'Ork Incursion');
  await userEvent.type(screen.getByLabelText('Defender name'), 'Sam');
  await userEvent.type(screen.getByLabelText('Defender email'), 'sam@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Create campaign' }));

  expect(mockedCreate).toHaveBeenCalledWith(
    expect.objectContaining({
      name: 'Ork Incursion',
      size: 'large',
      creatorRole: 'attacker',
      opponent: expect.objectContaining({ name: 'Sam', email: 'sam@example.com' }),
    })
  );
});
```

By default you are the attacker, so the opponent block is labelled "Defender".

### Checkpoint

**Now run the whole-repo checks.** Phases 3 to 8 were red on purpose.

```bash
npm run typecheck
npm run test
```

Typecheck should still fail in three places that Phase 9 and Phase 10 fix: `assign-hex-owner.ts` is fine, but `app/layout.tsx` calls `listCampaigns()` with no argument and `app/campaigns/[campaignId]/page.tsx` calls `getCampaign(campaignId)` with one argument. Everything else should be green. If something else fails, fix it before continuing.

---

## 9. Phase 9: Only players can edit hexes, and the campaign page

### 9.1 The action: `src/features/assign-hex-owner/api/assign-hex-owner.ts`

Replace the whole file. The changes are the `requireProfile()` at the top and the membership check.

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/api/db';
import { requireProfile } from '@/entities/user/server';

type AssignInput = { hexId: string; playerId: string | null };
type AssignResult = { ok: true } | { ok: false; error: string };

export async function assignHexOwner(input: AssignInput): Promise<AssignResult> {
  const user = await requireProfile();

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

  const membership = await prisma.player.findFirst({
    where: { campaignId: hex.campaignId, userId: user.id },
    select: { id: true },
  });

  if (!membership) {
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

**Why this check matters:** the page hides campaigns you are not in, but a server action is a public endpoint. Anyone who learns a hex id could post to it. This check is what makes "private" true.

**Why a non-member gets "Hex not found", not "Not allowed":** the same reason as the 404 on the page. We do not confirm that a hex in someone else's campaign exists.

**Why no creator check:** decision U6, either player can edit.

### `src/features/assign-hex-owner/api/assign-hex-owner.test.ts`

Replace the whole file:

```ts
import { revalidatePath } from 'next/cache';
import { prisma } from '@/shared/api/db';
import { requireProfile } from '@/entities/user/server';
import { assignHexOwner } from './assign-hex-owner';

jest.mock('@/shared/api/db', () => ({
  prisma: {
    hex: { findUnique: jest.fn(), update: jest.fn() },
    player: { findUnique: jest.fn(), findFirst: jest.fn() },
  },
}));

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('@/entities/user/server', () => ({
  requireProfile: jest.fn(),
}));

const mockedHexFind = jest.mocked(prisma.hex.findUnique);
const mockedHexUpdate = jest.mocked(prisma.hex.update);
const mockedPlayerFind = jest.mocked(prisma.player.findUnique);
const mockedMembershipFind = jest.mocked(prisma.player.findFirst);
const mockedRequireProfile = jest.mocked(requireProfile);

beforeEach(() => {
  jest.clearAllMocks();
  mockedRequireProfile.mockResolvedValue({
    id: 'user-1',
    email: 'alex@example.com',
    displayName: 'Alex',
  });
  mockedHexFind.mockResolvedValue({ campaignId: 'campaign-1' } as never);
  mockedMembershipFind.mockResolvedValue({ id: 'player-1' } as never);
  mockedPlayerFind.mockResolvedValue({ campaignId: 'campaign-1' } as never);
  mockedHexUpdate.mockResolvedValue({} as never);
});

it('does not run for a signed-out visitor', async () => {
  mockedRequireProfile.mockRejectedValue(new Error('NEXT_REDIRECT:/sign-in'));

  await expect(assignHexOwner({ hexId: 'hex-1', playerId: 'player-1' })).rejects.toThrow(
    'NEXT_REDIRECT:/sign-in'
  );
  expect(mockedHexUpdate).not.toHaveBeenCalled();
});

it('rejects an empty hex id without touching the database', async () => {
  const result = await assignHexOwner({ hexId: '', playerId: 'player-1' });

  expect(result).toEqual({ ok: false, error: 'Missing Hex Id' });
  expect(mockedHexFind).not.toHaveBeenCalled();
  expect(mockedHexUpdate).not.toHaveBeenCalled();
});

it('returns an error when the hex does not exist', async () => {
  mockedHexFind.mockResolvedValue(null);

  const result = await assignHexOwner({ hexId: 'unknown', playerId: 'player-1' });

  expect(result).toEqual({ ok: false, error: 'Hex not found' });
  expect(mockedHexUpdate).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});

it('treats a hex in a campaign the user is not in as not found', async () => {
  mockedMembershipFind.mockResolvedValue(null);

  const result = await assignHexOwner({ hexId: 'hex-1', playerId: 'player-1' });

  expect(result).toEqual({ ok: false, error: 'Hex not found' });
  expect(mockedMembershipFind).toHaveBeenCalledWith({
    where: { campaignId: 'campaign-1', userId: 'user-1' },
    select: { id: true },
  });
  expect(mockedHexUpdate).not.toHaveBeenCalled();
});

it('rejects a player from a different campaign and does not update the hex', async () => {
  mockedPlayerFind.mockResolvedValue({ campaignId: 'campaign-2' } as never);

  const result = await assignHexOwner({ hexId: 'hex-1', playerId: 'player-9' });

  expect(result).toEqual({ ok: false, error: 'Player is not in this campaign' });
  expect(mockedHexUpdate).not.toHaveBeenCalled();
  expect(revalidatePath).not.toHaveBeenCalled();
});

it('rejects an unknown player and does not update the hex', async () => {
  mockedPlayerFind.mockResolvedValue(null);

  const result = await assignHexOwner({ hexId: 'hex-1', playerId: 'ghost' });

  expect(result).toEqual({ ok: false, error: 'Player is not in this campaign' });
  expect(mockedHexUpdate).not.toHaveBeenCalled();
});

it('assigns the owner and refreshes the campaign page when the player is in the same campaign', async () => {
  const result = await assignHexOwner({ hexId: 'hex-1', playerId: 'player-1' });

  expect(result).toEqual({ ok: true });
  expect(mockedPlayerFind).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: 'player-1' } })
  );
  expect(mockedHexUpdate).toHaveBeenCalledWith({
    where: { id: 'hex-1' },
    data: { ownerId: 'player-1' },
  });
  expect(revalidatePath).toHaveBeenCalledWith('/campaigns/campaign-1');
});

it('clears the owner without looking up a player when playerId is null', async () => {
  const result = await assignHexOwner({ hexId: 'hex-1', playerId: null });

  expect(result).toEqual({ ok: true });
  expect(mockedPlayerFind).not.toHaveBeenCalled();
  expect(mockedHexUpdate).toHaveBeenCalledWith({
    where: { id: 'hex-1' },
    data: { ownerId: null },
  });
  expect(revalidatePath).toHaveBeenCalledWith('/campaigns/campaign-1');
});
```

### 9.2 The campaign page: `src/app/campaigns/[campaignId]/page.tsx`

Replace the whole file:

```tsx
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { ROLE_LABELS } from '@/entities/campaign';
import { getCampaign } from '@/entities/campaign/server';
import { getFactionName } from '@/entities/factions';
import { requireProfile } from '@/entities/user/server';
import { HexMap } from '@/widgets/hex-map';

type PageProps = { params: Promise<{ campaignId: string }> };

export default async function CampaignPage({ params }: PageProps) {
  await connection();
  const user = await requireProfile();
  const { campaignId } = await params;
  const campaign = await getCampaign(campaignId, user.id);

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
              {ROLE_LABELS[player.role]}: {player.name} ({getFactionName(player.factionId)})
              {!player.joined && (
                <span className="text-muted-foreground"> — invited, has not signed in yet</span>
              )}
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
```

**What changed:** it asks who you are first, passes your id to `getCampaign`, uses `ROLE_LABELS` instead of printing the raw role, flags invited seats, and drops the old "Anyone with this link can change the board" note, which is no longer true.

**Why `notFound()` for strangers:** `getCampaign` returns `null` both for a missing campaign and for one you are not in. Both show the same 404 page.

---

## 10. Phase 10: The shell shows who you are

### What

The root layout loads the user, lists only their campaigns, and only draws the app shell for a fully signed-in user. The top bar shows your name and a sign-out button.

### Why

- Signed-out visitors (on `/sign-in`) and brand-new users (on `/welcome`) should see a clean page, not a sidebar with nothing in it.
- **The layout is not the security boundary.** Layouts do not re-run on every client navigation, so the pages and actions check the user themselves (Phases 5 to 9). The layout only decides what to **draw**.

### `src/app/layout.tsx`

```tsx
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { connection } from 'next/server';
import { listCampaigns } from '@/entities/campaign/server';
import { getCurrentUser } from '@/entities/user/server';
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
  title: 'Overseer',
  description: 'Overseer web application',
};

export default async function RootLayout({ children }: LayoutProps<'/'>) {
  await connection();
  const user = await getCurrentUser();
  const displayName = user?.displayName;
  const campaigns = user && displayName ? await listCampaigns(user.id) : [];

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        {displayName ? (
          <AppShell displayName={displayName} campaigns={campaigns}>
            {children}
          </AppShell>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
```

### `src/widgets/app-shell/ui/app-shell.tsx`

```tsx
import type { ReactNode } from 'react';
import { SidebarInset, SidebarProvider } from '@/shared/ui';
import type { CampaignSummary } from '@/entities/campaign';
import { AppSidebar } from './app-sidebar';
import { TopBar } from './top-bar';

type AppShellProps = { children: ReactNode; campaigns: CampaignSummary[]; displayName: string };

export function AppShell({ children, campaigns, displayName }: AppShellProps) {
  return (
    <SidebarProvider className="h-svh">
      <AppSidebar campaigns={campaigns} />
      <SidebarInset className="min-h-0">
        <TopBar displayName={displayName} />
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

### `src/widgets/app-shell/ui/top-bar.tsx`

```tsx
import Link from 'next/link';
import { UserCircle } from 'lucide-react';
import { Button, SidebarTrigger } from '@/shared/ui';
import { SignOutButton } from '@/features/auth';

type TopBarProps = { displayName: string };

export function TopBar({ displayName }: TopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger />
        <span className="text-lg font-semibold">Overseer</span>
      </div>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/profile">
            <UserCircle />
            {displayName}
          </Link>
        </Button>
        <SignOutButton />
      </div>
    </header>
  );
}
```

**Why a link and a button, not a dropdown:** the UI package has no dropdown menu yet, and adding one means a new component and probably a new dependency. This does the job. We can swap in a menu later without changing anything else.

**Why a widget may import a feature:** FSD allows higher layers to import lower ones. `widgets` sits above `features`.

`app-sidebar.tsx` does not change. It already takes `campaigns` as a prop, and the layout now passes it only the viewer's campaigns, which completes decision D8 from the campaign guide.

---

## 11. Phase 11: Lock the front door (`proxy.ts`)

### What

A file that runs before every request and sends signed-out visitors to `/sign-in`.

### Why last

Until the sign-in page exists and works, locking the door would trap you outside. It also gives us a clean "before and after" to test.

**Next.js 16 renamed `middleware.ts` to `proxy.ts`.** Auth.js's docs still show the old name in places. The Next.js docs at `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` describe the new convention: a file at `src/proxy.ts` that exports a function named `proxy` or a default function.

### `src/proxy.ts`

```ts
export { auth as default } from '@/shared/api/auth';

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

**How it works:** exporting `auth` as the proxy makes Auth.js run its `authorized` callback (Phase 4) for every matching request. Signed-out means `false`, which redirects to `/sign-in`.

**Why the `matcher` excludes things:**

- `api/auth`: the sign-in flow itself. Locking it would make signing in impossible.
- `_next/static` and `_next/image`: the app's own JavaScript, CSS and images. Without excluding these, the sign-in page would load with no styles.
- `favicon.ico` and image files: same reason.

**Why the proxy is not enough:** it only reads the cookie, with no database check. It is a fast first filter. The real checks are `requireProfile()` in each page and action.

**If the build complains** that the proxy "must export a function named `proxy` or a default function", re-exporting may not be recognised. Use this form instead:

```ts
import { auth } from '@/shared/api/auth';

export default auth;

export const config = {
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

---

## 12. Phase 12: Verify

### 12.1 Automatic checks

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Or all at once: `npm run verify`.

If Jest says `Cannot use import statement outside a module` for a `next-auth` file, a test is loading the real `@/shared/api/auth`. Add a `jest.mock('@/shared/api/auth', ...)` factory to that test, as in Phase 5.

Run Prettier on your changes before committing (see the `prettier-on-commit` skill). Lint-staged also does this on commit.

### 12.2 By hand (you need two Google accounts)

Both must be listed as **test users** in the Google console (Phase 2.2). Call them **A** (creator) and **B** (opponent). Use two different browsers, or one normal window and one private window, so the sessions do not mix.

Start the app with `npm run dev` and work through this:

1. **Locked door.** As a signed-out visitor, open `http://localhost:3000/campaigns`. You should land on `/sign-in`, styled, with no sidebar.
2. **Sign in as A.** Click **Sign in with Google**, choose account A. You should land on `/welcome`.
3. **Choose a name.** Enter "Alex" and continue. You should land on `/campaigns` with the sidebar, and see "Alex" in the top bar.
4. **Create a campaign as A.** Use "New Campaign", keep "Attacker" as your side, choose your faction, and fill in B's name, B's email (exactly the address B signs in with) and B's faction. Create it.
5. **Check the campaign page.** B's line should say "invited, has not signed in yet".
6. **Sign in as B** in the other browser. You should land on `/welcome`, pick a name, then see the campaign in B's sidebar. This is the lazy claim at work.
7. **Reload as A.** The "invited" note should be gone.
8. **Both can edit.** Click a hex as B and assign it. Reload as A and check the colour appears.
9. **Privacy.** Copy the campaign URL. Sign in as a third Google account (or sign A out and use a different account) and open it. You should get a 404 page, and the sidebar should be empty.
10. **Existing-user invite.** As A, create a second campaign inviting B, who now has an account. B should see it immediately without signing in again.
11. **Self-invite.** As A, try inviting A's own email. You should see the "cannot invite yourself" error.
12. **Sign out.** Use the top bar button. You should land on `/sign-in`, and `/campaigns` should redirect there again.
13. **Profile.** At `/profile`, change the display name. The top bar should update.

### Known risks to watch

I wrote this guide against the current docs but did not run the code, so these are the places most likely to need a tweak:

- **`next-auth@beta` types.** If `profile?.email_verified` does not type-check, check the `Profile` type in `@auth/core` for the exact property name.
- **The proxy export.** See the fallback in Phase 11.
- **Jest and `next-auth`.** See the warning in Phase 4. It also applies if a future test imports a file that imports `@/entities/user/server` without mocking it.
- **The first request after sign-in** creates your `User` row during page render. If you see two "Unique constraint" errors in the log at once, that is the race in `findOrCreateUser` doing its job.
- **A stale cookie after a database reset.** If you reset the database again while signed in, your cookie is still valid, so the first page load recreates your user row with no display name and sends you to `/welcome`. That is correct behaviour, not a bug.

---

## 13. What this leaves for the next guide

After this guide, the server knows who the viewer is and which seat they hold. The attacker and defender views build on that:

- **A `viewerRole`.** Add it to `CampaignDetail`, found by matching `Player.userId` to the signed-in user, and typed with `PlayerRole`. The campaign page can then pass it to the map and drawer.
- **One set of components, different props,** rather than separate routes for each side.
- **Mechanics that are role-aware:** who may do what, and what each side can see.

Parked on purpose:

- **Friend list and `@` picker.** Set `Player.userId` directly. No schema change.
- **UI strings in constants** (`Notes.md`). Worth doing before there is a lot more UI.
- **The Gmail dot and alias problem** for invites, see assumption 5.
- **Showing a joined opponent's display name** instead of the name the creator typed.
- **Updating `long-term-plan.md`:** tick off "User profiles and accounts" and the first five "What we want" items, and move "Invites" to a note about the friend list.

---

## Files touched

New:

- `src/entities/campaign/model/roles.ts` and `roles.test.ts`
- `src/shared/api/auth.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/entities/user/` (`model/types.ts`, `model/display-name.ts` and test, `lib/email.ts` and test, `api/user-queries.ts` and test, `api/session.ts` and test, `index.ts`, `server.ts`)
- `src/features/auth/` (`api/auth-actions.ts`, `ui/sign-in-button.tsx`, `ui/sign-out-button.tsx`, `ui/auth-buttons.test.tsx`, `index.ts`)
- `src/features/edit-profile/` (`api/save-display-name.ts`, `ui/display-name-form.tsx` and test, `index.ts`)
- `src/app/sign-in/page.tsx`, `app/welcome/page.tsx`, `app/profile/page.tsx`
- `src/proxy.ts`

Changed:

- `package.json` (the `next-auth` dependency), `.env`, `.env.example`
- `prisma/schema.prisma` and a fresh `prisma/migrations`
- `src/entities/campaign/index.ts`, `model/types.ts`, `api/campaign-queries.ts` and test
- `src/features/create-campaign/` (`lib/validate-campaign.ts` and test, `api/create-campaign.ts` and test, `ui/player-fields.tsx` and test, `ui/create-campaign-form.tsx` and test)
- `src/features/assign-hex-owner/api/assign-hex-owner.ts` and test, `ui/assign-owner-drawer.test.tsx` (fixture only)
- `src/app/layout.tsx`, `app/page.tsx`, `app/campaigns/page.tsx`, `app/campaigns/new/page.tsx`, `app/campaigns/[campaignId]/page.tsx`
- `src/widgets/app-shell/ui/app-shell.tsx`, `ui/top-bar.tsx`
