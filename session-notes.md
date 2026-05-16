## Session [2026-05-16 - Phase 1 Step 3: Billing, Org Settings, Public Portal]
### Goal
Complete the remaining Phase 1 frontend: billing page, org branding settings, public booking portal.

### Decisions
- PublicController uses IgnoreQueryFilters() so it bypasses tenant EF filters - public read-only
- Public portal applies org brand colors via CSS var --portal-primary (isolated from app theme)
- Unauthenticated users hitting Book Now redirected to login with from+message state
- Billing page shows 501 "not configured" gracefully when Stripe keys not set
- AdminHeader navigation extended with Org Settings + Billing links

### Files changed
- Glanz.API/Controllers/PublicController.cs (new - GET /api/public/orgs/{slug} + /packages)
- glanz-frontend/src/api/billing.js (new)
- glanz-frontend/src/api/public.js (new)
- glanz-frontend/src/pages/admin/AdminBilling.jsx (new - /admin/billing)
- glanz-frontend/src/pages/admin/AdminOrgSettings.jsx (new - /admin/org-settings)
- glanz-frontend/src/pages/customer/PublicBookingPortal.jsx (new - /book/:slug)
- glanz-frontend/src/App.jsx (3 new admin routes, 1 new public route)
- glanz-frontend/src/components/layout/AdminHeader.jsx (Building2 + CreditCard icons, 2 new nav links)
- glanz-frontend/src/locales/en/navbar.json (orgSettings, billing keys)
- glanz-frontend/src/locales/de/navbar.json (same)
- glanz-frontend/src/locales/ar/navbar.json (same)

### Next steps
- Phase 1 remaining: ClientAssetsContext, tenant subdomain routing, terminology map
- Stripe: wire real checkout (add Stripe.NET package, set Stripe:SecretKey in server config)
- Phase 2: Advanced booking (multi-resource, recurring), Enhanced CRM, Inventory Pro

### Blockers
- Stripe billing functional only after Stripe:SecretKey configured in server env

## Session [2026-05-16 - Phase 1 Step 2: Frontend Org Onboarding]
### Goal
Build Phase 1 frontend: TenantContext provider, org registration page, admin onboarding wizard.

### Decisions
- All backend Phase 1 services already existed (Organization, Billing, FeatureFlags, Permissions, Resources, IndustryTemplates, CustomFields, ClientAssets, Automation) - created in Phase 0 or earlier sessions
- Admin pages use inline UI_BY_LANG dictionaries, not locale files - new admin pages follow same pattern
- TenantProvider wraps inside AuthProvider (needs user role to conditionally fetch org data)
- TenantContext fetches org, branding, and onboarding status in parallel; applies brand CSS vars to root
- OrgRegister auto-generates slug from org name (user can override)
- Auto-login after registration, redirects to /admin/onboarding
- AdminDashboard shows amber banner if onboarding incomplete, links to /admin/onboarding

### Files changed
- glanz-frontend/src/api/organizations.js (new)
- glanz-frontend/src/context/TenantContext.jsx (new)
- glanz-frontend/src/pages/shared/OrgRegister.jsx (new - /org/register route)
- glanz-frontend/src/pages/admin/AdminOnboarding.jsx (new - /admin/onboarding)
- glanz-frontend/src/App.jsx (TenantProvider, 2 new routes)
- glanz-frontend/src/pages/admin/AdminDashboard.jsx (onboarding banner)

### Next steps
- Phase 1 Step 3: Stripe billing integration (wire BillingService TODOs - checkout session, billing portal, webhook)
- Phase 1 Step 4: Admin org settings page (branding upload, color picker, domain config)
- Phase 1 Step 5: Public booking portal (/book/:orgSlug)
- Phase 1 Step 6: ClientAssetsContext + replace VehiclesContext in Booking flow

### Blockers
- None (build clean, 45/45 tests pass)

## Session [2026-05-16 - Phase 1 Step 1: Service Extraction]
### Goal
Extract ALL business logic from fat controllers into dedicated Service classes (architectural constraint C2).

### Decisions
- `Glanz.API.Modules.Staff` namespace conflicts with `Glanz.API.Models.Staff` class in child namespaces - fix with `using StaffEntity = Glanz.API.Models.Staff;` alias
- Same pattern for `Booking`, `PackageService`, `Service` model classes when namespace collision occurs
- `PlansService.ToCustomerSubscriptionDto()` is `public static` so `SubscriptionsController` can call `PlansService.ToCustomerSubscriptionDto()` directly
- `LocalizedText` is in `Glanz.API.Services` namespace (not Models) - alias needed in `Glanz.API.Modules.Services`
- Settings inline DTOs (`UpdateSettingsDto`, `GateVerifyDto`, etc.) moved to `DTOs/SettingsDtos.cs`
- `ResolveRequestedLanguage()` stays in controllers (reads `Request.Query`/`Request.Headers` - HTTP concern); lang string passed to service
- `CancellationToken` passed from `HttpContext.RequestAborted` to Package/Service service methods

