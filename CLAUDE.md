# CLAUDE.md — Retirement Planning Application

This file provides context for Claude Code working in this project. Read it before writing any code.

---

## Project Purpose

A web-based, browser-only retirement planning tool for a high-income dual-W2 family with ~$3–5M net worth. The app models their household's financial trajectory from today through retirement and helps them answer: "Can we retire early? What spending level is sustainable? How do we manage taxes along the way?"

---

## Family Profile (Do Not Hardcode — Use As Defaults for Demo Data)

| Field | Details |
|---|---|
| Household | Married couple (husband + wife), 2 children |
| Net worth | ~$3–5M |
| Income | Both spouses high-income W2 |
| Child 1 | Age 15 (rising 10th grader, born ~2010) |
| Child 2 | Age 9 (rising 4th grader, born ~2016) |
| Planning horizon | Model to age 95 (older spouse) |

---

## Key Decisions Made

These were decided in the product scoping session (May 2026) and should not be changed without updating this file:

| Decision | Choice | Rationale |
|---|---|---|
| App type | Web app (React, browser-only) | Accessible anywhere, no install |
| Tech stack | React 18 + TypeScript + Vite + Tailwind + Zustand + Recharts | Modern, well-supported, good for interactive charts |
| Simulation method | Monte Carlo (1,000 runs) | Captures sequence-of-returns risk; gives probability distributions |
| Input granularity | Account-by-account | Family has multiple account types; precision matters |
| Social Security | Not in v1 | Simplifies v1; both spouses still mid-career |
| College funding | Not in v1 | Separate concern; 529 model planned for v2 |
| State taxes | Placeholder only (flat % input) | State-specific modeling adds complexity; v2 |
| Tax filing status | MFJ throughout | Married couple |
| Roth conversions | Optimizer included | High pre-tax balances expected; significant value |

---

## Spec Files

All features are fully specified before implementation. Read the relevant spec before writing any module.

| Spec | Path | Covers |
|---|---|---|
| 00 — Overview | `specs/00-overview.md` | Purpose, family, philosophy, v1 scope |
| 01 — Data Model | `specs/01-data-model.md` | All TypeScript types: accounts, income, expenses, output |
| 02 — Financial Engine | `specs/02-financial-engine.md` | Monte Carlo engine, projection loop, withdrawal strategy |
| 03 — Tax Module | `specs/03-tax-module.md` | Federal tax, LTCG, NIIT, Roth conversion optimizer |
| 04 — UI / UX | `specs/04-ui-ux.md` | Screen layouts, component hierarchy, interaction flows |
| 05 — Scenario Engine | `specs/05-scenario-engine.md` | Scenario model, merging, comparison, persistence |

---

## Project Structure (Target)

```
retirement-planner/
  src/
    engine/               # Pure TS, no React — all financial math lives here
      index.ts            # Public API: runSimulations()
      monteCarlo.ts       # Random return generator
      projector.ts        # Year-by-year loop
      taxEngine.ts        # Tax calculation & Roth optimizer
      withdrawalStrategy.ts
      constants.ts        # IRS tables, contribution limits
      worker.ts           # Web Worker wrapper
    types/
      index.ts            # All shared TypeScript types (from Spec 01)
    store/
      useAppStore.ts      # Zustand store
    components/
      layout/
      inputs/
      charts/
      scenarios/
      shared/
    views/
      InputsView.tsx
      ProjectionsView.tsx
      CashFlowView.tsx
      TaxView.tsx
      ScenariosView.tsx
    App.tsx
    main.tsx
  specs/                  # ← You are here
  tests/
    engine/               # Unit tests for all engine modules
  package.json
  vite.config.ts
  tailwind.config.ts
  tsconfig.json
```

---

## Implementation Order (Recommended)

Start with the engine (pure logic, easily testable) before touching the UI:

1. `types/index.ts` — define all types from Spec 01
2. `engine/constants.ts` — tax brackets, IRS limits
3. `engine/taxEngine.ts` + tests — verify against known tax tables
4. `engine/monteCarlo.ts` + tests — verify return statistics
5. `engine/withdrawalStrategy.ts` + tests
6. `engine/projector.ts` — ties it all together
7. `engine/worker.ts` — wrap in Web Worker
8. `store/useAppStore.ts` — Zustand store with demo data
9. UI views in order: Inputs → Projections → Cash Flow → Tax → Scenarios

---

## Coding Standards

- **TypeScript strict mode** (`"strict": true` in tsconfig)
- **No `any`** — every value must be typed
- **Pure functions** in `engine/` — no side effects, no React, no DOM
- **Zod schemas** for all user inputs (runtime validation mirrors TypeScript types)
- **Recharts** for all charts — do not introduce a second charting library
- **Tailwind** for all styling — no CSS modules, no styled-components
- **Zustand** for state — no Redux, no Context for global state
- Dollar amounts are always stored as **numbers in whole dollars** (no cents, no strings)
- Percentages stored as **decimals** (0.07 = 7%, not 7)
- All monetary outputs are nominal (future dollars) by default; UI offers a real-$ toggle

---

## Testing

- Engine unit tests: Vitest
- Every engine module must have tests before the UI is built on top of it
- Key validation benchmarks are in Spec 02 §9 and Spec 03 §10

---

## What Is Out of Scope for v1

Do not implement these — stub with placeholder UI if needed:

- Social Security optimization
- 529 / college funding model
- State income tax calculations
- Real estate / rental income modeling
- Account data import (Plaid, CSV)
- Multi-user / sharing features
- Mobile-native app

---

## Notes for Claude Code

- The `engine/` directory is the heart of the app. Get it right and tested before building UI.
- The Monte Carlo engine must run in a Web Worker (`engine/worker.ts`) — never block the main thread.
- Tax brackets must be inflation-adjusted each projection year — hardcoded 2025 values in `constants.ts`, adjusted annually in the projector.
- When in doubt about financial modeling details, refer to the relevant spec file rather than guessing.
- The app starts with a completely empty state. Do not pre-populate any accounts, income streams, balances, or salaries. The family profile above is context for understanding the user, not seed data.
- Environment variables are managed via `.env.local` (gitignored, not committed). A `.env.example` file documents all required variables. Always read `.env.example` before implementing any feature that uses `import.meta.env`. Never hardcode values that belong in env variables.

---

## Changelog
- 2026-05-09: Clarified that app starts with empty state — family profile is context only, not demo data
- 2026-05-09: Added env variable guidance; .env.example created for VITE_GITHUB_OWNER and VITE_GITHUB_REPO
- 2026-05-09: Added Save & Import feature — manual .json file save/import via header buttons plus auto-save to localStorage; versioned SaveFile format defined in Spec 01 §10 and fully specified in Spec 04 §9
