# Merizo — Product Requirements Document

## Overview
Merizo is a mobile-first expense splitting app that lets friends and roommates create groups (Splits), log expenses, and settle balances. Built with React Native (Expo), FastAPI, and MongoDB. Premium fintech aesthetic with light/dark mode and a custom 5×7 SVG dot-matrix number renderer used in dark mode.

## Tech Stack
- Frontend: React Native Expo SDK 54, expo-router file-based routing, react-native-reanimated (spring physics), react-native-svg (DotNum + charts), expo-google-fonts (Inter + Syne), AsyncStorage, axios
- Backend: FastAPI, Motor (MongoDB async), bcrypt, PyJWT, httpx (FX API)
- Auth: JWT (Bearer token in `Authorization` header, stored on the client in AsyncStorage as `merizo_token`)
- FX: fawazahmed0/exchange-api (free, daily ECB rates) cached in MongoDB for 1 hour with a static fallback table

## Demo Seed (auto on backend startup)
- User: `demo@merizo.app` / `Demo@123` / "Demo User"
- 3 splits pre-populated:
  - **Goa Trip** — 3 members, 5 expenses, ₹30,000 budget
  - **Manali Trip** — 2 members, 3 expenses, ₹22,000 budget
  - **College Buddies** — 4 members, 2 expenses, ₹8,000 budget

## Screens
1. **Login / Register** — Centered, "Merizo" Syne 800, tagline, email + password, Sign In, Create Account, Google ghost button
2. **Home (Groups tab)** — avatar + add `+`; "Hi, [Name]" / "Your groups" header; "YOU ARE OWED" + huge amount; **stacked card carousel** (iOS widget style, spring physics, swipe left/right, 3 cards visible with depth); 4 quick actions (Add Expense, Settle Up, Scan Bill, Invite); **Smart Limit widget** (DotNum 74% + hybrid solid/dotted progress bar with triangle pointer); Insights + Reminders mini widgets
3. **Insights tab** — "TOTAL SPENT" + huge amount, Week / Month / All Time toggle, Gauge dial (dark) / Donut ring (light), category list with hybrid bars
4. **Profile tab** — avatar, name, email, splits count, total spent, theme pills (light/dark), logout
5. **Category Select** — 2×3 grid (Trip / Food / Home / Friends / Shopping / Bills) with gradient cards in dark mode
6. **Create Split (3 steps)** — name + dates + destinations chips → members chip input (auto-includes unsubmitted text on Next/Create — **non-negotiable rule**) → currency + cover image (auto-resolves from destination/category, 8 override thumbnails)
7. **Split Detail** — 220px hero with frosted icons, 4 tabs (Overview, Expenses, Members, Settle), FAB `+`. Overview shows gauge dial / donut + balances; Expenses shows expense rows; Members allows any member to add; Settle uses **greedy algorithm** for simplified debts with Mark Paid pills
8. **Add Expense bottom sheet** — name, big centered amount, currency pill row, auto category, paid-by chips, split-among checkboxes + Select All

## Custom Components
- **DotNum** — SVG 5×7 dot grid character renderer (xs/sm/md/lg/xl/xxl, indigo/white/green/red/muted/gold). Used in dark mode for every number; light mode falls back to bold Inter 900
- **StackedCarousel** — react-native-reanimated spring physics on Pan gesture. Stack of 3 cards (scale 1 / 0.94 / 0.88, opacity 1 / 0.78 / 0.55, translateY 0 / 12 / 24)
- **SmartLimitWidget** — central DotNum percentage with tiny ghost % siblings, solid + dotted hybrid progress bar with triangle pointer, Min/Max labels
- **GaugeDial / DonutRing / HybridBar** — SVG-based charts driven by data

