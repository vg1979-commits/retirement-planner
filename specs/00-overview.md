# Retirement Planning Application — Project Overview

## Purpose

A web-based retirement planning tool for a dual-income family with a net worth in the $3–5M range. The application models the household's path from today through retirement and beyond, helping them answer questions like:

- Can we retire at 55? 58? 60?
- What spending level is sustainable?
- How should we manage taxes between now and retirement?
- What's our probability of not running out of money?

---

## Family Profile

| Field | Details |
|---|---|
| Household | Married couple, 2 children |
| Net worth | ~$3–5M |
| Income | Both spouses in high-income W2 jobs |
| Child 1 | Age 15 (rising 10th grader) |
| Child 2 | Age 9 (rising 4th grader) |
| Social Security | Not modeled in v1 |

---

## Design Philosophy

1. **Accuracy over simplicity** — The model uses account-by-account granularity, realistic tax treatment, and Monte Carlo simulation rather than rule-of-thumb approximations.
2. **Transparency** — Every projection is explainable. Users can drill into any year and see exactly what drove the numbers.
3. **Scenario-first** — The primary output is a comparison of scenarios (retire early vs. later, spend more vs. less, aggressive vs. conservative allocation) rather than a single "correct" answer.
4. **Spec-driven development** — All features are specified before implementation. Specs live in `/specs/` and are the source of truth.

---

## Spec Index

| File | Contents |
|---|---|
| `00-overview.md` | This file — purpose, family profile, philosophy |
| `01-data-model.md` | TypeScript types for all financial inputs |
| `02-financial-engine.md` | Monte Carlo engine, projection logic, withdrawal sequencing |
| `03-tax-module.md` | Tax calculation, Roth conversion optimizer, bracket management |
| `04-ui-ux.md` | Screen layouts, component hierarchy, interaction flows |
| `05-scenario-engine.md` | How scenarios are defined, stored, and compared |

---

## v1 Scope (In)

- Account-by-account input: 401k, Roth IRA, brokerage, HSA, cash
- Income modeling: W2 salaries, RSU/bonus estimates, investment income
- Expense modeling: current spending baseline + retirement spending target
- Monte Carlo simulation (1,000+ runs, configurable return/volatility assumptions)
- Tax modeling: federal income tax, LTCG, Roth conversion optimizer
- Output: portfolio balance chart, annual cash flow view, probability of success, scenario comparison
- Responsive web UI built in React + TypeScript

## v1 Scope (Out)

- Social Security optimization (v2)
- College funding / 529 modeling (v2)
- Real estate / rental income (v2)
- State tax modeling (v2, placeholder field only)
- Account aggregation / data import (v2)
- Multi-user / sharing (v2)
