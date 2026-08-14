---
name: fsd-architecture-review
description: Review completed frontend changes for Feature-Sliced Design compliance. Use after coding tasks that add, modify, move, or delete frontend files.
---

# Feature-Sliced Design Architecture Review

## Purpose

Run this skill after completing frontend coding work in the Warmaster repository.

The goal is to verify that the completed changes follow the project's Feature-Sliced Design architecture, including:

- Correct layer placement.
- Downward-only dependencies.
- Slice isolation.
- Public API usage.
- Feature and entity cohesion.
- Appropriate separation of UI, model, API, and shared code.
- No accidental architectural coupling.

This skill is a review step. It must not silently restructure files or change architecture.

---

## Project Context

Warmaster is a TypeScript, React, and Next.js application using:

- Next.js App Router.
- TypeScript.
- React.
- ShadCN UI.
- Prettier.
- ESLint.
- Jest.
- React Testing Library.
- A monorepo structure.
- Feature-Sliced Design.

The backend architecture is not finalized. Treat backend, infrastructure, database, CI/CD, and deployment changes as restricted.

The agent must ask for permission before making changes outside frontend files.

---

## When to Run

Run this skill after any coding task that:

- Adds or modifies frontend files.
- Creates a new feature, entity, widget, page, or shared module.
- Moves or renames files.
- Changes imports.
- Adds UI, hooks, state, API clients, or frontend business logic.
- Changes route composition or providers.
- Refactors a feature or entity slice.

Do not run this as a replacement for tests or linting. It is an architecture review.

---

## FSD Architecture

The project uses the following layer hierarchy:

```text
app
  ↓
processes
  ↓
pages
  ↓
widgets
  ↓
features
  ↓
entities
  ↓
shared
```

`processes` is optional and should only be used for long-running business processes spanning multiple pages.

Dependencies may only flow downward.

### Allowed dependencies

| Layer       | May import from                                                   |
| ----------- | ----------------------------------------------------------------- |
| `app`       | `processes`, `pages`, `widgets`, `features`, `entities`, `shared` |
| `processes` | `pages`, `widgets`, `features`, `entities`, `shared`              |
| `pages`     | `widgets`, `features`, `entities`, `shared`                       |
| `widgets`   | `features`, `entities`, `shared`                                  |
| `features`  | `entities`, `shared`                                              |
| `entities`  | `shared`                                                          |
| `shared`    | Business-agnostic shared code only                                |

### Forbidden dependencies

Flag all of the following:

- A lower layer importing from a higher layer.
- A feature importing from a page or widget.
- An entity importing from a feature, widget, page, or app.
- Shared code importing from business-specific layers.
- A slice importing another slice on the same layer.
- A page importing another page.
- A feature importing another feature directly.
- An entity importing another entity directly unless an explicitly approved FSD cross-import mechanism exists.
- Any dependency cycle between layers or slices.

The default rule is:

> A module may import only from slices on lower layers, plus modules inside its own slice.

---

## Slices

A slice represents a business capability or business entity, not a technical category.

Good slice names:

```text
features/update-profile
features/add-to-cart
features/auth-by-credentials
entities/user
entities/product
widgets/profile-header
pages/profile
```

Poor slice names:

```text
features/forms
features/hooks
entities/components
entities/services
shared/user
shared/profile
```

When reviewing a new slice, check that:

- It represents a coherent business concern.
- Its UI, state, API, and logic are colocated.
- It has a clear responsibility.
- It does not combine unrelated business capabilities.
- It is not merely a container for a technical type.
- Its name describes what the slice does or represents.

---

## Segments

Segments organize code inside a slice by technical purpose.

Common segments include:

```text
ui/
model/
lib/
api/
config/
routes/
```

Example:

```text
features/update-profile/
  ui/
  model/
  api/
  lib/
  index.ts
```

Segments must not be used to bypass layer or slice rules.

A segment may contain implementation details, but external consumers should not import those details directly.

---

## Public APIs

Every slice must expose a public API, normally through:

```text
index.ts
```

Examples:

```ts
// features/update-profile/index.ts
export { UpdateProfileForm } from './ui/UpdateProfileForm';
export { useUpdateProfile } from './model/useUpdateProfile';
```

