# BookingBot — WhatsApp Appointment Booking SaaS

A **multi-tenant SaaS platform** that lets any business (clinics, salons, consultancies, etc.) accept appointment bookings via **WhatsApp AI chatbot** — complete with admin dashboards, billing, reminders, and payments.

> **Built to sell to 1000s of businesses.** Each customer signs up, connects their WhatsApp number, adds doctors/services, and their patients can book via WhatsApp instantly.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       YOUR CUSTOMERS                            │
│  (Clinics, Salons, Consultancies — each a "Tenant")             │
│                                                                 │
│  Tenant A ── WhatsApp #A ──┐                                    │
│  Tenant B ── WhatsApp #B ──┤    Central Webhook                 │
│  Tenant C ── WhatsApp #C ──┘    /webhook/whatsapp               │
└─────────────────────────────────────┬───────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND API (Node.js)                         │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐       │
│  │ Webhook  │  │   Auth   │  │ Tenant   │  │ Platform  │       │
│  │ Router   │  │ + Signup │  │ Admin    │  │ Admin     │       │
│  └────┬─────┘  └──────────┘  └──────────┘  └───────────┘       │
│       │                                                         │
│       ▼                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐       │
│  │ Booking  │  │    AI    │  │ WhatsApp │  │ Reminders │       │
│  │ Engine   │  │ Service  │  │ Service  │  │ (Cron)    │       │
│  └──────────┘  └──────────┘  └──────────┘  └───────────┘       │
└───────────────────────┬─────────────────────────────────────────┘
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
        ┌──────────┐ ┌──────┐ ┌─────────┐
        │PostgreSQL│ │Redis │ │Razorpay │
        │ (Multi-  │ │      │ │/Stripe  │
        │ Tenant)  │ │      │ │         │
        └──────────┘ └──────┘ └─────────┘

FRONTENDS:
  ┌───────────────────┐   ┌───────────────────┐
  │  Tenant Dashboard │   │  Super Admin Panel │
  │  (port 3000)      │   │  (port 3001)       │
  │  Your customers   │   │  YOU, the owner    │
  └───────────────────┘   └───────────────────┘
