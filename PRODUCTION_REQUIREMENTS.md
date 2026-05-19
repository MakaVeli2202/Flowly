# Flowly - Production Requirements

Everything you need to configure before the system works with real users and real money.
None of these require code changes. They are all environment variables or config values.

---

## How to Set Config

Set these as environment variables in Render / Railway / your host.
Variable name format: use `__` to separate nested keys.
Example: `JwtSettings:SecretKey` becomes `JwtSettings__SecretKey`.

For local dev, put them in `appsettings.Development.json` (never commit real secrets).

---

## 1. REQUIRED - App Will Not Work Without These

### JWT (Authentication)
| Key | Value | Notes |
|-----|-------|-------|
| `JwtSettings__SecretKey` | Any random string, 32+ characters | Generate with: `openssl rand -base64 32` |
| `JwtSettings__Issuer` | `Flowly.API` | Already set in appsettings.json |
| `JwtSettings__Audience` | `Flowly.Client` | Already set in appsettings.json |

If this is not set the app starts but no login will work.

### Database
| Key | Value |
|-----|-------|
| `ConnectionStrings__DefaultConnection` | PostgreSQL connection string |

Format: `Host=your-host;Port=5432;Database=flowly_db;Username=your-user;Password=your-pass;SSL Mode=Require`

Free PostgreSQL: Neon.tech (free tier, 512MB), Supabase (free tier, 500MB), Railway (free tier).

### Admin Account
| Key | Value |
|-----|-------|
| `AdminUser__Email` | Your admin email |
| `AdminUser__Password` | Strong password (min 8 chars) |

Set before first run. The seeder creates this account on startup if it does not exist.

---

## 2. PAYMENTS - Required to Process Real Transactions

### Tap Payments (Primary - Qatar/GCC)
| Key | Where to get |
|-----|-------------|
| `TapPayments__SecretKey` | Tap dashboard -> Developers -> API Keys -> Secret Key |
| `TapPayments__PublishableKey` | Tap dashboard -> Developers -> API Keys -> Public Key |
| `TapPayments__WebhookSecret` | Tap dashboard -> Developers -> Webhooks -> Signing Key |

Without webhook secret, forged webhook events can mark unpaid bookings as paid. Set it.

Tap dashboard: https://dashboard.tap.company

### QPay (Qatar)
| Key | Where to get |
|-----|-------------|
| `QPay__Username` | QPay merchant portal |
| `QPay__Password` | QPay merchant portal |
| `QPay__InvoiceCode` | QPay merchant portal - your invoice code |

QPay portal: https://portal.qpay.mn (or contact QPay Qatar directly)

### Dibsy (GCC)
| Key | Where to get |
|-----|-------------|
| `Dibsy__ApiKey` | Dibsy dashboard -> API Keys |

### Stripe / SEPA (EU customers)
| Key | Where to get |
|-----|-------------|
| `Stripe__SecretKey` | Stripe dashboard -> Developers -> API Keys |
| `Stripe__WebhookSecret` | Stripe dashboard -> Webhooks -> Signing secret |

Only needed if you accept SEPA direct debit from European customers.

### Tap Card Reader (Physical POS - NOT YET BUILT)
The POS screen records walk-in payments manually today.
To connect a physical Tap iPOS terminal or use Tap on Phone (NFC),
the Tap mobile POS SDK needs to be integrated into the mobile app.
This is a 2-3 day task when needed.

---

## 3. COMMUNICATIONS - App Works Without These, Falls Back to Console Log

### Email (SMTP)
| Key | Value |
|-----|-------|
| `Email__SmtpHost` | `smtp.gmail.com` (Gmail) or `smtp.sendgrid.net` (SendGrid) |
| `Email__SmtpPort` | `587` |
| `Email__SmtpUser` | Your email or SendGrid `apikey` |
| `Email__SmtpPassword` | Gmail app password or SendGrid API key |
| `Email__FromAddress` | `noreply@flowly.app` (or your domain) |
| `Email__FromName` | `Flowly Car Detailing` |

Gmail setup: Google Account -> Security -> App Passwords -> generate one.
SendGrid free tier: 100 emails/day free. https://sendgrid.com

Without this, verification codes and password resets only print to the server console.

### SMS / WhatsApp (Infobip)
| Key | Where to get |
|-----|-------------|
| `Infobip__ApiKey` | Infobip portal -> API Keys |
| `Infobip__SmsSender` | Your registered sender ID (e.g. `Flowly`) |
| `Infobip__WhatsAppSender` | Your WhatsApp Business number registered in Infobip |

