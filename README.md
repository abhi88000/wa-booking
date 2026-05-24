# WA Platform — WhatsApp Automation SaaS

Multi-tenant WhatsApp automation platform. Businesses sign up, connect their WhatsApp number, and build custom conversation flows using a visual flow builder. Supports appointments, lead capture, customer support, and any workflow — not limited to clinics.

**Live at**: `booking.futurezminds.in` (tenant) · `hub.futurezminds.in` (admin) · `api.futurezminds.in` (API)


## How It Works

1. Business owner signs up at the tenant dashboard with an invite code
2. Onboarding: connect WhatsApp number → configure staff → set availability
3. Build conversation flows using the visual Flow Builder (menus, inputs, conditions, actions)
4. Customers message the business's WhatsApp number
5. Flow engine guides them through the configured flow automatically
6. Data appears in the dashboard instantly (appointments, records, conversations)
7. Automated reminders and scheduled messages go out via WhatsApp


## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js 20, Express, PostgreSQL 16 |
| Tenant Dashboard | React 18, Vite, Tailwind CSS |
| Super Admin Panel | React 18, Vite, Tailwind CSS, Recharts |
| WhatsApp | Meta Cloud API v21.0 |
| Auth | JWT (separate tokens for tenants and platform admins) |
| Infra | Docker Compose, Nginx, Let's Encrypt, AWS EC2 |


## Project Structure

```
├── docker-compose.saas.yml        # Production compose (6 services)
├── .env.example                   # Environment variable template
├── scripts/
│   ├── validate.js                # Pre-deploy validation script
│   └── backup-db.sh               # Daily DB backup (gzip, verify, S3 optional, Telegram alert)
├── db/
│   └── init-saas.sql              # Full schema: tables, indexes, enums, RLS
│
├── backend/
│   ├── migrations/                # Incremental schema migrations (001–007)
│   └── src/
│       ├── index.js               # Express server entry point + /health + /healthz
│       ├── cron.js                 # Scheduled jobs (reminders, self-monitor, outbound)
│       ├── manage.js              # CLI: create admin, check stats
│       ├── db/pool.js             # PostgreSQL connection pool
│       ├── middleware/
│       │   ├── auth.js            # JWT auth (platform + tenant + role-based)
│       │   ├── tenantContext.js   # Load tenant config (cached), enforce limits
│       │   ├── requestId.js       # Assigns req.id + X-Request-Id header for log correlation
│       │   └── errorHandler.js    # Centralized error handling (logs + alerts + reqId in 500)
│       ├── routes/
│       │   ├── auth.js            # Signup + login (tenant + platform)
│       │   ├── onboarding.js      # WhatsApp connect + business setup
│       │   ├── platform.js        # Super admin API (tenant management)
│       │   ├── webhook.js         # WhatsApp webhook (async, multi-tenant)
│       │   └── tenant/            # Tenant API — split by domain
│       │       ├── index.js       # Barrel: mounts all sub-routers with auth
│       │       ├── helpers.js     # Shared formatters (time, date)
│       │       ├── dashboard.js   # GET /dashboard (stats, today's schedule)
│       │       ├── appointments.js # 6 routes (list, create, status, reschedule, followup)
│       │       ├── doctors.js     # 7 routes (CRUD, slots, availability)
│       │       ├── services.js    # 4 routes (CRUD)
│       │       ├── patients.js    # 4 routes (list, create, update, detail)
│       │       ├── inbox.js       # 4 routes (conversations, messages, reply)
│       │       ├── settings.js    # 3 routes (settings, WhatsApp connection)
│       │       ├── team.js        # 4 routes (team CRUD)
│       │       ├── flow.js        # 3 routes (flow config, AI config)
│       │       └── records.js     # 5 routes (generic record CRUD + summary)
│       ├── services/
│       │   ├── flowEngine.js      # Visual flow executor (menus, inputs, conditions, actions)
│       │   ├── bookingEngine.js   # Appointment booking state machine
│       │   ├── messageRouter.js   # Module registry — routes messages to correct engine
│       │   ├── whatsapp.js        # WhatsApp Cloud API client (retry, rate limit)
│       │   ├── tenantCache.js     # In-memory tenant config cache (5min TTL)
│       │   ├── aiService.js       # AI chatbot integration (optional per tenant)
│       │   ├── reminders.js       # Appointment reminder sender
│       │   ├── scheduledMessages.js # Outbound scheduled message engine
│       │   └── tenantHealth.js    # Health monitoring, stuck conversation reset
│       └── utils/
│           ├── logger.js          # Winston logger with file rotation, renders [tenant:xxx] [req:yyy]
│           ├── alerts.js          # Self-hosted Telegram alerter (no third-party SaaS)
│           └── errors.js          # Typed error classes (AppError, NotFoundError, etc.)
│
├── tenant-dashboard/              # Business owner's web panel
│   └── src/
│       ├── App.jsx                # Router + authenticated layout
│       ├── api.js                 # Axios API client
│       ├── ClinicContext.jsx      # Tenant config context (labels, features, theme)
│       ├── utils.js               # Shared utilities
│       ├── components/
│       │   └── Icons.jsx          # SVG icon library (30+ icons)
│       └── pages/
│           ├── Dashboard.jsx      # Adaptive stats by business type
│           ├── Appointments.jsx   # List, create, status updates, follow-ups
│           ├── Doctors.jsx        # Staff CRUD + availability editor
│           ├── Services.jsx       # Service catalog CRUD
│           ├── Patients.jsx       # Customer list with search + history
│           ├── Inbox.jsx          # WhatsApp conversation inbox + manual reply
│           ├── FlowBuilder.jsx    # Visual flow builder (multi-flow, templates, cross-linking)
│           ├── flowBuilderUtils.js # Flow validation + node cleanup helpers
│           ├── Settings.jsx       # Business info, WhatsApp connection
│           ├── Login.jsx          # Tenant login
│           ├── Signup.jsx         # Tenant signup (invite code required)
│           ├── Onboarding.jsx     # 3-step setup wizard
│           ├── Privacy.jsx        # Privacy policy (Meta compliance)
│           ├── Terms.jsx          # Terms of service (Meta compliance)
│           └── DataDeletion.jsx   # Data deletion instructions (Meta compliance)
│
├── super-admin/                   # Platform admin panel
│   └── src/
│       ├── App.jsx                # Router + sidebar layout
│       ├── api.js                 # Axios API client
│       └── pages/
│           ├── Dashboard.jsx      # Tenant count, active stats
│           ├── Tenants.jsx        # Tenant list with activity indicators
│           ├── TenantDetail.jsx   # Deep view: WA config, usage, delete
│           ├── Analytics.jsx      # Signup trends, top tenants
│           ├── Health.jsx         # System health monitoring
│           ├── InviteCodes.jsx    # Generate/manage invite codes
│           └── Login.jsx          # Platform admin login
│
├── website/                       # Static landing page
│   ├── index.html                 # Landing page
│   ├── privacy.html               # Privacy policy
│   ├── terms.html                 # Terms of service
│   └── Dockerfile
│
└── docs/
    ├── architecture.md            # Multi-tenancy design, schema overview
    ├── deployment.md              # EC2 + Nginx + SSL setup guide
    ├── whatsapp-setup.md          # Meta Developer Console walkthrough
    └── api-reference.md           # API endpoint documentation
```


