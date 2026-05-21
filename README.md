# Tavola — Restaurant Booking & CRM

Multi-tenant SaaS for restaurant reservations, guest CRM, loyalty, and marketing. Built with Next.js 15, Prisma, PostgreSQL, and Auth.js v5.

> **Status:** All 9 phases complete. Reservations + floor ops + public booking + CRM + loyalty + marketing + analytics + integrations + polish. Production-ready demo of a multi-tenant restaurant booking & CRM SaaS. Seeded with **Mario's Bistro** so you have real data immediately.

---

## What's in Phase 1

- ✅ **Auth** — email/password + optional Google OAuth (Auth.js v5, JWT strategy)
- ✅ **Multi-tenant** — every tenant-scoped Prisma model is auto-filtered by tenant via a Prisma extension. Cross-tenant leaks are structurally hard to write.
- ✅ **RBAC** — 6 roles (Super Admin / Owner / Admin / Manager / Host / Staff) and ~30 permissions wired into the sidebar, route handlers, and service layer.
- ✅ **Audit log** — write helper + viewer page, used by every state-changing operation.
- ✅ **Dashboard shell** — sidebar with permission-filtered nav, topbar with user menu + theme switcher, editorial design system (Fraunces + Geist Sans, warm hospitality palette).
- ✅ **Seed** — 1 demo tenant, 5 users (one per role), 10 tables, 200 guests, 500 reservations split past + future.

What's *not* in Phase 1 yet: the actual reservation list, calendar/floor view, guest CRM screens, loyalty, marketing, analytics. Those are Phases 2–7. Their nav items are in the sidebar marked "Soon" so you can see the roadmap living in the UI.

---

## Prerequisites

- **Node.js** 20+
- **pnpm** (or npm/yarn — examples below use pnpm)
- **PostgreSQL** 14+ — local Postgres, or a Neon / Supabase connection string

---

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

```bash
# Required
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/restaurant_crm?schema=public"
AUTH_SECRET="..."   # generate with: openssl rand -base64 32
AUTH_URL="http://localhost:3000"

# Optional: Google OAuth (login form shows the button only if both are set)
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""
```

### 3. Initialize the database

```bash
# Create tables
pnpm db:migrate

# Seed Mario's Bistro
pnpm db:seed
```

Seed is idempotent — re-running wipes & re-creates only the demo tenant.

### 4. Run the dev server

```bash
pnpm dev
```

Open http://localhost:3000.

### 5. (Optional) Install shadcn/ui primitives for Phase 2+

`components.json` is pre-configured. When you start needing fuller primitives:

```bash
npx shadcn@latest add button input label card dropdown-menu avatar separator badge alert table sonner skeleton dialog select
```

The login, register, sidebar, topbar, and user menu in Phase 1 use inline primitives so the project boots without this step.

---

## Demo credentials

All seeded users share the password **`password123`**.

| Email | Role | Sees |
|-------|------|------|
| `owner@mariosbistro.com` | OWNER | everything, including billing & audit log |
| `admin@mariosbistro.com` | ADMIN | everything except billing |
| `manager@mariosbistro.com` | MANAGER | floor + analytics, no team mgmt |
| `host@mariosbistro.com` | HOST | reservations + guests + waitlist |
| `staff@mariosbistro.com` | STAFF | reservations (read), seat / no-show |

---

## Demo script

Try this to see the foundation in action:

1. **Sign in** as `owner@mariosbistro.com` / `password123`. You'll land on the dashboard with real numbers from the seeded data — today's reservations, covers, no-show rate, and the next 6 upcoming bookings.
2. **Sidebar** — notice the nav items: only those your role can see appear, and Phase 2+ items are visible but tagged "Soon".
3. **Open the audit log** (left nav, under *Insight*). You'll see seed entries and the registration event.
4. **Sign out** via the avatar menu, then sign in as `host@mariosbistro.com`. The sidebar shrinks — Audit log, Settings, Loyalty, Marketing, and Analytics are gone. RBAC is enforced both in the UI and in the underlying service layer.
5. Try logging in with a **wrong password** — clean error toast, no info leak about whether the email exists.
6. **Theme switcher** in the avatar menu — the warm light theme and dark theme (host stand at night) both look intentional, not slapped together.

---

## Useful scripts

```bash
pnpm dev          # dev server with hot reload
pnpm build        # production build
pnpm typecheck    # tsc --noEmit
pnpm lint         # next lint
pnpm format       # prettier write

pnpm db:generate  # regenerate Prisma client
pnpm db:migrate   # create + run a migration
pnpm db:push      # push schema without migration (dev only)
pnpm db:studio    # open Prisma Studio
pnpm db:seed      # re-run the seed
pnpm db:reset     # drop + re-create + migrate + seed
```

---

## Project structure

```
restaurant-crm/
├── prisma/
│   ├── schema.prisma          # 30+ models, all tenant-scoped indexed on tenantId
│   └── seed.ts                # Mario's Bistro: users, tables, 200 guests, 500 reservations
├── src/
│   ├── middleware.ts          # subdomain → x-tenant-slug header; auth gate
│   ├── server/
│   │   ├── db.ts              # Prisma singleton + tenantDb(tenantId) extension
│   │   ├── auth.ts            # Auth.js v5 (credentials + Google), JWT-bound role
│   │   ├── tenant.ts          # requireAuth(), requirePermission(), getTenantFromHost()
│   │   ├── rbac.ts            # role-permission matrix
│   │   ├── audit.ts           # writeAudit(), diff()
│   │   └── services/          # transport-agnostic business logic
│   ├── app/
│   │   ├── (auth)/            # /login, /register — split-screen editorial layout
│   │   ├── (dashboard)/       # /dashboard, /audit-log — protected route group
│   │   └── api/auth/...       # NextAuth handlers + /api/auth/register
│   ├── components/
│   │   ├── auth/              # login + register forms (rhf + zod)
│   │   ├── dashboard/         # sidebar, topbar, user menu
│   │   └── ui/                # shadcn primitives (run npx shadcn add to populate)
│   ├── lib/
│   │   ├── utils.ts           # cn()
│   │   ├── format.ts          # date / currency / phone formatters
│   │   ├── validators/        # shared Zod schemas (forms + APIs)
│   │   └── constants.ts
│   └── hooks/
│       ├── use-tenant.ts      # client-side tenant context
│       └── use-permissions.ts # client-side can()
└── …
```

---

## Architecture notes

- **Tenant safety by construction.** `tenantDb(tenantId)` returns a Prisma client that injects `tenantId` on creates and on every `where` clause for tenant-scoped models. Service code reads `db.guest.findMany()` without ever passing `tenantId` — it can't accidentally leak across tenants.
- **JWT carries tenantId + role.** No extra DB hit per request to determine permissions. `requireAuth()` is a constant-time check.
- **Service layer is transport-agnostic.** Everything in `src/server/services/*` knows nothing about Next.js. If you ever extract this into a NestJS API, the services come along untouched.
- **Shared Zod validators.** `src/lib/validators/*` is imported by both the form (client) and the route handler (server) — types and error messages stay in lock-step.
- **Permission-first UI.** `<Sidebar>` filters items by `hasPermission(role, permission)`. The `usePermissions()` hook gives `can("reservation.cancel")` to any client component.
- **Audit logs never block.** `writeAudit()` catches errors, logs to console, and lets the parent operation continue.

