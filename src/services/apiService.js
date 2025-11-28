const API_BASE_URL = 
//'http://localhost:3000/api'
'https://pwa-end.onrender.com/api'
;

class ApiService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.setupOnlineListener();
  }

  setupOnlineListener() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('Conexión restaurada');
      this.syncOfflineData();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('Sin conexión - datos guardados offline');
    });
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Error en la petición');
      }
      
      return data;
    } catch (error) {
      console.error('Error en API:', error);
      
      // Si es un POST y no hay conexión, guardar en IndexedDB
      if (options.method === 'POST' && !this.isOnline) {
        await this.saveOfflineData(endpoint, options.body);
        throw new Error('Sin conexión. Datos guardados para sincronizar más tarde.');
      }
      
      throw error;
    }
  }

  async saveOfflineData(endpoint, data) {
    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['offlineRequests'], 'readwrite');
      const store = transaction.objectStore('offlineRequests');
      
      const offlineRequest = {
        endpoint,
        data: JSON.parse(data),
        timestamp: new Date().toISOString(),
        id: Date.now()
      };
      
      await store.add(offlineRequest);
      console.log('Datos guardados offline:', offlineRequest);
    } catch (error) {
      console.error('Error guardando datos offline:', error);
    }
  }

  async openIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ChupirulDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Crear store para requests offline
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

  async syncOfflineData() {
    try {
      console.log('Iniciando sincronización de datos offline...');
      
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['offlineRequests'], 'readonly');
      const store = transaction.objectStore('offlineRequests');
      const requests = await this.getAllFromStore(store);
      
      console.log(`Encontrados ${requests.length} requests offline para sincronizar`);
      
      if (requests.length === 0) {
        console.log('No hay datos offline para sincronizar');
        return;
      }
      
      for (const request of requests) {
        try {
          console.log('Sincronizando request:', request.endpoint, request.data);
          
          // Hacer la petición directamente sin usar makeRequest para evitar recursión
          const response = await fetch(`${API_BASE_URL}${request.endpoint}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(request.data)
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log('Request sincronizado exitosamente:', result);
            
            // Eliminar request exitoso de IndexedDB
            await this.deleteOfflineRequest(request.id);
            console.log('Request eliminado de IndexedDB:', request.id);
          } else {
            console.error('Error en sincronización - Status:', response.status);
            const errorText = await response.text();
            console.error('Error response:', errorText);
          }
        } catch (error) {
          console.error('Error sincronizando request individual:', error);
        }
      }
      
      console.log('Sincronización completada');
    } catch (error) {
      console.error('Error en sincronización:', error);
    }
  }

  async getAllFromStore(store) {
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

  async deleteOfflineRequest(id) {
    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['offlineRequests'], 'readwrite');
      const store = transaction.objectStore('offlineRequests');
      await store.delete(id);
    } catch (error) {
      console.error('Error eliminando request offline:', error);
    }
  }

  // Función de debug para verificar datos en IndexedDB
  async debugOfflineData() {
    try {
      const db = await this.openIndexedDB();
      const transaction = db.transaction(['offlineRequests'], 'readonly');
      const store = transaction.objectStore('offlineRequests');
      const requests = await this.getAllFromStore(store);
      
      console.log('=== DEBUG: Datos en IndexedDB ===');
      console.log('Total de requests offline:', requests.length);
      requests.forEach((request, index) => {
        console.log(`Request ${index + 1}:`, {
          id: request.id,
          endpoint: request.endpoint,
          data: request.data,
          timestamp: request.timestamp
        });
      });
      console.log('=== FIN DEBUG ===');
      
      return requests;
    } catch (error) {
      console.error('Error en debug offline data:', error);
      return [];
    }
  }

  // Métodos específicos para la API
  async register(userData) {
    return this.makeRequest('/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async login(credentials) {
    return this.makeRequest('/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
  }

  async getUsers() {
    return this.makeRequest('/users');
  }

  async getUser(id) {
    return this.makeRequest(`/user/${id}`);
  }
}

export default new ApiService();