## Architecture

```
                  ┌──────────────┐
                  │  Meta Cloud  │
                  │  API (WA)    │
                  └──────┬───────┘
                         │ webhook
                  ┌──────▼───────┐
                  │   webhook.js │ ← returns 200 immediately (async)
                  └──────┬───────┘
                         │ resolveTenant (cached)
                  ┌──────▼────────────┐
                  │  messageRouter.js  │ ← module registry
                  └──┬──────┬─────────┘
                     │      │
              ┌──────▼──┐ ┌─▼──────────┐
              │  flow   │ │  booking   │
              │  Engine │ │  Engine    │
              └─────────┘ └────────────┘
```

- **Tenant cache**: In-memory with 5min TTL. Eliminates DB lookup on every webhook hit and API call.
- **Module registry**: `messageRouter.js` dispatches to `flowEngine`, `bookingEngine`, or `aiService` based on tenant config and conversation state.
- **Domain routes**: 41 tenant API endpoints split across 10 files by domain (appointments, doctors, settings, etc.).


## Setup

### Requirements

- Docker and Docker Compose
- A domain with DNS configured (3 subdomains: api, booking, hub)
- Meta Developer account with WhatsApp Cloud API access

### 1. Configure environment

```bash
cp .env.example .env
```

Required variables:
```
JWT_SECRET=<random 40+ character string>
WA_VERIFY_TOKEN=<any string — same goes in Meta Developer Console>
DB_PASSWORD=<strong password>
CORS_ORIGINS=https://booking.yourdomain.com,https://hub.yourdomain.com
```

### 2. Start services

```bash
docker compose -f docker-compose.saas.yml up -d
```

