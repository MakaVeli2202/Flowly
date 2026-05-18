# New Features to Add - Flowly / Glanz Detailing

Legend:
- BUILT - already implemented
- IN PROGRESS - currently being built
- TO BE DECIDED - needs editor approval before implementation
- APPROVED - approved, queued for implementation
- REJECTED - not needed

---

## PHASE 3 FEATURES (AI + Enterprise)

### P3-1. AI CRM Assistant
**Status: BUILT**
Endpoint: `POST /api/ai/crm-assist` — suggests next actions for a specific customer.

### P3-2. AI Business Insights
**Status: BUILT**
Endpoint: `GET /api/ai/insights` — 30-day performance digest with anomaly detection.

### P3-3. AI Marketing Generator
**Status: BUILT**
Endpoint: `POST /api/ai/marketing` — generates campaign copy (headline + body + social captions) in any language.

### P3-4. AI Upsell Suggestions
**Status: BUILT**
Endpoint: `GET /api/ai/upsell/{bookingId}` — suggests relevant add-ons for a current booking.

### P3-5. Enterprise SSO (Azure AD OIDC)
**Status: BUILT**
Per-org Azure AD login. Endpoints: `GET /api/sso/{orgSlug}/login`, `GET /api/sso/callback`, `POST/GET /api/sso/config`.

### P3-6. Reseller / Agency Console
**Status: BUILT**
Resellers manage child orgs. Endpoints: `GET/PUT /api/reseller/profile`, `GET/POST/DELETE /api/reseller/managed-orgs`.

### P3-7. Webhook System
**Status: BUILT**
Orgs subscribe to events. System fires HTTP POST to their endpoint on booking.created, booking.completed, booking.cancelled.
Signed with HMAC-SHA256. Admin manages subscriptions and sees delivery log. Frontend: /admin/webhooks.

### P3-8. Automation Rules Engine (Executor)
**Status: BUILT**
AutomationRule model already exists (trigger event + action type + delay).
Executor fires via MediatR on domain events.
Supports: SendReviewRequest, SendReminderPush, NotifyWaitlist actions.

### P3-9. Admin AI Panel (Frontend)
**Status: BUILT**
AdminAI.jsx - tabs for Insights / CRM Assist / Marketing / Upsell. Route: /admin/ai.

### P3-10. Admin SSO Config (Frontend)
**Status: BUILT**
AdminSSO.jsx - form to configure Azure AD SSO for the org. Route: /admin/sso.

### P3-11. Admin Reseller Console (Frontend)
**Status: BUILT**
AdminReseller.jsx - manage reseller profile + list/add/remove child orgs. Route: /admin/reseller.

### P3-12. Admin Waitlist Panel (Frontend)
**Status: BUILT**
AdminWaitlist.jsx - view queue per date, trigger notify, see status. Route: /admin/waitlist.

---

## ORIGINAL DETAILING FEATURES

### F-1. Waitlist
**Status: BUILT (backend)**
Customer queues for a date when no slots are available.
Missing: SMS send on notify, frontend UI.
See P3-12 for frontend. SMS wire-up is part of P3-8.

### F-2. Before/After Photo Report
**Status: BUILT**
Technician takes before photos at arrival and after photos on completion.
Customer views photos grouped by type in MyBookings "Photos" modal.
Reduces disputes, marketing material, premium feel.

### F-3. Customer Loyalty Points
**Status: BUILT**
Customer earns points per QAR spent (e.g. 1 QAR = 1 point). Redeem as discount.
Admin sets earn rate and redemption value. Balance shown on customer Profile page.
Increases repeat bookings, reduces churn.

### F-4. Tip / Gratuity at Checkout
**Status: BUILT**
Customer adds a tip for the detailer after job completion (preset % or custom amount).
Tips tracked per worker, shown in payroll summary.
Common in service industry, increases staff satisfaction.

### F-5. Package Add-Ons (Extras at Booking)
**Status: BUILT**
Optional extras selectable at booking (engine clean +50 QAR, odor removal +30 QAR, etc.).
Each add-on has price + optional duration increase. Appear as line items on invoice.
Increases average order value without creating extra packages.

### F-6. Fleet / Corporate Account
**Status: BUILT**
Admin creates corporate accounts with credit limit, discount %, billing contacts.
Add/remove customer members. Consolidated bookings view with year/month filter.
Download consolidated PDF invoice per period (with discount applied).
Route: /admin/corporate-accounts. Backend: CorporateAccounts controller + EF migration.

### F-7. Time-Based / Peak Pricing
**Status: REJECTED**
Admin sets price multipliers per time slot or day (e.g. Friday 10am = 1.2x, Sunday 2pm = 0.9x).
Frontend shows adjusted price dynamically when customer picks a slot.
Fills off-peak slots, maximizes peak revenue.

### F-8. Digital Invoice via WhatsApp/Email
**Status: BUILT**
Manual PDF download available to admin and customer. Auto-send on booking completion wired into FinishJobAsync (fire-and-forget: GenerateAndStoreAsync + SendInvoiceAsync via SmtpEmailService).
Before/after thumbnails and QR code not in PDF template (low priority).

### F-9. Staff Certification Tracker
**Status: BUILT**
Admin logs certifications per technician (IDA, ceramic coat certified, etc.) with expiry dates.
Admin page at /admin/certifications: by-worker view + expiring-soon tab with color-coded badges.
Alert push on expiry is part of automation rules (N-1).

