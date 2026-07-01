import React, { createContext, useState, useEffect, useContext, useRef } from 'react';

const AuthContext = createContext(null);

export const API_BASE_URL = window.location.origin.includes('localhost:5173')
  ? 'http://localhost:8000'
  : window.location.origin;

export const WS_BASE_URL = window.location.origin.includes('localhost:5173')
  ? 'ws://localhost:8000'
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;


export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('blink_token') || null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);

  // Authenticate user on mount if token exists
  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        } else {
          // Token expired or invalid
          logout();
        }
      } catch (err) {
        console.error('Error fetching user data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMe();
  }, [token]);

  // Handle WebSocket Connection
  useEffect(() => {
    // Only connect if authenticated and approved/admin
    const shouldConnect = token && user && (user.role === 'ADMIN' || user.status === 'APPROVED');
    
    if (!shouldConnect) {
      if (socket) {
        socket.close();
        setSocket(null);
        setIsSocketConnected(false);
      }
      return;
    }

    let ws = null;
    
    const connectWS = () => {
      console.log('Connecting to WebSocket...');
      ws = new WebSocket(`${WS_BASE_URL}/ws?token=${token}`);
      
      ws.onopen = () => {
        console.log('WebSocket Connected');
        setIsSocketConnected(true);
        setSocket(ws);
      };
      
      ws.onclose = (event) => {
        console.log('WebSocket Closed:', event.reason);
        setIsSocketConnected(false);
        setSocket(null);
        
        // Attempt to reconnect if user is still logged in and approved
        if (token) {
          console.log('Reconnecting in 3 seconds...');
          reconnectTimeoutRef.current = setTimeout(connectWS, 3000);
        }
      };
      
      ws.onerror = (err) => {
        console.error('WebSocket Error:', err);
        ws.close();
      };
    };

    connectWS();

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [token, user]);

  const login = async (usernameOrEmail, password) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username_or_email: usernameOrEmail, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.detail || 'Login failed');
    }
    
    localStorage.setItem('blink_token', data.access_token);
    setToken(data.access_token);
    setUser(data.user);
    return data.user;
  };

  const register = async (username, email, password) => {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, email, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.detail || 'Registration failed');
    }
    
    return data;
  };

  const logout = () => {
    localStorage.removeItem('blink_token');
    setToken(null);
    setUser(null);
    if (socket) {
      socket.close();
    }
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data);
        return data;
      }
    } catch (err) {
      console.error('Error refreshing user status:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      login, 
      register, 
      logout, 
      refreshUser,
      socket, 
      isSocketConnected 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
