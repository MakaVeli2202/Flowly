# Glanz System Architecture & Flow Audit

> Complete reference for any developer or AI agent starting work on this codebase. Read this before touching anything.

---

## 1. System Overview

Glanz is a vehicle detailing marketplace operating in Qatar. It connects customers (car owners) with workers (detailers) via a booking system, handles payments through Stripe, and delivers real-time updates via Expo push notifications.

### What it does (real-world)
- Customers browse packages, book car detailing slots, pay, and track their job
- Workers receive job assignments, mark arrival/start/finish on mobile
- Admins manage workers, bookings, pricing, inventory, offers, reports, and system settings
- Subscriptions allow recurring monthly bookings

### Modules

| Module | Path | Technology |
|--------|------|-----------|
| Backend API | `Glanz-WebApp/Glanz.API/` | ASP.NET Core 10, EF Core, PostgreSQL |
| Web Frontend | `Glanz-WebApp/glanz-frontend/` | React 19, Vite, TailwindCSS |
| Mobile App | `Glanz-Mobile/` | Expo SDK 54, React Native 0.81, New Architecture |

---

## 2. Core Data Flow

### 2.1 Generic Request Flow

```
User Client
    │
    ▼
API Endpoint  (JWT Bearer token in Authorization header)
    │
    ▼
GlobalExceptionFilter  (catches all unhandled exceptions → 500)
    │
    ▼
FluentValidationFilter  (validates DTO before controller action)
    │
    ▼
Controller action  (thin — validates auth, calls service)
    │
    ▼
Service / DbContext  (business logic + DB access)
    │
    ▼
EF Core → PostgreSQL  (returns data)
    │
    ▼
DTO returned to client  (via controller ActionResult)
```

### 2.2 Authentication Flow

```
Register/Login Request
    │
    ▼
AuthController.Login / Register
    │
    ▼
BCrypt password comparison (hashed with BCrypt.Net on save)
    │
    ▼
TokenService.GenerateToken()
    → Creates JWT with claims: NameIdentifier (userId), Role, Email
    → Signs with HMAC-SHA256 using secret from JwtSettings:SecretKey
    → Expiry: 7 days (default)
    │
    ▼
Returns { token: string, user: UserDto }
    │
    ▼
Client stores token:
  - Web: localStorage.setItem('token', ...)
  - Mobile: AsyncStorage.setItem('token', ...)
    │
    ▼
All subsequent requests attach token:
  → Web: Axios interceptor reads localStorage, adds Authorization header
  → Mobile: Axios interceptor reads AsyncStorage, adds Authorization header
```

### 2.3 Role-Based Access

| Role | Access |
|------|--------|
| `Customer` | Own bookings, own profile, public packages/pricing, subscribe |
| `Worker` | Today's jobs, own profile, start/finish bookings |
| `Admin` | Everything — all bookings, all users, workers, settings, reports |

Controllers use `[Authorize]` + `[Authorize(Roles = "Admin")]` to enforce this.

---

## 3. Booking System Flow (The Most Important Part)

This is the heart of the system. Every booking goes through this flow:

### 3.1 Creation (2-Step with Stripe Hold)

```
Step 1: POST /api/bookings/create-payment-intent
────────────────────────────────────────────────
Client sends:
{
  packageId, scheduledDate, timeSlot, vehicleMake, vehicleModel,
  vehicleYear, vehicleType, preferredAddress, addressType,
  specialInstructions
}

Backend:
1. Validates package exists and is active
2. Checks slot is not in the past
3. Checks no worker conflict at that slot (30-min buffer around existing bookings)
4. Calculates price via PricingService
5. Creates Stripe PaymentIntent (capture_method: manual) — this HOLDS funds
6. Creates SlotReservation record with 10-minute expiry
7. Returns { clientSecret, reservationId, totalAmount }

Stripe: Funds are pre-authorized but NOT captured yet.

Step 2: POST /api/bookings  (called after Stripe confirm on frontend)
─────────────────────────────────────────────────────────────────────
Client sends:
{
  paymentIntentId, scheduledDate, timeSlot, packageId,
  vehicleType, address info, idempotencyKey
}

Backend:
1. Validates idempotencyKey (prevents double-booking)
2. Confirms PaymentIntent with Stripe (confirms the hold)
3. Creates Booking record:
   → Status: Pending
   → PaymentStatus: PreAuthorized (funds held)
   → Generates BookingNumber like "GC-2026-00001"
4. Creates BookingItem (links package to booking)
5. Auto-assigns worker if auto-assign is enabled
6. Creates BookingChecklistItems (one per service in the package)
7. Notifies admin via AdminNotificationService
8. Notifies customer via same service
9. Captures funds if payment was prepaid
10. Returns full BookingDto
```

