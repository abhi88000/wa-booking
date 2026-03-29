# Architecture Deep-Dive

## Multi-Tenancy Model

BookingBot uses a **shared database, shared schema** multi-tenancy approach. All tenants share the same PostgreSQL database, with a `tenant_id` column on every business-data table.

### Why Shared Schema?

| Approach | Pros | Cons |
|---|---|---|
| **Shared schema** (ours) | Simple ops, easy analytics, cost-effective | Need strict tenant isolation in code |
| Schema-per-tenant | Strong isolation | Complex migrations, connection limits |
| Database-per-tenant | Maximum isolation | Most expensive, operational overhead |

For a SaaS targeting 1000s of small businesses, shared schema is the industry standard (Salesforce, HubSpot, Shopify all use this).

### Data Isolation

Every tenant-scoped query **must** filter by `tenant_id`. This is enforced at multiple layers:

1. **Middleware Layer** (`tenantContext.js`) — Sets `req.tenantId` from JWT token
2. **Route Layer** — Every SQL query includes `WHERE tenant_id = $1`
3. **Database Layer** — Row Level Security (RLS) enabled on all tenant tables
4. **JWT Layer** — Tenant ID embedded in JWT token at login

```
Request → JWT Decode → Extract tenantId → Load tenant profile → Check subscription → Execute query (filtered)
```

## Database Schema (18 Tables)

### Platform Tables (your data)

| Table | Purpose |
|---|---|
| `tenants` | Every registered business |
| `subscriptions` | Each tenant's subscription details |
| `plans` | Available pricing plans |
| `platform_admins` | Your team (super admin users) |
| `wa_number_registry` | Maps WhatsApp phone_number_id → tenant |
| `invoices` | Subscription invoices |
| `audit_log` | Security and compliance tracking |

### Tenant-Scoped Tables (each business's data)

| Table | Purpose |
|---|---|
| `tenant_users` | Staff accounts for each business |
| `doctors` | Practitioners / service providers |
| `doctor_availability` | Weekly schedule (day + time slots) |
| `doctor_breaks` | Holidays, breaks, days off |
| `services` | Service catalog (checkup, consultation, etc.) |
| `doctor_services` | Which doctor offers which service |
| `patients` | Customer/patient records (per tenant) |
| `appointments` | Bookings |
| `payments` | Transaction records |
| `chat_messages` | WhatsApp conversation log |
| `reminders` | Scheduled appointment reminders |

### Key Design Decisions

- **`patients` table is tenant-scoped**: Same phone number can exist as a patient at multiple businesses
- **`wa_conversation_state` (JSONB)**: Stores booking flow state per patient — no external state store needed
- **`features` and `settings` (JSONB on tenants)**: Flexible feature flags and business settings without schema changes
- **ENUMs over strings**: `appointment_status`, `payment_status`, `subscription_plan` etc. — better data integrity

### Indexes (Performance-Critical)

Every tenant-scoped table has a composite index on `(tenant_id, ...)` for the most common queries:

```sql
CREATE INDEX idx_appointments_tenant_date ON appointments(tenant_id, appointment_date);
CREATE INDEX idx_patients_tenant_phone ON patients(tenant_id, phone);
CREATE INDEX idx_reminders_pending ON reminders(remind_at) WHERE sent = false;  -- Partial index
```

## Authentication System

### Dual JWT Architecture

Two separate token types prevent cross-access:

```
Platform Admin Token (24h expiry):
{
  "type": "platform_admin",
  "id": "uuid",
  "role": "super_admin"
}

Tenant User Token (12h expiry):
{
  "type": "tenant_user",
  "id": "uuid",
  "tenantId": "uuid",
  "role": "owner|admin|staff|doctor"
}
```

### Middleware Chain (Tenant Routes)

```
Request
  → authTenant (verify JWT, check type === 'tenant_user', set req.tenantId)
  → loadTenantContext (load tenant profile, check is_active, check subscription)
  → requireFeature('ai_chatbot') (optional: check feature flag)
  → checkAppointmentLimit (optional: check plan quota)
  → Route Handler
```

### Role-Based Access

| Role | Scope | Can Do |
|---|---|---|
| `super_admin` | Platform | Everything |
| `owner` | Tenant | Full access to their business |
| `admin` | Tenant | Manage doctors, services, appointments |
| `staff` | Tenant | View and update appointments |
| `doctor` | Tenant | View own appointments |

## WhatsApp Webhook Routing

The most critical piece of the SaaS architecture — one webhook endpoint serves ALL tenants:

```
Meta sends POST to: https://yourdomain.com/webhook/whatsapp

Step 1: Respond 200 immediately (Meta requires < 20s response)
Step 2: Extract phone_number_id from webhook payload
Step 3: Look up tenant from wa_number_registry table
Step 4: Load tenant profile + credentials
Step 5: Route to BookingEngine with tenant context
Step 6: BookingEngine sends replies using tenant's own WA credentials
```

### How Each Tenant Gets Their Own WhatsApp Number

