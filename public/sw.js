const CACHE_NAME = 'chupirul-pwa-v3';
const API_BASE_URL = 
//'http://localhost:3000/api'
'https://backend-4jns.onrender.com/api'
;

self.addEventListener('install', event => {
    console.log('Service Worker instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
    .then(cache => {
            return cache.addAll([
                "/",
                "/index.html",
                "/neko.png",
                "/neko-512.png"
                /*"/src/main.jsx",
                "/src/App.jsx"*/
            ]);
        })
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('Service Worker activando...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Eliminando cache antigua:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    // Cache first para assets estáticos
    if (event.request.method === "GET" && !event.request.url.includes(API_BASE_URL)) {
        event.respondWith(
            caches.match(event.request)
            .then(cacheResp => {
                if (cacheResp) {
                    return cacheResp;
                }
                return fetch(event.request)
                .then(networkResp => {
                    if (networkResp.status === 200) {
                        const responseClone = networkResp.clone();
                        caches.open(CACHE_NAME)
                    .then(cache => {
                            cache.put(event.request, responseClone);
                    });
                    }
                    return networkResp;
                })
                .catch(() => {
                    return caches.match("/index.html");
                });
            })
        );
    }
});

// Listener para sincronización offline
self.addEventListener('sync', event => {
    console.log('Sync event recibido:', event.tag);
    
    if (event.tag === 'background-sync') {
        console.log('Ejecutando sincronización en background...');
        event.waitUntil(syncOfflineData());
    }
});

// Registrar background sync cuando se detecte conexión
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SYNC_OFFLINE_DATA') {
        console.log('Mensaje recibido para sincronizar datos offline');
        syncOfflineData();
    }
});

// Función para sincronizar datos offline
async function syncOfflineData() {
    try {
        console.log('Iniciando sincronización de datos offline...');
        
        // Abrir IndexedDB
        const db = await openIndexedDB();
        const transaction = db.transaction(['offlineRequests'], 'readonly');
        const store = transaction.objectStore('offlineRequests');
        const requests = await getAllFromStore(store);
        
        console.log(`Encontrados ${requests.length} requests offline para sincronizar`);
        
        for (const request of requests) {
            try {
                console.log('Sincronizando request:', request.endpoint);
                
                const response = await fetch(`${API_BASE_URL}${request.endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(request.data)
                });
                
                if (response.ok) {
                    console.log('Request sincronizado exitosamente:', request.endpoint);
                    // Eliminar request exitoso de IndexedDB
                    await deleteOfflineRequest(request.id);
                } else {
                    console.error('Error en sincronización:', response.status);
                }
            } catch (error) {
                console.error('Error sincronizando request individual:', error);
            }
        }
        
        console.log('Sincronización completada');
    } catch (error) {
        console.error('Error en sincronización offline:', error);
    }
}

// Funciones auxiliares para IndexedDB
function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('ChupirulDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('offlineRequests')) {
                const store = db.createObjectStore('offlineRequests', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
    });
}

function getAllFromStore(store) {
    return new Promise((resolve, reject) => {
        const requests = [];
        const cursor = store.openCursor();
        
        cursor.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                requests.push(cursor.value);
                cursor.continue();
            } else {
                resolve(requests);
            }
        };
        
        cursor.onerror = () => reject(cursor.error);
    });
}

function deleteOfflineRequest(id) {
    return new Promise(async (resolve, reject) => {
        try {
            const db = await openIndexedDB();
            const transaction = db.transaction(['offlineRequests'], 'readwrite');
            const store = transaction.objectStore('offlineRequests');
            const request = store.delete(id);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        } catch (error) {
            reject(error);
        }
    });
}

// Manejar notificaciones push
self.addEventListener('push', event => {
    console.log('Push event recibido:', event);
    
    let data = {};
    if (event.data) {
        data = event.data.json();
    }
    
    const options = {
        body: data.body || 'Nueva notificación',
        icon: data.icon || '/neko.png',
        badge: data.badge || '/neko-512.png',
        tag: 'chupirul-notification',
        requireInteraction: true,
        actions: [
            {
                action: 'open',
                title: 'Abrir',
                icon: '/neko.png'
            },
            {
                action: 'close',
                title: 'Cerrar',
                icon: '/neko.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(data.title || '¡Hola!', options)
    );
});

// Manejar clics en notificaciones
self.addEventListener('notificationclick', event => {
    console.log('Notification click recibido:', event);
    
    event.notification.close();
    
    if (event.action === 'open' || !event.action) {
        event.waitUntil(
            clients.openWindow(event.notification.data?.url || '/')
        );
    }
});

// Notificar a los clientes sobre la sincronización
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SYNC_OFFLINE_DATA') {
        console.log('Mensaje recibido para sincronizar datos offline');
        syncOfflineData();
    }
});
