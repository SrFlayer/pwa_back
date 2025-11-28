const API_BASE_URL = 
//'http://localhost:3000/api'
'https://pwa-end.onrender.com/api';

class NotificationService {
  constructor() {
    this.publicKey = null;
    this.registration = null;
  }

  // Obtener la clave pública del servidor
  async getPublicKey() {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/public-key`);
      const data = await response.json();
      this.publicKey = data.publicKey;
      return this.publicKey;
    } catch (error) {
      console.error('Error obteniendo clave pública:', error);
      throw error;
    }
  }

  // Verificar soporte de notificaciones
  isSupported() {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  // Solicitar permisos de notificación
  async requestPermission() {
    if (!this.isSupported()) {
      throw new Error('Las notificaciones push no están soportadas en este navegador');
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      throw new Error('Permisos de notificación denegados');
    }
    return permission;
  }

  // Registrar service worker
  async registerServiceWorker() {
    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registrado:', this.registration);
      // ⚡ Esperar a que el SW esté activo antes de usar PushManager
      await navigator.serviceWorker.ready;
      return this.registration;
    } catch (error) {
      console.error('Error registrando Service Worker:', error);
      throw error;
    }
  }

  // Suscribirse a notificaciones push
  async subscribe(userId) {
    try {
      if (!this.publicKey) {
        await this.getPublicKey();
      }

      if (!this.registration) {
        await this.registerServiceWorker();
      }

      const applicationServerKey = this.urlBase64ToUint8Array(this.publicKey);

      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey
      });

      // Enviar la suscripción al servidor
      const response = await fetch(`${API_BASE_URL}/notifications/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subscription })
      });

      if (!response.ok) {
        throw new Error('Error enviando suscripción al servidor');
      }

      console.log('Suscripción exitosa:', subscription);
      return subscription;

    } catch (error) {
      console.error('Error suscribiéndose a notificaciones:', error);
      throw error;
    }
  }

  // Enviar notificación de prueba
  async sendTestNotification(userId, title = '¡Hola!', body = 'Esta es una notificación de prueba') {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title, body, icon: '/neko.png', url: '/' })
      });

      if (!response.ok) {
        throw new Error('Error enviando notificación');
      }

      console.log('Notificación enviada exitosamente');
      return true;

    } catch (error) {
      console.error('Error enviando notificación:', error);
      throw error;
    }
  }

  // Enviar notificación personalizada a un usuario
  async sendNotificationToUser(userId, title, body, icon = '/neko.png', url = '/') {
    try {
      const response = await fetch(`${API_BASE_URL}/notifications/send-to-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, title, body, icon, url })
      });

      if (!response.ok) {
        throw new Error('Error enviando notificación personalizada');
      }

      console.log('Notificación enviada al usuario', userId);
      return true;
    } catch (error) {
      console.error('Error en sendNotificationToUser:', error);
      throw error;
    }
  }

  // Configurar notificaciones completas
  async setupNotifications(userId) {
    try {
      if (!this.isSupported()) throw new Error('Notificaciones push no soportadas');
      await this.requestPermission();
      await this.registerServiceWorker();
      await this.subscribe(userId);
      console.log('Notificaciones configuradas exitosamente');
      return true;
    } catch (error) {
      console.error('Error configurando notificaciones:', error);
      throw error;
    }
  }

  // Convertir clave base64 a Uint8Array
  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  // Verificar si ya está suscrito
  async isSubscribed() {
    try {
      if (!this.registration) {
        this.registration = await navigator.serviceWorker.ready;
      }
      const subscription = await this.registration.pushManager.getSubscription();
      return subscription !== null;
    } catch (error) {
      console.error('Error verificando suscripción:', error);
      return false;
    }
  }
}

export default new NotificationService();
