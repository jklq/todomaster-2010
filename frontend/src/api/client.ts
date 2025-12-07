import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { AuthResponse, Task, Subtask, List } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Store for tracking if we're currently refreshing
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
  config: InternalAxiosRequestConfig;
}> = [];

const processQueue = (error: Error | null = null) => {
  failedQueue.forEach(({ resolve, reject, config }) => {
    if (error) {
      reject(error);
    } else {
      // Retry with new token
      resolve(api(config));
    }
  });
  failedQueue = [];
};

// Add a request interceptor to include the JWT token
api.interceptors.request.use(
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

// Add a response interceptor to handle 401 errors with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only handle 401 errors
    if (error.response?.status !== 401 || !originalRequest) {
      return Promise.reject(error);
    }

    // Don't try to refresh if this is already a retry or if it's the refresh endpoint itself
    if (originalRequest._retry || originalRequest.url?.includes('/api/auth/refresh')) {
      // Clear everything and redirect to login
      handleAuthFailure();
      return Promise.reject(error);
    }

    const refreshToken = localStorage.getItem('refreshToken');
    
    // No refresh token available - clear and redirect
    if (!refreshToken) {
      handleAuthFailure();
      return Promise.reject(error);
    }

    // If we're already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject, config: originalRequest });
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      // Try to refresh the token
      const response = await axios.post<AuthResponse>(`${API_URL}/api/auth/refresh`, {
        refreshToken,
      });

      const { accessToken, refreshToken: newRefreshToken } = response.data;
      
      // Store new tokens
      localStorage.setItem('token', accessToken);
      localStorage.setItem('refreshToken', newRefreshToken);

      // Update the original request with new token
      originalRequest.headers.Authorization = `Bearer ${accessToken}`;

      // Process queued requests
      processQueue();
      
      // Retry the original request
      return api(originalRequest);
    } catch (refreshError) {
      // Refresh failed - clear everything and redirect to login
      processQueue(refreshError as Error);
      handleAuthFailure();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

// Helper to handle auth failure (clear tokens and redirect)
function handleAuthFailure() {
  const hadToken = localStorage.getItem('token');
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
  
  if (hadToken && !window.location.pathname.includes('/login')) {
    window.location.reload();
  }
}

export const auth = {
  register: (email: string, password: string, displayName?: string) =>
    api.post<AuthResponse>('/api/auth/register', { email, password, displayName }),
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/api/auth/login', { email, password }),
  logout: () => api.post('/api/auth/logout'),
  refresh: (refreshToken: string) =>
    api.post<AuthResponse>('/api/auth/refresh', { refreshToken }),
  getMe: () => api.get<AuthResponse['user']>('/api/user/me').then((res) => res.data),
  updateProfile: (displayName: string) =>
    api.put<AuthResponse['user']>('/api/user/me', { displayName }).then((res) => res.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<{ message: string }>('/api/user/password', { currentPassword, newPassword }).then((res) => res.data),
  deleteAccount: () => api.delete('/api/user/me'),
};

export const tasks = {
  getAll: () => api.get<Task[]>('/api/tasks').then((res) => res.data),
  create: (text: string, options?: { tags?: string[]; important?: boolean; completed?: boolean; listId?: number }) =>
    api.post<Task>('/api/tasks', { text, ...options }).then((res) => res.data),
  update: (id: number, updates: Partial<Task>) =>
    api.put<Task>(`/api/tasks/${id}`, updates).then((res) => res.data),
  delete: (id: number) => api.delete(`/api/tasks/${id}`),
  reorder: (taskIds: number[]) => api.post('/api/tasks/reorder', { taskIds }),
};

export const subtasks = {
  create: (taskId: number, text: string) =>
    api.post<Subtask>(`/api/tasks/${taskId}/subtasks`, { text }).then((res) => res.data),
  update: (id: number, updates: Partial<Subtask>) =>
    api.put<Subtask>(`/api/subtasks/${id}`, updates).then((res) => res.data),
  delete: (id: number) => api.delete(`/api/subtasks/${id}`),
};

export const lists = {
  getAll: () => api.get<List[]>('/api/lists').then((res) => res.data),
  create: (title: string) => api.post<List>('/api/lists', { title }).then((res) => res.data),
  update: (id: number, title: string) => api.put<List>(`/api/lists/${id}`, { title }).then((res) => res.data),
  delete: (id: number) => api.delete(`/api/lists/${id}`),
};