## API (`/api`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account, returns JWT |
| POST | `/auth/login` | Verify + JWT |
| GET | `/auth/me` | Current user |
| GET | `/trips` | List trips with computed balances |
| POST | `/trips` | Create trip (saves split_category, cover_key, destinations[], members[]) |
| GET | `/trips/{id}` | Full trip with balances + settlement_transactions |
| DELETE | `/trips/{id}` | Owner only |
| POST | `/trips/{id}/expenses` | Add (FX-converted to base currency) |
| DELETE | `/trips/{id}/expenses/{eid}` | Remove |
| POST | `/trips/{id}/members` | Any member can add |
| POST | `/trips/{id}/settle` | Record a settlement |
| GET | `/trips/{id}/settlement` | Updated trip |
| GET / POST | `/trips/{id}/invite[/rotate]` | Get / rotate token |
| GET | `/invite/{token}/preview` | Public peek |
| POST | `/invite/{token}/join` | Join the split |
| GET | `/insights?period=week\|month\|all` | Total + per-category + per-trip breakdown |
| GET | `/fx/rate?base=USD&target=INR` | Cached FX rate |

## Balance & Settlement Logic
- `net = total_paid − fair_share` per member (settlement expenses don't count toward total but DO clear balances)
- **Greedy** algorithm: pair largest creditor with largest debtor until everyone is settled. Fewer transactions than naive O(n²).

## Theming
- Stored in AsyncStorage as `merizo_theme` (defaults to system color scheme)
- Sun/moon toggle in top-right of Home, Login, Register, Profile
- 200ms transitions; everything (DotNum visibility, accents, surfaces) re-renders instantly

## Non-Negotiable Rules (validated)
1. Home screen renders stacked carousel + balance summary + 4 quick actions + Smart Limit + Insights + Reminders + 3-tab nav ✅
2. Light mode = clean white + Inter 900 numbers, no dot-matrix ✅
3. Dark mode = DotNum on every number, indigo accent, dark cards ✅
4. Stacked carousel uses react-native-reanimated spring physics (not plain CSS) ✅
5. Smart Limit widget shows DotNum % + hybrid solid/dotted bar with triangle pointer ✅
6. DotNum is a real SVG dot grid (Circle elements, not styled fonts) ✅
7. Theme toggle re-renders everything instantly ✅
8. Any member can add new members ✅
9. Member name typed but not added is auto-included on save ✅
10. Cover image auto-resolves from destination + category, user can override from 8 thumbnails ✅

## Status
- Backend: 54/54 pytest tests passing (38 prior + 10 iter4 + 6 iter5 hotfix). All endpoints live, all Gemini calls live (no mocks).
- Frontend: All key screens render correctly in light + dark mode. Demo login → Home with carousel + Smart Limit + 3 reminders. Theme toggle, Insights GaugeDial, Profile horizontal stats + overbudget toggle, Category Select, Create Split (3-step wizard with conditional date fields), Split Detail (4 tabs + Settings sheet with currency change + AI Insights), Add Expense (full-width amount, auto-tag chip, UPI parser with indigo AI-filled highlights), Scan Bill, Reminders with notifications. Sign out + Delete confirmed working via the new Platform-aware confirmAction helper.

## Iteration 4 (Big batch — 7 bug fixes + 3 improvements + 8 AI features)

### Bug fixes
1. **Add Expense overflow** — amount input is now full-width inside a wrapped row, currency pills moved to the AMOUNT label row; placeholder is "0.00".
2. **Settings missing currency change** — new `Change currency · INR` row in Settings sheet with searchable picker. `PATCH /api/trips/{id}/currency` re-converts every expense's `amount_base` and the budget via the cached FX rate.
3. **Profile total spent scroll** — stats are now a horizontal `ScrollView` of 3 fixed-width cards (SPLITS / TOTAL SPENT / ACTIVE).
4. **Light-mode numbers as DotNum** — `SmartNum` always renders `<DotNum>`; in light mode `indigo`/`white` colors are mapped to `black` (black dots on off-white). No Inter bold fallback anywhere.
5. **Delete split** — relaxed to "any member can delete" on backend; new `confirmAction` helper unblocks the previously-broken native confirm flow on web.
6. **Sign out** — same `confirmAction` helper makes the destructive button onPress fire on web. AsyncStorage `merizo_token` is cleared, `authHooks.onUnauthorized` invalidates user state, root `/index` redirects to `/login`. A new 401 axios interceptor auto-logs out on any expired/invalid token across the app.
7. **Create Split date fields by category** — Trip → Start + End date with calendar icon button + Today / +1wk / +1mo presets. Other categories → single "Due date reminder" field that also auto-creates a reminder when the split is created.

### Improvements
1. **Smart Limit progress bar** — already had DotNum percent + ghost siblings + solid+dotted hybrid bar with triangle pointer. Now also shrinks/grows with the AI-suggested limit.
2. **Stacked card carousel** — already used Reanimated spring physics. Indigo glow border on dark front card.
3. **Auto-tag category chip** — Add Expense detects category from the name as the user types (swiggy → 🍽️, uber → ✈️, netflix → ⚡, etc.) and shows it as a tappable chip with full override row of all 6 categories.

### AI Features (Gemini 2.5 Flash via emergentintegrations)
1. **Place Fun Facts** (trip) — `GET /api/trips/{id}/ai/overview` returns `place_facts: { place, facts[4] }`, cached forever in `trip.ai_cache.place_facts`. Frontend: horizontal scroll of 4 cards with 📍 + Syne fact + place label.
2. **Food Insight** (food) — same endpoint returns `food_insight: { sig, text }` cached by expense signature; refreshes when expenses change. Renders as a card with AI badge.
3. **Recurring detector** (home) — `POST /api/trips/{id}/expenses` returns `recurring_suggestion` when a similar-named home expense exists >25 days ago. Frontend: confirm dialog "Looks like a recurring expense — set a monthly reminder?" → on Yes, creates a `/api/reminders` entry +30d.
4. **UPI Parser** (all) — `POST /api/expenses/parse-upi` body `{text}` → Gemini returns `{amount, merchant, category, currency}`. Frontend: "Paste UPI Message" button in Add Expense → modal with textarea → parsed fields are written into the form with **indigo highlight borders** that clear when the user edits each field manually.
5. **Budget Forecast** (all) — same overview endpoint returns `forecast: { sig, text }` ending with ✅ / ⚠️ / 🚨. Renders as a pill chip below the gauge dial. Only when start_date + end_date + ≥2 expenses are present.
6. **Group Personality** (friends) — same overview endpoint returns `personality: { title, emoji, description }`. Renders as an indigo card in dark mode / black card in light mode with emoji + Syne title + description.
7. **Subscription conflict warning** (bills, no AI) — on Add Expense submit, if the name matches `netflix|spotify|disney|prime|youtube` and member count exceeds the platform's typical screen limit, a confirm toast warns the user.
8. **Smart Limit AI suggestion** — `compute_smart_limit_for_user` now asks Gemini for a sensible weekly limit based on the last 30 days of expenses, cached on the user doc as `ai_weekly_limit` (refresh every 7 days). Falls back to the statistical avg×1.1 if Gemini fails. Response surfaces `ai_source: 'ai_fresh' | 'ai_cache' | 'statistical'`.

### Implementation rules honoured
- All Gemini calls pass through one `gemini_chat()` helper with an 18s timeout that returns None on any failure → endpoints gracefully omit the failed field.
- Loading skeletons render while the AI overview endpoint is in-flight.
- All AI responses cached in MongoDB with signature-based invalidation when underlying data changes.
- AI cards adapt to light/dark theme.
- Numbers inside AI cards render as DotNum via SmartNum.
- AI cards never block page load — main content renders first, AI section appears as it resolves.

## Iteration 3 (Polish layer)

### 1. Notification cancellation on complete/delete
- New `src/lib/settings.ts` exposes a reminder-id → scheduled-notification-id map persisted in AsyncStorage `merizo_notif_map`.
- `scheduleReminder` stores the returned notif id via `setNotifId`. `cancelScheduledFor` calls `popNotifId` (always cleans the map, even on web) then `Notifications.cancelScheduledNotificationAsync`.
- Hooked into both `onComplete` and `onDelete` in `app/reminders.tsx`.

### 2. Settings toggle to opt out of overbudget red alerts
- AsyncStorage key `merizo_overbudget_alerts` (default ON).
- Toggle in Profile → "SETTINGS" card with switch UI (testID `overbudget-toggle`).
- `SmartLimitWidget` reads the flag on mount; when OFF, the percent and progress bar stay indigo even when over 100%.

### 3. Smart-limit pre-warm + cache layer
- `compute_smart_limit_for_user(user_id)` is now a pure helper.
- `GET /api/smart-limit` reads `db.smart_limit_cache` (TTL 6h). Returns `cache: "hit"|"miss"` so callers can introspect.
- `invalidate_smart_limit_for_trip(trip)` deletes the cache for every member of a trip after add/delete expense and after settle — verified live (cache=miss right after a mutation, cache=hit thereafter).
- A background `asyncio.create_task(smart_limit_prewarm_loop())` is launched on FastAPI startup. After a 30s grace it loops over every user, recomputes & writes the cache, then sleeps 6h. Logs `Smart-limit pre-warm completed for N users.` per pass. Verified running in production logs.

## Iteration 2 (Feature additions on top of MVP)

### 1. Smart Limit — wired to real per-user weekly budget
- `GET /api/smart-limit` computes `current_week_spent` from expenses where the demo user is the payer in the current ISO week.
- `weekly_budget` = (avg of last 4 full weeks) × 1.1 buffer; falls back to ₹5000 with `has_history=false` if no history.
- Demo seed expenses use explicit `days_ago` so first login shows a realistic ~77% (matches the design spec image).

### 2. Shadow → boxShadow migration
- `StackedCarousel.card` and `split/[id].styles.fab` now use `boxShadow: "..."` (RN 0.81+ unified syntax). Native `elevation` retained for Android.

### 3. Scan Bill (OpenAI vision via emergentintegrations)
- `POST /api/scan-bill` accepts `{ image_base64 }` (no `data:` prefix), calls `LlmChat(...).with_model("openai", "gpt-4o-mini")` with `ImageContent`, returns `{ vendor, amount, currency (ISO), category, date, suggested_name }`.
- New `app/scan.tsx` screen: camera + gallery picker via `expo-image-picker`, preview, "Scan with AI" button, editable result card with trip picker, then "Add to split" creates the expense. Permissions declared in `app.json` (NSCameraUsageDescription, NSPhotoLibraryUsageDescription, android.permission.CAMERA, READ_MEDIA_IMAGES).

### 4. Reminders + Push notifications
- New `reminders` collection (id, user_id, title, amount, due_date, completed). `GET/POST/PATCH /complete/DELETE /api/reminders[/{id}]`.
- 3 demo reminders auto-seeded (Pay Aman / Settle Karan / Collect from Neha).
- New `app/reminders.tsx` screen with add/complete/delete and a `+` quick-add bottom sheet (4 "when" presets — Today/Tomorrow/3d/1w).
- `expo-notifications` schedules a local notification for the due_date 9 AM. Permission prompt banner on iOS/Android. Web is graceful (saves but doesn't push). Permission `POST_NOTIFICATIONS` declared on Android.

## Smart Business Enhancement
Smart Limit widget renders an "AI-suggested weekly spending threshold" UI surface — it currently shows a static 74%. Hooking this to a per-user `weekly_budget` setting in MongoDB (driven by the user's last 4 weeks of spend) would unlock a clear premium upgrade path: Merizo Pro ($2.99/mo) for personalized limits + push notifications when users approach their AI budget — a recurring revenue lane on top of the free splitter.
