# Glanz Project Skill

## Project structure

- 3 clients + 1 backend
- Web: `Glanz-WebApp/glanz-frontend/` (React 19 + Vite + Tailwind)
- Backend: `Glanz-WebApp/Glanz.API/` (ASP.NET Core 10 + EF Core)
- Mobile: `Glanz-Mobile/` (Expo 54, React Native 0.81.5)
- Tests: `Glanz-WebApp/Glanz.API.Tests/` (xUnit)

| Path | Purpose |
|------|---------|
| `Glanz.API/Controllers/` | Thin HTTP layer (28 controllers) |
| `Glanz.API/Services/` | Business logic |
| `Glanz.API/Models/` | EF Core domain entities |
| `Glanz.API/DTOs/` | API contracts |
| `Glanz.API/Helpers/` | Pure utility classes (ShortCodeHelper, etc.) |
| `Glanz.API/Migrations/` | EF Core migration history |
| `Glanz.API/Data/AppDbContext.cs` | EF context + all DbSets |
| `glanz-frontend/src/api/` | Axios clients (auth.js, bookings.js, etc.) |
| `glanz-frontend/src/pages/admin/` | Admin pages |
| `glanz-frontend/src/pages/customer/` | Customer pages |
| `glanz-frontend/src/components/shared/` | Reusable components |
| `glanz-frontend/src/context/` | React context (auth, language, theme) |
| `glanz-frontend/src/locales/` | i18n JSON files (en/ar/de) |
| `Glanz-Mobile/src/screens/` | Mobile screens (46+) |
| `Glanz-Mobile/src/api/` | Mobile Axios instance |
| `Glanz-Mobile/src/locales/` | Mobile i18n files |

## Tech stack

- Frontend web: React 19, React Router v7, Tailwind CSS, Vite, react-i18next
- Mobile: Expo 54, React Native 0.81.5, React Navigation, expo-secure-store
- Backend: ASP.NET Core 10, EF Core, PostgreSQL (prod) / SQLite (dev)
- Auth: JWT HS256, HttpOnly refresh cookie (web), SecureStore (mobile)
- Payments: Stripe (manual capture model)
- Real-time: SignalR hub (backend), HTTP polling 15s (web frontend)
- Push: Expo Push Notifications (mobile)

## Auth patterns

| Concern | Web | Mobile |
|---------|-----|--------|
| Access token | JS heap | `expo-secure-store` |
| Refresh token | HttpOnly cookie | `expo-secure-store` |
| Refresh endpoint | `POST /api/Auth/refresh` (no body, cookie auto-sent) | body: `{ refreshToken }` |

- JWT generation: `Services/TokenService.cs` → `GenerateToken(user)`
- Cookie config: HttpOnly, SameSite=None+Secure (prod), Lax (dev)
- Access token TTL: 30 min (prod), 720 min (dev)
- Role claims: `ClaimTypes.NameIdentifier` = userId, `ClaimTypes.Role` = "Customer"|"Employee"|"Admin"
- Authorization attrs: `[Authorize(Roles = "Admin")]`, `[Authorize(Roles = "Employee")]`

## Staff system

- Model: `Glanz.API/Models/Staff.cs`
- Fields: `ShortCode` (UPPERCASE, 4 chars, unique, nullable), `CompensationType` ("Salary"|"Percentage"), `PercentageRate`, `SkillsJson` (JSON array), `StaffType`, `WorkingDays`, `ShiftStart`, `ShiftEnd`, `SortOrder`
- Short code generation: `Helpers/ShortCodeHelper.cs` - cascade: fn[0:2]+ln[0:2], fn[0:3]+ln[0], fn[0]+ln[0:3], fn[0:2]+ln[1:3], fn[0:4], ln[0:4], then numeric suffixes
- Endpoints: `GET /api/Auth/workers/check-short-code?code=X`, `POST /api/Auth/workers/suggest-shortcode`
- Add staff page: `glanz-frontend/src/pages/admin/AdminAddStaff.jsx`
- Staff list page: `glanz-frontend/src/pages/admin/AdminStaff.jsx`

## i18n rules

- Always add keys to en/ar/de simultaneously
- Web: custom `LanguageContext` in `glanz-frontend/src/context/LanguageContext.jsx`
- Mobile: `react-i18next` init in `Glanz-Mobile/src/i18n/`
- Namespaces (web): files under `glanz-frontend/src/locales/`
- Namespaces (mobile): `bookingFlow`, `adminPackages`, `adminJobs` etc. in `Glanz-Mobile/src/locales/`
- Missing keys render the key string (intentional for QA gap detection)

## Stripe rules

