import type { AccountType } from "../types";
import {
  RMD_UNIFORM_LIFETIME_TABLE,
  RMD_START_AGE,
  STANDARD_DEDUCTION_2025_MFJ,
  TAX_BRACKETS_2025_MFJ,
} from "./constants";
import { inflateBrackets, inflateValue } from "./taxEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccountBalance {
  accountId: string;
  type: AccountType;
  balance: number;
}

export interface WithdrawalInput {
  accounts: AccountBalance[];
  amountNeeded: number;          // net cash deficit (expenses − after-tax income)
  olderSpouseAge: number;
  bothRetired: boolean;

  // For tax-bracket-aware traditional draws (Spec 03 §7)
  currentOrdinaryIncome: number; // income already booked this year before withdrawals
  year: number;
  inflationRate: number;

  annualExpenses: number;        // for cash-buffer guardrail
}

export interface WithdrawalLineItem {
  accountId: string;
  amount: number;
}

export interface RmdLineItem {
  accountId: string;
  rmdAmount: number;
}

export interface WithdrawalResult {
  breakdown: WithdrawalLineItem[];
  totalWithdrawn: number;
  shortfall: number;             // > 0 if accounts were exhausted before need was met
  portfolioDepleted: boolean;
  rmds: RmdLineItem[];
  excessRmdReinvested: number;   // excess RMDs beyond need, put into brokerage
  // Mutated account balances after all withdrawals
  updatedBalances: AccountBalance[];
}

// ─── RMD calculation ──────────────────────────────────────────────────────────

export function calculateRmd(balance: number, age: number): number {
  const divisor = RMD_UNIFORM_LIFETIME_TABLE[Math.min(age, 120)];
  if (divisor === undefined) return 0;
  return balance / divisor;
}

// Account types subject to RMDs
const RMD_ACCOUNT_TYPES = new Set<AccountType>([
  "traditional_401k",
  "traditional_ira",
]);

// ─── Bracket headroom for tax-efficient traditional draws ─────────────────────

// Returns how much ordinary income can be added before leaving the 12% bracket.
function traditionalHeadroom(
  currentOrdinaryIncome: number,
  year: number,
  inflationRate: number
): number {
  const brackets = inflateBrackets(TAX_BRACKETS_2025_MFJ, year, inflationRate);
  const deduction = inflateValue(STANDARD_DEDUCTION_2025_MFJ, year, inflationRate);
  const taxable = Math.max(0, currentOrdinaryIncome - deduction);

  // Top of the 12% bracket (index 1)
  const top12 = brackets[1].max ?? 0;
  return Math.max(0, top12 - taxable);
}

// ─── Draw from a single account ───────────────────────────────────────────────

function drawFrom(
  account: AccountBalance,
  requested: number
): { drawn: number; remaining: number } {
  const drawn = Math.min(account.balance, requested);
  account.balance -= drawn;
  return { drawn, remaining: requested - drawn };
}

// ─── Main withdrawal function ─────────────────────────────────────────────────

