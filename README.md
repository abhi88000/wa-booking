# WA Booking — WhatsApp Appointment Booking Platform

A multi-tenant appointment booking system that lets clinics and businesses accept bookings through WhatsApp. Built with Node.js, React, PostgreSQL, and Docker.

Each business (tenant) signs up, connects their WhatsApp number, adds their doctors and availability, and patients can book appointments directly through WhatsApp using interactive buttons and menus. No AI involved — the conversation flow is entirely menu-driven.


## How It Works

1. A clinic owner signs up at `book.futurezminds.in` and goes through a 3-step onboarding (connect WhatsApp, add doctors, set availability)
2. Patients message the clinic's WhatsApp number
3. The bot walks them through selecting a doctor, picking a date, choosing a time slot, and confirming
4. The appointment shows up in the clinic's dashboard in real-time
5. Automated reminders go out 24h and 1h before the appointment


## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js, Express, PostgreSQL 16, Redis 7 |
| Frontend (Tenant) | React, Vite, Tailwind CSS |
| Frontend (Admin) | React, Vite, Tailwind CSS, Recharts |
| WhatsApp | Meta Cloud API v21.0 |
| Auth | JWT (separate tokens for tenants and platform) |
| Infra | Docker Compose, Nginx, Let's Encrypt |


## Project Layout

```
├── docker-compose.saas.yml     # Production compose (6 services)
├── .env.example                # Environment template
├── db/
│   └── init-saas.sql           # Schema (18 tables, indexes)
├── backend/
│   └── src/
│       ├── index.js            # Express server
│       ├── cron.js             # Reminder + health jobs
│       ├── routes/
│       │   ├── auth.js         # Signup, login
│       │   ├── tenant.js       # Dashboard, doctors, appointments, patients, services, settings
│       │   ├── platform.js     # Super admin endpoints
│       │   └── webhook.js      # WhatsApp message intake
│       └── services/
│           ├── bookingEngine.js  # Conversation state machine
│           ├── whatsapp.js       # WhatsApp Cloud API client
│           └── reminders.js      # Appointment reminder sender
├── tenant-dashboard/           # Clinic owner's web panel (port 3000)
│   └── src/pages/
│       ├── Dashboard.jsx       # Stats, today's schedule
│       ├── Appointments.jsx    # List, create, status updates
│       ├── Doctors.jsx         # Add/edit doctors, availability editor
│       ├── Services.jsx        # Service catalog CRUD
│       ├── Patients.jsx        # Patient list with detail drawer
│       └── Settings.jsx        # Business info, WhatsApp status
├── super-admin/                # Platform admin panel (port 3001)
│   └── src/pages/
│       ├── Dashboard.jsx       # Tenant count, active stats
│       ├── Tenants.jsx         # Tenant list with activate/deactivate
│       ├── TenantDetail.jsx    # Deep view, password reset
│       ├── Analytics.jsx       # Signup trends, top tenants
│       └── Health.jsx          # System health monitoring
└── docs/
    ├── deployment.md           # Full production setup guide
    ├── architecture.md         # Multi-tenancy, schema, auth
    ├── whatsapp-setup.md       # Meta Developer Console walkthrough
    └── api-reference.md        # Endpoint documentation
```


## Setup

### Requirements

- Docker and Docker Compose
- A domain with DNS configured
- Meta Developer account (for WhatsApp API)

### 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:
```
JWT_SECRET=<any random 40+ character string>
WA_VERIFY_TOKEN=<any string — same goes in Meta Console>
DB_USER=postgres
DB_PASSWORD=postgres
```

### 2. Start services

```bash
docker compose -f docker-compose.saas.yml up -d
```

This starts PostgreSQL, Redis, the backend API, cron worker, tenant dashboard, and super admin panel.

| Service | Port | URL |
|---|---|---|
| Tenant Dashboard | 3000 | http://localhost:3000 |
| Super Admin | 3001 | http://localhost:3001 |
| Backend API | 4000 | http://localhost:4000 |

### 3. Create platform admin

```bash
docker compose -f docker-compose.saas.yml exec backend node src/manage.js create-admin
```

Or via SQL:
```sql
INSERT INTO platform_admins (email, password_hash, name, role)
VALUES ('admin@yourdomain.com', crypt('yourpassword', gen_salt('bf', 10)), 'Admin', 'super_admin');
```

### 4. Set up WhatsApp webhook

See [docs/whatsapp-setup.md](docs/whatsapp-setup.md) for the full walkthrough. The short version:

- Webhook URL: `https://yourdomain.com/api/webhook`
- Verify Token: same as `WA_VERIFY_TOKEN` in your `.env`
- Subscribe to the `messages` field


## Production Deployment

The system is currently deployed on AWS EC2 with:

- Nginx reverse proxy with SSL (Let's Encrypt)
- `book.futurezminds.in` — Tenant dashboard
- `hub.futurezminds.in` — Super admin panel
- `api.futurezminds.in` — Backend API

To deploy updates:
```bash
cd /home/ubuntu/wa-booking
git pull origin main
docker compose -f docker-compose.saas.yml up -d --build backend cron-worker tenant-dashboard super-admin
```


## Booking Flow (WhatsApp)

```
Patient sends "Hi"
  -> Bot replies with welcome message + menu buttons
  -> [Book Appointment] [My Appointments] [Help]

Patient taps "Book Appointment"
  -> Shows list of active doctors

Patient picks a doctor
  -> Shows available services

Patient picks a service
  -> Shows next 10 available dates (respects doctor schedule + blocked days)

Patient picks a date
  -> Shows open time slots (respects breaks + existing bookings)

Patient picks a time
  -> Confirmation summary with [Confirm] [Cancel] buttons

Patient confirms
  -> Appointment created, confirmation message sent
  -> Reminders scheduled for 24h and 1h before
```


## Key Design Decisions

- **No AI**: The booking flow uses WhatsApp interactive buttons and list messages. Reliable, fast, no API costs.
- **Multi-tenant shared schema**: All tenants share one database. Every table has a `tenant_id` column. Simpler to operate than schema-per-tenant.
- **Timezone-aware**: Each tenant has a timezone setting. The booking engine generates dates in the tenant's local time.
- **Break-aware slot generation**: Doctors can set daily breaks (e.g., lunch) and block specific dates. The slot generator skips these automatically.
- **Invite-code signup**: New tenants need an invite code to register. Prevents spam signups during early stage.


## License

Proprietary. All rights reserved.
