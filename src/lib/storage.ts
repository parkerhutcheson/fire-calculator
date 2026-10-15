import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_INPUTS, type Inputs } from "./inputs";

// Inputs live in localStorage only. useSyncExternalStore renders defaults on the server
// and during hydration, then switches to the saved values without a mismatch.

const INPUTS_KEY = "fire-calc:inputs:v1";
const THEME_KEY = "fire-calc:theme";

export type ThemeChoice = "system" | "light" | "dark";

const listeners = new Set<() => void>();
const memoryFallback = new Map<string, string | null>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === INPUTS_KEY || e.key === THEME_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function read(key: string): string | null {
  if (memoryFallback.has(key)) return memoryFallback.get(key)!;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Private mode or storage disabled: keep working in memory for this session.
    memoryFallback.set(key, value);
  }
  emit();
}

let cachedRaw: string | null | undefined;
let cachedInputs: Inputs = DEFAULT_INPUTS;

function getInputsSnapshot(): Inputs {
  const raw = read(INPUTS_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      // Merge so fields added in later versions get their defaults.
      cachedInputs = raw ? { ...DEFAULT_INPUTS, ...JSON.parse(raw) } : DEFAULT_INPUTS;
    } catch {
      cachedInputs = DEFAULT_INPUTS;
    }
  }
  return cachedInputs;
}

export function useInputs() {
  const inputs = useSyncExternalStore(subscribe, getInputsSnapshot, () => DEFAULT_INPUTS);
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);

  const update = useCallback(<K extends keyof Inputs>(key: K, value: Inputs[K]) => {
    write(INPUTS_KEY, JSON.stringify({ ...getInputsSnapshot(), [key]: value }));
  }, []);

  const reset = useCallback(() => write(INPUTS_KEY, null), []);

  return { inputs, update, reset, hydrated };
}

function getThemeSnapshot(): ThemeChoice {
  const t = read(THEME_KEY);
  return t === "light" || t === "dark" ? t : "system";
}

function getSystemDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function subscribeSystem(listener: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", listener);
  return () => mq.removeEventListener("change", listener);
}

export function useTheme() {
  const choice = useSyncExternalStore(subscribe, getThemeSnapshot, () => "system" as ThemeChoice);
  const systemDark = useSyncExternalStore(subscribeSystem, getSystemDark, () => false);
  const resolved: "light" | "dark" = choice === "system" ? (systemDark ? "dark" : "light") : choice;

  const setChoice = useCallback((next: ThemeChoice) => {
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    write(THEME_KEY, next === "system" ? null : next);
  }, []);

  return { choice, resolved, setChoice };
}

export function useCurrentYear(): number | null {
  return useSyncExternalStore(subscribe, () => new Date().getFullYear(), () => null);
}
