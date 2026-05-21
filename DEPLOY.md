# Deploying to Vercel

The app is a standard Next.js 15 project. Vercel handles the build automatically. Database is on Neon (already set up). This guide assumes you've already run `npm run db:push` and `npm run db:seed` against your Neon database.

## 1. Push to GitHub

From the project root:

```bash
cd c:\Users\mushi\Desktop\Khushnoor\restuarent-1\restaurant-crm-phase9\restaurant-crm
git init
git add .
git commit -m "Initial commit"
# Create an empty repo on github.com, then:
git remote add origin git@github.com:YOUR_USER/restaurant-crm.git
git branch -M main
git push -u origin main
```

Confirm `.env`, `.env.local`, and `node_modules/` are NOT being committed (they're in `.gitignore`).

## 2. Import on Vercel

1. Go to https://vercel.com/new and select your GitHub repo.
2. Vercel auto-detects Next.js — leave Build Command / Output as defaults.
3. **Important:** in "Root Directory" leave blank (the project sits at the repo root).

## 3. Set environment variables in Vercel

In the import screen ("Environment Variables" section), paste these:

| Name | Value |
|---|---|
| `DATABASE_URL` | `postgresql://neondb_owner:npg_ZsdaYOFpPD09@ep-dark-wave-aofywt6a.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` |
| `AUTH_SECRET` | Run `openssl rand -base64 32` and paste the result — **don't reuse the dev secret** |
| `AUTH_URL` | `https://YOUR-PROJECT.vercel.app` (update after first deploy if you change domains) |
| `NEXT_PUBLIC_APP_URL` | Same as `AUTH_URL` |
| `NEXT_PUBLIC_APP_DOMAIN` | `YOUR-PROJECT.vercel.app` (no protocol) |

**Optional** — leave blank to keep dev-mode console logging for emails/SMS:
| `RESEND_API_KEY` | from https://resend.com — required for real booking confirmation emails |
| `MAIL_FROM_EMAIL` | e.g. `reservations@yourdomain.com` (must be a verified Resend domain) |
| `MAIL_FROM_NAME` | `Mario's Bistro` |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_PHONE` | for SMS — leave blank to console-log |

Stripe credentials are **per-tenant** — they're configured at `/settings/integrations` inside the app, not as Vercel env vars.

## 4. Deploy

Click "Deploy". Vercel runs `next build` (which we've verified passes locally) and deploys. First deploy takes ~2 minutes.

## 5. After first deploy

1. Open `https://YOUR-PROJECT.vercel.app/login`.
2. Sign in as `owner@mariosbistro.com` / `password123`.
3. Go to **Settings → Restaurant profile** and change the contact info / branding for the real client.
4. **Change the seeded user passwords** — currently all 5 demo users share `password123`. Either delete the demo users and have the client register, or use Settings → Team to reset.
5. If `AUTH_URL` and the deployed URL don't match (e.g. you set a custom domain), update the env var in Vercel and redeploy.

## 6. Custom domain (optional)

In Vercel project → Settings → Domains, add your client's domain. Update `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and `NEXT_PUBLIC_APP_DOMAIN` to match, then redeploy.

The middleware supports subdomain-based tenant routing (e.g. `marios-bistro.yourdomain.com`). For that to work, you need a wildcard DNS A/CNAME pointing to Vercel. Skip this for a single-tenant deploy.

---

# Pre-deploy verification (what I just ran)

| Check | Result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors (~20 stylistic warnings — non-blocking) |
| `npm run build` | succeeds, 38 routes |
| Login as OWNER | session has `id`, `tenantId`, `role: "OWNER"` |
| All 17 dashboard routes load (200) | ✓ |
| RBAC redirect for HOST role on /analytics, /loyalty, /marketing, /audit-log, /settings/team, /settings/integrations | ✓ (all 307 to /dashboard) |
| Reservation detail page loads | ✓ |
| Guest detail + edit pages load | ✓ |
| Public booking widget (`/book/marios-bistro`) loads | ✓ |
| Public booking end-to-end: availability fetch → create → CONFIRMED reservation → confirmation email logged | ✓ |
| API v1 GET /reservations with valid Bearer key | ✓ paginated JSON |
| API v1 POST /reservations | ✓ returns 201 with confirmation code |
| API v1 POST /guests (idempotent by email/phone) | ✓ |
| API v1 with no auth | ✓ structured 401 error |
| 289 DB queries, 61 HTTP requests — runtime errors logged | 0 |

---

# Known non-blocking items

- **Rate-limit response headers (`X-RateLimit-*`) aren't attached.** The rate limiter still enforces limits (you'll get 429 past the threshold), but consumers can't see remaining quota until they hit 429. The `withRateLimitHeaders` helper exists but isn't wrapped around the v1 route responses. Polish-tier — not a blocker.
- **`pnpm` is referenced throughout the README but isn't installed locally.** All scripts work with `npm` as well; the README's `pnpm <script>` can be read as `npm run <script>`.
- **Email/SMS are in console-log mode** until `RESEND_API_KEY` / Twilio creds are set. The full pipeline (template rendering, CampaignRecipient rows, audit log) works identically either way — only the actual send is mocked. Use the dev terminal to verify the wire.
- **Seeded demo data ships in production.** If you want a clean slate for the client, run `npm run db:reset` against the Neon DB before final handoff (it drops, re-creates schema, re-seeds). To remove the seed entirely, edit `prisma/seed.ts` to be a no-op then run `db:reset`.
- **Stripe deposits + Twilio SMS + Resend emails are configured per-deployment, not per-tenant.** A multi-tenant SaaS would want each restaurant to bring their own — Stripe is already wired that way (`/settings/integrations`), but messaging providers are env-level globals. Acceptable for single-restaurant deployments; flag for the client if they plan to host multiple.

---

# Security reminders

- The Neon credential is in `.env`, `.env.local`, and in the chat transcript that produced this guide. **Rotate the Neon password before handing off.**
- `AUTH_SECRET` in `.env.local` was generated for development. **Generate a fresh one for the Vercel deploy** — don't reuse it.
- Seeded users all share password `password123`. Reset them in production (Settings → Team for role mgmt; for password reset, currently use Prisma Studio or write a quick script).
- The "Smoke test key" I minted to verify the v1 API is still in the database under API keys. **Delete it** at `/settings/integrations` before handoff.
