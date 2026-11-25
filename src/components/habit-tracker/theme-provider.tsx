"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { toast } from "sonner";
import { settingsApi, type Settings } from "./api-client";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  settings: Settings | null;
  refreshSettings: () => Promise<void>;
  loadingSettings: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// localStorage mirror — the "never forget" layer.
//
// The server DB is the permanent memory, but the mirror guarantees the app
// ALWAYS opens with the last theme the user picked, instantly (no default
// flash) — even before the server answers or when the request fails. The
// ignore-days mirror is a fallback for the same reason: if the settings
// request fails, the UI keeps exactly what the user left.
// ---------------------------------------------------------------------------
const THEME_KEY = "ht-theme";
const IGNORE_KEY = "ht-ignore-days";

function readStoredTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

function storeTheme(t: Theme) {
  try {
    window.localStorage.setItem(THEME_KEY, t);
  } catch {
    /* private mode — ignore */
  }
}

function readStoredIgnoreDays(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(IGNORE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : null;
  } catch {
    return null;
  }
}

function storeIgnoreDays(days: string[]) {
  try {
    window.localStorage.setItem(IGNORE_KEY, JSON.stringify(days));
  } catch {
    /* private mode — ignore */
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Start from the mirrored theme so there is no default flash. The server
  // value (the same in practice) reconciles right after.
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme() ?? "light");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const applyTheme = useCallback((t: Theme) => {
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, []);

  // Apply on mount too (covers the case where the pre-paint script in
  // layout.tsx hasn't run, e.g. client-side navigation).
  useEffect(() => {
    applyTheme(theme);
  }, [applyTheme, theme]);

  // Persist the theme EVERYWHERE it needs to live:
  //  1. localStorage — synchronous, survives reloads and offline moments
  //  2. server DB   — permanent memory; failures are surfaced via a toast
  // Previously the header toggle only changed local state, which is why the
  // theme "reset to default" on the next launch.
  const persistTheme = useCallback((t: Theme) => {
    storeTheme(t);
    settingsApi
      .update({ theme: t })
      .then((s) => setSettings(s))
      .catch((e) => {
        console.error("Failed to save theme", e);
        toast.error("Theme not saved — check your connection");
      });
  }, []);

  const setTheme = useCallback(
    (t: Theme) => {
      setThemeState(t);
      applyTheme(t);
      persistTheme(t);
    },
    [applyTheme, persistTheme],
  );

  const toggleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : "light");
  }, [setTheme, theme]);

  const refreshSettings = useCallback(async () => {
    try {
      const s = await settingsApi.get();
      setSettings(s);
      storeIgnoreDays(s.ignoreDays);

      // localStorage wins when it differs — it holds the user's most recent
      // choice (a previous server write may have failed mid-flight).
      // Re-sync the server so both memories converge.
      const stored = readStoredTheme();
      const effective: Theme = stored ?? (s.theme as Theme);
      setThemeState(effective);
      applyTheme(effective);
      storeTheme(effective);
      if (stored && stored !== s.theme) {
        settingsApi
          .update({ theme: stored })
          .then((u) => setSettings(u))
          .catch(() => {});
      }
    } catch (e) {
      console.error("Failed to load settings", e);
      // Server unreachable — fall back to the local mirror so ignored days
      // and theme still behave exactly like the user left them.
      const fallbackIgnore = readStoredIgnoreDays();
      if (fallbackIgnore) {
        setSettings((prev) =>
          prev ?? {
            id: "local",
            name: "",
            theme: readStoredTheme() ?? "light",
            ignoreDays: fallbackIgnore,
          },
        );
      }
    } finally {
      setLoadingSettings(false);
    }
  }, [applyTheme]);

  useEffect(() => {
    refreshSettings();
  }, [refreshSettings]);

  return (
    <ThemeContext.Provider
      value={{ theme, setTheme, toggleTheme, settings, refreshSettings, loadingSettings }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
