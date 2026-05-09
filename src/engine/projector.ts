import type {
  Account,
  AccountType,
  AnnualProjection,
  ExpenseProfile,
  HouseholdProfile,
  IncomeStream,
  InvestmentAssumptions,
  RothConversionTargetBracket,
  Scenario,
  AssetAllocation,
} from "../types";
import { calculateTax, optimizeRothConversion } from "./taxEngine";
import {
  executeWithdrawals,
  type AccountBalance,
} from "./withdrawalStrategy";
import type { SimulationRun, AnnualReturns } from "./monteCarlo";
import { annual401kLimit, annualIraLimit, annualHsaLimit } from "./taxEngine";

// ─── Configuration ────────────────────────────────────────────────────────────

// Yield assumptions for taxable accounts (used for NIIT / LTCG inputs).
const BROKERAGE_DIVIDEND_YIELD = 0.018; // ~S&P 500 dividend yield
const CASH_INTEREST_TAXABLE = true;

// Account types whose withdrawals count as ordinary income (pre-tax money)
const ORDINARY_INCOME_WITHDRAWAL_TYPES = new Set<AccountType>([
  "traditional_401k",
  "traditional_ira",
  "deferred_comp",
  "pension",
]);

// Account types whose withdrawals are realised as long-term capital gains
const LTCG_WITHDRAWAL_TYPES = new Set<AccountType>(["brokerage"]);

// ─── Public input/output ──────────────────────────────────────────────────────

export interface ProjectorInput {
  household: HouseholdProfile;
  accounts: Account[];
  incomeStreams: IncomeStream[];
  expenses: ExpenseProfile;
  investmentAssumptions: InvestmentAssumptions;
  scenario?: Scenario;
  run: SimulationRun;
  startYear: number; // first projection year (typically currentYear)

  /** Override Roth optimizer settings — used when running the no-conversion baseline
   *  for the savings comparison. If omitted, falls back to the scenario's settings
   *  (default: optimizer ON, target 22%). */
  rothOptimizerOverride?: {
    enabled: boolean;
    targetBracket?: RothConversionTargetBracket;
  };
}

