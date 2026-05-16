## Session [2026-05-16]
### Goal
Home page styling polish (stats, service cards, holo effects, floating CTA) + full project audit.

### Decisions
- Stats cards: silver chrome text via background-position animated gradient, no gold flash
- Service cards dark mode: 1st/3rd get gold holo rim (same structure as popular card)
- Service cards light mode: all 3 get rainbow holo rim
- `--surface-bg` must never be transparent - breaks 30+ components; use `body { background: transparent }` for page bg
- SiteAccessGate: replaced blocking spinner with thin 2px animated top bar; settings cached in localStorage so load is instant on refresh
- SettingsContext: added localStorage cache (glanz.settings.v1), isLoaded=true immediately if cache exists
- glanz.css: double-quote `[data-theme="light"]` rules win over single-quote due to cascade - always edit double-quote block
- ProductionReadiness: ~35% - core booking engine solid, critical security/email gaps remain

### Files changed
- src/index.css (stat card silver, floating CTA holo, statGlow repurposed)
- src/styles/glanz.css (showroom card dark gold rim, light rainbow rim, responsive fix)
- src/pages/customer/Home.jsx (stat cards, feature stars, floating CTA, showroom card wrappers)
- src/components/layout/CustomerNavbar.jsx (light mode theming via CSS vars)
- src/components/layout/AdminHeader.jsx (full CSS var theming)
- src/context/SettingsContext.jsx (localStorage cache, instant isLoaded)
- src/components/shared/SiteAccessGate.jsx (thin bar instead of blocking spinner)
- DEPLOYMENT_READINESS.md (updated with audit findings)
- Glanz-WebApp/CLAUDE.md (fixed stale GetItCleaned paths, added dark mode pitfalls)

### Next steps
- Stripe webhook signature validation (critical before launch)
- Move JWT secret to env var
- Wire email provider (SendGrid or Postmark)
- Add API pagination to /Bookings/all
- Add Sentry error monitoring

### Blockers
- Email service completely unimplemented (all SMTP fields TODO) - password reset and booking confirmations broken

## Session [2026-05-14 18:00]
### Goal
Implement special closed days, favourite detailer feature, feature flags UI, and fix Dev controller 404.

### Decisions
- Closed days stored as JSON in SystemSettings key `booking.closedDates`, loaded at startup
- Feature flags stored as `features.{flagName}` in SystemSettings; ConfigController now reads/writes real DB
- Favourite Detailer is per-user opt-in (User.AllowPreferredWorker) toggled by admin in CRM
- Preferred detailer dropdown only appears for eligible customers (feature flag ON + user.AllowPreferredWorker)
- If detailer is off on selected day, slots return empty - user must pick another day
- GET /Auth/workers/active-names added (customer-accessible, requires auth) for dropdown
- DevController had missing api/ prefix on route - caused 404 for all dev testing panel buttons
- Saturday default changed to 00:00-00:00 (closed) in all defaults

### Files changed
- Glanz.API/Controllers/AuthController.cs
- Glanz.API/Controllers/BookingsController.cs
- Glanz.API/Controllers/ConfigController.cs
- Glanz.API/Controllers/CrmController.cs
- Glanz.API/Controllers/DevController.cs
- Glanz.API/Controllers/SettingsController.cs
- Glanz.API/DTOs/AuthDtos.cs, BookingDtos.cs, CrmDtos.cs
- Glanz.API/Models/Booking.cs, User.cs
- Glanz.API/Program.cs
- Glanz.API/Services/BookingSlotHelper.cs
- glanz-frontend/src/api/auth.js, bookings.js, settings.js
- glanz-frontend/src/pages/admin/AdminCrm.jsx
- glanz-frontend/src/pages/admin/AdminSettings.jsx
- glanz-frontend/src/pages/customer/Booking.jsx
- glanz-frontend/src/pages/customer/booking/BookingScheduleStep.jsx

### Next steps
- Push to remote and deploy
- Test favourite detailer flow end-to-end
- Test dev testing panel buttons after deploy
- Admin needs to open /admin/settings and Save Business Hours to fix Saturday in live DB
- Migration AddPreferredDetailerFields already created; run dotnet ef database update on prod

### Blockers
- Saturday (10:00-16:00) still in live Neon DB - admin must manually save business hours once to fix
