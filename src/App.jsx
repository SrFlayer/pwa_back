import { useState, useEffect } from 'react';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import apiService from './services/apiService';
import './App.css';

function App() {
  const [currentView, setCurrentView] = useState('login'); // 'login', 'register', 'dashboard'
  const [user, setUser] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    // Verificar si hay usuario guardado en localStorage
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setCurrentView('dashboard');
    }

    // Listeners para estado de conexión
    const handleOnline = () => {
      setIsOnline(true);
      console.log('Conexión restaurada');
      
      // Registrar background sync
      if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        navigator.serviceWorker.ready.then(registration => {
          return registration.sync.register('background-sync');
        }).then(() => {
          console.log('Background sync registrado');
        }).catch(err => {
          console.log('Background sync no soportado, usando método alternativo');
          // Fallback: sincronizar directamente
          apiService.syncOfflineData();
        });
      } else {
        // Fallback para navegadores que no soportan background sync
        console.log('Background sync no soportado, sincronizando directamente');
        apiService.syncOfflineData();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('Sin conexión');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogin = async (credentials) => {
    try {
      const response = await apiService.login(credentials);
      
      if (response.status === 'success') {
        setUser(response.user);
        localStorage.setItem('user', JSON.stringify(response.user));
        setCurrentView('dashboard');
      } else {
        throw new Error(response.message || 'Error en el login');
      }
    } catch (error) {
      throw error;
    }
  };

  const handleRegister = async (userData) => {
    try {
      const response = await apiService.register(userData);
      
      if (response.status === 'success') {
        // Después del registro exitoso, hacer login automático
        await handleLogin({
          email: userData.email,
          password: userData.password
        });
      } else {
        throw new Error(response.message || 'Error en el registro');
      }
    } catch (error) {
      throw error;
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    setCurrentView('login');
  };

  const switchToRegister = () => {
    setCurrentView('register');
  };

  const switchToLogin = () => {
    setCurrentView('login');
  };

  return (
    <div className="App">
      {!isOnline && (
        <div className="offline-indicator">
          Sin conexión - Los datos se guardarán offline y se sincronizarán cuando vuelva la conexión
        </div>
      )}
      
      {currentView === 'login' && (
        <Login 
          onLogin={handleLogin}
          onSwitchToRegister={switchToRegister}
        />
      )}
      
      {currentView === 'register' && (
        <Register 
          onRegister={handleRegister}
          onSwitchToLogin={switchToLogin}
        />
      )}
      
      {currentView === 'dashboard' && user && (
        <Dashboard 
          user={user}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;