### 3.2 Slot Availability Logic

```
Time slots are hourly windows: "09:00-10:00", "10:00-11:00", etc.
Available slots are calculated by BookingSlotHelper:

BuildCandidateStartSlots(durationMinutes):
  - Generates 30-minute step start times within business hours (default 09:00–18:00)
  - E.g. for 90-min job: "09:00", "09:30", "10:00", "10:30", ...

IsSlotAvailableForEditAsync(date, slot, duration, excludeBookingId):
  1. For each ACTIVE worker (IsActive = true):
     a. Does the worker's schedule cover that day? (WorkerWorksOnDay)
     b. Does the slot fit within the worker's shift? (+30-min travel buffer)
     c. Does the slot conflict with any existing booking?
        → Uses HasWorkerConflict: checks booking windows with 30-min gap
  2. If ANY worker passes all checks → slot is available
  3. If NO worker is free → slot is blocked
```

### 3.3 Conflict Prevention

```
Worker conflict check (HasWorkerConflict):
  - Existing booking: window [slotStart, slotStart + duration]
  - New request:      window [reqStart,   reqStart   + reqDuration]
  - Conflict if:      reqEnd + 30min buffer NOT ≥ existStart
                      AND reqStart NOT ≥ existEnd + 30min buffer
  - In other words: gapBefore OR gapAfter must be true → no conflict
```

### 3.4 Pricing Calculation

```
PricingService.CalculateAsync(packageId, vehicleType):
  1. Get package base price (e.g. Interior Detail = 795.66 QAR)
  2. Apply vehicle multiplier:
     Motorcycle = 0.8×, Sedan = 1.0×, SUV = 1.25×, Pickup = 1.5×
  3. TotalAmount = Math.Round(basePrice × multiplier, 2)
  4. EstimatedCost = sum(ServiceProduct.QuantityUsed × Product.CostPerUnit) per service
  5. EstimatedProfit = TotalAmount - EstimatedCost
```

### 3.5 Booking Status Lifecycle

```
Pending
  ↓ (admin or system confirms)
Confirmed
  ↓ (worker marks arrived)
InProgress
  ↓ (worker marks started)
  ├→ Completed  (normal finish)
  ├→ Paused     (worker pauses mid-job)
  └→ Cancelled  (customer/admin cancels)

PaymentStatus lifecycle:
PreAuthorized  → (admin captures or Stripe auto-captures) → Paid
PreAuthorized  → (admin void) → Refunded
Paid           → (admin refund) → Refunded
```

### 3.6 Worker Job Flow (Mobile)

```
Worker opens "Today Work" screen:
  → Fetches bookings where AssignedWorkerId = self, ScheduledDate = today, Status != Cancelled
  → Polls every 30 seconds for updates

Worker marks arrival:
  POST /api/bookings/{id}/arrived
  → Sets ArrivedAt timestamp
  → Notifies customer + admin via AdminNotificationService

Worker marks start:
  POST /api/bookings/{id}/start
  → Sets Status = InProgress, WorkStartedAt = now
  → Notifies customer + admin

Worker marks running late:
  POST /api/bookings/{id}/running-late  { delayMinutes, reason }
  → Notifies customer + admin

Worker marks finish:
  POST /api/bookings/{id}/finish
  → Sets Status = Completed, WorkCompletedAt = now
  → Calculates WorkDurationSeconds
  → Deducts product stock (StockDeductedAt set)
  → Notifies customer + admin
  → Triggers payroll record creation
```

### 3.7 Admin Cancel + Refund Flow

