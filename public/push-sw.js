// Push notification handlers — injected into the workbox-generated SW.

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
    data: { url: data.url || "/" },
    tag: data.tag,
  };

  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options);
      // Broadcast to any open clients so they can persist it in the in-app list.
      try {
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        for (const client of clients) {
          client.postMessage({
            type: "push-received",
            payload: { title, body: options.body, url: options.data.url },
          });
        }
      } catch (_) {
        /* ignore */
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
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
