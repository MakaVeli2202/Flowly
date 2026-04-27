import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api/auth';
import { setAuthToken } from '../api/axios';
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
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const persistSession = (nextToken, nextUser) => {
    setAuthToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        // The HttpOnly refresh-token cookie is sent automatically.
        // This silently re-issues an access token so the user stays
        // logged in across page reloads without touching localStorage.
        const refreshed = await authAPI.refresh();
        const currentUser = await authAPI.getCurrentUser();
        persistSession(refreshed.token, currentUser);
        startNotificationConnection().catch(() => {});
      } catch {
        // No valid refresh token — user must log in.
        setAuthToken(null);
        setToken(null);
        setUser(null);
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
    setUser(currentUser);
    return currentUser;
  };

  const updateProfile = async (profileData) => {
    const updatedUser = await authAPI.updateProfile(profileData);
    setUser(updatedUser);
    return updatedUser;
  };

  const uploadProfileImage = async (formData) => {
    const updatedUser = await authAPI.uploadProfileImage(formData);
    setUser(updatedUser);
    return updatedUser;
  };

  const changePassword = async (passwordData) => {
    return authAPI.changePassword(passwordData);
  };

  const logout = () => {
    stopNotificationConnection();
    authAPI.logout();
    setAuthToken(null);
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