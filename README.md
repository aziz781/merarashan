# Mera Rashan App

## Development: Bypass SMS OTP (`DEV_SKIP_SMS`)

For local/dev testing without burning Twilio credits, the `send-otp` edge function
supports a dev bypass mode that logs the OTP code instead of sending an SMS.

### Enable dev mode

Set the `DEV_SKIP_SMS` secret to `true`:

- **Desktop**: Cloud view → **Edge Functions** → **Secrets** → edit `DEV_SKIP_SMS`
- **Mobile**: `…` (bottom-right, Chat mode) → **Cloud** → **Edge Functions** → **Secrets**

| Value | Behavior |
|-------|----------|
| `true` | Skip Twilio, log OTP to function logs (dev mode) |
| `false` (or unset) | Send real SMS via Twilio (production) |

No redeploy needed — the change applies on the next function invocation.

### View the OTP in logs

1. Trigger an OTP from the login screen
2. Open **Cloud → Edge Functions → `send-otp` → Logs**
3. Look for:
   ```
   [DEV_SKIP_SMS] OTP for 923159600296: 123456
   ```

### Notes

- OTP still expires in **5 minutes**
- Rate limit: **3 sends per number per 10 minutes**
- For real SMS, ensure the Twilio connector is linked and `TWILIO_VERIFY_SERVICE_SID` is set
- An in-app version of this guide is available at [`/dev/troubleshooting`](/dev/troubleshooting)