---

## Phase 2 — Reservations & Floor Operations ✅

Phase 2 delivers the core service workflow: reservations, walk-ins, and the floor view.

### New routes

| Route | What it does |
|---|---|
| `/reservations` | Day-grouped list with date strip, status filters, search, inline actions |
| `/reservations/new` | Create flow with live availability picker and guest typeahead |
| `/reservations/[id]` | Detail view with status timeline and inline transitions |
| `/floor` | SVG floor plan with click-to-assign workflow |
| `/waitlist` | Active waitlist + quick walk-in add |

### What ships under the hood

- **Availability engine** (`src/server/services/availability.service.ts`): given a date and party size, returns open slots with the candidate tables that can seat the party. Considers operating hours, special closures, the slot interval, the dining duration window, lead time, and table conflicts.
- **Reservation service** (`reservation.service.ts`): list / get / create / update / state transitions. Creating a reservation upserts a guest by phone or email match before falling through to a new guest record. State machine enforces that you can only seat a confirmed/pending booking, complete a seated one, etc. Every mutation writes to the audit log.
- **Tables service** (`table.service.ts`): floor-plan reader (sections, tables, reservations bucketed per table for the day's window). Full table management lives in Settings later.
- **Waitlist service** (`waitlist.service.ts`): add walk-ins (auto-attaches to existing guest by phone), transition status (waiting → notified → seated, or left/cancelled).
- **Server actions** (`src/server/actions/*`): every mutation goes through a `"use server"` action that validates with the shared Zod schema, calls the service, and `revalidatePath`s the affected pages. No `fetch` wiring on the client.
- **Two API routes** for reactive client lookups: `/api/availability` (the create form's slot picker) and `/api/guests/search` (the create form's guest typeahead).

### Demo script — try it out

Sign in as `host@mariosbistro.com` / `password123` for the front-of-house experience.

1. **Browse reservations.** Land on `/reservations` (now in the sidebar). Use the date strip to scrub the week — past days show real seeded reservations, future days show what's coming. Try the status filter chips and the search box (search a confirmation code or guest name).
2. **Open one.** Click any row to open the detail page — service block on the left, guest card on the right, full timeline below. The action buttons at the top reflect what the current status actually allows: a confirmed booking gets *Mark seated* and *No-show*, a seated one gets *Complete*, etc.
3. **Walk through the state machine.** On a confirmed booking, *Mark seated* → page refreshes, status pill flips to **Seated**, timeline gains a new dot. *Complete* it → done. The audit log (sign in as owner, then visit `/audit-log`) records each transition.
4. **Create a reservation.** Click *New reservation*. Pick party = 4, today's date — slots populate live from `/api/availability`. Click a time. The Table section appears, showing only tables that fit. Type a guest name in the search — returning guests appear with their visit count. Pick one (or just type a new guest's info), add an occasion, *Confirm*. You land on the detail page for the new booking.
5. **Floor plan.** Visit `/floor`. Sections render as separate SVG panes at their saved coordinates, with each table coloured by current state (free / booked-soon / seated). Click a table — the side panel shows its day's reservations and a *Mark seated* shortcut. Now click an entry in the **Unassigned** panel — the floor enters seating mode (banner across the top, tables that don't fit are dimmed). Click a fitting table → assigned, refresh.
6. **Waitlist.** Visit `/waitlist`. Add a walk-in with the form on the right (just name + party size is enough). The new entry shows up on the left with elapsed-time tracking. Hit *Notify* → it turns warning-coloured. Hit *Seat* → it leaves the active list.

Sign in as `staff@mariosbistro.com` to see how RBAC narrows things — staff can view and seat but cannot create or cancel.

---

## Phase 3 — Public Booking Widget ✅

Phase 3 delivers the guest-facing side: a white-label booking page at `/book/[tenantSlug]` that runs on the same availability engine the host uses. Anyone with the link can book; bookings flow straight into the host's reservation list.

### New routes

| Route | What it does |
|---|---|
| `/book/[tenantSlug]` | Guest-facing booking flow — two steps, mobile-first, branded with the tenant's primary color |
| `/book/[tenantSlug]/confirmed/[code]` | Confirmation page — stable URL guests can refresh, share, or bookmark; includes Google Calendar add-event link |

### What ships under the hood

- **Public booking service** (`src/server/services/public-booking.service.ts`): tenant lookup by slug, public availability that wraps the Phase 2 engine (no auth context required), public booking creation, and confirmation lookup. Tenant scoping comes from the URL slug; the same `tenantDb()` extension keeps cross-tenant access structurally impossible.
- **Server-side availability re-check on submit.** Even though the client re-fetches whenever the date or party changes, the server runs availability once more before committing — so a slot claimed in the seconds between picking and confirming gets a clean error instead of a silent overbook.
- **Auto guest upsert.** Every public booking finds-or-creates a `Guest` record by phone-then-email match. From their first online booking, returning guests start showing up in the host's typeahead with their visit count.
- **System-level audit entries.** Public bookings write to the audit log with `userId: null` and action `reservation.created.public`, so the owner can see exactly which reservations came from the widget.
- **One server action + one API route.** `submitPublicBookingAction` does the create. `/api/public/availability` powers the live time-slot grid as the guest changes party size or date.
- **White-label theming.** The booking layout reads `tenant.primaryColor` and exposes it as a CSS custom property `--brand`. Buttons, accents, and the confirmation banner pick it up automatically. Mario's Bistro happens to share the Tavola terracotta, but a tenant with `primaryColor: "#1E4D2B"` would get a deep-green widget without any other change.

### Demo script — try it out

Open a private/incognito window so you're testing as a guest, not as the logged-in host.

1. **Land on the widget.** Go to `http://localhost:3000/book/marios-bistro`. The page loads with Mario's branding — name in the header, cuisine + price tier subtitle, footer with phone and address. The "Powered by Tavola" link in the footer goes to your root site.
2. **Search availability.** Section 01: pick party = 4. Section 02: time slots load live within ~200ms — the same engine the host uses, returning the same windows. Pick a time → "Continue →" button at the bottom enables.
3. **Enter details.** Section 03 collects name, email, phone (all required; the form validates inline). Section 04 is occasion + special requests (both optional). The "Selected" card at the top reminds you of the date/time/party. Hit *Confirm reservation*.
4. **Land on confirmation.** URL changes to `/book/marios-bistro/confirmed/[code]`. Big terracotta checkmark, confirmation code in monospace, all the booking details, "Add to Google Calendar" button (opens a real GCal event-create URL), call/email links to the restaurant. Refresh the page — it stays. Share the URL — it works for anyone.
5. **See the host side.** Open another tab, sign in as `host@mariosbistro.com`. Go to `/reservations` — the booking you just made is there, with `source = ONLINE_WIDGET`, status auto-confirmed (because the seed sets `autoConfirm: true`). The guest is in the system; their phone/email is searchable; if they book again later, the typeahead will surface them.
6. **Check the audit log.** As owner, visit `/audit-log`. The new reservation has an entry with action `reservation.created.public` and "Who" = `system`. Every guest-initiated booking is traceable.

