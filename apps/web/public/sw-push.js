// Clean up the legacy `trpc-cache` left over from when /trpc/* used
// NetworkFirst (24h). That cache could re-serve a previous user's tRPC
// response after logout / account switch / offline blip. We now run /trpc/*
// in NetworkOnly so the cache is no longer populated, but installed PWAs
// still carry the stale entries until we drop them.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name === 'trpc-cache' || name.startsWith('trpc-cache'))
          .map((name) => caches.delete(name)),
      ))
      .catch(() => {}),
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/manifest-icons/icon-192x192.png',
      badge: '/manifest-icons/icon-192x192.png',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (new URL(client.url).origin === self.location.origin) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
