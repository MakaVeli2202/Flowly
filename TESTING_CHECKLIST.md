# Flowly - Full System Testing Checklist

Run through this checklist against a fresh dev environment before any release.
Set `VITE_API_BASE_URL=http://localhost:5289/api` and run both `dotnet run` and `npm run dev`.

---

## 1. Authentication & Registration

- [ ] **Register** - new customer account (email + password)
- [ ] **Email verification OTP** - code arrives (console log in dev), enters correctly, account activates
- [ ] **Login** - JWT returned, stored, used on subsequent requests
- [ ] **Refresh token** - token auto-refreshes before expiry (check 720 min window)
- [ ] **Forgot password** - reset email sends (console log in dev), link works, password updates
- [ ] **Google OAuth** - login with Google redirects and creates/links account
- [ ] **Wrong password** - correct error returned, no 500
- [ ] **Duplicate email** - registration blocked with clear message
- [ ] **Admin login** - admin@flowly.app can log in and sees admin panel
- [ ] **Worker login** - worker account can log in and sees worker view

---

## 2. Booking Flow (Customer)

- [ ] **Browse packages** - packages list loads with prices and tier labels
- [ ] **Vehicle type selection** - price multiplier applied (Motorcycle 0.8x, Sedan 1.0x, SUV 1.25x, Pickup 1.5x)
- [ ] **Date picker** - available slots load for selected date
- [ ] **Slot availability** - booked/reserved slots are excluded
- [ ] **Address selection** - saved addresses appear, new address can be added
- [ ] **Booking confirmation** - booking created, BookingNumber generated
- [ ] **Payment redirect** - Tap Payments charge created, redirects to Tap page (skip in dev - use DevBypass)
- [ ] **Payment verify** - GET /api/Payments/verify/{chargeId} returns correct status
- [ ] **Booking confirmation page** - shows correct details after payment
- [ ] **My Bookings page** - booking appears with status Pending -> Confirmed
- [ ] **Booking detail** - all fields shown (date, time, package, vehicle, address, price)
- [ ] **Cancel request** - cancellation request submitted, admin notified
- [ ] **Reschedule request** - reschedule flow works

---

## 3. Admin - Booking Management

- [ ] **Bookings list** - all bookings visible with filter/search
- [ ] **Booking detail** - all customer/booking info shown
- [ ] **Assign worker** - dropdown shows available workers, save works
- [ ] **Change status** - Pending -> Confirmed -> InProgress -> Completed transitions
- [ ] **Cancel booking** - admin cancel with note
- [ ] **Refund** - refund action available for paid bookings
- [ ] **Auto-assign** - if enabled, system assigns nearest available worker
- [ ] **Booking photo upload** - before/after photos attach to booking

---

## 4. Staff / Worker Management

- [ ] **Add staff** - form creates worker account with short code (uppercase, unique)
- [ ] **Duplicate short code** - blocked with error
- [ ] **Staff list** - shows all workers with role/status
- [ ] **Edit staff** - phone, shift hours, working days update
- [ ] **Worker schedule** - calendar view shows assignments
- [ ] **Worker app** - worker login, sees assigned jobs, can update status
- [ ] **Attendance log** - check-in/out recorded
- [ ] **Driver/Helper role** - VanRole field saves correctly
- [ ] **Certifications** - add/remove certifications for staff
- [ ] **Worker ratings** - customer rating stored and visible
- [ ] **Payroll** - payslip generation with correct hours/amounts
- [ ] **IBAN field** - worker IBAN saves and appears on payslip

---

## 5. Packages & Services

- [ ] **Packages list** - all packages load with correct prices
- [ ] **Create package** - new package with tier/price/duration saves
- [ ] **Edit package** - changes reflect immediately on booking form
- [ ] **Deactivate package** - removed from customer booking options
- [ ] **Services list** - base services visible
- [ ] **Add-ons** - service add-ons attach to packages correctly
- [ ] **Industry templates** - template applies correct package set for an org

---

## 6. Payments (Dev Mode)

