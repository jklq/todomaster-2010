import { useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Task, Subtask, List } from '../types';

// Construct WebSocket URL from API URL environment variable
const getWebSocketUrl = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';
  // Convert http:// to ws:// and https:// to wss://
  const wsUrl = apiUrl.replace(/^http/, 'ws');
  return `${wsUrl}/ws`;
};

const WS_URL = getWebSocketUrl();

interface WebSocketEvent {
  type: string;
  payload: unknown;
}

interface TaskPayload extends Task {}
interface DeletedPayload {
  id: number;
}
interface ReorderPayload {
  taskIds: number[];
}
interface SubtaskPayload extends Subtask {}
interface ListPayload extends List {}

export function useWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 10;
  const isConnecting = useRef(false);

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('No token available, skipping WebSocket connection');
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (isConnecting.current || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    isConnecting.current = true;

    try {
      const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        reconnectAttempts.current = 0;
        isConnecting.current = false;
      };

      ws.onmessage = (event) => {
        try {
          // Handle potential multiple messages in one frame (newline separated)
          const messages = event.data.split('\n').filter((msg: string) => msg.trim());
          
          for (const message of messages) {
            const wsEvent: WebSocketEvent = JSON.parse(message);
            handleWebSocketEvent(wsEvent);
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        isConnecting.current = false;
      };

      ws.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        wsRef.current = null;
        isConnecting.current = false;

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts && localStorage.getItem('token')) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(`Attempting to reconnect in ${delay}ms...`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        }
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      isConnecting.current = false;
    }
  }, []);

  const handleWebSocketEvent = useCallback((event: WebSocketEvent) => {
    console.log('WebSocket event received:', event.type);
    
    const tasks = queryClient.getQueryData<Task[]>(['tasks']);
    if (!tasks) return;

    switch (event.type) {
      case 'task_created': {
        const newTask = event.payload as TaskPayload;
        // Check if task already exists (from optimistic update)
        if (!tasks.some(t => t.id === newTask.id)) {
          queryClient.setQueryData<Task[]>(['tasks'], [...tasks, newTask]);
        }
        break;
      }

      case 'task_updated': {
        const updatedTask = event.payload as TaskPayload;
        queryClient.setQueryData<Task[]>(['tasks'], tasks.map(task =>
          task.id === updatedTask.id ? updatedTask : task
        ));
        break;
      }

      case 'task_deleted': {
        const { id } = event.payload as DeletedPayload;
        queryClient.setQueryData<Task[]>(['tasks'], tasks.filter(task => task.id !== id));
        break;
      }

      case 'tasks_reordered': {
        const { taskIds } = event.payload as ReorderPayload;
        const taskMap = new Map(tasks.map(t => [t.id, t]));
        const reorderedTasks = taskIds
          .map((id, index) => {
            const task = taskMap.get(id);
            return task ? { ...task, sortOrder: index } : undefined;
          })
          .filter((t): t is Task => t !== undefined);
        
        // Include any tasks not in the reorder list
        const missingTasks = tasks.filter(t => !taskIds.includes(t.id));
        queryClient.setQueryData<Task[]>(['tasks'], [...reorderedTasks, ...missingTasks]);
        break;
      }

      case 'subtask_created': {
        const newSubtask = event.payload as SubtaskPayload;
        queryClient.setQueryData<Task[]>(['tasks'], tasks.map(task => {
          if (task.id === newSubtask.taskId) {
            // Check if subtask already exists
            if (!task.subtasks?.some(s => s.id === newSubtask.id)) {
              return {
                ...task,
                subtasks: [...(task.subtasks || []), newSubtask]
              };
            }
          }
          return task;
        }));
        break;
      }

      case 'subtask_updated': {
        const updatedSubtask = event.payload as SubtaskPayload;
        queryClient.setQueryData<Task[]>(['tasks'], tasks.map(task => ({
          ...task,
          subtasks: task.subtasks?.map(s =>
            s.id === updatedSubtask.id ? updatedSubtask : s
          )
        })));
        break;
      }

      case 'subtask_deleted': {
        const { id } = event.payload as DeletedPayload;
        queryClient.setQueryData<Task[]>(['tasks'], tasks.map(task => ({
          ...task,
          subtasks: task.subtasks?.filter(s => s.id !== id)
        })));
        break;
      }

      case 'list_created': {
        const newList = event.payload as ListPayload;
        const lists = queryClient.getQueryData<List[]>(['lists']);
        if (lists && !lists.some(l => l.id === newList.id)) {
          queryClient.setQueryData<List[]>(['lists'], [...lists, newList]);
        }
        break;
      }

      case 'list_updated': {
        const updatedList = event.payload as ListPayload;
        const lists = queryClient.getQueryData<List[]>(['lists']);
        if (lists) {
          queryClient.setQueryData<List[]>(['lists'], lists.map(list =>
            list.id === updatedList.id ? updatedList : list
          ));
        }
        break;
      }

      case 'list_deleted': {
        const { id } = event.payload as DeletedPayload;
        const lists = queryClient.getQueryData<List[]>(['lists']);
        if (lists) {
          queryClient.setQueryData<List[]>(['lists'], lists.filter(list => list.id !== id));
        }
        break;
      }

      default:
        console.log('Unknown WebSocket event type:', event.type);
    }
  }, [queryClient]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();

    // Listen for storage changes (login/logout in other tabs)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'token') {
        if (e.newValue) {
          connect();
        } else {
          disconnect();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    reconnect: connect,
    disconnect,
  };
}
