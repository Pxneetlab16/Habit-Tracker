"use client";

import { useMemo } from "react";
import { Donut } from "./donut";
import {
  visibleDaysInMonth,
  weekIndexForDay,
  type HabitData,
  type MonthData,
} from "./api-client";

interface StatsBarProps {
  month: MonthData;
  ignoreDays: string[];
  // helper: get checkmark map for a habit
  getCheckMap: (h: HabitData) => Map<number, boolean>;
}

function StatCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={"rounded-xl border bg-card p-4 flex flex-col " + (className || "")}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
        {title}
      </p>
      {children}
    </div>
  );
}

export function StatsBar({ month, ignoreDays, getCheckMap }: StatsBarProps) {
  // Visible days = all days of the month minus ignored weekdays.
  // Shared helper — same source of truth as the habit table & chart, so
  // ignore-days propagate to every stat automatically.
  const visibleDays = useMemo(
    () => visibleDaysInMonth(month.month, month.year, ignoreDays),
    [month.month, month.year, ignoreDays],
  );

  const habits = month.habits;

  // Daily progress % for each visible day (count true / count of habits)
  const dailyProgress = useMemo(() => {
    if (habits.length === 0) return [];
    return visibleDays.map((d) => {
      let done = 0;
      habits.forEach((h) => {
        const cm = getCheckMap(h);
        if (cm.get(d)) done++;
      });
      return { day: d, progress: done / habits.length };
    });
  }, [habits, visibleDays, getCheckMap]);

  const dailyAverage = useMemo(() => {
    if (dailyProgress.length === 0) return 0;
    const sum = dailyProgress.reduce((a, b) => a + b.progress, 0);
    return sum / dailyProgress.length;
  }, [dailyProgress]);

  // Your Progress = total ticks of the whole month / full-month goal.
  // Full-month goal = (number of habits) × (visible days of the month),
  // e.g. 12 habits in October → 12 × 31 = 372 (not the old weekly 12 × 7 = 84).
  // Ignored weekdays reduce the goal automatically.
  const { totalActual, totalGoal } = useMemo(() => {
    let actual = 0;
    habits.forEach((h) => {
      const cm = getCheckMap(h);
      visibleDays.forEach((d) => {
        if (cm.get(d)) actual++;
      });
    });
    const goal = habits.length * visibleDays.length;
    return { totalActual: actual, totalGoal: goal };
  }, [habits, visibleDays, getCheckMap]);

  const yourProgress = totalGoal > 0 ? totalActual / totalGoal : 0;

  // Total Progress = total ticks / (habits × visible days)
  const totalPossible = habits.length * visibleDays.length;
  const totalProgress = totalPossible > 0 ? totalActual / totalPossible : 0;

  // Total Weekly Progress = average of weekly completion %.
  // Weeks run Monday→Sunday. Weekly % = ticks in that week / (habits × days in that week).
  const weeklyProgress = useMemo(() => {
    if (habits.length === 0 || visibleDays.length === 0) return 0;
    const byWeek: Record<number, { ticks: number; possible: number }> = {};
    visibleDays.forEach((d) => {
      const wk = weekIndexForDay(month.month, month.year, d);
      if (!byWeek[wk]) byWeek[wk] = { ticks: 0, possible: 0 };
      byWeek[wk].possible += habits.length;
      habits.forEach((h) => {
        if (getCheckMap(h).get(d)) byWeek[wk].ticks++;
      });
    });
    const ratios = Object.values(byWeek).map((w) =>
      w.possible > 0 ? w.ticks / w.possible : 0,
    );
    if (ratios.length === 0) return 0;
    return ratios.reduce((a, b) => a + b, 0) / ratios.length;
  }, [habits, visibleDays, getCheckMap]);

  // Categories used in this month
  const usedCategories = useMemo(() => {
    const set = new Set<string>();
    habits.forEach((h) => set.add(h.category));
    return Array.from(set);
  }, [habits]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {/* Daily Average Progress */}
      <StatCard title="Daily Average Progress" className="xl:col-span-1">
        <div className="flex flex-col items-start justify-center flex-1">
          <p className="text-4xl font-light tabular-nums">
            {Math.round(dailyAverage * 100)}
            <span className="text-2xl text-muted-foreground">%</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">avg daily completion</p>
        </div>
      </StatCard>

      {/* Your Progress donut */}
      <StatCard title="Your Progress" className="xl:col-span-1">
        <div className="flex items-center justify-center gap-3 flex-1">
          <Donut value={yourProgress} color="var(--chart-1)" size={92} thickness={12} />
          <div className="text-right">
            <p className="text-2xl font-light tabular-nums">
              {totalActual}
              <span className="text-base text-muted-foreground"> / {totalGoal}</span>
            </p>
            <p className="text-xs text-muted-foreground">actual / goal</p>
          </div>
        </div>
      </StatCard>

      {/* Total Progress donut */}
      <StatCard title="Total Progress" className="xl:col-span-1">
        <div className="flex items-center justify-center flex-1">
          <Donut
            value={totalProgress}
            color="var(--chart-2)"
            size={92}
            thickness={12}
            centerLabel={`${Math.round(totalProgress * 100)}%`}
          />
        </div>
      </StatCard>

      {/* Total Weekly Progress donut */}
      <StatCard title="Total Weekly Progress" className="xl:col-span-1">
        <div className="flex items-center justify-center flex-1">
          <Donut
            value={weeklyProgress}
            color="var(--chart-4)"
            size={92}
            thickness={12}
            centerLabel={`${Math.round(weeklyProgress * 100)}%`}
          />
        </div>
      </StatCard>

      {/* Habits Categories */}
      <StatCard title="Habits Categories" className="sm:col-span-2 lg:col-span-3 xl:col-span-2">
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
          {usedCategories.length === 0 && (
            <p className="text-xs text-muted-foreground">No categories in use.</p>
          )}
          {usedCategories.map((c) => (
            <span
              key={c}
              className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border bg-secondary/40"
            >
              {c}
            </span>
          ))}
        </div>
      </StatCard>
    </div>
  );
}
