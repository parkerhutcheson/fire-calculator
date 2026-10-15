// Year-by-year FIRE projection. All money is in today's dollars: nominal rates are
// converted to real rates up front, so tax brackets, contribution limits and spending
// stay constant. Rows carry `inflationFactor` so the UI can show future dollars.

import {
  MEDICARE_AGE,
  PENALTY_FREE_AGE,
  ROTH_PHASEOUT,
  RULE_OF_55_AGE,
  LIMITS,
  hsaLimit,
  iraLimit,
  k401Limit,
} from "./constants";
import type { Inputs } from "./inputs";
import { type TaxContext, incomeTax, payrollTax } from "./tax";

export const ACCOUNTS = ["k401", "tradIra", "roth", "hsa", "brokerage", "cash"] as const;
export type Account = (typeof ACCOUNTS)[number];
export type Balances = Record<Account, number>;

export interface YearRow {
  age: number;
  yearIndex: number;
  inflationFactor: number;
  retired: boolean;
  salary: number;
  contributions: number;
  employerMatch: number;
  /** Start-of-year balances. */
  balances: Balances;
  investable: number;
  homeValue: number;
  mortgageBalance: number;
  netWorth: number;
  fireNumber: number;
  /** Retirement spending need for the year (spend + healthcare + mortgage payments). */
  spendingNeed: number;
  grossWithdrawal: number;
  taxes: number;
  penalty: number;
  shortfall: number;
}

export interface FireBreakdown {
  coreSpend: number;
  taxGrossUp: number;
  healthcareBridge: number;
  mortgagePayoff: number;
  effectiveTaxRate: number;
}

export interface BridgeCheck {
  applies: boolean;
  years: number;
  accessibleAtRetirement: number;
  neededDuringBridge: number;
  penaltiesPaid: number;
  usesRuleOf55: boolean;
  ok: boolean;
}

export interface Warning {
  id: string;
  level: "info" | "warn";
  text: string;
}

export interface Result {
  rows: YearRow[];
  fireNumber: number;
  fireBreakdown: FireBreakdown;
  fiAge: number | null;
  retireAge: number | null;
  investableNow: number;
  netWorthNow: number;
  progress: number;
  leanFireNumber: number;
  fatFireNumber: number;
  coastFireNumber: number;
  coastReached: boolean;
  savingsRate: number;
  takeHome: number;
  leftoverCashFlow: number;
  depletionAge: number | null;
  endingInvestable: number;
  bridge: BridgeCheck;
  warnings: Warning[];
}

const pct = (n: number) => n / 100;
const realRate = (nominal: number, inflation: number) => (1 + nominal) / (1 + inflation) - 1;
const sumBalances = (b: Balances) => ACCOUNTS.reduce((s, k) => s + b[k], 0);

interface Source {
  key: Account;
  available: number;
  ordinary: boolean;
  gainFrac: number;
  penalized: boolean;
  /** Roth withdrawals come out of basis first; track which part this source draws. */
  rothPart?: "basis" | "earnings";
}

interface DrawResult {
  taken: number[];
  gross: number;
  tax: number;
  penalty: number;
  shortfall: number;
}

/** Pull `need` (after tax) from sources in order, solving for each source's gross draw. */
export function drawFrom(sources: Source[], need: number, ctx: TaxContext): DrawResult {
  const taken = sources.map(() => 0);
  let ordinary = 0;
  let gains = 0;
  let penalized = 0;
  let gross = 0;

  const taxOf = (o: number, g: number, p: number) =>
    incomeTax({ ordinary: o, ltcg: g, penalized: p }, ctx);

  for (let i = 0; i < sources.length && need > 0; i++) {
    const s = sources[i];
    if (s.available <= 0) continue;
    const netWith = (x: number) =>
      gross +
      x -
      taxOf(
        ordinary + (s.ordinary ? x : 0),
        gains + x * s.gainFrac,
        penalized + (s.penalized ? x : 0),
      ).total;

    let x = s.available;
    if (netWith(s.available) >= need) {
      let lo = 0;
      let hi = s.available;
      for (let iter = 0; iter < 50; iter++) {
        const mid = (lo + hi) / 2;
        if (netWith(mid) >= need) hi = mid;
        else lo = mid;
      }
      x = hi;
    }
    taken[i] = x;
    gross += x;
    if (s.ordinary) ordinary += x;
    gains += x * s.gainFrac;
    if (s.penalized) penalized += x;
    if (x < s.available) break;
  }

  const t = taxOf(ordinary, gains, penalized);
  const net = gross - t.total;
  return {
    taken,
    gross,
    tax: t.federal + t.state,
    penalty: t.penalty,
    shortfall: Math.max(0, need - net),
  };
}