- [ ] **Dev bypass** - with DevBypass:AllowDevBypass=true, unauthenticated calls allowed
- [ ] **Create charge** - POST /api/Payments/create-charge returns chargeId + redirectUrl
- [ ] **Verify charge** - GET /api/Payments/verify/{chargeId} returns status
- [ ] **Webhook** - POST /api/Webhooks/tap with valid body updates booking status
- [ ] **QPay** - POST /api/QPay/create-invoice (skips if unconfigured)
- [ ] **Dibsy** - POST /api/Dibsy/create-charge (skips if unconfigured)
- [ ] **SEPA** - POST /api/Sepa/ endpoints (Stripe key needed)
- [ ] **Payment links** - admin can generate shareable payment link

---

## 7. Notifications

- [ ] **In-app notifications** - notification created on booking status change
- [ ] **Unread count** - badge updates in real time
- [ ] **Mark as read** - single and mark-all-read work
- [ ] **Push notification** - test push from Admin -> Notifications -> Send Test
- [ ] **Push token registration** - mobile app registers Expo push token on login
- [ ] **Email notification** - booking confirmation email sends (console log in dev)

---

## 8. Real-time (SignalR)

- [ ] **WebSocket connects** - frontend connects to /hubs/flowly
- [ ] **Admin location broadcast** - worker location update appears on live map
- [ ] **Booking status push** - status change reflects in customer UI without refresh
- [ ] **Connection fallback** - long-polling works if WebSocket blocked

---

## 9. Admin Settings & Configuration

- [ ] **Business settings** - name, logo, email, tagline save and reflect in UI
- [ ] **Working hours** - opening/closing times update slot availability
- [ ] **Cancellation policy** - fee toggle and amount save
- [ ] **Booking constraints** - min advance notice, max days ahead respected
- [ ] **System settings** - vehicle multipliers update booking price calculation
- [ ] **Feature flags** - toggle features on/off, effect is immediate
- [ ] **Translations** - add/edit translation key shows in frontend
- [ ] **Notification config** - per-event push/email on/off saves

---

## 10. CRM & Marketing

- [ ] **CRM contacts** - customer list with search/filter
- [ ] **Contact detail** - booking history, notes, tags visible
- [ ] **Campaigns** - create email/push campaign, send to segment
- [ ] **Cohort analysis** - booking cohorts render chart
- [ ] **Segmentation** - filter by spend, frequency, last booking
- [ ] **Offers** - create offer with discount type and validity
- [ ] **Loyalty program** - reward counter increments after completed bookings
- [ ] **Referral** - referral code generates, discount applies on first booking
- [ ] **Waitlist** - customer joins waitlist, admin views list

---

## 11. Reports & Analytics

- [ ] **Dashboard stats** - total bookings, revenue, active workers load
- [ ] **Financial report** - revenue by period, export CSV
- [ ] **Operational report** - bookings by worker, completion rate
- [ ] **DATEV export** - GET /api/Reports/datev-export?month=YYYY-MM returns file
- [ ] **Analytics page** - charts render with real data

---

## 12. Multi-tenant / Organization

- [ ] **Org registration** - new org created with admin user
- [ ] **Tenant isolation** - org A cannot read org B bookings (run TenantIsolationTests)
- [ ] **Org settings** - timezone, currency, locale save per org
- [ ] **Onboarding flow** - new org admin sees onboarding wizard on first login
- [ ] **Reseller** - reseller can manage child orgs
- [ ] **Platform plans** - plan limits enforced (PlanGuard middleware)

---

## 13. Corporate & B2B

- [ ] **Corporate accounts** - create account with credit limit
- [ ] **Corporate booking** - booking charged to corporate account
- [ ] **Purchase orders** - PO attached to corporate booking
- [ ] **Invoicing** - invoice generated for PO

---

## 14. Subscriptions & Recurring

- [ ] **Subscription plans** - monthly/annual plans list with features
- [ ] **Subscribe** - customer subscribes, discount applies
- [ ] **Recurring bookings** - schedule creation, next occurrence calculates
- [ ] **Subscription booking** - dedicated flow for subscriber customers
- [ ] **Cancel subscription** - cancellation handled, billing stops

