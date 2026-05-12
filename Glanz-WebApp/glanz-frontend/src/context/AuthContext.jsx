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

function decodeUserFromToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      id: payload.sub || payload.nameidentifier || payload.nameid,
      role: payload.role
        || payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
        || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'],
      email: payload.email
        || payload.emailaddress
        || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
      userName: payload.name
        || payload.unique_name
        || payload.given_name
        || payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'],
    };
  } catch {
    return null;
  }
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
        const hasSession = localStorage.getItem('glanz_session_active') === 'true';
        if (!hasSession) {
          setLoading(false);
          return;
        }

        const refreshed = await authAPI.refresh();
        setAuthToken(refreshed.token);

        // Try fetching full user profile — but don't let failure cascade.
        // If getCurrentUser 401's, the axios interceptor will try another
        // /Auth/refresh, consuming the already-used cookie and clearing the
        // valid access token.  We catch that, re-apply the token we already
        // have, and fall back to JWT decoding for role info.
        let currentUser = refreshed.user || null;
        if (!currentUser) {
          try {
            currentUser = await authAPI.getCurrentUser();
          } catch {
            setAuthToken(refreshed.token);
            currentUser = decodeUserFromToken(refreshed.token);
          }
        }

        setToken(refreshed.token);
        setUser(currentUser);

        await realtimeService.connect(refreshed.token);
        startNotificationConnection();
      } catch {
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