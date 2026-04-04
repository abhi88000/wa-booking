# WhatsApp Business API Setup

How to connect a WhatsApp Business number so patients can book appointments via chat.

## Prerequisites

- A Meta Business Account ([business.facebook.com](https://business.facebook.com))
- A Meta Developer Account ([developers.facebook.com](https://developers.facebook.com))
- A phone number not already registered on WhatsApp

## 1. Create a Meta App

1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps/)
2. Create App > select Business > Next
3. Name it something like "Clinic WhatsApp Booking"
4. Select your Business Account > Create App

## 2. Add WhatsApp

1. On the app dashboard, find WhatsApp and click Set Up
2. Select or create a WhatsApp Business Account
3. You'll get a temporary test phone number — fine for development

## 3. Get Your Credentials

From the WhatsApp > API Setup page, grab these:

| What | Where |
|---|---|
| Phone Number ID | API Setup page |
| WhatsApp Business Account ID | API Setup page |
| Access Token | API Setup page (temporary, 24h) |

For production, generate a permanent token:

1. Go to Business Settings > System Users
2. Create a System User with Admin role
3. Generate Token > select your WhatsApp app
4. Permissions: `whatsapp_business_management`, `whatsapp_business_messaging`
5. Copy and save this token

These credentials get entered during tenant onboarding in the dashboard.

## 4. Configure the Webhook

This tells Meta where to send incoming messages.

1. In your app dashboard: WhatsApp > Configuration
2. Click Edit next to Webhook
3. Callback URL: `https://api.yourdomain.com/api/webhook`
4. Verify Token: the same value as `WA_VERIFY_TOKEN` in your `.env`
5. Click Verify and Save
6. Under Webhook fields, subscribe to: `messages`

For local development, use [ngrok](https://ngrok.com) to tunnel to your local machine.

## 5. Register Your Phone Number (Production)

To use your own number instead of the test number:

1. WhatsApp > Phone Numbers > Add Phone Number
2. Verify via SMS or voice call
3. Complete Meta's Business Verification process

## 6. Message Templates (Optional)

If you want to send outbound reminders, you need approved templates.

1. WhatsApp > Message Templates > Create
2. Example reminder template:

```
Name: appointment_reminder
Category: UTILITY
Language: English

Body:
Hi {{1}}, this is a reminder for your appointment tomorrow.

Doctor: {{2}}
Date: {{3}}
Time: {{4}}

Please arrive 10 minutes early.
```

3. Submit for review (usually approved within a few hours)

## Testing

1. Add your test phone number in API Setup
2. Send a test message from the Meta console
3. Reply from WhatsApp to trigger the webhook and start the booking flow

## Pricing

Meta charges per conversation, not per message:

- First 1,000 service conversations per month: free
- After that: roughly 0.30 INR per service conversation (India rates)
- See [Meta's pricing page](https://developers.facebook.com/docs/whatsapp/pricing) for current rates
