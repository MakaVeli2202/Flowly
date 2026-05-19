# Flowly - System Audit

Complete description of the system as built. Use this as the reference document for onboarding, handoff, or architecture review.

---

## 1. What It Is

Flowly is a multi-tenant SaaS platform for professional car detailing businesses. A business registers an organization, configures their services, and manages bookings, staff, and customers through a web admin panel. Customers book via the customer-facing web app or the React Native mobile app.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend API | ASP.NET Core 10, C#, EF Core 10 |
| Database | PostgreSQL (production), SQLite (tests) |
| Frontend | React 19 + Vite, plain CSS (no Tailwind) |
| Mobile | React Native (Expo SDK 52) |
| Real-time | SignalR (`/hubs/flowly`) |
| Auth | JWT (access 720 min + refresh 90 days) + Google OAuth |
| Payments | Tap Payments (primary, Qatar), QPay, Dibsy, SEPA/Stripe |
| Push | Expo Push Notifications |
| AI | Anthropic Claude (Haiku) via raw HTTP |
| SMS/WhatsApp | Infobip |
| Email | SMTP (any provider via SmtpEmailService) |
| Object Storage | Local filesystem or S3-compatible |
| Deployment | Render / Railway (Docker or Nixpacks) |

---

## 3. Repository Layout

```
E:\VS-Code\Flowly\
  Flowly-WebApp\
    Flowly.API\          ASP.NET Core backend
    Flowly.API.Tests\    xUnit tests (45 total)
    flowly-frontend\     React admin + customer web app
    Flowly.sln
  Flowly-Mobile\         Expo React Native app
  .claude\               Claude Code config + skills
  .github\workflows\     CI (GitHub Actions)
```

---

## 4. Backend Architecture

### Namespace
All C# code uses `Flowly.API.*`. Assembly output: `Flowly.API.dll`.

### Entry Point
`Program.cs` - configures DI, middleware, EF, JWT, CORS, SignalR, rate limiting, Sentry.

### Key Patterns
- **Multi-tenancy** - `TenantContext` service + EF global query filters on `OrgId`. Every table with tenant data has an `OrgId` column. Row-level isolation enforced at the database level.
- **No client-trusted values** - Amount, role, and booking status always recalculated server-side.
- **Background jobs** - `AIWeeklyDigestJob` (IHostedService) runs on a timer.
- **Graceful degradation** - All third-party integrations (Anthropic, Infobip, SMTP, Tap) fall back silently when not configured.

### Controllers (57 total)

| Controller | Purpose |
|-----------|---------|
| AuthController | Register, login, refresh, password reset, Google OAuth |
| BookingsController | Customer booking CRUD + available slot calculation |
| BookingsController.Admin | Admin status transitions, worker assignment, photo upload |
| BookingsController.Worker | Worker job view, status updates |
| PackagesController | Service package management |
| ServiceController | Base services |
| ServiceAddOnsController | Package add-ons |
| StaffController (via Modules/Staff) | Worker CRUD, schedule, payroll |
| PaymentsController | Tap charge create + verify |
| WebhooksController | Tap webhook receiver |
| StripeWebhookController | Stripe SEPA webhook |
| QPayController | QPay invoice create + verify |
| DibsyController | Dibsy charge create + verify |
| SepaController | SEPA direct debit (Stripe) |
| PaymentLinkController | Shareable payment links |
| NotificationsController | In-app notification CRUD |
| ReportsController | Financial + operational reports, DATEV export |
| StatsController | Dashboard counters |
| AnalyticsController | Charts and trend data |
| CrmController | Contact management, notes, tags |
| OffersController | Discount offers |
| LoyaltyController | Reward counter + Google review link |
| ReferralController | Referral codes + discount application |
| SubscriptionsController | Subscription plan management |
| SubscriptionBookingsController | Subscriber-specific booking flow |
| RecurringBookingsController | Scheduled recurring jobs |
| PlansController | Tenant SaaS plan selection |
| PlatformPlansController | Platform-level plan definitions |
| OrganizationsController | Org registration + config |
| ChatbotController | AI chat (Claude) with FAQ fallback |
| NotificationsController | Push + in-app notifications |
| NotificationConfigController | Per-event notification rules |
| AdminSettingsController | Business config (name, logo, hours, etc.) |
| SettingsController | Customer-facing settings read |
| AdminTranslationsController | Translation key management |
| FeatureFlagsController | Feature on/off toggles |
| GdprController | Data export + deletion requests |
| LocationController | Worker GPS location broadcast |
| LeadsController | Lead capture |
| WaitlistController | Service waitlist |
| CorporateAccountsController | B2B accounts + credit |
| PurchaseOrdersController | Corporate POs |
| VehiclesController | Customer vehicle profiles |
| AddressesController | Address autocomplete (Nominatim) |
| ReviewsController | Customer service reviews |
| ResourcesController | Equipment/bay scheduling |
| ProductController | Inventory items |
| PosController | Walk-in POS bookings |
| JobApplicationsController | Careers/job board |
| CustomFieldsController | Per-org custom booking fields |
| IndustryTemplatesController | Onboarding templates by vertical |
| StaffCertificationsController | Worker cert management |
| StaffRatingsController | Customer ratings for workers |
| ConfigController | Runtime config read |
| PublicController | Public-facing endpoints (no auth) |
| WhatsAppReceptionistController | Infobip WhatsApp webhook |
| SsoController (Module) | SAML/OIDC SSO |
| DevController | Dev-only seed/reset endpoints |

