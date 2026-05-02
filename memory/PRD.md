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
- Backend: 26/26 pytest tests passing (16 from MVP + 10 from iteration 2: smart-limit, reminders CRUD, scan-bill auth + format + real OCR)
- Frontend: All key screens render correctly. Demo login → Home with carousel + real Smart Limit (~77%) + 3 reminders count works. Theme toggle, Insights donut/gauge, Profile, Category Select, Create Split wizard, Split Detail tabs and Add Expense sheet all working.

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
