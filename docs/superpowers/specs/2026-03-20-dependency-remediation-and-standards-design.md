# Design: n8n-nodes-payi Dependency Remediation and Project Standards

**Date:** 2026-03-20
**Status:** Draft
**Repo:** `Pay-i/n8n-nodes-payi`
**Current version:** 0.3.0

---

## Problem

The repo has 14 npm audit vulnerabilities (6 high, 8 moderate) across devDependencies. All stem from two root causes: `eslint@8.57` and `gulp@4.0.2`. The repo also has gaps against the project standards defined in `~/src/CLAUDE.md`.

None of these vulnerabilities ship to users (devDependencies only), but they represent security hygiene debt and will flag on every `npm audit` and Dependabot scan.

## Goals

1. Achieve zero `npm audit` findings
2. Bring the repo up to `~/src/CLAUDE.md` project bootstrapping standards
3. Preserve all existing build, lint, and publish behavior
4. Update documentation to reflect all changes

## Non-Goals

- Changing any node behavior or adding features
- Modifying the CI publish workflow (beyond ensuring it still works)
- Upgrading `typescript`, `prettier`, or `n8n-workflow`

---

## 1. Remove gulp — Replace with Node.js Copy Script

### Current State

`gulpfile.js` does one thing:

```js
const { src, dest } = require('gulp');
function buildIcons() {
    return src('nodes/**/*.{svg,png}').pipe(dest('dist/nodes'));
}
exports['build:icons'] = buildIcons;
```

The `npm run build` script calls `tsc && gulp build:icons`.

### Design

Replace `gulp build:icons` with a standalone Node.js script at `scripts/copy-icons.js` that:

1. Uses `fs.cpSync` (Node 18+ stdlib — no new dependencies) or `fs` + `path` with a recursive glob
2. Finds all `*.svg` and `*.png` files under `nodes/`
3. Copies them to the equivalent path under `dist/nodes/`, preserving directory structure
4. Logs what it copied for build visibility

Update `package.json`:
- Change `"build"` script from `npm run clean && tsc && gulp build:icons` to `npm run clean && tsc && node scripts/copy-icons.js`
- Remove `gulp` from `devDependencies`
- Delete `gulpfile.js`

### Vulnerabilities Resolved

- `braces@2.3.2` (high — uncontrolled resource consumption)
- All transitive deps: `chokidar`, `micromatch`, `anymatch`, `readdirp`, `findup-sync`, `matchdep`, `liftoff`, `glob-watcher`, `gulp-cli`

### Verification

- `npm run build` produces identical `dist/` output (TypeScript + icons)
- `npm pack` produces identical `.tgz` contents
- Icon files are present at expected paths in `dist/nodes/Payi/`

---

## 2. Upgrade eslint 8 to 9 — Flat Config Migration

### Current State

- `eslint@~8.57.0` and `@typescript-eslint/parser@~7.18.0` in devDependencies
- No `.eslintrc` file exists — lint runs with zero custom rules, just the TypeScript parser
- Lint scripts use `--ext .ts` flag (deprecated in eslint 9)

### Design

Install:
- `eslint@^9` (latest 9.x)
- `typescript-eslint@^8` (replaces `@typescript-eslint/parser` — the v8 package is the eslint 9 compatible version)

Remove:
- `eslint@~8.57.0`
- `@typescript-eslint/parser@~7.18.0`

Create `eslint.config.mjs`:

```js
import tseslint from 'typescript-eslint';

export default tseslint.config(
    {
        files: ['nodes/**/*.ts', 'credentials/**/*.ts'],
        extends: [tseslint.configs.recommended],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: './tsconfig.json',
            },
        },
    },
    {
        ignores: ['dist/', 'node_modules/', 'scripts/'],
    },
);
```

Update `package.json` lint scripts:
- `"lint"`: `eslint nodes credentials` (drop `--ext .ts` — flat config handles file targeting)
- `"lint:fix"`: `eslint nodes credentials --fix`

### Vulnerabilities Resolved

- `minimatch@3.1.2` (high — ReDoS via eslint and `@eslint/eslintrc`)
- `flatted@<=3.4.1` (high — unbounded recursion DoS)
- `ajv@<6.14.0` (moderate — ReDoS)

### Verification

- `npm run lint` runs without errors (or shows only pre-existing code issues)
- `npm run lint:fix` applies fixes correctly
- No new lint rules break the build unexpectedly

---

## 3. Clean Up Remaining Audit Findings

After steps 1 and 2, run `npm audit` to verify zero findings. If any transitive vulnerabilities remain from other paths, resolve with:

- `npm audit fix` for non-breaking fixes
- Targeted `overrides` in `package.json` if needed (document why)

### Verification

- `npm audit` returns 0 vulnerabilities

---

## 4. Project Standards Compliance

### 4a. CLAUDE.md

Create `CLAUDE.md` at project root with:
- Stack description (TypeScript, n8n community node)
- Build/lint/test/pack commands
- Architecture overview (node types, credential files, description files)
- Publishing workflow (tag-triggered via GitHub Actions)
- Confidentiality notice (Pay-i project)

### 4b. SBOM.md

Create `SBOM.md` with:
- Direct devDependencies table (eslint, typescript-eslint, prettier, typescript, n8n-workflow)
- Peer dependencies (n8n-workflow)
- Runtime services (Pay-i API, LLM provider APIs)
- Companion toolkit reference (payi-utilities/n8n-toolkit)

### 4c. CHANGELOG.md Update

The current CHANGELOG stops at v0.2.0. Backfill entries for v0.2.1 through v0.3.0 using git log history, then add an `[Unreleased]` section for this work. Follow Keep a Changelog format.

### 4d. .gitignore Expansion

Add standard entries for:
- OS/IDE artifacts (`.DS_Store`, `.vscode/`, `.idea/`, `*.swp`)
- Environment files (`.env`, `.env.local`, `!.env.example`, `!.env.op`)
- Coverage artifacts (`.coverage`, `htmlcov/`)
- `todos/` directory
- Build artifacts already covered (`dist/`, `node_modules/`, `*.tgz`)

### 4e. todos/ Directory

Create `todos/` with `.gitkeep`. Already gitignored by 4d.

### 4f. Documentation Updates

- Update `README.md` development section to reflect new build tooling (no gulp)
- Ensure all docs reference current commands

### Verification

- All files exist and follow `~/src/CLAUDE.md` format requirements
- `git status` shows clean state after commit
- CHANGELOG covers full version history

---

## 5. Final Verification Sequence

Run in order — all must pass before the work is considered complete:

1. `npm run build` — TypeScript compiles, icons copied to `dist/`
2. `npm run lint` — eslint 9 flat config runs cleanly
3. `npm run lint:fix` — auto-fix works
4. `npm pack` — package contents correct (only `dist/` shipped)
5. `npm audit` — zero vulnerabilities
6. Verify `dist/nodes/Payi/payi_logo.png` exists in packed output

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| eslint 9 flat config breaks lint | No custom rules exist — minimal surface area for breakage |
| Icon copy script misses files | Compare `dist/` output before/after with `find dist -name '*.png' -o -name '*.svg'` |
| `npm publish` breaks | CI workflow unchanged; `prepublishOnly` still calls `npm run build` |
| New eslint rules flag existing code | Start with `tseslint.configs.recommended` which is conservative; suppress specific rules if needed |

---

## Out of Scope

- Node behavior changes
- New provider support
- CI workflow modifications (publish.yml)
- TypeScript or prettier version upgrades
- Test infrastructure (no test suite exists beyond the toolkit repo)
