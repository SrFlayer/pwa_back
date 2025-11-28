import { useState, useEffect } from 'react';
import apiService from '../services/apiService';
import notificationService from '../services/notificationService';
import './Auth.css';

const Dashboard = ({ user, onLogout }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!user || !user.id) {
      return;
    }

    const setupNotificationsOnLoad = async () => {
      try {
        const isSubscribed = await notificationService.isSubscribed();
        if (isSubscribed) {
          setNotificationsEnabled(true);
          return;
        }

        if ('Notification' in window && Notification.permission === 'default') {
          console.log('Solicitando permiso de notificaciones al cargar...');
          setNotificationLoading(true); 
          await notificationService.setupNotifications(user.id);
          setNotificationsEnabled(true);
          console.log('Notificaciones habilitadas exitosamente.');
        } else if (Notification.permission === 'granted') {
          await notificationService.setupNotifications(user.id);
          setNotificationsEnabled(true);
        }
      } catch (error) {
        console.error('Error configurando notificaciones al cargar:', error);
      } finally {
        setNotificationLoading(false);
      }
    };

    setupNotificationsOnLoad();
  }, [user]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await apiService.getUsers();
      setUsers(response.users || []);
    } catch (err) {
      console.error('Error cargando usuarios:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const enableNotifications = async () => {
    setNotificationLoading(true);
    try {
      if ('Notification' in window && Notification.permission === 'denied') {
        alert('Las notificaciones están bloqueadas. Por favor, habilítalas manualmente en la configuración de tu navegador (junto a la URL) y vuelve a intentarlo.');
        setNotificationLoading(false);
        return;
      }

      await notificationService.setupNotifications(user.id);
      setNotificationsEnabled(true);
      alert('¡Notificaciones habilitadas exitosamente!');
    } catch (error) {
      console.error('Error habilitando notificaciones:', error);
      alert('Error habilitando notificaciones: ' + error.message);
    } finally {
      setNotificationLoading(false);
    }
  };

  const sendHelloNotification = async () => {
    try {
      await notificationService.sendTestNotification(
        user.id, 
        '¡Hola! 👋', 
        `¡Hola ${user.name}! Esta es una notificación de prueba desde tu PWA.`
      );
      alert('¡Notificación enviada! Revisa tu bandeja de notificaciones.');
    } catch (error) {
      console.error('Error enviando notificación:', error);
      alert('Error enviando notificación: ' + error.message);
    }
  };

  const sendCustomNotification = async () => {
    if (!selectedUser) {
      alert('Selecciona un usuario para enviar la notificación.');
      return;
    }

    if (!notifTitle || !notifBody) {
      alert('Por favor, completa el título y el mensaje.');
      return;
    }

    try {
      await notificationService.sendNotificationToUser(selectedUser, notifTitle, notifBody);
      alert('✅ Notificación enviada correctamente');
      setNotifTitle('');
      setNotifBody('');
    } catch (error) {
      alert('❌ Error enviando notificación: ' + error.message);
    }
  };

  return (
    <div className="dashboard">
      {!isOnline && (
        <div className="offline-indicator">
          Sin conexión - Los datos se sincronizarán cuando vuelva la conexión
        </div>
      )}
      
      <h1>Bienvenido, {user.name}</h1>
      
      <div className="user-info">
        <h2>Notificaciones</h2>
        
        {!notificationsEnabled ? (
          <button 
            onClick={enableNotifications} 
            disabled={notificationLoading}
            className="auth-button" 
            style={{background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #ec4899 100%)'}}
          >
            {notificationLoading ? 'Configurando...' : 'Habilitar Notificaciones'}
          </button>
        ) : (
          <button 
            onClick={sendHelloNotification} 
            className="auth-button" 
            style={{background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)'}}
          >
            👋 Enviar Notificación de Prueba
          </button>
        )}
      </div>

      <div className="user-info">
        <h2>Enviar Notificación Personalizada</h2>
        
        {loading && users.length === 0 ? (
          <p style={{color: '#9ca3af', textAlign: 'center'}}>Cargando usuarios...</p>
        ) : (
          <>
            <select
              onChange={(e) => setSelectedUser(e.target.value)}
              value={selectedUser}
              className="auth-input"
            >
              <option value="" disabled>Seleccionar usuario</option>
              {users.map((u) => (
                <option key={u._id || u.id} value={u._id || u.id}>
                  {u.name} - {u.email}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Título de la notificación"
              value={notifTitle}
              onChange={(e) => setNotifTitle(e.target.value)}
              className="auth-input"
            />

            <textarea
              placeholder="Contenido del mensaje"
              value={notifBody}
              onChange={(e) => setNotifBody(e.target.value)}
              className="auth-input"
            />

            <button
              onClick={sendCustomNotification}
              className="auth-button"
              style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' }}
            >
            Enviar Notificación
            </button>
          </>
        )}
      </div>

      <div className="user-info">
        <button onClick={onLogout} className="logout-button">
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
};

export default Dashboard;