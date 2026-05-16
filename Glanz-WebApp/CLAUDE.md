# Claude Code Guidelines - Glanz

## Role & Goal
AI Developer for Glanz — a vehicle cleaning marketplace platform.
Stack: ASP.NET Core 10 + React 19 web app, Expo/React Native mobile.
Be direct, minimal tokens, no fluff. Read files before editing.

---

## Repos & Ports
| Repo | Path | Port | Notes |
|------|------|------|-------|
| API | `Glanz-WebApp/Glanz.API/` | 5289 | SQLite dev / PostgreSQL prod |
| Web | `Glanz-WebApp/glanz-frontend/` | ~5173 | React + Vite + Tailwind |
| Mobile | `Glanz-Mobile/` | 8083 | Expo 54, React Native 0.81.5 |

```bash
# Backend
cd Glanz-WebApp && dotnet run
# Web
cd Glanz-WebApp/glanz-frontend && npm run dev
# Mobile
cd Glanz-Mobile && npm start
```

---

## Backend Architecture (`GetItCleaned.API`)

### Key Files
- `Program.cs` — DI, JWT, Stripe config, CORS, SignalR, middleware
- `Data/AppDbContext.cs` — EF Core context + all DbSets
- `Controllers/` — thin HTTP layer (BookingsController, AuthController, SubscriptionsController, etc.)
- `Services/` — business logic (IAdminNotificationService, SignalR hub)
- `DTOs/` — all API contracts (`BookingDtos.cs`, `AuthDtos.cs`, `SubscriptionDtos.cs`)
- `Models/` — domain entities (`Booking.cs`, `ApplicationUser.cs`, `Package.cs`, etc.)
- `Migrations/` — EF Core history (SQLite dev, Postgres prod)

### Models: Key Fields
**Booking**
- `int Id`, `string BookingNumber`, `int? UserId` (FK to ApplicationUser)
- `int? AssignedWorkerId` (FK to ApplicationUser)
- `BookingStatus Status` enum: Pending, Confirmed, InProgress, Completed, Cancelled
- `PaymentStatus PaymentStatus` enum: Pending, PreAuthorized, Paid, Refunded, Waived
- `string? StripePaymentIntentId`
- `DateTime ScheduledDate`, `string TimeSlot` (e.g. "09:00-10:00")
- `int EstimatedDurationMinutes`, `decimal TotalAmount`, `decimal EstimatedCost`, `decimal EstimatedProfit`
- `VehicleType VehicleType` enum: Motorcycle, Sedan, SUV, Pickup

**ApplicationUser** (also workers/admin)
- `string Role` — "Customer" | "Worker" | "Admin"
- `bool IsActive`
- `string WorkingDays` (comma-separated, e.g. "Monday,Tuesday,Wednesday")
- `string ShiftStart` / `ShiftEnd` (e.g. "09:00" / "18:00")

### Pricing Logic
- `GetVehicleMultiplier(VehicleType)` → Motorcycle=0.8, Sedan=1.0, SUV=1.25, Pickup=1.5
- `unitPrice = Math.Round(package.Price * vehicleMultiplier, 2)`
- `BookingItem.Price` = unit price already with multiplier applied
- Cost = sum of `ServiceProduct.QuantityUsed * Product.CostPerUnit` per item

### Slot / Availability Logic
- `DailyTimeSlots` = static list built from `BusinessSettings:DayStart/DayEnd` (default 09:00-18:00), hourly steps
- `BuildCandidateStartSlots(durationMinutes)` → 30-min step starts within business hours
- `IsSlotAvailableForEditAsync(date, slot, durationMinutes, excludeBookingId, preferredWorkerId?)` → checks all workers for free capacity at that slot
- `GetAvailableSlotsForDateAsync(date, durationMinutes, excludeBookingId)` → lists free slots on a date; used to suggest alternatives
- `WorkerWorksOnDay(workingDays, DayOfWeek)` — parses comma-separated day names
- `HasWorkerTimeConflict(workerBookings, slot, durationMinutes)` — checks overlap