export function executeWithdrawals(input: WithdrawalInput): WithdrawalResult {
  const {
    amountNeeded,
    olderSpouseAge,
    bothRetired,
    currentOrdinaryIncome,
    year,
    inflationRate,
    annualExpenses,
  } = input;

  // Deep-copy balances so callers can diff before/after
  const balances: AccountBalance[] = input.accounts.map((a) => ({ ...a }));

  const breakdown: WithdrawalLineItem[] = [];
  const rmds: RmdLineItem[] = [];
  let remaining = amountNeeded;
  let excessRmdReinvested = 0;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function record(accountId: string, amount: number): void {
    if (amount > 0) breakdown.push({ accountId, amount });
  }

  function byType(...types: AccountType[]): AccountBalance[] {
    const typeSet = new Set(types);
    return balances.filter((a) => typeSet.has(a.type));
  }

  // ── Phase 2: process mandatory RMDs first ─────────────────────────────────

  if (bothRetired && olderSpouseAge >= RMD_START_AGE) {
    const rmdAccounts = balances.filter((a) => RMD_ACCOUNT_TYPES.has(a.type));

    for (const acct of rmdAccounts) {
      const rmdAmount = Math.round(calculateRmd(acct.balance, olderSpouseAge));
      if (rmdAmount <= 0) continue;

      rmds.push({ accountId: acct.accountId, rmdAmount });

      const applied = Math.min(rmdAmount, remaining);
      if (applied > 0) {
        const { drawn } = drawFrom(acct, applied);
        record(acct.accountId, drawn);
        remaining -= drawn;
      }

      // Excess RMD beyond current need — reinvested in brokerage (handled by projector)
      const excess = rmdAmount - applied;
      if (excess > 0) {
        drawFrom(acct, excess); // still must be withdrawn
        excessRmdReinvested += excess;
      }
    }

    // After RMDs, if still have a deficit fall through to normal ordering
  }

  // ── Phase 1 ordering (also used for remaining deficit post-RMD) ───────────

  if (remaining <= 0) {
    return buildResult(
      breakdown, rmds, excessRmdReinvested, remaining, balances
    );
  }

  // 1. Cash — but never draw below 6-month buffer
  const cashBuffer = annualExpenses * 0.5;
  for (const acct of byType("cash")) {
    const drawable = Math.max(0, acct.balance - cashBuffer);
    const want = Math.min(drawable, remaining);
    if (want <= 0) continue;
    const { drawn } = drawFrom(acct, want);
    record(acct.accountId, drawn);
    remaining -= drawn;
  }

  if (remaining <= 0) return buildResult(breakdown, rmds, excessRmdReinvested, remaining, balances);

  // 2. Taxable brokerage
  for (const acct of byType("brokerage")) {
    const { drawn } = drawFrom(acct, remaining);
    record(acct.accountId, drawn);
    remaining -= drawn;
  }

  if (remaining <= 0) return buildResult(breakdown, rmds, excessRmdReinvested, remaining, balances);

  // 3. HSA (qualified medical — v1 allows for any need in retirement)
  if (bothRetired) {
    for (const acct of byType("hsa")) {
      const { drawn } = drawFrom(acct, remaining);
      record(acct.accountId, drawn);
      remaining -= drawn;
    }
  }

  if (remaining <= 0) return buildResult(breakdown, rmds, excessRmdReinvested, remaining, balances);

  // 4. Traditional 401k / IRA — tax-bracket-aware: draw up to top of 12% bracket first
  const headroom = traditionalHeadroom(currentOrdinaryIncome, year, inflationRate);
  const traditionalBracketDraw = Math.min(headroom, remaining);

  if (traditionalBracketDraw > 0) {
    let bracketRemaining = traditionalBracketDraw;
    for (const acct of byType("traditional_401k", "traditional_ira")) {
      if (bracketRemaining <= 0) break;
      const { drawn } = drawFrom(acct, bracketRemaining);
      record(acct.accountId, drawn);
      bracketRemaining -= drawn;
      remaining -= drawn;
    }
  }

  if (remaining <= 0) return buildResult(breakdown, rmds, excessRmdReinvested, remaining, balances);

  // 5. Roth IRA / Roth 401k — last resort
  for (const acct of byType("roth_ira", "roth_401k")) {
    const { drawn } = drawFrom(acct, remaining);
    record(acct.accountId, drawn);
    remaining -= drawn;
  }

  if (remaining <= 0) return buildResult(breakdown, rmds, excessRmdReinvested, remaining, balances);

  // 6. Any remaining traditional accounts (above bracket headroom exhausted everything else)
  for (const acct of byType("traditional_401k", "traditional_ira")) {
    if (acct.balance <= 0) continue;
    const { drawn } = drawFrom(acct, remaining);
    record(acct.accountId, drawn);
    remaining -= drawn;
  }

  // 7. Deferred comp / pension as last resort
  for (const acct of byType("deferred_comp", "pension")) {
    if (remaining <= 0) break;
    const { drawn } = drawFrom(acct, remaining);
    record(acct.accountId, drawn);
    remaining -= drawn;
  }

  return buildResult(breakdown, rmds, excessRmdReinvested, remaining, balances);
}

// ─── Result builder ───────────────────────────────────────────────────────────

function buildResult(
  breakdown: WithdrawalLineItem[],
  rmds: RmdLineItem[],
  excessRmdReinvested: number,
  remainingNeeded: number,
  updatedBalances: AccountBalance[]
): WithdrawalResult {
  const shortfall = Math.max(0, remainingNeeded);
  const totalWithdrawn = breakdown.reduce((s, l) => s + l.amount, 0);
  return {
    breakdown,
    totalWithdrawn,
    shortfall,
    portfolioDepleted: shortfall > 0,
    rmds,
    excessRmdReinvested,
    updatedBalances,
  };
}
