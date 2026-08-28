/*
 * Service Worker kill switch
 *
 * 이전에 이 도메인에서 운영하던 Jekyll(Chirpy) 테마가 서비스 워커를 등록해두어,
 * 방문자 브라우저에 옛 사이트가 캐시된 채로 남는 문제가 있었다.
 * 이 파일은 그 서비스 워커를 대체하여 캐시를 모두 비우고 스스로 등록을 해제한다.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 남아 있는 캐시 전부 삭제
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));

      // 서비스 워커 등록 해제
      await self.registration.unregister();

      // 열려 있는 탭을 새로고침하여 최신 사이트를 받아오게 함
      const clientList = await self.clients.matchAll({ type: 'window' });
      clientList.forEach((client) => client.navigate(client.url));
    })()
  );
});

// 캐시를 거치지 않고 항상 네트워크에서 가져오도록 한다
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