### Modules

| Module | Contents |
|--------|---------|
| AI | AIWeeklyDigestJob, AIModels |
| Auth | JWT helpers, ClaimExtensions |
| Automation | AutomationRulesService (event-triggered rules) |
| Billing | BillingService (subscription charge logic) |
| Booking | BookingService (slot calculation, auto-assign) |
| CRM | CrmService (contacts, segments, cohorts) |
| ClientAssets | Client asset tracking |
| CustomFields | Dynamic booking field engine |
| FeatureFlags | Flag store + evaluation |
| IndustryTemplates | Onboarding template engine |
| Offers | Discount + Google review integration |
| Organization | Org registration, onboarding wizard |
| Packages | Package pricing with vehicle multipliers |
| Permissions | Role-based permission matrix |
| Plans | Tenant plan enforcement (PlanGuard) |
| RecurringBookings | Recurring schedule engine |
| Reports | Financial, operational, DATEV, payroll |
| Reseller | Reseller org hierarchy |
| Resources | Equipment/bay conflict detection |
| SSO | SAML/OIDC provider config |
| Services | Base service catalog |
| Settings | SystemSettings key-value store |
| Staff | Worker CRUD, shifts, payroll, IBAN, certifications |
| SubscriptionBookings | Subscriber booking service |
| Templates | Email/notification templates |
| Waitlist | Waitlist management |
| Webhooks | Webhook delivery to customer endpoints |

### Platform Layer

| Component | Purpose |
|-----------|---------|
| `Platform/Tenancy/TenantContext` | Current org ID resolution per request |
| `Platform/AuditEvents` | Immutable audit log for sensitive actions |
| `Platform/Messaging` | ISmsService, IEmailService abstractions |
| `Platform/Billing` | IPlanGuard interface |
| `Platform/FeatureFlags` | IFeatureFlag interface |
| `Platform/Permissions` | RBAC helpers |
| `Platform/Quotas` | Usage quota tracking |

### Key Services

| Service | Purpose |
|---------|---------|
| AdminNotificationService | Creates DB + push notifications for all booking events |
| SmtpEmailService | Sends OTP, password reset, booking confirmation emails |
| ExpoPushService | Expo push notification delivery |
| StaffService | Worker management + payslip generation (QuestPDF) |
| RealtimeService (SignalR) | BroadcastAdminLocationAsync, status push |

---

## 5. Frontend Architecture

**Stack:** React 19, Vite, React Router v7, plain CSS with CSS variables.

**No i18n library.** Translations are inline objects `{ en: ..., ar: ..., de: ... }` in each admin page. Customer pages use the same pattern.

**Theme system:** CSS custom properties in `flowly.css`. Dark/light toggle in `SettingsContext.jsx`.

**Auth:** JWT stored in `localStorage` as `flowly_access_token`. `AuthContext.jsx` handles token refresh.

### Customer Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Home.jsx | Landing, packages overview, how it works |
| `/login` | Login.jsx | Customer login |
| `/register` | Register.jsx | Registration + OTP |
| `/packages` | Packages.jsx | Package catalog |
| `/booking` | Booking.jsx | Full booking wizard |
| `/booking-confirmation` | BookingConfirmation.jsx | Post-booking landing |
| `/pay` | PayPage.jsx | Payment initiation |
| `/my-bookings` | MyBookings.jsx | Customer booking history |
| `/my-subscription` | MySubscription.jsx | Subscription status |
| `/subscription-booking` | SubscriptionBooking.jsx | Subscriber booking flow |
| `/subscription-checkout` | SubscriptionCheckout.jsx | Subscription payment |
| `/recurring-bookings` | RecurringBookings.jsx | Recurring schedule view |
| `/profile` | Profile.jsx | Account settings |
| `/referrals` | Referrals.jsx | Referral code + share |
| `/plans` | Plans.jsx | SaaS plan selection |
| `/booking-portal` | PublicBookingPortal.jsx | Guest booking (no login) |
| `/privacy-policy` | PrivacyPolicy.jsx | Legal |
| `/careers` | Careers.jsx | Job board |
| `/forgot-password` | ForgotPassword.jsx | Password reset request |
| `/reset-password` | ResetPassword.jsx | New password form |
| `/email-verification` | EmailVerification.jsx | OTP entry |

