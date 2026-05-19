# Flowly - Business Assessment

---

## The Problem

Car detailing businesses in the GCC - Qatar, UAE, Saudi Arabia - have no software built for them.

Today they operate like this:
- Bookings come through WhatsApp. Someone writes them down or remembers them.
- Workers get a phone call or a text when a job is assigned.
- Customers have no idea when the worker is arriving.
- Payment is cash at the door or a manual bank transfer.
- Payroll is calculated at the end of the month by hand.
- The owner has no idea which worker is performing, which package sells most, or what last month's revenue was.

This is not a small market problem. There are thousands of car detailing businesses operating this way across the GCC. None of the existing booking software solves it because:
1. They are built for Western markets (Booksy, Vagaro, Square) - no Arabic, no Tap Payments, no QPay
2. They are built for salons and gyms, not mobile detailers who go to the customer
3. They don't have a worker mobile app that handles job dispatch and live location
4. They don't understand the B2B side (corporate fleets, purchase orders, credit accounts)

---

## What Flowly Solves

Flowly is a multi-tenant SaaS platform that runs the entire operation of a professional car detailing business.

**For customers:** Book online, pick a package and time slot, pay through Tap/QPay, track their worker in real time, receive push notifications when the job starts and finishes.

**For workers:** Receive job assignments on their phone, navigate to the customer, mark arrival and completion, build a performance record.

**For the business owner:** See every booking, assign workers, manage pricing, run payroll, launch offers, track loyalty, send push campaigns, view revenue reports, and manage corporate accounts - all from one dashboard.

---

## Size and Scope

This is not a side project or MVP. The feature surface matches or exceeds tools that charge $150-500/month per business.

| Layer | What is built |
|-------|--------------|
| Booking engine | Slot availability, auto-assign, recurring bookings, constraints |
| Staff management | Schedule, payroll, attendance, ratings, certifications, IBAN |
| Payments | Tap Payments, QPay, Dibsy, SEPA/Stripe, payment links |
| CRM and marketing | Customer segments, cohorts, campaigns, loyalty, referrals |
| Corporate B2B | Credit accounts, purchase orders, invoicing |
| Mobile apps | Customer app (React Native) + worker app in one |
| Multi-tenant | Full org isolation - one deployment, unlimited businesses |
| AI | Claude-powered chatbot with live business context |
| Compliance | GDPR data export/deletion, audit log, SSO |
| Reporting | Financial reports, DATEV export, payroll slips (PDF) |

---

## Competitive Position

**You win against existing tools because:**

- **GCC-native** - Tap Payments, QPay, Dibsy are built in. Most tools support Stripe only.
- **Arabic RTL** - the UI works in Arabic. Most tools don't.
- **Mobile detailer model** - built around "we come to you", not "drop your car at a shop."
- **Both sides in one product** - customer app, worker app, and admin panel are one system.
- **Multi-tenant from day one** - you can serve 100 businesses from one deployment at near-zero marginal cost.

**Direct competitors in the detailing vertical:**
- DetailerPro - basic booking form, no mobile app, US only
- Detailing.io - appointment calendar only, no worker dispatch
- AutoSense - shop management for repair shops, not mobile detailers

None of them have a native Arabic mobile app, GCC payment gateways, or a live worker tracking map.

---

## Can It Be Sold

Yes. The software is production-ready. The business has not started yet.

**What is ready:**
- The full product works end to end
- Org registration and onboarding flow is built
- Subscription/plan billing infrastructure is built
- The pricing enforcement (PlanGuard) is built

**What you need before charging real money:**
1. Get it deployed on a live URL (Render or Railway, free tier works to start)
2. Give it to 3-5 real detailing shops for free for 30 days
3. Watch where they get confused - that is your product roadmap
4. Set pricing at QAR 199-399/month per business (low enough to not need approval, high enough to signal value)
5. Film a 90-second demo and share in Qatar business WhatsApp groups

---

## The Pitch (30 seconds)

> "Most car detailing shops in Qatar run their bookings on WhatsApp and pay their workers in cash at the end of the month. We built the software that runs the whole operation - customers book online, workers get job notifications on their phone, and the owner sees revenue and payroll in one dashboard. It works in Arabic, connects to Tap Payments, and takes one day to set up. We charge 299 QAR a month."

Keep it operational. Shop owners do not care about SSO or GDPR.
They care about three things: did the booking reach my worker, did the customer pay, and what did I make this month.

---

## What Could Be Added Later

These are not blockers - the product works without them. Add them once you have paying customers.

- **Tap card reader (hardware)** - the POS screen exists and records walk-in payments, but does not talk to a physical Tap iPOS terminal yet. Tap has a mobile SDK for this. 2-3 days of work to add.
- **Uber-style marketplace** - currently B2B (businesses use it for their own team). Could open up as a marketplace where customers book any verified detailer in the city. Different business model, bigger market.
- **Fleet management** - corporate customers with 20+ vehicles. Dedicated fleet dashboard, bulk scheduling. High-value B2B add-on.
- **Franchise mode** - one brand, multiple owned locations. The multi-tenant infrastructure already supports this, just needs a UI layer.
- **Insurance integration** - post-service ceramic coat or paint protection certificates linked to the car's VIN. No one does this in Qatar.
- **Vehicle history** - every service recorded against the car's plate. Resale value proof. Customer retention angle.