```
POST /api/bookings/{id}/admin-cancel-refund
  Body: { refundAmountOverride?, cancellationNote?, customerFault? }

1. Look up booking
2. Determine reason:
   - customerFault = true  → apply cancellation fee (25% of total)
   - customerFault = false → full refund
3. If PaymentStatus == PreAuthorized:
   → Call Stripe PaymentIntentService.CancelAsync() → VOID the hold
   → StripeAction = "Voided"
4. If PaymentStatus == Paid:
   → Call Stripe RefundService.CreateAsync() → refund funds
   → StripeAction = "Refunded"
5. Set Status = Cancelled, PaymentStatus = Refunded
6. Unassign worker
7. Clear SlotReservation
8. Notify customer via AdminNotificationService
9. Return { message, BookingStatus, PaymentStatus, RefundedAmount, StripeRefundId, StripeAction }
```

---

## 4. Notification System

### 4.1 Architecture

```
NOTHING is real-time. Everything is polling + push.

┌─────────────────────────────────���───────────────────────────────┐
│                     NOTIFICATION TRIGGERS                       │
│                                                                  │
│  AdminNotificationService methods called by controllers:        │
│  → NotifyNewBookingAsync         (on booking creation)           │
│  → NotifyBookingStatusChanged    (on any status change)         │
│  → NotifyJobStarted              (on worker start)              │
│  → NotifyWorkerArrived           (on worker arrival)              │
│  → NotifyJobCompleted           (on worker finish)               │
│  → NotifyWorkerRunningLate      (on late marking)                │
│  → NotifyLowStock               (on product stock < 20)          │
│  → NotifyBookingCancelled       (on cancellation)               │
│  → ... and 20+ more                                     │
│                                                                  │
│  Each method:                                                    │
│  1. Creates Notification record(s) in DB                         │
│     → AdminId set for admin notifications                         │
│     → UserId set for customer/worker notifications               │
│  2. Sends Expo push notification to relevant users               │
│     (if they have ExpoPushToken registered)                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        PERSISTENCE LAYER                         │
│  Table: Notifications                                            │
│  Fields: Id, AdminId, UserId, Type (enum), Message,              │
│          BookingId (nullable FK), IsRead, CreatedAt             │
│                                                                  │
│  Scoping:                                                        │
│  → Admins see only notifications where AdminId = their ID        │
│  → Customers see only notifications where UserId = their ID      │
│  → Workers see only notifications where UserId = their ID       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        PUSH DELIVERY                            │
│                                                                  │
│  ExpoPushService.SendAsync(token, title, body, data)            │
│  → Sends via Expo Push API to registered device tokens          │
│  → Works even when app is CLOSED (background push)             │
│  → Triggers: notification banner + optional sound + vibration   │
│                                                                  │
│  Mobile listens: Notifications.addNotificationReceivedListener │
│  → Formats notification for foreground display                  │
│  → Triggers haptics + sound via useNotificationPolling hook    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     POLLING (WEB + MOBILE)                       │
│                                                                  │
│  Web (usePolling hook):                                          │
│  → AdminBookings:  30s interval + re-polls on tab focus          │
│  → MyBookings:     30s interval + re-polls on tab focus          │
│                                                                  │
│  Mobile (useNotificationPolling hook):                         │
│  → CustomerDrawer: polls /api/notifications/unread-count  @60s  │
│  → AdminStack:     polls /api/notifications/unread-count  @60s  │
│  → On new notification count > previous: plays haptic + sound  │
│  → Pauses polling when app goes to background (AppState)        │
│                                                                  │
│  NotificationsScreen (mobile):                                  │
│  → Fetches /api/notifications/recent every 15 seconds           │
│  → Fetches /api/notifications (all) on screen load              │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Unread Count Endpoint

```
GET /api/notifications/unread-count
  → Returns count of Notifications where IsRead = false
  → Scoped by role (AdminId or UserId from JWT)
  → Single COUNT query — very lightweight
```

### 4.3 Push Token Registration

```
Mobile only (Web uses browser notifications if available):

On every app cold start:
  1. Call registerForPushNotificationsAsync()
     → Requests EXPO_PUSH_TOKEN from Expo
  2. POST /api/auth/register-push-token  { expoPushToken }
  3. Token stored in User.ExpoPushToken
  4. Token can rotate on each cold start — always re-registered
