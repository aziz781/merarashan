# Mera Rashan App

## Required Secrets for OTP Verification

The `send-otp` and `verify-otp` edge functions rely on the following secrets.
Manage them in **Cloud → Edge Functions → Secrets**.

| Secret | Required | Source | What it does |
|--------|----------|--------|--------------|
| `TWILIO_API_KEY` | Yes (prod) | Twilio connector (auto-managed) | Connection key passed to the Lovable connector gateway as `X-Connection-Api-Key` to authenticate Twilio API calls. Created automatically when the Twilio connector is linked — do not edit manually. |
| `TWILIO_VERIFY_SERVICE_SID` | Yes (prod) | Twilio Console → Messaging → Services | Twilio **Messaging Service SID** (starts with `MG…`) used as the `MessagingServiceSid` when sending the OTP SMS. Despite the legacy name, this must be a Messaging Service SID, not a Verify Service SID. |
| `LOVABLE_API_KEY` | Yes | Auto-provisioned by Lovable Cloud | Bearer token for the Lovable connector gateway (`Authorization: Bearer …`). Managed by Lovable — rotate via the rotate tool, not edit. |
| `SUPABASE_URL` | Yes | Auto-provisioned | Project URL used by the edge function's Supabase service-role client to read/write `otp_codes`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Auto-provisioned | Service-role key used server-side to insert OTP hashes and verify codes, bypassing RLS. Never expose to the client. |
| `DEV_SKIP_SMS` | Optional | Manually set | When `true`, `send-otp` skips Twilio and logs the OTP to the function logs (see dev mode section below). Leave unset or `false` in production. |

### How OTPs flow

1. **`send-otp`** — generates a 6-digit code, stores its SHA-256 hash in the `otp_codes` table (5-minute expiry, max 3 sends per number per 10 minutes), then sends the SMS via the Twilio gateway using `TWILIO_API_KEY` + `TWILIO_VERIFY_SERVICE_SID`.
2. **`verify-otp`** — hashes the user-submitted code and compares it against the stored hash for that mobile number.


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
## Install as PWA (Standalone App)

Mera Rashan App is a Progressive Web App (PWA). You can install it on your device for a native app-like experience.

### Android (Chrome)

1. Open the app in Chrome.
2. Tap the **⋮** menu (top right) → **"Add to Home screen"** → **"Install"**.
3. The app will appear as a standalone icon on your home screen.

### iPhone / iPad (Safari)

1. Open the app in Safari.
2. Tap the **Share** button (rectangle with arrow).
3. Scroll down and tap **"Add to Home Screen"**.
4. Tap **"Add"** in the top right.

### Desktop (Chrome / Edge)

1. Open the app in the browser.
2. Look for the **install icon** (➕ inside a monitor icon) in the address bar on the right.
3. Click it and follow the prompts to install.

Once installed, it opens in full-screen standalone mode without the browser address bar.
