# Glanz Project - Full Technical Specification for Cost Estimation

**Date:** April 2026  
**Business:** Car Detailing Marketplace - Qatar (UTC+3, Arab Standard Time)  
**Stack:** ASP.NET Core 10 (API) + React 19 + Vite (Frontend) + PostgreSQL

---

## 1. Project Scale Overview

| Metric | Value |
|--------|-------|
| **Total Files** | ~62,000 (including node_modules) |
| **API C# Files** | 102 files |
| **Frontend JS/JSX Files** | ~19,500 (including node_modules) |
| **Frontend Build Output** | 13.43 MB (static assets) |
| **API Migrations** | 16 migrations |
| **Database Tables** | 22 tables |
| **API Endpoints** | ~322 endpoints |
| **Media Assets** | ~332 files (videos, images in public/) |

---

## 2. Tech Stack Details

### Backend (Glanz.API)
- **Framework:** ASP.NET Core 10
- **ORM:** Entity Framework Core (Npgsql provider for PostgreSQL)
- **Auth:** JWT Bearer tokens (60min access, 30-day refresh tokens in HttpOnly cookies)
- **Roles:** Admin, Customer, Employee (was "Worker")
- **Real-time:** HTTP polling (SignalR removed for cost reasons)
- **File Uploads:** Object-storage abstraction (`S3` provider for production, `Local` fallback for development)
- **Startup config hardening:** connection string resolution supports both `ConnectionStrings__DefaultConnection` and `DATABASE_URL`

### Frontend (glanz-frontend)
- **Framework:** React 19 with Vite 8.0.8
- **Routing:** React Router DOM
- **State:** Context API (Auth, Packages, Settings, Features, Language)
- **Styling:** Tailwind CSS + CSS variables for theming (dark/light mode)
- **Build Output:** ~614KB JS (gzipped: ~177KB) + 13MB static assets (videos, images)

### Database (PostgreSQL)
- **Provider:** Npgsql (EF Core)
- **Migrations:** 16 applied (InitialSchema + AddRefreshTokens + feature migrations)
- **Connection:** Configured for PostgreSQL (dev: localhost:5432, prod: managed instance)

---

## 3. Database Schema (22 Tables)

| Table | Purpose | Est. Row Growth |
|-------|---------|-------------------|
| **Users** | Customers + Employees + Admins | 500-5,000 |
| **Staff** | Employee details (schedule, shift) | 10-50 |
| **Bookings** | Main booking records | 1,000-10,000/year |
| **BookingItems** | Packages in each booking | 2x bookings |
| **BookingPhotos** | Worker-uploaded job photos | 2-3 per booking |
| **BookingChecklistItems** | Checklist per booking | ~5 per booking |
| **Packages** | Service packages | ~10-20 (static) |
| **Services** | Individual services | ~20-30 (static) |
| **ServiceProducts** | Products used per service | ~50 (static) |
| **Products** | Inventory items | ~100-200 |
| **Offers** | Promo codes + loyalty programs | ~20-50 |
| **UserOffers** | Issued coupons to users | 2x bookings |
| **Notifications** | Admin/user notifications | 5x bookings |
| **SystemSettings** | Config key-value store | ~20-50 (static) |
| **ServiceSubscriptions** | Recurring service plans | 100-1,000 |
| **SubscriptionPlans** | Plan definitions | ~5-10 (static) |
| **SubscriptionPlanFeatures** | Plan features | ~20 (static) |
| **SubscriptionPlanBenefits** | Plan benefits | ~15 (static) |
| **UserSubscriptions** | User's active subscriptions | 100-1,000 |
| **SubscriptionBookings** | Recurring booking records | 500-5,000/year |
| **SubscriptionPlanPackages** | Packages in plans | ~20 (static) |
| **Vehicles** | User vehicle profiles | 1-2 per customer |
| **SlotReservations** | Time slot locks | 1 per booking |
| **WorkerLocations** | Live worker GPS tracking | High write (every 30s) |
| **JobApplications** | Job applicants | ~50-200 |
| **JobPositions** | Open positions | ~5-10 (static) |
| **AuditLogs** | Admin action logs | High volume (every action) |
| **Availabilities** | Worker availability calendar | ~365/year |

---

## 4. API Endpoints (~322 Total)

