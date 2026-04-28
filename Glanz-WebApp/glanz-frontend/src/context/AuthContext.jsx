import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  // Prevents React Strict Mode's double effect invocation from sending two
  // concurrent /Auth/refresh requests.  If the server rotates refresh tokens
  // (single-use), the second request would arrive with an already-invalidated
  // cookie and return 401 — logging the user out.  The ref survives the fake
  // unmount/remount cycle in Strict Mode, so only one request is ever sent.
  const initCalledRef = useRef(false);

  const persistSession = (nextToken, nextUser) => {
    setAuthToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
  };

  useEffect(() => {
    if (initCalledRef.current) return;
    initCalledRef.current = true;

    const initAuth = async () => {
      try {
        // HttpOnly refresh-token cookie is sent automatically by the browser.
        // This silently re-issues an access token so the user stays logged in
        // across page reloads without storing anything in localStorage.
        const refreshed = await authAPI.refresh();
        // Apply the new access token to axios BEFORE calling /Auth/me,
        // otherwise the request goes out unauthenticated and returns 401.
        setAuthToken(refreshed.token);
        const currentUser = await authAPI.getCurrentUser();
        setToken(refreshed.token);
        setUser(currentUser);
        startNotificationConnection().catch(() => {});
      } catch {
        // No valid refresh token — user must log in manually.
        setAuthToken(null);
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
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