1. Tenant signs up and enters onboarding
2. Goes to Meta Business Manager, creates WhatsApp Business Account
3. Gets `phone_number_id`, `waba_id`, and `access_token`
4. Enters credentials in onboarding wizard
5. Backend validates credentials against Meta API
6. Saves to `wa_number_registry` (maps phone_number_id → tenant_id)
7. All incoming messages from that number now route to this tenant

### WhatsApp API Usage

Each tenant uses their **own** WhatsApp Business Account and access token. The platform just routes and processes messages. This means:
- Each tenant pays Meta for their own WhatsApp usage
- No single point of failure — one tenant's WA issues don't affect others
- Tenants can use their existing phone numbers

## AI Booking Engine

### State Machine Design

Each patient has a conversation state stored in `patients.wa_conversation_state` (JSONB):

```
new/idle → greeting → awaiting_doctor → awaiting_service → awaiting_date → awaiting_time → awaiting_confirm → confirmed
```

The state machine handles:
- **Intent Detection**: OpenAI GPT-4o-mini with keyword fallback
- **Doctor Selection**: Skips if tenant has only 1 doctor
- **Service Selection**: Shows per-doctor services
- **Date Picker**: Respects doctor availability, breaks, booking window
- **Time Slots**: 30-min intervals, checks existing appointment conflicts
- **Confirmation**: Auto-confirm if tenant setting enabled
- **Reminders**: Automatically creates 24h + 1h reminders on booking

### AI Intent Classification

```
System Prompt: "You are an assistant for {business_name} ({business_type}).
Classify the user's intent as one of: greeting, start_booking, check_status, cancel, reschedule, help"

Fallback: Keyword matching (book/appointment → start_booking, cancel → cancel, etc.)
```

## Subscription & Billing

### Plan Enforcement

Checked at middleware level on every tenant request:

```javascript
// tenantContext.js
if (subscription.status === 'trial' && subscription.trial_ends_at < now) {
  return res.status(402).json({ error: 'Trial expired', upgrade: true });
}
```

### Limits Checked

| Limit | Where Checked |
|---|---|
| Max doctors | `POST /api/tenant/doctors` |
| Max appointments/month | `BookingEngine` (before booking) |
| Features (ai_chatbot, etc.) | `requireFeature()` middleware |
| Subscription active | `loadTenantContext()` (every request) |

### Razorpay Integration

```
Tenant clicks "Upgrade" → POST /api/billing/subscribe/razorpay
→ Creates Razorpay subscription → Returns payment link
→ Tenant pays → Razorpay sends webhook → POST /api/billing/webhook/razorpay
→ Update subscription status, plan limits, features
```

## Cron Worker

Separate Node.js process (`cron.js`) running alongside the API server:

| Job | Interval | Action |
|---|---|---|
| Reminder Processor | Every 60 seconds | Query pending reminders, send WhatsApp messages |
| Trial Expiration | Every 24 hours | Expire overdue trial subscriptions |

The cron worker queries across ALL tenants and uses each tenant's own WhatsApp credentials for sending.

## Docker Architecture

```
┌─── docker-compose.saas.yml ────────────────────────────────┐
│                                                              │
│  postgres (16-alpine)  ←── healthcheck: pg_isready           │
│  redis (7-alpine)      ←── healthcheck: redis-cli ping       │
│                                                              │
│  backend (Node 20)     ←── depends_on: postgres, redis       │
│  cron-worker (same image, different entrypoint)              │
│                                                              │
│  tenant-dashboard (nginx)  ←── depends_on: backend           │
│  super-admin (nginx)       ←── depends_on: backend           │
│                                                              │
│  n8n (optional)        ←── depends_on: postgres              │
│                                                              │
│  Volumes: pgdata, redisdata, n8ndata                         │
└──────────────────────────────────────────────────────────────┘
```

## Security Considerations

| Layer | Protection |
|---|---|
| Transport | HTTPS required in production |
| Headers | Helmet.js (HSTS, CSP, etc.) |
| Rate Limiting | 500 req/15min (API), 1000 req/min (webhook) |
| Auth | JWT with short expiry, bcrypt passwords (10 rounds) |
| Data | Tenant isolation via tenant_id + RLS |
| Input | Joi validation on all inputs |
| Secrets | WA access tokens stored encrypted, masked in API responses |
| CORS | Whitelist-based origin control |

## Scaling Guide

### Vertical (Quick Wins)
- Increase PostgreSQL `shared_buffers` and `work_mem`
- Increase backend `DB_POOL_MAX` connections
- Add Redis caching for tenant profile lookups

### Horizontal (Growth Phase)
- **Backend**: Run multiple instances behind a load balancer (stateless)
- **Database**: Read replicas for dashboard queries
- **Cron**: Single instance (use Redis lock for coordination)
- **Frontend**: CDN for static assets

### Database Optimization (1000+ Tenants)
- Partition `appointments` table by `tenant_id` range
- Partition `chat_messages` by date (high volume)
- Consider PgBouncer for connection pooling
- Move to dedicated PostgreSQL (RDS, Cloud SQL)
