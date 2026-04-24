# Deployment Readiness Checklist
This file marks the remaining work required before this app should be treated as production-ready.
## TODO Before Deploying
- TODO: Complete all checklist items in this file before any production deployment.
- TODO: Environment secrets/keys may remain in development config for now; move them to secure environment variables/secrets manager and rotate them before deployment.
## Status
Current state:
- Core booking, worker, loyalty, and notification flows are implemented.
- Address autocomplete is now wired into customer address entry on web and mobile.
- Google Reviews carousel is displayed on home page with auto-scrolling.
- Several areas still use development placeholders, test credentials, or self-asserted flows.
Do not treat the current app as production-ready until the items below are completed.
## 1. Payments
Files:
- `GetItCleaned.API/appsettings.json`
- `getitcleaned-frontend/src/api/stripe.js`
- `GetItCleaned.API/Controllers/BookingsController.cs`
Current state:
- Stripe configuration in `GetItCleaned.API/appsettings.json` uses test keys.
- The web frontend still has a hardcoded Stripe publishable key in `getitcleaned-frontend/src/api/stripe.js`.
- Payment configuration is not fully externalized into production environment variables.
Production action:
- Move all Stripe keys to environment variables or a secure secrets provider.
- Replace test keys with live keys only in production environments.
- Remove the hardcoded frontend publishable key and load it from environment-specific config.
- Verify payment intent lifecycle, success/failure handling, and webhook coverage.
- Add production logging for failed payment confirmation and reconciliation paths.
## 2. Email Delivery
Files:
- `getitcleaned-frontend/src/pages/customer/BookingConfirmation.jsx`
- `GetItCleaned.API/Controllers/BookingsController.cs`
- `GetItCleaned.API/Services/`
Current state:
- The app does not yet have a real transactional email provider wired for booking confirmations, reminders, or account flows.
- Customer-facing copy previously implied email delivery existed; one visible claim was softened, but a full audit is still required.
Production action:
- Add a real email provider such as SendGrid, Postmark, Resend, or SES.
- Implement booking confirmation email delivery.
- Implement reminder email delivery.
- Audit all user-facing copy so the UI only promises messages that are actually sent.
- Add retry/error logging for email failures.
## 3. SMS Verification And OTP
Files:
- `GetItCleaned.API/Controllers/AuthController.cs`
- `GetItCleaned.API/Models/User.cs`
- `getitcleaned-frontend/src/pages/customer/Register.jsx`
- `GetItCleaned-Mobile/src/screens/RegisterScreen.js`
Current state:
- Registration accepts phone numbers, but there is no real SMS verification or OTP challenge.
- Phone ownership is not verified.
Production action:
- Add an SMS provider such as Twilio, MessageBird, or a local provider.
- Add OTP generation, expiry, resend throttling, and verification status storage.
- Require verified phone numbers before sensitive account actions if that is part of the business rules.
- Add abuse protection and rate limits.
## 4. Google Review Display & Sync
Files:
- `getitcleaned-frontend/src/pages/Home.jsx`
- `GetItCleaned.API/Controllers/ReviewsController.cs` (NEW - needs to be created)
- `GetItCleaned.API/Models/Review.cs` (NEW - needs to be created)
- `GetItCleaned.API/Services/GoogleReviewsSyncService.cs` (NEW - needs to be created)
- `GetItCleaned.API/Data/AppDbContext.cs`
Current state:
- Google Reviews carousel is displayed on home page with **hardcoded review data**.
- Reviews are static and do not update automatically.
- No database persistence for reviews.
- No integration with Google My Business API or similar review source.
- Avatar images may fail to load; fallback to initials is implemented.
Production action:
- **Option A (Recommended):** Create a reviews database table and management API
  - Create `Review` model with fields: `id`, `author`, `rating`, `text`, `date`, `avatarUrl`, `source` (Google), `verified`
  - Create `/api/reviews/public` endpoint to fetch active reviews
  - Implement admin endpoint `/api/reviews/manage` to manually add/edit/delete reviews
  - Add admin UI page to manage displayed reviews (enable/disable, reorder, etc.)
  - Update `Home.jsx` to fetch reviews from API instead of hardcoded data
  - Create migration to add `Reviews` table to database
  