```

## Features

### For Your Customers (Tenant Businesses)
- **WhatsApp Booking Bot**: Patients book appointments via interactive buttons and menus
- **Smart Booking Flow**: Doctor → Service → Date → Time → Confirm (interactive WhatsApp buttons/lists)
- **Automated Reminders**: 24h and 1h before appointment
- **Rescheduling & Cancellation**: Patients manage bookings via WhatsApp chat
- **Payment Collection**: Razorpay integration for consultation fees
- **Admin Dashboard**: Web panel for managing appointments, doctors, patients, payments
- **Multi-doctor Support**: Each doctor has their own schedule and availability
- **Self-Service Onboarding**: Sign up → Connect WhatsApp → Add doctors → Go live

### For You (Platform Owner)
- **Multi-Tenant Architecture**: Securely isolated data per tenant
- **Subscription Billing**: 4 tiers (Trial / Starter / Professional / Enterprise)
- **Super Admin Panel**: Manage tenants, view analytics, control plans
- **Central Webhook**: Single WhatsApp webhook URL routes to correct tenant
- **Feature Gating**: Control which features each plan gets
- **Usage Limits**: Doctor count, appointment limits, service limits per plan
- **MRR Tracking**: Revenue analytics, plan distribution, growth metrics

## Tech Stack

| Component | Technology |
|---|---|
| Backend API | Node.js + Express |
| Database | PostgreSQL 16 (multi-tenant) |
| Cache / Queue | Redis 7 |
| WhatsApp API | Meta Cloud API (v21.0) |
| Tenant Frontend | React + Vite + Tailwind CSS |
| Super Admin Frontend | React + Vite + Tailwind + Recharts |
| Payments | Razorpay / Stripe |
| Auth | JWT (dual token system) |
| Infra | Docker Compose (7 services) |
| Automation | n8n (optional) |

## Project Structure

```
WA/
├── docker-compose.saas.yml        # Production Docker Compose (7 services)
├── docker-compose.yml             # Legacy single-clinic setup
│
├── db/
│   └── init-saas.sql              # Multi-tenant schema (18 tables, indexes, RLS)
│
├── backend/                       # Node.js API Server
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── index.js               # Express entry point (routes, middleware)
│       ├── cron.js                # Cron worker (reminders, trial expiration)
│       ├── db/pool.js             # PostgreSQL connection pool
│       ├── utils/logger.js        # Winston logger
│       ├── middleware/
│       │   ├── auth.js            # JWT auth (dual: platform + tenant tokens)
│       │   └── tenantContext.js   # Tenant loading, subscription checks, feature gates
│       ├── routes/
│       │   ├── auth.js            # Signup, Login (tenant + platform)
│       │   ├── onboarding.js      # Connect WhatsApp, setup business
│       │   ├── tenant.js          # Dashboard, appointments, doctors, patients, settings
│       │   ├── platform.js        # Super admin: tenants, analytics, plan management
│       │   ├── billing.js         # Plans, subscriptions, Razorpay webhooks
│       │   └── webhook.js         # Central WhatsApp webhook (routes to tenant)
│       └── services/
│           ├── whatsapp.js        # WhatsApp Cloud API wrapper (per-tenant)
│           ├── bookingEngine.js   # Menu-driven booking conversation state machine
│           └── reminders.js       # Multi-tenant reminder processor
│
├── tenant-dashboard/              # React Frontend — Each Business's Panel
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── src/
│       ├── App.jsx                # Router + sidebar layout
│       ├── api.js                 # API client (auth, CRUD, billing)
│       └── pages/
│           ├── Login.jsx          # Tenant user login
│           ├── Signup.jsx         # Self-service registration
│           ├── Onboarding.jsx     # 3-step wizard (WA → Business → Go live)
│           ├── Dashboard.jsx      # Stats, today's schedule, upcoming
│           ├── Appointments.jsx   # Table with status actions
│           ├── Doctors.jsx        # Card grid + add modal
│           ├── Patients.jsx       # Searchable table
│           └── Settings.jsx       # Business info, booking config, WA status
│
├── super-admin/                   # React Frontend — Platform Owner
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── src/
│       ├── App.jsx                # Router + sidebar layout
│       ├── api.js                 # Platform API client
│       └── pages/
│           ├── Login.jsx          # Platform admin login
│           ├── Dashboard.jsx      # 8 stat cards (tenants, MRR, subscriptions)
│           ├── Tenants.jsx        # Paginated tenant list + controls
│           ├── TenantDetail.jsx   # Tenant deep-dive + plan management
│           └── Analytics.jsx      # Charts (signups, revenue, plans)
│
└── docs/
    ├── architecture.md            # Deep-dive technical architecture
    ├── deployment.md              # Production deployment guide
    ├── api-reference.md           # Complete API documentation
    ├── whatsapp-setup.md          # WhatsApp Cloud API setup
    ├── n8n-setup.md               # n8n workflow automation
    └── google-calendar-setup.md   # Google Calendar integration
```

## Quick Start

### Prerequisites

- [Docker](https://www.docker.com/get-started/) + Docker Compose
- [ngrok](https://ngrok.com/) (for local development)
- Meta Developer Account (for WhatsApp API)
- Razorpay account (for billing)

### Step 1: Clone & Configure

```bash
cd WA

# Create environment file
cp .env.example .env    # Linux/Mac
copy .env.example .env  # Windows

# Edit .env — see docs/deployment.md for all variables
```

### Step 2: Start All Services

```bash
docker compose -f docker-compose.saas.yml up -d
```

| Service | URL | Description |
|---|---|---|
| Backend API | http://localhost:4000 | Central API + WhatsApp webhook |
| Tenant Dashboard | http://localhost:3000 | Your customers' admin panel |
| Super Admin | http://localhost:3001 | Your platform management |
| PostgreSQL | localhost:5432 | Multi-tenant database |
| Redis | localhost:6379 | Cache & rate limiting |
| n8n (optional) | http://localhost:5678 | Workflow automation |

### Step 3: Create Platform Admin

```sql
-- Connect to PostgreSQL and update the seed admin password
-- Generate hash: node -e "require('bcrypt').hash('YourSecurePass',10).then(h=>console.log(h))"
UPDATE platform_admins 
SET password_hash = '$2b$10$YOUR_REAL_HASH' 
WHERE email = 'superadmin@bookingbot.com';
```

### Step 4: Configure WhatsApp Webhook

1. Start ngrok: `ngrok http 4000`
2. Copy HTTPS URL
3. Set webhook URL in Meta Developer Console: `https://YOUR_NGROK_URL/webhook/whatsapp`
4. Set verify token (matches `WA_VERIFY_TOKEN` in .env)
5. Subscribe to `messages` webhook field

