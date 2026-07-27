import axios from 'axios';
import { getToken, isTokenExpired, clearAuthAndRedirect } from './auth-utils';

// Единственный источник правды для базового URL
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
export const API_URL = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;
export const API_BASE_URL = API_URL;

// Хелперы для legacy fetch-кода (config.ts / api-config.ts ре-экспортируют)
export const getApiUrl = (path: string): string => {
  if (path.startsWith('http')) return path;
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${API_URL}/${cleanPath}`;
};

export const getAuthHeaders = (): Record<string, string> => {
  const token = getToken();
  if (!token) return {};
  if (isTokenExpired(token)) {
    clearAuthAndRedirect();
    return {};
  }
  return { Authorization: `Bearer ${token}` };
};

// Axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — токен + проверка expiry
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      if (isTokenExpired(token)) {
        clearAuthAndRedirect();
        return Promise.reject(new axios.Cancel('Token expired'));
      }
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — 401 = сессия истекла на сервере
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isCancel(error)) return Promise.reject(error);
    const status = error?.response?.status;
    if (status === 401) {
      const url = error?.config?.url || '';
      const isAuth = url.includes('/auth/login') || url.includes('/auth/register');
      if (!isAuth) {
        clearAuthAndRedirect();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
