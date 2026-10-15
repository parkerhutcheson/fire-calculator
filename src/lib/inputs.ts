import type { FilingStatus } from "./constants";

/** Everything the form collects. Percent fields are stored as whole percents (7 = 7%). */
export interface Inputs {
  // Profile
  currentAge: number;
  lifeExpectancy: number;
  filing: FilingStatus;
  stateTaxRate: number;
  retireMode: "auto" | "target";
  targetRetireAge: number;

  // Income & 401(k)
  salary: number;
  salaryGrowth: number;
  k401Balance: number;
  k401ContribPct: number;
  matchRate: number;
  matchUpToPct: number;

  // IRAs
  tradIraBalance: number;
  tradIraContrib: number;
  rothIraBalance: number;
  rothIraBasis: number;
  rothIraContrib: number;

  // HSA
  hsaEnabled: boolean;
  hsaCoverage: "self" | "family";
  hsaBalance: number;
  hsaContrib: number;

  // Taxable
  brokerageBalance: number;
  brokerageBasis: number;
  brokerageContrib: number;
  brokerageExpenseRatio: number;
  cashBalance: number;
  cashYield: number;

  // Spending
  annualSpend: number;
  preMedicareHealthcare: number;

  // Home
  hasMortgage: boolean;
  homeValue: number;
  mortgageBalance: number;
  mortgageRate: number;
  mortgagePayment: number;
  homeAppreciation: number;

  // Other net worth
  otherAssets: number;
  otherDebts: number;

  // Assumptions
  expectedReturn: number;
  inflationEnabled: boolean;
  inflationRate: number;
  swr: number;
  showFutureDollars: boolean;
}

export const DEFAULT_INPUTS: Inputs = {
  currentAge: 30,
  lifeExpectancy: 95,
  filing: "single",
  stateTaxRate: 5,
  retireMode: "auto",
  targetRetireAge: 50,

  salary: 125_000,
  salaryGrowth: 3,
  k401Balance: 50_000,
  k401ContribPct: 10,
  matchRate: 50,
  matchUpToPct: 6,

  tradIraBalance: 0,
  tradIraContrib: 0,
  rothIraBalance: 20_000,
  rothIraBasis: 15_000,
  rothIraContrib: 7_500,

  hsaEnabled: true,
  hsaCoverage: "self",
  hsaBalance: 5_000,
  hsaContrib: 4_400,

  brokerageBalance: 25_000,
  brokerageBasis: 20_000,
  brokerageContrib: 6_000,
  brokerageExpenseRatio: 0.05,
  cashBalance: 15_000,
  cashYield: 4,

  annualSpend: 38_000,
  preMedicareHealthcare: 7_000,

  hasMortgage: true,
  homeValue: 400_000,
  mortgageBalance: 300_000,
  mortgageRate: 6.5,
  mortgagePayment: 1_896,
  homeAppreciation: 3.5,

  otherAssets: 15_000,
  otherDebts: 0,

  expectedReturn: 10,
  inflationEnabled: true,
  inflationRate: 3,
  swr: 4,
  showFutureDollars: false,
};
