# Spec 04 — UI / UX

## 1. Tech Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Charts | Recharts |
| State management | Zustand (lightweight, no boilerplate) |
| Forms | React Hook Form + Zod (validation) |
| Icons | Lucide React |
| Number formatting | Intl.NumberFormat |

---

## 2. Application Shell

```
┌─────────────────────────────────────────────────────────┐
│  HEADER: App name | Last run: 2 min ago | Run button     │
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│  SIDEBAR │  MAIN CONTENT AREA                          │
│          │                                              │
│  • Inputs│                                              │
│  • Charts│                                              │
│  • Cash  │                                              │
│    Flow  │                                              │
│  • Taxes │                                              │
│  • Scen- │                                              │
│    arios │                                              │
│  ──────  │                                              │
│  • Relea-│                                              │
│    se    │                                              │
│    Notes │                                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

- Release Notes is visually separated from the main planning views by a divider in the sidebar — it is informational, not part of the planning workflow
- Sidebar is collapsible on smaller screens
- Header has a prominent **"Run Simulation"** button with spinner during calculation
- Header shows time since last simulation run
- Header also contains **"Save"** and **"Import"** buttons (see §9 for full behavior)

---

## 3. Views

### 3.1 Inputs View

Organized as a tabbed form with five sections:

**Tab 1: People & Timeline**
- Spouse 1 name, birth year, current salary, target retirement age
- Spouse 2 name, birth year, current salary, target retirement age
- Children section: dynamic list; each row has name (text input) and birth year (number input); age is auto-calculated and displayed read-only
- "+ Add Child" button appends a new row; each row has a remove (×) button
- Planning end age (default: 95)

**Tab 2: Accounts**
- Table of accounts with columns: Label | Owner | Type | Balance | Annual Contribution | Employer Match
- "+ Add Account" button opens a slide-over form
- Owner dropdown is dynamically populated from names entered in Tab 1: Spouse 1 name, Spouse 2 name, children's names, plus a "Joint" option
- If a name has not been entered yet in Tab 1, the dropdown shows placeholder labels ("Spouse 1", "Spouse 2", "Child 1", etc.)
- Delete and edit buttons per row
- Running total shown at bottom: "Total investable assets: $X"

**Tab 3: Income**
- Table of income streams with columns: Label | Owner | Type | Annual Amount | Start Year | End Year | Growth Rate
- Owner dropdown is dynamically populated from Spouse 1 and Spouse 2 names entered in Tab 1; falls back to "Spouse 1" / "Spouse 2" if names not yet entered
- Children are not valid owners for income streams (income is spouse-only)
- "+ Add Income Stream" for RSUs, bonuses, rental income

**Tab 4: Expenses**

A single unified table combining current and retirement spending side by side.

**Copy toggle** — displayed above the table as a labeled checkbox:
- Label: "Copy Current Spending to Retirement Spending"
- When **checked**: Retirement Annual Spending column becomes read-only; each retirement amount mirrors the corresponding current amount in real time. Unchecking does NOT clear the copied values — they remain as a starting point for editing.
- When **unchecked**: Retirement Annual Spending column is editable independently

**Expense table layout:**

| Category | Current Annual Spending | Retirement Annual Spending |
|---|---|---|
| Housing | $[input] | $[input or mirrored] |
| Food & Groceries | $[input] | $[input or mirrored] |
| Transportation | $[input] | $[input or mirrored] |
| Healthcare | $[input] | $[input or mirrored] |
| Childcare & Education | $[input] | $[input or mirrored] |
| Travel & Vacation | $[input] | $[input or mirrored] |
| Dining & Entertainment | $[input] | $[input or mirrored] |
| Personal & Shopping | $[input] | $[input or mirrored] |
| Utilities & Subscriptions | $[input] | $[input or mirrored] |
| Other | $[input] | $[input or mirrored] |
| *(custom rows)* | $[input] | $[input or mirrored] |
| **Total** | **$[read-only sum]** | **$[read-only sum]** |

- All category amounts start at $0
- Default categories cannot be removed; custom rows added via "+ Add Category" can be removed with a (×) button
- **Total row** is always read-only for both columns — auto-sum of all rows above
- When the copy toggle is checked, the Retirement column cells are visually dimmed to indicate read-only state

**Tab 5: Assumptions**
- Pre-retirement allocation: equity/bond/cash sliders (must sum to 100%)
- Post-retirement allocation: same
- Return assumptions: equity mean return, equity volatility, bond mean return, bond volatility
- **Inflation rate** (default 2.5%, editable) — moved here from Tab 4
- "Reset to defaults" button resets all assumptions including inflation rate
- Advanced toggle: correlation coefficient

---

### 3.2 Projections View (Primary Output)

This is the main output screen. Split into two panels:

**Top panel: Portfolio Balance Chart**
- X axis: calendar year (or age of older spouse)
- Y axis: portfolio balance ($ nominal, toggle to real $)
- For each active scenario: a colored ribbon showing P25–P75 band, with median line
- Hover tooltip: year, ages, median balance, P10/P90 range
- Toggle: show/hide individual scenarios

**Bottom panel: Probability of Success Cards**
- One card per active scenario
- Large % number (e.g. "89%")
- Color-coded background (red/yellow/green/blue per §6 of Spec 02)
- Subtitle: "Based on 1,000 simulations"
- Retirement age and spending level shown below

---

### 3.3 Cash Flow View

A scrollable year-by-year table. Columns:

| Year | Age (S1/S2) | Income | Federal Tax | Expenses | Net Flow | Portfolio Balance |

- Rows color-coded: green when net flow positive (accumulating), orange when drawing down
- Expandable rows: click to see income breakdown, tax breakdown, withdrawal breakdown
- Export to CSV button

Nominal / Real toggle applies to all dollar values.

---

### 3.4 Tax View

Two sub-tabs:

**Tax Timeline**
- Stacked bar chart: ordinary tax + LTCG tax + NIIT per year
- Overlaid line: effective tax rate (right axis)
- Highlight years with Roth conversions (dots on the line)

**Roth Conversion Planner**

*Controls (above the table)*
- **Enable Optimizer toggle** — on/off switch; when off, no conversions are modeled and the table shows $0 in the Conversion Amount column; when on, the optimizer runs and populates the table
- **Target Bracket selector** — segmented control with three options: "12% (Conservative)" | "22% (Moderate, default)" | "24% (Aggressive)"; sets the maximum bracket the optimizer fills each year

*Summary bar (between controls and table)*
A highlighted summary block showing:
- **Estimated Tax Savings from Conversion Strategy: $XX** — total tax saved vs. a no-conversion baseline, computed as: (total lifetime tax without conversions) − (total lifetime tax with conversions) across the median Monte Carlo run
- **Total Converted: $XX** — cumulative dollars moved to Roth across all conversion years
- **Conversion Window: YYYY–YYYY** — first and last year a conversion is recommended
- **Early window callout** (shown only if pull-forward years exist): *"Includes X high-priority early conversion years (ages 55–59½) where your marginal rate drops below the target bracket."* — highlighted in a distinct color (e.g. amber) to draw attention
- **Plain-language rationale** — 2–3 sentences explaining the recommendation in plain English, generated from the `conversionRationale` fields, e.g.: *"You have a 12-year window between retirement and RMDs where your marginal rate drops from 35% to 22%. Converting $45,000–$60,000 per year during this window is projected to save approximately $180,000 in lifetime taxes. After age 73, RMDs consume most of the bracket headroom, limiting further conversions."*

*Year-by-year table*

| Year | Age | Traditional Balance | RMD | Conversion Amount | Tax Cost | Marginal Rate | Rationale | IRMAA |
|---|---|---|---|---|---|---|---|---|
| 2028 | 55/54 | $2,100,000 | — | $58,000 | $6,960 | 12% | ⭐ Early window: 12% < 22% target | — |
| 2031 | 58/57 | $1,840,000 | — | $52,400 | $11,528 | 22% | Filled 22% bracket | — |
| 2032 | 59/58 | $1,810,000 | — | $54,100 | $11,902 | 22% | Filled 22% bracket | — |
| 2044 | 73/72 | $980,000 | $38,200 | $14,100 | $3,102 | 22% | Partial — RMD used most of bracket | ⚠️ |

Column definitions:
- **Year** — calendar year
- **Age** — age of both spouses (S1/S2)
- **Traditional Balance** — start-of-year balance across all traditional accounts
- **RMD** — required minimum distribution that year (blank/— before age 73)
- **Conversion Amount** — amount the optimizer recommends converting; $0 if optimizer is off or no headroom
- **Tax Cost** — marginal federal tax owed on the conversion amount
- **Marginal Rate** — effective marginal rate at which the conversion is taxed
- **Rationale** — plain-language note from `conversionRationale`; pull-forward years are marked with ⭐ and show current vs. target rate (e.g. "⭐ Early window: 12% < 22% target"); rows in the 55–59½ window are row-highlighted in amber
- **IRMAA** — ⚠️ warning icon if the conversion pushes MAGI above the IRMAA threshold ($212,000 MFJ); blank otherwise

*Inline note for pull-forward years (55–59½)*
Any row where the spouse is under 59½ shows an inline note below the row: *"Pay tax on this conversion from taxable funds — withdrawing from traditional accounts to cover the tax bill before age 59½ triggers a 10% penalty."*

*Footer*
- "Without conversion strategy, estimated traditional balance at age 73: $X" — shows the RMD tax bomb risk if conversions are skipped
- Export to CSV button

---

### 3.5 Scenario Comparison View

**Scenario Manager (left panel)**
- List of defined scenarios with color swatches
- "+ New Scenario" button → opens scenario editor
- Each scenario shows: label, retirement ages, spending level
- Checkbox to include/exclude from chart

**Scenario Editor (slide-over)**
- Base: auto-populated from current inputs
- Override fields: retirement age (each spouse), annual spending, allocation
- One-time expense items (e.g. "Beach house 2030: $800k")
- Save / Duplicate / Delete

**Comparison Chart (main area)**
- Overlay all selected scenarios on the portfolio balance chart
- Each scenario gets its own color
- Probability of success shown as a row at the bottom

---

### 3.6 Release Notes View

Fetched live from the GitHub Releases API at runtime. Shows users what has changed with each published release.

**Layout**
- Full-width single-column list of release entries, newest first
- Each entry is a card containing:
  - Version number (e.g. "v1.2.0") — displayed as a badge
  - Release date (formatted as "May 9, 2026")
  - Release body text rendered as markdown (the GitHub release description)
  - Any images embedded in the release body are displayed inline
- A subtle "Latest" badge on the most recent release

**Data fetching**
- Endpoint: `GET https://api.github.com/repos/{owner}/{repo}/releases`
- `owner` and `repo` are read from Vite environment variables:
  - `VITE_GITHUB_OWNER` — the GitHub username or org (e.g. `"vineetgoyal1979"`)
  - `VITE_GITHUB_REPO` — the repository name (e.g. `"retirement-planner"`)
