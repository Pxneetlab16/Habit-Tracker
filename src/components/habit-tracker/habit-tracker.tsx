"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Settings as SettingsIcon, Moon, Sun, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "./theme-provider";
import {
  monthsApi,
  bootstrapApi,
  restoreApi,
  type MonthData,
  type MonthListItem,
  type HabitData,
  type MealData,
  type CheckmarkData,
  type MealCheckData,
  type BootstrapData,
  weekdayOfDay,
  visibleDaysInMonth,
  WEEKDAY_SHORT,
} from "./api-client";
import { loadStateMirror, refreshMirrorNow, type StateMirror } from "./state-mirror";
import { MonthSelector } from "./month-selector";
import { StatsBar } from "./stats-bar";
import { DailyProgressChart } from "./daily-progress-chart";
import { HabitTable } from "./habit-table";
import { DietTable } from "./diet-table";
import { SettingsDialog } from "./settings-dialog";
import { HabitEditDialog } from "./habit-edit-dialog";
import { MealEditDialog } from "./meal-edit-dialog";
import { toast } from "sonner";

export function HabitTracker() {
  const { settings, refreshSettings, toggleTheme, loadingSettings } = useTheme();
  const [months, setMonths] = useState<MonthListItem[]>([]);
  const [currentMonth, setCurrentMonth] = useState<MonthData | null>(null);
  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(null);
  const [loadingMonth, setLoadingMonth] = useState(true);

  // Ref mirror of the selection so bootstrap/restore code can read the
  // current selection without stale closures.
  const selectedMonthIdRef = useRef<string | null>(null);
  const selectMonth = useCallback((id: string | null) => {
    selectedMonthIdRef.current = id;
    setSelectedMonthId(id);
  }, []);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [habitDialogOpen, setHabitDialogOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<HabitData | null>(null);
  const [mealDialogOpen, setMealDialogOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<MealData | null>(null);

  // Load months list (after month create/delete — init uses bootstrap).
  const loadMonths = useCallback(async () => {
    const list = await monthsApi.list();
    setMonths(list);
    return list;
  }, []);

  // Map a full bootstrap payload onto the UI state.
  const applyBootstrap = useCallback(
    (boot: BootstrapData) => {
      const list: MonthListItem[] = boot.months.map((m) => ({
        id: m.id,
        month: m.month,
        year: m.year,
        title: m.title,
        habitCount: m.habits.length,
        mealCount: (m.meals ?? []).length,
        createdAt: m.createdAt,
      }));
      setMonths(list);
      const preferred =
        selectedMonthIdRef.current && list.some((x) => x.id === selectedMonthIdRef.current)
          ? selectedMonthIdRef.current
          : list[0]?.id ?? null;
      selectMonth(preferred);
      setCurrentMonth(boot.months.find((m) => m.id === preferred) ?? null);
      // Settings (name/theme/ignore days) may have just been restored from
      // the device backup — re-sync the context from the server.
      void refreshSettings();
      // Keep the device backup current with the latest server state.
      void refreshMirrorNow();
    },
    [refreshSettings, selectMonth],
  );

  // Offline fallback: render straight from the device backup.
  const applyMirror = useCallback(
    (mirror: StateMirror) => {
      const list: MonthListItem[] = mirror.months.map((m) => ({
        id: m.id,
        month: m.month,
        year: m.year,
        title: m.title,
        habitCount: m.habits.length,
        mealCount: (m.meals ?? []).length,
        createdAt: m.createdAt ?? new Date().toISOString(),
      }));
      setMonths(list);
      const preferred =
        selectedMonthIdRef.current && list.some((x) => x.id === selectedMonthIdRef.current)
          ? selectedMonthIdRef.current
          : list[0]?.id ?? null;
      selectMonth(preferred);
      const found = mirror.months.find((m) => m.id === preferred);
      setCurrentMonth(found ? { ...found, meals: found.meals ?? [] } : null);
    },
    [selectMonth],
  );

  // INIT — a single bootstrap request returns the complete state. Before it
  // is used, the device backup (localStorage) is compared against the
  // server's data-version clock: if the backup is NEWER, the server DB was
  // rolled back (crash / workspace restore) and we restore the backup first.
  // If the server is unreachable, the backup is shown instead of an empty app.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingMonth(true);
      try {
        let boot = await bootstrapApi.get();
        const mirror = loadStateMirror();
        const mT = mirror?.serverChangedAt ? Date.parse(mirror.serverChangedAt) : NaN;
        const sT = boot.lastChangedAt ? Date.parse(boot.lastChangedAt) : NaN;
        const backupIsNewer = Number.isFinite(mT) && (!Number.isFinite(sT) || mT > sT);
        if (mirror && backupIsNewer) {
          try {
            await restoreApi.post(mirror);
            if (!cancelled) {
              toast.success("Your data was restored from this device's backup");
            }
            boot = await bootstrapApi.get();
          } catch (err) {
            console.error("Auto-restore failed", err);
            if (!cancelled) {
              toast.error("Could not restore the device backup — showing current server data");
            }
          }
        }
        if (!cancelled) applyBootstrap(boot);
      } catch (err) {
        console.error("Bootstrap failed", err);
        const mirror = loadStateMirror();
        if (!cancelled && mirror) {
          applyMirror(mirror);
          toast.warning("Server unreachable — showing your last saved data from this device");
        } else if (!cancelled) {
          toast.error("Failed to load your data");
        }
      } finally {
        if (!cancelled) setLoadingMonth(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyBootstrap, applyMirror]);

  // Load the selected month's full data (month switching).
  useEffect(() => {
    if (!selectedMonthId) {
      setCurrentMonth(null);
      return;
    }
    // Init/restore already loaded this exact month — skip the duplicate fetch.
    if (currentMonth?.id === selectedMonthId) return;
    setLoadingMonth(true);
    monthsApi
      .get(selectedMonthId)
      .then((m) => setCurrentMonth(m))
      .catch((e) => {
        console.error(e);
        // If the selected month no longer exists (e.g. after a restore),
        // fall back to the first available month instead of an error.
        if (months.length > 0 && months[0].id !== selectedMonthId) {
          selectMonth(months[0].id);
        } else {
          toast.error("Failed to load month");
        }
      })
      .finally(() => setLoadingMonth(false));
  }, [selectedMonthId, currentMonth?.id, months, selectMonth]);

  // Optimistic checkmark toggle
  const handleToggleCheckmark = useCallback(
    (habitId: string, day: number, done: boolean) => {
      setCurrentMonth((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          habits: prev.habits.map((h) => {
            if (h.id !== habitId) return h;
            const existing = h.checkmarks.find((c) => c.day === day);
            let newCheckmarks: CheckmarkData[];
            if (existing) {
              newCheckmarks = h.checkmarks.map((c) =>
                c.day === day ? { ...c, done } : c,
              );
            } else {
              newCheckmarks = [...h.checkmarks, { day, done }];
            }
            return { ...h, checkmarks: newCheckmarks };
          }),
        };
      });
    },
    [],
  );

  // Optimistic meal tick toggle (diet table) — mirrors handleToggleCheckmark.
  const handleToggleMealCheck = useCallback(
    (mealId: string, day: number, done: boolean) => {
      setCurrentMonth((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          meals: (prev.meals ?? []).map((m) => {
            if (m.id !== mealId) return m;
            const existing = m.checks.find((c) => c.day === day);
            let newChecks: MealCheckData[];
            if (existing) {
              newChecks = m.checks.map((c) =>
                c.day === day ? { ...c, done } : c,
              );
            } else {
              newChecks = [...m.checks, { day, done }];
            }
            return { ...m, checks: newChecks };
          }),
        };
      });
    },
    [],
  );

  // After saving a habit (add/edit/delete), reload current month
  const reloadCurrentMonth = useCallback(async () => {
    if (!selectedMonthId) return;
    const m = await monthsApi.get(selectedMonthId);
    setCurrentMonth(m);
    await loadMonths(); // habit count may change
  }, [selectedMonthId, loadMonths]);

  const getCheckMap = useCallback(
    (h: HabitData) => {
      const m = new Map<number, boolean>();
      h.checkmarks.forEach((c) => m.set(c.day, c.done));
      return m;
    },
    [],
  );

  const ignoreDays = settings?.ignoreDays || [];

  // Build daily progress data for chart (only visible days).
  // Uses the shared visible-days helper so ignored weekdays are
  // excluded from the chart exactly like everywhere else.
  const dailyChartData = useMemo(() => {
    if (!currentMonth) return [];
    const visible = visibleDaysInMonth(
      currentMonth.month,
      currentMonth.year,
      ignoreDays,
    );
    if (currentMonth.habits.length === 0) {
      return visible.map((day) => ({
        day,
        progress: 0,
        weekday: WEEKDAY_SHORT[weekdayOfDay(currentMonth.month, currentMonth.year, day)],
        ignored: false,
      }));
    }
    return visible.map((day) => {
      const wd = weekdayOfDay(currentMonth.month, currentMonth.year, day);
      let done = 0;
      currentMonth.habits.forEach((h) => {
        if (getCheckMap(h).get(day)) done++;
      });
      return {
        day,
        progress: done / currentMonth.habits.length,
        weekday: WEEKDAY_SHORT[wd],
        ignored: false,
      };
    });
  }, [currentMonth, ignoreDays, getCheckMap]);

  // Diet chart data — same construction as the habits chart, but over meals.
  // Uses the shared visible-days helper so ignored weekdays are excluded from
  // the diet chart exactly like everywhere else.
  const dailyDietChartData = useMemo(() => {
    if (!currentMonth) return [];
    const meals = currentMonth.meals ?? [];
    const visible = visibleDaysInMonth(
      currentMonth.month,
      currentMonth.year,
      ignoreDays,
    );
    if (meals.length === 0) {
      return visible.map((day) => ({
        day,
        progress: 0,
        weekday: WEEKDAY_SHORT[weekdayOfDay(currentMonth.month, currentMonth.year, day)],
        ignored: false,
      }));
    }
    return visible.map((day) => {
      const wd = weekdayOfDay(currentMonth.month, currentMonth.year, day);
      let done = 0;
      meals.forEach((m) => {
        if ((m.checks ?? []).some((c) => c.day === day && c.done)) done++;
      });
      return {
        day,
        progress: done / meals.length,
        weekday: WEEKDAY_SHORT[wd],
        ignored: false,
      };
    });
  }, [currentMonth, ignoreDays]);

  const openAddHabit = () => {
    setEditingHabit(null);
    setHabitDialogOpen(true);
  };

  const openEditHabit = (h: HabitData) => {
    setEditingHabit(h);
    setHabitDialogOpen(true);
  };

  const openAddMeal = () => {
    setEditingMeal(null);
    setMealDialogOpen(true);
  };

  const openEditMeal = (m: MealData) => {
    setEditingMeal(m);
    setMealDialogOpen(true);
  };

  const monthLabel = currentMonth
    ? `${MONTH_NAMES[currentMonth.month - 1]} ${currentMonth.year}`
    : "—";

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b sticky top-0 z-30 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* PWA logo */}
            <img
              src="/icons/icon-192.png"
              alt="Habit Tracker"
              className="size-11 rounded-xl object-cover ring-1 ring-border shrink-0"
              width={44}
              height={44}
            />
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1
                  className="text-xl sm:text-2xl font-bold tracking-tight leading-none"
                  style={{ fontFamily: "var(--font-geist-sans)" }}
                >
                  SMALL HABITS <span className="text-muted-foreground">·</span> BUILD BIG CHANGES.
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                {settings?.name && settings.name.trim() && settings.name.trim() !== "Habit Tracker"
                  ? `${settings.name.trim()}'s Habit Tracker`
                  : "Habit Tracker"}
                {currentMonth && <> · {monthLabel}</>}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <MonthSelector
              months={months}
              currentMonth={currentMonth}
              onSelect={selectMonth}
              onMonthsChanged={loadMonths}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={toggleTheme}
              title="Toggle theme"
              aria-label="Toggle theme"
            >
              {/* CSS-driven icons — identical on server and client, so
                  hydration never mismatches even when the persisted theme
                  differs from the server default. */}
              <Sun className="size-4 dark:hidden" />
              <Moon className="size-4 hidden dark:block" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setSettingsOpen(true)}
            >
              <SettingsIcon className="size-4 mr-1" /> Settings
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-[1400px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {loadingSettings || loadingMonth ? (
          <div className="rounded-xl border bg-card p-12 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : !currentMonth ? (
          <div className="rounded-xl border bg-card p-12 text-center space-y-3">
            <p className="text-muted-foreground">No month selected. Create your first month to begin tracking.</p>
            <Button onClick={() => {
              // create this month
              const now = new Date();
              monthsApi
                .create({ month: now.getMonth() + 1, year: now.getFullYear() })
                .then(async (m) => {
                  await loadMonths();
                  selectMonth(m.id);
                  toast.success("Created current month");
                })
                .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"));
            }}>
              <Plus className="size-4 mr-1" /> Create current month
            </Button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <StatsBar
              month={currentMonth}
              ignoreDays={ignoreDays}
              getCheckMap={getCheckMap}
            />

            {/* Daily progress area chart */}
            <section className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Daily Progress
                </h2>
                <p className="text-xs text-muted-foreground">
                  % of habits completed each day
                </p>
              </div>
              <DailyProgressChart data={dailyChartData} height={200} />
            </section>

            {/* Habit table */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Habits — {monthLabel}
                </h2>
                <Button size="sm" variant="outline" onClick={openAddHabit}>
                  <Plus className="size-4 mr-1" /> Add Habit
                </Button>
              </div>
              <HabitTable
                month={currentMonth}
                ignoreDays={ignoreDays}
                onToggleCheckmark={handleToggleCheckmark}
                onEditHabit={openEditHabit}
                onAddHabit={openAddHabit}
                onEditGoal={openEditHabit}
                onReordered={reloadCurrentMonth}
              />
            </section>

            {/* Diet daily progress area chart */}
            <section className="rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Diet Daily Progress
                </h2>
                <p className="text-xs text-muted-foreground">
                  % of meals completed each day
                </p>
              </div>
              <DailyProgressChart data={dailyDietChartData} height={200} />
            </section>

            {/* Diet table */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Diet — {monthLabel}
                </h2>
                <Button size="sm" variant="outline" onClick={openAddMeal}>
                  <Plus className="size-4 mr-1" /> Add Meal
                </Button>
              </div>
              <DietTable
                month={currentMonth}
                ignoreDays={ignoreDays}
                onToggleMealCheck={handleToggleMealCheck}
                onEditMeal={openEditMeal}
                onAddMeal={openAddMeal}
                onReordered={reloadCurrentMonth}
              />
            </section>
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-muted/30">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 text-center text-xs text-muted-foreground">
          {settings?.name && settings.name.trim() && settings.name.trim() !== "Habit Tracker"
            ? `${settings.name.trim()}'s Habit Tracker`
            : "Habit Tracker"}{" "}
          · Small habits build big changes.
        </div>
      </footer>

      {/* Dialogs */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <HabitEditDialog
        open={habitDialogOpen}
        onOpenChange={setHabitDialogOpen}
        habit={editingHabit}
        monthId={currentMonth?.id || ""}
        month={currentMonth?.month}
        year={currentMonth?.year}
        ignoreDays={ignoreDays}
        onSaved={reloadCurrentMonth}
        onDeleted={reloadCurrentMonth}
      />
      <MealEditDialog
        open={mealDialogOpen}
        onOpenChange={setMealDialogOpen}
        meal={editingMeal}
        monthId={currentMonth?.id || ""}
        month={currentMonth?.month}
        year={currentMonth?.year}
        ignoreDays={ignoreDays}
        onSaved={reloadCurrentMonth}
        onDeleted={reloadCurrentMonth}
      />
    </div>
  );
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