/** Effective tax rate on a withdrawal split pro-rata across the portfolio. */
function effectiveWithdrawalTaxRate(b: Balances, brokerageBasis: number, spend: number, ctx: TaxContext) {
  const total = sumBalances(b);
  if (total <= 0 || spend <= 0) return 0;
  const tradFrac = (b.k401 + b.tradIra) / total;
  const brokFrac = b.brokerage / total;
  const gainFrac = b.brokerage > 0 ? Math.max(0, 1 - brokerageBasis / b.brokerage) : 0;
  const netOf = (w: number) =>
    w - incomeTax({ ordinary: w * tradFrac, ltcg: w * brokFrac * gainFrac }, ctx).total;
  let lo = spend;
  let hi = spend * 3;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (netOf(mid) >= spend) hi = mid;
    else lo = mid;
  }
  return 1 - spend / hi;
}

/** Amortize a nominal mortgage for one year of monthly payments. */
function amortizeYear(balance: number, annualRate: number, monthlyPayment: number) {
  let paid = 0;
  for (let m = 0; m < 12 && balance > 0; m++) {
    const interest = balance * (annualRate / 12);
    const payment = Math.min(monthlyPayment, balance + interest);
    balance = balance + interest - payment;
    paid += payment;
  }
  return { balance: Math.max(0, balance), paid };
}

