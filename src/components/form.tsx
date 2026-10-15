"use client";

import { type ReactNode, useId, useState } from "react";
import { groupDigits } from "@/lib/format";

export function Section({
  icon,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  icon: string;
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md px-2 py-3 text-left transition-colors hover:bg-bg-hover"
      >
        <svg
          viewBox="0 0 12 12"
          className={`size-3 shrink-0 text-ink-3 transition-transform ${open ? "rotate-90" : ""}`}
          aria-hidden
        >
          <path d="M4 2.5 8 6l-4 3.5z" fill="currentColor" />
        </svg>
        <span className="text-lg leading-none" aria-hidden>
          {icon}
        </span>
        <span className="font-semibold">{title}</span>
        {summary && !open && <span className="ml-auto truncate text-sm text-ink-3 tabular">{summary}</span>}
      </button>
      {open && <div className="space-y-4 pb-5 pl-7 pt-1">{children}</div>}
    </section>
  );
}

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs leading-relaxed text-ink-3">{hint}</p>}
    </div>
  );
}

interface NumberInputProps {
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  decimals?: number;
  id?: string;
}

/** Text input that formats with commas when idle and updates live while typing. */
export function NumberInput({ value, onChange, prefix, suffix, min = 0, max, decimals = 0, id }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? groupDigits(value, decimals);

  return (
    <div className="flex h-9 items-center rounded-md border border-line bg-bg px-2.5 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-soft hover:border-line-strong">
      {prefix && <span className="mr-1 text-ink-3">{prefix}</span>}
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        className="w-full min-w-0 bg-transparent text-[15px] outline-none tabular"
        value={shown}
        onFocus={(e) => {
          setDraft(String(value));
          requestAnimationFrame(() => e.target.select());
        }}
        onBlur={() => setDraft(null)}
        onChange={(e) => {
          const text = e.target.value.replace(/[^0-9.\-]/g, "");
          setDraft(text);
          const n = Number.parseFloat(text);
          if (Number.isFinite(n)) {
            const clamped = Math.max(min, max === undefined ? n : Math.min(max, n));
            onChange(clamped);
          } else if (text === "") {
            onChange(Math.max(min, 0));
          }
        }}
      />
      {suffix && <span className="ml-1 shrink-0 text-ink-3">{suffix}</span>}
    </div>
  );
}

export function MoneyField(props: { label: string; hint?: ReactNode; value: number; onChange: (n: number) => void; suffix?: string }) {
  const id = useId();
  return (
    <Field label={props.label} hint={props.hint} htmlFor={id}>
      <NumberInput id={id} prefix="$" value={props.value} onChange={props.onChange} suffix={props.suffix} />
    </Field>
  );
}

export function PercentField(props: {
  label: string;
  hint?: ReactNode;
  value: number;
  onChange: (n: number) => void;
  max?: number;
  decimals?: number;
  slider?: { min: number; max: number; step: number };
}) {
  const id = useId();
  return (
    <Field label={props.label} hint={props.hint} htmlFor={id}>
      <div className="flex items-center gap-3">
        {props.slider && (
          <input
            type="range"
            aria-label={props.label}
            className="h-9 min-w-0 flex-1"
            min={props.slider.min}
            max={props.slider.max}
            step={props.slider.step}
            value={props.value}
            onChange={(e) => props.onChange(Number(e.target.value))}
          />
        )}
        <div className={props.slider ? "w-24 shrink-0" : "w-full"}>
          <NumberInput
            id={id}
            suffix="%"
            value={props.value}
            onChange={props.onChange}
            max={props.max ?? 100}
            decimals={props.decimals ?? 2}
          />
        </div>
      </div>
    </Field>
  );
}

export function AgeField(props: { label: string; hint?: ReactNode; value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  const id = useId();
  return (
    <Field label={props.label} hint={props.hint} htmlFor={id}>
      <NumberInput id={id} value={props.value} onChange={props.onChange} min={props.min ?? 0} max={props.max ?? 120} suffix="yrs" />
    </Field>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm text-ink">
          {label}
        </label>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-accent" : "bg-line-strong"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-4" : ""}`}
          />
        </button>
      </div>
      {hint && <p className="mt-1 text-xs leading-relaxed text-ink-3">{hint}</p>}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <Field label={label}>
      <div role="radiogroup" aria-label={label} className="flex rounded-md bg-bg-soft p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-[5px] px-2 py-1.5 text-sm transition-colors ${
              value === o.value ? "bg-bg font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)] ring-1 ring-line" : "text-ink-2 hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>;
}