### Key Endpoints (BookingsController)
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/Bookings/create-payment-intent` | Public | Creates Stripe PI, validates packages/slot |
| POST | `/Bookings` | Public | Creates booking after PI |
| GET | `/Bookings` | Customer | Get my bookings |
| GET | `/Bookings/all` | Admin | All bookings |
| GET | `/Bookings/worker` | Worker | Worker's bookings |
| PUT | `/Bookings/{id}/status` | Admin | Update booking status |
| PUT | `/Bookings/{id}/payment-status` | Admin | Update payment status |
| POST | `/Bookings/assign-worker` | Admin | Assign/unassign worker |
| GET | `/Bookings/{id}/available-workers` | Admin | Workers availability for a booking |
| PUT | `/Bookings/{id}/admin-edit` | Admin | Full booking edit (date/time/vehicle/address/packages) |
| PUT | `/Bookings/{id}/customer-edit` | Customer | Customer self-service edit |
| POST | `/Bookings/{id}/admin-cancel-refund` | Admin | Cancel + Stripe void/refund atomically |
| GET | `/Bookings/{id}/cancellation-fee` | Any | Cancellation fee preview |
| GET | `/Bookings/available-slots` | Public | Available time slots for a date |
| GET | `/Bookings/availability-calendar` | Public | Month availability calendar |
| POST | `/Bookings/{id}/arrived` | Worker | Mark arrived |
| POST | `/Bookings/{id}/start` | Worker | Start job |
| POST | `/Bookings/{id}/finish` | Worker | Finish job |
| POST | `/Bookings/{id}/running-late` | Worker | Mark running late |
| POST | `/Bookings/{id}/request-cancellation` | Customer | Request cancellation |
| POST | `/Bookings/{id}/request-reschedule` | Customer | Request reschedule |
| GET/PUT | `/Bookings/assignment-mode` | Admin | Auto/manual assign toggle |
| POST | `/Bookings/worker-absence` | Admin | Mark worker absent + reassign |

### Admin Cancel + Refund (`POST /Bookings/{id}/admin-cancel-refund`)
- `AdminCancelRefundDto { decimal? RefundAmountOverride, string? CancellationNote }`
- If `PaymentStatus == PreAuthorized` → `PaymentIntentService.CancelAsync()` (void PI)
- If `PaymentStatus == Paid` → `RefundService.CreateAsync()` (partial or full)
- Sets `Status = Cancelled`, `PaymentStatus = Refunded`
- Returns `AdminCancelRefundResultDto { Message, BookingStatus, PaymentStatus, RefundedAmount, StripeRefundId, StripeAction }`
- StripeAction values: "Voided" | "Refunded" | "NoPayment" | "AlreadyCancelled"

### Package Edit in Admin/Customer Edit
- When `dto.Packages != null && Count > 0`, replaces all `BookingItem`s
- Calculates new duration → checks `IsSlotAvailableForEditAsync`
- On slot blocked: returns `BadRequest({ message, availableSlots, newDurationMinutes })`
- Frontend reads `data.availableSlots` (NOT `data.altSlots`)

### Auth Endpoints (`AuthController`)
- `POST /Auth/register` — Customer registration
- `POST /Auth/login` — Returns JWT + `UserDto`
- `POST /Auth/create-worker` — Admin only
- `GET /Auth/workers` — Admin: list all workers
- `PUT /Auth/profile` — Update own profile (`UpdateProfileDto`)
  - Phone is **optional** (`string?`) — skip for Admin/Worker accounts
  - Address validation (`preferredAddress`) is **skipped for Admin and Worker** roles
- `POST /Auth/upload-profile-image` — Upload profile pic
- `PUT /Auth/workers/{id}/schedule` — Admin: set worker schedule
- `PUT /Auth/workers/{id}/status` — Admin: activate/deactivate worker

---

## Frontend Architecture (`getitcleaned-frontend`)

### Key Directories
- `src/api/` — Axios API clients (bookings.js, auth.js, packages.js, etc.)
- `src/pages/admin/` — Admin pages (AdminBookings.jsx, AdminPackages.jsx, etc.)
- `src/pages/customer/` — Customer pages (MyBookings.jsx, Booking.jsx, etc.)
- `src/pages/worker/` — Worker pages
- `src/components/layout/` — CustomerNavbar.jsx, AdminHeader.jsx, Footer, etc.
- `src/styles/` — glanz.css (component styles), index.css (CSS vars + theming)
- `src/utils/` — statusConfig.js, currency.js, etc.
- `src/context/` — AuthContext, SettingsContext, LanguageContext

### API Clients (`src/api/`)
- `bookings.js` — `bookingsAPI` object (all booking endpoints)
- `auth.js` — `authAPI` object (login, register, workers, profile)
- `packages.js` — `packagesAPI.getAll()` (public) / `getAllAdmin()` (admin, includes inactive)
- `stripe.js` — Stripe publishable key (hardcoded ⚠️ move to `.env` for prod)
- `axios.js` — base `apiClient` with JWT interceptor

### Dark Mode
- CSS variable `--card-bg` in dark = `rgba(255,255,255,0.05)` (nearly transparent / "glass")
- CSS variable `--surface-bg` in dark = solid `#0d1117`
- Global rule: `[data-theme='dark'] .app-shell :is(.bg-white, .bg-gray-50, .bg-gray-100)` overrides to `rgba(255,255,255,0.05)`
- **Any hardcoded Tailwind `bg-white`, `bg-gray-50`, `bg-gray-100` becomes invisible in dark mode**
- Use `bg-[var(--surface-bg)]` for solid backgrounds, `bg-[var(--card-bg)]` for cards
- Use `bg-[var(--cta-soft-bg)]` for highlighted sections (edit panels, etc.)
- Text: `text-[var(--heading-color)]`, `text-[var(--muted-color)]`, `text-[var(--text-color)]`
- Borders: `border-[var(--border-color)]`

