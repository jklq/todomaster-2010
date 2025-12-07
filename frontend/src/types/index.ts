export interface User {
  id: number;
  email: string;
  displayName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface Subtask {
  id: number;
  taskId: number;
  text: string;
  completed: boolean;
  sortOrder: number;
  createdAt: string;
}

export interface List {
  id: number;
  userId: number;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: number;
  userId: number;
  listId?: number;
  text: string;
  completed: boolean;
  important: boolean;
  isExpanded: boolean;
  sortOrder: number;
  tags?: string[];
  subtasks?: Subtask[];
  createdAt: string;
  updatedAt: string;
}

export type FilterType = 'all' | 'active' | 'completed' | 'important' | string;
