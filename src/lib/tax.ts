import {
  type Bracket,
  type FilingStatus,
  EARLY_WITHDRAWAL_PENALTY,
  FICA,
  LTCG_BRACKETS,
  ORDINARY_BRACKETS,
  STANDARD_DEDUCTION,
} from "./constants";

function taxOnBrackets(taxable: number, brackets: Bracket[]): number {
  let tax = 0;
  let floor = 0;
  for (const { upTo, rate } of brackets) {
    if (taxable <= floor) break;
    tax += (Math.min(taxable, upTo) - floor) * rate;
    floor = upTo;
  }
  return tax;
}

export interface TaxInput {
  /** Wages, traditional 401(k)/IRA withdrawals, and other ordinary income. */
  ordinary: number;
  /** Realized long-term capital gains. */
  ltcg: number;
  /** Amount subject to the 10% early-withdrawal penalty. */
  penalized?: number;
}

export interface TaxContext {
  filing: FilingStatus;
  stateRate: number;
}

export function incomeTax({ ordinary, ltcg, penalized = 0 }: TaxInput, ctx: TaxContext) {
  const deduction = STANDARD_DEDUCTION[ctx.filing];
  const ordinaryTaxable = Math.max(0, ordinary - deduction);
  // Leftover deduction offsets gains before they are taxed.
  const gainsTaxable = Math.max(0, ltcg - Math.max(0, deduction - ordinary));

  const federalOrdinary = taxOnBrackets(ordinaryTaxable, ORDINARY_BRACKETS[ctx.filing]);
  // Gains stack on top of ordinary income in the LTCG brackets.
  const ltcgBrackets = LTCG_BRACKETS[ctx.filing];
  const federalGains =
    taxOnBrackets(ordinaryTaxable + gainsTaxable, ltcgBrackets) -
    taxOnBrackets(ordinaryTaxable, ltcgBrackets);

  const state = (ordinaryTaxable + gainsTaxable) * ctx.stateRate;
  const penalty = penalized * EARLY_WITHDRAWAL_PENALTY;
  return {
    federal: federalOrdinary + federalGains,
    state,
    penalty,
    total: federalOrdinary + federalGains + state + penalty,
  };
}

export function payrollTax(wages: number, filing: FilingStatus): number {
  const ss = Math.min(wages, FICA.ssWageBase) * FICA.ssRate;
  const medicare = wages * FICA.medicareRate;
  const addl = Math.max(0, wages - FICA.addlMedicareThreshold[filing]) * FICA.addlMedicareRate;
  return ss + medicare + addl;
}
