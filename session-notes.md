## Session [2026-05-20 01:15]
### Goal
Full project rebrand from Glanz to Flowly across all source code, configs, and assets.
### Decisions
- C# namespaces changed from `Glanz.API.*` to `Flowly.API.*`
- German word "Glanz" (shine/gloss) in German UI translations left unchanged
- `glanz_db` database name left in dev connection string (actual DB not renamed)
- Logo file renamed `GlanzLogo.png` -> `FlowlyLogo.png`
### Files changed
- 311 .cs files: namespace + using directive bulk replace
- Flowly.API.csproj, Flowly.API.Tests.csproj, Flowly.sln
- Dockerfile, .github/workflows/ci.yml, railway.json
- Mobile: 8 JS files, app.json, HomeScreen.js
- Frontend: main.jsx, Footer.jsx, Home.jsx, business.js
- SmtpEmailService.cs, AdminNotificationService.cs, OfferService.cs
- Test fixtures: BookingFlowTests.cs, TenantIsolationTests.cs
- flowly-home-theme.json, package.json, CLAUDE.md, settings.local.json
### Folders renamed
- Glanz.API -> Flowly.API
- Glanz.API.Tests -> Flowly.API.Tests
- glanz-frontend -> flowly-frontend
- Glanz-Mobile -> Flowly-Mobile
### Next steps
- Close VS Code, rename Glanz-WebApp -> Flowly-WebApp in File Explorer, reopen
### Blockers
- Glanz-WebApp folder locked by VS Code - requires manual rename with VS Code closed
