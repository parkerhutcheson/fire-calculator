"use client";

import { LIMITS, hsaLimit, iraLimit, k401Limit } from "@/lib/constants";
import type { Result } from "@/lib/engine";
import { money, moneyCompact } from "@/lib/format";
import type { Inputs } from "@/lib/inputs";
import { AgeField, Grid, MoneyField, PercentField, Section, Segmented, Toggle } from "./form";

interface Props {
  inputs: Inputs;
  update: <K extends keyof Inputs>(key: K, value: Inputs[K]) => void;
  result: Result;
}

export function InputsPanel({ inputs: i, update, result }: Props) {
  const set =
    <K extends keyof Inputs>(key: K) =>
    (value: Inputs[K]) =>
      update(key, value);

  const k401Employee = Math.min(i.salary * (i.k401ContribPct / 100), k401Limit(i.currentAge));
  const match = result.rows[0]?.employerMatch ?? 0;
  const payoffRow = result.rows.find((r) => r.mortgageBalance <= 0.5);
  const monthlyInterest = i.mortgageBalance * (i.mortgageRate / 100 / 12);
  const realReturn = i.inflationEnabled ? ((1 + i.expectedReturn / 100) / (1 + i.inflationRate / 100) - 1) * 100 : i.expectedReturn;

  return (
    <div>
      <Section icon="👤" title="About you" defaultOpen summary={`Age ${i.currentAge} · ${i.filing === "mfj" ? "Married" : "Single"}`}>
        <Grid>
          <AgeField label="Current age" value={i.currentAge} onChange={set("currentAge")} min={16} max={90} />
          <AgeField
            label="Plan until age"
            value={i.lifeExpectancy}
            onChange={set("lifeExpectancy")}
            min={i.currentAge + 1}
            hint="How long your money needs to last. 90–95 is a cautious choice."
          />
        </Grid>
        <Segmented
          label="Tax filing status"
          value={i.filing}
          onChange={set("filing")}
          options={[
            { value: "single", label: "Single" },
            { value: "mfj", label: "Married filing jointly" },
          ]}
        />
        <PercentField
          label="State income tax rate"
          value={i.stateTaxRate}
          onChange={set("stateTaxRate")}
          max={15}
          hint="Use 0% for states with no income tax (TX, FL, WA, NV, TN, SD, WY, AK, NH)."
        />
        <Segmented
          label="When do you want to retire?"
          value={i.retireMode}
          onChange={set("retireMode")}
          options={[
            { value: "auto", label: "As soon as I hit FIRE" },
            { value: "target", label: "At a specific age" },
          ]}
        />
        {i.retireMode === "target" && (
          <AgeField
            label="Target retirement age"
            value={i.targetRetireAge}
            onChange={set("targetRetireAge")}
            min={i.currentAge}
            max={i.lifeExpectancy}
            hint="See whether your money lasts if you stop working at this age."
          />
        )}
      </Section>

      <Section icon="💼" title="Income & 401(k)" defaultOpen summary={`${moneyCompact(i.salary)}/yr · ${moneyCompact(i.k401Balance)} in 401(k)`}>
        <Grid>
          <MoneyField label="Gross salary" value={i.salary} onChange={set("salary")} suffix="/yr" />
          <PercentField
            label="Annual raise"
            value={i.salaryGrowth}
            onChange={set("salaryGrowth")}
            max={20}
            hint={i.inflationEnabled ? "Raises above inflation increase your real savings." : undefined}
          />
        </Grid>
        <MoneyField label="Current 401(k) balance" value={i.k401Balance} onChange={set("k401Balance")} />
        <PercentField
          label="Your contribution"
          value={i.k401ContribPct}
          onChange={set("k401ContribPct")}
          slider={{ min: 0, max: 50, step: 1 }}
          hint={`${money(k401Employee)}/yr · 2026 limit ${money(k401Limit(i.currentAge))}${
            i.currentAge >= 50 ? " incl. catch-up" : ""
          }`}
        />
        <Grid>
          <PercentField
            label="Employer match"
            value={i.matchRate}
            onChange={set("matchRate")}
            max={200}
            hint="e.g. 50% means they add $0.50 per $1 you put in"
          />
          <PercentField label="…on up to" value={i.matchUpToPct} onChange={set("matchUpToPct")} max={100} hint="% of your salary" />
        </Grid>
        <p className="rounded-md bg-bg-soft px-3 py-2 text-sm text-ink-2">
          Employer adds <span className="font-medium text-ink tabular">{money(match)}</span>/yr. Assumes traditional (pre-tax) 401(k)
          contributions.
        </p>
      </Section>

      <Section
        icon="🏦"
        title="IRAs"
        summary={`${moneyCompact(i.tradIraBalance + i.rothIraBalance)} · ${moneyCompact(i.tradIraContrib + i.rothIraContrib)}/yr`}
      >
        <p className="text-xs text-ink-3">
          Combined Traditional + Roth IRA limit for 2026: {money(iraLimit(i.currentAge))}
          {i.currentAge >= 50 ? " (incl. catch-up)" : ""}.
        </p>
        <Grid>
          <MoneyField label="Traditional IRA balance" value={i.tradIraBalance} onChange={set("tradIraBalance")} />
          <MoneyField label="Traditional IRA contribution" value={i.tradIraContrib} onChange={set("tradIraContrib")} suffix="/yr" />
          <MoneyField label="Roth IRA balance" value={i.rothIraBalance} onChange={set("rothIraBalance")} />
          <MoneyField label="Roth IRA contribution" value={i.rothIraContrib} onChange={set("rothIraContrib")} suffix="/yr" />
        </Grid>
        <MoneyField
          label="Roth contributions to date (basis)"
          value={i.rothIraBasis}
          onChange={set("rothIraBasis")}
          hint="What you've put into your Roth over the years, not counting growth. You can withdraw this at any age with no tax or penalty, which helps before 59½."
        />
      </Section>

      <Section icon="🩺" title="HSA" summary={i.hsaEnabled ? `${moneyCompact(i.hsaBalance)} · ${moneyCompact(i.hsaContrib)}/yr` : "Off"}>
        <Toggle label="I have an HSA" checked={i.hsaEnabled} onChange={set("hsaEnabled")} />
        {i.hsaEnabled && (
          <>
            <Segmented
              label="HDHP coverage"
              value={i.hsaCoverage}
              onChange={set("hsaCoverage")}
              options={[
                { value: "self", label: `Self-only (${money(LIMITS.hsaSelf)})` },
                { value: "family", label: `Family (${money(LIMITS.hsaFamily)})` },
              ]}
            />
            <Grid>
              <MoneyField label="HSA balance" value={i.hsaBalance} onChange={set("hsaBalance")} />
              <MoneyField
                label="Annual contribution"
                value={i.hsaContrib}
                onChange={set("hsaContrib")}
                suffix="/yr"
                hint={`Include employer contributions. Limit ${money(hsaLimit(i.hsaCoverage, i.currentAge))}.`}
              />
            </Grid>
            <p className="text-xs leading-relaxed text-ink-3">
              In retirement, your HSA pays healthcare costs tax-free first. After 65 it can be withdrawn for anything, taxed like a
              traditional IRA.
            </p>
          </>
        )}
      </Section>

      <Section icon="📈" title="Brokerage & cash" summary={`${moneyCompact(i.brokerageBalance + i.cashBalance)}`}>
        <Grid>
          <MoneyField label="Brokerage balance" value={i.brokerageBalance} onChange={set("brokerageBalance")} />
          <MoneyField label="Annual contribution" value={i.brokerageContrib} onChange={set("brokerageContrib")} suffix="/yr" />
          <MoneyField
            label="Cost basis"
            value={i.brokerageBasis}
            onChange={set("brokerageBasis")}
            hint="What you paid in. Only the gains are taxed when you sell."
          />
          <PercentField
            label="Expense ratio"
            value={i.brokerageExpenseRatio}
            onChange={set("brokerageExpenseRatio")}
            max={3}
            decimals={3}
            hint="Total-market index funds charge around 0.03%."
          />
        </Grid>
        <Grid>
          <MoneyField label="Cash & savings" value={i.cashBalance} onChange={set("cashBalance")} />
          <PercentField label="Savings yield (APY)" value={i.cashYield} onChange={set("cashYield")} max={15} />
        </Grid>
      </Section>

      <Section icon="🧾" title="Spending" defaultOpen summary={`${moneyCompact(i.annualSpend)}/yr`}>
        <MoneyField
          label="Annual spending (not counting mortgage)"
          value={i.annualSpend}
          onChange={set("annualSpend")}
          suffix="/yr"
          hint="Everything you spend in a year in today's dollars, including property tax and insurance but not your mortgage principal and interest. Your mortgage is handled separately and drops off once it's paid off."
        />
        <MoneyField
          label="Extra healthcare before Medicare"
          value={i.preMedicareHealthcare}
          onChange={set("preMedicareHealthcare")}
          suffix="/yr"
          hint="Your extra cost for ACA or COBRA coverage after you leave your job, until Medicare starts at 65."
        />
      </Section>

      <Section
        icon="🏠"
        title="Home & mortgage"
        summary={i.hasMortgage ? `${moneyCompact(i.mortgageBalance)} owed` : i.homeValue > 0 ? `${moneyCompact(i.homeValue)} home` : "None"}
      >
        <Toggle label="I have a mortgage" checked={i.hasMortgage} onChange={set("hasMortgage")} />
        <Grid>
          <MoneyField
            label="Home value"
            value={i.homeValue}
            onChange={set("homeValue")}
            hint="Counts toward net worth, not your FIRE number. You can't spend your house."
          />
          <PercentField label="Home appreciation" value={i.homeAppreciation} onChange={set("homeAppreciation")} max={15} />
        </Grid>
        {i.hasMortgage && (
          <>
            <Grid>
              <MoneyField label="Mortgage balance" value={i.mortgageBalance} onChange={set("mortgageBalance")} />
              <PercentField label="Interest rate" value={i.mortgageRate} onChange={set("mortgageRate")} max={20} decimals={3} />
            </Grid>
            <MoneyField
              label="Monthly payment (principal + interest)"
              value={i.mortgagePayment}
              onChange={set("mortgagePayment")}
              suffix="/mo"
              hint={
                <>
                  ~{money(monthlyInterest)}/mo is interest right now.{" "}
                  {payoffRow ? `Paid off around age ${payoffRow.age}.` : "Not paid off within your plan."}
                </>
              }
            />
          </>
        )}
      </Section>

      <Section icon="🧮" title="Other net worth" summary={`${moneyCompact(i.otherAssets - i.otherDebts)}`}>
        <Grid>
          <MoneyField label="Other assets" value={i.otherAssets} onChange={set("otherAssets")} hint="Cars, collectibles, a business, etc." />
          <MoneyField label="Other debts" value={i.otherDebts} onChange={set("otherDebts")} hint="Car loans, student loans, credit cards." />
        </Grid>
        <p className="text-xs text-ink-3">These count toward net worth only, not your FIRE number.</p>
      </Section>

      <Section
        icon="⚙️"
        title="Assumptions"
        defaultOpen
        summary={`${i.expectedReturn}% return · ${i.inflationEnabled ? `${i.inflationRate}% inflation` : "no inflation"} · ${i.swr}% SWR`}
      >
        <PercentField
          label="Expected annual return"
          value={i.expectedReturn}
          onChange={set("expectedReturn")}
          slider={{ min: 0, max: 15, step: 0.5 }}
          hint={
            i.inflationEnabled
              ? `The S&P 500 has averaged about 10%/yr since 1926. After inflation that's about ${realReturn.toFixed(1)}%/yr in real terms.`
              : "Inflation is off, so this is a real return. The S&P 500's long-run real return is about 7%."
          }
        />
        <Toggle
          label="Account for inflation"
          checked={i.inflationEnabled}
          onChange={set("inflationEnabled")}
          hint="Spending, tax brackets and contribution limits keep pace with inflation. Your mortgage payment doesn't, so it gets cheaper in real terms."
        />
        {i.inflationEnabled && (
          <>
            <PercentField
              label="Inflation rate"
              value={i.inflationRate}
              onChange={set("inflationRate")}
              slider={{ min: 0, max: 8, step: 0.25 }}
              hint="US CPI has averaged about 3% since 1926."
            />
            <Segmented
              label="Show amounts in"
              value={i.showFutureDollars ? "future" : "today"}
              onChange={(v) => update("showFutureDollars", v === "future")}
              options={[
                { value: "today", label: "Today's dollars" },
                { value: "future", label: "Future dollars" },
              ]}
            />
          </>
        )}
        <PercentField
          label="Safe withdrawal rate"
          value={i.swr}
          onChange={set("swr")}
          slider={{ min: 2.5, max: 6, step: 0.05 }}
          hint="The 4% rule: withdraw 4% the first year, then adjust for inflation. FIRE number = spending ÷ SWR."
        />
      </Section>
    </div>
  );
}
