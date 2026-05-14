# Glanz WhatsApp Agent Skill

## Current State (as of 2026-05-14)

The WhatsApp integration is a **link-only implementation** — no automation or agent exists yet.

- **Web widget**: `glanz-frontend/src/components/shared/WhatsAppWidget.jsx` — currently returns `null` (disabled)
- **Mobile screen**: `Glanz-Mobile/src/screens/WhatsAppScreen.js` — fetches the business WhatsApp number from `GET /api/public/whatsapp-business`, then opens `https://wa.me/{number}?text=...` via `Linking.openURL`
- **Backend**: `BookingDtos.cs` contains `WhatsAppBusinessDto { WhatsAppBusinessNumber }`, and `Booking.cs` has `BookingSource.WhatsApp = 6` enum value — infrastructure is stubbed but no webhook handler exists

## Architecture for a Full WhatsApp Booking Agent

### Backend components needed

| Component | Path | Purpose |
|-----------|------|---------|
| Webhook controller | `Controllers/WhatsAppController.cs` | Receive Meta webhook events |
| Message handler service | `Services/WhatsAppMessageService.cs` | Parse intent, drive state machine |
| Session store | DB table `WhatsAppSessions` | Track conversation state per phone number |
| Message sender | `Services/WhatsAppSendService.cs` | Call Meta Cloud API to send messages |

### Meta Cloud API config

```json
// appsettings.json
"WhatsApp": {
  "PhoneNumberId": "...",
  "AccessToken": "...",
  "VerifyToken": "any-string-you-choose",
  "WebhookSecret": "..."
}
```

Webhook URL to register in Meta Business: `POST https://api.yourdomain.com/api/WhatsApp/webhook`

### Webhook verification (GET)

```csharp
[HttpGet("webhook")]
public ActionResult Verify([FromQuery(Name="hub.mode")] string mode,
                           [FromQuery(Name="hub.verify_token")] string token,
                           [FromQuery(Name="hub.challenge")] string challenge)
{
    if (mode == "subscribe" && token == _config["WhatsApp:VerifyToken"])
        return Content(challenge);
    return Forbid();
}
```

### Booking flow state machine

```
IDLE
  │ "book" / "booking" / "حجز" / "Termin" keyword
  ▼
COLLECT_VEHICLE (ask: Sedan/SUV/Pickup/Motorcycle?)
  │ valid vehicle type received
  ▼
COLLECT_PACKAGE (send list of active packages with prices)
  │ user selects package by number
  ▼
COLLECT_DATE (ask for date, show available days from /api/Bookings/availability-calendar)
  │ valid date received
  ▼
COLLECT_SLOT (send available time slots from /api/Bookings/available-slots)
  │ user selects slot
  ▼
COLLECT_ADDRESS (ask for service address)
  │ address received
  ▼
CONFIRM (show summary, ask "Confirm? yes/no")
  │ "yes" / "نعم" / "ja"
  ▼
BOOKING_CREATED (call POST /api/Bookings with BookingSource=WhatsApp, no payment intent for WhatsApp — admin invoices separately)
  │
  ▼
IDLE (send booking number + confirmation message)
```

### Multilingual response rules

- Detect language from first message:
  - Arabic characters present → Arabic (`ar`)
  - German keywords (`hallo`, `ja`, `nein`, `buchen`) → German (`de`)
  - Default → English (`en`)
- Store detected language in `WhatsAppSessions.Language`
- All replies use the detected language throughout the session
- Arabic replies set RTL-friendly formatting (WhatsApp renders Arabic natively)

### Session management

```sql
CREATE TABLE WhatsAppSessions (
  PhoneNumber TEXT PRIMARY KEY,
  State TEXT NOT NULL DEFAULT 'IDLE',
  Language TEXT NOT NULL DEFAULT 'en',
  CollectedData JSONB,   -- { vehicleType, packageId, date, slot, address }
  LastActivityAt TIMESTAMPTZ NOT NULL,
  CreatedAt TIMESTAMPTZ NOT NULL
);
```

- Session expires after 30 minutes of inactivity → reset to IDLE
- One session per phone number (upsert on each message)

### Webhook incoming message handler

```csharp
[HttpPost("webhook")]
public async Task<ActionResult> HandleWebhook([FromBody] WhatsAppWebhookPayload payload)
{
    // 1. Verify X-Hub-Signature-256 header
    // 2. Extract message from payload.Entry[0].Changes[0].Value.Messages[0]
    // 3. Load or create session for message.From (phone number)
    // 4. Pass to state machine handler
    // 5. Send reply via Meta Cloud API
    // 6. Return 200 OK immediately (Meta requires fast response)
    return Ok();
}
```

### Message sending (Meta Cloud API)

```
POST https://graph.facebook.com/v20.0/{PhoneNumberId}/messages
Authorization: Bearer {AccessToken}
Content-Type: application/json

{
  "messaging_product": "whatsapp",
  "to": "{phone_number}",
  "type": "text",
  "text": { "body": "{message_text}" }
}
```

For interactive list/button messages (package/slot selection), use `"type": "interactive"` with list or button template.

### Key constraints

- WhatsApp messages must be sent within 24-hour customer service window after the user's last message. Outside this window, only pre-approved template messages can be sent.
- Meta webhook requires HTTPS with a valid certificate.
- Booking created via WhatsApp uses `BookingSource = 6 (WhatsApp)` and `PaymentStatus = Pending` (admin arranges payment separately or sends payment link).
- Never expose the WhatsApp access token in frontend code.

### Project conventions to follow

- Add `WhatsAppController.cs` in `Controllers/`
- Add `WhatsAppSendService.cs` and `WhatsAppMessageService.cs` in `Services/`
- Register services in `Program.cs`: `builder.Services.AddScoped<IWhatsAppSendService, WhatsAppSendService>()`
- Add DB migration for `WhatsAppSessions` table: `dotnet ef migrations add AddWhatsAppSessions`
- Config section `WhatsApp:*` follows same pattern as `Stripe:*` and `JwtSettings:*`
- All user-facing reply strings must be in `en`/`ar`/`de` locale files (or a dedicated `whatsapp-replies.json`)
