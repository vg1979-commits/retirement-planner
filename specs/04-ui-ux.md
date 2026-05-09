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
- Inflation rate (default 2.5%, editable) — shown at the top

**Current Annual Spending**
- Category breakdown table with columns: Category | Current Annual Amount
- Default categories (all start at $0, user fills in): Housing, Food & Groceries, Transportation, Healthcare, Childcare & Education, Travel & Vacation, Dining & Entertainment, Personal & Shopping, Utilities & Subscriptions, Other
- "+ Add Category" button allows adding custom rows; each row has a remove (×) button
- **Current Annual Spending Total** — read-only, auto-calculated as sum of all Current Annual Amount values; displayed prominently below the table

**Retirement Annual Spending**
- Same category list as above, with columns: Category | Retirement Annual Amount
- Retirement amounts are independent of current amounts — user fills each in separately
- Categories added in the Current section also appear here automatically
- **Retirement Annual Spending Total** — read-only, auto-calculated as sum of all Retirement Annual Amount values; displayed prominently below the table

**Tab 5: Assumptions**
- Pre-retirement allocation: equity/bond/cash sliders (must sum to 100%)
- Post-retirement allocation: same
- Return assumptions: equity mean return, equity volatility, bond mean return, bond volatility
- "Reset to defaults" button
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
- Table showing year-by-year conversion opportunities
- Columns: Year | Traditional Balance | Conversion Amount | Tax Cost | Projected Roth Balance at 90
- Toggle: enable/disable Roth conversion optimization
- Target bracket selector: 12% / 22% / 24%
- IRMAA warning flags shown inline

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
- Serializes the full `AppState` (household profile, accounts, income streams, expenses, assumptions, scenarios) to JSON
- Downloads the file to the user's computer as `retirement-plan-YYYY-MM-DD.json` (date auto-appended)
- Simulation results (`results`) are excluded from the saved file — they are always re-computed on load
- A success toast confirms: "Plan saved — retirement-plan-2026-05-09.json"

**Import**
- Triggered by the **"Import"** button in the header
- Opens the browser's native file picker, filtered to `.json` files only
- On file selection:
  1. Parse and validate the JSON against the `AppState` Zod schema
  2. If valid: replace current app state with imported state; show success toast "Plan loaded successfully"
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
- 2026-05-09: Updated Inputs View section
- 2026-05-09: Children section in Tab 1 is now a dynamic add/remove list (name + birth year inputs)
- 2026-05-09: Account Owner dropdown in Tab 2 now dynamically populated from names entered in Tab 1
- 2026-05-09: Income Owner dropdown in Tab 3 now dynamically populated from spouse names in Tab 1; children excluded
- 2026-05-09: Tab 4 Expenses redesigned — category breakdowns drive Current and Retirement totals; both totals are read-only
- 2026-05-09: Added Release Notes view (§3.6) — fetched from GitHub Releases API, shown in sidebar below a divider
- 2026-05-09: GitHub repo configured via VITE_GITHUB_OWNER and VITE_GITHUB_REPO env variables; documented in .env.example
- 2026-05-09: Added §9 Save & Import — manual file save/import via header buttons, auto-save to localStorage, versioned JSON format
