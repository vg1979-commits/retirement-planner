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
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

- Sidebar is collapsible on smaller screens
- Header has a prominent **"Run Simulation"** button with spinner during calculation
- Header shows time since last simulation run

---

## 3. Views

### 3.1 Inputs View

Organized as a tabbed form with five sections:

**Tab 1: People & Timeline**
- Spouse 1 name, birth year, current salary, target retirement age
- Spouse 2 name, birth year, current salary, target retirement age
- Child 1  name, birth year, age auto-calculated
- Child 2  name, birth year, age auto-calculated
- Planning end age (default: 95)

**Tab 2: Accounts**
- Table of accounts with columns: Label | Owner | Type | Balance | Annual Contribution | Employer Match
- "+ Add Account" button opens a slide-over form
- Delete and edit buttons per row
- Running total shown at bottom: "Total investable assets: $X"

**Tab 3: Income**
- Table of income streams with columns: Label | Owner | Type | Annual Amount | Start Year | End Year | Growth Rate
- W2 salaries auto-populated from People tab (editable)
- "+ Add Income Stream" for RSUs, bonuses, rental income

**Tab 4: Expenses**
- Current annual spending (single input with optional category breakdown)
- Retirement annual spending target (today's dollars)
- Inflation rate (default 2.5%, editable)
- Optional: category breakdown table (Housing, Healthcare, Travel, Food, etc.)

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

## Changelog
- 2026-05-08: Updated Inputs View section
