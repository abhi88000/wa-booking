# n8n Setup & Configuration Guide

## After Docker Compose is Running

### Step 1: Access n8n

1. Open browser: `http://localhost:5678`
2. Login with credentials from your `.env`:
   - User: `admin`
   - Password: (from `N8N_PASSWORD`)

### Step 2: Configure Credentials

You need to set up these credentials in n8n before importing workflows:

#### A. PostgreSQL (Clinic DB)
1. Go to **Credentials** → **New Credential** → **Postgres**
2. Fill in:
   - Host: `postgres` (docker service name)
   - Port: `5432`
   - Database: `clinic_booking`
   - User: `clinic_admin`
   - Password: (from `DB_PASSWORD`)
3. Save as **Clinic DB**

#### B. WhatsApp Token (HTTP Header Auth)
1. Go to **Credentials** → **New Credential** → **Header Auth**
2. Fill in:
   - Header Name: `Authorization`
   - Header Value: `Bearer YOUR_WHATSAPP_ACCESS_TOKEN`
3. Save as **WhatsApp Token**

#### C. OpenAI API
1. Go to **Credentials** → **New Credential** → **OpenAI API**
2. Fill in:
   - API Key: `sk-your-openai-key`
3. Save as **OpenAI**

#### D. Google Calendar (Optional)
1. Go to **Credentials** → **New Credential** → **Google Calendar OAuth2**
2. Follow the OAuth2 flow to connect your Google Calendar
3. Save as **Google Calendar**

### Step 3: Import Workflows

1. Go to **Workflows** → **Import from File**
2. Import in this order:
   1. `n8n-workflows/01-whatsapp-webhook.json`
   2. `n8n-workflows/02-ai-booking-flow.json`
   3. `n8n-workflows/03-reminders-cron.json`
   4. `n8n-workflows/04-reschedule-cancel.json`

### Step 4: Update Credential References

After importing, in each workflow:
1. Click on each **Postgres** node → Select your **Clinic DB** credential
2. Click on each **HTTP Request** node → Select your **WhatsApp Token** credential
3. Click on the **OpenAI** node → Select your **OpenAI** credential

### Step 5: Set Environment Variables

In n8n settings or via Docker env:
- `WHATSAPP_PHONE_NUMBER_ID` — your WhatsApp phone number ID

### Step 6: Activate Workflows

1. Toggle each workflow to **Active**
2. The webhook URLs will be shown — use the Webhook URL for WhatsApp configuration

### Step 7: Set Up Webhook URL for WhatsApp

1. Get the webhook URL from n8n: `https://your-domain.com/webhook/whatsapp-webhook`
2. For local development, use ngrok:
   ```bash
   ngrok http 5678
   ```
3. Configure this URL in Meta Developer Console (see whatsapp-setup.md)

## Monitoring

- **Executions tab**: See all workflow runs, debug failures
- **Logs**: Check Docker logs with `docker logs clinic-n8n -f`

## Common Issues

| Issue | Solution |
|---|---|
| Webhook not receiving | Check ngrok is running, verify token matches |
| Postgres connection failed | Ensure `postgres` container is healthy |
| OpenAI timeout | Check API key, increase timeout in node settings |
| WhatsApp 401 error | Token expired — regenerate permanent token |
