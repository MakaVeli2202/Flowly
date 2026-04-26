import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../api/auth';
import { startNotificationConnection, stopNotificationConnection } from '../api/signalr';
import { registerForPushNotificationsAsync } from '../utils/pushNotifications';
import { setUnauthorizedHandler } from '../api/axios';

async function syncPushToken() {
  try {
    const token = await registerForPushNotificationsAsync();
    if (token) await authAPI.registerPushToken(token);
  } catch {
    // Non-critical — silent fail
  }
}

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('token');
        const savedUser  = await AsyncStorage.getItem('user');

        if (!savedToken) return;

        setToken(savedToken);

        try {
          const freshUser = await authAPI.getCurrentUser();
          await AsyncStorage.setItem('user', JSON.stringify(freshUser));
          setUser(freshUser);
        } catch (err) {
          const status = err?.response?.status;
          if (status === 401 || status === 403) {
            // Access token expired — try silent refresh before giving up
            try {
              const storedRefresh = await AsyncStorage.getItem('refreshToken');
              if (!storedRefresh) throw new Error('no refresh token');
              const res = await authAPI.refresh(storedRefresh);
              await AsyncStorage.setItem('token', res.token);
              if (res.refreshToken) {
                await AsyncStorage.setItem('refreshToken', res.refreshToken);
              }
              setToken(res.token);
              // Re-fetch user with the new token
              const freshUser = await authAPI.getCurrentUser();
              await AsyncStorage.setItem('user', JSON.stringify(freshUser));
              setUser(freshUser);
            } catch {
              // Refresh also failed — clear everything and force login
              await AsyncStorage.multiRemove(['token', 'refreshToken', 'user']);
              setToken(null);
              setUser(null);
              return;
            }
          } else if (savedUser) {
            // Network/server error — use stale user for offline access
            setUser(JSON.parse(savedUser));
          }
        }

        syncPushToken();
        startNotificationConnection().catch(() => {});
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    await AsyncStorage.setItem('token', res.token);
    if (res.refreshToken) await AsyncStorage.setItem('refreshToken', res.refreshToken);
    await AsyncStorage.setItem('user', JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
    syncPushToken();
    startNotificationConnection().catch(() => {});
    return res;
  };

  const register = async (data) => {
    const res = await authAPI.register(data);
    await AsyncStorage.setItem('token', res.token);
    if (res.refreshToken) await AsyncStorage.setItem('refreshToken', res.refreshToken);
    await AsyncStorage.setItem('user', JSON.stringify(res.user));
    setToken(res.token);
    setUser(res.user);
    syncPushToken();
    startNotificationConnection().catch(() => {});
    return res;
  };

  const refreshUser = async () => {
    const freshUser = await authAPI.getCurrentUser();
    await AsyncStorage.setItem('user', JSON.stringify(freshUser));
    setUser(freshUser);
    return freshUser;
  };

  const updateProfile = async (data) => {
    const updatedUser = await authAPI.updateProfile(data);
    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    return updatedUser;
  };

  const uploadProfileImage = async (formData) => {
    const updatedUser = await authAPI.uploadProfileImage(formData);
    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    return updatedUser;
  };

  const changePassword = async (data) => authAPI.changePassword(data);

  const logout = async () => {
    setUnauthorizedHandler(null); // prevent 401 loop during cleanup
    await stopNotificationConnection();
    try { await authAPI.clearPushToken(); } catch { /* non-critical */ }
    try { await authAPI.logout(); } catch { /* best-effort server-side revoke */ }
    await AsyncStorage.multiRemove(['token', 'refreshToken', 'user']);
    setToken(null);
    setUser(null);
  };

  // Wire up the axios 401 interceptor to trigger logout automatically
  useEffect(() => {
    setUnauthorizedHandler(logout);
    return () => setUnauthorizedHandler(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo(() => ({
    user,
    token,
    loading,
    isAuthenticated: !!token,
    isAdmin: user?.role === 'Admin',
    isWorker: user?.role === 'Employee',
    // Add shift fields for worker
    workingDays: user?.workingDays || 'Saturday,Sunday,Monday,Tuesday,Wednesday,Thursday',
    shiftStart: user?.shiftStart || '08:00',
    shiftEnd: user?.shiftEnd || '16:00',
    login,
    register,
    refreshUser,
    updateProfile,
    uploadProfileImage,
    changePassword,
    logout,
  }), [user, token, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