- Secret key: server-side only (`appsettings.json` / env var), never in any client
- Flow: `POST /api/Payments/create-intent` (pre-auth + slot reserve 15min) -> Stripe SDK confirms -> `POST /api/Bookings` (verify PI amount vs backend calc)
- Manual capture: card authorized at booking, captured on webhook `payment_intent.succeeded`
- Void: `PaymentIntentService.CancelAsync()` (PreAuthorized only)
- Refund: `RefundService.CreateAsync()` (Paid only)
- Webhook: `POST /api/Webhooks/stripe` - signature verified via `Stripe:WebhookSecret`
- Publishable key: `VITE_STRIPE_PUBLISHABLE_KEY` env var (web), `EXPO_PUBLIC_STRIPE_KEY` (mobile)

## API conventions

- All business logic in backend - never in client
- Never trust client for: prices, roles, booking status, payment amounts
- Always re-fetch booking status from backend after any action
- Error shape: `{ message: string }`
- Success shape: varies per endpoint; bookings return `{ bookingNumber, bookingId, ... }`
- Route prefix: all routes under `/api/[controller]`

## Database

- Dev: SQLite (`glanz.db` in `Glanz-WebApp/`)
- Prod: PostgreSQL
- Migrations: `cd Glanz-WebApp && dotnet ef migrations add <Name> && dotnet ef database update`
- Never edit generated migration designer files (`*.Designer.cs`)
- Context: `Glanz.API/Data/AppDbContext.cs`
- Seeding: `Glanz.API/Data/DevelopmentDataSeeder.cs`

## Packages & Services ordering

- Both `Package` and `Service` models have `int SortOrder = 0`
- Queries use `OrderBy(SortOrder).ThenBy(Id)`
- Reorder endpoints: `PUT /api/Packages/reorder`, `PUT /api/Services/reorder`
- Body: `[{ id: int, sortOrder: int }]`
- Frontend: up/down arrows in `AdminPackages.jsx`, `AdminServices.jsx` with optimistic swap

## Known edge cases & guards

- **Slot race condition**: `SlotReservation` inserted on `create-intent`, expires in 15 min. First writer wins.
- **Idempotency key**: client-generated UUID on booking creation, checked server-side. Retries return existing booking.
- **Double-mount guard**: `AuthContext.jsx` uses `initCalledRef = useRef(false)` to prevent React Strict Mode double-fire of refresh.
- **Backdrop-filter stacking context**: `glass-card` uses `backdrop-blur-md` which creates a CSS stacking context. Dropdowns inside must use `ReactDOM.createPortal` to escape.
- **Stripe void vs refund**: `CancelAsync()` only works for `PreAuthorized` state. `RefundService` only for `Paid`. Never mix these.
- **Payment mismatch**: backend verifies PI amount via Stripe API before creating booking.
- **Dark mode CSS vars**: Never use `bg-white`, `bg-gray-50`, `bg-gray-100`. Use `bg-[var(--card-bg)]` or `bg-[var(--surface-bg)]`. CSS var opacity modifier (`/90`) doesn't work with Tailwind - use inline style instead.

## Key file locations

| Screen / Feature | Path |
|---|---|
| Booking flow (web) | `glanz-frontend/src/pages/customer/Booking.jsx` + `booking/` subdirectory |
| Booking flow (mobile) | `Glanz-Mobile/src/screens/BookingScreen.js` + `booking/` subdirectory |
| Auth controller | `Glanz.API/Controllers/AuthController.cs` |
| Stripe / payments controller | `Glanz.API/Controllers/PaymentsController.cs` + `WebhooksController.cs` |
| Bookings controller | `Glanz.API/Controllers/BookingsController.cs` |
| Staff management (web) | `glanz-frontend/src/pages/admin/AdminStaff.jsx`, `AdminAddStaff.jsx` |
| Staff management (mobile) | `Glanz-Mobile/src/screens/AdminStaffScreen.js` |
| Short code helper | `Glanz.API/Helpers/ShortCodeHelper.cs` |
| WhatsApp widget | `glanz-frontend/src/components/shared/WhatsAppWidget.jsx` |
| i18n files (web) | `glanz-frontend/src/locales/` |
| i18n files (mobile) | `Glanz-Mobile/src/locales/` |
| Language context (web) | `glanz-frontend/src/context/LanguageContext.jsx` |
| Time slot dropdown | `glanz-frontend/src/components/shared/TimeSlotDropdown.jsx` |
| DB context | `Glanz.API/Data/AppDbContext.cs` |
| Token service | `Glanz.API/Services/TokenService.cs` |
| App entry point | `Glanz.API/Program.cs` |
| Admin dev settings | `glanz-frontend/src/pages/admin/AdminDevSettings.jsx` |
| Admin translations | `glanz-frontend/src/pages/admin/AdminTranslations.jsx` |
