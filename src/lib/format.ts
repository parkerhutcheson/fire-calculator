const usd0 = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function money(n: number): string {
  return usd0.format(Math.round(n));
}

/** $950, $12.9K, $1.36M */
export function moneyCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e4) return `${sign}$${(abs / 1e3).toFixed(0)}K`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `${sign}$${Math.round(abs)}`;
}

/** Axis ticks: $0, $500K, $1.5M, $12M */
export function moneyTick(n: number): string {
  if (Math.abs(n) >= 1e6) return `$${Number((n / 1e6).toFixed(2))}M`;
  if (Math.abs(n) >= 1e3) return `$${Number((n / 1e3).toFixed(1))}K`;
  return `$${n}`;
}

export function percent(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function groupDigits(n: number, maxDecimals: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: maxDecimals });
}