### Admin Bookings Page (`pages/admin/AdminBookings.jsx`)
- Booking detail modal with: edit form, cancel & refund panel, worker assignment dropdown, checklist
- Edit form: date/time, vehicle, address, special instructions, **package selection** (with qty controls)
- Package edit flow: loads `packagesAPI.getAllAdmin()` on first open; slot-blocked warning shows `availableSlots` chips
- Two-step confirmation before saving edits (`editConfirm` state)
- Cancel panel: reason toggle ("Customer request" applies fee / "Our fault" = full refund), override refund input
- Worker assignment: loads `bookingsAPI.getAvailableWorkers(bookingId)` on dropdown focus; no force-assign allowed
- Unassigned bookings section: uses `bg-[var(--surface-bg)]`, `bg-[var(--card-bg)]` — dark mode safe

### Customer Bookings Page (`pages/customer/MyBookings.jsx`)
- Edit modal triggered by "Edit Booking" button on Pending/Confirmed bookings
- Same fields as admin edit (date, time, vehicle, address, packages) but calls `bookingsAPI.customerEdit()`
- Cannot edit InProgress/Completed/Cancelled bookings
- Slot-blocked warning shows alternative slots from `data.availableSlots`
- Two-step confirmation

### Navbar (`components/layout/CustomerNavbar.jsx` + `AdminHeader.jsx`)
- All nav dropdowns use `bg-[var(--surface-bg)]` (NOT `--card-bg`) — prevents transparent dropdown behind photos
- CustomerNavbar: pill-shaped floating nav, theming via CSS vars
- AdminHeader: sidebar + top bar, all colors via CSS vars (dark/light safe)

---

## Mobile Architecture (`Glanz-Mobile`)
- Expo 54, React Navigation, Async Storage
- `src/api/` — Axios instance (same endpoints as web)
- Auth: stores JWT in SecureStore (not AsyncStorage - more secure)
- Main entry: App.js → navigation stack
- Uses `theme.colors.*` CSS vars consistently

---

