// Utilidades para testing offline
export const testOfflineSync = async () => {
  console.log('=== INICIANDO TEST OFFLINE SYNC ===');
  
  try {
    // 1. Verificar si hay datos en IndexedDB
    const db = await openIndexedDB();
    const transaction = db.transaction(['offlineRequests'], 'readonly');
    const store = transaction.objectStore('offlineRequests');
    const requests = await getAllFromStore(store);
    
    console.log('Datos encontrados en IndexedDB:', requests.length);
    
    if (requests.length === 0) {
      console.log('No hay datos offline para sincronizar');
      return;
    }
    
    // 2. Intentar sincronizar cada request
    for (const request of requests) {
      console.log('Sincronizando:', request.endpoint, request.data);
      
      try {
        const response = await fetch(`http://localhost:3000/api${request.endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(request.data)
        });
        
        if (response.ok) {
          const result = await response.json();
          console.log('✅ Sincronización exitosa:', result);
          
          // Eliminar de IndexedDB
          await deleteFromIndexedDB(request.id);
          console.log('✅ Request eliminado de IndexedDB');
        } else {
          console.error('❌ Error en sincronización:', response.status, await response.text());
        }
      } catch (error) {
        console.error('❌ Error en request:', error);
      }
    }
    
    console.log('=== TEST COMPLETADO ===');
  } catch (error) {
    console.error('Error en test:', error);
  }
};

// Funciones auxiliares
function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ChupirulDB', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
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

function deleteFromIndexedDB(id) {
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

// Función para simular datos offline
export const simulateOfflineData = async () => {
  try {
    const db = await openIndexedDB();
    const transaction = db.transaction(['offlineRequests'], 'readwrite');
    const store = transaction.objectStore('offlineRequests');
    
    const testData = {
      endpoint: '/register',
      data: {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
        phone: '123456789'
      },
      timestamp: new Date().toISOString(),
      id: Date.now()
    };
    
    await store.add(testData);
    console.log('✅ Datos de prueba agregados a IndexedDB');
  } catch (error) {
    console.error('❌ Error agregando datos de prueba:', error);
  }
};