Edge cases worth poking:
- Try to book a Monday — Mario's is closed Mondays, you'll see "Closed on this day" instead of empty slots.
- Set party size to 13 — past the configured `maxPartySize`, you get the "please call us directly" hint with the restaurant's number.
- Hit `/book/does-not-exist` — clean editorial 404, no server error.

---

## Phase 4 — Guest CRM ✅

Phase 4 turns the guest records that have been quietly accumulating from Phase 2 (reservation creation) and Phase 3 (public bookings) into a full CRM.

### New routes

| Route | What it does |
|---|---|
| `/guests` | Searchable, sortable, filterable guest list with VIP and tag filters |
| `/guests/new` | Create a guest manually (forms with allergy / dietary chip multi-input) |
| `/guests/[id]` | 360° profile — stats, tags, notes, reservation history, preferences, marketing opt-ins |
| `/guests/[id]/edit` | Edit profile + danger-zone delete with type-to-confirm |
| `/api/guests/export` | CSV download of every guest with denormalized metrics + tags |

### What ships under the hood

- **Guest service** (`src/server/services/guest.service.ts`): list with multi-filter (search across name/email/phone, VIP filter, tag filter, has-notes, returning-only) and four sort orders (name / last visit / spend / visits); detail with notes (pinned first) + tags + last 50 reservations; create with dupe detection on phone & email; update with marketing-opt-in transition tracking; delete (cascades notes + tag assignments, preserves reservation history via the denormalized name fields); CSV export (escaping included); helper `recomputeGuestMetrics` for the denormalized totals.
- **Note service** with author-aware permissions: anyone with `guest.note.create` can add a note; only the author or a manager+ can edit/delete an existing one.
- **Tag service** with auto-tag protection: the seed creates auto-tags ("VIP", "Birthday this month") that the engine recomputes — manual unassign is rejected with a clear message so they don't flicker back on next pass.
- **Three sets of server actions** wrap the services with the standard `ActionResult` pattern, all calling `revalidatePath` for the affected pages so the UI updates without a full reload.
- **Audit log** captures every mutation: `guest.created`, `guest.updated` (with field-level diff), `guest.deleted`, `guest.note.created/updated/deleted`, `guest.tag.assigned/unassigned/created`, and `guest.exported`.

### Demo script — try it out

Sign in as `manager@mariosbistro.com` (or owner). The sidebar's **Guests** link is no longer "Soon".

1. **Browse the list.** `/guests` opens to ~200 seeded guests, sorted by last name. Try the search box — type "ja" or a phone number prefix. Click the column headers (Visits / Spend / Last visit) to re-sort. Click the **VIPs only** filter chip — only ~15 names remain, all with the VIP or Celebrity badge. Click a tag chip in the Tags filter row — multi-select supported, count shown next to each tag, auto-tags labeled `auto`.
2. **Open a profile.** Click any returning guest. The header shows initials avatar, name, VIP badge, click-through phone/email. The five-tile stat strip shows total visits, lifetime spend, average spend, no-shows (warning-colored if > 0), and a relative last-visit timestamp.
3. **Tags.** Click *+ Add tag* — a small picker shows unassigned tags with their dot color. Click one to assign; it appears as a chip with an × to remove. Click *Create a new tag…* at the bottom, type a name, pick a color, hit Create — it's instantly assigned to this guest and lives in the global tag list. Try removing an auto-tag — clean error toast: *"VIP" is an auto-tag and can't be removed manually*.
4. **Notes.** Click *Add a note*. The seed has 15 pinned notes already on top guests — find one and try unpinning, deleting (confirm prompt), or adding another. Pinned notes get the warm primary tint and float above older notes with a divider.
5. **Reservation history.** The right column on the profile shows upcoming reservations highlighted, then past ones grouped under a fold-out "Show N more" if there are over 5. Click any to jump to its detail page. Hop back via the Back link → reservation detail's right sidebar now has an "Open profile" link instead of the old "Phase 4" placeholder, completing the loop.
6. **Edit + delete.** Click *Edit profile*. Change VIP status with the chip toggles. Add an allergy with the chip multi-input ("Peanuts" + Enter). Toggle marketing email opt-in — the audit log will record the transition with a timestamp. Save. Scroll down: the danger-zone delete requires you to type the guest's full name to confirm.
7. **CSV export.** From the list page, click *Export CSV*. The browser downloads `guests-YYYY-MM-DD.csv` with 18 columns including denormalized metrics, marketing opt-ins, and tag list. Audit log records the export with `guest.exported` and the row count.
8. **End-to-end loop.** In an incognito tab, book through the public widget at `/book/marios-bistro` as a brand-new guest. Submit. Hop back to the dashboard, search the guest list for the email you just used — they're there. Open their profile — you'll see the booking under "Upcoming."

---

## Phase 5 — Loyalty ✅

Phase 5 turns the CRM into a monetization engine. Points accrue automatically on completed reservations, tiers reward your top guests, and the reward catalogue gives them something to redeem. The existing data flow (reservation completes → guest metrics recompute → loyalty earns) means it all just plugs in.

> **Schema change** — Phase 5 adds two fields to `Reservation`: `spendAmount` (Float?) and `spendRecordedAt` (DateTime?). Run `pnpm db:push` (or `pnpm db:migrate dev --name add_spend_loyalty`) before reseeding. The seed populates `spendAmount` on completed reservations and creates a full loyalty program (Friends of Mario · Bronze/Silver/Gold · 4 rewards · backfilled accounts and transactions for every guest with visits).

### New route + new card

| Surface | What it does |
|---|---|
| `/loyalty` | Program rules, tiers, reward catalogue, top guests, recent activity |
| `/guests/[id]` *(sidebar)* | Loyalty card with tier, current/lifetime points, progress to next tier, perks, redeem buttons, recent transactions, manual adjust |
| `/reservations/[id]` *(new section)* | Spend recorder — type a check total, see the points preview, save → guest's account is awarded |

### What ships under the hood