### Admin Pages (route prefix `/admin`)

| Page | Purpose |
|------|---------|
| AdminDashboard | KPI cards + quick actions |
| AdminBookings | Booking list + filters |
| AdminBookingDetail | Full booking detail + actions |
| AdminStaff | Worker list + add/edit |
| AdminWorkerManagement | Shift/role management |
| AdminWorkerSchedule | Calendar assignment view |
| AdminWorkerSales | Per-worker revenue stats |
| AdminPayroll | Payslip generation |
| AdminPackages | Package CRUD + pricing |
| AdminServices | Base service catalog |
| AdminAddOns | Service add-ons |
| AdminSettings | Business config |
| AdminOrgSettings | Org-level settings |
| AdminBranding | Logo, colors, tagline |
| AdminNotifications | In-app notification list |
| AdminNotificationSettings | Per-event push/email rules |
| AdminAnalytics | Charts + trend data |
| AdminReportFinancial | Revenue reports + export |
| AdminReportOperational | Booking stats by worker |
| AdminCrm | Customer contact management |
| AdminCampaigns | Email/push campaigns |
| AdminCohort | Cohort retention analysis |
| AdminSegmentation | Customer segments |
| AdminOffers | Discount management |
| AdminProducts | Inventory |
| AdminPurchaseOrders | PO management |
| AdminResources | Equipment/bay |
| AdminPlans | Tenant plan admin |
| AdminBilling | Subscription billing |
| AdminSEPA | SEPA direct debit |
| AdminSubscriptionBookings | Subscriber booking overview |
| AdminRecurringBookings | Recurring job list |
| AdminCorporateAccounts | B2B account management |
| AdminPos | POS terminal |
| AdminWaitlist | Waitlist management |
| AdminReseller | Reseller hierarchy |
| AdminSSO | SSO provider config |
| AdminGdpr | Data export/deletion |
| AdminWebhook | Outgoing webhook config |
| AdminTranslations | Translation key editor |
| AdminContent | CMS-style content blocks |
| AdminAI | AI config + digest preview |
| AdminSkills | Worker skill management |
| AdminCertifications | Certification catalog |
| AdminJobPositions | Job posting management |
| AdminSegmentation | Customer segment builder |
| AdminOnboarding | Onboarding wizard status |
| AdminDevSettings | Dev tools (local only) |
| LiveMapTracking | Real-time worker map |
| AdminRKSV | Austrian fiscal receipt log |

### Key Frontend Components

| Component | Purpose |
|-----------|---------|
| `SiteAccessGate` | Splash/coming-soon gate - wraps customer app |
| `CookieConsent` | GDPR cookie banner |
| `SignalR (useSignalR)` | WebSocket connection to `/hubs/flowly` |
| `AuthContext` | JWT storage, refresh, user state |
| `SettingsContext` | Business config cache, theme |
| `adminRoute()` | Factory function - call as `adminRoute(...)`, not JSX |

---

## 6. Mobile App Architecture

**Stack:** React Native, Expo SDK 52, React Navigation.

**Auth:** JWT in `SecureStore`. Same backend API as web.

**Key Screens:**
- HomeScreen, BookingScreen, BookingConfirmationScreen
- MyBookingsScreen (booking history + loyalty counter)
- PackagesScreen, ProfileScreen, SettingsScreen
- ChatbotScreen (AI assistant with FAQ fallback)
- ReferralScreen, RegisterScreen, LoginScreen
- AdminContentScreen, AdminJobsScreen (for admin users)
- CareersScreen

**API layer:** `src/api/` - axios instance with JWT interceptor + auto-refresh.

**Push:** Expo Notifications + Expo push token registration on login.

**Real-time:** `realtimeService.js` connects to `/hubs/flowly` via `@microsoft/signalr`.

---

## 7. Data Model (Key Tables)

| Table | Key Columns |
|-------|-------------|
| Users | Id, OrgId, Email, Role (Admin/Worker/Customer), ExpoPushToken, RefreshToken |
| Bookings | Id, OrgId, BookingNumber, CustomerId, AssignedWorkerId, Status, PaymentStatus, ScheduledDate, TimeSlot, TotalAmount, StripePaymentIntentId (Tap charge ID) |
| Packages | Id, OrgId, Name, Tier, Price, EstimatedDurationMinutes, IsActive |
| Staff | Id, OrgId, ShortCode (UPPERCASE), VanRole, DriverId, Iban |
| Notifications | Id, OrgId, UserId, AdminId, Type, Message, IsRead |
| SlotReservations | PaymentIntentId, ScheduledDate, TimeSlot, ExpiresAt (15 min hold) |
| SystemSettings | Id, OrgId, Key, Value (key-value store) |
| Organizations | Id, Name, PlanId, TrialEndsAt |
| AuditEvents | Id, OrgId, UserId, Action, EntityType, EntityId, Timestamp |

