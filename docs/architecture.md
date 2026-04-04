# Architecture

Technical overview of how the system is put together.

## Multi-Tenancy

Shared database, shared schema. Every business-data table has a `tenant_id` column. This is the simplest model to operate and the standard approach for SaaS platforms targeting many small businesses.

Tenant isolation is enforced at several layers:

1. **Middleware** (`tenantContext.js`) extracts `tenantId` from the JWT and sets it on `req`
2. **Every SQL query** filters by `WHERE tenant_id = $1`
3. **Row Level Security** is enabled on tenant-scoped tables
4. **JWT tokens** embed the tenant ID at login time

## Database Schema

### Platform Tables

| Table | Purpose |
|---|---|
| `tenants` | Registered businesses (includes timezone, settings JSONB, features JSONB) |
| `platform_admins` | Super admin users |
| `wa_number_registry` | Maps WhatsApp `phone_number_id` to `tenant_id` |
| `audit_log` | Security and compliance tracking |

### Tenant-Scoped Tables

| Table | Purpose |
|---|---|
| `tenant_users` | Staff accounts per business |
| `doctors` | Practitioners |
| `doctor_availability` | Weekly schedule (day_of_week ENUM + time slots) |
| `doctor_breaks` | Blocked dates, days off (`break_date`, `is_full_day`) |
| `services` | Service catalog |
| `doctor_services` | Links doctors to services |
| `patients` | Patient records per tenant (`wa_conversation_state` JSONB for booking flow) |
| `appointments` | Bookings |
| `chat_messages` | WhatsApp conversation log |
| `reminders` | Scheduled appointment reminders |

### Design Notes

- `patients` is tenant-scoped: the same phone number can be a patient at multiple businesses.
- `wa_conversation_state` on the patients table stores the booking flow state machine. No external state store needed.
- `settings` and `features` on the tenants table are JSONB columns, so we can add new config options without migrations.
- Day-of-week columns use PostgreSQL ENUMs for data integrity.

### Key Indexes

```sql
CREATE INDEX idx_appointments_tenant_date ON appointments(tenant_id, appointment_date);
CREATE INDEX idx_patients_tenant_phone ON patients(tenant_id, phone);
CREATE INDEX idx_reminders_pending ON reminders(remind_at) WHERE sent = false;
```

## Authentication

Two JWT token types, issued separately:

**Platform admin token** (24h expiry) — contains `type: "platform_admin"`, admin ID, and role.

**Tenant user token** (12h expiry) — contains `type: "tenant_user"`, user ID, tenant ID, and role.

The middleware checks the token type before allowing access to platform or tenant routes.

### Roles

| Role | Scope | Access |
|---|---|---|
| `super_admin` | Platform | Full platform access |
| `owner` | Tenant | Full access to their business |
| `admin` | Tenant | Manage doctors, services, appointments |
| `staff` | Tenant | View and update appointments |
| `doctor` | Tenant | View own appointments |

### Middleware Chain (Tenant Routes)

```
Request
  -> authTenant (verify JWT, extract tenantId)
  -> loadTenantContext (load tenant profile, check is_active)
  -> Route Handler
```

## WhatsApp Webhook Routing

One webhook endpoint serves all tenants. This is the key piece of the multi-tenant design.

```
Meta POSTs to: https://api.yourdomain.com/api/webhook

1. Respond 200 immediately (Meta requires < 20s response)
2. Extract phone_number_id from the webhook payload
3. Look up the tenant from wa_number_registry
4. Load tenant profile and WA credentials
5. Route to BookingEngine with tenant context
6. BookingEngine sends replies using that tenant's own WA access token
```

Each tenant uses their own WhatsApp Business Account. The platform just routes messages. One tenant's WA issues don't affect others.

### How a Tenant Connects WhatsApp

1. Tenant signs up and enters onboarding
2. Creates a WhatsApp Business Account in Meta Business Manager
3. Gets their `phone_number_id`, `waba_id`, and `access_token`
4. Enters these in the onboarding wizard
5. Backend validates against Meta API, then saves to `wa_number_registry`
6. All incoming messages to that number now route to this tenant

## Booking Engine

Menu-driven state machine. No AI, no NLP. Patients interact through WhatsApp buttons and interactive lists.

### Flow

```
idle -> doctor_selection -> service_selection -> date_picker -> time_picker -> confirmation -> booked
```

- Skips doctor selection if tenant has only one doctor
- Date picker respects doctor availability, blocked dates, and the tenant's booking window setting
- Time slots are generated from doctor availability, checking for conflicts with existing appointments
- Uses the tenant's configured timezone for all date/time calculations
- Auto-creates 24h and 1h reminders on successful booking

### Intent Matching

```
Button IDs: book, status, help, cancel, reschedule
Keyword fallback: "book" starts booking, "cancel" shows cancellable appointments, etc.
Anything unrecognized: shows the main menu
```

## Cron Worker

Separate Node.js process running `cron.js` with the same codebase as the backend but a different entrypoint.

| Job | Interval | What it does |
|---|---|---|
| Reminder processor | Every 60s | Queries pending reminders across all tenants, sends WhatsApp messages using each tenant's credentials |

## Docker Services

```
docker-compose.saas.yml
  postgres (16-alpine)      -- healthcheck: pg_isready
  redis (7-alpine)          -- healthcheck: redis-cli ping
  backend (Node 20)         -- depends on postgres, redis
  cron-worker (same image)  -- different entrypoint: cron.js
  tenant-dashboard (nginx)  -- serves React build, proxies /api to backend
  super-admin (nginx)       -- serves React build, proxies /api to backend
```

Both frontends use an internal nginx config that proxies `/api` requests to `backend:4000`, so the browser never talks to the backend directly. This avoids CORS issues entirely.

## Security

| Layer | How |
|---|---|
| Transport | HTTPS via Nginx + Let's Encrypt |
| Headers | Helmet.js (HSTS, CSP, X-Frame-Options, etc.) |
| Rate limiting | express-rate-limit on API and webhook routes |
| Auth | JWT with bcrypt passwords (10 rounds) |
| Data isolation | tenant_id filtering + Row Level Security |
| Input validation | Joi on all request bodies |
| CORS | Whitelist-based, though frontends proxy so it rarely matters |

## Scaling Notes

For the first few hundred tenants, a single 2-4 GB VPS handles everything. If you need to scale:

- Backend is stateless, so you can run multiple instances behind a load balancer
- Cron worker should stay as a single instance (or use Redis-based locking)
- Move to managed PostgreSQL (RDS, Cloud SQL) for easier backups and read replicas
- Put frontends behind a CDN
