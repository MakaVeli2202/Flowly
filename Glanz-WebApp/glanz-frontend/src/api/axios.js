import axios from 'axios';
const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5289/api';
const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': '1',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const currentPath = window.location.pathname;
    const isAuthPage = currentPath === '/login' || currentPath === '/register';

    if (error.response?.status === 401 && !isAuthPage) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.replace('/login');
    }

    return Promise.reject(error);
  }
);

export default apiClient;