See [WhatsApp Setup Guide](docs/whatsapp-setup.md).

### Step 5: Test the Flow

1. Open **Super Admin** → http://localhost:3001 → Login
2. Open **Tenant Dashboard** → http://localhost:3000 → **Sign Up** as a new business
3. Complete **Onboarding** → Connect WhatsApp → Add doctors & services
4. Send "Hi" to the connected WhatsApp number → AI chatbot responds
5. Book an appointment through WhatsApp → See it appear in Tenant Dashboard

## Subscription Plans

| Plan | Monthly | Doctors | Appointments/mo | Features |
|---|---|---|---|---|
| **Trial** | Free (14 days) | 2 | 50 | AI chatbot, reminders |
| **Starter** | ₹999 | 3 | 200 | + Google Cal, payments |
| **Professional** | ₹2,499 | 10 | 1,000 | + analytics, branding, priority support |
| **Enterprise** | ₹7,999 | 50 | 10,000 | Everything unlimited |

## WhatsApp Conversation Flow

```
Patient: "Hi"
Bot: 👋 Welcome to Dr. Sharma's Clinic!
     How can I help you?
     [📅 Book Appointment]  [📋 My Appointments]  [ℹ️ Help]

Patient: [Taps "Book Appointment"]
Bot: Please select a doctor:
     • Dr. Priya Sharma — Dentist — ₹500
     • Dr. Amit Verma — Orthodontist — ₹800

Patient: [Selects "Dr. Priya Sharma"]
Bot: Choose a service:
     • Dental Checkup (30 min) — ₹500
     • Root Canal (60 min) — ₹3,000

Patient: [Selects "Dental Checkup"]
Bot: Available dates:
     • Mon, 10 Mar | Tue, 11 Mar | Wed, 12 Mar ...

Patient: [Selects "Tue, 11 Mar"]
Bot: Available slots:
     • 10:00 AM | 10:30 AM | 11:00 AM | 2:00 PM ...

Patient: [Selects "10:30 AM"]
Bot: ✅ Please confirm:
     👨‍⚕️ Dr. Priya Sharma
     🦷 Dental Checkup
     📅 Tue, 11 Mar — 10:30 AM
     💰 ₹500
     [✅ Confirm]  [❌ Cancel]

Patient: [Confirms]
Bot: ✅ Appointment booked! ID: #WA-1234
     You'll receive a reminder 24h before.
```

## Documentation

- [Architecture Deep-Dive](docs/architecture.md) — Multi-tenancy, security, data flow
- [Deployment Guide](docs/deployment.md) — Production setup, SSL, scaling
- [API Reference](docs/api-reference.md) — All endpoints documented
- [WhatsApp Setup](docs/whatsapp-setup.md) — Meta Cloud API configuration
- [Google Calendar Setup](docs/google-calendar-setup.md) — Calendar sync

## Environment Variables

See [docs/deployment.md](docs/deployment.md) for the complete list. Key variables:

```env
# Database
DB_USER=postgres
DB_PASSWORD=your-secure-password

# Auth
JWT_SECRET=your-random-64-char-string

# WhatsApp (Central Webhook)
WA_VERIFY_TOKEN=your-verify-token

# Billing
RAZORPAY_KEY_ID=rzp_...
RAZORPAY_KEY_SECRET=...

# URLs
APP_URL=https://yourdomain.com
CORS_ORIGINS=https://app.yourdomain.com,https://admin.yourdomain.com
```

## License

Proprietary — All rights reserved.
