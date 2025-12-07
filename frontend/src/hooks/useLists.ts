import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { lists } from '../api/client';
import type { List, Task } from '../types';

export function useLists() {
  return useQuery({
    queryKey: ['lists'],
    queryFn: lists.getAll,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useCreateList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title: string) => lists.create(title),
    onMutate: async (title) => {
      await queryClient.cancelQueries({ queryKey: ['lists'] });
      const previousLists = queryClient.getQueryData<List[]>(['lists']);

      const tempId = Date.now();
      const optimisticList: List = {
        id: tempId, // Temporary ID
        userId: 0,
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (previousLists) {
        queryClient.setQueryData<List[]>(['lists'], [...previousLists, optimisticList]);
      } else {
        queryClient.setQueryData<List[]>(['lists'], [optimisticList]);
      }

      return { previousLists, tempId };
    },
    onSuccess: (newList, _variables, context) => {
      // Remove the optimistic list and add the real one
      // This handles the race with WebSocket by filtering out both temp and real IDs
      const currentLists = queryClient.getQueryData<List[]>(['lists']);
      if (currentLists && context?.tempId) {
        // Filter out both the temp item AND any duplicate real item (from WebSocket)
        const filtered = currentLists.filter(
          list => list.id !== context.tempId && list.id !== newList.id
        );
        queryClient.setQueryData<List[]>(['lists'], [...filtered, newList]);
      }
    },
    onError: (_err, _newTodo, context) => {
      if (context?.previousLists) {
        queryClient.setQueryData<List[]>(['lists'], context.previousLists);
      }
    },
  });
}

export function useUpdateList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) => lists.update(id, title),
    onMutate: async ({ id, title }) => {
      await queryClient.cancelQueries({ queryKey: ['lists'] });
      const previousLists = queryClient.getQueryData<List[]>(['lists']);

      if (previousLists) {
        queryClient.setQueryData<List[]>(['lists'], previousLists.map(list => 
          list.id === id ? { ...list, title, updatedAt: new Date().toISOString() } : list
        ));
      }

      return { previousLists };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousLists) {
        queryClient.setQueryData<List[]>(['lists'], context.previousLists);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

export function useDeleteList() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => lists.delete(id),
    onMutate: async (id) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['lists'] });
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      
      const previousLists = queryClient.getQueryData<List[]>(['lists']);
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks']);

      // Optimistically remove the list
      if (previousLists) {
        queryClient.setQueryData<List[]>(['lists'], previousLists.filter(list => list.id !== id));
      }

      // Optimistically remove tasks belonging to this list (they're CASCADE deleted on backend)
      if (previousTasks) {
        queryClient.setQueryData<Task[]>(['tasks'], previousTasks.filter(task => task.listId !== id));
      }

      return { previousLists, previousTasks };
    },
    onSuccess: (_data, id) => {
      // Ensure the list and its tasks are removed from cache after successful deletion
      const currentLists = queryClient.getQueryData<List[]>(['lists']);
      if (currentLists) {
        queryClient.setQueryData<List[]>(['lists'], currentLists.filter(list => list.id !== id));
      }

      const currentTasks = queryClient.getQueryData<Task[]>(['tasks']);
      if (currentTasks) {
        queryClient.setQueryData<Task[]>(['tasks'], currentTasks.filter(task => task.listId !== id));
      }
    },
    onError: (_err, _id, context) => {
      // Rollback on error
      if (context?.previousLists) {
        queryClient.setQueryData<List[]>(['lists'], context.previousLists);
      }
      if (context?.previousTasks) {
        queryClient.setQueryData<Task[]>(['tasks'], context.previousTasks);
      }
    },
    onSettled: async () => {
      // Invalidate both lists and tasks to ensure fresh data
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lists'] }),
        queryClient.invalidateQueries({ queryKey: ['tasks'] }),
      ]);
    },
  });
}