### F-10. Birthday / Anniversary Auto-Offer
**Status: BUILT**
BirthdayOfferJob runs daily. Detects birthday (DateOfBirth) and first-booking anniversary.
Sends push notification with configurable discount %.
Admin configures via /admin/notification-settings (OrgNotificationConfig).

### F-11. Online Payment Link (WhatsApp Invoice)
**Status: BUILT**
Admin generates payment link from booking detail page. Public page at /pay/:token.
Customer reviews job summary and sees total. Admin can copy link to send via WhatsApp.
Captures customers who call or walk in but do not have the app.

### F-12. Vehicle Full Service History
**Status: BUILT**
Admin plate/asset search at /admin/asset-search: search by label, attributes, customer name/phone.
History modal shows all bookings per asset with status, amount, dates.
Backend: GET /api/ClientAssets/admin/search + GET /api/ClientAssets/admin/{id}/history (Admin only).

### F-13. Smart Slot Suggestions
**Status: BUILT**
When preferred slot is unavailable, shows 3 nearest open slots automatically.
Uses existing availability data (no AI needed). Shown inline during booking.
Reduces drop-off when slot is taken, fills calendar faster.

### F-14. Cancellation Auto-Release to Waitlist
**Status: BUILT**
AutomationRuleExecutor already fires on BookingCancelledEvent.
Now sends push first (if customer has ExpoPushToken), falls back to SMS.
First 3 waiting entries for that date are notified and set to "Notified".

### F-15. Review Request Auto-Send
**Status: BUILT**
ReviewRequestPushJob runs every 15 min.
Configurable delay (default 2h), message template.
Push sent after completed booking. Tracks ReviewRequestSentAt per user.
Admin configures via /admin/notification-settings.

---

## NEW IDEAS (Added during Phase 3)

### N-1. Appointment Reminder Escalation
**Status: BUILT**
PushReminderJob runs every 30 min.
Sends 24h reminder push (configurable window), then escalation push close to booking time.
Both windows and message templates configurable via /admin/notification-settings.

### N-2. Multi-Language Invoice PDF
**Status: BUILT**
InvoiceService uses customer's preferred locale (en/ar/de) when generating PDF.
Uses existing locale strings. Customer profile language setting controls invoice language.

### N-3. Worker Rating System
**Status: BUILT**
After each completed booking, customer can rate the assigned worker (1-5 stars) from MyBookings.
Worker average rating shown in admin staff management pages.
Auto-assignment logic not yet updated to prefer higher-rated workers.

### N-4. Booking Notes / Customer Instructions Highlight
**Status: BUILT**
Special instructions field already exists on bookings.
Add a "flagged" label when instructions contain keywords (paint correction, ceramic, pet hair).
Admin and worker see a colored badge on the booking card.

### N-5. Offline Mode for Admin POS
**Status: TO BE DECIDED**
Admin POS can queue a walk-in booking locally if backend is unreachable.
Syncs when connection is restored. Prevents revenue loss during outages.

---

## PHASE 4 FEATURES

### P4-1. GDPR Data Export + Delete Endpoints
**Status: BUILT**
`GET /api/Customer/gdpr-export` - returns all customer data as JSON (bookings, payments, profile).
`POST /api/Customer/gdpr-delete` - anonymizes customer data (soft delete with field nulling).
Required for Austria (DSGVO) market. Legal compliance, not optional.

### P4-2. Cohort Analytics Frontend
**Status: BUILT**
Admin analytics page with CLV (customer lifetime value) chart and retention cohort grid.
Backend data already queryable from existing Bookings + Users tables.
High retention value: owners stay because they can see ROI.

### P4-3. Org Branding UI (White-label)
**Status: BUILT**
Admin page to configure OrganizationBranding: logo, primary color, favicon, custom domain.
OrganizationBranding model already exists in DB. Needs controller + frontend settings page.
Enables resellers to deploy with client's own branding.

### P4-4. Customer Segmentation
**Status: BUILT**
CRM filter to segment customers by: total spend range, booking count, last booking date, tags.
Export filtered segment as CSV. Supports bulk messaging campaigns.
Enables targeted marketing, increases campaign ROI.

### P4-5. Mobile Technician App (React Native)
**Status: SEPARATE PROJECT**
Staff mobile app: today's job list, navigation link, photo upload (before/after), job checklist, clock-in/out.
Expo push tokens already on Staff model. GPS tracking already in SignalR hub.
Critical for field operations, reduces phone calls to dispatch.
NOTE: Requires a new React Native / Expo project. Backend APIs (staff endpoints, SignalR hub, push tokens) are already in place. Frontend app is a separate deliverable.

### P4-6. Marketplace Listing (Flowly.qa)
**Status: BUILT**
Public directory of businesses on the Flowly platform.
GET /api/public/orgs - lists all active orgs with branding.
Frontend: /marketplace (card grid) + /business/:slug (org profile with packages + book button).

### P4-7. Org Branding API Endpoint
**Status: BUILT**
GET /api/public/orgs/{slug}/branding returns CSS vars (colors, logo URL, org name) for white-label.
useTenantBranding() hook auto-applies vars on subdomain load (detects <slug>.flowly.io pattern).

## PREVIOUSLY PLANNED
- Mobile technician app (React Native): see P4-5
- Customer mobile app improvements: included in P4-5
- Marketplace listing (Flowly.qa): see P4-6
- White-label mode for resellers: see P4-3 + P4-7