- Both variables are defined in `.env.local` (gitignored) and documented in `.env.example` (committed)
- Accessed in code as `import.meta.env.VITE_GITHUB_OWNER` and `import.meta.env.VITE_GITHUB_REPO`
- Fetch on page mount; cache result in component state for the session (no re-fetch on re-visit)
- Unauthenticated request (public repo assumed); rate limit: 60 req/hour — sufficient for this use case
- Response fields used: `tag_name` (version), `published_at` (date), `body` (markdown content), any image URLs embedded in `body`
- If either env variable is missing or empty, show the error state with a generic message rather than making a malformed API call

**Loading state**
- Skeleton cards shown while fetching (3 placeholder cards)

**Error state**
- If fetch fails (network error or rate limit): display a friendly message — "Couldn't load release notes. Check back later or view them on GitHub." with a direct link to the GitHub releases page

**Empty state**
- If no releases exist yet: "No releases published yet."

---

## 4. Common Components

```
components/
  layout/
    AppShell.tsx
    Sidebar.tsx
    Header.tsx
  inputs/
    AccountTable.tsx
    AccountForm.tsx       (slide-over)
    IncomeTable.tsx
    AllocationSliders.tsx
  charts/
    PortfolioChart.tsx    (Recharts area chart with percentile bands)
    CashFlowTable.tsx
    TaxBarChart.tsx
  scenarios/
    ScenarioCard.tsx
    ScenarioEditor.tsx
  release-notes/
    ReleaseNotesList.tsx  (fetches from GitHub, renders cards)
    ReleaseNoteCard.tsx   (single release entry)
  shared/
    CurrencyInput.tsx     (formatted number input)
    PercentInput.tsx
    SlideOver.tsx
    SuccessGauge.tsx      (large % with color coding)
    NominalRealToggle.tsx
    ExportButton.tsx
```