- **Option B (Advanced):** Auto-sync from Google My Business API
  - Obtain Google My Business API credentials and OAuth token
  - Create `GoogleReviewsSyncService` to periodically fetch reviews from Google
  - Implement background job (e.g., daily sync) to update reviews table
  - Add error handling for API rate limits and authentication failures
  - Store sync timestamps and last successful sync date
  - Implement manual trigger for on-demand sync in admin panel
  
- **Option C (Hybrid):** Use TrustIndex or similar service
  - Subscribe to TrustIndex API or embed widget
  - Use their API to fetch reviews (if not using embedded widget)
  - Still store reviews in database for caching and admin control
  - Fall back to cached reviews if API is unavailable

- General requirements for all options:
  - Implement avatar image error handling with fallback (✓ already done)
  - Validate review data before display (author, rating 1-5, text length)
  - Cache reviews appropriately to reduce API calls
  - Add moderation status (approved/pending/rejected) for manual reviews
  - Consider pagination if review count exceeds visible carousel
  - Monitor review carousel performance on home page load

## 5. Google Review Unlock Flow (Loyalty)
Files:
- `GetItCleaned.API/Controllers/OffersController.cs`
- `GetItCleaned.API/Controllers/BookingsController.cs`
- `GetItCleaned.API/Models/User.cs`
- `getitcleaned-frontend/src/pages/customer/MyBookings.jsx`
- `GetItCleaned-Mobile/src/screens/MyBookingsScreen.js`
Current state:
- Loyalty counting starts only after the user triggers the one-time Google review activation flow.
- The current activation is self-asserted by the user pressing the activation action.
- The system does not actually verify that a Google review was posted.
Production action:
- Decide whether self-assertion is acceptable for the business.
- If not acceptable, replace it with one of these:
  - manual review by staff,
  - proof upload workflow (user provides screenshot),
  - coupon issued by staff after review validation,
  - a different referral/review mechanism that is technically verifiable.