---

## 15. AI Features

- [ ] **Chatbot (FAQ mode)** - responds with canned answers when no API key
- [ ] **Chatbot (AI mode)** - responds via Claude when Anthropic:ApiKey set
- [ ] **AI weekly digest** - AIWeeklyDigestJob runs (check logs when triggered)
- [ ] **WhatsApp receptionist** - POST /api/WhatsAppReceptionist returns 200 (stub when unconfigured)
- [ ] **Auto-translation** - new translation key auto-translates to ar/de via MyMemory

---

## 16. GDPR & Compliance

- [ ] **Data export** - customer can request their data export
- [ ] **Data deletion** - admin processes deletion request, user data removed
- [ ] **Audit log** - sensitive actions recorded in AuditEvents table
- [ ] **Cookie consent** - banner appears, preference saved in localStorage

---

## 17. SSO

- [ ] **SSO config** - admin can add SAML/OIDC provider config
- [ ] **SSO login** - redirect to provider, callback creates session
- [ ] **SSO user provisioning** - first login creates user account with correct role

---

## 18. POS

- [ ] **POS screen** - loads with package/product list
- [ ] **POS booking** - creates walk-in booking with cash payment
- [ ] **POS receipt** - receipt printable from POS screen

---

## 19. Inventory & Resources

- [ ] **Products list** - chemical/supply products with stock count
- [ ] **Stock adjustment** - quantity updates correctly
- [ ] **Purchase orders** - PO creation reduces/tracks stock
- [ ] **Resources** - equipment/bay resources visible on schedule
- [ ] **Resource conflict** - booking blocked if resource unavailable

---

## 20. Public Booking Portal

- [ ] **Public URL** - /booking-portal loads without login
- [ ] **Submit booking** - creates booking as guest/new customer
- [ ] **Existing customer** - booking links to existing account by email

---

## 21. Mobile App (Expo)

- [ ] **App starts** - no crash on launch
- [ ] **Login** - token stored, user lands on Home
- [ ] **Booking flow** - end-to-end booking from mobile
- [ ] **My Bookings** - list loads with status
- [ ] **Push notifications** - Expo push token registered, notification received
- [ ] **Chatbot** - chat screen loads, FAQ fallback responds
- [ ] **Referral** - referral code shown, share sheet opens
- [ ] **Profile** - edit name/phone saves
- [ ] **Settings** - theme/language toggle works

---

## 22. Integration Tests (Automated)

```bash
cd Flowly-WebApp/Flowly.API.Tests
dotnet test --logger "console;verbosity=normal"
```

- [ ] **BookingFlowTests** - 45 tests pass
- [ ] **TenantIsolationTests** - multi-org isolation verified
- [ ] **PricingServiceTests** - price multiplier calculations correct
- [ ] **WebhookSignatureTests** - HMAC validation passes/fails correctly
- [ ] **ShortCodeHelperTests** - uppercase uniqueness logic correct
- [ ] **PaginationHelpersTests** - page/offset math correct

---

## 23. Build Verification

```bash
# Backend
cd Flowly-WebApp/Flowly.API
dotnet build   # expect 0 errors

# Frontend
cd Flowly-WebApp/flowly-frontend
npm run build  # expect 0 errors

# Tests
cd Flowly-WebApp/Flowly.API.Tests
dotnet test    # expect 45 passed, 0 failed
```

---

## Pre-Launch Smoke Test (5 min)

Run these in order after deploying to staging:

1. `GET /healthz` - returns 200
2. `POST /api/Auth/register` - create test account
3. `POST /api/Auth/login` - get JWT
4. `GET /api/Packages` - packages load
5. `GET /api/Bookings/available-slots?date=YYYY-MM-DD&durationMinutes=60` - slots return
6. `POST /api/Bookings` - create booking
7. `GET /api/Notifications/unread-count` - returns 0 or more
8. `GET /api/Stats/dashboard` - admin stats load
9. Frontend loads at root URL without JS errors
10. Admin panel loads at /admin
