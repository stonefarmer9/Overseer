<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

# AGENTS.md – Warmaster

This file defines how AI coding agents (e.g. GPT-based assistants) should behave when working in the **Warmaster** codebase.

Treat this as a contract: follow these rules unless explicitly overridden by a human.

---

## 1. Project Overview

- **Name:** Warmaster
- **Type:** Monorepo web application
- **Frontend:**
  - Language: TypeScript
  - Framework: Next.js (App Router)
  - UI: React + ShadCN
- **Backend:** TBD (assume Next.js API routes / server actions until specified otherwise)
- **Design Architecture:** Feature-Sliced Design (FSD)
- **Auth:** NextAuth with a free provider (e.g. GitHub, Google, etc.)
- **Primary AI Model:** GPT-based assistant

Agents should assume this is a production-grade app and avoid experimental changes without explicit permission.

---

## 2. Repository Structure (Feature-Sliced Design)

The monorepo should follow Feature-Sliced Design principles. A typical layout:

```text
/
  apps/
    web/                # Next.js app (App Router)
  packages/
    ui/                 # Shared UI components (ShadCN-based)
    config/             # Shared configs (TS, ESLint, Prettier, Tailwind, etc.)
  features/             # Feature slices (e.g. auth, dashboard, game, etc.)
    auth/
    dashboard/
    game/
  entities/             # Domain entities (e.g. user, game, match, etc.)
    user/
    game/
  shared/               # Cross-cutting utilities
    api/
    lib/
    ui/
  AGENTS.md
  package.json
  ...
```

Key FSD rules for agents:

- **Never** import from a “higher” layer into a “lower” layer.
  - Allowed: `features/*` → `entities/*`, `shared/*`
  - Not allowed: `entities/*` → `features/*`, `shared/*` → `features/*`
- Keep slices **feature-driven**, not technical-driven (e.g. `auth`, `game`, `dashboard`, not `components`, `hooks`).
- Shared code goes under `shared/` only if reused across multiple features/entities.
- Each slice should have a clear `index.ts` exporting its public API.

If you’re unsure about FSD, ask before restructuring folders or moving code between layers.

---

## 3. Development Commands

All commands are run from the repo root using `npm`.

```bash
# Install dependencies
npm install

# Run local dev server (Next.js)
npm run dev

# Build the app
npm run build

# Start production server
npm run start

# Run linter
npm run lint

# Run tests (Jest + React Testing Library)
npm run test
```

If new scripts are added (e.g. `test:watch`, `test:e2e`), update this section accordingly.

---

## 4. Code Style & Tooling

- **Language:** TypeScript (strict mode preferred)
- **Formatter:** Prettier (run before committing)
- **Linter:** ESLint (as configured in the repo)
- **Testing:**
  - Framework: Jest
  - React testing: React Testing Library
  - Tests should live alongside code (e.g. `Component.test.tsx`) or in `__tests__` folders per feature.

Agents must:

- Respect existing Prettier/ESLint configs.
- Not disable rules without a clear reason and a comment.
- Write tests for new UI components and non-trivial logic.
- Prefer RTL queries (`getByRole`, `getByLabelText`, `getByText`, etc.) over implementation details.

---

## 5. Frontend Guidelines (Next.js + App Router + ShadCN)

- Use **App Router** conventions:
  - `app/` for routes, layouts, loading, error boundaries.
  - Server Components by default; use `"use client"` only when needed (interactivity, hooks, browser APIs).
- Use **ShadCN** components from `packages/ui` or `shared/ui`. Do not recreate equivalent components unless there’s a strong reason.
- Co-locate feature-specific components inside their feature slice, e.g.:
  - `features/auth/ui/login-form.tsx`
  - `features/game/ui/game-board.tsx`
- Use TypeScript types/interfaces for props and API responses; avoid `any`.

Agents should:

- Reuse existing UI patterns and ShadCN components.
- Follow existing naming conventions (e.g. `kebab-case` for files, `PascalCase` for components).
- Keep components small and focused; extract hooks and utilities when appropriate.

---

## 6. Authentication & Security

- **Auth library:** NextAuth
- **Provider:** Google
- Auth logic should live in a dedicated feature slice, e.g. `features/auth`.
- Sensitive operations (sessions, tokens, server actions) must be implemented on the server side.

Agents must:

- Never hardcode secrets or tokens.
- Use environment variables for all sensitive configuration.
- Not modify auth flows, session handling, or security-related code without explicit permission.
- Ask before adding new auth providers or changing session strategies.

---

## 7. Testing Strategy

- **Unit tests:**
  - For utility functions, hooks, and small components.
- **Component tests:**
  - For UI components using React Testing Library.
- **Integration tests:**
  - For feature slices where multiple components interact.

Agents should:

- Add tests for new components and non-trivial logic.
- Keep tests readable and focused on behavior, not implementation.
- Use descriptive test names: `it("shows error message when login fails")`.
- Not remove or ignore failing tests without fixing or discussing with a human.

---

## 8. Agent Permissions & Boundaries

You are a GPT-based coding assistant for Warmaster.

**You are allowed to:**

- Edit frontend files under:
  - `apps/web`
  - `features/**`
  - `entities/**`
  - `shared/**`
  - `packages/ui`
- Add new components, hooks, utilities, and tests within these areas.
- Refactor code while preserving behavior and FSD layering rules.
- Update documentation (including this `AGENTS.md`) to reflect actual usage.

**You must ask for permission before:**

- Changing anything outside frontend (e.g. backend architecture, DB schema, infra, CI/CD).
- Modifying auth, security, or session-related code.
- Adding new dependencies or changing package manager configs.
- Restructuring the monorepo layout or FSD layers.
- Changing public API contracts or breaking existing interfaces.

If a requested task touches any of the above, explicitly ask:

> “This change affects [auth/backend/infra/etc.]. Do you want me to proceed, and if so, with what constraints?”

---

## 9. Working with GPT-based Agents

When generating code:

- Prefer clear, typed, and idiomatic React/Next.js/TS patterns.
- Avoid over-engineering; keep solutions simple and consistent with existing code.
- When in doubt about architecture or FSD placement, propose 1–2 options and ask which to use.
- Always consider testability when writing new components or hooks.

When explaining changes:

- Be concise but explicit about:
  - What files were changed/added.
  - Why a particular pattern or structure was chosen.
  - Any trade-offs or assumptions made.

---

## 10. Example: Adding a New Feature Slice

If asked to add a new feature (e.g. `leaderboard`):

1. Create a new slice under `features/leaderboard`:
   ```text
   features/
     leaderboard/
       ui/
       lib/
       index.ts
   ```
2. Implement UI components in `features/leaderboard/ui`.
3. Use entities from `entities/*` and shared utilities from `shared/*` as needed.
4. Export public API from `features/leaderboard/index.ts`.
5. Add tests under `features/leaderboard/__tests__` or alongside components.
6. Integrate into the app via `apps/web/app` routes or layouts.

Agents should follow this pattern for all new features unless told otherwise.

---

## 11. Maintenance & Evolution

- Update this `AGENTS.md` when:
  - New major patterns or conventions are adopted.
  - The backend stack is finalized.
  - Testing or deployment strategies change significantly.
- Keep it concise and actionable; avoid duplicating detailed docs that live elsewhere (e.g. `README.md`, `CONTRIBUTING.md`).

---

**Default rule:**  
If something is unclear or could impact architecture, security, or stability, **ask before changing**.

<!-- END:nextjs-agent-rules -->
