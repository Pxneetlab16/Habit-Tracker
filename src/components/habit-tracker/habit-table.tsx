"use client";

import { useMemo, useState } from "react";
import { GripVertical, Plus } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  daysInMonth,
  weekdayOfDay,
  weekIndexForDay,
  visibleDaysInMonth,
  WEEK_COLORS,
  WEEKDAY_SHORT,
  type HabitData,
  type MonthData,
  checkmarksApi,
  habitsApi,
} from "./api-client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface HabitTableProps {
  month: MonthData;
  ignoreDays: string[];
  onToggleCheckmark: (habitId: string, day: number, done: boolean) => void;
  onEditHabit: (habit: HabitData) => void;
  onAddHabit: () => void;
  onEditGoal: (habit: HabitData) => void;
  // Called after a new order was saved on the server (parent reloads the month).
  onReordered?: () => Promise<void> | void;
}

export function HabitTable({
  month,
  ignoreDays,
  onToggleCheckmark,
  onEditHabit,
  onAddHabit,
  onEditGoal,
  onReordered,
}: HabitTableProps) {
  const totalDays = daysInMonth(month.month, month.year);

  // Visible days = all days minus ignored weekdays. Ignored days are REMOVED entirely.
  // Shared helper — the same source of truth used by the stats bar, the chart
  // and the full-month goal, so ignore-days propagate everywhere consistently.
  const visibleDays = useMemo(
    () => visibleDaysInMonth(month.month, month.year, ignoreDays),
    [month.month, month.year, ignoreDays],
  );

  // Full-month goal for EVERY habit: all visible days of this month
  // (e.g. October → 31, November → 30; minus any ignored weekdays).
  const monthGoal = visibleDays.length;

  // ---- Drag & drop reorder -------------------------------------------------
  const sensors = useSensors(
    // Pointer covers mouse AND touch; a small activation distance means
    // clicks and scrolls are never mistaken for drags.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Optimistic order (habit ids) while a drag/save is in flight.
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [reordering, setReordering] = useState(false);

  const habits = useMemo(() => {
    const base = month.habits;
    if (!localOrder) return base;
    const map = new Map(base.map((h) => [h.id, h]));
    const ordered = localOrder
      .map((id) => map.get(id))
      .filter((h): h is HabitData => Boolean(h));
    base.forEach((h) => {
      if (!localOrder.includes(h.id)) ordered.push(h);
    });
    return ordered;
  }, [month.habits, localOrder]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || reordering) return;
    const oldIndex = habits.findIndex((h) => h.id === active.id);
    const newIndex = habits.findIndex((h) => h.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(habits, oldIndex, newIndex);
    const orderedIds = reordered.map((h) => h.id);
    setLocalOrder(orderedIds); // optimistic — table shows the new order at once
    setReordering(true);
    try {
      await habitsApi.reorder(orderedIds);
      if (onReordered) await onReordered(); // parent fetches the saved order
      setLocalOrder(null); // safe to fall back to props now
      toast.success("Order saved");
    } catch (e) {
      setLocalOrder(null); // revert to the server order
      toast.error("Couldn't save the new order");
      console.error(e);
    } finally {
      setReordering(false);
    }
  };
  // --------------------------------------------------------------------------

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* DndContext renders hidden aria-live <div> announcements, so it must
          live OUTSIDE the <table> (a <div> inside <table> is invalid HTML).
          Only the SortableContext needs to sit near the rows. */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: 720 }}>
          {/* ===== Week group header row ===== */}
          <thead>
            <tr>
              <th
                colSpan={3}
                className="sticky left-0 z-20 bg-card border-b border-r px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground"
                style={{ minWidth: 220 }}
              >
                Habits
              </th>
              {visibleDays.map((d) => {
                const wd = weekdayOfDay(month.month, month.year, d);
                const w = WEEK_COLORS[weekIndexForDay(month.month, month.year, d)];
                return (
                  <th
                    key={d}
                    className="border-b border-r px-0 text-center text-[10px] font-semibold"
                    style={{ width: 28, minWidth: 28, maxWidth: 28, background: w.bg, color: "var(--foreground)" }}
                    title={`${WEEKDAY_SHORT[wd]} (Week ${weekIndexForDay(month.month, month.year, d) + 1})`}
                  >
                    W{weekIndexForDay(month.month, month.year, d) + 1}
                  </th>
                );
              })}
              <th className="border-b border-r px-2 py-2 text-center text-xs font-bold" style={{ background: "var(--summary-header)" }} title={`Full-month goal — ${monthGoal} visible days (ignored weekdays excluded)`}>Goal</th>
              <th className="border-b border-r px-2 py-2 text-center text-xs font-bold" style={{ background: "var(--summary-header)" }}>Actual</th>
              <th className="border-b px-2 py-2 text-center text-xs font-bold" style={{ background: "var(--summary-header)" }}>Progress</th>
            </tr>

            {/* ===== Date row ===== */}
            <tr>
              <th className="sticky left-0 z-20 bg-card border-b border-r px-2 py-1 text-left text-xs font-semibold" style={{ minWidth: 56 }}>#</th>
              <th className="border-b border-r px-3 py-1 text-left text-xs font-semibold" style={{ minWidth: 160 }}>Daily Habit</th>
              <th className="border-b border-r px-2 py-1 text-left text-xs font-semibold" style={{ minWidth: 130 }}>Category</th>
              {visibleDays.map((d) => {
                const wd = weekdayOfDay(month.month, month.year, d);
                const w = WEEK_COLORS[weekIndexForDay(month.month, month.year, d)];
                return (
                  <th
                    key={d}
                    className="border-b border-r px-0 py-1 text-center text-[10px] font-semibold"
                    style={{ background: w.date, width: 28, minWidth: 28, maxWidth: 28 }}
                    title={`${month.month}/${d}/${month.year} — ${WEEKDAY_SHORT[wd]}`}
                  >
                    {d}
                  </th>
                );
              })}
              <th className="border-b border-r" style={{ background: "var(--summary-header)" }} />
              <th className="border-b border-r" style={{ background: "var(--summary-header)" }} />
              <th className="border-b" style={{ background: "var(--summary-header)" }} />
            </tr>

            {/* ===== Weekday row ===== */}
            <tr>
              <th className="sticky left-0 z-20 bg-card border-b border-r" />
              <th className="border-b border-r" />
              <th className="border-b border-r" />
              {visibleDays.map((d) => {
                const wd = weekdayOfDay(month.month, month.year, d);
                const w = WEEK_COLORS[weekIndexForDay(month.month, month.year, d)];
                return (
                  <th
                    key={d}
                    className="border-b border-r px-0 py-0.5 text-center text-[9px] text-muted-foreground"
                    style={{ background: w.date, width: 28, minWidth: 28, maxWidth: 28 }}
                  >
                    {WEEKDAY_SHORT[wd]}
                  </th>
                );
              })}
              <th className="border-b border-r" style={{ background: "var(--summary-header)" }} />
              <th className="border-b border-r" style={{ background: "var(--summary-header)" }} />
              <th className="border-b" style={{ background: "var(--summary-header)" }} />
            </tr>
          </thead>

          {/* SortableContext renders no DOM nodes, so the table structure
              (table > tbody > tr) stays valid HTML. */}
          <SortableContext
            items={habits.map((h) => h.id)}
            strategy={verticalListSortingStrategy}
          >
            <tbody>
                {habits.length === 0 && (
                  <tr>
                    <td colSpan={3 + visibleDays.length + 3} className="py-12 text-center text-sm text-muted-foreground">
                      No habits yet for this month.
                      <div className="mt-3">
                        <Button size="sm" onClick={onAddHabit}>
                          <Plus className="size-4 mr-1" /> Add your first habit
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}

                {habits.map((h, idx) => {
                  const checkMap = new Map<number, boolean>();
                  h.checkmarks.forEach((c) => checkMap.set(c.day, c.done));
                  const actualDone = visibleDays.filter((d) => checkMap.get(d)).length;
                  // Progress measured against the full-month goal (all visible days).
                  const progress = monthGoal > 0 ? Math.min(1, actualDone / monthGoal) : 0;

                  return (
                    <HabitRow
                      key={h.id}
                      habit={h}
                      index={idx}
                      month={month}
                      visibleDays={visibleDays}
                      checkMap={checkMap}
                      actualDone={actualDone}
                      goal={monthGoal}
                      progress={progress}
                      onToggleCheckmark={onToggleCheckmark}
                      onEditHabit={onEditHabit}
                      onEditGoal={onEditGoal}
                    />
                  );
                })}
              </tbody>
            </SortableContext>
        </table>
      </div>

      <div className="flex items-center justify-between gap-2 border-t p-3 bg-muted/30 flex-wrap">
        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "var(--done-bg)" }} />
            Done
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full border" style={{ background: "var(--empty-cell)", borderColor: "color-mix(in oklab, var(--muted-foreground) 30%, transparent)" }} />
            To Do
          </span>
          {ignoreDays.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-muted">× {ignoreDays.join(", ")}</span>
              removed from every week
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <GripVertical className="size-3" />
            drag to rearrange habits
          </span>
        </div>
        <Button size="sm" variant="outline" onClick={onAddHabit}>
          <Plus className="size-4 mr-1" /> Add Habit
        </Button>
      </div>
      </DndContext>
    </div>
  );
}