```

### 4.4 Notification Types

| Type | When Created |
|------|-------------|
| `NewBooking` | Customer books, worker claimed job, cancellation requested |
| `BookingStatusChanged` | Status transitions, reschedule, admin edit, cancellation rejected |
| `BookingAssigned` | Worker picked up a job |
| `JobStarted` | Worker marks job as started |
| `WorkerArrived` | Worker marks arrival |
| `WorkerRunningLate` | Worker marks running late |
| `JobCompleted` | Worker finishes job |
| `JobPaused` | Worker pauses job |
| `JobResumed` | Worker resumes job |
| `BookingCancelled` | Booking cancelled |
| `LowStock` | Product stock drops below 20 |
| `SpecialOffer` | Admin assigns offer to user |
| `LoyaltyReward` | User earns loyalty reward |
| `ServiceAdded` | Worker adds service to booking |

---

## 5. Admin System Flow

### 5.1 Dashboard Data Loading

```
GET /api/stats/revenue  (AdminDashboard on web)
GET /api/stats/worker    (Worker stats)

Dashboard loads on mount:
  → Revenue chart: last 30 days of Completed bookings
  → Pending bookings count
  → Today's jobs count
  → Low stock products

Mobile AdminDashboard polls every 60 seconds via useNotificationPolling:
  → Only refreshes unread notification count badge
  → Does NOT auto-refresh dashboard data (manual pull-to-refresh)
```

### 5.2 Admin Bookings Page

```
URL: /admin/bookings

Data loading:
  → Initial: fetch first page of bookings (status-filtered)
  → Polling: 30s interval via usePolling hook
  → Re-polls on tab focus and visibility change

Filters: Status (Pending/Confirmed/InProgress/Completed/Cancelled/Paused)
Sort: ScheduledDate descending

Edit flow:
  1. Click booking → opens detail modal
  2. Load packagesAPI.getAllAdmin() for package selection
  3. Edit fields (date/time/vehicle/address/packages)
  4. On save: POST /api/bookings/{id}/admin-edit
     → Backend validates slot availability for new duration
     → If slot blocked: returns availableSlots[] in error response
     → Frontend shows slot alternatives
  5. Two-step confirmation (editConfirm state)

Cancel flow:
  1. Click cancel → shows cancel panel
  2. Toggle: "Customer request" (applies 25% fee) or "Our fault" (full refund)
  3. Optional refund override
  4. POST /api/bookings/{id}/admin-cancel-refund
```

### 5.3 Worker Management

```
GET /api/auth/workers → lists all workers (Admin only)
  → First + Last name, email, phone, IsActive, WorkingDays, ShiftStart/End, MonthlySalary

PUT /api/auth/workers/{id}/status → activate/deactivate worker
  → Deactivated workers cannot be assigned new bookings

PUT /api/auth/workers/{id}/schedule → set worker schedule
  → Updates WorkingDays (comma-separated), ShiftStart, ShiftEnd
  → OR updates DaySchedulesJson (per-day override JSON)
```

### 5.4 Reports

```
GET /api/reports/financial
  → Date range (from/to)
  → Returns: total revenue, total cost, total profit
  → Grouped by day or package

GET /api/reports/operational
  → Date range
  → Returns: completed jobs count, average job duration,
    jobs per worker, cancellation rate
```

---

## 6. Mobile App Flow

### 6.1 Startup Sequence

```
App.js cold start:
  │
  ▼
LoadingScreen (while AuthContext resolves)
  │
  ▼
AuthContext.init():
  1. Read token from AsyncStorage
  2. If token exists:
     a. Call authAPI.getCurrentUser() to validate token
     b. If 401/403 → clear storage, force re-login
     c. If success → setUser(freshUser), setToken
     d. Call syncPushToken() → register Expo push token with backend
  3. If no token → show Login screen
  │
  ▼
Root() renders:
  │
  ▼
AppNavigator(navigationRef):
  │
  ▼
