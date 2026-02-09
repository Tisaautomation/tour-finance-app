// Service Worker for SATP App - Background Notifications
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: '💬 New Message', body: 'You have a new message' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/images/compass.png',
      badge: '/images/compass.png',
      vibrate: [200, 100, 200],
      tag: 'satp-chat-' + Date.now(),
      renotify: true,
      requireInteraction: false
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow('/');
    })
  );
});
