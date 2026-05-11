# Low-Cost Deployment Plan

## Target Architecture

- Frontend: static hosting only
- API: one small ASP.NET instance
- Database: smallest safe managed Postgres plan
- Uploads: S3-compatible object storage
- Database media model: store URL only in existing fields
- Review evidence: delete on approval or rejection

## What Was Changed In Code

### Connection-string startup reliability

`Program.cs` now resolves PostgreSQL connection strings with an environment-first strategy and supports `DATABASE_URL` conversion.

Benefits:

- safer low-cost platform deploys (Railway/Fly/Render style `DATABASE_URL`)
- clear startup failures when connection config is missing or placeholder
- lower incident/debug time during first production boot

### Upload storage

The API no longer needs app-instance disk for production uploads.

A new storage abstraction was added in [Glanz-WebApp/Glanz.API/Services/ObjectStorageService.cs](Glanz-WebApp/Glanz.API/Services/ObjectStorageService.cs) with two modes:

- `Local`: development fallback, still writes to `wwwroot/uploads/...`
- `S3`: production mode for Cloudflare R2, Backblaze B2 S3, AWS S3, or similar

These upload flows now use that service:

- Profile images in [Glanz-WebApp/Glanz.API/Controllers/AuthController.cs](Glanz-WebApp/Glanz.API/Controllers/AuthController.cs)
- Booking photos in [Glanz-WebApp/Glanz.API/Controllers/BookingsController.cs](Glanz-WebApp/Glanz.API/Controllers/BookingsController.cs)
- Vehicle images in [Glanz-WebApp/Glanz.API/Controllers/VehiclesController.cs](Glanz-WebApp/Glanz.API/Controllers/VehiclesController.cs)
- Loyalty review screenshots in [Glanz-WebApp/Glanz.API/Controllers/OffersController.cs](Glanz-WebApp/Glanz.API/Controllers/OffersController.cs)

### Loyalty evidence lifecycle

Approved and rejected loyalty screenshots are now deleted immediately and their URL is cleared from the user record.

That change is in [Glanz-WebApp/Glanz.API/Controllers/OffersController.cs](Glanz-WebApp/Glanz.API/Controllers/OffersController.cs).

## Recommended Cheap Hosting Stack

### Frontend

Host [Glanz-WebApp/glanz-frontend](Glanz-WebApp/glanz-frontend) as a static site on one of these:

- Cloudflare Pages
- Netlify
- Vercel

Build settings:

- Build command: `npm run build`
- Publish directory: `dist`

Required env:

- `VITE_API_BASE_URL=https://your-api-domain/api`
- `VITE_STRIPE_PUBLISHABLE_KEY=...`

The frontend already supports this through [Glanz-WebApp/glanz-frontend/src/api/axios.js](Glanz-WebApp/glanz-frontend/src/api/axios.js) and [Glanz-WebApp/glanz-frontend/.env.example](Glanz-WebApp/glanz-frontend/.env.example).

### API

Host [Glanz-WebApp/Glanz.API](Glanz-WebApp/Glanz.API) as a single small instance.

Good low-cost choices:

- Railway small service
- Fly.io single shared-cpu instance
- Render starter instance if pricing works in your region

Current Railway entrypoint already exists in [Glanz-WebApp/Glanz.API/railway.json](Glanz-WebApp/Glanz.API/railway.json).

Recommended starting size:

- 1 shared vCPU
- 512 MB to 1 GB RAM
- 1 instance only

### Postgres

Use the smallest managed plan that still gives:

- automated backups
- connection limits suitable for one API instance
- basic monitoring

Good low-cost choices:

- Neon smallest paid plan
- Railway Postgres smallest paid production-safe plan
- Supabase small Postgres plan if you do not mind their packaging

Start small. Upgrade only after real load.

### Object Storage

Use S3-compatible object storage instead of app disk.

Best low-cost default:

- Cloudflare R2

Other acceptable options:

- Backblaze B2 S3
- AWS S3

Why:

- much cheaper than scaling the API box for storage
- safer than ephemeral instance disk
- simpler for backups and redeploys
- no need to keep uploads in `wwwroot`

## Production Config

Add these settings as environment variables or secret config on the API host.

### API settings