Infobip portal: https://portal.infobip.com
Without this, SMS reminders are silently skipped.

---

## 4. AI FEATURES - Optional, Falls Back to FAQ Mode

### Anthropic (Claude Chatbot + Weekly Digest)
| Key | Where to get |
|-----|-------------|
| `Anthropic__ApiKey` | https://console.anthropic.com -> API Keys |

Without this key:
- Customer chatbot answers from a hardcoded FAQ list (works fine for basic questions)
- Weekly AI digest job silently skips

Recommended model in code: `claude-haiku-4-5-20251001` (cheapest, fast enough for chat)
Cost: roughly $0.001 per customer chat message. Negligible at low volume.

---

## 5. OBSERVABILITY - Optional

### Sentry (Error Tracking)
| Key | Where to get |
|-----|-------------|
| `Observability__SentryDsn` | https://sentry.io -> New Project -> DSN |

Free tier: 5,000 errors/month. Strongly recommended for production - you will know about crashes before your customers complain.

---

## 6. OBJECT STORAGE - Optional (Local Filesystem Is Default)

By default, uploaded files (booking photos, profile images) are saved to the server's local disk.
This works fine on a single server. If you need CDN or multi-server, switch to S3-compatible storage.

| Key | Value |
|-----|-------|
| `ObjectStorage__Provider` | `S3` (or leave blank for local) |
| `ObjectStorage__ServiceUrl` | e.g. `https://s3.eu-west-1.amazonaws.com` or Cloudflare R2 URL |
| `ObjectStorage__BucketName` | Your bucket name |
| `ObjectStorage__AccessKey` | AWS/R2 access key |
| `ObjectStorage__SecretKey` | AWS/R2 secret key |
| `ObjectStorage__PublicBaseUrl` | Public URL prefix for serving files |

Cloudflare R2: free for 10GB storage and 1M requests/month. Recommended.

---

## 7. GOOGLE (OAuth + Places)

### Google OAuth (Social Login)
| Key | Where to get |
|-----|-------------|
| `Authentication__Google__ClientId` | Google Cloud Console -> APIs -> Credentials -> OAuth 2.0 |
| `Authentication__Google__ClientSecret` | Same |

Google Cloud Console: https://console.cloud.google.com
Required redirect URI: `https://your-domain.com/api/Auth/google-callback`

### Google Places (Address Autocomplete)
| Key | Where to get |
|-----|-------------|
| `Google__PlacesApiKey` | Google Cloud Console -> APIs -> Maps -> Places API |

Currently the system uses Nominatim (OpenStreetMap, free) as the default.
Google Places is more accurate but costs ~$0.003 per request after the free tier.

---

## 8. SSO (Enterprise Feature)
SSO provider config is stored per-org in the database, not in env vars.
Set it up through Admin -> SSO Settings in the dashboard once deployed.
Supports SAML 2.0 and OIDC.

---

## Minimum to Go Live Checklist

These are the absolute minimum before accepting real users:

- [ ] `JwtSettings__SecretKey` - set to a random 32+ char string
- [ ] `ConnectionStrings__DefaultConnection` - PostgreSQL connection string
- [ ] `AdminUser__Email` + `AdminUser__Password` - your admin login
- [ ] `TapPayments__SecretKey` + `TapPayments__WebhookSecret` - to accept payments
- [ ] `Email__SmtpHost/User/Password` - so OTP codes reach customers
- [ ] Deploy to Render or Railway with the Dockerfile
- [ ] Set `VITE_API_BASE_URL=https://your-api-domain.com/api` in frontend env
- [ ] Run `dotnet ef database update` or let EF auto-migrate on startup
- [ ] Test register -> OTP -> login -> book -> pay flow end to end

---

## Frontend Environment Variables

Set these in Vercel / Netlify / wherever the React app is deployed.

| Variable | Value |
|----------|-------|
| `VITE_API_BASE_URL` | `https://your-api-domain.com/api` |

---

## Recommended Free-Tier Stack for First Deploy

| Service | Cost | Use |
|---------|------|-----|
| Railway | $5/month | Backend API (Docker) |
| Neon.tech | Free | PostgreSQL (512MB) |
| Vercel | Free | React frontend |
| Cloudflare R2 | Free | File storage |
| Sentry | Free | Error tracking |
| SendGrid | Free | Email (100/day) |

Total cost to serve first 10 businesses: ~$5-10/month.
