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
├── scripts/validate.js            # Pre-deploy validation script
├── db/
│   └── init-saas.sql              # Full schema: tables, indexes, enums, RLS
│
├── backend/
│   ├── migrations/                # Incremental schema migrations (001–005)
│   └── src/
│       ├── index.js               # Express server entry point
│       ├── cron.js                 # Scheduled jobs (reminders, health checks, outbound)
│       ├── manage.js              # CLI: create admin, check stats
│       ├── db/pool.js             # PostgreSQL connection pool
│       ├── middleware/
│       │   ├── auth.js            # JWT auth (platform + tenant + role-based)
│       │   ├── tenantContext.js   # Load tenant config (cached), enforce limits
│       │   └── errorHandler.js    # Centralized error handling
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
│           ├── logger.js          # Winston logger with file rotation
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
```

See [docs/deployment.md](docs/deployment.md) for full Nginx config, SSL setup, and domain configuration.


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
