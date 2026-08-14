---
name: prettier-on-commit
description: Ensure staged frontend files are formatted with the repository's Prettier configuration before every Git commit.
---

# Prettier Before Commit

## Purpose

Ensure code is formatted with the repository's local Prettier configuration before a commit is created.

This skill complements IDE formatting. The IDE provides immediate feedback while editing; this workflow is the final repository-level check before changes enter Git history.

The required behavior is:

```text
git commit
  ↓
pre-commit hook
  ↓
lint-staged
  ↓
Prettier formats staged supported files
  ↓
lint-staged re-stages formatted files
  ↓
commit is created
```

## Scope

Format only staged files.

Do not format the entire repository during a commit unless a human explicitly requests it.

Supported project files include:

- JavaScript: `.js`, `.jsx`
- TypeScript: `.ts`, `.tsx`
- JSON: `.json`
- Styles: `.css`, `.scss`
- Markdown: `.md`
- YAML: `.yml`, `.yaml`
- Other formats supported by the repository's Prettier configuration

Respect:

- `.prettierrc`
- `.prettierrc.json`
- `.prettierrc.js`
- `.prettierignore`
- `prettier.config.js`
- Any Prettier configuration in `package.json`

Do not create or replace Prettier configuration without permission.

## Required Checks

Before considering the commit workflow complete, verify:

1. Prettier is installed locally.
2. `lint-staged` is installed locally.
3. A Git pre-commit hook exists.
4. The hook invokes `lint-staged`.
5. `lint-staged` invokes `prettier --write`.
6. Formatted files are re-staged automatically.
7. Files ignored by `.prettierignore` are not formatted.
8. The commit is blocked if Prettier fails.

## Recommended Configuration

Use this `lint-staged` configuration:

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx,json,css,scss,md,yml,yaml}": ["prettier --write"]
  }
}
```

Use `--ignore-unknown` if the repository contains unusual file types:

```json
{
  "lint-staged": {
    "*": ["prettier --write --ignore-unknown"]
  }
}
```

Prefer explicit extensions when possible because they make the formatting scope clear.

## Recommended Git Hook

The pre-commit hook should run:

```sh
npx lint-staged
```

The hook must execute before the commit is created.

The formatting command must not use a globally installed Prettier. It must use the project's local dependency through `npx`, npm scripts, or the package manager configured by the repository.

## Behavior

When a commit is attempted:

1. Detect staged files.
2. Pass matching staged files to `lint-staged`.
3. Run the local Prettier version on those files.
4. Re-stage any files modified by Prettier.
5. Allow the commit to continue if formatting succeeds.
6. Abort the commit if formatting fails.
7. Report the failure clearly to the developer.

Do not:

- Format unstaged files.
- Reset or discard developer changes.
- Run `git add -A`.
- Amend commits automatically.
- Create commits automatically.
- Modify Git history.
- Bypass the hook with `--no-verify`.
- Disable Prettier rules to make a commit pass.
- Add formatting changes unrelated to the staged files.

## Monorepo Rules

Warmaster is a monorepo.

The hook should be installed at the repository root unless the repository has a documented package-specific Git workflow.

Run Prettier using the root configuration unless a package has a documented local configuration.

If multiple packages have conflicting Prettier configurations:

1. Report the conflict.
2. Determine which configuration applies to the file.
3. Do not silently rewrite package-level formatting rules.
4. Ask for permission before consolidating configurations.

## Agent Permission Rules

The agent may inspect:

- `package.json`
- Prettier configuration files
- `.prettierignore`
- `.gitignore`
- `.husky/`
- `lint-staged` configuration
- Staged file names

The agent must ask permission before:

- Installing `prettier`.
- Installing `husky`.
- Installing `lint-staged`.
- Modifying `package.json`.
- Creating or modifying `.husky/pre-commit`.
- Changing Prettier configuration.
- Changing `.prettierignore`.
- Changing Git hooks.
- Changing package-manager configuration.
- Running a full-repository formatting operation.
- Creating a commit.
- Using `git commit --no-verify`.

Use this prompt:

> Prettier-on-commit is not fully configured. Enabling it requires changing [files] and/or adding [dependencies]. May I make those changes?

## Verification

Use the following checks where available:

```bash
npx prettier . --check
npx lint-staged
```

Do not use `prettier . --write` as part of the normal commit hook because it formats the entire repository.

For a manual full-repository format, ask for permission first and then use:

```bash
npx prettier . --write
```

Prettier documents `--check` for verifying formatting and `--write` for formatting files in place. [11]

## Review Output

When this skill is run manually, report:

```md
# Prettier Commit Review

## Status

`PASS`, `PASS WITH WARNINGS`, or `FAIL`

## Configuration

- Prettier installed locally: Yes/No
- lint-staged installed locally: Yes/No
- Pre-commit hook found: Yes/No
- Staged-file formatting configured: Yes/No

## Files

- Staged files checked: `<number>`
- Files formatted: `<number>`
- Files skipped: `<number>`

## Validation

- `npx prettier . --check`: Pass / Fail / Not run
- `npx lint-staged`: Pass / Fail / Not run

## Notes

- `<relevant result>`

## Decision

`Prettier will run automatically before commits.`
```

## Completion Rule

The task is complete only when:

- The pre-commit hook invokes `lint-staged`.
- `lint-staged` runs local Prettier with `--write`.
- Formatted files are automatically re-staged.
- The configuration respects the repository's existing Prettier setup.
- No commit is created by the agent without explicit permission.