- **Loyalty service** (`src/server/services/loyalty.service.ts`): `getOrCreateProgram` (so `/loyalty` is never empty — owners land in a sensible disabled-by-default state); tier CRUD; reward CRUD; `getAccountForGuest` and a private `ensureAccount` so accounts spring into existence on first earn; `awardForReservationComplete` (called from the reservation state machine when action=complete); `adjustPoints` (manager-grade manual grant/revoke); `redeemReward` (snapshots the points cost at redemption time so future price changes don't retroactively affect issued codes); `applyPointsAndRecomputeTier` (single source of truth for "delta points → recompute tier"); `getLeaderboard` and `recentTransactions` for the admin dashboard.
- **Hooked into the reservation state machine.** In `reservation.service.ts → transitionReservation`, when `action === "complete"`, we dynamically import the loyalty service and call `awardForReservationComplete`. Failures are logged but never roll back the completion — the host has done their job; loyalty reconciles separately if needed.
- **Spend recording with retroactive correction.** `recordReservationSpend` on completed reservations writes an `ADJUST` transaction equal to the spend delta × pointsPerDollar, so editing a check total after the fact never leaves the guest's points stale. Pre-completion spend changes just pile up — the completion handler awards the final total.
- **Tier auto-promotion.** Every `EARN` or `ADJUST` runs through `applyPointsAndRecomputeTier`, which finds the highest tier the new lifetime total qualifies for and assigns it. Watching a guest climb in real time is satisfying.
- **Three new server actions** for the admin (`updateLoyaltyProgramAction`, tier and reward CRUD, `adjustPointsAction`, `redeemRewardAction`, `recordSpendAction`).
- **Audit log covers everything**: `loyalty.program.updated`, `loyalty.tier.created/updated/deleted`, `loyalty.reward.created/updated`, `loyalty.adjusted` (with reason for compliance), `loyalty.redeemed` (with redemption code), `reservation.spend.recorded` (with before/after).

### Demo script — the showcase

Sign in as `owner@mariosbistro.com`. The sidebar's **Loyalty** link is no longer "Soon".

1. **Open `/loyalty`.** Program is already active — you'll see "Friends of Mario" with the description, the three-section layout (rules / tiers / rewards), the leaderboard with the top guests, and a live recent-activity feed.
2. **Edit the rules.** Change "Points per dollar" from 1 to 2 → the example calculator on the right (a $100 visit = X points) updates as you type. Save. The audit log gains a `loyalty.program.updated` entry.
3. **Browse the tiers.** Bronze/Silver/Gold cards with the tier color, threshold, multiplier, and perks. Click the pencil icon on Silver → edit form replaces the card, add a perk like "Complimentary digestif", save → it appears on the card.
4. **Add a reward.** *Add a reward* button → form expands inline → "Glass of prosecco", 600 points → Create. New row in the reward list. Hide an existing reward with the *Hide* button; the row dims out.
5. **Open a top guest** from the leaderboard. The guest profile now has a Loyalty card at the top of the right sidebar — tier badge with the tier's color, current/lifetime points side-by-side, a progress bar to the next tier showing exact points remaining, the tier's perk list, redeem buttons for each active reward (greyed out if they can't afford), and recent transactions.
6. **Redeem a reward.** Click a reward they can afford → confirm → toast with the redemption code (`Redeemed — code ABC12345`). Points drop, transaction appears in recent activity, the audit log records it.
7. **Grant a manual adjustment.** *Manual adjust* button → +250 with reason "Service recovery — overcooked steak". Apply. The card refreshes, you'll see the transaction with `ADJUST` and the reason. Owner-only by permission.
8. **The full loop — earn on completion.** Open `/reservations` and find any **Confirmed** booking for today. Mark it seated, then mark it completed. Open the booking → a new "Check total" recorder appears in the main column. Type 142.50 → live points preview shows "≈ 285 loyalty points (1.25× tier bonus)" if the guest is Silver. Save. Hop to the guest profile — the loyalty card has the new transaction at the top of recent activity, points went up, and if they crossed a tier threshold, the tier badge upgraded automatically.

Sign in as `staff@mariosbistro.com` to verify the RBAC narrowing — staff can view the loyalty card (`loyalty.view`) but the redeem/adjust buttons disappear (they lack `loyalty.manage`).

---

## Phase 6 — Marketing automation ✅

Phase 6 replaces the Phase 3 confirmation-email stub with a real Resend integration, adds SMS via Twilio, and ships the rest of the marketing stack: editable templates with token interpolation, segments built from any combination of VIP / tags / loyalty tier / visit history / opt-in, and campaigns that send via a synchronous fire-loop (good enough for the demo scale; Phase 9 wraps it in a queue).

> **No schema changes.** The marketing models (`MessageTemplate`, `Segment`, `SegmentMember`, `Campaign`, `CampaignRecipient`) have been in `schema.prisma` since Phase 1 — they finally get a UI. Re-run `pnpm db:seed` to get default templates + sample segments + a past campaign for the dashboard.

> **No new dependencies.** Both Resend and Twilio are reached over plain `fetch` to their REST APIs. No SDKs, no extra `pnpm install`.

### Dev mode is built in

If `RESEND_API_KEY` (and the Twilio creds) aren't set in `.env.local`, the providers fall back to **console logging** — every email/SMS the system "sends" prints a compact summary to your `pnpm dev` terminal with the recipient, subject, message ID, and a delivery mode flag of `console`. The rest of the pipeline (CampaignRecipient rows, audit log entries, `confirmationSentAt` timestamps) works identically. This means you can verify the entire wire end-to-end without buying anything; flip the keys on later for real delivery.

### New route + new section

| Surface | What it does |
|---|---|
| `/marketing` | Templates / Segments / Campaigns admin — single page, three sections |
| Reservation detail | `confirmationSentAt` is now stamped (visible in the timeline) when the email actually goes out |

### What ships under the hood

- **`messaging/email.ts`** — Resend HTTP wrapper. Returns `{ ok: true, providerMessageId, mode }` either way; the caller never branches on dev vs prod.
- **`messaging/sms.ts`** — Same shape, Twilio under the hood.
- **`messaging/render.ts`** — `{{token}}` interpolation. Unknown tokens render as empty so a typo in a template never crashes a campaign. Also exports `extractTokens()` so the template editor can show which variables are in use.
- **`messaging/transactional.service.ts`** — `sendBookingConfirmation` and `sendCancellationNotice`. They resolve a tenant-defined `MessageTemplate` first (looking up by category — `booking_confirmation` or `cancellation`); if none exists, they fall back to a sensible inline default. Wraps the rendered HTML in a minimal branded email shell (Tavola palette, inline-styled, table-based — survives any email client).
- **`message-template.service.ts`** — CRUD. On save, `variables` is recomputed via `extractTokens` so the list of tokens in use is always accurate. System templates (seeded with `isSystem: true`) can be edited but not deleted.
- **`segment.service.ts`** — the rules engine. `rulesToWhere()` translates a `SegmentRules` JSON object into a Prisma `where`, then `refreshSegmentMembers()` materializes `SegmentMember` rows so campaigns read pre-computed recipients instead of re-running the engine at send time. `previewSegmentCount()` is a fast read used by the segment builder UI for live "Will reach X guests" feedback.
- **`campaign.service.ts`** — `sendCampaign()` walks the segment's members, filters by opt-in (`marketingEmailOptIn` for email, `marketingSmsOptIn` for SMS), renders the content per-guest with their context, calls the provider, and writes a `CampaignRecipient` row in the appropriate state. Recipients with no email/phone get `FAILED — No contact info`; opted-out get `UNSUBSCRIBED`. Campaign status flips through `DRAFT → SENDING → SENT|FAILED`.
- **Hooked into the existing pipelines.**
  - `public-booking.service.ts → createPublicBooking()` now fires `sendBookingConfirmation` after `revalidatePath`. Fire-and-forget — a Resend hiccup never fails a booking.
  - `reservation.service.ts → transitionReservation()` fires `sendCancellationNotice` after a successful `cancel` action.
- **Audit log captures it all**: `messaging.confirmation.sent` (system-level via `writeAuditPublic`), `messaging.cancellation.sent`, `template.created/updated/deleted`, `segment.created/updated/deleted`, `campaign.created`, `campaign.sent` (with sent/failed/recipient counts).

### Demo script — start in your dev terminal

Sign in as `owner@mariosbistro.com`. **Marketing** is now active in the sidebar.

1. **The end-to-end wire — book + confirm.** Open an incognito tab, hit `http://localhost:3000/book/marios-bistro`. Walk through a booking. Submit. Watch your `pnpm dev` terminal:

   ```
   📧 [email/console] → mario.demo@example.com
      From:    Mario's Bistro <no-reply@tavola.app>
      Subject: Your reservation at Mario's Bistro is confirmed
      ID:      console_1747...
   ```

   Hop to the host dashboard, find the booking — the timeline now has a "Confirmation sent" dot. The audit log shows `messaging.confirmation.sent` with the template source (`tenant` since the seed creates one) and mode (`console`).

2. **Cancel one.** Open any confirmed reservation, hit *Cancel*. Terminal shows a cancellation email going out. Timeline updates.

3. **Edit a template.** `/marketing` → **01 Message templates**. Click the pencil on "Booking confirmation". The editor opens inline with the subject, the HTML body, and a "Tokens — click to insert" panel on the right showing every supported variable. Click `{{firstName}}` — it inserts at the end of the body. Save. The next booking confirmation will use your edited copy.

4. **Build a segment.** `/marketing` → **02 Segments** → *New segment*. The builder shows: VIP status chips, tag chips, loyalty tier chips, min visits, days since last visit, "must be opted in to marketing email" toggle. As you tweak, the right panel updates in real time — *Live preview: 24 guests*. Save. The new segment appears in the list with the member count badge.

5. **Refresh a segment.** As guests check in, member lists drift. Click the refresh icon on a segment — it re-runs the rules and updates the member set. Toast tells you the new count.

6. **Send a campaign.** **03 Campaigns** → *New campaign*. Name "April happy hour blast". Pick the **VIPs & Celebrities** segment (the seed created it). Optionally start from a template — the *Winback — we miss you* template pre-fills subject + body. Right panel shows "Will reach 12 guests". Tick *Send immediately*. Hit *Create & send*. Watch the terminal — one email per recipient flying past. Campaign appears at the top of the list with status `SENT`, plus delivery stats and the open/click rates (zero for now, no real tracking yet).

7. **Inspect deliveries.** The seed already has a past campaign — "Winback — last month's lapsed regulars" — with sample CampaignRecipient rows in various states (DELIVERED / OPENED / CLICKED / BOUNCED). Useful for seeing what real campaign analytics look like before you've actually sent any.

### Going live

Set `RESEND_API_KEY` in `.env.local`, restart `pnpm dev`. The Phase 6 banner at the top of `/marketing` ("Resend not configured") disappears. Try a fresh booking and the email lands in your inbox instead of the terminal. Same for `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_PHONE` for SMS.

---

## Phase 7 — Analytics ✅

Phase 7 surfaces six phases of captured data on one screen. The seed already gives you ~500 reservations spread across 200 guests with realistic spend, completion/no-show/cancellation rates, party sizes, and source mix — so every chart on `/analytics` has real signal the moment you log in. Everything is server-rendered with **pure SVG and CSS — no Recharts, no Chart.js, no client-side chart library**. Initial load is one round-trip to a single page.

> **No schema changes, no new dependencies.** Charts are raw `<svg>` plus a few CSS-grid heatmaps. Easy to inspect, easy to restyle.

### One page, six sections

| Section | Component | Data window |
|---|---|---|
| **01 · Last 30 days** | KPI strip — covers, revenue, avg check, no-show rate, cancel rate | 30d vs prior 30d |
| **02 · Volume & revenue** | Dual-axis time series — covers (area) + revenue (line) | 90d |
| **03 · Service patterns** | Day × hour heatmap of cover intensity + booking source mix | 60d / 30d |
| **04 · Retention** | Classic cohort grid — % returning by month-after-first-visit | 6 cohorts |
| **05 · Top guests & tables** | Top guests by lifetime spend + hardest-working tables (turns) | all time / 90d |
| **06 · Programs** | Loyalty pulse (earn/redeem/burn rate, tier distribution) + Marketing pulse | 30d |

### What's behind it

- **`analytics.service.ts`** is the single data layer. Every method takes the `AuthedContext`, checks `analytics.view`, and uses the tenant Prisma extension so cross-tenant leaks remain structurally impossible. Aggregations are intentionally one-round-trip-each — for the KPI summary, both the current and prior period fire in parallel and then split in-memory by status, so it's two queries (current period + prior period) regardless of how many KPIs we surface.
- **`getKpiSummary` computes deltas correctly for "good" vs "bad" metrics.** Revenue going up is green; no-show rate going up is red. The `tone="inverse"` flag on the KPI tile flips the color logic. The delta unit also adapts — counts get "%", rates get "pt" (point-difference).
- **`getCohortRetention` is the showcase.** For each guest with a `firstVisitAt` in the window, it computes the monthOffset of every completed reservation against that anchor, then dedupes via a `Set<guestId>` per bucket so a guest with three visits in month-1 counts once. The grid is naturally triangular (older cohorts have more visible months).
- **`getServiceHeatmap`** buckets reservations by `(dayOfWeek, hour)` over the last 60 days. The grid uses `hsl(var(--primary) / opacity)` for intensity so it inherits the terracotta accent and looks consistent in light + dark themes.
- **Charts are SVG strings, not React-Recharts trees.** Result: every chart you see on `/analytics` is part of the server-rendered HTML — no client JS payload, no flash-of-empty-chart, no hydration tax. The price is no real interactivity (hover-tooltips use native `title` attributes); a Phase 9 polish item if you want richer interactions.
- **Permissions.** `analytics.view` is owned by OWNER, ADMIN, MANAGER. HOST + STAFF land on `/dashboard` if they try to navigate there.

### Demo script

Sign in as `owner@mariosbistro.com`. **Analytics** is no longer "Soon" in the sidebar — that link should be your destination.

1. **The KPI strip** loads instantly. Hover the delta arrows: green means the metric improved, red means it got worse, and the unit ("%" vs "pt") tells you whether the change is multiplicative or additive. Cancel rate and no-show rate use inverse tone — going down is green.
2. **The time-series chart** is dual-axis: terracotta-filled area is covers (left axis), foreground line is revenue (right axis). 90 days of demo data has visible weekly cadence and weekend spikes.
3. **Hover any heatmap cell** — title-attribute tooltip shows "Sat 7p · 38 cov · 9 bookings". The hotspot pattern (Fri–Sat dinner) jumps out immediately.
4. **The cohort grid** is the favourite. Each row is a first-visit month, columns are months-after. Earlier cohorts have more visible months → triangular shape. Color intensity scales with retention %. The seed produces realistic stickiness — month-0 is always 100%, month-1 hovers ~25–40%, then decays.
5. **Top guests** is clickable — go straight to a guest's profile and see why they're #1 (multiple visits, big spend, possibly VIP-tagged).
6. **Loyalty pulse** shows the burn rate (redeemed ÷ earned) — a tell for whether your rewards are priced right. The tier-distribution bar shows the Bronze/Silver/Gold mix at a glance.
7. **Marketing pulse** shows the campaigns sent and the aggregate open/click rates across the 30-day window. The seed includes one past Winback campaign with realistic engagement, so this card has data on first load.

### Architecture notes

- The page uses `Promise.all` to fan out nine aggregations on first render. Postgres handles this fine (each query is selective via the tenant index); on slow connections you could split into a Suspense streaming pattern, but for the demo dataset it's well under 200ms total.
- **Time-zone caveat.** Server-side `Date.getHours()` returns UTC on Vercel. For a US restaurant whose 8pm reservation is stored as 1am UTC, the heatmap would bucket it into the wrong column. The Phase 9 polish phase will add tenant-timezone awareness via `date-fns-tz`; for the seed (which uses local-time dates), the heatmap looks correct in dev.

---

## Phase 8 — Integrations ✅

Phase 8 opens the system up to the outside world. Three integration surfaces, each independently usable: **Stripe deposits** for booker prepayments, a **versioned public REST API** authenticated by API keys, and **outbound webhooks** with HMAC signing and a full delivery ledger. Settings live at `/settings/integrations`.

> **Schema additions** — two new models (`Payment`, `WebhookDelivery`), two new enums (`PaymentStatus`, `WebhookDeliveryStatus`), four new fields on `Tenant` (per-tenant Stripe credentials), and two new fields on `ReservationSettings` (`depositPerPerson`, `depositRefundPolicy`). Run `pnpm db:push` (or `pnpm db:migrate dev --name integrations`) before re-seeding. The Webhook + ApiKey models were already there from Phase 1 — they finally get wired up.

> **No new dependencies.** Stripe is reached over its REST API (same playbook as Resend/Twilio in Phase 6). HMAC signing uses the Web Crypto API.

### What ships

#### A. Stripe deposits (booker → restaurant)

- **Per-tenant Stripe credentials.** Each restaurant brings their own keys — we don't charge anything against a platform Stripe account. In production this would be Stripe Connect; for the demo we accept a raw restricted/test key per tenant. Settings live at `/settings/integrations` → 01 Stripe & deposits.
- **Stripe Checkout, not Elements.** When a tenant has deposits enabled and a guest books through the public widget, we create a Checkout Session (`mode=payment`, `payment_method_types=card`) and redirect them to Stripe's hosted page. They never see our payment form; we never see their card data.
- **Reservation → Payment 1:1.** A new `Payment` row is created in `PENDING` when the Checkout Session is created. On `checkout.session.completed` or `payment_intent.succeeded`, the row flips to `AUTHORIZED` with the chargeId and receiptUrl. On failure, `FAILED` with the error message. Refunds set `REFUNDED` (full) or `PARTIAL_REFUND` (partial) and stamp `refundedAt`.
- **Webhook receiver** at `/api/webhooks/stripe`. Verifies Stripe's signature using HMAC-SHA256 with the tenant's `stripeWebhookSecret`, validates the 5-minute timestamp tolerance, then dispatches by event type. We pull the tenant from the metadata Stripe carries on the session (we set `metadata[tenantId]` when creating it), so a single endpoint serves every restaurant.
- **Refund from the reservation detail page.** When a payment is `AUTHORIZED` and the host has `integration.manage`, a *Refund deposit* button appears below the payment card. Click → Stripe API refund → local Payment row updated → audit log entry → outbound `payment.refunded` webhook fan-out.

#### B. Public REST API (`/api/v1/*`)

Versioned, authenticated by API key in an `Authorization: Bearer rk_live_…` header. Keys are stored as SHA-256 hashes (we never store plaintext); when you create one, the panel reveals it exactly once with a copy button and a warning.

| Endpoint | Scope | Description |
|---|---|---|
| `GET /api/v1/reservations` | `reservation:read` | Paginated, filterable by `from`, `to`, `status` |
| `GET /api/v1/reservations/:id` | `reservation:read` | Full detail incl. timeline + payment |
| `POST /api/v1/reservations` | `reservation:write` | Third-party booking creation |
| `GET /api/v1/guests` | `guest:read` | Paginated + searchable by `q` |
| `POST /api/v1/guests` | `guest:write` | Create/dedupe by email or phone |

- **Scoped keys.** Each key carries a set of scopes (`reservation:read`, `reservation:write`, `guest:read`, `guest:write`, `table:read`). The `requireScope()` helper rejects requests missing the scope with `403 insufficient_scope`.
- **Tenant isolation.** The API auth helper returns an `ApiContext` carrying a tenant-scoped Prisma client via the same `tenantDb()` extension the host UI uses. No cross-tenant escape hatch.
- **Idempotent guest creation.** `POST /api/v1/guests` dedupes by email or phone — if a match exists, return it with `_existing: true` so the partner doesn't accidentally create duplicates.
- **Errors are structured.** All non-2xx responses look like `{ "error": { "code": "...", "message": "..." } }` — easy to handle on the client side.

#### C. Outbound webhooks

- **Endpoint management** at `/settings/integrations` → 03 Webhooks. Add a URL, subscribe it to one or more events from the catalog (`reservation.created`, `.seated`, `.completed`, `.cancelled`, `.no_show`, `guest.created`, `payment.authorized`, `payment.refunded`), and you immediately see a signing secret you save somewhere safe (one-time reveal with copy button, same UX as the API keys).
- **HMAC-SHA256 signing.** Every delivery carries an `X-Tavola-Signature: sha256=…` header computed over the raw JSON body using the endpoint's secret. Receivers verify by recomputing.
- **Sync retries on 5xx.** Three attempts with 500ms / 1.5s backoff. 4xx responses skip retry (the receiver is intentionally rejecting). 8-second per-attempt timeout via `AbortSignal.timeout`.
- **Delivery ledger.** Every attempt — success or failure — writes a `WebhookDelivery` row with the event, payload, response code, attempt count, and any error message. The settings page shows the latest 25 deliveries with status icons and HTTP codes. Forensic visibility when things break.
- **Wired into the right places.** `reservation.service.ts → transitionReservation` fires the matching event on every successful seat/complete/cancel/no_show. `public-booking.service.ts → createPublicBooking` fires `reservation.created`. The `payment.service.ts` fires `payment.authorized` (from the Stripe webhook handler) and `payment.refunded`. Same fire-and-forget pattern as Phase 6 messaging — a slow receiver doesn't slow down the host flow.

### Demo script

**Sign in as `owner@mariosbistro.com`.** Settings is no longer "Soon" in the sidebar.

1. **Hit `/api/v1/reservations` with no auth** — you get `401 missing_credentials`. Same with a wrong key — `401 invalid_credentials`. The API surface is locked by default.

2. **Issue an API key.** `/settings/integrations` → 02 API keys → *New API key* → name "Demo integration", check `reservation:read` + `guest:read` → Create. Big warning box appears with the plaintext key revealed once. Copy it.

   ```bash
   export TAVOLA_KEY="rk_live_…"
   curl -H "Authorization: Bearer $TAVOLA_KEY" \
     http://localhost:3000/api/v1/reservations?pageSize=3 | jq
   ```

   You get paginated JSON. Try without the `guest:read` scope and `/api/v1/guests` returns 403 `insufficient_scope`. Hop back to the panel — the key now shows "Last used just now".

3. **Create a webhook endpoint** pointing at something like [webhook.site](https://webhook.site). Subscribe to `reservation.created` + `reservation.completed`. Save → big warning box reveals the signing secret. Now book a reservation through the public widget at `/book/marios-bistro`. Within a second, you'll see the payload land in webhook.site. The `X-Tavola-Signature` header is there; verify it by recomputing `hmac_sha256(body, secret)`.

4. **Mark the booking as completed** from the host dashboard. webhook.site receives a second payload — `reservation.completed`. Hop back to `/settings/integrations` — *Recent deliveries* shows both, in order, with `HTTP 200`.

5. **Force a failure.** Edit the webhook to point at `http://localhost:9999/dead`. Cancel a reservation. Watch the delivery ledger — three attempts, then `FAILED` with the connection-refused error. Failure count on the endpoint badge goes up.

6. **Configure Stripe.** Settings → 01 Stripe & deposits → paste your test publishable key, secret key (`sk_test_…`), and webhook secret (`whsec_…`). Set deposit per person to `$20`. Toggle "Charge guest deposits" on. Save.

7. **Book again.** This time after submitting the form, you're redirected to Stripe's hosted Checkout page with a $40 deposit (2 guests × $20). Pay with `4242 4242 4242 4242 · 12/34 · 123`. Stripe redirects you to `/book/marios-bistro/confirmed/[code]?paid=1`. Hop to the reservation in the host dashboard — the new *Deposit* card shows `$40.00 · AUTHORIZED · Charged just now · View receipt →`.

8. **Refund.** Click *Refund deposit* on the reservation detail. Confirm. Stripe processes the refund. Payment card flips to `REFUNDED`, refundedAmount stamped, refundedAt stamped, `payment.refunded` webhook fires to any subscriber.

### Architectural notes worth pointing out

- **Single Stripe webhook endpoint, many tenants.** Most tutorials show one endpoint per app with a single signing secret in env. We invert that — tenants bring their own keys, and the endpoint looks up the right secret from `event.data.object.metadata.tenantId` before verifying. No global Stripe knowledge in our env at all.
- **Plaintext keys vanish forever after creation.** SHA-256 hash on store; `verifyApiKey` SHA-256s the presented key and looks up by hash. Compromise of the database doesn't compromise the keys.
- **WebhookDelivery is the source of truth.** Even if you point at a dead URL, the delivery row gets created up-front and updated in place. Three attempts, then FAILED. Lets you reason about webhook history independently of whether the receiver is currently up.
- **Outbound webhooks are fire-and-forget.** A slow receiver doesn't block the user-facing transition. Same architecture as Phase 6 messaging — `(async () => { ... })()` IIFE inside the action handler. The receiver's job is to ack fast and process async.
- **Reservation status remains the host's source of truth.** A booking through `POST /api/v1/reservations` lands as `CONFIRMED` immediately — no quarantine for third-party. Phase 9 polish could add a `PENDING_APPROVAL` lane if you want that workflow.

---

## Phase 9 — Polish & launch ✅

Phase 9 closes the loop. The remaining "soon" placeholders become real pages, public endpoints get rate limiting, the analytics heatmap finally respects tenant timezone, campaign emails carry a working unsubscribe link, and API routes log to your terminal in structured form. None of it is glamorous on its own — together they're what takes the build from "demo" to "ship it".

> **No schema changes.** Every field Phase 9 touches was already in the schema — `Tenant.timezone`, `Guest.marketingOptOutAt`, `Campaign.unsubscribedCount`. Phase 9 just wires them up.

### What ships

#### A. Rate limiting on public endpoints

- **In-memory token-bucket** (`src/server/rate-limit.ts`). Sliding window, per-key tracking, periodic GC to bound memory growth. Stateless API so swapping the Map for Redis is a one-line change when you go multi-instance.
- **Keyed by API key when present, IP otherwise.** Per-tenant API throttling for the partner surface; basic IP-bucketing for the public availability endpoint.
- **Standard headers** on every response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. 429 responses include `Retry-After` per RFC 6585.
- **Applied at**:
  - `GET /api/v1/reservations` — 60/min
  - `POST /api/v1/reservations` — 20/min
  - `GET /api/public/availability` — 30/min/IP (the public booking widget's hot path)

#### B. Tenant timezone for analytics

- The **service heatmap** finally buckets by tenant-local hour. A NYC restaurant's 8pm reservation lands in the 8pm column — not the 1am UTC column the way it did in Phase 7. Implemented via `Intl.DateTimeFormat` parts — no extra date library dep.
- Set via `Tenant.timezone` (already in the schema, defaults to `America/New_York`). A future minor release will surface a picker in Settings.

#### C. Operating hours editor (`/settings/hours`)

- One card per day, multiple shifts per day, time pickers for open/close, optional shift label ("Lunch" / "Dinner"). Replace-strategy on save — simpler and correct.
- Permissioned: manager and up can edit.

#### D. Team management (`/settings/team`)

- List every user with their role, last login, avatar initials. Owners/admins get a role dropdown and activate/deactivate buttons inline.
- **Hard-rail RBAC**: only owners can promote others to owner, only owners can deactivate other owners, no one can deactivate themselves.

#### E. Reservation rules editor (`/settings/rules`)

- Grid of all the knobs that were already in `ReservationSettings` but had no UI: lead time, slot duration, default dining duration, max party size, large-party threshold, auto-confirm, waitlist, confirmation/reminder email toggles, reminder hours-before.
- Manager and up; persists through `reservationSettings.update`.

#### F. Unsubscribe flow

- **Stateless HMAC-signed tokens** at `src/server/services/unsubscribe.service.ts`. Token format: `<guestId>.<tenantId>.<ts>.<sigBase64Url>` — signed with `AUTH_SECRET`. 90-day expiry. No per-guest token row needed.
- **Public page** at `/unsubscribe?token=…&campaign=…` — no auth, three states (success / already-opted-out / invalid). Branded with the tenant's primary color when found.
- **Wired into campaign sends.** Every campaign email now renders with an `unsubscribeUrl` in context and a "Don't want these emails? Unsubscribe." footer link. Click → guest's `marketingEmailOptIn` flips to false, `marketingOptOutAt` stamped, campaign's `unsubscribedCount` increments, audit log gets a `messaging.unsubscribed` entry.
- The next campaign send sees the guest as opted out and writes a `CampaignRecipient` row with `UNSUBSCRIBED — Not opted in`. The whole loop closes without any new database state.

#### G. Onboarding wizard (`/onboarding`)

- Owners landing here see a checklist of setup steps with green check / empty circle indicators: restaurant profile, operating hours, floor plan, reservation rules, guest tags, integrations.
- Each row links to the relevant settings page; the progress bar updates as completed steps are detected on the server. When everything's done, a "You're all set" card with the public booking widget URL.

#### H. Observability

- **`withRequestLog` wrapper** (`src/server/observability.ts`) — captures method, path, status, duration, API key prefix, IP. Logs to `console.log` with a tone glyph (`✓` / `→` / `!` / `✗`).
- Applied to `/api/v1/reservations`. In production this `console.log` becomes a `pino` / `winston` / structured logger that forwards to Datadog or Axiom — same interface, swap the implementation.

### Demo script

Sign in as `owner@mariosbistro.com`. **Settings**, no longer "Soon", is your destination.

1. **Hit the rate limit.** With your API key from Phase 8:

   ```bash
   for i in {1..70}; do curl -s -o /dev/null -w "%{http_code} " \
     -H "Authorization: Bearer $TAVOLA_KEY" \
     http://localhost:3000/api/v1/reservations?pageSize=1; done; echo
   ```

   You'll see `200`s until you hit 60, then `429`s. Your terminal logs each request with timing and key prefix.

2. **Edit operating hours.** Settings → Operating hours. Add a "Brunch" shift on Saturday at 10:00 → 14:00. Save. Open the public widget and try to book at 11am on a Saturday — your new shift makes it bookable.

3. **Change a teammate's role.** Settings → Team. Change `host@mariosbistro.com` from HOST to MANAGER. They can now access analytics and edit settings.

4. **Tweak reservation rules.** Settings → Reservation rules. Set max party size to 10. Open the booking widget — the party-size picker maxes at 10.

5. **The unsubscribe loop.** Open Marketing, send the seeded VIP campaign. Watch one email log to your terminal — copy the unsubscribe URL out of the HTML body, paste into a browser. "You're unsubscribed" page. Go back to that guest's profile — `marketingEmailOptIn` is now false. Re-send the same campaign — that guest's CampaignRecipient row now shows `UNSUBSCRIBED`.

6. **Analytics, timezone-correct.** `/analytics` → service heatmap. The Fri-Sat dinner hotspot now sits at 7pm–9pm where it belongs (assuming `Tenant.timezone = "America/New_York"`), not somewhere in the wee hours.

7. **Onboarding.** Visit `/onboarding` as the owner. Six checklist rows light up green based on what's set up. Click any row → straight to that settings page.

### Architectural notes worth pointing out

- **Stateless unsubscribe tokens** are a small but meaningful win. Most CRMs store a per-guest opaque token in a column; we sign the guestId+tenantId+timestamp with `AUTH_SECRET` instead, get the same security properties, and never touch the database to issue a token. Re-issuing on every send is free.
- **Replace-strategy on operating hours** isn't the fanciest pattern, but it's correct without bookkeeping. The natural unit-of-work is "the full weekly schedule" — diff-and-update would have been more code for the same outcome.
- **Hard-rail RBAC on the team page** — only owners can demote owners; you can't deactivate yourself; the role dropdown disables OWNER for non-owners. These rules live in the server action because client-side checks are advice, not enforcement.
- **Rate limit headers on success too**, not just on 429. Lets a polite client (cron job, partner sync) back off as it approaches the limit instead of slamming into it.
- **`withRequestLog` is a higher-order function**, not Express-style middleware, because Next.js App Router doesn't have a middleware story for individual API routes. Same outcome via composition.

---

## Where the build ends

Nine phases, 150+ files of TypeScript, one schema with 30+ models, zero new top-level dependencies beyond what Phase 1 set up (Next 15, Prisma 5, Auth.js v5, TanStack Query, react-hook-form, Zod). Every external integration — Resend, Twilio, Stripe — reached over plain `fetch` against the REST API. Every chart on `/analytics` is server-rendered SVG. Every aggregation is one Prisma query.

What this product would still need to launch with real money:
- **Stripe Connect** instead of per-tenant restricted keys (so the platform takes a cut)
- **Background queue** (Inngest, Trigger.dev, or a simple Postgres-backed queue) for campaign sends bigger than a few thousand recipients
- **Real email deliverability tooling** — DKIM/SPF setup per tenant, bounce processing, reputation monitoring
- **Open/click tracking pixel + endpoint** to populate the marketing pulse with real numbers instead of synthetic seed data
- **Tenant-level invite flow** to replace `pnpm db:seed` as the team-onboarding path
- **A real timezone picker** in Settings → Restaurant profile (the field exists; the picker doesn't)
- **End-to-end and integration test suites** — the architectural patterns make this easy (service layer is transport-agnostic, tenant isolation is structural), but no tests ship with the demo

What this product already does that most production CRMs don't:
- **Structural multi-tenancy.** Cross-tenant data leaks are impossible by construction via the `tenantDb` Prisma extension. No `WHERE tenantId = ?` discipline required from the application code.
- **Tenant-scoped Stripe + tenant-scoped messaging credentials.** Each restaurant brings their own keys; we never have a platform-level Stripe account in env.
- **Stateless API key auth via SHA-256 hash.** Plaintext keys live in a copy-button reveal box for exactly one render.
- **HMAC-signed outbound webhooks with a full delivery ledger** — every attempt persisted, three retries with backoff, 4xx skips retry, forensic visibility when partners' endpoints misbehave.
- **A loyalty engine where every state transition runs through one path** (`applyPointsAndRecomputeTier`) so tier never drifts from lifetime points.
- **Pure-SVG analytics** — six chart types, zero client-side chart library, zero hydration cost.

---

## License

Proprietary — © Tavola.
