import { describe, expect, it } from "vitest";
import { drawFrom, project } from "./engine";
import { DEFAULT_INPUTS, type Inputs } from "./inputs";
import { incomeTax } from "./tax";

const base = (over: Partial<Inputs> = {}): Inputs => ({ ...DEFAULT_INPUTS, ...over });

describe("incomeTax", () => {
  const ctx = { filing: "single" as const, stateRate: 0 };

  it("is zero under the standard deduction", () => {
    expect(incomeTax({ ordinary: 16_100, ltcg: 0 }, ctx).total).toBe(0);
  });

  it("applies 2026 single brackets", () => {
    // $66,100 ordinary → $50,000 taxable: 10% of 12,400 + 12% of 37,600
    expect(incomeTax({ ordinary: 66_100, ltcg: 0 }, ctx).federal).toBeCloseTo(1_240 + 4_512, 2);
  });

  it("taxes gains at 0% inside the bottom LTCG bracket", () => {
    expect(incomeTax({ ordinary: 0, ltcg: 60_000 }, ctx).federal).toBe(0);
  });

  it("stacks gains on top of ordinary income", () => {
    // $50,000 taxable ordinary is already past the 0% LTCG band ($49,450), so gains are all 15%
    const t = incomeTax({ ordinary: 66_100, ltcg: 10_000 }, ctx);
    const ordinaryOnly = incomeTax({ ordinary: 66_100, ltcg: 0 }, ctx);
    expect(t.federal - ordinaryOnly.federal).toBeCloseTo(10_000 * 0.15, 2);
  });

  it("adds the 10% early-withdrawal penalty", () => {
    expect(incomeTax({ ordinary: 0, ltcg: 0, penalized: 10_000 }, ctx).penalty).toBe(1_000);
  });
});

describe("drawFrom", () => {
  const ctx = { filing: "single" as const, stateRate: 0.05 };

  it("covers a tax-free need exactly from cash", () => {
    const r = drawFrom(
      [{ key: "cash", available: 100_000, ordinary: false, gainFrac: 0, penalized: false }],
      40_000,
      ctx,
    );
    expect(r.gross).toBeCloseTo(40_000, 2);
    expect(r.tax).toBe(0);
  });

  it("grosses up traditional withdrawals for tax", () => {
    const r = drawFrom(
      [{ key: "k401", available: 1_000_000, ordinary: true, gainFrac: 0, penalized: false }],
      60_000,
      ctx,
    );
    expect(r.gross - r.tax).toBeCloseTo(60_000, 0);
    expect(r.gross).toBeGreaterThan(60_000);
  });

  it("reports a shortfall when sources run dry", () => {
    const r = drawFrom(
      [{ key: "cash", available: 10_000, ordinary: false, gainFrac: 0, penalized: false }],
      40_000,
      ctx,
    );
    expect(r.shortfall).toBeCloseTo(30_000, 2);
  });
});

describe("project", () => {
  it("produces one row per year through life expectancy", () => {
    const r = project(base({ currentAge: 30, lifeExpectancy: 90 }));
    expect(r.rows).toHaveLength(61);
    expect(r.rows[0].age).toBe(30);
  });

  it("FIRE number with no taxes, healthcare or mortgage is spend / SWR", () => {
    const r = project(
      base({
        stateTaxRate: 0,
        preMedicareHealthcare: 0,
        hasMortgage: false,
        homeValue: 0,
        k401Balance: 0,
        tradIraBalance: 0,
        k401ContribPct: 0,
        matchRate: 0,
        annualSpend: 40_000,
        swr: 4,
      }),
    );
    // Only Roth/HSA/brokerage gains could be taxed; gains fall in the 0% bracket here.
    expect(r.fireNumber).toBeCloseTo(1_000_000, -2);
  });

  it("finds FI immediately when already over the number", () => {
    const r = project(base({ cashBalance: 10_000_000 }));
    expect(r.fiAge).toBe(30);
    expect(r.depletionAge).toBeNull();
  });

  it("retires earlier with higher savings", () => {
    const low = project(base({ brokerageContrib: 0 }));
    const high = project(base({ brokerageContrib: 30_000 }));
    expect(high.fiAge!).toBeLessThan(low.fiAge!);
  });

  it("caps 401(k) contributions at the IRS limit", () => {
    const r = project(base({ salary: 500_000, k401ContribPct: 50, matchRate: 0 }));
    expect(r.warnings.some((w) => w.id === "k401-limit")).toBe(true);
    const first = r.rows[0];
    expect(first.contributions).toBeLessThan(500_000 * 0.5);
  });

  it("flags penalties when an early retiree only has pre-tax money", () => {
    const r = project(
      base({
        retireMode: "target",
        targetRetireAge: 40,
        k401Balance: 2_000_000,
        rothIraBalance: 0,
        rothIraBasis: 0,
        brokerageBalance: 0,
        brokerageBasis: 0,
        cashBalance: 0,
        hsaBalance: 0,
      }),
    );
    expect(r.bridge.applies).toBe(true);
    expect(r.bridge.ok).toBe(false);
    expect(r.bridge.penaltiesPaid).toBeGreaterThan(0);
  });

  it("uses the Rule of 55 to avoid penalties on the 401(k)", () => {
    const r = project(
      base({
        currentAge: 55,
        retireMode: "target",
        targetRetireAge: 55,
        k401Balance: 3_000_000,
        brokerageBalance: 0,
        brokerageBasis: 0,
        cashBalance: 0,
      }),
    );
    expect(r.bridge.usesRuleOf55).toBe(true);
    expect(r.bridge.penaltiesPaid).toBe(0);
  });

  it("reports when money runs out", () => {
    const r = project(base({ retireMode: "target", targetRetireAge: 30, annualSpend: 200_000 }));
    expect(r.depletionAge).not.toBeNull();
  });

  it("disabling inflation leaves the inflation factor at 1", () => {
    const r = project(base({ inflationEnabled: false }));
    expect(r.rows.at(-1)!.inflationFactor).toBe(1);
  });

  it("pays the mortgage off over time", () => {
    const r = project(base());
    const at61 = r.rows.find((row) => row.age === 61)!;
    expect(at61.mortgageBalance).toBe(0);
  });
});