interface HabitRowProps {
  habit: HabitData;
  index: number;
  month: MonthData;
  visibleDays: number[];
  checkMap: Map<number, boolean>;
  actualDone: number;
  goal: number;
  progress: number;
  onToggleCheckmark: (habitId: string, day: number, done: boolean) => void;
  onEditHabit: (habit: HabitData) => void;
  onEditGoal: (habit: HabitData) => void;
}

function HabitRow({
  habit,
  index,
  month,
  visibleDays,
  checkMap,
  actualDone,
  goal,
  progress,
  onToggleCheckmark,
  onEditHabit,
  onEditGoal,
}: HabitRowProps) {
  const [busyDay, setBusyDay] = useState<number | null>(null);

  // dnd-kit sortable — only the grip handle activates dragging, so the tick
  // buttons keep working exactly as before.
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: habit.id });

  const toggle = async (day: number, current: boolean) => {
    if (busyDay !== null) return;
    setBusyDay(day);
    const next = !current;
    onToggleCheckmark(habit.id, day, next); // optimistic UI update
    try {
      await checkmarksApi.set({ habitId: habit.id, day, done: next });
    } catch (e) {
      toast.error("Failed to update");
      onToggleCheckmark(habit.id, day, current); // revert
      console.error(e);
    } finally {
      setBusyDay(null);
    }
  };

  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 40 : undefined,
        opacity: isDragging ? 0.85 : undefined,
      }}
      className={"group hover:bg-muted/40 transition-colors" + (isDragging ? " bg-muted/60 shadow-lg" : "")}
    >
      {/* # index + drag handle */}
      <td className="sticky left-0 z-10 bg-card border-b border-r px-1.5 py-1 text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-0.5">
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${habit.name} — drag or use arrow keys`}
            title="Drag to move this habit"
            className="cursor-grab active:cursor-grabbing touch-none rounded p-1 text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <GripVertical className="size-3.5" />
          </button>
          <span className="tabular-nums w-4">{index + 1}</span>
        </div>
      </td>
      {/* habit name (click to edit) */}
      <td className="border-b border-r px-3 py-1 text-sm font-medium">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <button
              onClick={() => onEditHabit(habit)}
              className="text-left hover:underline underline-offset-2"
              title="Click to edit habit"
            >
              {habit.name}
            </button>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => onEditHabit(habit)}>Edit habit…</ContextMenuItem>
            <ContextMenuItem onClick={() => onEditGoal(habit)}>Edit goal…</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </td>
      {/* category */}
      <td className="border-b border-r px-2 py-1 text-xs font-medium whitespace-nowrap">
        {habit.category}
      </td>
      {/* day cells — only for visible (non-ignored) days */}
      {visibleDays.map((d) => {
        const wd = weekdayOfDay(month.month, month.year, d);
        const done = !!checkMap.get(d);
        const w = WEEK_COLORS[weekIndexForDay(month.month, month.year, d)];
        return (
          <td
            key={d}
            className="border-b border-r p-0"
            style={{ background: w.cell, width: 28, minWidth: 28, maxWidth: 28 }}
          >
            <button
              onClick={() => toggle(d, done)}
              disabled={busyDay === d}
              aria-label={`Mark day ${d} as ${done ? "not done" : "done"}`}
              title={`${month.month}/${d} — ${WEEKDAY_SHORT[wd]}`}
              className="h-7 w-full flex items-center justify-center transition-all hover:brightness-95 active:scale-90"
            >
              {done ? (
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke={w.check} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <span
                  className="block rounded-full"
                  style={{
                    width: 10,
                    height: 10,
                    background: "var(--empty-cell)",
                    border: "1px solid color-mix(in oklab, var(--muted-foreground) 30%, transparent)",
                  }}
                />
              )}
            </button>
          </td>
        );
      })}
      {/* Goal — full-month goal (all visible days of this month) */}
      <td
        className="border-b border-r px-2 py-1 text-center text-xs font-semibold"
        style={{ background: "var(--summary-header)" }}
        title="Full-month goal — every visible day of the month"
      >
        {goal}
      </td>
      {/* Actual */}
      <td className="border-b border-r px-2 py-1 text-center text-xs" style={{ background: "var(--summary-header)" }}>
        {actualDone}
      </td>
      {/* Progress with sparkline bar */}
      <td className="border-b px-2 py-1" style={{ background: "var(--summary-header)" }}>
        <div className="flex items-center gap-1.5">
          <div className="ht-bar-track flex-1">
            <div className="ht-bar-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {Math.round(progress * 100)}%
          </span>
        </div>
      </td>
    </tr>
  );
}