- `ConnectionStrings__DefaultConnection=...`
- `JwtSettings__SecretKey=...`
- `Stripe__SecretKey=...`
- `Cors__AllowedOrigins__0=https://your-frontend-domain`
- `ObjectStorage__Provider=S3`
- `ObjectStorage__BucketName=glanz-uploads`
- `ObjectStorage__Region=auto`
- `ObjectStorage__ServiceUrl=https://<your-s3-endpoint>`
- `ObjectStorage__PublicBaseUrl=https://cdn.your-domain.com` or your public bucket URL
- `ObjectStorage__AccessKey=...`
- `ObjectStorage__SecretKey=...`
- `ObjectStorage__KeyPrefix=uploads`
- `ObjectStorage__UsePathStyle=true`

The default config shape is in [Glanz-WebApp/Glanz.API/appsettings.json](Glanz-WebApp/Glanz.API/appsettings.json).

## Top 5 Hosting-Cost Leaks In This Project

### 1. Uploads on app-instance disk

Current impact:

- forces the API box to also be a file server
- breaks clean horizontal scaling
- makes redeploy/migration riskier
- increases pressure to buy larger server storage

Status:

- fixed in code path through object storage abstraction

### 2. Loyalty screenshots retained after review decision

Current impact:

- unnecessary retained storage
- unnecessary public-file surface
- wasted backup and storage cost over time

Status:

- fixed in code path by deleting on approve/reject

### 3. Original images are stored without resize/compression pipeline

Current impact:

- booking photos can be much larger than needed
- object storage, bandwidth, and CDN cost rise quickly
- mobile upload time increases

Status:

- not fixed yet

Recommended next step:

- resize server-side before upload
- create a webp or jpeg target size for profile, vehicle, and booking photos
- keep a max dimension policy per category

### 4. Frontend can be static but may be hosted with heavier runtime than needed

Current impact:

- paying for a Node/server runtime for a Vite bundle is wasted money
- static hosting is cheaper and often faster

Status:

- code already supports static hosting
- deployment choice should enforce it

### 5. Runtime uploads are still present in local repo/app folders

Current impact:

- bloats local/dev environments
- encourages accidental packaging or persistence coupling
- makes cleanup and deployment artifact hygiene worse

Status:

- old files still exist under [Glanz-WebApp/Glanz.API/wwwroot/uploads](Glanz-WebApp/Glanz.API/wwwroot/uploads)

Recommended next step:

- migrate needed files to object storage
- stop creating new production uploads there
- remove stale files after migration verification

## Concrete Low-Cost Deployment Steps

### 1. Frontend

- Deploy [Glanz-WebApp/glanz-frontend](Glanz-WebApp/glanz-frontend) to Cloudflare Pages
- Set `VITE_API_BASE_URL`
- Set `VITE_STRIPE_PUBLISHABLE_KEY`

### 2. Database

- Create managed Postgres
- Copy connection string into `ConnectionStrings__DefaultConnection`
- Enable automated backups

### 3. Object storage

- Create one bucket named like `glanz-uploads`
- Create public base URL or CDN URL
- Add S3 credentials to API secrets
- Set `ObjectStorage__Provider=S3`

### 4. API

- Deploy [Glanz-WebApp/Glanz.API](Glanz-WebApp/Glanz.API) to Railway or Fly.io
- Set CORS allowed origin to the frontend domain
- Keep a single instance at first

### 5. Migration cleanup

- upload a new profile image and verify it lands in object storage
- upload a vehicle photo and verify URL is external/public
- upload a booking before/after image and verify URL is external/public
- submit a loyalty screenshot and approve/reject it
- verify the object is deleted after decision

## Cheapest Sensible Provider Mix

If cost minimization is the main goal, this is the best default mix:

- Frontend: Cloudflare Pages
- API: Railway small service or Fly.io shared CPU
- Postgres: Neon smallest production-safe plan
- Object storage: Cloudflare R2

## Next Cost Cuts After This

- add image compression before upload
- add CDN in front of object storage if public media traffic grows
- add lifecycle rules for old booking photos if business policy allows
- move long-running non-request work off the API instance if traffic grows

## Operational Note: Translation Coverage

Localization work has expanded across web/mobile admin flows. This has negligible infra cost impact but a meaningful QA impact.

Recommended low-cost practice:

- add a lightweight i18n gap scan in release QA to catch hardcoded literals early and avoid expensive post-release hotfix cycles.
