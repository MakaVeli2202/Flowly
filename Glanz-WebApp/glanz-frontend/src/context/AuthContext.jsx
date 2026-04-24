import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/auth';
import { startNotificationConnection, stopNotificationConnection } from '../api/signalr';

const AuthContext = createContext();

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const persistSession = (nextToken, nextUser) => {
    localStorage.setItem('token', nextToken);
    localStorage.setItem('user', JSON.stringify(nextUser));
    setToken(nextToken);
    setUser(nextUser);
  };

  // Start SignalR on cold-start resume when token already exists
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      startNotificationConnection().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('token');

      if (savedToken) {
        try {
          const currentUser = await authAPI.getCurrentUser();
          persistSession(savedToken, currentUser);
        } catch {
          authAPI.logout();
          setToken(null);
          setUser(null);
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    persistSession(response.token, response.user);
    startNotificationConnection().catch(() => {});
    return response;
  };

  const register = async (userData) => {
    const response = await authAPI.register(userData);
    persistSession(response.token, response.user);
    startNotificationConnection().catch(() => {});
    return response;
  };

  const refreshUser = async () => {
    const currentUser = await authAPI.getCurrentUser();
    const savedToken = localStorage.getItem('token');

    if (savedToken) {
      persistSession(savedToken, currentUser);
    } else {
      setUser(currentUser);
    }

    return currentUser;
  };

  const updateProfile = async (profileData) => {
    const updatedUser = await authAPI.updateProfile(profileData);
    const savedToken = localStorage.getItem('token');

    if (savedToken) {
      persistSession(savedToken, updatedUser);
    } else {
      setUser(updatedUser);
    }

    return updatedUser;
  };

  const uploadProfileImage = async (formData) => {
    const updatedUser = await authAPI.uploadProfileImage(formData);
    const savedToken = localStorage.getItem('token');

    if (savedToken) {
      persistSession(savedToken, updatedUser);
    } else {
      setUser(updatedUser);
    }

    return updatedUser;
  };

  const changePassword = async (passwordData) => {
    return authAPI.changePassword(passwordData);
  };

  const logout = () => {
    stopNotificationConnection();
    authAPI.logout();
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    isAuthenticated: !!token,
    isAdmin: user?.role === 'Admin',
    isWorker: user?.role === 'Worker',
    login,
    register,
    refreshUser,
    updateProfile,
    uploadProfileImage,
    changePassword,
    logout,
    loading
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}