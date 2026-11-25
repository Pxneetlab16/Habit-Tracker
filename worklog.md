# Habit Tracker App — Worklog

Source: `Habit tracker.xlsx` (Google Sheets export) located at `/home/z/my-project/upload/Habit tracker.xlsx`.

Goal: Rebuild the spreadsheet as a working Next.js web app with identical functionality (tick marks, weekly color coding, stats panels, daily progress chart, monthly summary with goal/actual/progress sparkline bars), plus three new features:
1. Month selector — switch between months, each month keeps its own habits & goals.
2. Settings dialog — user name, system theme (light/dark), and "ignore days" (e.g. ignore Sunday → every week's Sunday column is removed).
3. Properly working tick marks.

---
Task ID: 1
Agent: main
Task: Set up Prisma schema for the habit tracker app.

Work Log:
- Inspected `Habit tracker.xlsx` and mapped its structure:
  - Title "SMALL HABITS BUILD BIG CHANGES."
  - Month/Year selector (October 2026 in the original).
  - Top stats: Daily Average Progress, Your Progress (donut), Total Progress (donut), Total Weekly Progress (donut), Habits Categories list, Top 5 Habits.
  - Main grid: Week One..Week Five color-coded headers, dates 1..N as columns, habit rows with True/False checkboxes.
  - Row 16 = daily completion % (countif true / count of habits).
  - Right side: Monthly Progress Summary — Goal / Actual / Progress columns with pink sparkline bars (#d5a6bd).
  - Area chart at top showing daily progress over the month.
  - Legend: Done / To Do.
- Week color palette (from conditional formatting):
  - Week 1: pink (#EAD1DC bg, #C27BA0 check)
  - Week 2: blue (#CFE2F3 bg, #376092 check)
  - Week 3: yellow (#FFF2CC bg, #F1C232 check)
  - Week 4: green (#D9EAD3 bg, #6AA84F check)
  - Week 5: purple (#D9D2E9 bg, #8E7CC3 check)
- Designed Prisma models: Settings (singleton), Month, Habit, Checkmark.

Stage Summary:
- Schema designed and ready to be written to `prisma/schema.prisma`.
- Next: push schema to SQLite and seed default data.

---
Task ID: 2
Agent: main
Task: Build the complete habit tracker app — schema, API, UI, settings, month switching, ignore-days. Verify with Agent Browser.

Work Log:
- Wrote Prisma schema (`prisma/schema.prisma`): Settings (singleton), Month, Habit, Checkmark with unique(month, year), unique(habitId, day).
- `bun run db:push` + seed script `src/lib/seed.ts` created default settings + October 2026 with the original 12 habits & goal=7 (matches the first sheet of `Habit tracker.xlsx`).
- API routes (`src/app/api/...`): settings GET/PATCH, months list/create/get/update/delete, months/[id]/habits POST, habits/[id] PATCH/DELETE, checkmarks POST (upsert). All return JSON.
- Frontend (`src/components/habit-tracker/`):
  - `theme-provider.tsx` — context for theme + settings, applies `.dark` class.
  - `api-client.ts` — typed fetch helpers, category list, weekday helpers, week colors, `weekIndexForDay`, `daysInMonth`, `weekdayOfDay`.
  - `settings-dialog.tsx` — name input, light/dark switch, 7 weekday toggle buttons to ignore.
  - `month-selector.tsx` — month dropdown + "New Month" dialog (with clone-habits switch) + delete-month dialog.
  - `habit-edit-dialog.tsx` — add/edit habit (name, category, goal) + delete.
  - `stats-bar.tsx` — 6 stat cards: Daily Average Progress (big %), Your Progress donut (X/Y), Total Progress donut, Total Weekly Progress donut, Top 5 Habits, Habits Categories.
  - `daily-progress-chart.tsx` — Recharts AreaChart of daily completion %.
  - `donut.tsx` — reusable Recharts donut with center label.
  - `habit-table.tsx` — the main grid: Week 1-5 color-coded headers (pink/blue/yellow/green/purple), date row, weekday row, habit rows with working tick-mark buttons, Goal/Actual/Progress columns with pink sparkline-style bars. Ignored days are completely removed (not rendered) per user request.
  - `habit-tracker.tsx` — orchestrator: header (title, name, month selector, theme toggle, settings), stats, chart, table, sticky footer. Optimistic checkmark updates.
- `globals.css` — custom habit-tracker theme variables for light + dark (week colors, sparkline pink #d5a6bd, summary header, empty cell, done-bg, donut chart colors).
- `layout.tsx` — added ThemeProvider + SonnerToaster; updated metadata.
- `page.tsx` — renders `<HabitTracker />`.

Agent Browser verification (all passed):
- Page renders with no errors, all API routes return 200.
- Tick marks: clicking a checkbox POSTs to /api/checkmarks and persists (verified via DB query after reload).
- Stats update live: ticked 3 habits on day 1 → Daily Average 1%, Your Progress 3/84, Total 1%, Weekly 1%.
- Week color coding verified: days 1-7 = W1 pink (#EAD1DC), 8-14 = W2 blue (#CFE2F3), 15-21 = W3 yellow, 22-28 = W4 green, 29-31 = W5 purple.
- Settings dialog: changed name to "Alex", toggled dark theme, ignored Sunday → all 3 saved to DB and applied (subtitle updated, dark class added, all 4 Sunday columns removed from the table).
- New Month: created November 2026 with "copy habits" enabled → 12 habits cloned, auto-switched to November, ticks are independent per month (October's ticks don't appear in November).
- Edit Habit: clicked habit name → dialog opened with current values, changed goal 7→20, saved → table showed 20.
- Add Habit: added "Test meditation habit" → habit count 12→13, appeared at the end.
- Dark theme: bg rgb(20,19,26), text rgb(236,233,241), card rgb(28,27,36) — all correct dark palette.
- Mobile (390×844): no page-level horizontal scroll, header full-width, month selector visible, table scrolls horizontally inside its container.
- Sticky footer: wrapper `min-h-screen flex flex-col`, main `flex-1`, footer `mt-auto` — correct pattern; footer at bottom on short content, pushed down on long content.
- Cleaned up all test data (ticks, test habit, test month, settings reset to defaults).

Stage Summary:
- Fully working habit tracker app matching the original spreadsheet's functionality (tick marks, week color coding, stats panels, daily progress chart, monthly summary with goal/actual/progress + sparkline bars).
- Three new features delivered: month selector with per-month habits & goals, settings dialog (name + theme + ignore days), and properly working tick marks that persist.
- Ignore days: selected weekdays are completely removed from the table and from all progress calculations (per user's "remove" request).
- Verified end-to-end with Agent Browser. ESLint clean. No runtime errors.

---
Task ID: 3
Agent: main
Task: (a) Weeks should run Monday→Sunday, (b) remove the "Top 5 Habits" stat card, (c) add a PWA logo using the uploaded image.

Work Log:
- Copied `/home/z/my-project/upload/80cb634e-d6de-4e73-9029-27ae4cf05268.png` (1254×1254 PNG) to `public/icons/source.png` and generated 6 icon sizes with sharp: favicon-16, favicon-32, apple-touch-icon (180), icon-192, icon-512, maskable-512.
- Created `src/app/manifest.ts` (Next.js metadata route) → serves `/manifest.webmanifest` with name, short_name, theme_color #d5a6bd, standalone display, and 4 icons (any + maskable + apple).
- Updated `src/app/layout.tsx`: added `manifest: "/manifest.webmanifest"`, `appleWebApp` config, full `icons` object (32/16/192/512 + apple 180 + shortcut), `viewport` export with themeColor, and an explicit `<link rel="apple-touch-icon">` in `<head>`.
- Added the PWA logo to the header in `habit-tracker.tsx`: a 44×44 rounded image (`/icons/icon-192.png`) next to the title.
- Changed `weekIndexForDay(day)` → `weekIndexForDay(month, year, day)` in `api-client.ts`. New algorithm uses Monday-Sunday calendar weeks: week 1 starts on day 1 (whatever weekday) and ends on the first Sunday; subsequent weeks run Monday→Sunday. Formula: `Math.floor((day - 1 + ((weekdayOfFirstDay + 6) % 7)) / 7)`.
- Added a 6th week color (teal) to `WEEK_COLORS` in `api-client.ts` and `--week-6-*` CSS variables in `globals.css` (light: #d0e8e8/#4a9b9b; dark: #1f3333/#6fc4c4) to handle 31-day months that start on Saturday/Sunday and span 6 weeks.
- Updated all callers of `weekIndexForDay` in `habit-table.tsx` (6 call sites) and `stats-bar.tsx` (weekly progress calc) to pass `(month.month, month.year, d)`.
- Removed the "Top 5 Habits" `StatCard` and its `top5` useMemo from `stats-bar.tsx`; changed the stats grid from `xl:grid-cols-6` to `xl:grid-cols-5`; gave the Habits Categories card `xl:col-span-2` so it fills the freed space.

Agent Browser verification (all passed):
- Mon-Sun weeks (October 2026): W1 = Thu Oct 1 → Sun Oct 4 (pink); W2 = Mon Oct 5 → Sun Oct 11 (blue); W3 = Mon Oct 12 → Sun Oct 18 (yellow); W4 = Mon Oct 19 → Sun Oct 25 (green); W5 = Mon Oct 26 → Sat Oct 31 (purple). Each week starts Monday, ends Sunday (W1 starts on the 1st even though it's Thursday).
- 6-week month (August 2026, starts Saturday, 31 days): W1 = Sat-Sun (pink), W2-W5 = Mon-Sun (blue/yellow/green/purple), W6 = Mon Aug 31 (teal #f2fafa) — the new 6th week color renders correctly.
- Top 5 Habits card removed: stat card titles are now ["DAILY AVERAGE PROGRESS", "YOUR PROGRESS", "TOTAL PROGRESS", "TOTAL WEEKLY PROGRESS", "HABITS CATEGORIES"] (5 cards, no Top 5).
- PWA logo: header img src="/icons/icon-192.png", naturalWidth 192, loaded=true.
- Manifest: `/manifest.webmanifest` returns 200 with correct JSON; `<link rel="manifest" href="/manifest.webmanifest">` present; apple-touch-icon + 4 icon links all in `<head>`.
- Icons serve: /icons/icon-192.png, /icons/icon-512.png, /icons/apple-touch-icon.png all return 200.
- No runtime errors. ESLint clean.
- Cleaned up the test August 2026 month; only October 2026 remains.

Stage Summary:
- Weeks now run Monday→Sunday (calendar weeks) instead of day-of-month blocks; first week starts on the 1st and ends on the first Sunday.
- "Top 5 Habits" stat card removed; stats grid is now 5 cards (Daily Average, Your Progress, Total Progress, Total Weekly Progress, Habits Categories).
- PWA installed: manifest route + favicon-16/32, apple-touch-icon, icon-192/512, maskable-512 (all generated from the uploaded image); header shows the logo next to the title. App is installable (standalone display, theme color, icons).

---
Task ID: 4
Agent: main
Task: Fix weekly (7-day) goal calculations — make all goals month-wise (30/31 full-month days), fix the "Your Progress" box showing weekly 84, and make ignore-weekday propagate everywhere (no fixed 7-day numbers left in the system).

Work Log:
- Root cause: `habit.goal` was seeded/stored as a fixed weekly value of 7 (12 habits × 7 = the "84 goals" the user saw in the Your Progress box), while Actual counted ticks across the whole month. Ignore-weekday never touched these stored numbers.
- Redesigned goals as DYNAMIC FULL-MONTH GOALS = number of visible days in the month (daysInMonth − ignored weekdays). Computed, never stored-displayed:
  - `api-client.ts`: added single-source-of-truth helpers — `WEEKDAY_NAME_TO_INDEX`, `ignoreDaysToIndices()`, `visibleDaysInMonth(month, year, ignoreDays)`, `monthGoalDays(month, year, ignoreDays)`.
  - `habit-table.tsx`: Goal column now shows `visibleDays.length` (Oct → 31, Nov → 30; ignore 4 Sundays → 27) instead of stored `habit.goal=7`; per-row progress = actual / monthGoal (capped 100%); uses shared helpers (removed local duplicate map).
  - `stats-bar.tsx`: "Your Progress" box totalGoal = habits × visibleDays (12 × 31 = 372, not 84); totalActual = total month ticks on visible days; uses shared helpers (removed local duplicate map).
  - `habit-tracker.tsx`: daily chart uses shared `visibleDaysInMonth`; passes month/year/ignoreDays into HabitEditDialog; NEW: passes `onDeleted={reloadCurrentMonth}` (pre-existing bug: UI never refreshed after habit delete).
  - `habit-edit-dialog.tsx`: removed the fixed "Monthly Goal (days)" input (default 7); replaced with an auto info panel "N days — full month, auto-calculated (ignored weekdays excluded)"; new habits save with the computed month goal.
  - API `POST /api/months/[id]/habits`: default goal = that month's day count (Nov → 30) instead of hardcoded 7; clamps 1..31.
  - API `POST /api/months` (clone): cloned habits get the NEW month's day count as goal.
  - API `DELETE /api/habits/[id]`: made idempotent (returns ok instead of Prisma P2025 500 when already deleted).
  - `src/lib/seed.ts`: default habits now seed with October's 31 days, not 7.
  - DB migration (one-time bun script): all existing habits' goal 7 → their month's day count (12 habits → 31).
- Swept the whole codebase for leftover fixed-7 logic — only calendar math ((wd+6)%7) and CSS sizes remain; ignore-days now flow through one shared `visibleDaysInMonth` used by table, stats, chart and goals.

Agent Browser verification (all passed):
- October 2026: Goal column shows 31 for all 12 rows; Your Progress box shows "0 / 372" (was 0/84).
- Ticked 3 cells → row actual 3, progress 10% (3/31), box "3 / 372".
- Ignored Sunday → all 4 Sunday columns removed; Goal column 31 → 27 on every row; box → "3 / 324" (12 × 27); chart excludes Sundays; weekly avg updates (2%). Un-ignored → back to 31 / 372.
- Created November 2026 (cloned habits) → Goal column 30, box "0 / 360" (12 × 30); October ticks did not leak. Deleted test month.
- Add Habit dialog shows "31 days — full month, auto-calculated"; new habit created with goal 31; deleted it → UI auto-refreshed 13 → 12 (onDeleted fix verified).
- Mobile 390×844: layout stacks, table scrolls horizontally, footer pushed naturally (sticky mt-auto pattern verified on desktop too).
- Console clean after reload (0 errors); earlier hydration/500 messages were from the pre-fix double-delete, confirmed gone. Lint clean.
- Final state: 1 month (Oct 2026), 12 habits (goal 31), 0 checkmarks, ignoreDays [] — test data fully cleaned.

Stage Summary:
- All goals are now month-wise full-month goals (30/31 minus ignored weekdays) — table Goal column, per-habit progress, and the "actual / goal" box all agree.
- "Your Progress" box shows the true month total (habits × visible days), fixing the old weekly 84.
- Ignore-weekday now propagates through ONE shared helper into the table columns, goal numbers, all four stat cards, the chart and the add-habit dialog — no place in the system keeps fixed 7-day numbers.
- Fixed pre-existing delete-refresh bug and non-idempotent habit DELETE API.

---
Task ID: 5
Agent: main
Task: (a) Make settings memory bulletproof — theme always reopens as chosen, ignored weekdays stay ignored until changed; (b) add drag & drop habit reordering (move any goal from any position to any other).

Work Log:
- ROOT CAUSES of flaky memory found & fixed:
  1. Header theme toggle (`setTheme`/`toggleTheme` in theme-provider.tsx) only changed local React state — NEVER saved to DB or localStorage, so every reload reverted to default. Fixed: theme now persists on EVERY change (header toggle + settings switch) to both localStorage (`ht-theme` mirror, synchronous) and the server DB (fire-and-forget PATCH with failure toast). On load, localStorage wins and re-syncs the server if a previous write had failed.
  2. No `Cache-Control` header on ANY API response — the browser (esp. installed PWA) could serve stale cached GET /api/settings responses, making saved settings appear to randomly not stick ("kabhi save hoti hai kabhi nhi"). Fixed: `Cache-Control: no-store, no-cache, must-revalidate` added to every response of all 7 API routes (settings, months, months/[id], months/[id]/habits, habits/[id], habits/reorder, checkmarks).
  3. Pre-paint theme script added to layout.tsx `<head>` (reads the localStorage mirror before first paint) — app ALWAYS opens in the chosen theme with no default flash.
  4. Settings dialog: ignore-day toggles and the theme switch now save INSTANTLY (auto-save with optimistic update + revert on failure + toast); only the name uses the Save button. Also fixed: dialog fields now sync only on open (not on every settings refresh) so typing the name is never clobbered; ignoreDays mirrored to localStorage (`ht-ignore-days`) as offline fallback.
  5. Reassurance: ignoring a weekday never deletes ticks — verified by test (tick on day 1 survived ignore→un-ignore cycles; ticks reappear when a day is un-ignored).
- DRAG & DROP REORDERING:
  - Schema: removed `@@unique([monthId, order])` from Habit (would reject transient reorder states); `bun run db:push`.
  - New API `POST /api/habits/reorder` ({orderedIds}) — validates all ids belong to one month, appends unmentioned habits, renumbers gapless 1..n in one transaction.
  - `POST /api/months/[id]/habits` now appends with max(order)+1 instead of count+1 (no collision after reorders/deletes).
  - habit-table.tsx: dnd-kit SortableContext + per-row `useSortable`; GripVertical drag handle in the # cell (tick buttons unaffected); PointerSensor (mouse+touch, distance 5) + KeyboardSensor (Space/arrows — fully keyboard accessible); optimistic reorder with revert on API failure; "Order saved" toast; parent reloads month after save.
  - New-habit append, month clone, and habit delete all keep gapless order.
- PRE-EXISTING HYDRATION ERROR ELIMINATED (bonus, affects "memory" stability):
  - Every app open logged "A tree hydrated but some attributes… didn't match" (client `radix-_R_5hatmlb_` vs server `radix-_R_m6atmlb_` on the Radix Select `aria-controls`), causing React to regenerate the whole tree client-side on EVERY load. Verified pre-existing (reproduced on stashed original code) — NOT introduced by this session.
  - Root cause: @radix-ui/react-id calls React.useId inside a useState initializer (`useState(useReactId())`); React 19's hydration pass encodes that useId differently than SSR. Radix has not fixed it (checked 1.1.4). A bun patchedDependencies patch proved to be a no-op (same hook order) and was reverted.
  - Fix: month-selector.tsx renders the month Select only AFTER mount with an identical-size SSR placeholder (`min-w-[200px] h-9` skeleton) — zero layout shift, zero hydration id comparison. Theme toggle icons switched to CSS-driven (`dark:hidden` / `hidden dark:block`) + static title for the same reason.
- UI detail: DndContext moved OUTSIDE the `<table>` (it renders hidden aria-live divs; inside table = invalid HTML nesting error).

Agent Browser verification (all passed):
- Theme: toggle → DOM class + localStorage + DB all updated instantly; 5+ reloads each way (dark↔light) — always reopens in the chosen theme, no flash.
- Ignore days: Sunday toggle → saved instantly to DB (no Save button), 31→27 columns, Goal 31→27; persisted across reloads; un-ignore → instantly back to 31/31.
- Ticks: tick day 1 → DB row created; survived ignore/un-ignore; toggle on/off verified in DB; all test ticks cleaned afterwards.
- Reorder: dragged habit #3 ("45 min workout") to #8 with mouse — order updated optimistically, "Order saved", DB gapless 1..12, persists after reload; keyboard reorder (Space + arrows) also works; moved back to original order and verified in DB.
- Add habit after reorders → appended at #13 (max+1 correct); deleted → back to 12, UI auto-refreshed.
- Month flow: created November 2026 (cloned 12 habits, goal 30), auto-switched; deleted → back to October (goal 31).
- Hydration: 8/8 consecutive reloads with ZERO console errors (was 1 error per load before).
- Mobile 390×844: no page horizontal scroll, table scrolls in container, layout intact; desktop screenshot verified.
- Final state: 1 month (Oct 2026), 12 habits in original order, goal 31, 0 checkmarks, theme light, ignoreDays [] — test data fully cleaned. ESLint clean.

Stage Summary:
- Settings memory is now bulletproof: theme persists via localStorage mirror (instant, offline-safe, pre-paint) + DB (permanent) on every change; ignored weekdays save instantly and stay until changed; all API responses are no-store so stale reads can never resurrect old state.
- Habits can be rearranged freely by drag & drop (mouse, touch, keyboard) from any position to any other; order persists per month.
- Eliminated the per-load hydration failure (pre-existing) — app now hydrates cleanly every time, removing a whole-tree client re-render that could contribute to perceived flakiness.

---
Task ID: 6
Agent: main
Task: Fix catastrophic memory loss — user lost ticks, ignored days and habit/goal changes after a few hours (only theme survived). Make persistence truly bulletproof.

Work Log:
- ROOT CAUSE (confirmed with evidence): the sandbox workspace was restored to an older snapshot (Oct 15 05:06 resume; `db/custom.db` mtime Oct 12 11:28, Settings.updatedAt Oct 12 11:16, 0 checkmarks, ignoreDays=[], original habit order) — the server-side SQLite DB went back in time, wiping every change made after the snapshot. The theme survived because it lives in the BROWSER's localStorage (`ht-theme` mirror), which is outside the workspace. Server-side data alone can never be guaranteed in this environment.
- FIX — a 3-layer self-healing memory system (extends the theme-mirror pattern to the WHOLE app state):
  1. Server version clock: `Settings.lastChangedAt DateTime?` added to schema (additive, `bun run db:push`); `src/lib/sync.ts` (`ensureSettings`, `bumpLastChanged`, `getLastChanged`); EVERY mutating API route now bumps the clock after a successful write (settings PATCH, months POST/PATCH/DELETE, months/[id]/habits POST, habits/[id] PATCH/DELETE, habits/reorder POST, checkmarks POST) and returns `lastChangedAt`.
  2. Device backup (localStorage): new `src/components/habit-tracker/state-mirror.ts` — full-state snapshot (`ht-state-mirror-v1`: settings + all months + habits + checkmarks + `serverChangedAt`). Saved after EVERY successful mutation via a central hook: `api-client.ts` `jfetch` dispatches `ht:state-mutated` on any non-GET success → state-mirror refreshes (leading+trailing debounce ~800ms, inflight-deduped) by fetching GET /api/bootstrap. Guard: a backup that is NEWER than the server is NEVER overwritten by an older server snapshot.
  3. Self-healing restore: new `GET /api/bootstrap` (settings + lastChangedAt + all months w/ habits+checkmarks in one response) and `POST /api/restore` (replaces entire server state from the backup inside one transaction, preserves month/habit ids when valid, sanitizes/clamps everything, dedupes checkmarks per day, renumbers order gapless). On startup `habit-tracker.tsx` compares backup.serverChangedAt vs server.lastChangedAt (both from the same server clock → no skew false-positives): backup newer → auto-restore + success toast; server unreachable → render straight from the backup (offline fallback + warning toast); otherwise normal load. All timestamps compared server-to-server.
- New types/APIs in `api-client.ts`: `BootstrapData`/`BootstrapMonth`, `bootstrapApi.get()`, `restoreApi.post(mirror)`; month-switch effect got a duplicate-fetch guard + 404 fallback to first month; selection routed through a ref (`selectMonth`).
- Settings dialog: new "Memory & Backup" status block (Always on + last device backup time) so the user can SEE the protection.
- Environment findings: harness runs `db:push --accept-data-loss` on every boot and restores workspace snapshots on resume — both can roll the DB back; agent-spawned background processes do NOT survive between tool calls in this sandbox (verified with a test daemon) — browser/server E2E was therefore executed inside single tool calls.

Agent Browser verification (all passed):
- User-change flow: ignored Sunday (instant save, 31→27 columns, Your Progress 0/324 = 12×27) + ticked 2 cells → device backup contained ignoreDays ["Sunday"] + 2 ticks + serverChangedAt equal to server clock.
- DISASTER SIMULATION (exactly what happened to the user): DB rolled back via script (checkmarks deleted, ignoreDays=[], theme=light, lastChangedAt=null) → reload → toast "Your data was restored from this device's backup" appeared, Sunday columns hidden again AND both ticks back in the DB (done tick rows: 2, days [1,2]). Tested twice (ticks + ignore days independently).
- Normal reload after restore: NO false restore, data intact, console clean.
- Mirror convergence: server-side change newer than backup → next load overwrites the backup, no restore loop.
- Broken-DB fallback (DATABASE_URL pointed at a nonexistent file → bootstrap 500): app still rendered all data from the device backup (offline path works).
- Theme: toggle → ht-theme + mirror both updated; restored via settings on rollback path too.
- Mobile 390×844: no page horizontal overflow, table scrolls inside its container, cards stack; desktop screenshot verified (Sunday columns absent, 0/324 goal math correct).
- Final state cleaned: 1 month (Oct 2026), 12 habits, 0 ticks, theme light, ignoreDays []. Temp scripts deleted. ESLint clean.

Stage Summary:
- Data loss root cause was environmental (workspace snapshot restore rolled the SQLite DB back); browser-side localStorage is the only storage that survives it.
- App now keeps a complete device backup in localStorage updated after EVERY change and self-heals the server on rollback automatically on the next open — ticks, ignored days, habit names/categories/order, months and settings are all covered. Theme keeps its instant pre-paint mirror as before.
- If the server DB is unreachable/broken, the app still opens with the user's last saved data instead of an empty screen.
- The changes the user lost before this fix existed only in the rolled-back DB and could not be recovered; everything saved from now on is protected by the device backup.