- Remove or document any legacy per-coupon activation code that is no longer part of the final design.
## 6. Address Autocomplete Provider
Files:
- `GetItCleaned.API/appsettings.json`
- `GetItCleaned.API/Controllers/AddressesController.cs`
- `getitcleaned-frontend/src/components/shared/AddressAutocompleteInput.jsx`
- `GetItCleaned-Mobile/src/components/AddressAutocompleteInput.js`
- `getitcleaned-frontend/src/pages/customer/Booking.jsx`
- `getitcleaned-frontend/src/pages/customer/Register.jsx`
- `getitcleaned-frontend/src/pages/customer/Profile.jsx`
- `GetItCleaned-Mobile/src/screens/BookingScreen.js`
- `GetItCleaned-Mobile/src/screens/RegisterScreen.js`
- `GetItCleaned-Mobile/src/screens/ProfileScreen.js`
Current state:
- Address autocomplete is implemented and used in customer address entry flows.
- The backend currently uses Nominatim/OpenStreetMap settings from `appsettings.json`.
- This is acceptable for development and validation work, but it should not be assumed to be the final production provider.
Production action:
- Choose a production-grade address provider appropriate for your region and traffic volume.
- Common options include Google Places, Mapbox, HERE, or Loqate.
- Confirm terms of service, rate limits, billing, and commercial usage rules.
- Persist structured address metadata if routing, coverage validation, or geofencing will matter later.
- Consider storing latitude/longitude in the booking or address model after selection.
## 7. Secrets And Environment Configuration
Files:
- `GetItCleaned.API/appsettings.json`
- `GetItCleaned.API/appsettings.Development.json`
- `GetItCleaned.API/Program.cs`
- `getitcleaned-frontend/package.json`
- deployment environment config
Current state:
- Sensitive and environment-specific values are still too close to source-controlled config.
- The app is not yet clearly split into development, staging, and production configuration.
Production action:
- Move secrets to environment variables or a managed secret store.
- Set separate config for development, staging, and production.
- Review JWT signing secret handling and token lifetime policy.
- Review CORS, allowed origins, HTTPS enforcement, and forwarded headers.
- Confirm logging levels and exception detail are safe for production.
## 8. Default Admin / Seeder Safety
Files:
- `GetItCleaned.API/Data/DevelopmentDataSeeder.cs`
- `GetItCleaned.API/appsettings.json`
- `GetItCleaned.API/Program.cs`
Current state:
- Development seeding and default credentials are useful for local work but risky for deployment.
Production action:
- Disable development seeding in production.
- Remove or rotate any default admin credentials.
- Ensure startup schema patching is acceptable for the production database strategy.
- Replace ad hoc startup schema changes with formal migrations if required by your deployment process.
## 9. Database Strategy
Files:
- `GetItCleaned.API/Data/AppDbContext.cs`
- `GetItCleaned.API/Migrations/`
- `GetItCleaned.API/Program.cs`
- production database infrastructure
Current state:
- The project uses SQLite and includes runtime schema patching for fields added during feature iteration.
Production action:
- Decide whether SQLite remains acceptable in production.
- If not, move to a managed relational database such as PostgreSQL or SQL Server.
- Formalize migrations and deployment ordering.
- Add backup, restore, and retention procedures.
## 10. Notification Delivery Reality
Files:
- `GetItCleaned.API/Services/AdminNotificationService.cs`
- `GetItCleaned.API/Controllers/NotificationsController.cs`
- web/mobile notification screens
Current state:
- In-app notifications exist.
- External delivery channels such as push, email, or SMS reminders are not fully implemented.
Production action:
- Decide which notifications must be in-app only and which require delivery outside the app.
- Add push notifications for mobile if worker/customer reliability depends on them.
- Add reminder scheduling and background delivery for time-sensitive events.
## 11. File-By-File Follow-Up Targets
Use this list when continuing production hardening:
- `GetItCleaned.API/appsettings.json`: remove test Stripe keys, review address provider config, remove production-sensitive defaults.
- `GetItCleaned.API/Program.cs`: review startup schema patching, production middleware, CORS, and HTTPS handling.
- `GetItCleaned.API/Controllers/AuthController.cs`: add OTP or phone verification flow.
- `GetItCleaned.API/Controllers/ReviewsController.cs` (NEW): implement public and admin reviews endpoints.
- `GetItCleaned.API/Controllers/OffersController.cs`: finalize the loyalty unlock design and remove obsolete activation paths.
- `GetItCleaned.API/Controllers/AddressesController.cs`: replace Nominatim if needed and add provider-specific safeguards.
- `GetItCleaned.API/Services/GoogleReviewsSyncService.cs` (NEW): implement review sync from Google My Business if using Option B.
- `GetItCleaned.API/Services/`: add real email and reminder services.
- `getitcleaned-frontend/src/api/stripe.js`: remove hardcoded publishable key.
- `getitcleaned-frontend/src/pages/Home.jsx`: update to fetch reviews from API instead of hardcoded data.
- `getitcleaned-frontend/src/pages/customer/BookingConfirmation.jsx`: finish auditing customer-facing delivery promises.
- `getitcleaned-frontend/src/pages/customer/Register.jsx`: verify post-deployment registration rules once SMS/email verification is added.
- `getitcleaned-frontend/src/pages/customer/Profile.jsx`: decide whether saved addresses should store coordinates and validation metadata.
- `getitcleaned-frontend/src/pages/admin/ReviewsManagement.jsx` (NEW): create admin UI for managing displayed reviews.
- `GetItCleaned-Mobile/src/screens/RegisterScreen.js`: align with final verification flow.
- `GetItCleaned-Mobile/src/screens/ProfileScreen.js`: align with final address persistence model.
- `GetItCleaned-Mobile/src/screens/MyBookingsScreen.js`: align with final review verification rules if self-assertion changes.
## Recommended Order
1. Externalize secrets and live/test environment separation.
2. Finalize payment production configuration and webhook handling.
3. Add real email and SMS verification/delivery.
4. **Implement Google Reviews API integration (Option A or B)** ← NEW PRIORITY
5. Decide the final Google review verification policy for loyalty program.
6. Upgrade the address provider and persistence model.
7. Lock down seeding, credentials, database, and deployment middleware.