---

## 8. Authentication Flow

```
Register → OTP email → Verify → JWT (720 min) + RefreshToken (90 days)
Login → JWT + RefreshToken
Expired → POST /api/Auth/refresh → new JWT
Google OAuth → POST /api/Auth/google → JWT (create or link account)
```

Roles: `Admin`, `Worker`, `Customer`. Role is stored in JWT claims. Backend validates per endpoint with `[Authorize(Roles = "Admin")]`.

---

## 9. Payment Flow (Tap Payments)

```
1. POST /api/Payments/create-charge
   - Looks up booking server-side (never trusts client amount)
   - Creates Tap charge
   - Stores chargeId in booking.StripePaymentIntentId
   - Creates SlotReservation (15 min hold)
   - Returns { chargeId, redirectUrl }

2. Frontend redirects customer to Tap-hosted page

3. Customer pays on Tap page

4. Tap redirects back to redirect_url?tap_id=<chargeId>&booking=<bookingNumber>

5. GET /api/Payments/verify/{chargeId}
   - Calls Tap API to get charge status
   - CAPTURED/AUTHORIZED → booking.Status = Confirmed, PaymentStatus = Paid
   - FAILED/DECLINED → booking.PaymentStatus = Failed

6. POST /api/Webhooks/tap (async safety net)
   - Same logic as verify, triggered by Tap webhook
```

---

## 10. Multi-Tenancy

Every request resolves `OrgId` from the JWT claim (`TenantContext`). EF Core global query filters apply `WHERE OrgId = @currentOrgId` on all tenant tables automatically. Bypassed only for platform admin routes.

Test: `TenantIsolationTests.cs` verifies org A cannot read org B data.

---

## 11. Pending (Paid / Config Only)

These features are **code complete** but need real credentials to activate:

| Feature | Config Key | Notes |
|---------|-----------|-------|
| JWT signing | `JwtSettings:SecretKey` | Any 32+ char string |
| Tap Payments | `TapPayments:SecretKey` | Qatar gateway |
| Stripe/SEPA | `Stripe:SecretKey` + `WebhookSecret` | EU payments |
| QPay | `QPay:Username/Password/InvoiceCode` | Qatar gateway |
| Dibsy | `Dibsy:ApiKey` | GCC gateway |
| Claude AI chatbot | `Anthropic:ApiKey` | Falls back to FAQ without key |
| Email | `Email:SmtpHost/User/Password` | Falls back to console log |
| SMS/WhatsApp | `Infobip:ApiKey + WhatsAppSender` | Falls back to no-op |
| Push (production) | Expo push token in device | Works automatically in Expo Go |
| SSO | Per-org SAML/OIDC config in DB | UI complete |
| RKSV | Custom crypto signing chain | Austrian fiscal law, stub |

---

## 12. Test Coverage

```
Flowly.API.Tests/
  Unit/
    PricingServiceTests.cs      - vehicle multiplier math
    WebhookSignatureTests.cs    - HMAC-SHA256 validation
    ShortCodeHelperTests.cs     - uppercase uniqueness logic
    PaginationHelpersTests.cs   - page/offset math
  Integration/
    BookingFlowTests.cs         - end-to-end booking via real HTTP + SQLite
    TenantIsolationTests.cs     - cross-org data isolation
    GlobalExceptionFilterTests  - error response shapes
```

Run: `dotnet test` - expects 45 passed, 0 failed.

---

## 13. CI/CD

`.github/workflows/ci.yml`:
- Triggers on push to `main` or `dev`
- Backend job: `dotnet restore` + `dotnet build` + `dotnet test`
- Frontend job: `npm ci` + `npm run build` + `npm test`

Deployment:
- `Flowly-WebApp/Flowly.API/Dockerfile` - for Render/Railway container deploy
- `Flowly-WebApp/Flowly.API/railway.json` - Railway-specific start command
- Frontend deploys to Vercel (static, `npm run build`)

---

## 14. Known Constraints

- `appsettings.Development.json` references `Database=glanz_db` - matches the dev PostgreSQL DB name. Update if you rename the local database.
- `dist/` folder in `flowly-frontend` still contains old built assets - run `npm run build` to refresh.
- `obj/` auto-generated Sentry files reference `Glanz-WebApp` path - regenerated on `dotnet build` after folder rename.
- Mobile `eas.json` and Expo project slug is `flowly` - update `EAS_PROJECT_ID` in Expo dashboard if publishing.
- RKSV signing chain (`AdminRKSV.jsx`) is a UI stub - requires actual Austrian A-Trust HSM integration.
