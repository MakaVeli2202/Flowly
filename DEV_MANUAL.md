# Glanz Developer Manual

> Target audience: Junior developers joining the Glanz project.
> This document covers architecture, feature flows, security model, debugging, and deployment.
> Read this before touching any code.

---

## Changelog

### Updated 2026-05-14 - gaps found and filled by Claude Code audit
- Added `GET /api/Auth/workers/check-short-code` to Auth endpoints table
- Added `POST /api/Auth/workers/suggest-shortcode` to Auth endpoints table
- Added `PUT /api/Packages/reorder` and `PUT /api/Services/reorder` to Services & Products endpoints
- Added `GET /api/Packages/admin/all` to endpoint table
- Added `DELETE /api/Auth/push-token` to Auth endpoints table
- Added missing Auth endpoints: `send-verification`, `verify-email`, `forgot-password`, `reset-password`, `google`, `google-callback`, `me/profile-image`
- Added section 4.18 - Staff Extended Fields (ShortCode, compensation, skills, schedule)
- Added section 4.19 - Package & Service Display Order (SortOrder system)
- Added section 4.20 - Admin Translations management
- Added section 11 - Known Tech Debt / TODO items found in codebase
- Fixed last-updated date

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [User Roles](#3-user-roles)
4. [Feature Documentation](#4-feature-documentation)
   - 4.1 [Authentication](#41-authentication)
   - 4.2 [Booking System](#42-booking-system)
   - 4.3 [Payments (Stripe)](#43-payments-stripe)
   - 4.4 [Coupons & Offers](#44-coupons--offers)
   - 4.5 [Loyalty System](#45-loyalty-system)
   - 4.6 [Worker Assignment](#46-worker-assignment)
   - 4.7 [Subscriptions](#47-subscriptions)
   - 4.8 [Notifications](#48-notifications)
   - 4.9 [Location Tracking](#49-location-tracking)
   - 4.10 [AI Chatbot Assistant](#410-ai-chatbot-assistant)
   - 4.11 [Public Data (Homepage)](#411-public-data-homepage)
   - 4.12 [Admin Content Management](#412-admin-content-management)
   - 4.13 [Detailer Skills System](#413-detailer-skills-system)
   - 4.14 [Services & Products CRUD](#414-services--products-crud)
   - 4.15 [Reports & Payroll](#415-reports--payroll)
   - 4.16 [Careers & Job Applications](#416-careers--job-applications)
   - 4.17 [Worker Sales & Scheduling](#417-worker-sales--scheduling)
5. [API Reference](#5-api-reference)
6. [Security Model](#6-security-model)
7. [Data Flow Examples](#7-data-flow-examples)
8. [Known Edge Cases & Race Conditions](#8-known-edge-cases--race-conditions)
9. [Debugging Guide](#9-debugging-guide)
10. [Deployment Notes](#10-deployment-notes)

---

## 1. System Overview

Glanz is a vehicle-detailing marketplace. Customers book detailing services for their vehicles. Workers (detailers) are assigned to jobs. Admins manage workers, pricing, and business settings.

### What the system does

- Customers book on-site vehicle cleaning (mobile or web).
- Payment is taken via Stripe at booking time (card, Apple Pay, Google Pay).
- Backend assigns a worker automatically or admin assigns manually.
- The assigned worker gets a notification, travels to the customer, completes the job, and uploads photos.
- Customers can apply coupons, earn loyalty points, and subscribe to recurring plans.

### Three apps, one backend

| App | Tech | Primary users |
|-----|------|---------------|
| Web frontend | React 19 + Vite + Tailwind | Customers + Admin |
| Mobile app | Expo 54 / React Native 0.81.5 | Customers + Workers + Admin |
| API backend | ASP.NET Core 10 | All clients |

The web and mobile apps are separate clients talking to the same REST API. **All business logic lives in the backend.** Frontend apps are thin display layers.

### Localization architecture (important)

- **Web:** custom translation provider in `glanz-frontend/src/context/LanguageContext.jsx`.
- **Mobile:** `react-i18next` with locale JSON files in `Glanz-Mobile/src/locales/`.
- **Fallback behavior:** missing translation keys render the key string; this is intentional for fast gap detection during QA.
- **Current convention:**
  - Web keys grouped by domain files (for example `common`, `bookings`).
  - Mobile keys grouped in top-level namespaces (for example `bookingFlow`, `adminPackages`, `adminJobs`).

If you add any user-facing text, add keys in all supported locales (`en`, `de`, `ar`) in the same change.

### Database

- **Development**: SQLite (`glanz.db` in repo root)
- **Production**: PostgreSQL
- ORM: Entity Framework Core 10 with code-first migrations

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                               │
│                                                                     │
│   ┌───────────────────────┐     ┌───────────────────────────────┐  │
│   │   Web App (React)     │     │  Mobile App (Expo/RN)         │  │
│   │   Port 5173 (dev)     │     │  Port 8083 (dev)              │  │
│   │                       │     │                               │  │
│   │  src/api/axios.js     │     │  src/api/axios.js             │  │
│   │  • JWT in JS heap     │     │  • JWT in SecureStore         │  │
│   │  • Refresh via        │     │  • Refresh via                │  │
│   │    HttpOnly cookie    │     │    AsyncStorage body param    │  │
│   │  • Auto-retry 401     │     │  • Auto-retry 401             │  │
│   └──────────┬────────────┘     └──────────────┬────────────────┘  │
└──────────────┼───────────────────────────────────┼─────────────────┘
               │ HTTPS REST + Bearer token          │
               └────────────────┬───────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│                      API BACKEND (ASP.NET Core 10)                  │
│                      Port 5289 (dev)                                │
│                                                                     │
│  Controllers/ → Services/ → Data/AppDbContext → SQLite / PostgreSQL │
│                                                                     │
│  Auth JWT (HS256) — 30 min access, 30 day refresh                   │
│  Role-based authorization: Customer | Employee | Admin              │
│  SignalR hub: /notificationHub (real-time web notifications)        │
│  Stripe SDK: secret key server-side only                            │
│  Webhook: POST /api/Webhooks/stripe (Stripe-Signature verified)     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
┌───────▼──────┐  ┌────────▼───────┐  ┌───────▼──────┐
│   Database   │  │     Stripe     │  │  Expo Push   │
│ SQLite/PgSQL │  │  (Payments)    │  │  (Mobile     │
│              │  │                │  │   Notifs)    │
└──────────────┘  └────────────────┘  └──────────────┘
```

### Token storage differences: Web vs Mobile

| Concern | Web | Mobile |
|---------|-----|--------|
| Access token | JS heap (never localStorage) | `expo-secure-store` (keychain/keystore) |
| Refresh token | HttpOnly cookie (browser sends automatically) | `expo-secure-store` (keychain/keystore) |
| User profile cache | Not persisted (fetched on load) | `AsyncStorage` (not sensitive) |
| Token delivery on refresh | Cookie sent by browser automatically | Refresh token sent in request body |

> **Why this matters**: HttpOnly cookies on web are immune to XSS — JS cannot read them.
> expo-secure-store on mobile uses the OS keychain/keystore — immune to other apps reading the file.
> Never revert to plain AsyncStorage for tokens.

---

## 3. User Roles

There are three roles. The `role` claim is embedded in the JWT and checked server-side on every protected endpoint.

### 3.1 Customer

**What they can do:**
- Register and log in
- Browse packages, services, pricing
- Book a detailing service (creates a Stripe PaymentIntent, then a booking)
- View, edit, and cancel their own bookings
- Apply coupon codes at checkout
- Earn and view loyalty points
- Subscribe to a recurring plan
- Manage vehicles and delivery addresses
- Upload a profile photo
- Chat with the AI assistant

**What they cannot do:**
- See other customers' bookings
- Assign workers
- View financial reports
- Access admin or worker screens

**API authentication:** Bearer token in `Authorization` header on every request except public endpoints (packages, available slots, quote).

---

### 3.2 Admin

**What they can do (everything Customer can, plus):**
- View and manage all bookings system-wide
- Create, activate, and deactivate workers
- Set worker schedules and salaries
- Assign workers to jobs manually
- Run financial, operational, and payroll reports
- Create and edit offers/coupons
- Manage packages, services, products, subscription plans
- View live worker locations on map
- Approve or reject Google-review loyalty requests
- Update system settings (business hours, cancellation policy, buffer times)
- Send test push notifications
- Access dev utilities (dev mode only)

**API note:** Admin endpoints return `403 Forbidden` if the caller's role is not `Admin`. The backend checks the JWT role claim — it does not trust any header sent by the client.

---

### 3.3 Worker (Employee)

**What they can do:**
- View their assigned jobs for the day
- Claim unassigned jobs that match their schedule
- Update job status (on-my-way → arrived → started → finished)
- Report running late with estimated delay minutes
- Pause and resume a job (e.g., waiting for customer)
- Upload job completion photos
- Mark checklist items complete
- Send "on my way" notification to customer (one time per booking)
- Mark self absent for a slot
- Update their live GPS location during a job

**What they cannot do:**
- See other workers' jobs
- Edit booking details (address, package, date)
- Access financial data
- Access the admin dashboard

---

## 4. Feature Documentation

### 4.1 Authentication

#### Registration flow

```
Customer fills form (name, email, phone, password, address)
  │
  ▼
POST /api/Auth/register
  │  Body: { firstName, lastName, email, phone, password, preferredAddress }
  │  Validates: email uniqueness, password strength
  │
  ▼
Backend creates User record, hashes password (ASP.NET Core Identity)
  │
  ▼
Returns: { token, refreshToken, user: { id, name, email, role } }
  │
  ▼
Web: JWT stored in JS heap, refresh token set as HttpOnly cookie
Mobile: JWT stored in SecureStore, refresh token stored in SecureStore
  │
  ▼
Push notification token synced to backend (mobile only)
SignalR connection opened (real-time notifications)
```

#### Login flow

Same as registration from the "Returns" step onward.

#### Token refresh flow

Access tokens expire in **30 minutes** (production). The axios interceptor on both web and mobile handles this transparently.

```
Any API call returns 401
  │
  ├─ Is this the /Auth/refresh endpoint itself? → reject immediately (avoids infinite loop)
  │
  ▼
Queue all in-flight requests
  │
  ▼
POST /api/Auth/refresh
  Web:    No body — browser sends HttpOnly cookie automatically
  Mobile: Body: { refreshToken: <value from SecureStore> }
  │
  ├─ Success → new JWT issued, all queued requests retried with new token
  │
  └─ Failure (refresh expired or revoked) → clear all tokens, redirect to login
```

#### Logout flow

```
User taps Logout
  │
  ▼
Clear push notification token from backend: DELETE /api/Auth/push-token
  │
  ▼
Revoke refresh token server-side: POST /api/Auth/logout
  │
  ▼
Clear local storage (SecureStore/cookie)
  │
  ▼
Disconnect SignalR
  │
  ▼
Redirect to login screen
```

#### Worker account creation (Admin only)

Admin calls `POST /api/Auth/register-worker` with the worker's details. The worker receives credentials. Workers cannot self-register.

---

### 4.2 Booking System

#### Full booking creation flow

```
Step 1 — Customer fills booking form
  Select vehicle (from saved vehicles or enter manually)
  Select package(s)
  Select date from availability calendar
  Select time slot from available slots
  Enter delivery address
  (Optional) Enter coupon code

Step 2 — Get quote
  POST /api/Bookings/quote
  Body: { vehicleType, packages, couponCode }
  Returns: { subtotal, discount, total, couponApplied }
  → Show price breakdown to customer

Step 3 — Create Payment Intent (if total > 0)
  POST /api/Payments/create-intent
  Body: { amount, currency, scheduledDate, timeSlot, durationMinutes }
  Returns: { clientSecret, intentId, amount, currency }
  → ALSO reserves the slot for 15 minutes (SlotReservation row in DB)
  → If another customer tries the same slot, backend shows it as unavailable

Step 4 — Present payment UI
  Web:    Stripe.js Elements (card form in browser)
  Mobile: Stripe React Native payment sheet (native UI)
  Customer enters card details — handled entirely by Stripe SDK
  Stripe SDK confirms payment directly with Stripe servers
  → Backend SECRET KEY never exposed to client

Step 5 — Create Booking
  POST /api/Bookings
  Body: { packages, vehicleType, address, scheduledDate, timeSlot, couponCode,
          stripePaymentIntentId, ... }
  Auth: Bearer token required
  Backend:
    1. Validates slot is still available (double-check)
    2. Validates payment intent ID matches amount (calls Stripe API)
    3. Checks idempotency key (prevents duplicate on network retry)
    4. Creates Booking record with status=Pending
    5. Auto-assigns worker if assignment mode = Auto
    6. Sends confirmation notification to customer
    7. Sends job notification to assigned worker (if any)
  Returns: { bookingNumber, bookingId, status, ... }

Step 6 — Webhook confirmation (async, within seconds)
  Stripe fires POST /api/Webhooks/stripe
  Event: payment_intent.succeeded
  Backend: moves booking from Pending → Confirmed, PaymentStatus → Paid
  → Customer sees "Confirmed" in their bookings list
```

#### Free booking flow (amount = 0)

When a coupon covers 100% of the cost, or a subscription booking has no charge:

```
Skip Steps 3–4 entirely (no PaymentIntent needed)
POST /api/Bookings
  Body does NOT include stripePaymentIntentId
  Backend detects amount = 0
  Sets PaymentStatus = Waived
  Sets Status = Confirmed immediately (no webhook needed)
```

#### Booking status states

```
Pending → Confirmed → InProgress → Completed
    │           │
    └───────────┴──→ Cancelled
```

| Status | Meaning | Who can trigger |
|--------|---------|-----------------|
| Pending | Created, payment processing | System |
| Confirmed | Payment confirmed | Stripe webhook / Admin |
| InProgress | Worker has started | Worker (POST /{id}/start) |
| Completed | Job finished | Worker (POST /{id}/finish) |
| Cancelled | Booking cancelled | Customer / Admin |

#### Cancellation and refund flow

**Customer cancellation:**
```
Customer requests cancellation:
  POST /api/Bookings/{id}/request-cancellation

Admin reviews request and either:
  Approves: POST /api/Bookings/{id}/admin-cancel-refund
    → Backend checks PaymentStatus:
      - PreAuthorized (not yet captured): calls Stripe CancelAsync() (void — no charge)
      - Paid (already captured): calls Stripe RefundService.CreateAsync()
    → Cancellation fee may apply (based on how close to appointment)
  Rejects: POST /api/Bookings/{id}/reject-cancellation-request
```

**Customer self-cancellation (direct DELETE):**
```
DELETE /api/Bookings/{id}
  Only allowed if booking is Pending or Confirmed
  Cannot cancel InProgress or Completed bookings
  Cancellation fee calculated automatically
```

---

### 4.3 Payments (Stripe)

#### Architecture principle

> **The Stripe secret key is NEVER sent to or stored by any client app.**
> All Stripe API calls that require the secret key (create intent, refund, cancel) happen in the backend.
> Clients only receive the `clientSecret` to confirm payment via the Stripe SDK.

#### Slot reservation

When `POST /api/Payments/create-intent` is called, the backend inserts a `SlotReservation` row:

```
SlotReservation {
  PaymentIntentId: "pi_xxx",
  ScheduledDate:   "2026-05-01",
  TimeSlot:        "10:00-11:30",
  ExpiresAt:       now + 15 minutes
}
```

The `/api/Bookings/available-slots` endpoint filters out slots that have an active (non-expired) reservation. This prevents two customers from booking the same slot at the same time.

After 15 minutes, if no booking is created, the reservation expires and the slot is freed automatically (ExpiresAt check in the query).

#### Payment capture model

Payments use **manual capture**:
1. `create-intent` → Stripe authorizes (pre-authorizes) the card. No charge yet.
2. After booking is confirmed: Stripe captures (charges) the card.
3. If booking is cancelled before capture: `CancelAsync()` voids the authorization. Customer is never charged.

#### Webhook events handled

| Event | Backend action |
|-------|---------------|
| `payment_intent.succeeded` | Move booking Pending → Confirmed, PaymentStatus → Paid |
| `payment_intent.payment_failed` | Set PaymentStatus → Failed (booking stays Pending for retry) |
| `payment_intent.canceled` | Move booking → Cancelled (Stripe expired the intent after 24h) |

**Every webhook is signature-verified.** If `Stripe:WebhookSecret` is missing, the backend throws — it will never accept unsigned (potentially forged) events.

#### Test vs production Stripe

| Environment | Keys to use |
|-------------|-------------|
| Development | `pk_test_...` publishable, `sk_test_...` secret |
| Production | `pk_live_...` publishable, `sk_live_...` secret |

Test card numbers: `4242 4242 4242 4242` (success), `4000 0000 0000 9995` (declined).

---

### 4.4 Coupons & Offers

#### Offer types

An `Offer` in the database can be:
- **Percentage discount** (e.g., 20% off)
- **Fixed amount discount** (e.g., 50 QAR off)
- **Free service** (100% discount)
- Offers can have expiry dates and usage limits

#### Coupon application flow

```
Customer enters coupon code at checkout
  │
  ▼
POST /api/Bookings/quote
  Body: { vehicleType, packages, couponCode: "PROMO20" }
  Backend validates:
    - Coupon exists and is active
    - Coupon is assigned to this customer (UserOffer record exists)
    - Coupon has not expired
    - Coupon has not been used
  Returns:
    Success: { subtotal, discount, total, couponApplied: true }
    Failure: { error: "Coupon not found" / "Coupon already used" / "Coupon expired" }
```

#### Admin coupon management

```
Create offer:       POST /api/Offers
Assign to user:     POST /api/Offers/{id}/assign/{userId}
Bulk assign:        POST /api/Offers/{id}/assign-bulk   (body: array of userIds)
View assignments:   GET  /api/Offers/user-coupons
```

#### Error responses (same in web and mobile)

| Scenario | HTTP status | Message |
|----------|-------------|---------|
| Code not found | 400 | "Coupon not found" |
| Already used | 400 | "Coupon already used" |
| Expired | 400 | "Coupon has expired" |
| Not assigned to this user | 400 | "Coupon not valid for your account" |

---

### 4.5 Loyalty System

The loyalty system is **stamp-card based**, not points-based. Every N completed paid bookings earns the customer a free-wash coupon. The system is gated behind a one-time Google review approval step.

#### Step 1 — Unlock (Google review)

```
Customer taps "Rate on Google" in My Bookings → opens Google review URL in browser
  │
  ▼
POST /api/Offers/loyalty/activate-google-review
  → Sets User.LoyaltyReviewPendingAt = now
  → Shows "Review submitted — pending verification" badge in My Bookings

Admin reviews: GET /api/Offers/loyalty/pending-reviews

Admin approves: POST /api/Offers/loyalty/{userId}/approve-review
  → Sets User.LoyaltyGoogleReviewActivatedAt = now
  → Customer's loyalty card is now active (stamps start counting from this date)

Admin rejects: POST /api/Offers/loyalty/{userId}/reject-review
  → Clears pending state — customer can try again
```

The loyalty activation timestamp gates which bookings count:
- Only bookings completed **after** `LoyaltyGoogleReviewActivatedAt` count toward stamps.
- Only bookings with `TotalAmount > 0` count (free reward bookings don't count toward the next cycle).

#### Step 2 — Earning stamps

```
Worker finishes booking → POST /api/Bookings/{id}/finish
  │
  ▼
Backend calls IssueLoyaltyCouponsAsync(userId)
  │
  ▼
Counts eligible completed bookings since activation
  │
  ▼
If count % triggerBookings == 0 → milestone reached
  └─ Issues a UserOffer (personal coupon code) to the customer
  └─ UserOffer.EarnedAtCompletedBookingsCount = count
     (prevents issuing duplicate coupon for the same milestone)
  └─ Coupon is valid for `offer.CouponValidityDays` days
```

#### Stamp card UI states (My Bookings)

| Backend state | UI display |
|---|---|
| `bookingsToNext > 0` | N filled car stamps out of trigger, progress bar at N/trigger% |
| `bookingsToNext == 0` **and** coupon available | "Reward Ready!" badge, all stamps filled, coupon code shown with "Book Free Wash" button |
| `bookingsToNext == 0` **and** no coupon (coupon already redeemed, free booking not yet completed) | "Free wash booked!" badge, **0 stamps filled**, progress bar at 0%, message: "Stamps will reset once your wash is completed" |

The third state is important: after the customer books their free wash, the coupon is immediately marked `IsRedeemed = true`. The next cycle can't start until the free booking is completed (so the counter increments). The UI correctly shows a fresh empty card rather than keeping all stamps highlighted.

#### Loyalty API endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/Offers/my-loyalty` | Customer | Full loyalty card state (programs, coupons, progress) |
| GET | `/api/Offers/loyalty-progress` | Customer | Per-program progress |
| POST | `/api/Offers/loyalty/activate-google-review` | Customer | Submit review for approval |
| GET | `/api/Offers/loyalty/pending-reviews` | Admin | List customers awaiting review approval |
| POST | `/api/Offers/loyalty/{userId}/approve-review` | Admin | Approve and activate customer's loyalty card |
| POST | `/api/Offers/loyalty/{userId}/reject-review` | Admin | Reject review submission |

---

### 4.6 Worker Assignment

#### Assignment modes

The backend supports two modes, configurable via `PUT /api/Bookings/assignment-mode`:

**Auto mode** (default):
```
New booking created
  │
  ▼
Backend queries all active workers
  │
  ▼
Filters: worker is active, works on booking's day, shift overlaps booking slot, no conflicting bookings
  │
  ▼
Picks first available worker → assigns automatically
  │
  ▼
Sends push notification to assigned worker
```

**Manual mode:**
```
New booking created → status = Confirmed, no worker assigned
  │
  ▼
Admin receives "Unassigned booking" alert in dashboard
  │
  ▼
Admin views available workers: GET /api/Bookings/{id}/available-workers
  (returns workers whose schedule fits the booking's date/time)
  │
  ▼
Admin assigns: POST /api/Bookings/assign-worker
  Body: { bookingId, workerId }
```

#### Worker job status transitions

Workers update status via mobile app:

```
Confirmed (assigned)
  │
  ▼ POST /{id}/on-my-way     → Sends customer a "worker is on the way" push notification
  │                             (one-time only per booking — cannot send twice)
  ▼ POST /{id}/arrived        → Worker is at the location
  │
  ▼ POST /{id}/start          → Job begins (WorkerStartedAt timestamp recorded)
  │
  ├─ POST /{id}/pause         → Work paused (PausedAt recorded)
  │    └─ POST /{id}/resume   → Work resumed (ResumeDuration accumulated)
  │
  ├─ POST /{id}/running-late  → Sends customer notification with delay estimate
  │
  ▼ POST /{id}/finish         → Job complete (WorkerFinishedAt, photos required)
```

---

### 4.7 Subscriptions

Customers can subscribe to recurring plans that include a set number of bookings per month.

```
Customer views plans:   GET /api/Plans
Customer subscribes:    POST /api/Plans/{planId}/subscribe
                        (payment charged for plan period)
View my subscription:   GET /api/Subscriptions/my-subscription

Booking within subscription:
  GET  /api/SubscriptionBookings/availability  → available slots for subscriber
  POST /api/SubscriptionBookings               → book a slot (no extra charge if within plan)
  GET  /api/SubscriptionBookings/my            → view my subscription bookings
  DELETE /api/SubscriptionBookings/{id}        → cancel a subscription booking
```

---

### 4.8 Notifications

> **Important**: Despite the file being named `signalr.js`, the web frontend no longer uses a live WebSocket/SignalR connection. It was replaced with an HTTP polling approach. The SignalR hub still exists on the backend (`/notificationHub`) but is **not used by the current web client**.

#### Web (polling)

`src/api/signalr.js` manages an interval-based poller that calls `GET /api/notifications` every **15 seconds** using the authenticated `apiClient` (Bearer token applied automatically). It dispatches new notifications to all subscribers via a `Set` of listener callbacks.

```
startNotificationConnection() called after login or page-refresh auth
  │
  ▼
setInterval(poll, 15000)  +  immediate first poll
  │
  ▼
First poll — seeds already-known notification IDs (no sound/callback fired)
  │
  ▼
Subsequent polls — any new notification ID fires all subscribed callbacks
  │
  ▼
Navbar subscribes via subscribeToNotifications(fn) — updates bell badge + dropdown
```

Key behaviors:
- **No duplicate firing**: dispatched IDs are tracked in `_dispatchedIds`. A notification is never dispatched more than once per session.
- **Seed-only first poll**: prevents sounding an alert for old notifications when the user first loads the page.
- **Auth**: always uses `apiClient` (axios), which holds the in-memory Bearer token. Never uses `localStorage`.
- **Pause on hover**: the bell dropdown pauses `animation-play-state` but does NOT stop polling.
- `stopNotificationConnection()` clears the interval and resets the seed flag.
- `subscribeToNotifications(fn)` returns an unsubscribe function — call it in component cleanup.
- `clearDispatchedNotifications()` is available to reset seen-IDs (e.g., on logout).

#### Notification click routing (web)

When a customer clicks a notification in the Navbar dropdown, the destination depends on notification type:

| Notification type | Customer navigates to | Admin navigates to |
|---|---|---|
| `NewBooking`, `BookingConfirmed`, `BookingCancelled`, `BookingStatusChanged`, `BookingReassigned`, `BookingClaimed` | `/my-bookings` (highlights the booking) | `/admin/bookings` (highlights the booking) |
| `SpecialOffer`, `OfferAssigned` | `/my-bookings` | (no special routing) |
| All others | No navigation | No navigation |

Highlight is done by writing `bookingId` to `sessionStorage` and dispatching a `highlight-customer-booking` or `highlight-booking` CustomEvent that the respective page listens for.

#### Mobile (Expo Push Notifications)

Mobile uses Expo's push notification service. Flow:

```
Mobile app starts → registerForPushNotificationsAsync()
  │
  ▼
Expo SDK returns device push token (string)
  │
  ▼
PUT /api/Auth/push-token  { token: "ExponentPushToken[xxx]" }
  (stored on User record in DB)
  │
  ▼
When event occurs (booking confirmed, worker on way, etc.):
  Backend calls Expo Push API with stored token
  Device displays push notification
```

The mobile app also polls `/api/Notifications` on a short interval as a fallback for missed pushes.

#### Notification types

| Event | Who receives |
|-------|-------------|
| `NewBooking` | Admin |
| `BookingConfirmed` | Customer |
| `BookingCancelled` | Customer + Admin |
| `BookingStatusChanged` | Customer |
| `BookingReassigned` | Customer + Worker |
| `BookingClaimed` | Customer |
| `BookingUnassigned` | Admin |
| `WorkerOnMyWay` | Customer |
| `WorkerArrived` | Customer |
| `JobStarted` | Customer |
| `JobCompleted` | Customer |
| `PaymentFailed` | Customer + Admin |
| `PayrollDue` | Admin |
| `SpecialOffer` | Customer (targeted) |
| `OfferAssigned` | Customer |
| `LoyaltyRewardEarned` | Customer |

#### Notification API endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/Notifications` | Required | All notifications (paginated) |
| GET | `/api/Notifications/recent` | Required | Latest N notifications |
| GET | `/api/Notifications/unread-count` | Required | Count of unread |
| PUT | `/api/Notifications/{id}/mark-read` | Required | Mark one as read |
| PUT | `/api/Notifications/mark-all-read` | Required | Mark all as read |
| POST | `/api/Notifications/send-test` | Admin | Send a test notification |

---

### 4.9 Location Tracking

Workers share their GPS location during active jobs.

```
Worker starts job (POST /{id}/start)
  │
  ▼
Mobile app begins sending location every N seconds:
  POST /api/Location/update
  Body: { latitude, longitude, bookingId }
  │
  ▼
Customer or Admin can view:
  GET /api/Location/{bookingId}  → returns latest { latitude, longitude, updatedAt }
  │
  ▼
Worker finishes job → POST /api/Location/stop/{bookingId}
  Location tracking stops
```

The admin live map (`/admin/live-map`) shows all active workers on a Google Map in real time. It polls the location endpoint periodically and places markers for each worker that has a booking in progress. Admins can click a marker to see the worker's name and current job details.

---

### 4.10 AI Chatbot Assistant

An in-app assistant allows customers to ask questions about services, pricing, bookings, and cancellations. It is available on both mobile (`ChatbotScreen`) and the web frontend.

#### How it works

The chatbot endpoint (`POST /api/Chatbot/chat`) has two modes:

**AI mode (Claude API configured):**
- If `Anthropic:ApiKey` is set in `appsettings.json`, the backend calls the Anthropic Claude API.
- The system prompt is built dynamically from live DB data (active packages with names, tiers, prices, estimated durations).
- Claude responds as a Glanz customer service representative.
- Responses are marked `isAI: true` in the response DTO.

**Canned FAQ mode (default / fallback):**
- Used when no API key is configured, or when the Claude call fails.
- Matches the customer's message against a dictionary of keywords (case-insensitive): `hello`, `price`, `cancel`, `book`, `payment`, `subscription`, `hours`, `contact`, `refund`, etc.
- Returns pre-written answers covering common questions.
- Responses are marked `isAI: false`.

#### Integration notes

To enable live AI responses:
1. Get an Anthropic API key from [console.anthropic.com](https://console.anthropic.com).
2. Add to `appsettings.json`:
   ```json
   "Anthropic": {
     "ApiKey": "sk-ant-..."
   }
   ```
3. The chatbot will automatically use Claude for all messages.
4. If the API call fails (e.g., rate limit), it gracefully falls back to canned answers.

#### Chatbot API

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/Chatbot/chat` | None | Send a message, get a reply |

**Request:**
```json
{ "message": "How do I cancel a booking?" }
```

**Response:**
```json
{ "reply": "To cancel, go to My Bookings...", "isAI": true }
```

---

### 4.11 Public Data (Homepage)

The customer-facing homepage (`Home.jsx` / `HomeScreen`) loads live data from several public (unauthenticated) endpoints:

#### Service marquee

The scrolling ticker on the homepage pulls service names from `/api/Services`. If the API returns no results, the frontend falls back to a hardcoded list of service names.

#### Homepage stats

`GET /api/Stats` returns aggregate statistics displayed on the homepage (total bookings completed, total customers, etc.). This endpoint requires no authentication.

#### Customer reviews carousel

`GET /api/Reviews/public` returns approved customer reviews for the homepage carousel.  
`GET /api/Reviews/summary` returns aggregate review stats (average rating, total count).

If the public reviews API returns no data, `reviewsAPI.getPublic()` returns a hardcoded set of sample reviews as fallback.

#### Reviews API

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/Reviews/public` | None | Approved reviews for homepage |
| GET | `/api/Reviews/summary` | None | Aggregate rating stats |
| POST | `/api/Reviews` | Customer | Submit a review |
| GET | `/api/Reviews` | Admin | All reviews (manage) |
| PUT | `/api/Reviews/{id}/approve` | Admin | Approve a review |
| DELETE | `/api/Reviews/{id}` | Admin | Delete a review |

---

### 4.12 Admin Content Management

Admins can edit customer-facing text labels (hero heading, subheading, CTA button text, booking page intro, etc.) without a code deployment.

- **Web page**: `/admin/content` (`AdminContent.jsx`)
- **Mobile screen**: `AdminContentScreen.js`
- **Storage**: `localStorage` under the key `siteContent` (browser-side). Changes are broadcast to other open tabs via a `siteContentChanged` CustomEvent on `window`.
- **Persistence**: Content is stored in the browser. It does NOT sync to the backend or to other devices. If `localStorage` is cleared, content resets to defaults.

Editable fields include:

| Field | Where shown |
|-------|-------------|
| Hero badge text | Homepage hero area |
| Hero heading | Homepage hero heading |
| Hero subheading | Homepage subtext |
| Primary CTA label | Homepage "Book Now" button |
| Secondary CTA label | Homepage second button |
| Booking page intro | Top of the booking flow |

---

### 4.13 Detailer Skills System

Admins can define a library of detailing skills and assign them to individual workers.

- **Web page**: `/admin/skills` (`AdminSkills.jsx`)
- **Storage**: `localStorage` keys `adminSkills` (skill library) and `adminWorkerSkills` (per-worker assignments). Not backed by a database table.
- **Events**: Changes fire a `workerSkillsChanged` CustomEvent so other open tabs/components can update live.

**Skill categories**: `Exterior`, `Interior`, `Specialty`, `Other`

Each skill has: `id`, `name`, `category`, `description`.

Worker skill assignments are used for display purposes and planned smart job matching. Currently the auto-assignment algorithm does not filter by skills — that is a future enhancement.

---

### 4.14 Services & Products CRUD

#### Services

Admins manage the list of services offered (linked to packages). Services power the homepage marquee.

- **Web page**: `/admin/services` (`AdminServices.jsx`)
- **Mobile screen**: `AdminServicesScreen.js`
- **API**: `ServicesController.cs`

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/Services` | None | List all services |
| POST | `/api/Services` | Admin | Create service |
| PUT | `/api/Services/{id}` | Admin | Update service |
| DELETE | `/api/Services/{id}` | Admin | Delete service |

#### Products

Admins manage physical/chemical products used in services.

- **Web page**: `/admin/products` (`AdminProducts.jsx`)
- **Mobile screen**: `AdminProductsScreen.js`
- **API**: `ProductController.cs` (or `ProductsController.cs`)

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/Products` | None | List all products |
| POST | `/api/Products` | Admin | Create product |
| PUT | `/api/Products/{id}` | Admin | Update product |
| DELETE | `/api/Products/{id}` | Admin | Delete product |

---

### 4.15 Reports & Payroll

#### Financial & Operational Reports

- **Web pages**: `AdminReportFinancial.jsx`, `AdminReportOperational.jsx` (accessible via `/admin/reports`)
- **Mobile screen**: `AdminReportsScreen.js`
- **API**: `ReportsController.cs`

Reports include: revenue by date range, bookings breakdown, worker performance, cancellation rates, package popularity.

PDF export is available on web (browser print-to-PDF).

#### Payroll

- **Web page**: `/admin/payroll` (`AdminPayroll.jsx`), also embedded in `AdminStaff.jsx`
- **Flow**: Admin selects month/year → views per-worker breakdown → marks workers as paid → optionally prints payslips.

**Payslip generation**: clicking "Print Payslip" opens an HTML popup → triggers `window.print()`. A plain-text download is also available.

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/Reports/payroll?month=X&year=Y` | Admin | Monthly payroll summary |
| PUT | `/api/Auth/workers/{id}/salary` | Admin | Set worker monthly salary |
| POST | `/api/Auth/workers/mark-paid` | Admin | Mark workers as paid for a month |
| GET | `/api/Auth/workers/payroll/check-due` | Admin | Check if payroll run is due |
| GET | `/api/Auth/workers/payroll/settings` | Admin | Payroll settings (e.g., pay day) |
| PUT | `/api/Auth/workers/payroll/settings` | Admin | Update payroll settings |

---

### 4.16 Careers & Job Applications

Glanz has a public careers page where applicants can browse open positions and submit applications.

- **Public page**: `/careers` (`Careers.jsx`) — lists active job positions
- **Admin pages**: `/admin/job-positions` (`AdminJobPositions.jsx`), `/admin/job-applications` (`AdminJobApplications.jsx`)
- **Mobile**: This feature is web-only by design
- **API**: `JobApplicationsController.cs`

#### Flow

```
Admin creates job position → POST /api/JobApplications/positions
  → Visible on /careers public page

Applicant visits /careers, clicks "Apply" → submits form
  → POST /api/JobApplications
  → Admin notified

Admin reviews: GET /api/JobApplications (with status filter)
Admin shortlists or rejects: PUT /api/JobApplications/{id}/status
```

---

### 4.17 Worker Sales & Scheduling

#### Worker Sales

Tracks revenue generated by each worker, used for performance review and commission calculations.

- **Web page**: `/admin/worker-sales` (`AdminWorkerSales.jsx`)
- **Mobile screen**: `WorkerSalesScreen.js`

#### Admin Notification Management

---

### 4.18 Staff Extended Fields

The `Staff` model includes extended fields beyond basic identity. These were added in migration `AddStaffExtendedFields`.

#### Short Code

- A 4-character uppercase identifier (e.g., `MOMA`) unique across all staff.
- Used for stamp in/out attendance identification.
- Generation cascade (tried in order until non-colliding): `fn[0:2]+ln[0:2]`, `fn[0:3]+ln[0]`, `fn[0]+ln[0:3]`, `fn[0:2]+ln[1:3]`, `fn[0:4]`, `ln[0:4]`, then `base3+2`, `base3+3`, ...
- Uniqueness enforced: DB unique index on `Staff.ShortCode` (partial, only when non-null). Backend validates on `register-worker` and on `check-short-code`.
- Always stored UPPERCASE. Comparison is case-insensitive.
- API: `GET /api/Auth/workers/check-short-code?code=X` returns `{ available, normalized, suggestions }`. `POST /api/Auth/workers/suggest-shortcode` returns `{ suggested }` from name.
- Frontend: `AdminAddStaff.jsx` auto-calls `suggest-shortcode` on name blur (debounced 600ms), pre-fills field with "auto-generated" label. User can override.

#### Compensation

- `CompensationType`: `"Salary"` (fixed monthly) or `"Percentage"` (per-job commission).
- `MonthlySalary`: decimal, only used when `CompensationType = "Salary"`.
- `PercentageRate`: decimal 0-100, only used when `CompensationType = "Percentage"`. Worker earns this % of each completed job's revenue.

#### Skills

- `SkillsJson`: JSON array of skill name strings, e.g. `["Polish","Ceramic Coat"]`.
- Managed via `AdminSkills.jsx` (defines skill library) and `AdminAddStaff.jsx` (assigns to worker).
- Skill library stored in `localStorage:adminSkills`. Not a DB table.

---

### 4.19 Package & Service Display Order

Both packages and services have a `SortOrder` (int, default 0) column that controls the display sequence on all customer-facing screens.

- All queries use `OrderBy(SortOrder).ThenBy(Id)` as tiebreaker.
- Admins reorder via up/down arrows in `AdminPackages.jsx` and `AdminServices.jsx`.
- Reorder is optimistic: state updates immediately, then calls the API. On error, reverts to DB state.
- Batch reorder endpoint accepts `[{ id: int, sortOrder: int }]`.

---

### 4.20 Admin Translations

Admins can manage multilingual content labels (service names, package names, descriptions) without a code deploy.

- **Web page**: `/admin/translations` (`AdminTranslations.jsx`)
- **API**: `AdminTranslationsController.cs`
- All three languages (English, Arabic, German) are shown simultaneously in one row per item.
- Arabic inputs use `dir="rtl"` and right-aligned text.
- Untranslated fields are highlighted with amber borders.
- CSV export available for offline translation work.
- Translations are stored in the database, not in locale JSON files.

Admins can view a log of all system notifications sent across the platform.

- **Web page**: `/admin/notifications` (`AdminNotifications.jsx`)

---


### Auth endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/Auth/register` | None | Customer signup |
| POST | `/api/Auth/login` | None | Login (all roles) |
| POST | `/api/Auth/refresh` | None | Refresh JWT (refresh token in HttpOnly cookie on web, body on mobile) |
| POST | `/api/Auth/logout` | Required | Revoke refresh token |
| GET | `/api/Auth/me` | Required | Get my profile |
| PUT | `/api/Auth/me` | Required | Update my profile |
| POST | `/api/Auth/change-password` | Required | Change password |
| PUT | `/api/Auth/push-token` | Required | Register Expo push token |
| POST | `/api/Auth/register-worker` | Admin | Create worker account |
| GET | `/api/Auth/workers` | Admin | List all workers |
| PUT | `/api/Auth/workers/{id}/schedule` | Admin | Update worker shift |
| PUT | `/api/Auth/workers/{id}/status` | Admin | Activate/deactivate worker |
| PUT | `/api/Auth/workers/{id}/salary` | Admin | Set worker monthly salary |
| DELETE | `/api/Auth/workers/{id}` | Admin | Delete worker |
| GET | `/api/Auth/workers/check-short-code` | Admin | Check if a short code is available; returns `{ available, normalized, suggestions }` |
| POST | `/api/Auth/workers/suggest-shortcode` | Admin | Generate a short code from first/last name via cascade algorithm; returns `{ suggested }` |
| POST | `/api/Auth/workers/mark-paid` | Admin | Mark workers as paid for a month |
| GET | `/api/Auth/workers/payroll` | Admin | Payroll summary |
| GET | `/api/Auth/workers/payroll/check-due` | Admin | Check if payroll run is due |
| GET | `/api/Auth/workers/payroll/settings` | Admin | Payroll/payslip settings |
| PUT | `/api/Auth/workers/payroll/settings` | Admin | Update payroll settings |
| POST | `/api/Auth/send-verification` | None | Send email verification code |
| POST | `/api/Auth/verify-email` | None | Verify email with code |
| POST | `/api/Auth/forgot-password` | None | Send password reset email |
| POST | `/api/Auth/reset-password` | None | Reset password with token |
| PUT | `/api/Auth/push-token` | Required | Register Expo push token |
| DELETE | `/api/Auth/push-token` | Required | Remove Expo push token on logout |
| POST | `/api/Auth/me/profile-image` | Required | Upload profile image |
| GET | `/api/Auth/google` | None | Initiate Google OAuth login |
| GET | `/api/Auth/google-callback` | None | Google OAuth callback |

### Booking endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/Bookings` | Required | Create booking |
| GET | `/api/Bookings` | Required | My bookings (customer) |
| GET | `/api/Bookings/all` | Admin | All bookings |
| GET | `/api/Bookings/Employee` | Worker | My assigned bookings |
| GET | `/api/Bookings/{bookingNumber}` | Required | Booking detail |
| GET | `/api/Bookings/available-slots` | None | Available time slots for a date |
| GET | `/api/Bookings/availability-calendar` | None | Month availability grid |
| GET | `/api/Bookings/constraints` | None | Public holidays / closed days |
| GET | `/api/Bookings/workers/schedule` | Admin | Workers' schedule for a date |
| GET | `/api/Bookings/workers/day-timeline` | Admin | Hour-by-hour worker timeline |
| GET | `/api/Bookings/assignment-mode` | Admin | Current assignment mode |
| PUT | `/api/Bookings/assignment-mode` | Admin | Set assignment mode (manual/auto) |
| POST | `/api/Bookings/quote` | None | Price quote (also validates coupon) |
| POST | `/api/Bookings/create-payment-intent` | None | Create Stripe PaymentIntent + hold slot |
| PUT | `/api/Bookings/{id}/customer-edit` | Customer | Edit booking (date/time/notes) |
| PUT | `/api/Bookings/{id}/admin-edit` | Admin | Admin edit booking |
| PUT | `/api/Bookings/{id}/status` | Admin | Update booking status |
| PUT | `/api/Bookings/{id}/payment-status` | Admin | Update payment status |
| DELETE | `/api/Bookings/{id}` | Required | Delete/cancel booking |
| POST | `/api/Bookings/{id}/claim` | Worker | Worker self-assigns an unassigned booking |
| POST | `/api/Bookings/assign-worker` | Admin | Assign specific worker to booking |
| GET | `/api/Bookings/{id}/available-workers` | Admin | Workers available for a booking's slot |
| POST | `/api/Bookings/{id}/start` | Worker | Start job |
| POST | `/api/Bookings/{id}/on-my-way` | Worker | Send on-my-way notification (once only) |
| POST | `/api/Bookings/{id}/arrived` | Worker | Mark arrived at customer |
| POST | `/api/Bookings/{id}/finish` | Worker | Complete job (triggers loyalty issuance) |
| POST | `/api/Bookings/{id}/pause` | Worker | Pause active job |
| POST | `/api/Bookings/{id}/resume` | Worker | Resume paused job |
| POST | `/api/Bookings/{id}/running-late` | Worker | Send running-late notification |
| POST | `/api/Bookings/{id}/photos` | Worker | Upload before/after photos |
| GET | `/api/Bookings/{id}/photos` | Required | Get booking photos |
| PUT | `/api/Bookings/{bookingId}/checklist/{checklistItemId}` | Worker | Tick off a checklist item |
| POST | `/api/Bookings/{id}/add-package` | Admin | Add package to in-progress booking |
| POST | `/api/Bookings/{id}/add-service` | Admin | Add ad-hoc service to booking |
| POST | `/api/Bookings/{id}/request-cancellation` | Customer | Request cancellation (may incur fee) |
| POST | `/api/Bookings/{id}/request-reschedule` | Customer | Request reschedule |
| POST | `/api/Bookings/{id}/reject-cancellation-request` | Admin | Reject customer cancellation request |
| POST | `/api/Bookings/{id}/reject-reschedule-request` | Admin | Reject customer reschedule request |
| GET | `/api/Bookings/{id}/cancellation-fee` | Required | Preview cancellation fee |
| POST | `/api/Bookings/{id}/admin-cancel-refund` | Admin | Admin-initiated cancel + Stripe refund |
| POST | `/api/Bookings/worker-absence` | Admin | Block a worker as absent for a day |

### Offer / Loyalty endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/Offers` | None | Active offers |
| GET | `/api/Offers/my-coupons` | Customer | My coupons |
| GET | `/api/Offers/user-coupons` | Admin | All user coupons (admin view) |
| GET | `/api/Offers/my-loyalty` | Customer | Full loyalty card state |
| GET | `/api/Offers/loyalty-progress` | Customer | Per-program progress |
| POST | `/api/Offers/loyalty/activate-google-review` | Customer | Submit Google review for approval |
| GET | `/api/Offers/loyalty/pending-reviews` | Admin | Customers awaiting review approval |
| POST | `/api/Offers/loyalty/{userId}/approve-review` | Admin | Approve and activate loyalty card |
| POST | `/api/Offers/loyalty/{userId}/reject-review` | Admin | Reject review submission |
| POST | `/api/Offers` | Admin | Create offer |
| PUT | `/api/Offers/{id}` | Admin | Edit offer |
| DELETE | `/api/Offers/{id}` | Admin | Delete offer |
| POST | `/api/Offers/{id}/assign/{userId}` | Admin | Assign coupon to specific user |
| POST | `/api/Offers/{id}/assign-bulk` | Admin | Assign coupon to multiple users |

### Payment endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/Payments/create-intent` | Required* | Create PaymentIntent + reserve slot |
| GET | `/api/Payments/intent/{intentId}` | Required* | Check intent status |
| POST | `/api/Webhooks/stripe` | None (signature) | Stripe event receiver |

> *Auth bypassed in dev when `DevBypass:AllowDevBypass = true`

### Vehicle endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/Vehicles` | Customer | My vehicles |
| POST | `/api/Vehicles` | Customer | Add vehicle |
| PUT | `/api/Vehicles/{id}` | Customer | Update vehicle |
| DELETE | `/api/Vehicles/{id}` | Customer | Remove vehicle |
| PUT | `/api/Vehicles/{id}/default` | Customer | Set default vehicle |

### Notification endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/Notifications` | Required | All notifications (paginated) |
| GET | `/api/Notifications/recent` | Required | Latest N notifications |
| GET | `/api/Notifications/unread-count` | Required | Count of unread |
| PUT | `/api/Notifications/{id}/mark-read` | Required | Mark one as read |
| PUT | `/api/Notifications/mark-all-read` | Required | Mark all as read |
| POST | `/api/Notifications/send-test` | Admin | Send a test notification |

### Services & Products endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/Services` | None | List all services (sorted by SortOrder) |
| POST | `/api/Services` | Admin | Create service |
| PUT | `/api/Services/{id}` | Admin | Update service |
| DELETE | `/api/Services/{id}` | Admin | Delete service |
| PUT | `/api/Services/reorder` | Admin | Batch-update SortOrder; body: `[{ id, sortOrder }]` |
| GET | `/api/Packages` | None | List active packages (sorted by SortOrder) |
| GET | `/api/Packages/admin/all` | Admin | All packages including inactive |
| GET | `/api/Packages/{id}` | None | Single package |
| POST | `/api/Packages` | Admin | Create package |
| PUT | `/api/Packages/{id}` | Admin | Update package |
| DELETE | `/api/Packages/{id}` | Admin | Delete package |
| PATCH | `/api/Packages/{id}/toggle-active` | Admin | Toggle package active state |
| PUT | `/api/Packages/reorder` | Admin | Batch-update SortOrder; body: `[{ id, sortOrder }]` |
| GET | `/api/Products` | None | List all products |
| POST | `/api/Products` | Admin | Create product |
| PUT | `/api/Products/{id}` | Admin | Update product |
| DELETE | `/api/Products/{id}` | Admin | Delete product |

### Reviews endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/Reviews/public` | None | Approved reviews for homepage carousel |
| GET | `/api/Reviews/summary` | None | Aggregate rating statistics |
| POST | `/api/Reviews` | Customer | Submit a review |
| GET | `/api/Reviews` | Admin | All reviews |
| PUT | `/api/Reviews/{id}/approve` | Admin | Approve a review |
| DELETE | `/api/Reviews/{id}` | Admin | Delete a review |

### Stats endpoint

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/Stats` | None | Public homepage statistics (total bookings, customers, etc.) |

### Settings endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/Settings` | Admin | All app settings |
| PUT | `/api/Settings` | Admin | Update settings (multipliers, hours, etc.) |
| GET | `/api/AdminSettings/cancellation-policy` | Admin | Cancellation fee policy |
| PUT | `/api/AdminSettings/cancellation-policy` | Admin | Update cancellation fee policy |

### Chatbot endpoint

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/Chatbot/chat` | None | Send a message, receive a reply |

### Location endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/Location/update` | Worker | Send GPS location for active booking |
| GET | `/api/Location/{bookingId}` | Required | Get latest worker location for booking |
| POST | `/api/Location/stop/{bookingId}` | Worker | Stop location tracking for booking |

### Addresses endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/Addresses` | Customer | My saved addresses |
| POST | `/api/Addresses` | Customer | Save a new address |
| PUT | `/api/Addresses/{id}` | Customer | Update address |
| DELETE | `/api/Addresses/{id}` | Customer | Remove address |

### Job Applications endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| GET | `/api/JobApplications/positions` | None | Active job positions (public) |
| POST | `/api/JobApplications/positions` | Admin | Create job position |
| PUT | `/api/JobApplications/positions/{id}` | Admin | Update job position |
| DELETE | `/api/JobApplications/positions/{id}` | Admin | Delete job position |
| POST | `/api/JobApplications` | None | Submit job application |
| GET | `/api/JobApplications` | Admin | All applications |
| PUT | `/api/JobApplications/{id}/status` | Admin | Update application status |

---

## 6. Security Model

### What the frontend MUST NOT trust

1. **Prices**: Never compute final price on the client. Always call `/api/Bookings/quote`. The backend recalculates everything.
2. **Payment amounts**: The amount in the PaymentIntent is set by the backend. Do not pass an arbitrary amount from the client and trust it.
3. **Roles**: Never show or hide UI based on a role stored in AsyncStorage or localStorage. The backend rejects calls that don't match the JWT role claim.
4. **Booking status**: Always re-fetch from backend. Do not infer status from local state after an action.
5. **Stripe**: Never call the Stripe API directly from client-side code with any key that is not the publishable key.

### Backend authorization rules

| Endpoint category | Rule |
|-------------------|------|
| Customer data | User can only access their own records. Backend filters by `userId` from JWT, never from request body. |
| Admin endpoints | `[Authorize(Roles = "Admin")]` — JWT role must be `Admin`. No exceptions. |
| Worker endpoints | `[Authorize(Roles = "Employee")]` — JWT role must be `Employee`. |
| Public endpoints | Explicitly marked. Anything else is authenticated by default. |

### Payment security rules

1. Stripe secret key exists only in `appsettings.json` / environment variables on the server. Never in frontend code.
2. Webhook endpoint verifies `Stripe-Signature` header using HMAC. If the signature is missing or wrong, the request is rejected with `400 Bad Request`.
3. PaymentIntent ID sent in booking creation is verified against Stripe API by the backend — the backend confirms the intent's amount matches the expected booking amount before creating the booking.
4. Idempotency key on booking creation prevents a network retry from creating a duplicate booking.

### Token security rules

| Platform | Access token | Refresh token |
|----------|-------------|---------------|
| Web | JS memory (heap) only. Never written to localStorage. | HttpOnly cookie (inaccessible to JS) |
| Mobile | `expo-secure-store` (OS keychain/keystore, encrypted at rest) | `expo-secure-store` |

**Production JWT settings:**
- Access token: 30 minutes maximum (hard-capped in `TokenService.cs`)
- Refresh token: 30 days, rotated on use
- Algorithm: HS256 with 256-bit secret key (must be set via environment variable in production)

### Input validation

- All DTOs use data annotations (`[Required]`, `[EmailAddress]`, `[MaxLength]`, etc.)
- Controller actions with `[ApiController]` auto-return 400 if model state is invalid
- Business rule validation (slot availability, coupon validity, payment amounts) is in the service layer
- SQL injection is not possible — EF Core uses parameterized queries exclusively

---

## 7. Data Flow Examples

### 7.1 Complete booking creation flow (paid)

```
1. Customer opens BookingScreen
2. GET /api/Packages → display package options
3. GET /api/Bookings/availability-calendar?date=2026-05-01 → show available days
4. GET /api/Bookings/available-slots?date=2026-05-01&duration=90 → show time slots
5. Customer selects: SUV, Premium Package (90 min), 10:00 slot, May 1
6. POST /api/Bookings/quote
   Body: { vehicleType: "SUV", packages: [{ id: 3, qty: 1 }], couponCode: null }
   Returns: { subtotal: 250, discount: 0, total: 250, currency: "QAR" }
7. Customer taps "Pay 250 QAR"
8. POST /api/Payments/create-intent
   Body: { amount: 250, currency: "QAR", scheduledDate: "2026-05-01", timeSlot: "10:00-11:30", durationMinutes: 90 }
   Returns: { clientSecret: "pi_xxx_secret_yyy", intentId: "pi_xxx", amount: 250, currency: "QAR" }
   (Backend also inserts SlotReservation expiring in 15 minutes)
9. Stripe SDK presents payment sheet to customer
10. Customer enters card 4242 4242 4242 4242 → confirms
11. Stripe returns success to SDK
12. POST /api/Bookings
    Body: { packages: [...], vehicleType: "SUV", address: "...", scheduledDate: "2026-05-01",
            timeSlot: "10:00-11:30", stripePaymentIntentId: "pi_xxx", idempotencyKey: "uuid-abc" }
    Backend:
      a. Checks slot still available (SlotReservation is still active ✓)
      b. Calls Stripe API: verifies pi_xxx status = requires_capture, amount = 250 ✓
      c. Checks idempotencyKey not in DB (first attempt ✓)
      d. Creates Booking { status: Pending, paymentStatus: PreAuthorized }
      e. Auto-assigns Worker #4
      f. Sends push notification to Worker #4
    Returns: { bookingNumber: "GZ-20260501-0042", bookingId: 87 }
13. Stripe fires webhook: payment_intent.succeeded
    Backend: Booking #87 → status: Confirmed, paymentStatus: Paid
14. Customer sees booking as "Confirmed" in MyBookings
```

### 7.2 Coupon redemption flow

```
1. Customer has coupon code "SUMMER25" (25% off, assigned to their account)
2. At checkout, enters "SUMMER25" in coupon field
3. POST /api/Bookings/quote
   Body: { vehicleType: "Sedan", packages: [{ id: 1, qty: 1 }], couponCode: "SUMMER25" }
   Backend:
     a. Finds Offer with code "SUMMER25"
     b. Finds UserOffer: { userId: 12, offerId: 5, usedAt: null } → not used ✓
     c. Checks offer.ExpiresAt > now ✓
     d. Calculates: subtotal=200, discount=50, total=150
   Returns: { subtotal: 200, discount: 50, total: 150, couponApplied: true }
4. POST /api/Payments/create-intent  → amount: 150
5. ... (normal payment flow with 150 QAR) ...
6. POST /api/Bookings  → includes couponCode: "SUMMER25"
   Backend marks UserOffer.UsedAt = now
```

### 7.3 Free booking flow (100% coupon)

```
1. Customer has "FIRST_FREE" coupon (100% discount)
2. POST /api/Bookings/quote → total: 0
3. Customer sees "Free" — no payment step shown
4. POST /api/Bookings
   Body: { ..., couponCode: "FIRST_FREE" }
   No stripePaymentIntentId in body
   Backend:
     a. Detects total = 0
     b. Skips Stripe validation entirely
     c. Creates Booking { status: Confirmed, paymentStatus: Waived }
     d. Assigns worker
5. No webhook needed — booking is immediately Confirmed
```

### 7.4 Worker job execution flow

```
Worker opens mobile app → AdminJobsScreen loads: GET /api/Bookings/Employee
  → Lists today's assigned jobs

Worker taps job → sees customer address, vehicle, package details

Worker travels to customer
  Mobile: starts sending GPS: POST /api/Location/update every 30s

Worker taps "On My Way" button (one time only):
  POST /api/Bookings/{id}/on-my-way
  → Customer receives push: "Your detailer is on the way!"
  → WorkerOnMyWayAt timestamp saved — button disabled after first use

Worker arrives:
  POST /api/Bookings/{id}/arrived
  → Customer receives push: "Your detailer has arrived"

Worker starts job:
  POST /api/Bookings/{id}/start
  → Booking status → InProgress
  → Timer begins

Worker finishes:
  POST /api/Bookings/{id}/finish
  → Booking status → Completed
  → Worker uploads photos: POST /api/Bookings/{id}/photos
  → Location tracking stops: POST /api/Location/stop/{id}
  → Customer receives push: "Your car is ready!"
  → Loyalty points awarded to customer
```

---

## 8. Known Edge Cases & Race Conditions

### 8.x i18n coverage risk (May 2026)

- High-traffic screens are mostly localized, but some long admin/worker screens can still contain hardcoded literals.
- Before release, perform a repository-wide i18n gap scan and patch remaining text literals in admin surfaces first.

### 8.1 Double booking (slot race condition)

**Risk**: Two customers view the same slot as available, both proceed to payment simultaneously.

**Mitigation implemented**:
- `POST /api/Payments/create-intent` inserts a `SlotReservation` with a 15-minute expiry.
- `/api/Bookings/available-slots` excludes slots with active reservations.
- The second customer will not see the slot as available.

**Remaining risk**: If two customers call `create-intent` within the same millisecond before either reservation is committed. The `SlotReservations` table has a composite check — first write wins. The second customer will receive an error at booking creation time.

**What to do**: If a customer reports "slot was taken", ask them to select another time.

### 8.2 Payment succeeded but app crashed before booking creation

**Risk**: Stripe charges the card but the app closed before `POST /api/Bookings` was called. The customer paid but has no booking record.

**Mitigation implemented**:
- Stripe fires `payment_intent.succeeded` webhook.
- Webhook handler finds a booking by `StripePaymentIntentId` and confirms it if it exists.
- If NO booking exists (app crashed before POST), the booking must be created manually by admin using the Stripe Dashboard payment intent ID.

**What to do**: Customer contacts support, provides transaction reference. Admin creates booking manually in dashboard and links the payment intent.

### 8.3 Double booking creation (network retry)

**Risk**: `POST /api/Bookings` succeeds but the client loses network before receiving the response. Client retries. Two bookings created for same slot and payment.

**Mitigation implemented**:
- Client generates a UUID `idempotencyKey` before the first attempt.
- Backend checks if `idempotencyKey` already exists in bookings. If yes, returns the existing booking (no duplicate created).

**Important**: The client MUST generate the idempotency key once and reuse it on retries. Never generate a new key on each attempt.

### 8.4 Token expiry during a long operation

**Risk**: Customer is filling out the booking form (10+ minutes), their token expires, and the booking creation call returns 401.

**Mitigation implemented**:
- Axios interceptor catches 401, silently refreshes, retries the original request.
- Customer never sees a login prompt during this flow.

**Failure path**: Refresh token also expired (user has been inactive for 30+ days). In this case, the user is logged out and redirected to login. Their partially filled form is lost. This is expected behavior.

### 8.5 Worker absence on day of job

**Risk**: Worker marks themselves absent after being assigned to a job.

**Current behavior**:
- Worker calls `POST /api/Bookings/worker-absence`.
- Admin receives notification of absent worker.
- Admin must manually reassign affected bookings.
- No automatic reassignment in current implementation.

**What to do**: Admin opens affected bookings, uses available-workers endpoint to find a substitute, and reassigns.

### 8.6 Payment mismatch (amount manipulation attempt)

**Risk**: A malicious client sends a `stripePaymentIntentId` with a lower-value intent (e.g., paid only 10 QAR but booking costs 200 QAR).

**Mitigation implemented**:
- Backend calls Stripe API with the `intentId` to retrieve the actual amount.
- Compares Stripe's amount with the backend-calculated booking total.
- If mismatch → `400 Bad Request`, booking not created.

### 8.7 Webhook replay attacks

**Risk**: An attacker resends a previously captured Stripe webhook to confirm a booking that was not actually paid.

**Mitigation implemented**:
- Stripe includes a timestamp in the signature. Signatures older than 5 minutes are rejected.
- The `EventUtility.ConstructEvent()` call enforces this tolerance automatically.

### 8.8 Expired coupon applied between quote and booking

**Risk**: Coupon is valid when quote is fetched, but expires (or is revoked) before the booking POST is submitted.

**Mitigation implemented**:
- Coupon is validated again in `POST /api/Bookings`, not just in `/quote`.
- If expired between the two calls, the booking fails with `400 Bad Request: "Coupon has expired"`.
- The customer must retry without the coupon or with a valid one.

---

## 9. Debugging Guide

### 9.1 Where to check logs

**Backend (development)**:
```
Console output in the terminal running `dotnet run`
Look for lines prefixed with:
  [Webhook]    → payment events
  [Booking]    → booking creation errors
  [Auth]       → authentication issues
  [Stripe]     → Stripe API errors
```

**Production**:
Logs are written to stdout (standard Docker/cloud logging pattern). Check your hosting provider's log viewer.

### 9.2 How to trace a booking

1. Get the booking number (format: `GZ-YYYYMMDD-NNNN`) from the customer.
2. In the database: `SELECT * FROM Bookings WHERE BookingNumber = 'GZ-xxx'`
3. Check `StripePaymentIntentId` — look up that payment in Stripe Dashboard.
4. Check `Status` and `PaymentStatus` to understand current state.
5. Check `AssignedWorkerId` — if null, booking was never assigned.
6. Check `UpdatedAt` timestamps to see when state changed.

### 9.3 How to debug payment issues

**"Payment failed" before booking created:**
1. Open Stripe Dashboard → Payments → find the customer's payment intent.
2. Check the decline reason (insufficient funds, card blocked, etc.).
3. The booking will be in `Pending` status with `PaymentStatus = Failed`.
4. Customer must retry with a different card.

**"Charged but no booking:"**
1. Find the PaymentIntent ID in Stripe Dashboard.
2. Search Bookings table: `SELECT * FROM Bookings WHERE StripePaymentIntentId = 'pi_xxx'`
3. If no row: app crashed after payment. Create booking manually.
4. If row exists but Status = Pending: webhook may not have fired. Trigger webhook replay from Stripe Dashboard.

**Webhook not arriving:**
1. Check `Stripe:WebhookSecret` is set correctly in `appsettings.json` or environment.
2. Check Stripe Dashboard → Webhooks → endpoint → recent deliveries — see if Stripe attempted delivery.
3. Common cause: the endpoint URL is wrong (check for trailing slash or path mismatch).
4. Common cause: dev environment not exposed to internet (use `stripe listen --forward-to` CLI for local dev).

### 9.4 How to debug authentication issues

**"401 on every request after login":**
1. Check the `Authorization` header is being sent: `Bearer <token>`.
2. Verify the token is not expired: decode at jwt.io, check `exp` claim.
3. Check `JwtSettings:SecretKey` in appsettings matches what was used to sign the token.
4. If refreshing: check that `POST /api/Auth/refresh` is receiving the refresh token (in cookie for web, in body for mobile).

**"403 Forbidden on admin endpoint:"**
1. Decode the JWT at jwt.io. Check the `role` claim — it must be `Admin`.
2. If role is wrong, the user was created with wrong role. Update in DB: `UPDATE Users SET Role = 'Admin' WHERE Id = X`

**"Token not refreshing on mobile:"**
1. Check `expo-secure-store` is installed (`npx expo install expo-secure-store`).
2. Verify `refreshToken` key exists in SecureStore (add debug logging temporarily).
3. Check that `POST /api/Auth/refresh` body includes `{ refreshToken: "..." }`.

### 9.5 How to debug booking slot issues

**"No slots available" when there should be:**
1. Check business hours settings: `GET /api/Settings` — verify `DayStart` and `DayEnd`.
2. Check the requested date is not a holiday: `GET /api/Bookings/constraints`.
3. Check active workers' schedules: `GET /api/Bookings/workers/schedule?date=YYYY-MM-DD`.
4. Check for active `SlotReservations` that haven't expired: `SELECT * FROM SlotReservations WHERE ExpiresAt > NOW()`
5. Check if all workers are on leave or absent for that day.

### 9.6 How to debug auth on page reload (web)

When `POST /api/Auth/refresh` or `GET /api/Auth/me` returns 401 immediately after a page load:

**Root cause A — React Strict Mode double-fire:**  
In development, React Strict Mode mounts → unmounts → remounts every component. This means any `useEffect` with `[]` deps runs twice. If two `/Auth/refresh` calls race, the backend may rotate the token, making the second call fail.

Fix already in place: `AuthContext.jsx` uses `initCalledRef = useRef(false)` to guard against the second invocation:
```js
if (initCalledRef.current) return;
initCalledRef.current = true;
```
`useRef` survives the unmount/remount cycle (unlike `useState`), so the guard works correctly.

**Root cause B — Token not set before `GET /Auth/me`:**  
If `setAuthToken(token)` is called AFTER `authAPI.getCurrentUser()`, the `/Auth/me` request will have no `Authorization` header.

Correct order in `initAuth()`:
```js
const refreshed = await authAPI.refresh();
setAuthToken(refreshed.token);          // ← MUST come first
const currentUser = await authAPI.getCurrentUser();  // ← now has the token
setToken(refreshed.token);
setUser(currentUser);
```

**Checking in browser:**
1. Open DevTools → Network tab.
2. Reload the page.
3. Look for `POST /Auth/refresh` → should return 200 with a new token.
4. Look for `GET /Auth/me` → should return 200. If 401, check the `Authorization` request header is present.

---

## 10. Deployment Notes

### 10.1 Development vs Production differences

| Setting | Development | Production |
|---------|-------------|------------|
| Database | SQLite (file) | PostgreSQL |
| JWT expiry | 720 minutes (12 hours) | 30 minutes (hard cap) |
| Stripe keys | `pk_test_` / `sk_test_` | `pk_live_` / `sk_live_` |
| DevBypass | Can be enabled (skip auth on payments) | Must be disabled / absent |
| CORS | Allows localhost origins | Restrict to your domain only |
| Logging | Verbose console | Structured JSON to stdout |
| HTTPS | Optional (HTTP OK for dev) | Required |

### 10.2 Required environment variables (production)

These MUST be set before going live. Never commit production values to git.

**Backend** (`appsettings.Production.json` or environment):

```
JwtSettings__SecretKey          = <256-bit random key, e.g. output of `openssl rand -base64 32`>
JwtSettings__Issuer             = https://yourdomain.com
JwtSettings__Audience           = glanz-app

ConnectionStrings__DefaultConnection = Host=...;Database=glanz;Username=...;Password=...

Stripe__SecretKey               = sk_live_...
Stripe__WebhookSecret           = whsec_...   (from Stripe Dashboard → Webhooks → signing secret)

DevBypass__AllowDevBypass       = false        (MUST be false in production)
```

**Web frontend** (`.env.production`):

```
VITE_API_BASE_URL=https://api.yourdomain.com/api
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**Mobile** (`app.config.js` or EAS Secrets):

```
EXPO_PUBLIC_API_BASE_URL=https://api.yourdomain.com/api
EXPO_PUBLIC_STRIPE_KEY=pk_live_...
```

### 10.3 Stripe production checklist

- [ ] Go live on Stripe: activate your account, complete business verification
- [ ] Replace all `sk_test_` / `pk_test_` keys with `sk_live_` / `pk_live_`
- [ ] Create webhook endpoint in Stripe Dashboard: `POST https://api.yourdomain.com/api/Webhooks/stripe`
- [ ] Subscribe to events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`
- [ ] Copy signing secret into `Stripe__WebhookSecret`
- [ ] Test webhook delivery from Stripe Dashboard using "Send test event"

### 10.4 Database migrations

Run after any model change:

```bash
cd Glanz-WebApp
dotnet ef migrations add <MigrationName>
dotnet ef database update
```

In production, run migrations before deploying the new API binary:

```bash
dotnet ef database update --connection "Host=prod-host;..."
```

### 10.5 Mobile build for production

```bash
cd Glanz-Mobile

# Install expo-secure-store if not already:
npx expo install expo-secure-store

# Production build via EAS:
eas build --platform android --profile production
eas build --platform ios     --profile production

# Submit to stores:
eas submit --platform android
eas submit --platform ios
```

### 10.6 Things that are intentionally web-only

These features exist only on the web and are NOT expected on mobile — this is by design:

| Feature | Reason |
|---------|--------|
| AdminDevSettings | Dev/debug utilities — not useful in a mobile release |
| Careers / Job Applications | Public landing page feature |
| PDF report export | Mobile file system limitations; not a core operator workflow |
| Address autocomplete (full map) | Mobile uses text input with Nominatim autocomplete |
| Admin Content Management (`/admin/content`) | Text is stored in browser localStorage — not synced to backend |
| Admin Skills system (`/admin/skills`) | Skill data stored in localStorage — not synced to backend |
| Live Map Tracking (`/admin/live-map`) | Admin overview; mobile workers only send location, don't view the map |

### 10.7 Security checklist before going live

- [ ] `JwtSettings__SecretKey` set via environment variable (not in code)
- [ ] `Stripe__WebhookSecret` set and verified
- [ ] `DevBypass__AllowDevBypass` = false
- [ ] CORS restricted to production domains only
- [ ] HTTPS enforced (HTTP redirect to HTTPS)
- [ ] `appsettings.*.local.json` files in `.gitignore`
- [ ] No test Stripe keys in production config
- [ ] Database backups configured
- [ ] expo-secure-store in use for mobile token storage (✓ done in codebase)

---

---

## 11. Known Tech Debt / TODO Items

These were found by grepping `TODO`, `FIXME`, `HACK`, `XXX` across the codebase on 2026-05-14.

| File | Line | Issue |
|------|------|-------|
| `Glanz.API/Middleware/CorrelationIdMiddleware.cs` | 12 | If Serilog is added, replace ILogger scope with structured logging |
| `Glanz.API/Program.cs` | 381 | Remove `unsafe-inline` from `style-src` CSP header - allows CSS injection. Requires auditing inline styles. |
| `Glanz.API/Services/SmtpEmailService.cs` | 21 | Document free SMTP options for production email delivery. No email provider configured yet. |
| `glanz-frontend/src/components/shared/ChatWidget.jsx` | 6 | Replace placeholder Anthropic API key comment with real key in `appsettings.json` to enable AI mode. |

### Additional known gaps (not TODO comments but flagged by audit)

- Admin Content Management stores content in browser `localStorage` only - not synced to backend or other devices.
- Detailer Skills system stores skill library in browser `localStorage` only - not backed by a DB table.
- Worker auto-assignment algorithm does not filter by worker skills (skills are display-only currently).
- SignalR hub exists on backend (`/notificationHub`) but web frontend uses HTTP polling instead. Hub is unused by current clients.
- No automatic worker reassignment when a worker marks themselves absent - admin must manually reassign.
- WhatsApp integration (`WhatsAppWidget.jsx`, `WhatsAppScreen.js`) links to a WhatsApp number only - no agent or booking automation is implemented.

---

## TODO: Restore Local-Speed Performance

The deployed site is slow (~60s first load) due to free-tier hosting limitations (Render spins down after 15 min inactivity). **Goal: restore the fine, smooth, fast feel of local development.**

Top priorities:
- Upgrade Render backend from free tier (or add uptime pinger) to eliminate cold starts
- Keep API warm with an uptime monitor (e.g. UptimeRobot free plan pinging `/api/health` every 5 min)
- Consider self-hosting or a cheap VPS if budget allows
- Do NOT accept sluggish UX as "just how it is" -- local dev proves it can be instant

---

*Last updated: 2026-05-14*
*Maintained by: Backend & Mobile lead*
