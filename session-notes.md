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
