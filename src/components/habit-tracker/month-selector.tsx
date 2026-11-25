"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Copy } from "lucide-react";
import { MONTH_NAMES, monthsApi, type MonthListItem, type MonthData } from "./api-client";
import { toast } from "sonner";

interface MonthSelectorProps {
  months: MonthListItem[];
  currentMonth: MonthData | null;
  onSelect: (id: string) => void;
  onMonthsChanged: () => void;
}

export function MonthSelector({
  months,
  currentMonth,
  onSelect,
  onMonthsChanged,
}: MonthSelectorProps) {
  const [newMonth, setNewMonth] = useState<number>(new Date().getMonth() + 1);
  const [newYear, setNewYear] = useState<number>(new Date().getFullYear());
  const [cloneHabits, setCloneHabits] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // The month Select renders only after mount. Radix computes its internal
  // content id with useId during hydration, and React 19's hydration pass
  // encodes that id differently than SSR — which caused a recoverable
  // hydration error (full client re-render) on EVERY app open. Rendering the
  // trigger post-mount with an identical-size SSR placeholder removes the
  // mismatch entirely; the placeholder is visually the same, so there is no
  // layout shift.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // default new month = next month after current
  useEffect(() => {
    if (currentMonth) {
      const next = new Date(currentMonth.year, currentMonth.month, 1); // month is 1-12, Date month is 0-11; using currentMonth.month directly = next month
      setNewMonth(((next.getMonth() + 1) % 12) || 12);
      setNewYear(next.getMonth() === 11 ? next.getFullYear() + 1 : next.getFullYear());
    }
  }, [currentMonth]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const created = await monthsApi.create({
        month: newMonth,
        year: newYear,
        cloneFromId: cloneHabits && currentMonth ? currentMonth.id : undefined,
      });
      toast.success(`Created ${MONTH_NAMES[newMonth - 1]} ${newYear}`);
      await onMonthsChanged();
      onSelect(created.id);
      setDialogOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create month";
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!currentMonth) return;
    try {
      await monthsApi.remove(currentMonth.id);
      toast.success(`Deleted ${MONTH_NAMES[currentMonth.month - 1]} ${currentMonth.year}`);
      setDeleteOpen(false);
      await onMonthsChanged();
      // pick first remaining month
      const remaining = await monthsApi.list();
      if (remaining.length > 0) onSelect(remaining[0].id);
    } catch (e) {
      toast.error("Failed to delete month");
      console.error(e);
    }
  };

  const years: number[] = [];
  const currentYear = new Date().getFullYear();
  for (let y = currentYear - 2; y <= currentYear + 5; y++) years.push(y);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-2">
        {/* Month list dropdown — rendered post-mount (see mounted note above) */}
        {mounted ? (
          <Select
            value={currentMonth?.id || ""}
            onValueChange={(v) => onSelect(v)}
          >
            <SelectTrigger className="min-w-[200px] h-9 bg-card">
              <SelectValue placeholder="Select month" />
            </SelectTrigger>
            <SelectContent>
              {months.length === 0 && (
                <SelectItem value="__none__" disabled>
                  No months yet
                </SelectItem>
              )}
              {months.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {MONTH_NAMES[m.month - 1]} {m.year}
                  {m.habitCount ? ` · ${m.habitCount} habits` : ""}
                  {m.mealCount ? ` · ${m.mealCount} meals` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div
            aria-hidden="true"
            className="min-w-[200px] h-9 rounded-md border border-input bg-card animate-pulse"
          />
        )}
      </div>

      <Button
        variant="outline"
        size="sm"
        className="h-9"
        onClick={() => setDialogOpen(true)}
      >
        <Plus className="size-4 mr-1" /> New Month
      </Button>

      {currentMonth && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 text-muted-foreground hover:text-destructive"
          onClick={() => setDeleteOpen(true)}
          title="Delete this month"
        >
          <Trash2 className="size-4" />
        </Button>
      )}

      {/* New Month dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Create New Month</DialogTitle>
            <DialogDescription>
              Start tracking fresh habits, meals & goals for a new month. You can copy your habit & meal lists from the current month or start empty.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Month</Label>
                <Select value={String(newMonth)} onValueChange={(v) => setNewMonth(Number(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_NAMES.map((m, i) => (
                      <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Year</Label>
                <Select value={String(newYear)} onValueChange={(v) => setNewYear(Number(v))}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {currentMonth && (
              <div className="flex items-center justify-between rounded-md border p-3">
                <div className="flex items-start gap-2">
                  <Copy className="size-4 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Copy habits &amp; meals from current month</p>
                    <p className="text-xs text-muted-foreground">
                      Brings your {currentMonth.habits.length} habits and {currentMonth.meals?.length ?? 0} meals into the new month (without the tick marks).
                    </p>
                  </div>
                </div>
                <Switch checked={cloneHabits} onCheckedChange={setCloneHabits} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating…" : "Create Month"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Delete Month</DialogTitle>
            <DialogDescription>
              Delete {currentMonth ? `${MONTH_NAMES[currentMonth.month - 1]} ${currentMonth.year}` : "this month"} and all its habits & tick marks? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
