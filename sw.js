
const CACHE_NAME = "weather-pwa-v2";

const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json"
];

// Uygulama dosyalarını önbelleğe alma
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Eski önbellekleri temizleme
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith("weather-pwa-") &&
                            name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// İstekleri yönetme
self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Hava durumu ve şehir arama API'leri:
  // Önce ağa bağlan, başarısızsa kontrollü yanıt döndür.
  const isWeatherApi =
    url.hostname === "api.open-meteo.com" ||
    url.hostname === "geocoding-api.open-meteo.com";

  if (isWeatherApi) {
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(
          JSON.stringify({
            error: true,
            reason: "offline",
            message: "İnternet bağlantısı yok."
          }),
          {
            status: 503,
            headers: {
              "Content-Type": "application/json; charset=utf-8"
            }
          }
        );
      })
    );

    return;
  }

  // Diğer dosyalar: önce önbellek, yoksa ağ.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request);
    })
  );
});