export function project(inp: Inputs): Result {
  const taxCtx: TaxContext = { filing: inp.filing, stateRate: pct(inp.stateTaxRate) };

  const inflation = inp.inflationEnabled ? pct(inp.inflationRate) : 0;
  const r = realRate(pct(inp.expectedReturn), inflation);
  const rBrokerage = realRate(pct(inp.expectedReturn) - pct(inp.brokerageExpenseRatio), inflation);
  const rCash = realRate(pct(inp.cashYield), inflation);
  const rHome = realRate(pct(inp.homeAppreciation), inflation);
  const gSalary = realRate(pct(inp.salaryGrowth), inflation);
  const swr = Math.max(0.005, pct(inp.swr));

  const startAge = Math.round(inp.currentAge);
  const endAge = Math.max(startAge + 1, Math.round(inp.lifeExpectancy));
  const warnings: Warning[] = [];

  // --- Contributions (today's dollars, before limits) -------------------------------
  const wantedK401 = inp.salary * pct(inp.k401ContribPct);
  const wantedIra = inp.tradIraContrib + inp.rothIraContrib;
  const wantedHsa = inp.hsaEnabled ? inp.hsaContrib : 0;

  if (wantedK401 > k401Limit(startAge)) {
    warnings.push({
      id: "k401-limit",
      level: "warn",
      text: `Your 401(k) contribution (${fmt(wantedK401)}) is over the 2026 limit of ${fmt(k401Limit(startAge))}, so it's capped at the limit.`,
    });
  }
  if (wantedIra > iraLimit(startAge)) {
    warnings.push({
      id: "ira-limit",
      level: "warn",
      text: `Traditional + Roth IRA contributions together are capped at ${fmt(iraLimit(startAge))} for 2026. They're scaled down to fit.`,
    });
  }
  if (inp.hsaEnabled && wantedHsa > hsaLimit(inp.hsaCoverage, startAge)) {
    warnings.push({
      id: "hsa-limit",
      level: "warn",
      text: `HSA contributions are capped at ${fmt(hsaLimit(inp.hsaCoverage, startAge))} for ${inp.hsaCoverage} coverage in 2026.`,
    });
  }

  // --- State ------------------------------------------------------------------------
  const balances: Balances = {
    k401: inp.k401Balance,
    tradIra: inp.tradIraBalance,
    roth: inp.rothIraBalance,
    hsa: inp.hsaEnabled ? inp.hsaBalance : 0,
    brokerage: inp.brokerageBalance,
    cash: inp.cashBalance,
  };
  let rothBasis = Math.min(inp.rothIraBasis, inp.rothIraBalance);
  let brokerageBasis = Math.min(inp.brokerageBasis, inp.brokerageBalance);
  const hasMortgage = inp.ownsHome && inp.hasMortgage;
  let mortgageNominal = hasMortgage ? inp.mortgageBalance : 0;
  let homeValue = inp.ownsHome ? inp.homeValue : 0;
  let salary = inp.salary;

  if (hasMortgage && inp.mortgageBalance > 0) {
    const firstMonthInterest = inp.mortgageBalance * (pct(inp.mortgageRate) / 12);
    if (inp.mortgagePayment <= firstMonthInterest) {
      warnings.push({
        id: "mortgage-payment",
        level: "warn",
        text: `Your monthly payment doesn't cover the ~${fmt(firstMonthInterest)} of monthly interest, so the loan never pays off.`,
      });
    }
  }

  const rows: YearRow[] = [];
  let fiAge: number | null = null;
  let retireAge: number | null = inp.retireMode === "target" ? Math.round(inp.targetRetireAge) : null;
  let depletionAge: number | null = null;
  let bridgePenalties = 0;
  let bridgeNeed = 0;
  let accessibleAtRetirement = 0;
  let usesRuleOf55 = false;
  let breakdownAtRetire: FireBreakdown | null = null;
  let fireAtRetire = 0;

  const fireNumberFor = (age: number, b: Balances, spend: number) => {
    const eff = effectiveWithdrawalTaxRate(b, brokerageBasis, spend, taxCtx);
    const grossSpend = spend / (1 - eff);
    const healthcareBridge = inp.preMedicareHealthcare * Math.max(0, MEDICARE_AGE - age);
    const mortgagePayoff = mortgageNominal / Math.pow(1 + inflation, age - startAge);
    return {
      total: grossSpend / swr + healthcareBridge + mortgagePayoff,
      breakdown: {
        coreSpend: spend / swr,
        taxGrossUp: (grossSpend - spend) / swr,
        healthcareBridge,
        mortgagePayoff,
        effectiveTaxRate: eff,
      },
    };
  };

  for (let age = startAge; age <= endAge; age++) {
    const t = age - startAge;
    const inflationFactor = Math.pow(1 + inflation, t);
    const investable = sumBalances(balances);
    const mortgageReal = mortgageNominal / inflationFactor;
    const fire = fireNumberFor(age, balances, inp.annualSpend);

    if (fiAge === null && investable >= fire.total) fiAge = age;
    if (retireAge === null && fiAge !== null) retireAge = fiAge;
    const retired = retireAge !== null && age >= retireAge;

    if (retired && age === retireAge) {
      breakdownAtRetire = fire.breakdown;
      fireAtRetire = fire.total;
      usesRuleOf55 = retireAge >= RULE_OF_55_AGE && retireAge < PENALTY_FREE_AGE;
      accessibleAtRetirement =
        balances.cash + balances.brokerage + rothBasis + (usesRuleOf55 ? balances.k401 : 0);
    }

    const row: YearRow = {
      age,
      yearIndex: t,
      inflationFactor,
      retired,
      salary: retired ? 0 : salary,
      contributions: 0,
      employerMatch: 0,
      balances: { ...balances },
      investable,
      homeValue,
      mortgageBalance: mortgageReal,
      netWorth: investable + homeValue - mortgageReal + inp.otherAssets - inp.otherDebts,
      fireNumber: fire.total,
      spendingNeed: 0,
      grossWithdrawal: 0,
      taxes: 0,
      penalty: 0,
      shortfall: 0,
    };

    // Mortgage payments happen either way; while working they come out of salary.
    const mortgageYear = amortizeYear(mortgageNominal, pct(inp.mortgageRate), inp.mortgagePayment);
    const mortgagePaidReal = mortgageYear.paid / Math.pow(1 + inflation, t + 0.5);

    if (!retired) {
      const k401 = Math.min(salary * pct(inp.k401ContribPct), k401Limit(age));
      const matchablePct = Math.min(pct(inp.k401ContribPct), pct(inp.matchUpToPct));
      const match = Math.min(salary * matchablePct * pct(inp.matchRate), Math.max(0, LIMITS.k401Total - k401));
      const iraScale = wantedIra > 0 ? Math.min(1, iraLimit(age) / wantedIra) : 0;
      const tradIra = inp.tradIraContrib * iraScale;
      const roth = inp.rothIraContrib * iraScale;
      const hsa = inp.hsaEnabled ? Math.min(inp.hsaContrib, hsaLimit(inp.hsaCoverage, age)) : 0;
      const brokerage = inp.brokerageContrib;

      balances.k401 = balances.k401 * (1 + r) + k401 + match;
      balances.tradIra = balances.tradIra * (1 + r) + tradIra;
      balances.roth = balances.roth * (1 + r) + roth;
      balances.hsa = balances.hsa * (1 + r) + hsa;
      balances.brokerage = balances.brokerage * (1 + rBrokerage) + brokerage;
      balances.cash = balances.cash * (1 + rCash);
      rothBasis += roth;
      brokerageBasis += brokerage;

      row.contributions = k401 + tradIra + roth + hsa + brokerage;
      row.employerMatch = match;
      salary *= 1 + gSalary;
    } else {
      const healthcare = age < MEDICARE_AGE ? inp.preMedicareHealthcare : 0;
      // HSA pays qualified medical costs tax-free first.
      const fromHsaForHealth = Math.min(balances.hsa, healthcare);
      balances.hsa -= fromHsaForHealth;
      const need = inp.annualSpend + (healthcare - fromHsaForHealth) + mortgagePaidReal;

      const early = age < PENALTY_FREE_AGE;
      const k401Free = !early || usesRuleOf55;
      const gainFrac = balances.brokerage > 0 ? Math.max(0, 1 - brokerageBasis / balances.brokerage) : 0;
      const rothEarnings = Math.max(0, balances.roth - rothBasis);

      const sources: Source[] = [
        { key: "cash", available: balances.cash, ordinary: false, gainFrac: 0, penalized: false },
        { key: "brokerage", available: balances.brokerage, ordinary: false, gainFrac, penalized: false },
      ];
      if (early) {
        sources.push(
          { key: "roth", available: Math.min(rothBasis, balances.roth), ordinary: false, gainFrac: 0, penalized: false, rothPart: "basis" },
          { key: "k401", available: balances.k401, ordinary: true, gainFrac: 0, penalized: !k401Free },
          { key: "tradIra", available: balances.tradIra, ordinary: true, gainFrac: 0, penalized: true },
          { key: "roth", available: rothEarnings, ordinary: true, gainFrac: 0, penalized: true, rothPart: "earnings" },
        );
      } else {
        sources.push(
          { key: "k401", available: balances.k401, ordinary: true, gainFrac: 0, penalized: false },
          { key: "tradIra", available: balances.tradIra, ordinary: true, gainFrac: 0, penalized: false },
          // HSA is penalty-free for any use at 65+, taxed like a traditional IRA.
          { key: "hsa", available: age >= MEDICARE_AGE ? balances.hsa : 0, ordinary: true, gainFrac: 0, penalized: false },
          { key: "roth", available: balances.roth, ordinary: false, gainFrac: 0, penalized: false },
        );
      }

      const draw = drawFrom(sources, need, taxCtx);
      sources.forEach((s, i) => {
        const x = draw.taken[i];
        if (x <= 0) return;
        if (s.key === "brokerage") brokerageBasis = Math.max(0, brokerageBasis - x * (1 - s.gainFrac));
        if (s.key === "roth") rothBasis = Math.max(0, rothBasis - (s.rothPart === "earnings" ? 0 : x));
        balances[s.key] = Math.max(0, balances[s.key] - x);
      });
      if (!early) rothBasis = Math.min(rothBasis, balances.roth);

      row.spendingNeed = need + fromHsaForHealth;
      row.grossWithdrawal = draw.gross + fromHsaForHealth;
      row.taxes = draw.tax;
      row.penalty = draw.penalty;
      row.shortfall = draw.shortfall;
      if (draw.shortfall > 1 && depletionAge === null) depletionAge = age;
      if (early) {
        bridgePenalties += draw.penalty;
        bridgeNeed += need;
      }

      balances.k401 *= 1 + r;
      balances.tradIra *= 1 + r;
      balances.roth *= 1 + r;
      balances.hsa *= 1 + r;
      balances.brokerage *= 1 + rBrokerage;
      balances.cash *= 1 + rCash;
    }

    mortgageNominal = mortgageYear.balance;
    homeValue *= 1 + rHome;
    rows.push(row);
  }

  // --- Headline numbers ---------------------------------------------------------------
  const first = rows[0];
  const headline = fireNumberFor(startAge, first.balances, inp.annualSpend);
  const breakdown = breakdownAtRetire ?? headline.breakdown;
  const fireNumber = breakdownAtRetire ? fireAtRetire : headline.total;
  const nonCore = breakdown.healthcareBridge + breakdown.mortgagePayoff;
  const grossUpFactor = 1 / (1 - breakdown.effectiveTaxRate);
  const leanFireNumber = (inp.annualSpend * 0.75 * grossUpFactor) / swr + nonCore;
  const fatFireNumber = (inp.annualSpend * 1.5 * grossUpFactor) / swr + nonCore;
  const yearsToSixtyFive = Math.max(0, 65 - startAge);
  const coastFireNumber = headline.total / Math.pow(1 + r, yearsToSixtyFive);

  // --- First-year cash flow -----------------------------------------------------------
  const k401Now = Math.min(wantedK401, k401Limit(startAge));
  const iraScaleNow = wantedIra > 0 ? Math.min(1, iraLimit(startAge) / wantedIra) : 0;
  const tradIraNow = inp.tradIraContrib * iraScaleNow;
  const rothNow = inp.rothIraContrib * iraScaleNow;
  const hsaNow = inp.hsaEnabled ? Math.min(inp.hsaContrib, hsaLimit(inp.hsaCoverage, startAge)) : 0;
  const taxableWages = Math.max(0, inp.salary - k401Now - hsaNow);
  const incomeTaxNow = incomeTax({ ordinary: Math.max(0, taxableWages - tradIraNow), ltcg: 0 }, taxCtx);
  const takeHome = taxableWages - payrollTax(inp.salary - hsaNow, inp.filing) - incomeTaxNow.federal - incomeTaxNow.state;
  const mortgageAnnual = hasMortgage && inp.mortgageBalance > 0 ? inp.mortgagePayment * 12 : 0;
  const leftoverCashFlow = takeHome - tradIraNow - rothNow - inp.brokerageContrib - inp.annualSpend - mortgageAnnual;
  const matchNow = first.employerMatch;
  const savingsRate =
    inp.salary > 0 ? (k401Now + matchNow + tradIraNow + rothNow + hsaNow + inp.brokerageContrib) / (inp.salary + matchNow) : 0;

  if (inp.salary > 0 && leftoverCashFlow < 0) {
    warnings.push({
      id: "cashflow",
      level: "warn",
      text: `Your spending, mortgage and contributions come to ${fmt(-leftoverCashFlow)}/yr more than your estimated take-home pay of ${fmt(takeHome)}.`,
    });
  }
  const magi = Math.max(0, inp.salary - k401Now - hsaNow - tradIraNow);
  const [phaseStart, phaseEnd] = ROTH_PHASEOUT[inp.filing];
  if (inp.rothIraContrib > 0 && magi > phaseStart) {
    warnings.push({
      id: "roth-phaseout",
      level: "info",
      text:
        magi >= phaseEnd
          ? `With an estimated MAGI of ${fmt(magi)}, you're over the Roth IRA income limit. Look into a backdoor Roth (a nondeductible traditional IRA contribution, then convert it to Roth).`
          : `With an estimated MAGI of ${fmt(magi)}, you're in the Roth IRA phase-out range (${fmt(phaseStart)}–${fmt(phaseEnd)}), so your allowed direct contribution is reduced.`,
    });
  }
  if (inp.k401ContribPct < inp.matchUpToPct && inp.matchRate > 0) {
    warnings.push({
      id: "match",
      level: "warn",
      text: `You're leaving employer match on the table. Contributing ${inp.matchUpToPct}% instead of ${inp.k401ContribPct}% would get you the full match.`,
    });
  }
  if (!inp.inflationEnabled && inp.expectedReturn > 8) {
    warnings.push({
      id: "inflation-off",
      level: "info",
      text: "Inflation is off, so your return is treated as a real return. The S&P 500's long-run real return is about 7%. Consider lowering your expected return.",
    });
  }
  if (retireAge !== null && endAge - retireAge > 40 && inp.swr > 3.5) {
    warnings.push({
      id: "swr",
      level: "info",
      text: `Your retirement could last ${endAge - retireAge} years. The 4% rule was studied over 30 years, so a 3.25–3.5% withdrawal rate is a safer choice for very early retirees.`,
    });
  }

  const applies = retireAge !== null && retireAge < PENALTY_FREE_AGE;
  const bridge: BridgeCheck = {
    applies,
    years: applies ? PENALTY_FREE_AGE - retireAge! : 0,
    accessibleAtRetirement,
    neededDuringBridge: bridgeNeed,
    penaltiesPaid: bridgePenalties,
    usesRuleOf55,
    ok: bridgePenalties < 1,
  };

  return {
    rows,
    fireNumber,
    fireBreakdown: breakdown,
    fiAge,
    retireAge,
    investableNow: first.investable,
    netWorthNow: first.netWorth,
    progress: fireNumber > 0 ? first.investable / fireNumber : 0,
    leanFireNumber,
    fatFireNumber,
    coastFireNumber,
    coastReached: first.investable >= coastFireNumber,
    savingsRate,
    takeHome,
    leftoverCashFlow,
    depletionAge,
    endingInvestable: rows[rows.length - 1].investable,
    bridge,
    warnings,
  };
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
