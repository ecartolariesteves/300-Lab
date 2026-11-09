/* =========================================================
   SALA DE JUEGOS — Service worker
   Guarda las páginas y recursos propios para poder jugar sin conexión.
   ========================================================= */

const CACHE_VERSION = 'v10';
const APP_CACHE = `sala-juegos-${CACHE_VERSION}`;
const FONT_CACHE = `sala-juegos-fonts-${CACHE_VERSION}`;
const SITE_ROOT = new URL('./', self.location.href);

// Lista de páginas, estilos y scripts que forman el sitio.
const PRECACHE_FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/icons/icon.svg',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/icon-maskable-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/pwa.js',
  'assets/base.css',
  'buscaminas/index.html',
  'buscaminas/style.css',
  'buscaminas/game.js',
  '2048/index.html',
  '2048/style.css',
  '2048/game.js',
  'solitario/index.html',
  'solitario/style.css',
  'solitario/game.js',
  'sudoku/index.html',
  'sudoku/style.css',
  'sudoku/game.js',
  'serpiente/index.html',
  'serpiente/style.css',
  'serpiente/game.js',
  'ultima-parada/index.html',
  'ultima-parada/style.css',
  'ultima-parada/levels.js',
  'ultima-parada/game.js',
  'poker/index.html',
  'poker/style.css',
  'poker/engine.js',
  'poker/sizing.js',
  'poker/betting.js',
  'poker/evaluation.js',
  'poker/coach.js',
  'poker/game.js',
  'poker/ranges.json',
  'blackjack/index.html','blackjack/style.css','blackjack/rules.js','blackjack/strategy.js',
  'blackjack/ev.js','blackjack/evaluation.js','blackjack/coach.js','blackjack/count.js','blackjack/game.js',
  'blackjack/tests/test-rules.mjs','blackjack/tests/test-strategy.mjs','blackjack/tests/test-ev.mjs',
  'blackjack/tests/test-evaluation.mjs','blackjack/tests/test-count.mjs',
  'spider/index.html','spider/style.css','spider/rules.js','spider/game.js',
  'parejas/index.html','parejas/style.css','parejas/rules.js','parejas/game.js',
  'cuatro-en-raya/index.html','cuatro-en-raya/style.css','cuatro-en-raya/rules.js','cuatro-en-raya/game.js','cuatro-en-raya/ai-worker.js',
  'aprende/index.html',
  'aprende/aprende.css',
  'aprende/buscaminas/index.html',
  'aprende/buscaminas/demos.js'
].map((path) => new URL(path, SITE_ROOT).href);

// Instalación: precargamos todo antes de dar por lista la PWA.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      // cache: 'reload' pide cada archivo al servidor y no a la caché HTTP del navegador.
      // Sin esto, una versión nueva podía guardar un index.html nuevo junto a un game.js antiguo.
      .then((cache) => cache.addAll(PRECACHE_FILES.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

// Activación: retiramos versiones antiguas y tomamos el control de las páginas.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith('sala-juegos-') &&
            name !== APP_CACHE && name !== FONT_CACHE)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Comprueba si una petición corresponde a una fuente de Google.
function isGoogleFont(url) {
  return url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';
}

// Para una navegación a una carpeta, busca también su index.html guardado.
async function findCachedPage(requestUrl) {
  const cache = await caches.open(APP_CACHE);
  // ignoreSearch: una URL con ?parámetros (por ejemplo, de un enlace compartido) usa la misma copia
  const cached = await cache.match(requestUrl.href, { ignoreSearch: true });
  if (cached) return cached;

  if (requestUrl.pathname.endsWith('/')) {
    const indexUrl = new URL('index.html', requestUrl);
    const folderPage = await cache.match(indexUrl.href, { ignoreSearch: true });
    if (folderPage) return folderPage;
  }

  return null;
}

// Las fuentes se actualizan en segundo plano, pero se sirven desde caché si ya existen.
async function fontResponse(request, event) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request);

  const refresh = fetch(request).then((response) => {
    // Google Fonts puede responder con una respuesta opaca (status 0).
    if (response && (response.ok || response.type === 'opaque')) {
      cache.put(request, response.clone());
    }
    return response;
  });
  // Mantenemos viva la actualización aunque ya podamos responder desde caché.
  event.waitUntil(refresh.then(() => undefined).catch(() => {}));

  if (cached) {
    // No bloqueamos la página mientras se actualiza la fuente.
    return cached;
  }

  try {
    return await refresh;
  } catch (error) {
    return new Response('', {
      status: 503,
      statusText: 'Fuente no disponible sin conexión'
    });
  }
}

// Decide la estrategia según el tipo de recurso solicitado.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Las fuentes externas usan una caché independiente (stale-while-revalidate).
  if (isGoogleFont(url)) {
    event.respondWith(fontResponse(request, event));
    return;
  }

  // Solo gestionamos recursos propios que estén dentro de la raíz del sitio.
  if (url.origin !== SITE_ROOT.origin || !url.href.startsWith(SITE_ROOT.href)) return;

  // En las navegaciones preferimos la versión de red y usamos caché sin conexión.
  if (request.mode === 'navigate' ||
      (request.destination === 'document' && request.headers.get('accept')?.includes('text/html'))) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        // Guardamos la versión recién descargada: así la copia offline está siempre al día
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.put(request, copy)));
        }
        return response;
      } catch (error) {
        const cachedPage = await findCachedPage(url);
        if (cachedPage) return cachedPage;

        // Último recurso: la portada siempre forma parte de la precarga.
        const cache = await caches.open(APP_CACHE);
        const home = await cache.match(new URL('index.html', SITE_ROOT).href);
        return home || new Response('Sala de Juegos no está disponible sin conexión.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })());
    return;
  }

  // CSS, JavaScript e imágenes propias: respondemos al instante desde la caché y la
  // actualizamos en segundo plano (stale-while-revalidate). Así, tras subir cambios,
  // la página y sus scripts no se quedan desincronizados aunque no cambie CACHE_VERSION.
  if (/\.(?:css|js|svg|png|webmanifest|json)$/i.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      const cached = await cache.match(request, { ignoreSearch: true });

      const refresh = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      });
      event.waitUntil(refresh.then(() => undefined).catch(() => {}));

      return cached || refresh;
    })());
  }
});
