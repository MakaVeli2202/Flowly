# Glanz Deployment Readiness

## How to Publish

### 1. Frontend (React)
```bash
cd Glanz-WebApp/glanz-frontend
npm run build          # outputs to /dist
# Deploy /dist to hosting: Vercel, Netlify, Nginx, or IIS
```

Set the following environment variables before building:
```
VITE_API_BASE_URL=https://api.glanz.qa
VITE_STRIPE_PUBLIC_KEY=pk_live_...
```

### 2. Backend (.NET API)
```bash
cd Glanz-WebApp/Glanz.API
dotnet publish -c Release -o ./publish
# Deploy /publish to server (IIS, Azure App Service, or Linux + Nginx reverse proxy)
```

Required `appsettings.Production.json` keys:
```json
{
  "ConnectionStrings": { "DefaultConnection": "..." },
  "Stripe": { "SecretKey": "sk_live_...", "WebhookSecret": "whsec_..." },
  "Sms": { "ApiKey": "...", "SenderId": "Glanz" },
  "Jwt": { "Secret": "..." }
}
```

### 3. Database
- Run all pending EF migrations: `dotnet ef database update`
- Seed feature flags: `UPDATE AppSettings SET value='true' WHERE key IN ('feature.payments', 'feature.loyalty', ...)`

---

## Dev Settings Page

`/admin/dev-settings` — accessible only to admin users.

This page manages:

### Dev Overrides (localStorage, browser-only)
| Flag | Key | Effect |
|------|-----|--------|
| Bypass Google Review | `DEV_BYPASS_REVIEW` | Skips review-click check in loyalty UI |
| Bypass Payment | `DEV_BYPASS_PAYMENT` | Skips Stripe frontend guard |
| Silent SMS | `DEV_SMS_SILENT` | Logs SMS to console instead of sending |

**These have zero effect on the backend.** They are localStorage flags read by the frontend only. Clear them before deploying (`localStorage.clear()` or use the "Clear All" button on the page).

### Backend Feature Flags (DB-controlled)
Displayed read-only on the dev settings page. To change:
```sql
UPDATE AppSettings SET value = 'true'  WHERE key = 'feature.payments';
UPDATE AppSettings SET value = 'false' WHERE key = 'feature.slotReservation';
```

---

## Google Review Integration

**URL:** `https://g.page/r/CbY8wgSE0iXGEAE/review`

### How tracking works (and its limits)
Google does not expose a public API to verify whether a specific user left a review. The current implementation:

1. User clicks "Rate on Google" → URL opens in new tab
2. `localStorage.setItem('glanz_review_clicked', '1')` is set
3. The "I rated — unlock my counter" button becomes enabled
4. User clicks it → `POST /Offers/loyalty/activate-google-review` is called
5. Backend marks the user's loyalty counter as unlocked

**This is an honour system.** There is no technical way to confirm the review was submitted.
To bypass this during development, enable `DEV_BYPASS_REVIEW` on the dev settings page.

---

## Deployment Checklist

Use the interactive checklist at `/admin/dev-settings`. Items:

- [ ] Stripe live keys configured (backend + frontend)
- [ ] Stripe webhooks pointed at production URL
- [ ] SMS provider using live credentials
- [ ] Google review URL verified and working
- [ ] All `DEV_*` localStorage flags cleared
- [ ] Backend feature flags enabled as intended
- [ ] Frontend env vars pointing to production API
- [ ] HTTPS enforced (HTTP → HTTPS redirect)
- [ ] CORS restricted to production domain only
- [ ] 404 and 500 error pages tested
- [ ] Tested on real mobile device (iOS + Android)
- [ ] End-to-end booking flow tested with live payment

---

## What You Might Be Missing

| Area | Status | Notes |
|------|--------|-------|
| Email notifications | Needs wiring | Backend has SMS; email (order confirmation, receipts) not confirmed |
| Apple Pay / Google Pay | Not implemented | Stripe supports it — needs frontend Stripe Elements upgrade |
| Analytics | Not implemented | No GA4 / Hotjar / Clarity tag in the app |
| Cookie consent banner | Missing | Required by GDPR/PDPL if serving EU or Qatar residents |
| Rate limiting | Backend concern | Confirm API is rate-limited before going live |
| Sitemap + robots.txt | Not confirmed | Needed for SEO — check if it exists in /public |
| CSP headers | Not confirmed | Content-Security-Policy header on the server |
| Image optimisation | Not confirmed | Hero/package images should be WebP with lazy loading |
| Uptime monitoring | Not configured | Add UptimeRobot or similar for the API and frontend |