### Auth Controller
- `POST /api/auth/register` - Customer registration
- `POST /api/auth/login` - Login (blocks Employee role)
- `POST /api/auth/logout` - Logout
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `POST /api/auth/upload-profile-image` - Upload profile pic
- `GET /api/auth/workers` - List workers (admin)
- `POST /api/auth/create-worker` - Create worker (admin)
- `PUT /api/auth/workers/{id}/schedule` - Update worker schedule (admin)
- `PUT /api/auth/workers/{id}/status` - Activate/deactivate worker (admin)

### Bookings Controller (~15 endpoints)
- `POST /api/bookings` - Create booking
- `GET /api/bookings` - My bookings (customer)
- `GET /api/bookings/all` - All bookings (admin)
- `GET /api/bookings/worker` - Worker's bookings
- `PUT /api/bookings/{id}/status` - Update status (admin)
- `PUT /api/bookings/{id}/payment-status` - Update payment status (admin)
- `POST /api/bookings/assign-worker` - Assign worker (admin)
- `GET /api/bookings/{id}/available-workers` - Get available workers
- `PUT /api/bookings/{id}/admin-edit` - Full edit (admin)
- `PUT /api/bookings/{id}/customer-edit` - Customer edit
- `POST /api/bookings/{id}/admin-cancel-refund` - Cancel + refund (admin)
- `GET /api/bookings/{id}/cancellation-fee` - Get fee preview
- `GET /api/bookings/available-slots` - Get available time slots
- `GET /api/bookings/availability-calendar` - Month calendar
- `POST /api/bookings/{id}/arrived` - Mark arrived (worker)
- `POST /api/bookings/{id}/start` - Start job (worker)
- `POST /api/bookings/{id}/finish` - Finish job (worker)
- `POST /api/bookings/{id}/running-late` - Running late (worker)
- `POST /api/bookings/{id}/request-cancellation` - Request cancel (customer)
- `POST /api/bookings/{id}/request-reschedule` - Request reschedule (customer)
- `GET/PUT /api/bookings/assignment-mode` - Auto/manual assign toggle (admin)
- `POST /api/bookings/worker-absence` - Mark absent + reassign (admin)
- `POST /api/bookings/create-payment-intent` - Stripe PI creation
- `POST /api/bookings/{id}/upload-photo` - Upload job photo (worker)
- `GET /api/bookings/worker-location/{id}` - Get worker GPS (admin)

### Offers Controller (~10 endpoints)
- `GET /api/offers` - Get all offers (admin)
- `POST /api/offers` - Create offer
- `PUT /api/offers/{id}` - Update offer
- `DELETE /api/offers/{id}` - Delete offer
- `GET /api/offers/my-coupons` - My coupons (customer)
- `GET /api/offers/my-loyalty` - Loyalty card state (customer)
- `POST /api/offers/loyalty/activate-google-review` - Submit review + screenshot (customer)
- `GET /api/offers/loyalty/pending-reviews` - Pending reviews (admin)
- `POST /api/offers/loyalty/{userId}/approve-review` - Approve (admin)
- `POST /api/offers/loyalty/{userId}/reject-review` - Reject (admin)
- `GET /api/offers/loyalty-progress` - Per-program progress (customer)
- `GET /api/offers/user-coupons` - All issued coupons (admin)
- `POST /api/offers/{id}/assign/{userId}` - Assign to user
- `POST /api/offers/{id}/assign-bulk` - Bulk assign

### Other Controllers
- **Packages Controller** (~5 endpoints) - CRUD for packages
- **Services Controller** (~5 endpoints) - CRUD for services + products
- **Subscriptions Controller** (~10 endpoints) - Plans, features, benefits, user subscriptions
- **Vehicles Controller** (~5 endpoints) - Vehicle CRUD + image upload
- **Notifications Controller** (~5 endpoints) - Get, mark read, mark all read
- **Admin Controller** (~3 endpoints) - Dashboard stats, payroll, etc.
- **Settings Controller** (~3 endpoints) - System settings CRUD
- **JobApplications Controller** (~5 endpoints) - Apply, review, manage positions
- **Payments Controller** (~3 endpoints) - Stripe webhooks, payment intent
- **Addresses Controller** (~3 endpoints) - Nominatim autocomplete proxy

---

## 5. File Upload Storage Needs

Production assumption: media should be stored in S3-compatible object storage, not app-instance disk.

