# API Reference

Base URL: `http://localhost:4000` (development) or `https://api.yourdomain.com` (production)

---

## Health Check

### `GET /health`

No authentication required.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-03-10T12:00:00.000Z"
}
```

---

## Authentication

### `POST /api/auth/signup` — Register New Business

Creates a new tenant + owner user + 14-day trial subscription.

**Body:**
```json
{
  "businessName": "Dr. Sharma Dental Clinic",
  "businessType": "clinic",           // clinic|salon|spa|consulting|dental|veterinary|physiotherapy|other
  "email": "dr.sharma@example.com",
  "phone": "+919876543210",
  "ownerName": "Dr. Ravi Sharma",
  "password": "securepass123",
  "city": "Mumbai",
  "country": "IN",                     // optional, default: "IN"
  "timezone": "Asia/Kolkata"           // optional, default: "Asia/Kolkata"
}
```

**Response (201):**
```json
{
  "message": "Account created successfully! Your 14-day free trial has started.",
  "token": "eyJ...",
  "tenant": {
    "id": "uuid",
    "businessName": "Dr. Sharma Dental Clinic",
    "slug": "dr-sharma-dental-clinic",
    "onboardingStatus": "registered"
  },
  "user": { "id": "uuid", "email": "dr.sharma@example.com", "name": "Dr. Ravi Sharma", "role": "owner" }
}
```

---

### `POST /api/auth/login` — Tenant User Login

**Body:**
```json
{
  "email": "dr.sharma@example.com",
  "password": "securepass123"
}
```

**Response (200):**
```json
{
  "token": "eyJ...",
  "tenant": { "id": "uuid", "businessName": "Dr. Sharma Dental Clinic" },
  "user": { "id": "uuid", "email": "...", "name": "...", "role": "owner" }
}
```

---

### `POST /api/auth/platform/login` — Super Admin Login

**Body:**
```json
{
  "email": "superadmin@bookingbot.com",
  "password": "your-password"
}
```

**Response (200):**
```json
{
  "token": "eyJ...",
  "admin": { "id": "uuid", "email": "...", "name": "Super Admin", "role": "super_admin" }
}
```

---

## Onboarding

All onboarding routes require tenant authentication.

**Header:** `Authorization: Bearer <tenant_token>`

### `GET /api/onboarding/status`

Returns current onboarding progress.

**Response:**
```json
{
  "onboardingStatus": "whatsapp_pending",
  "businessName": "Dr. Sharma Dental Clinic",
  "waStatus": "disconnected",
  "doctorCount": 0,
  "serviceCount": 0
}
```

---

### `POST /api/onboarding/connect-whatsapp`

Validates WhatsApp credentials against Meta API and registers the number.

**Body:**
```json
{
  "phoneNumberId": "123456789012345",
  "businessAccountId": "987654321098765",
  "accessToken": "EAAG...",
  "displayPhoneNumber": "+919876543210"
}
```

**Response (200):**
```json
{
  "message": "WhatsApp connected successfully!",
  "waStatus": "connected"
}
```

**Errors:**
- `400` — Invalid credentials (Meta API verification failed)
- `409` — Phone number already registered to another tenant

---

### `POST /api/onboarding/setup-business`

Bulk-inserts doctors, availability, and services.

**Body:**
```json
{
  "doctors": [
    {
      "name": "Dr. Priya Sharma",
      "specialization": "Dentist",
      "consultationFee": 500,
      "slotDuration": 30,
      "availability": [
        { "day": "monday", "startTime": "09:00", "endTime": "17:00" },
        { "day": "wednesday", "startTime": "09:00", "endTime": "13:00" }
      ]
    }
  ],
  "services": [
    { "name": "Dental Checkup", "duration": 30, "price": 500 },
    { "name": "Root Canal", "duration": 60, "price": 3000 }
  ]
}
```

---

### `POST /api/onboarding/complete`

Marks onboarding as finished. Changes `onboarding_status` to `active`.

---

## Tenant Admin API

All routes prefixed with `/api/tenant`. Requires tenant auth + active subscription.

**Header:** `Authorization: Bearer <tenant_token>`

### Dashboard

#### `GET /api/tenant/dashboard`

**Response:**
```json
{
  "stats": {
    "upcoming": 12,
    "today": 5,
    "total_patients": 150,
    "month_appointments": 45,
    "month_revenue": 22500
  },
  "upcoming": [...],       // Next 10 upcoming appointments
  "today": [...],          // Today's schedule
  "plan": "starter",
  "limits": {
    "maxDoctors": 3,
    "maxAppointmentsMonth": 200,
    "usedAppointmentsMonth": 45
  }
}
```

---

### Appointments

#### `GET /api/tenant/appointments`

**Query params:** `status`, `date`, `doctor_id`, `page` (default 1), `limit` (default 20)

**Response:**
```json
{
  "appointments": [
    {
      "id": "uuid",
      "appointment_date": "2025-03-10",
      "start_time": "10:00:00",
      "end_time": "10:30:00",
      "status": "confirmed",
      "doctor_name": "Dr. Priya Sharma",
      "patient_name": "Rahul Kumar",
      "patient_phone": "+919876543210",
      "service_name": "Dental Checkup"
    }
  ],
  "total": 45,
  "page": 1,
  "totalPages": 3
}
```

#### `PATCH /api/tenant/appointments/:id/status`

**Body:** `{ "status": "confirmed" }` — valid: `confirmed`, `completed`, `cancelled`, `no_show`

---

### Doctors

#### `GET /api/tenant/doctors`

Returns all doctors with their availability schedules.

#### `POST /api/tenant/doctors` (owner/admin only)

**Body:**
```json
{
  "name": "Dr. Amit Verma",
  "specialization": "Orthodontist",
  "phone": "+919876543210",
  "email": "amit@clinic.com",
  "consultationFee": 800,
  "slotDuration": 30,
  "availability": [
    { "day": "monday", "startTime": "09:00", "endTime": "17:00" },
    { "day": "tuesday", "startTime": "09:00", "endTime": "17:00" }
  ]
}
```

**Error (429):** `{ "error": "Doctor limit reached (3). Upgrade your plan.", "upgrade": true }`

#### `PUT /api/tenant/doctors/:id` (owner/admin only)

Partial update — any field from POST body.

---

### Services

#### `GET /api/tenant/services`
#### `POST /api/tenant/services` (owner/admin only)

**Body:** `{ "name": "Root Canal", "description": "...", "duration": 60, "price": 3000 }`

---

### Patients

#### `GET /api/tenant/patients`

**Query params:** `search` (name/phone), `page`, `limit`

---

### Payments

#### `GET /api/tenant/payments`

**Query params:** `status`, `page`, `limit`

---

### Chat Messages

#### `GET /api/tenant/chats/:patientId`

Returns WhatsApp conversation history for a patient, ordered chronologically.

---

### Settings

#### `GET /api/tenant/settings`

Returns tenant profile, features, settings, WA status.

#### `PATCH /api/tenant/settings`

**Body (partial update):**
```json
{
  "businessName": "New Name",
  "phone": "+91...",
  "address": "...",
  "settings": {
    "booking_window_days": 14,
    "max_bookings_per_day": 50,
    "auto_confirm": true,
    "welcome_message": "Welcome! How can I help?"
  }
}
```

---

### Team Management

#### `GET /api/tenant/team` (owner/admin only)

Lists all staff members for this tenant.

#### `POST /api/tenant/team` (owner/admin only)

**Body:** `{ "name": "Staff Name", "email": "staff@clinic.com", "password": "temppass", "role": "staff" }`

---

## Platform Admin API (Super Admin)

All routes prefixed with `/api/platform`. Requires platform admin auth.

**Header:** `Authorization: Bearer <platform_token>`

### `GET /api/platform/dashboard`

**Response:**
```json
{
  "stats": {
    "totalTenants": 150,
    "activeTenants": 120,
    "liveTenants": 85,
    "newTenantsThisWeek": 12,
    "paidSubscriptions": 60,
    "trialSubscriptions": 90,
    "mrr": 142500,
    "todayAppointments": 320
  }
}
```

### `GET /api/platform/tenants`

**Query params:** `search`, `status` (active/inactive), `plan`, `page`, `limit`

### `GET /api/platform/tenants/:id`

Full tenant detail with subscription, usage stats.

### `PATCH /api/platform/tenants/:id/toggle`

Activate/deactivate a tenant.

### `PATCH /api/platform/tenants/:id/plan`

**Body:** `{ "plan": "professional", "maxDoctors": 10, "maxAppointmentsMonth": 1000, "features": {...} }`

### `GET /api/platform/analytics`

Returns signups per day, revenue per month, plan distribution, top tenants.

---

## Billing API

### `GET /api/billing/plans` (public)

Returns all available plans with pricing and features.

### `GET /api/billing/subscription` (tenant auth)

Returns current subscription details.

### `POST /api/billing/subscribe/razorpay` (tenant auth)

**Body:** `{ "planName": "professional", "billingCycle": "monthly" }`

Creates a Razorpay subscription and returns payment link.

### `POST /api/billing/webhook/razorpay` (no auth — webhook)

Handles Razorpay subscription events (activated, charged, cancelled, failed).

### `GET /api/billing/invoices` (tenant auth)

Returns invoice history.

---

## WhatsApp Webhook

### `GET /webhook/whatsapp`

Meta verification endpoint. Validates `hub.verify_token` and returns `hub.challenge`.

### `POST /webhook/whatsapp`

Receives all incoming WhatsApp messages for ALL tenants. Always returns `200` immediately. Routes to correct tenant via `phone_number_id` lookup in `wa_number_registry`.

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Human-readable error message"
}
```

| Status | Meaning |
|---|---|
| `400` | Validation error (check request body) |
| `401` | Missing or invalid auth token |
| `402` | Subscription expired — upgrade required |
| `403` | Account deactivated or insufficient permissions |
| `404` | Resource not found |
| `409` | Conflict (duplicate email, phone number, etc.) |
| `429` | Rate limit or plan limit exceeded |
| `500` | Internal server error |