```ts
// entities/user/index.ts
export { UserAvatar } from './ui/UserAvatar';
export { useCurrentUser } from './model/useCurrentUser';
```

External consumers must import from the slice root:

```ts
import { UpdateProfileForm } from '@/features/update-profile';
import { UserAvatar } from '@/entities/user';
```

External consumers must not import slice internals:

```ts
// Forbidden
import { UpdateProfileForm } from '@/features/update-profile/ui/UpdateProfileForm';
import { useUpdateProfile } from '@/features/update-profile/model/useUpdateProfile';
import { UserAvatar } from '@/entities/user/ui/UserAvatar';
```

During review:

1. Find imports containing a layer, slice, and internal segment.
2. Determine whether the importing file is outside that slice.
3. Flag direct internal imports.
4. Suggest exporting the required item through the slice's `index.ts`.
5. Suggest importing from the slice root.

Inside the same slice, relative imports are allowed:

```ts
import { validateProfile } from '../lib/validateProfile';
```

Between different slices, use absolute aliases and public APIs:

```ts
import { UserAvatar } from '@/entities/user';
```

---

## Shared Layer Rules

The `shared` layer must remain business-agnostic.

Allowed examples:

```text
shared/ui/button
shared/ui/modal
shared/lib/format-date
shared/lib/validation
shared/api/http-client
shared/config/env
```

Flag shared modules that contain business-specific logic, such as:

```text
shared/user
shared/cart
shared/order
shared/update-profile
```

If logic belongs to a specific business entity or user interaction, recommend moving it to:

- `entities/<entity>`, or
- `features/<feature>`

Shared UI primitives may be based on ShadCN. Do not duplicate existing shared UI components without a clear reason.

---

## Placement Review

For every changed file, determine whether its location matches its responsibility.

Use these guidelines:

### `app`

Use for:

- Routing.
- Layouts.
- Global providers.
- Global styles.
- Application initialization.
- Framework-level configuration.

Do not place reusable business logic in `app`.

### `pages`

Use for:

- Route-level composition.
- Page-specific orchestration.
- Route-level loading and error states.

Pages should compose lower layers rather than become general-purpose component collections.

### `widgets`

Use for:

- Large reusable UI blocks.
- Composition of multiple features and entities.
- Sections such as feeds, profile headers, dashboards, and product grids.

### `features`

Use for:

- User interactions.
- Business scenarios.
- Actions that may be reused or independently tested.

Examples:

```text
features/auth-by-credentials
features/update-profile
features/add-to-cart
features/filter-products
```

### `entities`

Use for:

- Business entities.
- Entity data, state, API access, and reusable entity UI primitives.

Examples:

```text
entities/user
entities/product
entities/order
```

### `shared`

Use for:

- Business-agnostic UI.
- Generic helpers.
- API infrastructure.
- Configuration.
- Generic hooks.
- Design-system primitives.

---

## Next.js App Router Review

Check the following:

- Route files remain in the appropriate `app` area.
- Server Components are used by default.
- `"use client"` is present only where client behavior is required.
- Browser APIs and React hooks are not used in Server Components.
- Route-level composition does not contain reusable feature internals.
- Authentication and server-only code are not exposed to client components.
- Secrets are not placed in client-accessible environment variables.
- API and backend changes are not made without permission.

If a proposed fix requires changing authentication, session handling, backend code, environment configuration, or server security boundaries, stop and ask for permission.

---

## Review Procedure

Follow this sequence.

### 1. Identify changed files

Inspect the final diff and list:

- Added files.
- Modified files.
- Deleted files.
- Renamed or moved files.

If no diff is available, inspect the files changed during the current task.

### 2. Classify each changed file

For each file, record:

- Its FSD layer.
- Its slice.
- Its segment.
- Its responsibility.
- Whether it is inside or outside the slice being reviewed.

### 3. Inspect imports

Check every import in changed files.

Verify:

- The imported layer is lower than the current layer.
- Same-layer slice imports are not present.
- No upward imports exist.
- No direct imports into another slice's internal files exist.
- Cross-slice imports use aliases and public APIs.
- Relative imports are used for modules inside the same slice.

### 4. Inspect public APIs

For every changed slice:

- Check whether `index.ts` exists.
- Check whether externally consumed modules are exported.
- Check whether consumers import from the slice root.
- Check whether unnecessary internals are exposed.
- Check for imports that bypass the public API.

### 5. Inspect cohesion

Check whether:

- UI, model, API, and logic belong to the same business concern.
- Generic code has been incorrectly placed inside a business slice.
- Business logic has been incorrectly placed in `shared`.
- A slice has grown into an unrelated technical toolbox.
- A new slice should instead be part of an existing slice.

### 6. Inspect tests

Check whether new non-trivial behavior has tests.

Prefer:

- Jest.
- React Testing Library.
- Behavior-focused assertions.
- Accessible queries such as `getByRole`, `getByLabelText`, and `getByText`.

Do not remove or weaken tests to make the architecture review pass.

### 7. Run available checks

Run these commands when available:

```bash
npm run lint
npm run test
npm run build
```

If a command does not exist or fails because of an unrelated existing problem, report that clearly.

Do not modify package scripts or add dependencies without permission.

### 8. Produce the review report

Always report:

- Overall status.
- Files reviewed.
- Violations.
- Warnings.
- Passing checks.
- Required fixes.
- Whether the changes are safe to consider architecturally compliant.

---

## Severity Levels

Use these severity levels.

### Error

An architecture violation that must be fixed.

Examples:

- Upward layer import.
- Same-layer slice import.
- Direct import into another slice's internals.
- Missing public API for an externally consumed slice.
- Business-specific code inside `shared`.

### Warning

A questionable pattern that may be valid but requires human review.

Examples:

- A slice may be too broad.
- A widget may only be used once.
- A feature may be route-specific and belong in a page.
- A generic utility may not yet have enough reuse to belong in `shared`.

### Info

A non-blocking observation.

Examples:

- A public API could be reduced.
- A component could be split for readability.
- A test could be added for a low-risk presentation-only change.

---

## Permission Rules

This skill may inspect frontend files and report findings.

It may not silently make architectural changes.

Ask for permission before:

- Moving files between FSD layers.
- Creating or deleting slices.
- Changing the monorepo structure.
- Modifying backend code.
- Modifying database code.
- Modifying authentication or NextAuth configuration.
- Modifying session handling.
- Modifying deployment, CI/CD, or infrastructure.
- Adding dependencies.
- Changing package scripts.
- Changing public API contracts in a way that affects consumers.
- Suppressing, disabling, or weakening lint rules.
- Rewriting unrelated files.

If a violation can be fixed entirely within an already approved frontend task, the agent may propose the fix but must still ask before applying an architectural restructuring.

Use this question:

> I found an FSD architecture issue involving [specific files and rule]. Fixing it requires [specific change]. May I make that change?

---

## Output Format

Use this format:

# FSD Architecture Review

## Status

`PASS`, `PASS WITH WARNINGS`, or `FAIL`

## Scope

- Files reviewed: `<number>`
- Layers involved: `<layers>`
- Slices involved: `<slices>`

## Passing Checks

- `<check that passed>`
- `<check that passed>`

## Errors

- `[ERROR] <file>:<line> — <violation>`
  - Rule: `<FSD rule>`
  - Suggested fix: `<fix>`

If there are no errors, write:

```text
None.
```

## Warnings

- `[WARNING] <file> — <concern>`
  - Reason: `<explanation>`
  - Recommendation: `<recommendation>`

If there are no warnings, write:

```text
None.
```

## Validation Commands

| Command         | Result                      |
| --------------- | --------------------------- |
| `npm run lint`  | Pass / Fail / Not run       |
| `npm run test`  | Pass / Fail / Not available |
| `npm run build` | Pass / Fail / Not run       |

## Decision

State one of:

- `Architecture compliant.`
- `Architecture compliant with warnings.`
- `Not architecture compliant. Permission is required before applying the proposed fixes.`

---

## Final Rules

Never declare the architecture compliant merely because the application builds.

A successful build does not prove:

- Correct layer placement.
- Slice isolation.
- Public API compliance.
- Absence of upward imports.
- Absence of same-layer coupling.
- Business-agnostic shared code.

The final decision must be based on the FSD review and, where available, lint, test, and build results.
