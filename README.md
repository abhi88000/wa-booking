# WA Booking — WhatsApp Appointment Booking SaaS

Multi-tenant appointment booking platform powered by WhatsApp. Clinics sign up, connect their WhatsApp number, add doctors and services, and patients book appointments through interactive WhatsApp menus. No AI — entirely menu-driven using WhatsApp buttons and lists.

**Live at**: `booking.futurezminds.in` (tenant) · `hub.futurezminds.in` (admin) · `api.futurezminds.in` (API)


## How It Works

1. Clinic owner signs up at the tenant dashboard with an invite code
2. Onboarding: connect WhatsApp number → add doctors → set availability
3. Patients message the clinic's WhatsApp number
4. Bot guides them: select doctor → pick service → choose date → pick time → confirm
5. Appointment appears in the clinic dashboard instantly
6. Automated reminders go out 24h and 1h before the appointment via WhatsApp templates


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
├── docker-compose.saas.yml        # Production compose (5 services)
├── .env.example                   # Environment variable template
├── db/
│   └── init-saas.sql              # Full schema: tables, indexes, enums, RLS
│
├── backend/
│   └── src/
│       ├── index.js               # Express server entry point
│       ├── cron.js                 # Scheduled jobs (reminders, health checks)
│       ├── manage.js              # CLI: create admin, check stats
│       ├── db/pool.js             # PostgreSQL connection pool
│       ├── middleware/
│       │   ├── auth.js            # JWT auth (platform + tenant)
│       │   ├── tenantContext.js   # Load tenant profile, enforce limits
│       │   └── errorHandler.js    # Centralized error handling
│       ├── routes/
│       │   ├── auth.js            # Signup + login (tenant + platform)
│       │   ├── onboarding.js      # WhatsApp connect + business setup
│       │   ├── tenant.js          # Tenant dashboard API (doctors, appointments, etc.)
│       │   ├── platform.js        # Super admin API (tenant management)
│       │   └── webhook.js         # WhatsApp webhook (multi-tenant message intake)
│       ├── services/
│       │   ├── bookingEngine.js   # WhatsApp conversation state machine
│       │   ├── messageRouter.js   # Routes messages to the booking engine
│       │   ├── whatsapp.js        # WhatsApp Cloud API client (retry, rate limit)
│       │   ├── reminders.js       # Appointment reminder sender
│       │   └── tenantHealth.js    # Health monitoring, stuck conversation reset
│       └── utils/
│           ├── logger.js          # Winston logger with file rotation
│           └── errors.js          # Typed error classes (AppError, NotFoundError, etc.)
│
├── tenant-dashboard/              # Clinic owner's web panel
│   └── src/
│       ├── App.jsx                # Router + authenticated layout
│       ├── api.js                 # Axios API client
│       └── pages/
│           ├── Dashboard.jsx      # Stats, today's schedule
│           ├── Appointments.jsx   # List, create, status updates, follow-ups
│           ├── Doctors.jsx        # Doctor CRUD + availability editor
│           ├── Services.jsx       # Service catalog CRUD
│           ├── Patients.jsx       # Patient list with search
│           ├── Settings.jsx       # Business info, WhatsApp, Google Maps
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
└── docs/
    ├── architecture.md            # Multi-tenancy design, schema overview
    ├── deployment.md              # EC2 + Nginx + SSL setup guide
    ├── whatsapp-setup.md          # Meta Developer Console walkthrough
    └── api-reference.md           # API endpoint documentation
```


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
| Cron Worker | — | Reminders, health checks |
| Tenant Dashboard | 3000 | Clinic admin panel |
| Super Admin | 3001 | Platform admin panel |

### 3. Create platform admin

```bash
docker compose -f docker-compose.saas.yml exec backend node src/manage.js create-admin
```

### 4. Set up WhatsApp webhook

See [docs/whatsapp-setup.md](docs/whatsapp-setup.md) for the full walkthrough.

- **Webhook URL**: `https://api.yourdomain.com/webhook/whatsapp`
- **Verify Token**: same as `WA_VERIFY_TOKEN` in `.env`
- **Subscribe to**: `messages` field


## Deployment

Deployed on AWS EC2 with Nginx reverse proxy + Let's Encrypt SSL.

```bash
# Deploy updates
cd /home/ubuntu/wa-booking
git pull origin main
docker compose -f docker-compose.saas.yml up -d --build backend cron-worker tenant-dashboard super-admin
```

See [docs/deployment.md](docs/deployment.md) for full Nginx config, SSL setup, and domain configuration.


## WhatsApp Booking Flow

```
Patient sends "Hi"
  → Welcome message + 3 buttons: [Book] [My Appointments] [Cancel/Reschedule]

Patient taps "Book Appointment"
  → List of active doctors (with clinic filter if multi-branch)

Patient picks a doctor
  → Available services for that doctor

Patient picks a service
  → Next 10 available dates (respects schedule + blocked days)

Patient picks a date
  → Open time slots (respects breaks + existing bookings)

Patient picks a time
  → Confirmation summary with [Confirm] [Cancel] buttons

Patient confirms
  → Appointment created + confirmation message with Google Maps link
  → Reminders scheduled (24h + 1h before)
  → Doctor notified via WhatsApp
```


## Key Design Decisions

- **No AI** — Uses WhatsApp interactive buttons/lists. Reliable, fast, zero API cost per conversation.
- **Multi-tenant shared schema** — All tenants share one database. Every table has `tenant_id`. Simpler to operate than schema-per-tenant.
- **Timezone-aware** — Each tenant sets their timezone. The booking engine generates dates/slots in the tenant's local time.
- **Break-aware slots** — Doctors can set daily breaks and block specific dates. Slot generator skips these automatically.
- **Invite-code signup** — New tenants need an invite code. Controls growth during early stage.
- **Fault-isolated webhook** — One tenant's WhatsApp failure never affects another tenant. Circuit breaker pattern with automatic token invalidation detection.


## License

Proprietary. All rights reserved.