---

## 5. Responsive Behavior

- Desktop (≥1280px): sidebar visible, two-panel layouts
- Tablet (768–1279px): sidebar collapsible, single-column charts
- Mobile (< 768px): bottom nav instead of sidebar, charts stack vertically; input forms scroll

---

## 6. Empty States

- No accounts added: illustration + "Add your first account" CTA
- Simulation not yet run: "Set up your inputs and click Run Simulation"
- Zero success rate: "Your plan runs out of money in all scenarios. Try adjusting retirement age or spending."

---

## 7. Loading & Error States

- Simulation running: skeleton loaders on charts, progress bar in header ("Running 1,000 simulations… 43%")
- Input validation errors: inline red text below each field (Zod schema)
- Engine errors: toast notification with "Something went wrong — please try again"

---

## 8. Accessibility

- All form inputs have associated `<label>` elements
- Chart tooltips keyboard-accessible
- Color is never the only conveyor of information (icons + text accompany all color coding)
- WCAG 2.1 AA contrast ratios on all text

---

## 9. Save & Import

Users can persist their entire plan to a local file and reload it later — no account or login required. This is the primary persistence mechanism for v1.

**Save**
- Triggered by the **"Save"** button in the header
- Serializes the full `AppState` inputs to JSON — this includes household profile, accounts, income streams, expenses, investment assumptions, and **all scenarios** (including each scenario's overrides and one-time expenses such as home purchases or large gifts)
- Downloads the file to the user's computer as `retirement-plan-YYYY-MM-DD.json` (date auto-appended)
- Simulation results (`results`) are excluded from the saved file — they are always re-computed on load
- A success toast confirms: "Plan saved — retirement-plan-2026-05-09.json"

**Import**
- Triggered by the **"Import"** button in the header
- Opens the browser's native file picker, filtered to `.json` files only
- On file selection:
  1. Parse and validate the JSON against the `SaveFile` Zod schema
  2. If valid: replace current app state with imported state — restoring all inputs including all scenarios and their one-time expenses; show success toast "Plan loaded successfully"
  3. If invalid or unrecognized format: show error toast "This file doesn't look like a valid retirement plan. Please check the file and try again." — do not modify current state
- If the user has unsaved inputs, show a confirmation dialog before overwriting: "Loading this file will replace your current inputs. Continue?"

**Auto-save to localStorage**
- In addition to manual file save, the app auto-saves to `localStorage` (key: `retirement-planner-state`) on every input change, debounced 500ms
- On app load: if `localStorage` has a saved state, restore it silently (no prompt)
- This covers accidental browser closes between manual saves
- localStorage is a convenience backup only — the `.json` file is the canonical portable format

**File format**
```json
{
  "version": "1",
  "savedAt": "2026-05-09T14:32:00Z",
  "state": { ...AppState minus results }
}
```
- `version` field allows future migrations if the data model changes
- If `version` is missing or unrecognized, show a warning: "This file was saved with an older version of the app. Some fields may not load correctly."

## Changelog
- 2026-05-09T16:19:58Z: Updated Inputs View section
- 2026-05-09T16:19:58Z: Children section in Tab 1 is now a dynamic add/remove list (name + birth year inputs)
- 2026-05-09T16:19:58Z: Account Owner dropdown in Tab 2 now dynamically populated from names entered in Tab 1
- 2026-05-09T16:19:58Z: Income Owner dropdown in Tab 3 now dynamically populated from spouse names in Tab 1; children excluded
- 2026-05-09T16:19:58Z: Tab 4 Expenses redesigned — category breakdowns drive Current and Retirement totals; both totals are read-only
- 2026-05-09T16:19:58Z: Added Release Notes view (§3.6) — fetched from GitHub Releases API, shown in sidebar below a divider
- 2026-05-09T16:19:58Z: GitHub repo configured via VITE_GITHUB_OWNER and VITE_GITHUB_REPO env variables; documented in .env.example
- 2026-05-09T16:19:58Z: Added §9 Save & Import — manual file save/import via header buttons, auto-save to localStorage, versioned JSON format
- 2026-05-09T16:19:58Z: §9 clarified — Save and Import explicitly cover all scenario data including one-time expenses
- 2026-05-09T16:27:57Z: Tab 4 redesigned — unified side-by-side table for current and retirement spending; copy toggle added; inflation rate moved to Tab 5 Assumptions
- 2026-05-09T20:12:00Z: §3.4 Roth Conversion Planner fully specified — optimizer toggle, target bracket selector, summary bar with estimated tax savings and plain-language rationale, detailed year-by-year table with RMD, rationale, and IRMAA columns, footer with RMD tax bomb indicator
- 2026-05-09T20:56:02Z: §3.4 updated — pull-forward years (55–59½) highlighted in amber with ⭐ rationale; early window callout added to summary bar; inline penalty warning added for pre-59½ rows