NavigationContainer:
  │
  ├─ If NOT authenticated → AuthStack
  │   └─ Login → Register
  │
  ├─ If authenticated AND isAdmin → AdminStack
  │   └─ AdminDrawer (with drawer badge) → all admin screens
  │
  ├─ If authenticated AND isWorker → WorkerStack
  │   └─ Today Work → Worker Profile → Sales Kit
  │
  └─ If authenticated AND isCustomer → CustomerStack
      └─ CustomerDrawer (with notification badge) → Home, Packages, Booking, etc.
```

### 6.2 Deep Linking from Push Notifications

```
User taps notification (app may be closed or in background):
  │
  ▼
Notifications.addNotificationResponseReceivedListener fires:
  │
  ▼
Reads data.bookingId from notification payload
  │
  ▼
Navigates based on role:
  → Admin:   navigate('All Jobs', { openBookingId })
  → Worker:  navigate('Today Work', { openBookingId })
  → Customer: navigate('Main', { screen: 'My Bookings', params: { openBookingId } })
```

### 6.3 Booking Flow (Mobile Customer)

```
1. HomeScreen → "Book Now" → BookingScreen
2. Select package (fetched from PackagesContext or direct API)
3. Select date from calendar
4. Select time slot (fetched from /api/bookings/available-slots)
5. Enter vehicle info (make/model/year/type)
6. Enter address
7. Add offer code (optional)
8. Tap "Book" → POST /api/bookings/create-payment-intent
9. Stripe payment sheet appears
10. On confirm → POST /api/bookings
11. Navigate to BookingConfirmationScreen with bookingNumber
```

### 6.4 Admin vs Customer vs Worker Mode

```
The three stacks are completely separate:
  → AdminStack: AdminDrawer + AdminNotifications badge + admin screens
  → WorkerStack: Today Work + Worker Profile + Sales Kit (no drawer)
  → CustomerStack: CustomerDrawer + Notifications badge + customer screens

Role is determined by user.role from JWT decode (AuthContext):
  → isAdmin:  user?.role === 'Admin'
  → isWorker: user?.role === 'Worker'
  → Otherwise → customer
```

---

## 7. Web App Flow

### 7.1 Routing Structure

```
App.jsx (React Router v6):
  │
  ├─ Public routes (no auth):
  │   /             → Home
  │   /login         → Login
  │   /register      → Register
  │   /packages      → Packages (public listing)
  │   /plans         → Subscription plans
  │   /careers       → Careers page
  │
  ├─ Protected customer routes:
  │   /booking              → Booking flow (requires Customer)
  │   /booking-confirmation/:bookingNumber → Confirmation
  │   /my-bookings          → My Bookings
  │   /my-subscription      → My Subscription
  │   /subscribe            → Subscription checkout
  │   /profile              → Profile (any authenticated)
  │
  └─ Admin routes (lazy-loaded, wrapped in ProtectedRoute requireAdmin):
      /admin                     → Dashboard
      /admin/bookings            → All Bookings
      /admin/bookings/:id        → Booking Detail
      /admin/products            → Product Management
      /admin/services            → Service Management
      /admin/packages            → Package Management
      /admin/plans               → Subscription Plan Management
      /admin/offers              → Offers & Discounts
      /admin/reports/financial   → Financial Reports
      /admin/reports/operational → Operational Reports
      /admin/staff               → Staff Overview
      /admin/workers/management  → Worker Management
      /admin/workers/schedule   → Worker Schedules
      /admin/workers/sales      → Worker Sales
      /admin/notifications       → Notification Management
      /admin/settings            → System Settings
      /admin/subscription-bookings → Subscription Booking Mgmt
```

### 7.2 State Management

```
Context providers (App.jsx, innermost to outermost):
  1. AuthProvider     → user, token, login, logout, isAdmin, isWorker
  2. PackagesProvider  → packages list + loading state
  3. SettingsProvider  → system settings (business hours, etc.)
  4. FeaturesProvider  → feature flags (payments, subscriptions, etc.)
  5. LanguageProvider  → i18n language preference
  6. ToastProvider     → toast notification system
  7. ErrorBoundary     → global error catching

No Redux/Zustand/Jotai. Just React Context + local useState.
```

### 7.3 Polling Strategy (Web)

```
AdminBookings:
  → usePolling(loadBookings, 30_000, { onFocus: true, onVisibility: true })
  → 30-second interval
  → Re-triggers on window focus or tab visibility

