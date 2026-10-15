"use client";

import { type ReactNode, useState } from "react";
import { ACCOUNTS, type Result, type YearRow } from "@/lib/engine";
import { money, moneyCompact, percent } from "@/lib/format";
import type { Inputs } from "@/lib/inputs";
import { BalanceChart } from "./BalanceChart";

interface Props {
  inputs: Inputs;
  result: Result;
  theme: "light" | "dark";
  currentYear: number | null;
}

export function Results({ inputs, result, theme, currentYear }: Props) {
  const future = inputs.inflationEnabled && inputs.showFutureDollars;
  const toDisplay = (value: number, row: YearRow) => (future ? value * row.inflationFactor : value);
  const retireRow = result.rows.find((r) => r.age === result.retireAge) ?? result.rows[0];
  const at = (value: number) => toDisplay(value, retireRow);

  const yearsToFi = result.fiAge !== null ? result.fiAge - inputs.currentAge : null;
  const accounts = ACCOUNTS.filter((a) => a !== "hsa" || inputs.hsaEnabled).filter((a) =>
    result.rows.some((r) => r.balances[a] > 0),
  );
  const b = result.fireBreakdown;
  const [chartRange, setChartRange] = useState<"focus" | "lifetime">("focus");
  const focusEnd = (result.retireAge ?? inputs.currentAge + 30) + 15;
  const chartRows = chartRange === "focus" ? result.rows.filter((r) => r.age <= focusEnd) : result.rows;

  return (
    <div className="space-y-8">
      {/* Headline */}
      <section id="results" className="scroll-mt-4">
        <p className="text-sm text-ink-2">Your FIRE number</p>
        <p className="mt-1 text-5xl font-bold tracking-tight tabular sm:text-6xl">{money(at(result.fireNumber))}</p>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
          {result.fiAge === null ? (
            <>
              You don&apos;t reach financial independence by age {inputs.lifeExpectancy} with these numbers. Try saving more, spending less, or
              using a later target.
            </>
          ) : yearsToFi === 0 ? (
            <>
              <span className="font-semibold text-good">You&apos;re already financially independent.</span> Your investments cover your spending.
            </>
          ) : (
            <>
              You could reach financial independence at <span className="font-semibold text-ink">age {result.fiAge}</span>, in{" "}
              {yearsToFi} {yearsToFi === 1 ? "year" : "years"}
              {currentYear !== null && <> ({currentYear + yearsToFi!})</>}.
            </>
          )}
          {inputs.retireMode === "target" && result.retireAge !== null && (
            <> You&apos;re planning to retire at {result.retireAge}.</>
          )}
        </p>
        <Progress value={result.progress} />
        <p className="mt-1.5 text-xs text-ink-3 tabular">
          {money(result.investableNow)} invested today · {percent(Math.min(result.progress, 9.99))} of the way there
        </p>
        {future && <p className="mt-2 text-xs text-ink-3">Amounts are in future (inflated) dollars.</p>}
      </section>

      {/* Longevity callout */}
      {result.retireAge !== null &&
        (result.depletionAge !== null ? (
          <Callout tone="bad" icon="⚠️" title={`Money runs out at age ${result.depletionAge}`}>
            If you retire at {result.retireAge}, your investments run out {inputs.lifeExpectancy - result.depletionAge} years before age{" "}
            {inputs.lifeExpectancy}.
          </Callout>
        ) : (
          <Callout tone="good" icon="✅" title={`Your money lasts past age ${inputs.lifeExpectancy}`}>
            If you retire at {result.retireAge}, you&apos;d still have about {moneyCompact(toDisplay(result.endingInvestable, result.rows.at(-1)!))}{" "}
            at {inputs.lifeExpectancy}
            {future ? "" : " in today's dollars"}.
          </Callout>
        ))}

      {/* Stat tiles */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
        <Stat label="Net worth" value={moneyCompact(result.netWorthNow)} sub="Including home equity" />
        <Stat label="Savings rate" value={percent(result.savingsRate)} sub="Including employer match" />
        <Stat
          label="Coast FIRE"
          value={moneyCompact(result.coastFireNumber)}
          sub={result.coastReached ? "✓ Reached: you could stop saving and still FIRE by 65" : "Enough to stop saving and still FIRE by 65"}
        />
        <Stat label="Lean FIRE" value={moneyCompact(at(result.leanFireNumber))} sub="At 75% of your spending" />
        <Stat label="Fat FIRE" value={moneyCompact(at(result.fatFireNumber))} sub="At 150% of your spending" />
        <Stat
          label="Leftover cash flow"
          value={moneyCompact(result.leftoverCashFlow)}
          sub={`Per year, from ~${moneyCompact(result.takeHome)} take-home`}
          tone={result.leftoverCashFlow < 0 ? "bad" : undefined}
        />
      </section>

      {/* Chart */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Your accounts over time</h2>
          <div role="radiogroup" aria-label="Chart range" className="flex rounded-md bg-bg-soft p-0.5 text-xs">
            {(
              [
                ["focus", "Through FIRE + 15 yrs"],
                ["lifetime", "Lifetime"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={chartRange === value}
                onClick={() => setChartRange(value)}
                className={`rounded-[5px] px-2.5 py-1 transition-colors ${
                  chartRange === value ? "bg-bg font-medium text-ink ring-1 ring-line" : "text-ink-2 hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <BalanceChart rows={chartRows} accounts={accounts} retireAge={result.retireAge} theme={theme} toDisplay={toDisplay} />
      </section>

      {/* Breakdown */}
      <section>
        <H2>How your FIRE number is calculated</H2>
        <dl className="divide-y divide-line rounded-lg border border-line text-sm">
          <Row label={`Spending ÷ ${inputs.swr}% withdrawal rate`} value={money(at(b.coreSpend))} />
          <Row label={`Taxes on withdrawals (~${percent(b.effectiveTaxRate, 1)} effective rate)`} value={money(at(b.taxGrossUp))} />
          <Row
            label={`Healthcare until Medicare at 65 (${Math.max(0, 65 - (result.retireAge ?? inputs.currentAge))} yrs)`}
            value={money(at(b.healthcareBridge))}
          />
          <Row label="Mortgage left to pay at retirement" value={money(at(b.mortgagePayoff))} />
          <Row label="FIRE number" value={money(at(result.fireNumber))} strong />
        </dl>
        <p className="mt-2 text-xs leading-relaxed text-ink-3">
          The tax estimate assumes you draw from every account in proportion to its balance, using 2026 federal brackets, the standard
          deduction, long-term capital gains rates and your state rate. Roth and HSA withdrawals are tax-free.
        </p>
      </section>

      {/* Bridge check */}
      <BridgeSection result={result} at={at} />

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <section className="space-y-2">
          <H2>Things to check</H2>
          {result.warnings.map((w) => (
            <Callout key={w.id} tone={w.level === "warn" ? "warn" : "info"} icon={w.level === "warn" ? "⚠️" : "💡"}>
              {w.text}
            </Callout>
          ))}
        </section>
      )}

      <YearTable rows={result.rows} toDisplay={toDisplay} currentYear={currentYear} />

      <p className="pb-4 text-xs leading-relaxed text-ink-3">
        For education only, not financial advice. The projection uses one steady average return, so it doesn&apos;t capture
        sequence-of-returns risk. Social Security isn&apos;t included, which makes these results conservative. Your inputs are saved only in this
        browser.
      </p>
    </div>
  );
}

function BridgeSection({ result, at }: { result: Result; at: (n: number) => number }) {
  const br = result.bridge;
  if (result.retireAge === null) return null;
  if (!br.applies) {
    return (
      <Callout tone="info" icon="🌉" title="Pre-59½ bridge: not needed">
        You retire at {result.retireAge}, after retirement accounts open up penalty-free at 59½.
      </Callout>
    );
  }
  return (
    <section>
      <H2>Pre-59½ bridge check</H2>
      <Callout
        tone={br.ok ? "good" : "warn"}
        icon={br.ok ? "✅" : "🌉"}
        title={br.ok ? "Your early years are covered without penalties" : `About ${money(at(br.penaltiesPaid))} in early-withdrawal penalties`}
      >
        <p>
          Retiring at {result.retireAge} means about {br.years} years before you can touch your 401(k) and traditional IRA without the 10%
          penalty. Over that stretch you need about <b>{moneyCompact(at(br.neededDuringBridge))}</b>. When you retire you&apos;ll have{" "}
          <b>{moneyCompact(at(br.accessibleAtRetirement))}</b> you can reach: cash, brokerage, Roth contributions
          {br.usesRuleOf55 ? ", plus your 401(k) through the Rule of 55" : ""}.
        </p>
        {!br.ok && (
          <p className="mt-2">
            Ways to close the gap: put more into your brokerage account, start a <b>Roth conversion ladder</b> (each conversion can be withdrawn
            penalty-free after 5 years), take <b>72(t) SEPP</b> payments, or retire in or after the year you turn 55 so the{" "}
            <b>Rule of 55</b> covers your 401(k).
          </p>
        )}
      </Callout>
    </section>
  );
}

function YearTable({
  rows,
  toDisplay,
  currentYear,
}: {
  rows: YearRow[];
  toDisplay: (v: number, row: YearRow) => number;
  currentYear: number | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1 text-lg font-semibold hover:bg-bg-hover"
      >
        <svg viewBox="0 0 12 12" className={`size-3 text-ink-3 transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>
          <path d="M4 2.5 8 6l-4 3.5z" fill="currentColor" />
        </svg>
        Year-by-year table
      </button>
      {open && (
        <div className="mt-3 max-h-[32rem] overflow-auto rounded-lg border border-line">
          <table className="w-full min-w-[56rem] text-right text-sm tabular">
            <thead className="sticky top-0 bg-bg-soft text-xs text-ink-2">
              <tr>
                {["Age", "Year", "Phase", "Salary", "Saved + match", "Withdrawn", "Taxes + penalty", "Invested", "FIRE number", "Net worth"].map(
                  (h, idx) => (
                    <th key={h} className={`px-3 py-2 font-medium ${idx < 3 ? "text-left" : ""}`}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const d = (v: number) => (v ? moneyCompact(toDisplay(v, r)) : "—");
                return (
                  <tr key={r.age} className={r.shortfall > 1 ? "bg-bad-bg" : "hover:bg-bg-hover"}>
                    <td className="px-3 py-1.5 text-left">{r.age}</td>
                    <td className="px-3 py-1.5 text-left text-ink-2">{currentYear !== null ? currentYear + r.yearIndex : `+${r.yearIndex}`}</td>
                    <td className="px-3 py-1.5 text-left text-ink-2">{r.retired ? "Retired" : "Working"}</td>
                    <td className="px-3 py-1.5">{d(r.salary)}</td>
                    <td className="px-3 py-1.5">{d(r.contributions + r.employerMatch)}</td>
                    <td className="px-3 py-1.5">{d(r.grossWithdrawal)}</td>
                    <td className="px-3 py-1.5">{d(r.taxes + r.penalty)}</td>
                    <td className="px-3 py-1.5 font-medium">{d(r.investable)}</td>
                    <td className="px-3 py-1.5 text-ink-2">{d(r.fireNumber)}</td>
                    <td className="px-3 py-1.5">{d(r.netWorth)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Progress({ value }: { value: number }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div
      className="mt-5 h-2 overflow-hidden rounded-full bg-accent-soft"
      role="progressbar"
      aria-valuenow={Math.round(v * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progress toward your FIRE number"
    >
      <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${v * 100}%` }} />
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "bad" }) {
  return (
    <div className="bg-bg p-3.5 sm:p-4">
      <div className="text-xs text-ink-2">{label}</div>
      <div className={`mt-1 text-xl font-semibold tabular ${tone === "bad" ? "text-bad" : ""}`}>{value}</div>
      <div className="mt-0.5 text-xs leading-snug text-ink-3">{sub}</div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 px-3.5 py-2.5 ${strong ? "bg-bg-soft font-semibold" : ""}`}>
      <dt className={strong ? "" : "text-ink-2"}>{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

function H2({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-lg font-semibold">{children}</h2>;
}

const TONES = {
  good: "bg-good-bg",
  warn: "bg-warn-bg",
  bad: "bg-bad-bg",
  info: "bg-info-bg",
};

function Callout({ tone, icon, title, children }: { tone: keyof typeof TONES; icon: string; title?: string; children: ReactNode }) {
  return (
    <div className={`flex gap-3 rounded-lg px-4 py-3 text-sm leading-relaxed ${TONES[tone]}`}>
      <span className="text-base leading-6" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">
        {title && <div className="font-semibold">{title}</div>}
        <div className="text-ink-2 [&_b]:font-semibold [&_b]:text-ink">{children}</div>
      </div>
    </div>
  );
}
