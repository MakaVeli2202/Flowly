import axios from 'axios';

// Runtime API URL resolution (priority order):
//   1. window.__CONFIG__.API_URL  — set by nginx sub_filter or manually in index.html
//   2. VITE_API_BASE_URL env var  — baked at build time
//   3. '/api'                     — Vite proxy (dev) or nginx reverse proxy (prod)
// HttpOnly refresh cookies with SameSite=Lax are NOT sent cross-origin,
// so production MUST serve API on the same origin or via a reverse proxy.
// For a truly separate API domain, set __CONFIG__.API_URL in index.html
// or pass VITE_API_BASE_URL at build time.
const API_URL = (typeof window !== 'undefined' && window.__CONFIG__?.API_URL)
  || import.meta.env.VITE_API_BASE_URL
  || '/api';

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  console.info(`[API CONFIG] Using API base URL: ${API_URL}`);
}

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
let hasAuthToken = false;

export function setAuthToken(token) {
  if (token) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    hasAuthToken = true;
  } else {
    delete apiClient.defaults.headers.common['Authorization'];
    hasAuthToken = false;
  }
}

apiClient.interceptors.request.use(
  (config) => {
    const storedLang = localStorage.getItem('lang');
    const browserLang = navigator.language?.split('-')[0];
    const lang = storedLang || browserLang || 'en';

    config.headers = config.headers || {};
    config.headers['Accept-Language'] = lang;
    config.headers['X-Language'] = lang;

    return config;
  },
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
    if (!error?.response) {
      console.error(
        '[API NETWORK ERROR] Request failed before receiving a response. ' +
        'Likely causes: CORS origin mismatch, HTTPS/mixed-content issue, or backend unavailable.',
        {
          url: error?.config?.url,
          baseURL: error?.config?.baseURL,
          method: error?.config?.method,
        }
      );
    }

    const originalRequest = error.config;
    const currentPath = window.location.pathname;
    const isAuthPage = currentPath === '/login' || currentPath === '/register';
    const isRefreshEndpoint = originalRequest?.url?.includes('/Auth/refresh');

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthPage &&
      !isRefreshEndpoint &&
      hasAuthToken  // Only attempt refresh if we were logged in
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
        if (refreshError.response?.status !== 401) {
          console.error('Token refresh failed:', refreshError);
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
