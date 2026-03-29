# WhatsApp Business API Setup Guide

## Prerequisites

1. **Meta Business Account** — [business.facebook.com](https://business.facebook.com)
2. **Meta Developer Account** — [developers.facebook.com](https://developers.facebook.com)
3. A verified phone number (not already registered on WhatsApp)

---

## Step 1: Create a Meta App

1. Go to [Meta for Developers](https://developers.facebook.com/apps/)
2. Click **Create App** → Select **Business** → **Next**
3. Fill in App name: `Clinic WhatsApp Booking`
4. Select your Business Account
5. Click **Create App**

## Step 2: Add WhatsApp Product

1. On your app dashboard, find **WhatsApp** and click **Set Up**
2. Select or create a **WhatsApp Business Account**
3. You'll get a **temporary test phone number** — this is fine for development

## Step 3: Get Your Credentials

From the WhatsApp > **API Setup** page, note down:

| Credential | Where to Find | .env Variable |
|---|---|---|
| Phone Number ID | API Setup page | `WHATSAPP_PHONE_NUMBER_ID` |
| WhatsApp Business Account ID | API Setup page | `WHATSAPP_BUSINESS_ACCOUNT_ID` |
| Temporary Access Token | API Setup page | `WHATSAPP_ACCESS_TOKEN` |

### Generate Permanent Token

The temporary token expires in 24 hours. For production:

1. Go to **Business Settings** → **System Users**
2. Create a System User with **Admin** role
3. Click **Generate Token** → Select your WhatsApp app
4. Choose permissions: `whatsapp_business_management`, `whatsapp_business_messaging`
5. Copy and save the token → use as `WHATSAPP_ACCESS_TOKEN`

## Step 4: Configure Webhook

1. In your app dashboard, go to **WhatsApp** → **Configuration**
2. Click **Edit** next to Webhook
3. Set:
   - **Callback URL**: `https://your-domain.com/webhook/whatsapp-webhook`
     - For local dev: Use [ngrok](https://ngrok.com) → `ngrok http 5678` → use the HTTPS URL
   - **Verify Token**: Set any string (e.g., `my_secret_verify_token`) → same as `WHATSAPP_VERIFY_TOKEN` in .env
4. Click **Verify and Save**
5. Under **Webhook fields**, subscribe to: `messages`

## Step 5: Register Phone Number (Production)

For production with your own number:

1. Go to **WhatsApp** → **Phone Numbers**
2. Click **Add Phone Number**
3. Follow the verification process (SMS or voice call)
4. Complete the **Business Verification** process

## Step 6: Create Message Templates

For sending outbound messages (reminders), you need approved templates:

1. Go to **WhatsApp** → **Message Templates**
2. Create templates for:

### Appointment Reminder (24h)
```
Name: appointment_reminder_24h
Category: UTILITY
Language: English

Header: Appointment Reminder ⏰
Body: Hi {{1}}! This is a reminder for your appointment tomorrow.

👨‍⚕️ Doctor: {{2}}
📅 Date: {{3}}
🕐 Time: {{4}}

Please arrive 10 minutes early.

Footer: Reply CANCEL to cancel
Buttons: [Confirm] [Reschedule]
```

### Appointment Confirmation
```
Name: appointment_confirmed
Category: UTILITY
Language: English

Body: ✅ Your appointment is confirmed!

📋 ID: {{1}}
👨‍⚕️ Doctor: {{2}}
📅 Date: {{3}}
🕐 Time: {{4}}

See you there! 😊
```

3. Wait for template approval (usually 1-24 hours)

## Testing

1. Add your test phone number to recipients in **API Setup**
2. Send a test message from the API Setup page
3. Reply from your WhatsApp to trigger the webhook

## Pricing

- **First 1,000 conversations/month**: FREE
- Service conversations: ~₹0.30 per conversation (India)
- Marketing conversations: ~₹0.75 per conversation (India)
- See [Meta WhatsApp Pricing](https://developers.facebook.com/docs/whatsapp/pricing)
