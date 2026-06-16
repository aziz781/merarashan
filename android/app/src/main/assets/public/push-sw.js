// Push notification handlers — injected into the workbox-generated SW.

async function broadcast(payload) {
  try {
    const clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    for (const client of clients) {
      client.postMessage({ type: "push-received", payload });
    }
  } catch (_) {
    /* ignore */
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: "Notification", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Mera Rashan";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || "/icon-192.png",
    data: { url: data.url || "/", title, body: data.body || "", month: data.month ?? null, year: data.year ?? null },
    tag: data.tag,
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      await broadcast({ title, body: options.body, url: options.data.url, month: options.data.month, year: options.data.year });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const targetUrl = d.url || "/";
  const title = d.title || event.notification.title || "Notification";
  const body = d.body || event.notification.body || "";

  event.waitUntil(
    (async () => {
      // Ensure it is in the in-app list as well.
      await broadcast({ title, body, url: targetUrl });

      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          if (url.origin === self.location.origin) {
            await client.focus();
            client.navigate(targetUrl);
            return;
          }
        } catch (_) {
          /* ignore */
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
