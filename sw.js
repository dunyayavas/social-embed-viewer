// Service Worker for Social Media Embed Viewer PWA

const CACHE_NAME = 'embed-viewer-v1';
// Get the base path from the location of the service worker
const BASE_PATH = self.location.pathname.replace('sw.js', '');

const ASSETS_TO_CACHE = [
  BASE_PATH,
  BASE_PATH + 'index.html',
  BASE_PATH + 'login.html',
  BASE_PATH + 'app.js',
  BASE_PATH + 'app-supabase-combined.js',
  BASE_PATH + 'db-service.js',
  BASE_PATH + 'supabase.js',
  BASE_PATH + 'styles.css',
  BASE_PATH + 'auth-styles.css',
  BASE_PATH + 'manifest.json',
  BASE_PATH + 'icons/icon-192x192.svg',
  BASE_PATH + 'icons/icon-512x512.svg',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.0/+esm'
];

// Install event - cache assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching app assets');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName !== CACHE_NAME;
        }).map(cacheName => {
          console.log('Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('cdn.jsdelivr.net')) {
    return;
  }
  
  // Handle share target requests
  if (event.request.url.includes('share-target.html')) {
    return handleShareTarget(event);
  }
  
  // Regular fetch handling with cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then(response => {
            // Don't cache non-successful responses or non-GET requests
            if (!response || response.status !== 200 || event.request.method !== 'GET') {
              return response;
            }
            
            // Clone the response as it can only be consumed once
            const responseToCache = response.clone();
            
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
              
            return response;
          })
          .catch(error => {
            console.error('Fetch failed:', error);
            // For navigation requests, return the offline page
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
            
            return new Response('Network error', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Handle share target requests
function handleShareTarget(event) {
  event.respondWith(Response.redirect('./index.html?share=pending'));
  
  event.waitUntil(async function() {
    // Get the shared data
    const formData = await event.request.formData();
    const url = formData.get('url') || '';
    const text = formData.get('text') || '';
    const title = formData.get('title') || '';
    
    // If we have a URL directly, use it
    let sharedUrl = url;
    
    // If no URL but text contains a URL, extract it
    if (!sharedUrl && text) {
      const urlMatch = text.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        sharedUrl = urlMatch[0];
      }
    }
    
    // Store the shared URL in sessionStorage
    if (sharedUrl) {
      const client = await self.clients.get(event.resultingClientId);
      if (client) {
        client.postMessage({
          type: 'SHARED_URL',
          url: sharedUrl
        });
      }
    }
  }());
}

// Listen for messages from clients
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