## Database
- **Dev**: SQLite (`getitcleaned.db`, checked-in)
- **Prod**: PostgreSQL
- **Migrations**: `dotnet ef migrations add NAME && dotnet ef database update`
- **Never mock**: integration tests hit real SQLite

---

## Secrets & Config
- `appsettings.json` — test keys only (dev)
- `appsettings.*.local.json` — personal overrides (.gitignored)
- Prod env vars needed: `JwtSettings:SecretKey`, `Stripe:SecretKey`, `DefaultConnection`
- ⚠️ Stripe publishable key hardcoded in `src/api/stripe.js` → move to `.env.production` for prod
- Default JWT secret in `Program.cs` → override with env var before prod

---

## Known Pitfalls

### Build / Process
- API process (e.g. PID from `ps aux | grep dotnet`) locks `.exe` → build fails with MSB3027/MSB3021
- Fix: `cmd /c "taskkill /F /PID <PID>"` from bash (not `kill -9` which doesn't work for Windows processes)
- `kill -9` in bash shell = bash's `kill` which is not the same as Windows `taskkill`

### Dark Mode
- Never use hardcoded `bg-white`, `bg-gray-50`, `bg-gray-100` in components — use CSS vars
- `--card-bg` in dark = glass / transparent; `--surface-bg` = solid dark
- Navbar dropdowns must use `--surface-bg` or they become invisible behind background images
- `--surface-bg` must NEVER be set to transparent — 30+ components use it for solid surfaces (modals, dropdowns, toasts)
- For page-level transparency, set `body { background: transparent; }` directly, not via `--surface-bg`
- glanz.css has dual light-mode selectors: single-quote `[data-theme='light']` (earlier) and double-quote `[data-theme="light"]` (later). Double-quote rules WIN due to cascade — always update the double-quote block

### Admin Profile
- `UpdateProfileDto.Phone` is `string?` (optional) — admin accounts don't need phone
- Address validation (`preferredAddress`) is skipped for Admin and Worker roles (checked via `user.Role`)
- Previously both were required for all users → blocked admin profile edits

### Booking Edit Package Flow
- Backend error response for blocked slot: `{ message, availableSlots: string[], newDurationMinutes }`
- Frontend must read `data.availableSlots` (not `data.altSlots`)
- `AdminEditBooking` is admin-only (`Forbid()` for non-admin)
- `CustomerEditBooking` blocks editing if status is InProgress, Completed, or Cancelled

### Stripe
- Webhooks not validating payment events (no signature check)
- Test keys in dev (`appsettings.json`); live keys needed for prod
- Void PI: `PaymentIntentService.CancelAsync()` — only works for `PreAuthorized` (requires_capture)
- Refund: `RefundService.CreateAsync()` — only for `Paid` (captured) payments

### SQLite vs PostgreSQL
- Date/time queries behave differently; test on SQLite, be aware of prod differences
- JSON column support differs

### JWT
- No refresh token rotation
- Single token issued at login
- `User.FindFirst(ClaimTypes.NameIdentifier)` → user ID
- `User.FindFirst(ClaimTypes.Role)` → role

---

## Code Rules

### C#
- PascalCase classes/methods, camelCase fields
- `async/await` always, suffix `Async`
- DTOs separate inputs from outputs
- Business logic in Services; controllers thin
- Nullable enabled — use `string?` for optionals
- Check `user.Role.ToLower() == "worker"` / `"admin"` for role comparisons

### React
- PascalCase components, camelCase functions
- Default export pages, named exports for utils
- TailwindCSS only — use CSS vars for theming
- API calls in `src/api/` via Axios
- Hooks for state management
- Relative imports

---

## Deployment Status
⚠️ **NOT PRODUCTION-READY**
- Test Stripe keys only
- No email provider (need SendGrid/SES/Postmark)
- Stripe webhook signature validation missing
- JWT secret in code (override via env var)
- Stripe publishable key hardcoded in frontend

See `DEPLOYMENT_READINESS.md` for full checklist.

---

## Git
- `Glanz-WebApp`: `git pull origin main`
- `Glanz-Mobile`: `git pull origin master`
