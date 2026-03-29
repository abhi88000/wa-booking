# Google Calendar Setup Guide

## Prerequisites

- A Google account (the one you want calendar events on)
- The clinic's Google Calendar (can be your primary or a separate one)

## Step 1: Create Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com/)
2. Click the project dropdown (top left) → **New Project**
3. Name: `Clinic Booking` → **Create**
4. Select the project

## Step 2: Enable Google Calendar API

1. Go to **APIs & Services** → **Library**
2. Search for **"Google Calendar API"**
3. Click it → **Enable**

## Step 3: Create OAuth2 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. If prompted, configure the **OAuth consent screen** first:
   - User Type: **External** (or Internal if using Google Workspace)
   - App name: `Clinic Booking`
   - User support email: your email
   - Developer email: your email
   - Scopes: Add `https://www.googleapis.com/auth/calendar`
   - Test users: Add your Google email
   - **Save**
4. Back to Credentials → **+ CREATE CREDENTIALS** → **OAuth client ID**
5. Application type: **Web application**
6. Name: `n8n Calendar`
7. Authorized redirect URIs: Add `http://localhost:5678/rest/oauth2-credential/callback`
   - For production: `https://your-n8n-domain.com/rest/oauth2-credential/callback`
8. Click **Create**
9. **Download** the JSON or copy the **Client ID** and **Client Secret**

## Step 4: Configure in n8n

1. Open n8n: `http://localhost:5678`
2. Go to **Credentials** → **New Credential** → **Google Calendar OAuth2 API**
3. Fill in:
   - **Client ID**: from Step 3
   - **Client Secret**: from Step 3
4. Click **Sign in with Google** → Authorize access
5. **Save** as `Google Calendar`

## Step 5: Get Calendar ID

**Option A — Use your primary calendar:**
- Calendar ID = `primary` (already set as default)

**Option B — Use a specific clinic calendar:**
1. Open [Google Calendar](https://calendar.google.com)
2. Left sidebar → hover over the calendar → **⋮** → **Settings and sharing**
3. Scroll down to **Integrate calendar**
4. Copy the **Calendar ID** (looks like `abc123@group.calendar.google.com`)
5. Set this as `GOOGLE_CALENDAR_ID` in your `.env`

## Step 6: Import & Activate Workflow

1. In n8n, import `n8n-workflows/05-google-calendar-sync.json`
2. Update credential references:
   - PostgreSQL nodes → Select **Clinic DB**
   - Google Calendar nodes → Select **Google Calendar**
3. Activate the workflow

## How It Works

```
Appointment Confirmed (Booking Flow)
  │
  ├──→ [POST] /webhook/gcal-sync { action: "create", appointment_id: "..." }
  │        │
  │        ▼
  │    Fetch appointment details from DB
  │        │
  │        ▼
  │    Create Google Calendar event with:
  │    - Title: "🏥 Patient Name — Service"
  │    - Time: appointment start → end
  │    - Location: clinic address
  │    - Description: patient details, doctor, phone
  │    - Reminders: 1h and 15min popup
  │        │
  │        ▼
  │    Save Google Event ID back to appointments table
  │
  │
Appointment Cancelled / Rescheduled
  │
  └──→ [POST] /webhook/gcal-sync { action: "cancel", appointment_id: "..." }
           │
           ▼
       Delete the Google Calendar event using stored event ID
```

## Calendar Event Example

When a patient books through WhatsApp, this appears on Google Calendar:

```
┌─────────────────────────────────────────┐
│  🏥 Rajesh Kumar — General Consultation │
│  10:00 AM - 10:30 AM                    │
│                                          │
│  📍 HealthCare Clinic, 123 Main Street  │
│                                          │
│  Patient: Rajesh Kumar                   │
│  Phone: +919876543210                    │
│  Doctor: Dr. Priya Sharma (General)      │
│  Service: General Consultation           │
│  Appointment ID: abc12345                │
└─────────────────────────────────────────┘
```

## Troubleshooting

| Issue | Solution |
|---|---|
| OAuth2 error "redirect_uri_mismatch" | Check the redirect URI in Google Cloud matches exactly |
| "Calendar not found" | Verify `GOOGLE_CALENDAR_ID` or use `primary` |
| Token expired | Re-authenticate in n8n credentials |
| Events not showing | Check the correct Google Calendar account is connected |