| Service | Port | Description |
|---|---|---|
| PostgreSQL | 5432 | Database |
| Backend API | 4000 | REST API |
| Cron Worker | — | Reminders, health checks, scheduled messages |
| Tenant Dashboard | 3000 | Business admin panel |
| Super Admin | 3001 | Platform admin panel |
| Website | 8080 | Landing page |

### 3. Create platform admin

```bash
docker compose -f docker-compose.saas.yml exec backend node src/manage.js create-admin
```

### 4. Set up WhatsApp webhook

See [docs/whatsapp-setup.md](docs/whatsapp-setup.md) for the full walkthrough.

- **Webhook URL**: `https://api.yourdomain.com/webhook/whatsapp`
- **Verify Token**: same as `WA_VERIFY_TOKEN` in `.env`
- **Subscribe to**: `messages` field
- **App Secret**: set `WA_APP_SECRET` in `.env` to enable webhook signature validation (X-Hub-Signature-256)


## Deployment

Deployed on AWS EC2 with Nginx reverse proxy + Let's Encrypt SSL.

```bash
# Deploy updates
cd /home/ubuntu/wa-booking
git pull origin feature/configurable-whatsapp-flows
docker compose -f docker-compose.saas.yml up -d --build backend cron-worker tenant-dashboard super-admin

# Smoke test
curl -i http://localhost:4000/healthz
```

See [docs/deployment.md](docs/deployment.md) for full Nginx config, SSL setup, and domain configuration.


## Operations

### Health checks

- `GET /health` and `GET /healthz` — both touch the DB and return JSON:
  ```json
  { "status": "ok", "db": "connected", "uptime_s": 142, "latency_ms": 19,
    "version": "<GIT_SHA>", "timestamp": "..." }
  ```
  Returns 503 with `db: "disconnected"` if the DB query fails — surfaces silent
  auth failures that would otherwise be invisible until a real request hits.

### Self-monitoring + alerting (Telegram, self-hosted)

No third-party SaaS. The cron worker hits `/healthz` every 60s and pings
Telegram on 2 consecutive failures, plus a recovery message when it comes back.

Enable by setting in `.env`:
```
TELEGRAM_BOT_TOKEN=<from @BotFather>
TELEGRAM_CHAT_ID=<your chat id>
HEALTHCHECK_URL=http://backend:4000/healthz   # default inside compose network
GIT_SHA=<set at deploy time, surfaced in /healthz + alerts>
```

What triggers an alert:
- Backend down (2 consecutive `/healthz` failures)
- `uncaughtException` / `unhandledRejection`
- Unhandled 500 in any route (via `errorHandler` middleware)
- Backup script failure (gzip verify, dump size, or upload)

Alerts include a 5-minute dedup window per error key so a crash loop doesn't
spam the channel.

### Backups

`scripts/backup-db.sh` runs daily at 03:00 (cron on the host):
- `pg_dump | gzip` of `wa_booking_saas` (no-owner, no-privileges)
- verifies the gzip is valid and at least 1 KB
- optional S3 upload if `BACKUP_S3_BUCKET` is set and `aws` CLI is on PATH
- local rotation: `find -mtime +$KEEP_DAYS -delete` (default 14 days)
- Telegram alert on any failure, weekly success ping on Mondays

```bash
# Run manually
~/wa-booking/scripts/backup-db.sh
# Tail the log
tail -f ~/db-backups/backup.log
```

### Log correlation

Every request gets a `req.id` (8 random hex bytes, or upstream `X-Request-Id`
from Nginx when present). It's echoed in the response header, logged inline as
`[req:xxx]`, included in Telegram alerts, and returned in the 500 response body
so a customer-visible error maps to one log line:

```bash
docker compose -f docker-compose.saas.yml logs backend | grep 'req:abc12345'
```

### Managed sessions (account-manager mode)

