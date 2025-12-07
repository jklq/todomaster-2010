import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasks, subtasks } from '../api/client';
import type { Task, Subtask, FilterType } from '../types';

export function useTasks() {
  return useQuery({
    queryKey: ['tasks'],
    queryFn: tasks.getAll,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

interface CreateTaskOptions {
  text: string;
  filter?: FilterType;
  tags?: string[];
  listId?: number;
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ text, filter, tags, listId }: CreateTaskOptions) => {
      // Determine initial state based on current filter
      const important = filter === 'important';
      const completed = filter === 'completed';
      return tasks.create(text, { tags, important, completed, listId });
    },
    onMutate: async ({ text, filter, tags, listId }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks']);

      const tempId = Date.now();
      const optimisticTask: Task = {
        id: tempId, // Temporary ID
        userId: 0,
        text,
        completed: filter === 'completed',
        important: filter === 'important',
        isExpanded: false,
        sortOrder: previousTasks ? previousTasks.length + 1 : 1, // Append to end
        tags: tags || [],
        listId,
        subtasks: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (previousTasks) {
        queryClient.setQueryData<Task[]>(['tasks'], [...previousTasks, optimisticTask]);
      } else {
        queryClient.setQueryData<Task[]>(['tasks'], [optimisticTask]);
      }

      return { previousTasks, tempId };
    },
    onSuccess: (newTask, _variables, context) => {
      // Remove the optimistic task and add the real one
      // This handles the race with WebSocket by filtering out both temp and real IDs
      const currentTasks = queryClient.getQueryData<Task[]>(['tasks']);
      if (currentTasks && context?.tempId) {
        // Filter out both the temp item AND any duplicate real item (from WebSocket)
        const filtered = currentTasks.filter(
          task => task.id !== context.tempId && task.id !== newTask.id
        );
        queryClient.setQueryData<Task[]>(['tasks'], [...filtered, newTask]);
      }
    },
    onError: (_err, _newTodo, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData<Task[]>(['tasks'], context.previousTasks);
      }
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<Task> }) => tasks.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks']);

      if (previousTasks) {
        queryClient.setQueryData<Task[]>(['tasks'], previousTasks.map(task => 
          task.id === id ? { ...task, ...updates, updatedAt: new Date().toISOString() } : task
        ));
      }

      return { previousTasks };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData<Task[]>(['tasks'], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => tasks.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks']);

      if (previousTasks) {
        queryClient.setQueryData<Task[]>(['tasks'], previousTasks.filter(task => task.id !== id));
      }

      return { previousTasks };
    },
    onError: (_err, _id, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData<Task[]>(['tasks'], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useReorderTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskIds: number[]) => tasks.reorder(taskIds),
    onMutate: async (taskIds) => {
        await queryClient.cancelQueries({ queryKey: ['tasks'] });
        const previousTasks = queryClient.getQueryData<Task[]>(['tasks']);

        if (previousTasks) {
            // Reorder in memory
            const taskMap = new Map(previousTasks.map(t => [t.id, t]));
            const newOrder = taskIds.map((id, index) => {
                const t = taskMap.get(id);
                if (t) return { ...t, sortOrder: index };
                return undefined;
            }).filter((t): t is Task => !!t);

            // Add any missing tasks to the end (shouldn't happen ideally)
             const missing = previousTasks.filter(t => !taskIds.includes(t.id));
             
            queryClient.setQueryData<Task[]>(['tasks'], [...newOrder, ...missing]);
        }
        return { previousTasks };
    },
    onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
    }
  })
}


// --- SUBTASKS ---

export function useCreateSubtask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, text }: { taskId: number; text: string }) => subtasks.create(taskId, text),
    onMutate: async ({ taskId, text }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks']);

      if (previousTasks) {
        const optimisticSubtask: Subtask = {
          id: Date.now(),
          taskId,
          text,
          completed: false,
          sortOrder: 999,
          createdAt: new Date().toISOString(),
        };

        queryClient.setQueryData<Task[]>(['tasks'], previousTasks.map(task => {
          if (task.id === taskId) {
            return {
              ...task,
              subtasks: [...(task.subtasks || []), optimisticSubtask]
            };
          }
          return task;
        }));
      }

      return { previousTasks };
    },
    onError: (_err, _vars, context) => {
        if (context?.previousTasks) {
            queryClient.setQueryData(['tasks'], context.previousTasks);
        }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateSubtask() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, updates }: { id: number; updates: Partial<Subtask> }) => subtasks.update(id, updates),
        onMutate: async ({ id, updates }) => {
            await queryClient.cancelQueries({ queryKey: ['tasks'] });
            const previousTasks = queryClient.getQueryData<Task[]>(['tasks']);

            if (previousTasks) {
                queryClient.setQueryData<Task[]>(['tasks'], previousTasks.map(task => {
                    if (task.subtasks?.some(s => s.id === id)) {
                         return {
                             ...task,
                             subtasks: task.subtasks.map(s => s.id === id ? { ...s, ...updates } : s)
                         }
                    }
                    return task;
                }));
            }
            return { previousTasks };
        },
        onSettled: () => {
             queryClient.invalidateQueries({ queryKey: ['tasks'] });
        }
    });

}

export function useDeleteSubtask() {
    const queryClient = useQueryClient();
  
    return useMutation({
      mutationFn: (id: number) => subtasks.delete(id),
      onMutate: async (id) => {
        await queryClient.cancelQueries({ queryKey: ['tasks'] });
        const previousTasks = queryClient.getQueryData<Task[]>(['tasks']);
  
        if (previousTasks) {
          queryClient.setQueryData<Task[]>(['tasks'], previousTasks.map(task => {
            if (task.subtasks?.some(s => s.id === id)) {
                 return {
                     ...task,
                     subtasks: task.subtasks.filter(s => s.id !== id)
                 }
            }
            return task;
          }));
        }
  
        return { previousTasks };
      },
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      },
    });
  }