MyBookings:
  → usePolling(loadBookings, 30_000)
  → Same interval

AdminDashboard:
  → No polling (manual refresh only)
  → Data loaded on mount via useEffect
```

### 7.4 API Client Pattern

```
All API calls go through src/api/*.js:

auth.js    → login, register, getCurrentUser, updateProfile, workers, etc.
bookings.js → all booking endpoints
packages.js → getAll (public), getAllAdmin (includes inactive)
notifications.js → unread count, recent, mark read
...

Each uses apiClient (axios instance):
  → Base URL: process.env.VITE_API_URL or localhost:5289
  → Interceptor: reads localStorage token, adds Authorization header
  → 401 response: calls logout(), redirects to /login
```

---

## 8. Backend Architecture

### 8.1 Controller vs Service Pattern

```
Controllers (Glanz.API/Controllers/):
  → Thin HTTP layer
  → Extracts user from JWT (GetUserId from ClaimTypes.NameIdentifier)
  → Authorizes via [Authorize] attributes
  → Calls Service methods
  → Returns ActionResult

Services (Glanz.API/Services/):
  → Business logic lives here
  → Injected via constructor (AppDbContext + other services)
  → NOT controllers — kept separate for testability

Key services:
  - TokenService           → JWT generation
  - ExpoPushService        → Expo push API integration
  - AdminNotificationService → ALL notification creation logic
  - PricingService         → Price/cost calculation
  - BookingSlotHelper      → Static slot availability helpers
  - BookingMaintenanceService → Background hosted service (runs every 5 min)
```

### 8.2 BookingMaintenanceService (Background Job)

```
Runs every 5 minutes as a hosted service:

1. Cleans expired SlotReservations
   → DELETE FROM SlotReservations WHERE ExpiresAt < NOW()

2. Cleans abandoned PaymentIntents
   → Cancels Stripe PI older than 30 min with no booking

3. Flags late arrivals
   → Bookings where ArrivedAt is set but WorkStartedAt is null
     after (scheduled end + 60 min)
```

### 8.3 Validation Flow

```
FluentValidation pattern:

DTO class → Validator class → [FluentValidationFilter]

Example: CreateBookingDtoValidator
  → Must have packageId > 0
  → Must have valid scheduledDate (not in past)
  → Must have valid timeSlot format
  → Must have vehicleType

Filter: catches ValidationException → returns 400 with errors
```

### 8.4 Error Handling

```
GlobalExceptionFilter (Glanz.API/Filters/GlobalExceptionFilter):
  → Catches all unhandled exceptions
  → Returns formatted JSON: { message, error }
  → Logs full stack trace to console

HTTP status mapping:
  ArgumentException     → 400
  UnauthorizedAccessException → 401
  KeyNotFoundException  → 404
  InvalidOperationException → 400
  all others → 500
```

### 8.5 Database Access Patterns

```
EF Core with PostgreSQL (Npgsql provider):

Good patterns:
  → Single DbContext instance per request (scoped)
  → Use .Include() for navigation properties
  → Use .Select() projection to limit data sent
  → Use .ToListAsync() / FirstOrDefaultAsync()

Heavy queries (reports, stats):
  → Run on Admin controller
  → Use AsNoTracking() for read-only queries
  → Indexed columns: Status, ScheduledDate, AssignedWorkerId

Raw SQL in Program.cs:
  → EnsurePostgresSchemaCompatibilityAsync runs on startup
  → Adds columns/indexes that hand-crafted migrations missed
  → Safe to call repeatedly (uses IF NOT EXISTS)
```

### 8.6 Rate Limiting

```
AspNetCoreRateLimit (IpRateLimiting):

Production:
  → * 500 req/min (all endpoints)
  → get:/* 300 req/min
  → post:/api/auth/* 20 req/5min
  → post:/api/bookings/* 30 req/min
  → post:/api/payments/* 20 req/min

Development:
  → * 10,000 req/min (effectively unlimited)

Applied via middleware (UseIpRateLimiting) — runs before auth.
```

---

## 9. Performance & Data Strategy

### 9.1 Polling Load Analysis

```
Current polling:

Web AdminBookings:     30s × N users   = N × 2 req/min per user
Web MyBookings:        30s × M users  = M × 2 req/min per user
Mobile (both):         60s × K users  = K × 1 req/min per user
Mobile Notifications:  15s × L users  = L × 4 req/min per user
Mobile AdminJobs:      30s × J users  = J × 2 req/min per user

At 100 concurrent users:
  → 200-400 DB queries/min just for polling
  → Most poll endpoints are lightweight COUNT or small SELECT
  → NOT a crisis, but not scalable to thousands

No SignalR, no WebSocket, no Server-Sent Events.
Everything is pull-based.
```

### 9.2 Database Hotspots

```
HIGH LOAD:
  → Notifications table (grows continuously, queried every poll)
  → Bookings table (status + scheduledDate queried constantly)

MEDIUM LOAD:
  → Users table (every auth request + worker schedule lookup)

LOW LOAD:
  → Products, Services, Packages (mostly read, rarely written)
  → Offers, UserOffers
  → SystemSettings
```

### 9.3 Recommendations

| Issue | Current State | Fix |
|-------|--------------|-----|
| Polling overhead | Every 30-60s per user | Implement SignalR for booking status changes |
| Notification table | Grows forever | Archive/purge old notifications monthly |
| No caching | Every request hits DB | Redis cache for packages, plans, settings |
| Heavy report queries | Full scan on large date ranges | Add date-indexed aggregate tables |
| Stripe webhook | No signature validation | Validate Stripe-Signature header |

---

## 10. Critical Dependencies

### 10.1 External Services

| Service | Purpose | API |
|---------|---------|-----|
| **Stripe** | Payment processing | stripe.net |
| **PostgreSQL** | Primary database | Npgsql |
| **Expo** | Push notifications | Expo push API |
| **BCrypt.Net** | Password hashing | NuGet |

### 10.2 Internal Dependencies

```
Glanz.API depends on:
  → Models/       (domain entities)
  → DTOs/         (request/response contracts)
  → Data/         (AppDbContext)
  → Services/     (business logic)
  → Validators/   (FluentValidation rules)
  → Filters/      (exception handling, validation)

Frontend (Web + Mobile) depends on:
  → API endpoints (assumes /api/* routes)
  → Backend DTOs as assumed response shapes
```

### 10.3 Environment Configuration

```
appsettings.json (dev defaults):
  → JwtSettings:SecretKey = "8K9mN2pQ5rT7wY0z..." (BLOCKED in prod)
  → Stripe:SecretKey = "YOUR_STRIPE_SECRET_KEY" (BLOCKED in prod)
  → DefaultConnection = PostgreSQL connection string
  → BusinessSettings:DayStart = "09:00"
  → BusinessSettings:DayEnd = "18:00"
  → AdminUser:Email = "admin@glanz.qa"
  → AdminUser:Password = "Admin123!"

appsettings.Development.local.json (personal overrides, .gitignored)

Production env vars:
  → JwtSettings__SecretKey
  → Stripe__SecretKey
  → DefaultConnection
  → PORT (defaults to 5289)
```

---

## 11. Current Limitations & Risks

### 11.1 Security Risks

| Risk | Severity | Description |
|------|----------|-------------|
| JWT secret in code | **CRITICAL** | Default secret in Program.cs — prod will crash without env var override |
| Stripe test keys in dev | LOW | Expected, but must rotate before prod |
| Stripe webhook no signature check | **HIGH** | Anyone can POST fake payment events |
| No rate limiting on auth in dev | LOW | 10,000/min in dev, 20/5min in prod |
| Expo push tokens not validated | MEDIUM | Assumed valid — no format check |

### 11.2 Scalability Risks

| Risk | Severity | Description |
|------|----------|-------------|
| No real-time updates | **HIGH** | Polling doesn't scale past ~500 concurrent users |
| Notifications table unbounded | MEDIUM | Grows forever, poll queries get slower |
| No connection pooling config | LOW | Npgsql default pooling may need tuning for high load |
| No read replica | MEDIUM | Reports + polling hit same DB as writes |

### 11.3 Operational Risks

| Risk | Severity | Description |
|------|----------|-------------|
| No email provider | **HIGH** | Notifications are in-app only, no email alerts |
| No SMS provider | MEDIUM | SMS mentioned in settings but Twilio not wired |
| No background job monitoring | MEDIUM | BookingMaintenanceService has no health check |
| DB migrations manual | LOW | Requires `dotnet ef database update` on deploy |

### 11.4 Data Integrity Risks

| Risk | Severity | Description |
|------|----------|-------------|
| SlotReservation 10-min expiry | MEDIUM | If user pays after expiry, slot may be taken — race condition |
| No idempotency on payment confirm | MEDIUM | Handled for booking creation but not for edits |
| Stock deduction not atomic | MEDIUM | If service errors mid-deduction, partial stock loss possible |
| No transaction on booking create | MEDIUM | Multi-step (PI confirm + booking create + notification) — could partially succeed |

---

## 12. Key File Reference

### Backend

| File | Purpose |
|------|---------|
| `Program.cs` | DI setup, middleware, rate limiting, DB migrations, seeding |
| `Controllers/BookingsController.cs` | All booking CRUD + worker actions (5,348 lines — largest) |
| `Controllers/AuthController.cs` | Auth + worker management |
| `Controllers/NotificationsController.cs` | Notification read/query/mark |
| `Controllers/ReportsController.cs` | Financial + operational reports |
| `Services/AdminNotificationService.cs` | Central notification creation + Expo push |
| `Services/BookingSlotHelper.cs` | Shared slot/availability logic |
| `Services/PricingService.cs` | Price/cost/profit calculation |
| `Services/BookingMaintenanceService.cs` | Background cleanup job |
| `Data/AppDbContext.cs` | All DbSets + index configurations |
| `Data/DevelopmentDataSeeder.cs` | Seed data for dev (users, products, services, packages, bookings) |

### Frontend Web

| File | Purpose |
|------|---------|
| `src/App.jsx` | Route tree, context providers, theme, dark mode |
| `src/context/AuthContext.jsx` | Auth state, token, login/logout |
| `src/hooks/usePolling.js` | Reusable polling hook |
| `src/pages/admin/AdminBookings.jsx` | Admin booking management |
| `src/pages/customer/MyBookings.jsx` | Customer booking list |
| `src/pages/customer/Booking.jsx` | Booking creation flow |
| `src/api/bookings.js` | All booking API calls |
| `src/api/auth.js` | All auth API calls |

### Mobile

| File | Purpose |
|------|---------|
| `App.js` | App entry, StripeProvider, auth init, deep link handler |
| `src/navigation/AppNavigator.js` | Navigation stacks for Admin/Worker/Customer |
| `src/context/AuthContext.js` | Auth state + push token sync |
| `src/hooks/useNotificationPolling.js` | Notification polling + haptic feedback |
| `src/screens/AdminJobsScreen.js` | Worker/Admin job list with 30s poll |
| `src/screens/AdminDashboardScreen.js` | Admin dashboard with 60s poll |

---

## 13. Quick Start Guide for New Developer

### Setup

```bash
# 1. Backend
cd Glanz-WebApp
dotnet run  # starts on port 5289, runs migrations, seeds DB

# 2. Web
cd Glanz-WebApp/glanz-frontend
npm install
npm run dev  # starts on port 5173

# 3. Mobile
cd Glanz-Mobile
npm install
npx expo start  # starts on port 8083

# 4. Login credentials
Admin:   admin@glanz.qa / Admin123!
Worker:  ahmed.mansoori@glanz.qa / Worker123!
Customer: khalid.althani@gmail.com / Customer123!
```

### Adding a New Booking Endpoint

1. Add DTO in `DTOs/BookingDtos.cs`
2. Add validator in `Validators/` (optional)
3. Add method in `BookingsController.cs`
4. Add service call if logic is non-trivial
5. Add client method in `glanz-frontend/src/api/bookings.js`
6. Add client method in `Glanz-Mobile/src/api/bookings.js`

### Adding a New Admin Page

1. Create component in `glanz-frontend/src/pages/admin/`
2. Add route in `App.jsx` using `adminRoute()` helper
3. Wrap in `ProtectedRoute requireAdmin`
4. Use `usePolling` hook if data should refresh automatically

---

*Document generated from codebase audit. Last updated: 2026-04-25.*