"use client";

import { useMemo } from "react";
import { project } from "@/lib/engine";
import { moneyCompact } from "@/lib/format";
import { type ThemeChoice, useCurrentYear, useInputs, useTheme } from "@/lib/storage";
import { InputsPanel } from "./InputsPanel";
import { Results } from "./Results";

const THEME_NEXT: Record<ThemeChoice, ThemeChoice> = { system: "light", light: "dark", dark: "system" };
const THEME_LABEL: Record<ThemeChoice, string> = { system: "🖥️ System", light: "☀️ Light", dark: "🌙 Dark" };

export function Calculator() {
  const { inputs, update, reset, hydrated } = useInputs();
  const { choice, resolved, setChoice } = useTheme();
  const currentYear = useCurrentYear();
  const result = useMemo(() => project(inputs), [inputs]);

  const future = inputs.inflationEnabled && inputs.showFutureDollars;
  const retireRow = result.rows.find((r) => r.age === result.retireAge) ?? result.rows[0];
  const headline = future ? result.fireNumber * retireRow.inflationFactor : result.fireNumber;

  return (
    <div className={`transition-opacity duration-200 ${hydrated ? "opacity-100" : "opacity-0"}`}>
      <div className="mx-auto grid max-w-7xl grid-cols-1 lg:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
        {/* Inputs */}
        <aside className="border-line px-4 pt-6 sm:px-8 lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-r lg:pb-10">
          <header className="mb-4">
            <div className="flex items-center justify-end gap-2">
              <div className="flex gap-1 text-xs text-ink-2">
                <button
                  type="button"
                  onClick={() => setChoice(THEME_NEXT[choice])}
                  className="rounded-md px-2 py-1 hover:bg-bg-hover"
                  aria-label={`Theme: ${choice}. Click to change.`}
                >
                  {THEME_LABEL[choice]}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Reset all inputs to the defaults?")) reset();
                  }}
                  className="rounded-md px-2 py-1 hover:bg-bg-hover"
                >
                  ↺ Reset
                </button>
              </div>
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">FIRE Calculator</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-2">
              Financial Independence, Retire Early. Fill in what applies to you; results update as you type and are saved in this browser.
            </p>
          </header>
          <InputsPanel inputs={inputs} update={update} result={result} />
        </aside>

        {/* Results */}
        <main className="px-4 pt-10 pb-28 sm:px-8 lg:px-12 lg:pt-14 lg:pb-12">
          <Results inputs={inputs} result={result} theme={resolved} currentYear={currentYear} />
        </main>
      </div>

      {/* Mobile summary bar */}
      <a
        href="#results"
        className="fixed inset-x-3 bottom-3 z-20 flex items-center justify-between gap-3 rounded-xl border border-line bg-bg/95 px-4 py-3 shadow-lg backdrop-blur lg:hidden"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <div>
          <div className="text-[11px] text-ink-3">FIRE number</div>
          <div className="text-lg font-bold tabular">{moneyCompact(headline)}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-ink-3">{result.fiAge === null ? "Status" : "FIRE age"}</div>
          <div className="text-lg font-bold tabular">{result.fiAge === null ? "Not reached" : result.fiAge}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-ink-3">Progress</div>
          <div className="text-lg font-bold tabular">{Math.round(Math.min(result.progress, 9.99) * 100)}%</div>
        </div>
      </a>
    </div>
  );
}
