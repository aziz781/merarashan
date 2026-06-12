// FCM HTTP v1 helper — uses a Google service account JSON to obtain an OAuth2
// access token and send a single notification to one device token.
//
// The full service account JSON is stored in the FCM_SERVICE_ACCOUNT_JSON
// secret. We sign a JWT (RS256) with the private_key and exchange it at
// https://oauth2.googleapis.com/token for a short-lived access token.

type ServiceAccount = {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri?: string;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

function getServiceAccount(): ServiceAccount {
  const raw = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("FCM_SERVICE_ACCOUNT_JSON not configured");
  const sa = JSON.parse(raw) as ServiceAccount;
  if (!sa.client_email || !sa.private_key || !sa.project_id) {
    throw new Error("FCM_SERVICE_ACCOUNT_JSON missing required fields");
  }
  return sa;
}

function base64UrlEncode(data: string | Uint8Array): string {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, "")
    .replace(/-----END [A-Z ]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getAccessToken(): Promise<{ token: string; projectId: string }> {
  const sa = getServiceAccount();
  const now = Math.floor(Date.now() / 1000);

  if (cachedToken && cachedToken.expiresAt - 60 > now) {
    return { token: cachedToken.token, projectId: sa.project_id };
  }

  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const unsigned = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(claim)
  )}`;

  const keyData = pemToDer(sa.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64UrlEncode(new Uint8Array(sig))}`;

  const res = await fetch(claim.aud, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`FCM oauth failed: ${res.status} ${JSON.stringify(body)}`);
  }
  cachedToken = {
    token: body.access_token,
    expiresAt: now + (body.expires_in ?? 3600),
  };
  return { token: body.access_token, projectId: sa.project_id };
}

export type FcmSendResult =
  | { ok: true; name: string }
  | { ok: false; status: number; error: string; unregistered: boolean };

export async function fcmSend(opts: {
  token: string;
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  data?: Record<string, string>;
}): Promise<FcmSendResult> {
  const { token, projectId } = await getAccessToken();
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  const dataPayload: Record<string, string> = {
    ...(opts.data || {}),
    url: opts.url || "/",
  };

  const message: Record<string, unknown> = {
    token: opts.token,
    notification: { title: opts.title, body: opts.body || "" },
    data: dataPayload,
    android: {
      priority: "HIGH",
      notification: {
        click_action: "FLUTTER_NOTIFICATION_CLICK",
        ...(opts.tag ? { tag: opts.tag } : {}),
      },
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ message }),
  });

  if (res.ok) {
    const body = (await res.json()) as { name: string };
    return { ok: true, name: body.name };
  }

  let errBody = "";
  try {
    errBody = await res.text();
  } catch { /* ignore */ }
  // 404 UNREGISTERED or 400 with INVALID_ARGUMENT for stale tokens
  const unregistered =
    res.status === 404 ||
    errBody.includes("UNREGISTERED") ||
    errBody.includes("registration-token-not-registered");
  return { ok: false, status: res.status, error: errBody, unregistered };
}