The hub has a **"Manage as Tenant"** button on each tenant's detail page. It
mints a short-lived (2h) tenant JWT for the customer's owner user with extra
claims `managed: true, managerEmail`, opens the tenant dashboard at
`?managed_token=...`, and writes a `MANAGED_SESSION_START` row to `audit_log`
(action attributed to the platform admin's email).

The tenant dashboard:
- Strips the token from the URL on mount (no leakage to browser history)
- Shows a soft blue banner: *"Your account manager <email> is configuring this
  account for you."* — so the customer sees who set things up the next time
  they log in is implicit (the banner only renders while the managed token is
  active; they can clear it by logging out and back in)

Use this for: doctor / service / availability setup, flow builder edits,
sending a test WhatsApp message, reproducing a customer-reported bug. Avoid
for: password changes (use the dedicated "Reset Password" action so it goes
through the proper hashing path) and billing actions.

Configure the redirect target via env on the backend:
```
TENANT_DASHBOARD_URL=https://booking.yourdomain.com
```
Falls back to the hub origin with `hub.` swapped to `booking.` if unset.

### Database migrations

Numbered SQL files in `backend/migrations/` are idempotent (`IF NOT EXISTS`,
`ON CONFLICT`). Apply manually after deploy when a new one lands:

```bash
docker compose -f docker-compose.saas.yml exec -T postgres \
  psql -U postgres -d wa_booking_saas < backend/migrations/00X_*.sql
```


## Security model

**Tenant isolation is enforced at the query layer.** Every query against a
tenant-scoped table (`appointments`, `doctors`, `chat_messages`, `reminders`,
`doctor_breaks`, `doctor_availability`, etc.) MUST include
`AND tenant_id = $N`. Even when filtering by a primary-key UUID like
`doctor_id` — those UUIDs can leak via chat state or admin payloads, and the
tenant_id filter is the last line of defense against cross-tenant reads.

Defense in depth:
- **JWT** carries `tenantId`; middleware sets `req.tenantId`
- **`tenantContext` middleware** also sets `app.tenant_id` via Postgres
  `set_config()` for RLS policies
- **RLS policies** (migration 002) provide a backstop if a query forgets the
  filter (catches the bug at runtime instead of leaking)
- **`wa_app` non-superuser DB role** (migration 007) limits blast radius if
  SQLi ever lands

When adding new queries, copy the `AND tenant_id = $N` pattern from neighbors.
Do not remove it thinking it's redundant — it isn't.


## Flow Builder

The visual flow builder lets business owners create custom WhatsApp conversation flows without code.

**Multi-flow architecture:**
- Each tenant can have **multiple flows** (e.g. Appointment Booking + Customer Feedback)
- One flow is marked as the **Starting Flow** — the entry point when a customer messages
- Flows can **link to each other** — a button in one flow can jump to a screen in another
- Each flow is created from a **template** but is fully customizable (edit text, buttons, labels)
- Add screens within each flow using Message / Question / Route / Action buttons
- Data model: `_flows` array in `flow_config` JSONB tracks flow metadata; each screen has a `_flow` field

**Node types:**
- **Menu** — Send a message with up to 10 buttons. Each button routes to a different node (including cross-flow).
- **Input** — Collect user input (text, number, email, phone, date, rating, yes/no) and store in a variable.
- **Condition** — Branch based on variable values (equals, contains, greater_than, etc.).
- **Action** — Trigger side effects: save a record, notify admin, set a variable, send a follow-up, or start the booking engine.

**Templates:**
- **Appointment Booking** — Book, view, or cancel appointments (clinics, salons, gyms)
- **Customer Feedback** — Collect ratings with emoji buttons (restaurants, hotels, salons)

**Built-in button actions:**
- `next` — Navigate to another screen (same flow or cross-flow)
- `text` — Send a reply message
- `ai` — Hand off to AI assistant
- `booking_flow` — Start the appointment booking flow
- `booking_status` — Show upcoming appointments
- `booking_cancel` — Show cancellable appointments
- `save_record` — Save collected data as a tenant record
- `notify_admin` — Send WhatsApp notification to business owner


## Key Design Decisions

- **Multi-flow architecture** — Visual flow builder supports multiple flows per tenant with cross-flow linking. Each flow starts from a template and is fully customizable. Booking engine is a pluggable module, not hardcoded.
- **Multi-tenant shared schema** — All tenants share one database. Every table has `tenant_id`. RLS policies for extra isolation.
- **Tenant config caching** — In-memory cache with 5min TTL avoids DB lookup on every webhook and API request. Auto-invalidated on settings changes.
- **Domain-split routes** — 41 API endpoints organized into 10 domain files instead of one monolith. Each domain is independently maintainable.
- **Timezone-aware** — Each tenant sets their timezone. The booking engine generates dates/slots in the tenant's local time.
- **Adaptive UI** — Dashboard, sidebar labels, and features adapt based on business type (clinic, salon, gym, etc.).
- **Invite-code signup** — New tenants need an invite code. Controls growth during early stage.
- **Webhook signature validation** — Optional HMAC-SHA256 verification of incoming Meta webhooks via `WA_APP_SECRET`. Uses `crypto.timingSafeEqual` to prevent timing attacks.
- **Message status tracking** — Every chat message is tracked with a status (received/sent/failed/pending). Reply failures are surfaced to the dashboard.
- **Fault-isolated webhook** — One tenant's WhatsApp failure never affects another tenant. Async processing with immediate 200 response.


## License

Proprietary. All rights reserved.
