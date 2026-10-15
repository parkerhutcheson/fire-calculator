"use client";

import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Account, YearRow } from "@/lib/engine";
import { money, moneyTick } from "@/lib/format";

// Categorical slots validated for CVD separation on white (#ffffff) and Notion dark (#191919).
const PALETTE: Record<"light" | "dark", Record<Account, string>> = {
  light: { k401: "#2a78d6", tradIra: "#eb6834", roth: "#1baf7a", hsa: "#eda100", brokerage: "#e87ba4", cash: "#008300" },
  dark: { k401: "#3987e5", tradIra: "#d95926", roth: "#199e70", hsa: "#c98500", brokerage: "#d55181", cash: "#008300" },
};

const SURFACE = { light: "#ffffff", dark: "#191919" };
const INK = { light: "#37352f", dark: "rgba(255,255,255,0.86)" };
const MUTED = { light: "#9b9a97", dark: "rgba(255,255,255,0.4)" };
const GRID = { light: "rgba(55,53,47,0.09)", dark: "rgba(255,255,255,0.08)" };

export const ACCOUNT_LABELS: Record<Account, string> = {
  k401: "401(k)",
  tradIra: "Traditional IRA",
  roth: "Roth IRA",
  hsa: "HSA",
  brokerage: "Brokerage",
  cash: "Cash",
};

interface Props {
  rows: YearRow[];
  accounts: Account[];
  retireAge: number | null;
  theme: "light" | "dark";
  toDisplay: (value: number, row: YearRow) => number;
}

type Datum = { age: number; fire: number } & Record<Account, number>;

export function BalanceChart({ rows, accounts, retireAge, theme, toDisplay }: Props) {
  const colors = PALETTE[theme];
  const data: Datum[] = rows.map((row) => {
    const d = { age: row.age, fire: toDisplay(row.fireNumber, row) } as Datum;
    for (const a of accounts) d[a] = toDisplay(row.balances[a], row);
    return d;
  });

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2">
        {accounts.map((a) => (
          <li key={a} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: colors[a] }} aria-hidden />
            {ACCOUNT_LABELS[a]}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="h-0.5 w-3.5 rounded-full" style={{ background: INK[theme] }} aria-hidden />
          FIRE number
        </li>
      </ul>
      <div className="h-72 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID[theme]} />
            <XAxis
              dataKey="age"
              tick={{ fill: MUTED[theme], fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: GRID[theme] }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v: number) => moneyTick(v)}
              tick={{ fill: MUTED[theme], fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip
              cursor={{ stroke: MUTED[theme], strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as Datum;
                const total = accounts.reduce((s, a) => s + d[a], 0);
                return (
                  <div className="min-w-48 rounded-lg border border-line bg-bg px-3 py-2 text-xs shadow-lg">
                    <div className="mb-1.5 font-semibold text-ink">Age {label}</div>
                    {[...accounts].reverse().map((a) => (
                      <div key={a} className="flex items-center justify-between gap-4 py-0.5 text-ink-2">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-sm" style={{ background: colors[a] }} />
                          {ACCOUNT_LABELS[a]}
                        </span>
                        <span className="tabular text-ink">{money(d[a])}</span>
                      </div>
                    ))}
                    <div className="mt-1.5 flex justify-between gap-4 border-t border-line pt-1.5 font-medium text-ink">
                      <span>Total</span>
                      <span className="tabular">{money(total)}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-ink-2">
                      <span>FIRE number</span>
                      <span className="tabular">{money(d.fire)}</span>
                    </div>
                  </div>
                );
              }}
            />
            {accounts.map((a) => (
              <Area
                key={a}
                type="monotone"
                dataKey={a}
                stackId="balances"
                stroke={SURFACE[theme]}
                strokeWidth={1.5}
                fill={colors[a]}
                fillOpacity={0.9}
                isAnimationActive={false}
                activeDot={false}
              />
            ))}
            <Line
              type="monotone"
              dataKey="fire"
              stroke={INK[theme]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, stroke: SURFACE[theme], strokeWidth: 2, fill: INK[theme] }}
              isAnimationActive={false}
            />
            {retireAge !== null && (
              <ReferenceLine
                x={retireAge}
                stroke={MUTED[theme]}
                label={{ value: `Retire at ${retireAge}`, position: "insideTopLeft", fill: MUTED[theme], fontSize: 12 }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
