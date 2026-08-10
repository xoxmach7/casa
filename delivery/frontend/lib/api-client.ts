import axios from 'axios';
import { clearAuthAndRedirect } from './auth-utils';

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

// Авторизацию несёт httpOnly-cookie, а не заголовок (см.
// docs/SECURITY-AUDIT-2026-08-10.md, MEDIUM-3). Функция оставлена ради десятков
// вызовов `fetch(url, { headers: getAuthHeaders() })`: пустой объект безвреден,
// а cookie к этим запросам добавляет глобальный патч из lib/api-credentials.
export const getAuthHeaders = (): Record<string, string> => {
  return {};
};

// Axios instance — с cookie (withCredentials), заголовок с токеном больше не шлём.
const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Response interceptor — 401 значит сессия истекла/невалидна на сервере.
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