| Type | Location | Est. Size/File | Est. Count | Total Storage |
|------|----------|------------------|-------------|---------------|
| **Profile Images** | `wwwroot/uploads/profiles/` | ~200KB | 500-5,000 | ~100MB-1GB |
| **Vehicle Images** | `wwwroot/uploads/vehicles/` | ~300KB | 500-2,000 | ~150MB-600MB |
| **Booking Photos** | `wwwroot/uploads/booking-photos/` | ~500KB | 2,000-20,000 | ~1GB-10GB |
| **Loyalty Screenshots** | `wwwroot/uploads/loyalty-reviews/` | ~400KB | 100-1,000 | ~40MB-400MB |
| **Total** | | | | **~1.3GB-12GB** |

---

## 6. Frontend Build Output Analysis

```
dist/index.html                                        7.56 kB
dist/assets/index-DdX7s2t3.js                      614.28 kB (gzipped: 176.79 kB)
dist/assets/AdminDashboard-BTHZqUAF.js             404.25 kB (gzipped: 115.99 kB)
dist/assets/reportPDF-BXRLM24U.js                457.59 kB
dist/assets/LiveMapTracking-CcXJxNtP.js          14.80 kB
dist/assets/index-Bckq7dzB.css                      82.89 kB
dist/assets/hero-detailing-PFC0vpIa.mp4           2,298.11 kB
dist/assets/RainOnGlass-BxuYoahN.mp4            8,713.28 kB
Total static assets: ~13.43 MB
```

**Notes:**
- 2 large background videos (~11MB total) - can be optimized/compressed
- Largest JS chunk: 614KB (176KB gzipped) - consider code-splitting
- PDF report generation bundled (~457KB)
- Live map tracking (~15KB)

---

## 7. Third-Party Integrations

| Service | Purpose | Cost Model | Status |
|---------|---------|-------------|--------|
| **Stripe** | Payment processing | 2.9% + QAR 1.20 per transaction | Test keys (prod not configured) |
| **Nominatim/OpenStreetMap** | Address autocomplete | Free (rate-limited) | In use (dev) |
| **Google Places** | Address autocomplete (prod) | Pay-per-request (~$5-15/1000 req) | Recommended upgrade |
| **SendGrid/Postmark/SES** | Transactional email | ~$15-30/month for 10k emails | Not configured |
| **Twilio** | SMS verification | ~$0.0075-0.04 per SMS | Not configured |
| **Google My Business API** | Sync Google reviews | ~$0-500/month (Business tier) | Hardcoded carousel (dev) |

---

## 8. Authentication & Security

### JWT Configuration
- **Access Token:** 60 minutes (was 1440)
- **Refresh Token:** 30 days, stored in HttpOnly cookie
- **Secret Key:** Min 64 chars (env var override for prod)
- **Rotation:** Refresh token rotates on each use

### Role-Based Access
- **Admin:** Full access to all endpoints
- **Customer:** Bookings, profile, loyalty, subscriptions
- **Employee:** Mobile app only (blocked from web login since April 2026)

### Security Features
- CORS configured (allowed origins in env vars)
- Rate limiting configured (production tier in Program.cs)
- HTTPS redirect enforced
- HttpOnly cookies for refresh tokens
- Stripe webhook signature verification (when configured)

---

## 9. Real-Time Features

### Notification System
- **Transport:** HTTP polling (SignalR removed for cost savings)
- **Frequency:** Every 30-60 seconds
- **WebSocket fallback:** Custom notificationBus with polling
- **Push Notifications:** Expo push tokens for mobile app

### Live Map Tracking (Admin)
- **Endpoint:** `GET /api/bookings/worker-location/{id}`
- **Mobile App:** Posts GPS every 30 seconds to `WorkerLocations` table
- **Frontend:** Polls every 10-15 seconds when viewing live map

---

## 10. Business Logic Highlights

### Booking Flow
1. Customer selects package(s) + vehicle type
2. Calendar shows availability (color-coded: green/yellow/red)
3. Time slot selection (dynamic based on duration)
4. Address autocomplete (Nominatim)
5. Stripe payment intent (if payments enabled)
6. Booking confirmation + notification to admin

### Loyalty Program (Stamp Card)
- **Trigger:** Every N completed paid bookings (default: 3)
- **Reward:** Free wash coupon
- **Gate:** One-time Google review + screenshot verification
- **Screenshot Upload:** New feature (April 2026) - users upload proof
- **Admin Approval:** Pending reviews in AdminOffers.jsx with screenshot preview

### Subscription System
- **Plans:** Recurring services (weekly, bi-weekly, monthly)
- **Features:** Package selection, vehicle type multiplier
- **Booking Generation:** Auto-create bookings from subscriptions

