import axios from 'axios';
import type { AuthResponse, Task, Subtask, List } from '../types';

const API_URL = 'http://localhost:8080';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

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

// Add a response interceptor to handle 401 errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only clear token if we had one (avoid redirect loop on login page)
      const hadToken = localStorage.getItem('token');
      localStorage.removeItem('token');
      
      // If we had a token and got 401, it's expired/invalid - redirect to login
      if (hadToken && !window.location.pathname.includes('/login')) {
        window.location.reload();
      }
    }
    return Promise.reject(error);
  }
);

export const auth = {
  register: (email: string, password: string, displayName?: string) =>
    api.post<AuthResponse>('/api/auth/register', { email, password, displayName }),
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/api/auth/login', { email, password }),
  logout: () => api.post('/api/auth/logout'),
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


