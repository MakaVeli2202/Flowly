# Glanz Architecture

## Overview

Glanz is a vehicle cleaning marketplace. Customers book detailing services, workers execute jobs, admins manage operations. The system has three clients backed by a single API.

## Component Map

```
glanz.qa (browser)          api.glanz.qa          Database
+------------------+        +-----------------+    +----------+
| React 19 + Vite  | <----> | ASP.NET Core 10 | -> | SQLite   | (dev)
| Tailwind CSS     |  HTTP  | REST + SignalR   |    | Postgres | (prod)
+------------------+        +-----------------+    +----------+
         |                          |
         |                  +-----------------+
         |                  | Tap Payments    |  payment gateway
         |                  | SmtpEmailSvc    |  transactional email
         |                  +-----------------+
         |
+------------------+
| Expo 54 / RN     |  (workers + staff mobile)
| React Navigation |
+------------------+
```

## Backend (`Glanz-WebApp/Glanz.API/`)

| Layer | Path | Responsibility |
|-------|------|----------------|
| Controllers | `Controllers/` | HTTP routing, auth guards, thin request parsing |
| Services | `Services/` | Business logic (pricing, notifications, email) |
| Models | `Models/` | EF Core entities |
| DTOs | `DTOs/` | API input/output contracts |
| Data | `Data/AppDbContext.cs` | EF Core context, all DbSets |
| Migrations | `Migrations/` | Schema history |

### Key controllers

- `BookingsController` - booking lifecycle, slot availability, worker assignment, admin edits
- `AuthController` - JWT login/register, refresh token rotation, worker management
- `WebhooksController` - Tap Payments webhook (HMAC-SHA256 verified)
- `PackagesController`, `ServicesController` - catalog management
- `SubscriptionsController` - subscription plans and customer subscriptions

### Auth flow

```
Login -> JWT (720 min) + HttpOnly refresh cookie (90 days)
401 on any request -> axios interceptor -> POST /Auth/refresh -> retry original
Logout -> clear refresh token from DB, clear cookie
```

Access token: sessionStorage (cleared on tab close).
Refresh token: HttpOnly cookie, rotated on each use.

### Pricing

`PricingService` calculates totals. Vehicle multipliers: Motorcycle=0.8, Sedan=1.0, SUV=1.25, Pickup=1.5. Applied at `BookingItem` level. Backend recalculates everything — never trusts client prices.

### Real-time

SignalR hub (`/hubs/notifications`) pushes booking status changes and admin alerts to connected clients.

## Frontend (`Glanz-WebApp/glanz-frontend/`)

| Directory | Contents |
|-----------|----------|
| `src/api/` | Axios API clients, one file per resource |
| `src/pages/admin/` | Admin SPA pages (all lazy-loaded) |
| `src/pages/customer/` | Customer-facing pages |
| `src/pages/worker/` | Worker mobile-like pages |
| `src/components/` | Shared components (ErrorBoundary, CookieConsent, Skeleton, etc.) |
| `src/context/` | React contexts (Auth, Language, Settings, Features) |
| `src/styles/` | CSS custom properties for theming |

### Theming

Dark/light via `data-theme` on `<html>`. CSS custom properties (`--surface-bg`, `--card-bg`, `--text-color`, etc.) consumed by all components. Never use hardcoded Tailwind `bg-white` - use `bg-[var(--surface-bg)]`.

### State

No global state library. React context for auth + settings. Server state via direct API calls with a simple `cacheManager` utility (TTL-based, in-memory).

## Mobile (`Glanz-Mobile/`)

Expo 54 / React Native 0.81.5. Workers use this to see assigned bookings, start/finish jobs, and mark arrival. Auth via SecureStore (not AsyncStorage). Same API endpoints as web.

## Infrastructure

- **Dev**: `dotnet run` (port 5289) + `npm run dev` (port 5173) + SQLite
- **Prod**: Render.com (API), Vercel/Netlify (frontend), PostgreSQL (managed)
- **CI**: GitHub Actions (`.github/workflows/ci.yml`) - build + test on push to main/dev

## Data flow: booking creation

```
1. Customer selects packages + date/time on /booking
2. POST /Bookings/quote -> price preview
3. POST /Payments/create-charge -> Tap hosted payment page
4. Customer completes payment on Tap
5. Tap redirects back with charge_id
6. POST /Bookings (with charge_id) -> booking created
7. Tap sends webhook to POST /Webhooks/tap (HMAC verified)
8. Webhook updates PaymentStatus to Paid
9. Admin assigns worker (manual or auto-assign)
10. Worker app: arrived -> start -> finish
11. SignalR pushes status to customer
```

## Security checklist (prod)

- [ ] `JwtSettings:SecretKey` env var (override default in code)
- [ ] `TapPayments:WebhookSecret` env var
- [ ] `Email:SmtpPassword` env var
- [ ] HTTPS enforced (Render handles TLS)
- [ ] Rate limiting active (AspNetCoreRateLimit, tighter in prod)
- [ ] CSP headers configured in `Program.cs`
- [ ] Refresh token HttpOnly cookie, SameSite=Strict
- [ ] Access token in sessionStorage (not localStorage)
