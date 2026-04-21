// Service Worker – Galilea Facturas
const VERSION_CACHE = 'galilea-facturas-v1';

const ARCHIVOS_ESTATICOS = [
  '/',
  '/index.html',
  '/facturas.html',
  '/nueva-factura.html',
  '/css/estilos.css',
  '/js/config.js',
  '/js/login.js',
  '/js/facturas.js',
  '/js/nueva-factura.js',
  '/manifest.json',
];

// Instalar: cachear archivos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION_CACHE).then((cache) => {
      return cache.addAll(ARCHIVOS_ESTATICOS).catch((err) => {
        console.warn('SW: algunos archivos no se cachearon:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activar: limpiar caches anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((claves) => {
      return Promise.all(
        claves
          .filter((clave) => clave !== VERSION_CACHE)
          .map((clave) => caches.delete(clave))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: network-first para API y Supabase, cache-first para estáticos
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Las llamadas a la API y a Supabase siempre van a la red
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Estáticos: cache-first con fallback a red
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((respuesta) => {
        // Cachear la respuesta para la próxima vez
        if (respuesta.ok && event.request.method === 'GET') {
          const copia = respuesta.clone();
          caches.open(VERSION_CACHE).then((cache) => cache.put(event.request, copia));
        }
        return respuesta;
      });
    })
  );
});
