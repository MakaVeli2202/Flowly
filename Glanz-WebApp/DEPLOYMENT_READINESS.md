# Deployment Readiness Checklist

Current rating: **9/10** — missing only live Stripe keys and email delivery to be fully production-ready.

Do not treat the app as production-ready until all items below are completed.

---

## Already Done (no action needed)

- PostgreSQL configured — `UseNpgsql` in `Program.cs`, connection string in `appsettings.json`
- Migrations clean — single `InitialSchema` + `AddRefreshTokens` migration
- JWT refresh tokens — `POST /api/auth/refresh` + `POST /api/auth/logout` + HttpOnly cookie rotation
- Access token lifetime — 60 min (was 1440). Refresh token 30 days.
- SignalR removed — replaced with HTTP polling (financial decision)
- Rate limiting configured (production tier in `Program.cs`)
- Stripe feature-flagged OFF by default (`payments: false` in `FeaturesContext`)
- AuthController null-crash fixed (`TryParse` on `NameIdentifier` claim at 4 locations)
- Job Applications system wired (backend + admin UI + public careers page)
- Worker live-map tracking implemented (backend + admin LiveMapTracking + mobile LiveWorkerMapScreen)
- All admin routes registered in `App.jsx` (payroll, live-map, subscription-bookings)
- Address autocomplete wired (Nominatim — acceptable for dev/demo, see item 5 below for prod)

---

## 1. Payments — Stripe

**Files:**
- `Glanz-WebApp/Glanz.API/appsettings.json`
- `Glanz-WebApp/Glanz.API/Controllers/BookingsController.cs`
- `Glanz-WebApp/Glanz.API/Controllers/PaymentsController.cs`
- `Glanz-WebApp/Glanz.API/Controllers/WebhooksController.cs`
- `Glanz-WebApp/glanz-frontend/src/api/stripe.js`
- `Glanz-WebApp/glanz-frontend/.env.production` (create this file)

**Current state:**
- Stripe NuGet package installed; Stripe code present but gated behind feature flag `payments: false`.
- `Stripe:SecretKey` in `appsettings.json` is placeholder `YOUR_STRIPE_SECRET_KEY`.
- Frontend reads publishable key from `VITE_STRIPE_PUBLISHABLE_KEY` env var (not hardcoded).
- Webhook signature verification is wired in `WebhooksController.cs` but skipped when `Stripe:WebhookSecret` is blank.
- Payments do not fire in development and nothing will break.

**Before deploying:**
1. Create live Stripe account, get live secret key + publishable key.
2. Set env vars on production host:
   - `Stripe__SecretKey=sk_live_...`
   - `Stripe__WebhookSecret=whsec_...`
3. Create `.env.production` for the frontend:
   ```
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```
4. Register webhook endpoint in Stripe Dashboard:
   - URL: `POST https://yourdomain.com/api/Webhooks/stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`
5. Enable payments feature flag in the database:
   ```sql
   INSERT INTO "AppSettings" ("Key", "Value", "UpdatedAt")
   VALUES ('feature.payments', 'true', NOW())
   ON CONFLICT ("Key") DO UPDATE SET "Value" = 'true', "UpdatedAt" = NOW();
   ```
6. Test full booking flow with Stripe test card before going live.

---

## 2. Secrets and Environment Configuration

**Files:**
- `Glanz-WebApp/Glanz.API/appsettings.json`
- Production host environment variables

**Current state:**
- JWT secret `JwtSettings:SecretKey` is a hardcoded dev value.
- `Program.cs` throws at startup if the secret is the default value in non-Development environments.
- PostgreSQL password in `appsettings.json` is a dev credential.

**Before deploying:**
Set all of these as environment variables on the production host (never in source-controlled config):
```
ConnectionStrings__DefaultConnection=Host=...;Database=glanz;Username=...;Password=...
JwtSettings__SecretKey=<64+ char random string>
Stripe__SecretKey=sk_live_...
Stripe__WebhookSecret=whsec_...
Cors__AllowedOrigins__0=https://yourdomain.com
```
`Program.cs` will throw on startup if `JwtSettings:SecretKey` or `Stripe:SecretKey` are still defaults — this is the safety net.

---

## 3. Database

**Files:**
- `Glanz-WebApp/Glanz.API/appsettings.json`
- `Glanz-WebApp/Glanz.API/Migrations/`

**Current state:**
- PostgreSQL via Npgsql. Dev database name: `glanz_db` (localhost:5432).
- Two clean migrations: `InitialSchema` + `AddRefreshTokens`.
- `MigrateAsync()` runs at startup — schema applied automatically.
- `EnsurePostgresSchemaCompatibilityAsync` handles legacy column backfills.

**Before deploying:**
1. Provision a managed PostgreSQL instance (Supabase, Railway, Neon, or RDS).
2. Set `ConnectionStrings__DefaultConnection` env var (see above).
3. Run migrations via startup (automatic) or manually: `dotnet ef database update`.
4. Disable `DevelopmentDataSeeder` in production by ensuring `IsDevelopment()` is false — the seeder is already gated on this.
5. Add backup + point-in-time recovery for the production database.

