import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

// Called by AuthContext to trigger logout when any request returns 401
let _onUnauthorized = null;
let _handlingUnauthorized = false;  // guard against re-entrant 401 loops
export const setUnauthorizedHandler = (fn) => {
  _onUnauthorized = fn;
  _handlingUnauthorized = false;  // reset guard whenever handler is replaced
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      if (!_handlingUnauthorized) {
        _handlingUnauthorized = true;
        _onUnauthorized?.();
      }
    }

    if (!error?.response?.data?.message) {
      if (status === 401) {
        error.response = error.response || {};
        error.response.data = { message: 'Unauthorized - please login again' };
      } else if (status === 403) {
        error.response = error.response || {};
        error.response.data = { message: 'Forbidden - you do not have permission' };
      } else if (status === 404) {
        error.response = error.response || {};
        error.response.data = { message: 'Not found - booking may have been deleted' };
      } else if (status >= 500) {
        error.response = error.response || {};
        error.response.data = { message: `Server error (${status})` };
      } else if (!status) {
        error.response = { data: { message: 'Network error - check connection' } };
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
