import axios from 'axios';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5289/api';

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,  // send HttpOnly refresh token cookie on every request
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '1',
  },
});

// ── In-memory token store (never touches localStorage) ────────────────────────
// The access token lives only in JS heap. The HttpOnly refresh-token cookie
// is sent automatically by the browser and is inaccessible to JS.
export function setAuthToken(token) {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
  }
}

apiClient.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

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
    const currentPath = window.location.pathname;
    const isAuthPage = currentPath === '/login' || currentPath === '/register';
    const isRefreshEndpoint = originalRequest?.url?.includes('/Auth/refresh');

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthPage &&
      !isRefreshEndpoint
    ) {
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
        const res = await apiClient.post('/Auth/refresh');
        const newToken = res.data.token;
        setAuthToken(newToken);
        flushQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        flushQueue(refreshError, null);
        setAuthToken(null);
        window.location.replace('/login');
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