### Services created (all DONE, 45/45 tests pass)
- `Modules/Auth/IAuthService.cs` + `AuthService.cs` (auth business logic)
- `Modules/Staff/IStaffService.cs` + `StaffService.cs` (worker CRUD, payroll, attendance)
- `Modules/Offers/IOfferService.cs` + `OfferService.cs` (offers, coupons, loyalty)
- `Modules/CRM/ICrmService.cs` + `CrmService.cs` (customers, feedback, segments)
- `Modules/Packages/IPackageService.cs` + `PackageService.cs` (package CRUD, localization)
- `Modules/Settings/ISettingsService.cs` + `SettingsService.cs` (system settings, gate auth)
- `Modules/SubscriptionBookings/ISubscriptionBookingService.cs` + `SubscriptionBookingService.cs`
- `Modules/Reports/IReportsService.cs` + `ReportsService.cs` (dashboard, financial, payroll)
- `Modules/Plans/IPlansService.cs` + `PlansService.cs` (subscription plans CRUD)
- `Modules/Services/IServicesService.cs` + `ServicesService.cs` (service CRUD, localization)

### Files changed (controllers rewritten thin)
- Controllers/AuthController.cs, OffersController.cs, CrmController.cs, PackagesController.cs
- Controllers/SettingsController.cs, SubscriptionBookingsController.cs, ReportsController.cs
- Controllers/PlansController.cs, ServiceController.cs, SubscriptionsController.cs
- DTOs/SettingsDtos.cs (new - moved from SettingsController inline)
- Program.cs (10 new AddScoped registrations)
- Modules/Booking/BookingService.cs (type alias fixes)

### Next steps
- Phase 1 Step 2: Add OrgId to all models + EF global query filters (multi-tenancy isolation)
- Phase 1 Step 3: Stripe billing integration for org subscriptions

### Blockers
- None (build clean, 45/45 tests pass)

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

## Session 2026-05-16 10:30
### Goal
Fix all version mismatches, eliminate loading bottlenecks, and optimize the full stack to production level.
### Decisions
- Aligned API + tests to net10.0; updated all Microsoft.* packages to 10.0.8, Npgsql 10.0.1, Swashbuckle 10.1.7
- EF Core 10 dual-provider conflict in WebApplicationFactory: remove IDbContextOptionsConfiguration<T> before swapping to SQLite
- Frontend main JS bundle: 744kB -> 137kB (-82%) via lazy routes (only Home + Login eager)
- SignalR (151kB) + realtimeService (58kB) deferred via dynamic import - never loads for guests
- RainOnGlass.mp4 (8.7MB) moved from src/assets to public/ - no longer bundled by Vite
- ErrorBoundary detects ChunkLoadError and does full page reload instead of broken re-render
- Dockerfile base images: sdk:8.0 + aspnet:8.0 -> sdk:10.0 + aspnet:10.0
- AttendanceLogs table existed in prod outside migrations; migration made idempotent with IF NOT EXISTS
### Files changed
- Glanz-WebApp/Glanz.API/Glanz.API.csproj (net10.0, all packages updated)
- Glanz-WebApp/Glanz.API.Tests/Glanz.API.Tests.csproj (EF 10.0.8, stable Mvc.Testing, test SDK 18.5.1)
- Glanz-WebApp/Glanz.API.Tests/Integration/BookingFlowTests.cs (EF 10 provider conflict fix)
- Glanz-WebApp/Glanz.API/Program.cs (KnownNetworks -> KnownIPNetworks)
- Glanz-WebApp/Glanz.API/Dockerfile (sdk:10.0, aspnet:10.0)
- Glanz-WebApp/Glanz.API/Migrations/20260516082458_UpgradeEFCore10.cs (IF NOT EXISTS)
- Glanz-WebApp/glanz-frontend/src/App.jsx (all routes lazy except Home+Login)
- Glanz-WebApp/glanz-frontend/src/context/AuthContext.jsx (dynamic import realtimeService)
- Glanz-WebApp/glanz-frontend/src/api/notificationBus.js (dynamic import realtimeService)
- Glanz-WebApp/glanz-frontend/src/components/shared/RainBackground.jsx (static path /videos/)
- Glanz-WebApp/glanz-frontend/src/components/shared/ErrorBoundary.jsx (ChunkLoadError handling)
- Glanz-WebApp/glanz-frontend/vite.config.js (manualChunks: icons, gsap, framer-motion, charts)
- Glanz-WebApp/glanz-frontend/public/videos/RainOnGlass.mp4 (moved from src/assets)
- Glanz-WebApp/glanz-frontend/src/locales/en|de|ar/common.json (errorBoundary chunk keys)
### Next steps
- Set Observability:SentryDsn in prod env to activate error monitoring
- Set up email provider (SendGrid/SES) for transactional email
### Blockers
- None (all 42 backend + 35 frontend tests passing, app deployed on net10.0)
