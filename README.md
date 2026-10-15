# 🔥 FIRE Calculator

A detailed, US-focused Financial Independence / Retire Early calculator. Results update live as you type, and inputs are saved in your browser's `localStorage`. There's no account and no database.

## What it models

- **Accounts:** 401(k) with employer match, Traditional IRA, Roth IRA (with contribution basis), HSA, taxable brokerage (with cost basis and expense ratio) and cash.
- **2026 IRS limits:** 401(k) $24,500 (+$8,000 catch-up at 50, $11,250 at 60–63), IRA $7,500 (+$1,100), HSA $4,400 / $8,750 (+$1,000 at 55), and the §415(c) total. Contributions over a limit are capped and flagged.
- **Taxes:** 2026 federal brackets, standard deduction and long-term capital gains brackets for Single or Married Filing Jointly, plus a flat state rate. The FIRE number is grossed up for taxes on withdrawals.
- **Mortgage:** amortized monthly. The remaining balance is added to the FIRE number, payments stop once it's paid off, and home equity counts toward net worth only.
- **Healthcare:** extra pre-Medicare (ACA/COBRA) cost from retirement until 65, paid from the HSA first.
- **Inflation (optional):** everything runs in today's dollars using real returns. You can switch the display to future dollars.
- **Drawdown:** a year-by-year withdrawal order (cash → brokerage → Roth basis → pre-tax) with the 10% early-withdrawal penalty before 59½ and the Rule of 55 for 401(k)s.
- **Pre-59½ bridge check:** shows whether early-retirement years can be covered without penalties, and suggests a Roth ladder, 72(t) or the Rule of 55 if not.
- **Extras:** Coast, Lean and Fat FIRE numbers, savings rate, take-home pay and leftover cash flow, plus a year-by-year table.

Not included: Social Security (so results are conservative) and randomized market returns (Monte Carlo).

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # engine unit tests (Vitest)
npm run lint
```

The calculation logic is in `src/lib/` (`engine.ts`, `tax.ts`, `constants.ts`) and is free of UI code. Update `constants.ts` each year when the IRS publishes new figures.

## Deploying on Render

Create a **Web Service** with build command `npm install && npm run build` and start command `npm start`. Next.js reads Render's `PORT` automatically.
