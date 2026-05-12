import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { authAPI } from '../api/auth';
import { setAuthToken } from '../api/axios';
import { startNotificationConnection, stopNotificationConnection } from '../api/notificationBus';
import realtimeService from '../api/realtimeService';
import { cacheManager } from '../core/cacheManager';

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
        // Only attempt refresh if we have an active session indicator.
        // This prevents a 401 on /Auth/refresh when not logged in.
        const hasSession = localStorage.getItem('glanz_session_active') === 'true';
        if (!hasSession) {
          setLoading(false);
          return;
        }
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
        // Connect WebSocket hub and start notification bus
        await realtimeService.connect(refreshed.token);
        startNotificationConnection();
      } catch {
        // No valid refresh token — user must log in manually.
        localStorage.removeItem('glanz_session_active');
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
    if (response.user?.role === 'Employee') {
      await authAPI.logout();
      setAuthToken(null);
      setToken(null);
      setUser(null);
      throw new Error('This action is not allowed with a company account. Please use the mobile app to log in as a detailer.');
    }
    localStorage.setItem('glanz_session_active', 'true');
    persistSession(response.token, response.user);
    await realtimeService.connect(response.token);
    startNotificationConnection();
    return response;
  };

  const register = async (userData) => {
    const response = await authAPI.register(userData);
    localStorage.setItem('glanz_session_active', 'true');
    persistSession(response.token, response.user);
    await realtimeService.connect(response.token);
    startNotificationConnection();
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
    realtimeService.disconnect();
    authAPI.logout();
    localStorage.removeItem('glanz_session_active');
    setAuthToken(null);
    setToken(null);
    setUser(null);
    cacheManager.clear();
  };

    const value = {
    user,
    token,
    isAuthenticated: !!token,
    isAdmin: user?.role === 'Admin',
    isEmployee: user?.role === 'Employee',
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