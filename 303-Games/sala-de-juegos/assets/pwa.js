/* Registra la PWA desde cualquier página, sin interferir con navegadores antiguos. */
(function () {
  if (!('serviceWorker' in navigator)) return;

  try {
    const scriptUrl = document.currentScript && document.currentScript.src;
    if (!scriptUrl) return;

    // pwa.js vive dentro de assets: subir un nivel nos da la raíz del sitio.
    const siteRoot = new URL('..', scriptUrl);
    const serviceWorkerUrl = new URL('sw.js', siteRoot);

    navigator.serviceWorker.register(serviceWorkerUrl.href, {
      scope: siteRoot.href
    }).catch((error) => {
      console.warn('No se pudo registrar el service worker de Sala de Juegos:', error);
    });
  } catch (error) {
    console.warn('No se pudo preparar el service worker de Sala de Juegos:', error);
  }
})();
