// 2026 US federal figures (IRS Rev. Proc. 2025-32 and Notice 2025-67).
// The engine works in today's dollars, so these stay fixed across the projection,
// which approximates the IRS indexing them to inflation each year.

export type FilingStatus = "single" | "mfj";

export interface Bracket {
  /** Upper bound of taxable income for this rate (Infinity for the top bracket). */
  upTo: number;
  rate: number;
}

export const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 16_100,
  mfj: 32_200,
};

export const ORDINARY_BRACKETS: Record<FilingStatus, Bracket[]> = {
  single: [
    { upTo: 12_400, rate: 0.1 },
    { upTo: 50_400, rate: 0.12 },
    { upTo: 105_700, rate: 0.22 },
    { upTo: 201_775, rate: 0.24 },
    { upTo: 256_225, rate: 0.32 },
    { upTo: 640_600, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  mfj: [
    { upTo: 24_800, rate: 0.1 },
    { upTo: 100_800, rate: 0.12 },
    { upTo: 211_400, rate: 0.22 },
    { upTo: 403_550, rate: 0.24 },
    { upTo: 512_450, rate: 0.32 },
    { upTo: 768_700, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
};

/** Long-term capital gains brackets, keyed on total taxable income. */
export const LTCG_BRACKETS: Record<FilingStatus, Bracket[]> = {
  single: [
    { upTo: 49_450, rate: 0 },
    { upTo: 545_500, rate: 0.15 },
    { upTo: Infinity, rate: 0.2 },
  ],
  mfj: [
    { upTo: 98_900, rate: 0 },
    { upTo: 613_700, rate: 0.15 },
    { upTo: Infinity, rate: 0.2 },
  ],
};

export const LIMITS = {
  k401: 24_500,
  k401CatchUp50: 8_000,
  /** SECURE 2.0 "super catch-up" for ages 60–63 (replaces the regular catch-up). */
  k401CatchUp60to63: 11_250,
  /** §415(c) total of employee + employer additions. */
  k401Total: 72_000,
  ira: 7_500,
  iraCatchUp50: 1_100,
  hsaSelf: 4_400,
  hsaFamily: 8_750,
  hsaCatchUp55: 1_000,
};

/** Roth IRA direct-contribution MAGI phase-out ranges. */
export const ROTH_PHASEOUT: Record<FilingStatus, [number, number]> = {
  single: [153_000, 168_000],
  mfj: [242_000, 252_000],
};

export const FICA = {
  ssRate: 0.062,
  ssWageBase: 184_500,
  medicareRate: 0.0145,
  addlMedicareRate: 0.009,
  addlMedicareThreshold: { single: 200_000, mfj: 250_000 } as Record<FilingStatus, number>,
};

export const PENALTY_FREE_AGE = 59.5;
export const RULE_OF_55_AGE = 55;
export const MEDICARE_AGE = 65;
export const EARLY_WITHDRAWAL_PENALTY = 0.1;

export function k401Limit(age: number): number {
  if (age >= 60 && age <= 63) return LIMITS.k401 + LIMITS.k401CatchUp60to63;
  if (age >= 50) return LIMITS.k401 + LIMITS.k401CatchUp50;
  return LIMITS.k401;
}

export function iraLimit(age: number): number {
  return age >= 50 ? LIMITS.ira + LIMITS.iraCatchUp50 : LIMITS.ira;
}

export function hsaLimit(coverage: "self" | "family", age: number): number {
  const base = coverage === "family" ? LIMITS.hsaFamily : LIMITS.hsaSelf;
  return age >= 55 ? base + LIMITS.hsaCatchUp55 : base;
}