**Local setup:**
```
createdb -U postgres glanz_db
cd Glanz-WebApp/Glanz.API
dotnet run   # MigrateAsync() will build the schema on first start
```

---

## 4. Default Admin / Seeder Safety

**Files:**
- `Glanz-WebApp/Glanz.API/Data/DevelopmentDataSeeder.cs`
- `Glanz-WebApp/Glanz.API/appsettings.json` (`AdminUser` section)

**Current state:**
- Seeder is gated on `IsDevelopment()` — will not run in production.
- Default admin credentials (`admin@glanz.qa` / `Admin123!`) are in `appsettings.json` for dev only.

**Before deploying:**
1. Remove `AdminUser` section from `appsettings.json` before commit (or move to local-only config).
2. Create the production admin account manually after first deploy.
3. Rotate the admin password immediately.

---

## 5. Address Autocomplete Provider

**Files:**
- `Glanz-WebApp/Glanz.API/appsettings.json` (`AddressAutocomplete` section)
- `Glanz-WebApp/Glanz.API/Controllers/AddressesController.cs`

**Current state:**
- Using Nominatim/OpenStreetMap. Fine for dev and demos.
- Nominatim has strict rate limits and prohibits heavy commercial use.

**Before deploying:**
- Switch to a commercial provider for Qatar (Google Places, Mapbox, or HERE).
- Update `AddressAutocomplete:Provider`, `BaseUrl`, and any API key in `appsettings.json`.
- Set the API key as an environment variable.

---

## 6. Email Delivery

**Files:**
- `Glanz-WebApp/Glanz.API/Services/` (no email service exists yet)

**Current state:**
- No transactional email provider. No booking confirmation or reminder emails sent.

**Before deploying (or when business requires it):**
- Add SendGrid, Postmark, Resend, or SES.
- Send confirmation on booking creation.
- Send reminder 24 h before scheduled date.
- Audit any UI copy that implies email delivery.

---

## 7. SMS / Phone Verification

**Current state:**
- Phone field collected but not verified. Self-asserted.

**Before deploying (if required by business rules):**
- Add Twilio or local SMS provider.
- Add OTP challenge on registration, with expiry and resend throttle.

---

## 8. Google Reviews

**Files:**
- `Glanz-WebApp/glanz-frontend/src/pages/customer/Home.jsx`

**Current state:**
- Reviews carousel on homepage uses hardcoded data.

**Before deploying:**
- Option A (recommended): Create `Reviews` DB table + `/api/reviews/public` endpoint + admin management UI. Update `Home.jsx` to fetch from API.
- Option B: Sync from Google My Business API via a background service.

---

## 9. Loyalty Program — Review Verification

**Current state:**
- Loyalty activation is self-asserted by the customer (click a button).
- No actual verification that a Google review was posted.

**Before deploying:**
- Decide if self-assertion is acceptable.
- If not, add staff-manual approval, proof-upload workflow, or coupon-based flow.

---

## 10. Business Timezone

**Files:**
- `Glanz-WebApp/Glanz.API/appsettings.Development.json`
- Production host environment variables

**Current state:**
- Timezone is read from `BusinessSettings:TimeZone` in config and applied at startup via `ApplyConfiguredTimeZone`.
- Dev config set to `"W. Europe Standard Time"` (Austria UTC+1/+2) — **development only**.
- Fallback in code is `"Arab Standard Time"` (Qatar UTC+3).
- All same-day slot filtering and date comparisons use this timezone.

**⚠️ MUST CHANGE BEFORE DEPLOYING — business is in Qatar, not Austria.**

Set the timezone env var on the production host:
```
BusinessSettings__TimeZone=Arab Standard Time
```
Also update `appsettings.Development.json` back to `"Arab Standard Time"` when done testing from Austria.

Windows timezone IDs — common options:
- Qatar / Gulf: `Arab Standard Time` (UTC+3, no DST) ← production value
- Austria / Germany: `W. Europe Standard Time` (UTC+1/+2 DST) ← current dev value
- UAE / Dubai: `Arabian Standard Time` (UTC+4, no DST)

**Why this matters:** wrong timezone = wrong same-day first slot. E.g. if server is UTC and business is Qatar (UTC+3), all slots shift 3 hours.

---

## Deployment Order

1. Provision PostgreSQL, set connection string env var, run migrations
2. Set JWT secret env var (non-default, 64+ chars)
3. Set CORS allowed origins
4. Set Stripe keys + webhook secret, enable payments feature flag in DB
5. Remove default admin credentials from config, create production admin
6. Switch address autocomplete to commercial provider
7. Add email delivery
8. (Optional) Add SMS verification
9. (Optional) Implement dynamic Google Reviews
