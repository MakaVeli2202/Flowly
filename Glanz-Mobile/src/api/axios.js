import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { secureGet, secureSet } from '../utils/secureStorage';
import i18n from '../i18n/i18n';

// ── Unauthorized handler (wired by AuthContext) ───────────────────────────────
let _onUnauthorized = null;
let _handlingUnauthorized = false;
export const setUnauthorizedHandler = (fn) => {
  _onUnauthorized = fn;
  _handlingUnauthorized = false;
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await secureGet('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const currentLang = (i18n.language || 'en').split('-')[0].toLowerCase();
  config.headers['Accept-Language'] = currentLang;
  config.headers['X-Language'] = currentLang;

  return config;
});

// ── Token refresh state ───────────────────────────────────────────────────────
let isRefreshing = false;
let pendingQueue = [];

function flushQueue(error, token = null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  pendingQueue = [];
}

// ── Response interceptor ──────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error?.response?.status;
    const isRefreshEndpoint = originalRequest?.url?.includes('/Auth/refresh');

    if (status === 401 && !originalRequest._retry && !isRefreshEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = await secureGet('refreshToken');
        if (!refreshToken) throw new Error('No refresh token stored.');

        const res = await apiClient.post('/Auth/refresh', { refreshToken });
        const newToken = res.data.token;
        const newRefreshToken = res.data.refreshToken;

        await secureSet('token', newToken);
        if (newRefreshToken) {
          await secureSet('refreshToken', newRefreshToken);
        }

        apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        flushQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        if (!_handlingUnauthorized) {
          _handlingUnauthorized = true;
          _onUnauthorized?.();
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // ── Friendly error messages ───────────────────────────────────────────────
    if (!error?.response?.data?.message) {
      if (status === 401) {
        error.response = error.response || {};
        error.response.data = { message: 'Session expired — please login again.' };
      } else if (status === 403) {
        error.response = error.response || {};
        error.response.data = { message: 'Forbidden — you do not have permission.' };
      } else if (status === 404) {
        error.response = error.response || {};
        error.response.data = { message: 'Not found.' };
      } else if (status >= 500) {
        error.response = error.response || {};
        error.response.data = { message: `Server error (${status}).` };
      } else if (!status) {
        error.response = { data: { message: 'Network error — check your connection.' } };
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