export interface ProjectorOutput {
  annualProjections: AnnualProjection[];
  yearlyEndBalances: number[]; // for percentile extraction
  depleted: boolean;
  finalBalance: number;
  /** Sum of federalTax across all annualProjections — used to compare with-vs-without conversions. */
  lifetimeFederalTax: number;
  /** Traditional account balance at age 73 (RMD start). Used for the RMD tax bomb indicator
   *  in the Roth Planner summary bar. */
  traditionalBalanceAtRMDAge: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRE_TAX_RETIREMENT_TYPES = new Set<AccountType>([
  "traditional_401k",
  "traditional_ira",
  "hsa",
  "deferred_comp",
]);

function isWorking(person: { targetRetirementAge: number; birthYear: number }, year: number, override?: number): boolean {
  const retireAge = override ?? person.targetRetirementAge;
  return year - person.birthYear < retireAge;
}

function age(person: { birthYear: number }, year: number): number {
  return year - person.birthYear;
}

function applyAllocationOverride(
  base: InvestmentAssumptions,
  override?: Partial<InvestmentAssumptions>
): InvestmentAssumptions {
  if (!override) return base;
  return { ...base, ...override };
}

function effectiveAllocation(
  assumptions: InvestmentAssumptions,
  bothRetired: boolean
): AssetAllocation {
  return bothRetired ? assumptions.postRetirementAllocation : assumptions.preRetirementAllocation;
}

// ─── Income calculation ───────────────────────────────────────────────────────

interface IncomeBreakdown {
  ordinaryIncome: number; // W2, RSU, bonus, traditional withdrawals
  ltcg: number;           // realized long-term gains
  qualifiedDividends: number;
  netInvestmentIncome: number; // dividends + interest + LTCG (for NIIT)
  spouse1Working: boolean;
  spouse2Working: boolean;
  /** Earned income from active streams, tracked per owner.
   *  Used to gate tax-advantaged contributions (can't contribute to a
   *  401k / IRA / HSA without earned income). */
  earnedByOwner: { spouse1: number; spouse2: number };
}

function calculateIncome(
  input: ProjectorInput,
  year: number,
  brokerageBalance: number,
  cashBalance: number
): IncomeBreakdown {
  const { household, incomeStreams, scenario } = input;
  const startYear = input.startYear;

  const s1Working = isWorking(
    household.spouse1,
    year,
    scenario?.retirementAgeOverride?.spouse1
  );
  const s2Working = isWorking(
    household.spouse2,
    year,
    scenario?.retirementAgeOverride?.spouse2
  );

  let ordinaryIncome = 0;
  let s1Earned = 0;
  let s2Earned = 0;
  for (const stream of incomeStreams) {
    if (year < stream.startYear || year > stream.endYear) continue;

    // Stop W2/bonus when that spouse retires
    const owner = stream.owner;
    const ownerWorking = owner === "spouse1" ? s1Working : s2Working;
    if ((stream.type === "w2_salary" || stream.type === "bonus") && !ownerWorking) {
      continue;
    }

    const yearsElapsed = year - startYear;
    const grown = stream.annualAmount * Math.pow(1 + stream.growthRate, yearsElapsed);

    if (stream.taxTreatment === "ordinary_income") {
      ordinaryIncome += grown;
      // Track earned income per owner so contributions can be gated correctly
      if (owner === "spouse1") s1Earned += grown;
      else if (owner === "spouse2") s2Earned += grown;
    } else if (stream.taxTreatment === "ltcg") {
      // unusual for income streams; treat as LTCG
    } else {
      // tax_free
    }
  }

  // Investment income from taxable accounts
  const dividends = brokerageBalance * BROKERAGE_DIVIDEND_YIELD;
  const cashInterest = cashBalance * input.investmentAssumptions.cashReturn;
  const interestTaxable = CASH_INTEREST_TAXABLE ? cashInterest : 0;

  // In v1, qualified dividends taxed at LTCG rates; non-qualified are ordinary
  const qualifiedDividends = dividends; // simplification: all dividends qualified
  const ltcg = qualifiedDividends; // for tax purposes, qualified divs stack like LTCG
  const netInvestmentIncome = dividends + interestTaxable;

  // Cash interest is ordinary income
  ordinaryIncome += interestTaxable;

  return {
    ordinaryIncome,
    ltcg,
    qualifiedDividends,
    netInvestmentIncome,
    spouse1Working: s1Working,
    spouse2Working: s2Working,
    earnedByOwner: { spouse1: s1Earned, spouse2: s2Earned },
  };
}

// ─── Contributions ────────────────────────────────────────────────────────────

// Account types that require earned income to accept contributions.
// You cannot fund a 401k, IRA, or HSA without employment / earned income.
// Brokerage and cash accounts have no such restriction.
const REQUIRES_EARNED_INCOME = new Set<AccountType>([
  "traditional_401k",
  "roth_401k",
  "traditional_ira",
  "roth_ira",
  "hsa",
]);

interface ContributionResult {
  totalContributions: number;
  preTaxReduction: number;
  perAccount: { accountId: string; amount: number }[];
}

function calculateContributions(
  input: ProjectorInput,
  year: number,
  s1Working: boolean,
  s2Working: boolean,
  earnedByOwner: { spouse1: number; spouse2: number }
): ContributionResult {
  const { household, accounts } = input;
  const perAccount: { accountId: string; amount: number }[] = [];
  let total = 0;
  let preTax = 0;

  for (const acct of accounts) {
    // Gate on retirement-age status first
    const ownerWorking =
      acct.owner === "spouse1" ? s1Working :
      acct.owner === "spouse2" ? s2Working :
      s1Working || s2Working;

    if (!ownerWorking) continue;

    // Tax-advantaged retirement accounts additionally require earned income.
    // Without an active paycheck you cannot contribute to a 401k / IRA / HSA.
    if (REQUIRES_EARNED_INCOME.has(acct.type)) {
      const ownerEarned =
        acct.owner === "spouse1" ? earnedByOwner.spouse1 :
        acct.owner === "spouse2" ? earnedByOwner.spouse2 :
        // joint → either spouse's income qualifies (e.g. spousal IRA)
        earnedByOwner.spouse1 + earnedByOwner.spouse2;
      if (ownerEarned <= 0) continue;
    }

    const ownerPerson = acct.owner === "spouse2" ? household.spouse2 : household.spouse1;
    const ownerAge = age(ownerPerson, year);

    let limit = Infinity;
    if (acct.type === "traditional_401k" || acct.type === "roth_401k") {
      limit = annual401kLimit(ownerAge);
    } else if (acct.type === "traditional_ira" || acct.type === "roth_ira") {
      limit = annualIraLimit(ownerAge);
    } else if (acct.type === "hsa") {
      limit = annualHsaLimit(ownerAge);
    }

    const contribution = Math.min(acct.annualContribution, limit);
    if (contribution <= 0) continue;

    perAccount.push({ accountId: acct.id, amount: contribution });
    total += contribution;

    if (PRE_TAX_RETIREMENT_TYPES.has(acct.type)) {
      preTax += contribution;
    }
  }

  return { totalContributions: total, preTaxReduction: preTax, perAccount };
}

// ─── Apply contributions, returns, and surplus to balance map ────────────────

function applyContributions(
  balances: AccountBalance[],
  contributions: { accountId: string; amount: number }[],
  accounts: Account[]
): void {
  for (const c of contributions) {
    const target = balances.find((b) => b.accountId === c.accountId);
    if (!target) continue;
    target.balance += c.amount;

    // Add employer match for 401k accounts
    const acct = accounts.find((a) => a.id === c.accountId);
    if (acct?.employerMatch && (acct.type === "traditional_401k" || acct.type === "roth_401k")) {
      target.balance += acct.employerMatch;
    }
  }
}

function applyReturns(
  balances: AccountBalance[],
  returns: AnnualReturns,
  allocation: AssetAllocation
): void {
  const blended = returns.blended(allocation);
  for (const b of balances) {
    if (b.type === "cash") {
      b.balance *= 1 + returns.cash;
    } else if (b.type === "pension") {
      // not market-exposed in v1
    } else {
      b.balance *= 1 + blended;
    }
  }
}

function applySurplus(balances: AccountBalance[], surplus: number): void {
  if (surplus <= 0) return;
  // Reinvest into brokerage; if no brokerage, add to cash
  const brokerage = balances.find((b) => b.type === "brokerage");
  if (brokerage) {
    brokerage.balance += surplus;
  } else {
    const cash = balances.find((b) => b.type === "cash");
    if (cash) cash.balance += surplus;
  }
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

function calculateAnnualExpenses(
  input: ProjectorInput,
  year: number,
  bothRetired: boolean
): number {
  const { expenses, scenario } = input;
  const yearsElapsed = year - input.startYear;
  // Single source of truth: inflation lives on InvestmentAssumptions.
  // (Scenario allocationOverride may override it for what-if analysis.)
  const inflation =
    scenario?.allocationOverride?.inflationRate ?? input.investmentAssumptions.inflationRate;

  const retirementSpend = scenario?.annualSpendingOverride ?? expenses.retirementAnnualSpending;
  const baseToday = bothRetired ? retirementSpend : expenses.currentAnnualSpending;
  let total = baseToday * Math.pow(1 + inflation, yearsElapsed);

  // One-time scenario expenses for this year (already in nominal dollars)
  if (scenario?.additionalOneTimeExpenses) {
    for (const oneTime of scenario.additionalOneTimeExpenses) {
      if (oneTime.year === year) total += oneTime.amount;
    }
  }

  return total;
}

// ─── Main projection loop ─────────────────────────────────────────────────────

export function projectScenario(input: ProjectorInput): ProjectorOutput {
  const assumptions = applyAllocationOverride(
    input.investmentAssumptions,
    input.scenario?.allocationOverride
  );

  // Resolve Roth optimizer settings: explicit override (used by the no-conversion baseline pass)
  // beats scenario settings, which fall back to the spec defaults (ON, 22%).
  const rothOptimizerEnabled =
    input.rothOptimizerOverride?.enabled ??
    input.scenario?.enableRothOptimizer ??
    true;
  const rothTargetBracket: RothConversionTargetBracket =
    input.rothOptimizerOverride?.targetBracket ??
    input.scenario?.rothConversionTargetBracket ??
    "22pct";

  // Initialize balances from accounts
  const balances: AccountBalance[] = input.accounts.map((a) => ({
    accountId: a.id,
    type: a.type,
    balance: a.currentBalance,
  }));

  const annualProjections: AnnualProjection[] = [];
  const yearlyEndBalances: number[] = [];

  // Determine end year from older spouse's planning horizon
  const olderSpouseBirth = Math.min(
    input.household.spouse1.birthYear,
    input.household.spouse2.birthYear
  );
  const endYear = olderSpouseBirth + input.household.planningHorizon.endAge;

  let depleted = false;
  let lifetimeFederalTax = 0;
  let traditionalBalanceAtRMDAge = 0;

  // Identify older spouse once (used for RMD age calculation each year)
  const olderSpouse =
    input.household.spouse1.birthYear <= input.household.spouse2.birthYear
      ? input.household.spouse1
      : input.household.spouse2;

  // Build accountId → type lookup from the initial balances array (types never change)
  const acctTypeById = new Map(balances.map((b) => [b.accountId, b.type]));

  for (let year = input.startYear; year <= endYear; year++) {
    const yearIdx = year - input.startYear;
    const portfolioStart = balances.reduce((s, b) => s + b.balance, 0);

    const brokerageBalance = balances
      .filter((b) => b.type === "brokerage")
      .reduce((s, b) => s + b.balance, 0);
    const cashBalance = balances
      .filter((b) => b.type === "cash")
      .reduce((s, b) => s + b.balance, 0);

    // 1. Income (W2 salaries, RSUs, dividends, cash interest — no withdrawals yet)
    const income = calculateIncome(input, year, brokerageBalance, cashBalance);
    const earnedIncome = income.ordinaryIncome - cashBalance * assumptions.cashReturn;
    const investmentIncome = income.netInvestmentIncome;

    // 2. Contributions
    const contribs = calculateContributions(
      input, year, income.spouse1Working, income.spouse2Working, income.earnedByOwner
    );
    applyContributions(balances, contribs.perAccount, input.accounts);

    // 3. Expenses
    const bothRetired = !income.spouse1Working && !income.spouse2Working;
    const totalExpenses = calculateAnnualExpenses(input, year, bothRetired);

    // 4. First-pass withdrawals — cover the gross cash shortfall before knowing
    //    the exact tax on those withdrawals (tax is unknown until we know the
    //    withdrawal mix, which is unknown until we run the strategy).
    //
    //    Gross shortfall = how much portfolio cash we need before taxes:
    //      expenses + contributions − income (we'll top-up for taxes in step 6)
    const baseOrdinary = Math.max(0, income.ordinaryIncome - contribs.preTaxReduction);
    const grossShortfall = Math.max(
      0,
      totalExpenses + contribs.totalContributions - income.ordinaryIncome
    );

    // Snapshot the start-of-year traditional balance for the Roth Planner table.
    const traditionalBalanceStart = balances
      .filter((b) => b.type === "traditional_401k" || b.type === "traditional_ira" || b.type === "deferred_comp")
      .reduce((s, b) => s + b.balance, 0);

    const withdrawalBreakdown: { accountId: string; amount: number }[] = [];
    let totalWithdrawn = 0;
    let excessRmdTotal = 0;
    let rmdAmountThisYear = 0; // mandatory RMD income for tax / optimizer purposes

    // Helper: run the withdrawal engine against the live balances array.
    function runWithdrawals(need: number, currentIncome: number): void {
      if (need <= 0 && (!bothRetired || age(olderSpouse, year) < 73)) return;
      const result = executeWithdrawals({
        accounts: balances,
        amountNeeded: Math.max(0, need),
        olderSpouseAge: age(olderSpouse, year),
        bothRetired,
        currentOrdinaryIncome: currentIncome,
        year,
        inflationRate: assumptions.inflationRate,
        annualExpenses: totalExpenses,
      });
      withdrawalBreakdown.push(...result.breakdown);
      totalWithdrawn += result.totalWithdrawn;
      excessRmdTotal += result.excessRmdReinvested;
      // Sum up RMD amounts from this call (used for optimizer headroom + tax)
      for (const r of result.rmds) rmdAmountThisYear += r.rmdAmount;
      for (let i = 0; i < balances.length; i++) {
        balances[i].balance = result.updatedBalances[i].balance;
      }
      if (result.portfolioDepleted) depleted = true;
    }

    runWithdrawals(grossShortfall, baseOrdinary);

    // 5. Classify withdrawals by tax treatment so we can compute the real tax.
    //    • Traditional 401k / IRA / deferred comp / pension → ordinary income
    //    • Brokerage → long-term capital gains (v1 simplification)
    //    • Cash, Roth, HSA → not additional taxable income
    let withdrawalOrdinary = 0;
    let withdrawalLTCG = 0;
    for (const w of withdrawalBreakdown) {
      const type = acctTypeById.get(w.accountId);
      if (type && ORDINARY_INCOME_WITHDRAWAL_TYPES.has(type)) {
        withdrawalOrdinary += w.amount;
      } else if (type && LTCG_WITHDRAWAL_TYPES.has(type)) {
        withdrawalLTCG += w.amount;
      }
    }
    // Excess RMDs (beyond current need) also count as ordinary income — they
    // were forced out of traditional accounts even though we didn't spend them.
    withdrawalOrdinary += excessRmdTotal;

    // 5b. Roth conversion (Spec 03 §6 + §6.5 + §6.2a early-window pull-forward).
    //     Run only when both spouses are retired (we've already conservatively
    //     gated on that inside the optimizer too). The optimizer is told the
    //     full ordinary-income picture so it sizes the conversion correctly.
    let rothConversionAmount = 0;
    let rothConversionTaxCost = 0;
    let conversionRationale: string | undefined;
    let irmaaWarning = false;
    let isPullForward = false;

    if (rothOptimizerEnabled && bothRetired) {
      const traditionalBalanceNow = balances
        .filter((b) => b.type === "traditional_401k" || b.type === "traditional_ira")
        .reduce((s, b) => s + b.balance, 0);

      // §6.2a: any spouse aged 55–59 inclusive triggers the early-window flag.
      // We use integer ages — practical equivalent of "55–59½".
      const s1Age = age(input.household.spouse1, year);
      const s2Age = age(input.household.spouse2, year);
      const inEarly = (a: number) => a >= 55 && a < 60;
      const anySpouseInEarlyWindow = inEarly(s1Age) || inEarly(s2Age);

      // §6.2a: when in the early window, the conversion's tax bill must be
      // payable from non-retirement funds (taxable brokerage + cash) — using
      // traditional accounts to pay the bill before 59½ would trigger a 10%
      // penalty. We measure available funds AFTER this year's expense
      // withdrawals so the optimizer doesn't count cash already spoken for.
      const availableTaxFunds = balances
        .filter((b) => b.type === "brokerage" || b.type === "cash")
        .reduce((s, b) => s + b.balance, 0);

      // Note: we pass rmdIncome = rmdAmountThisYear so the optimizer's headroom
      // calc respects mandatory income post-73.
      const optimizerOrdinary = baseOrdinary + withdrawalOrdinary - rmdAmountThisYear;
      const conv = optimizeRothConversion({
        year,
        inflationRate: assumptions.inflationRate,
        ordinaryIncomeBeforeConversion: optimizerOrdinary,
        longTermCapitalGains: income.ltcg + withdrawalLTCG,
        traditionalBalance: traditionalBalanceNow,
        targetBracket: rothTargetBracket,
        bothRetired,
        olderSpouseAge: age(olderSpouse, year),
        rmdIncome: rmdAmountThisYear,
        anySpouseInEarlyWindow,
        availableTaxFunds,
      });

      rothConversionAmount = conv.conversionAmount;
      rothConversionTaxCost = conv.taxCost;
      conversionRationale = conv.rationale;
      irmaaWarning = conv.irmaaWarning;
      isPullForward = conv.isPullForward;

      if (rothConversionAmount > 0) {
        // Move money from traditional → roth. Drain pro-rata across traditional accounts.
        let remaining = rothConversionAmount;
        for (const acct of balances) {
          if (remaining <= 0) break;
          if (acct.type !== "traditional_401k" && acct.type !== "traditional_ira") continue;
          const drawn = Math.min(acct.balance, remaining);
          acct.balance -= drawn;
          remaining -= drawn;
        }
        // Park converted dollars in the first roth account if one exists; otherwise create
        // a synthetic line by adding to the first roth_ira-type balance entry. If the user
        // has no Roth account at all, the conversion still counts as taxable income but
        // there's nowhere to put the money — fall back to brokerage so the cash isn't lost.
        const rothTarget =
          balances.find((b) => b.type === "roth_ira") ??
          balances.find((b) => b.type === "roth_401k");
        if (rothTarget) {
          rothTarget.balance += rothConversionAmount;
        } else {
          applySurplus(balances, rothConversionAmount);
        }
      }
    }

    // 6. Tax — now computed on the complete income picture including withdrawals
    //    and any Roth conversion this year.
    const taxableOrdinary = baseOrdinary + withdrawalOrdinary + rothConversionAmount;
    const taxableLTCG = income.ltcg + withdrawalLTCG;
    const taxSnapshot = calculateTax({
      year,
      inflationRate: assumptions.inflationRate,
      ordinaryIncome: taxableOrdinary,
      longTermCapitalGains: taxableLTCG,
      qualifiedDividends: income.qualifiedDividends,
      netInvestmentIncome: income.netInvestmentIncome + withdrawalLTCG,
      rothConversionAmount: rothConversionAmount || undefined,
      conversionRationale,
    });

    // 7. Net cash flow check.
    //    The gross shortfall didn't include taxes; if the tax bill is larger than
    //    zero we need a supplemental withdrawal to cover it.
    //
    //    Cash in:  income.ordinaryIncome  (W2 + interest, received as cash)
    //            + totalWithdrawn         (cash from portfolio accounts)
    //    Cash out: taxes + contributions + expenses
    //
    //    Roth conversions don't move cash in/out of the household — they shift
    //    money between portfolio accounts — so they don't appear in netFlow.
    //    The tax cost of the conversion IS in taxSnapshot.totalFederalTax,
    //    however, so it correctly increases the cash deficit.
    const netFlow =
      income.ordinaryIncome +
      totalWithdrawn -
      taxSnapshot.totalFederalTax -
      contribs.totalContributions -
      totalExpenses;

    if (netFlow >= 0) {
      // Surplus — park in brokerage
      applySurplus(balances, netFlow);
    } else {
      // Taxes consumed more than the initial withdrawal covered.
      // Pull just enough extra to settle the bill; don't iterate taxes again.
      runWithdrawals(-netFlow, taxableOrdinary);
    }

    // Reinvest excess RMDs (mandatory withdrawals beyond current-year need)
    applySurplus(balances, excessRmdTotal);

    // 8. Apply investment returns
    const allocation = effectiveAllocation(assumptions, bothRetired);
    const returns = input.run.returns[Math.min(yearIdx, input.run.returns.length - 1)];
    applyReturns(balances, returns, allocation);

    const portfolioEnd = balances.reduce((s, b) => s + b.balance, 0);
    const investmentGains = portfolioEnd - portfolioStart - contribs.totalContributions + totalWithdrawn;

    annualProjections.push({
      year,
      age_spouse1: age(input.household.spouse1, year),
      age_spouse2: age(input.household.spouse2, year),
      earnedIncome,
      investmentIncome,
      totalIncome: earnedIncome + investmentIncome,
      federalTax: taxSnapshot.totalFederalTax,
      effectiveTaxRate: taxSnapshot.effectiveRate,
      marginalRate: taxSnapshot.marginalRate,
      totalExpenses,
      portfolioStartBalance: portfolioStart,
      contributions: contribs.totalContributions,
      withdrawals: totalWithdrawn,
      investmentGains,
      portfolioEndBalance: portfolioEnd,
      withdrawalBreakdown,
      traditionalBalanceStart,
      rmdAmount: rmdAmountThisYear,
      rothConversionAmount,
      rothConversionTaxCost,
      conversionRationale,
      irmaaWarning,
      isPullForward,
    });

    yearlyEndBalances.push(portfolioEnd);
    lifetimeFederalTax += taxSnapshot.totalFederalTax;

    // Capture the traditional balance the first year the older spouse hits RMD age.
    // Used by the Roth Planner summary's "RMD tax bomb" indicator on the no-conversion
    // baseline pass.
    if (age(olderSpouse, year) === 73 && traditionalBalanceAtRMDAge === 0) {
      traditionalBalanceAtRMDAge = traditionalBalanceStart;
    }

    // Early exit if fully depleted (continue recording zero years)
    if (portfolioEnd <= 0) depleted = true;
  }

  return {
    annualProjections,
    yearlyEndBalances,
    depleted,
    finalBalance: balances.reduce((s, b) => s + b.balance, 0),
    lifetimeFederalTax,
    traditionalBalanceAtRMDAge,
  };
}
