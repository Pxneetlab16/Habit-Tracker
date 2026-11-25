"use client";

// Meal add/edit dialog — the exact twin of habit-edit-dialog.tsx for the
// diet table. Adds a meal (breakfast, lunch, dinner…) with a meal-type
// category and the auto-computed full-month goal.

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MEAL_CATEGORIES, monthGoalDays, monthsApi, mealsApi, type MealData } from "./api-client";
import { toast } from "sonner";
import { Trash2, CalendarCheck } from "lucide-react";

interface MealEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: MealData | null; // null = add new
  monthId: string;
  // Needed to auto-compute the full-month goal (visible days of this month).
  month?: number; // 1..12
  year?: number;
  ignoreDays?: string[];
  onSaved: () => void;
  onDeleted?: () => void;
}

export function MealEditDialog({
  open,
  onOpenChange,
  meal,
  monthId,
  month,
  year,
  ignoreDays = [],
  onSaved,
  onDeleted,
}: MealEditDialogProps) {
  const isEdit = !!meal;
  const [name, setName] = useState("");
  const [category, setCategory] = useState(MEAL_CATEGORIES[0]);
  const [saving, setSaving] = useState(false);

  // Full-month goal = every visible day of this month (30/31, minus ignored
  // weekdays). Auto-computed everywhere in the app — no fixed weekly goal.
  const monthGoal =
    month && year ? monthGoalDays(month, year, ignoreDays) : 31;

  useEffect(() => {
    if (meal) {
      setName(meal.name);
      setCategory(meal.category);
    } else {
      setName("");
      setCategory(MEAL_CATEGORIES[0]);
    }
  }, [meal, open]);

  const handleSave = async () => {
    if (!name.trim() || !category) {
      toast.error("Name and meal type are required");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && meal) {
        await mealsApi.update(meal.id, { name: name.trim(), category });
        toast.success("Meal updated");
      } else {
        // monthsApi.addMeal goes through the central fetch wrapper, so the
        // device-backup mirror snapshots right after the change.
        await monthsApi.addMeal(monthId, { name: name.trim(), category, goal: monthGoal });
        toast.success("Meal added");
      }
      onSaved();
      onOpenChange(false);
    } catch (e) {
      toast.error("Failed to save meal");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!meal) return;
    setSaving(true);
    try {
      await mealsApi.remove(meal.id);
      toast.success("Meal deleted");
      onDeleted?.();
      onOpenChange(false);
    } catch (e) {
      toast.error("Failed to delete meal");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Meal" : "Add Meal"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update this meal's name or meal type."
              : "Add a daily meal to track in the diet table this month."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="meal-name">Daily Meal</Label>
            <Input
              id="meal-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Breakfast — oats + eggs"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Meal Type</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {MEAL_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Monthly Goal</Label>
            <div className="flex items-start gap-2.5 rounded-lg border bg-muted/40 p-3">
              <CalendarCheck className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="text-sm">
                <span className="font-semibold tabular-nums">{monthGoal} days</span>
                <span className="text-muted-foreground"> — full month, auto-calculated.</span>
                <p className="text-xs text-muted-foreground mt-1">
                  The goal is always the whole month ({monthGoal} visible days).
                  {ignoreDays.length > 0 && (
                    <>
                      {" "}Ignored weekdays ({ignoreDays.join(", ")}) are excluded.
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className={isEdit ? "sm:justify-between" : ""}>
          {isEdit ? (
            <div className="flex w-full justify-between">
              <Button
                variant="ghost"
                onClick={handleDelete}
                disabled={saving}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="size-4 mr-1" /> Delete
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Add Meal"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
