"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "./theme-provider";
import { settingsApi, WEEKDAY_NAMES } from "./api-client";
import { getLastBackupAt } from "./state-mirror";
import { toast } from "sonner";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings, refreshSettings, theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [ignoreDays, setIgnoreDays] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  // Sync local fields when the dialog OPENS (not on every settings refresh —
  // otherwise an instant-save refresh while typing would clobber the name).
  useEffect(() => {
    if (open && settings) {
      setName(settings.name);
      setIgnoreDays(settings.ignoreDays);
    }
    if (open) setLastBackup(getLastBackupAt());
  }, [open, settings]);

  // Ignore-days save INSTANTLY — no Save button needed, so "what you ignored
  // stays ignored" can never be lost by closing the dialog early.
  const toggleDay = async (day: string) => {
    const wasIgnored = ignoreDays.includes(day);
    const next = wasIgnored ? ignoreDays.filter((d) => d !== day) : [...ignoreDays, day];
    setIgnoreDays(next); // optimistic
    try {
      await settingsApi.update({ ignoreDays: next });
      await refreshSettings(); // sync context + localStorage mirror
      toast.success(
        wasIgnored ? `${day} is visible again — saved` : `${day} ignored — saved`,
      );
    } catch (e) {
      setIgnoreDays(ignoreDays); // revert on failure
      toast.error(`Could not save ${day} — please try again`);
      console.error(e);
    }
  };

  // Only the name needs the Save button (theme & ignore-days save instantly).
  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.update({ name: name.trim() || "Habit Tracker" });
      await refreshSettings();
      toast.success("Settings saved");
      onOpenChange(false);
    } catch (e) {
      toast.error("Failed to save settings");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Theme and ignored days save instantly. Your name is saved with the Save button.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Your Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
            />
            <p className="text-xs text-muted-foreground">
              Shown in the header next to your habit tracker.
            </p>
          </div>

          {/* Theme — saved instantly via setTheme */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="theme">System Theme</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{theme === "dark" ? "Dark" : "Light"}</span>
                <Switch
                  id="theme"
                  checked={theme === "dark"}
                  onCheckedChange={(c) => setTheme(c ? "dark" : "light")}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Saved instantly — the app always reopens with this theme.
            </p>
          </div>

          {/* Ignore days — saved instantly on toggle */}
          <div className="space-y-2">
            <Label>Days to Ignore</Label>
            <p className="text-xs text-muted-foreground">
              Ignored days are removed from every week — their columns are hidden and excluded from progress. Your ticks are never deleted; they reappear if you un-ignore a day.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {WEEKDAY_NAMES.map((day) => {
                const active = ignoreDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={
                      "px-3 py-2 rounded-md border text-sm transition-colors " +
                      (active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border hover:bg-muted")
                    }
                    aria-pressed={active}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            {ignoreDays.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Ignoring: {ignoreDays.join(", ")}
              </p>
            )}
          </div>

          {/* Memory & backup status — the app snapshots everything onto this
              device after every change and self-heals if the server ever
              loses data (rollback / crash). */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Memory &amp; Backup
              </span>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                ● Always on
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Everything — ticks, goals, habit order, ignore days, theme and name — is
              backed up on this device immediately after every change. If the server ever
              loses data, the app detects it and restores your latest state automatically
              the next time it opens.
            </p>
            {lastBackup && (
              <p className="text-xs text-muted-foreground">
                Last device backup:{" "}
                {new Date(lastBackup).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save name"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
