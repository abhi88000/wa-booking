# API Reference

Base URL: `https://api.yourdomain.com` (or `http://localhost:4000` for local dev)

---

## Health Check

### `GET /health`

No auth required.

```json
{ "status": "ok", "timestamp": "2025-03-10T12:00:00.000Z" }
```

---

## Auth

### `POST /api/auth/signup`

Register a new business. Requires a valid invite code.

```json
{
  "businessName": "Dr. Sharma Dental Clinic",
  "businessType": "clinic",
  "email": "dr.sharma@example.com",
  "phone": "+919876543210",
  "ownerName": "Dr. Ravi Sharma",
  "password": "securepass123",
  "inviteCode": "FZM-8K2X-NP4R-2026",
  "timezone": "Asia/Kolkata"
}
```

Returns `201` with JWT token, tenant info, and user info.

### `POST /api/auth/login`

```json
{ "email": "dr.sharma@example.com", "password": "securepass123" }
```

Returns JWT token + tenant and user objects.

### `POST /api/auth/platform/login`

Super admin login.

```json
{ "email": "admin@futurezminds.in", "password": "yourpassword" }
```

---

## Onboarding

All routes require tenant auth: `Authorization: Bearer <token>`

### `GET /api/onboarding/status`

Returns current onboarding progress (WhatsApp connected, doctors added, etc).

### `POST /api/onboarding/connect-whatsapp`

Validates WhatsApp credentials against Meta API and registers the number.

```json
{
  "phoneNumberId": "123456789012345",
  "businessAccountId": "987654321098765",
  "accessToken": "EAAG...",
  "displayPhoneNumber": "+919876543210"
}
```

### `POST /api/onboarding/setup-business`

Bulk-creates doctors with availability and services in one call.

### `POST /api/onboarding/complete`

Marks onboarding as done, sets tenant status to `active`.

---

## Tenant API

All routes require tenant auth. Prefix: `/api/tenant`

### Dashboard

**`GET /api/tenant/dashboard`** — Stats (today's appointments, upcoming, total patients, active doctors) plus upcoming appointment list.

### Appointments

**`GET /api/tenant/appointments`** — List with filters: `status`, `date`, `doctor_id`, `page`, `limit`

**`PATCH /api/tenant/appointments/:id/status`** — Update status: `confirmed`, `completed`, `cancelled`, `no_show`

### Doctors

**`GET /api/tenant/doctors`** — All doctors with availability schedules.

**`POST /api/tenant/doctors`** — Add a doctor with availability slots.

**`PUT /api/tenant/doctors/:id`** — Update doctor info.

### Availability

**`GET /api/tenant/availability`** — Returns doctor availability + tenant timezone.

**`PUT /api/tenant/availability`** — Save availability for the next 10 days, blocked dates, and timezone.

### Services

**`GET /api/tenant/services`** — List all services.

**`POST /api/tenant/services`** — Add a service: `{ "name": "Checkup", "duration": 30, "price": 500 }`

### Patients

**`GET /api/tenant/patients`** — Search by name or phone. Paginated.

**`GET /api/tenant/patients/:id`** — Patient detail with appointment history.

### Settings

**`GET /api/tenant/settings`** — Tenant profile, features, WA status.

**`PATCH /api/tenant/settings`** — Update business info and booking settings (booking window, max bookings, auto-confirm, welcome message).

---

## Platform Admin API

All routes require platform admin auth. Prefix: `/api/platform`

### `GET /api/platform/dashboard`

Returns: total tenants, active tenants, live (onboarded) tenants, new signups (30d), appointments (24h).

### `GET /api/platform/tenants`

List tenants with filters: `status`, `search`, `page`, `limit`

### `GET /api/platform/tenants/:id`

Full tenant detail with usage stats.

### `PATCH /api/platform/tenants/:id/toggle`

Activate or deactivate a tenant.

### `POST /api/platform/tenants/:id/reset-password`

Reset tenant owner's password. Body: `{ "newPassword": "..." }`

### `GET /api/platform/analytics`

Signups per day (30d) and top tenants by appointment count.

### `GET /api/platform/health`

Health status for all active tenants.

---

## WhatsApp Webhook

### `GET /api/webhook`

Meta verification endpoint. Validates `hub.verify_token`, returns `hub.challenge`.

### `POST /api/webhook`

Receives incoming WhatsApp messages for all tenants. Always responds `200` immediately. Routes to the correct tenant via `phone_number_id` lookup.

---

## Error Format

```json
{ "error": "Human-readable message" }
```

| Status | Meaning |
|---|---|
| `400` | Validation error |
| `401` | Missing or invalid token |
| `403` | Insufficient permissions or account deactivated |
| `404` | Not found |
| `409` | Conflict (duplicate email, phone already registered, etc.) |
| `429` | Rate limit exceeded |
| `500` | Server error |