---

## 11. Environment Configuration

### Development
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=glanz_db;Username=postgres;Password=dev_password"
  },
  "JwtSettings": {
    "SecretKey": "dev_only_key",
    "Issuer": "Glanz",
    "Audience": "GlanzUsers"
  },
  "Stripe": {
    "SecretKey": "sk_test_...",
    "PublishableKey": "pk_test_...",
    "WebhookSecret": ""
  },
  "BusinessSettings": {
    "TimeZone": "Arab Standard Time",
    "DayStart": "09:00",
    "DayEnd": "18:00"
  },
  "AddressAutocomplete": {
    "Provider": "Nominatim",
    "BaseUrl": "https://nominatim.openstreetmap.org"
  }
}
```

### Production (Environment Variables Needed)
```
ConnectionStrings__DefaultConnection=Host=prod-host;Database=glanz;Username=...;Password=...
JwtSettings__SecretKey=<64+ char random string>
Stripe__SecretKey=sk_live_...
Stripe__WebhookSecret=whsec_...
BusinessSettings__TimeZone=Arab Standard Time
CORS__AllowedOrigins__0=https://yourdomain.com
```

---

## 12. Hosting Requirements Summary

### Compute
- **API:** 1 vCPU, 1.75-2GB RAM (handles ~500 concurrent users)
- **Frontend:** Static file serving (minimal compute)

### Database
- **PostgreSQL:** 2 vCPU, 4GB RAM, 20-50GB storage (grows ~1-2GB/year)
- **Backup:** Point-in-time recovery recommended

### Storage
- **File Uploads:** 5-20GB (images, screenshots, videos)
- **Static Assets:** ~13.5MB initial bundle (including current large background videos)

### Bandwidth
- **Est. Monthly Transfer:** 100-500GB (depends on video hosting)
- **Optimization:** Compress videos, use CDN for static assets

### Timezone
- **Business Location:** Qatar (UTC+3, Arab Standard Time, no DST)
- **Server Timezone:** Must match business timezone for correct slot calculations

---

## 13. Cost Estimation Inputs Summary

| Category | Details for Estimation |
|----------|---------------------------|
| **Users** | 500-5,000 customers, 10-50 employees |
| **Bookings/Month** | 200-2,000 bookings |
| **API Requests/Month** | ~50,000-500,000 (including polling) |
| **Storage** | 5-20GB (uploads, object storage) + ~13.5MB (static assets) |
| **Bandwidth** | 100-500GB/month |
| **Database** | 2 vCPU, 4GB RAM, 20-50GB storage |
| **Compute** | 1-2 vCPU, 2-4GB RAM (API) |
| **Third-Party** | Stripe (2.9% + QAR 1.20), Nominatim (free), Email (~$20/mo) |
| **Region** | Middle East (Bahrain, UAE, or Qatar for low latency) |
| **Videos** | 2 files totaling ~11MB (can be compressed to ~3-4MB) |

---

## 14. Recommended Hosting Architecture

### Budget Option (~$30-50/month)
- **Frontend:** Vercel/Netlify (free/cheap) or Azure Static Web Apps (free)
- **API:** Railway/Render ($25-35/month for 1 vCPU, 2GB RAM)
- **Database:** Railway/Render PostgreSQL ($15-25/month) or Supabase ($25/month Pro)
- **Storage:** Same provider or AWS S3 ($1-3/month)

### Production Option (~$60-100/month)
- **Frontend:** Azure Static Web Apps (free) + CDN
- **API:** Azure App Service B1 ($13/month) + S1 for scale ($55/month)
- **Database:** Azure Database for PostgreSQL Burstable B1ms ($25/month) + GP tier ($75/month)
- **Storage:** Azure Blob Storage ($1-3/month for 20GB + ops)
- **Domain + SSL:** Azure App Service ($12/year) or external registrar

### Enterprise Option (~$120-200/month)
- **Frontend:** CloudFront + S3 ($10-20/month)
- **API:** EC2 t3.medium ($30-40/month) + ALB ($16/month)
- **Database:** RDS PostgreSQL db.t3.medium ($60-80/month)
- **Storage:** S3 + CloudFront ($10-20/month)
- **Monitoring:** CloudWatch ($5-10/month)

---

**Last Updated:** April 29, 2026  
**Next Steps:** Share this document with Azure/AWS cost calculator AI for precise monthly estimates.
