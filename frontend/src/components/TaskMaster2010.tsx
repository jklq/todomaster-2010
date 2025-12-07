import React, { useState } from 'react';
import { Header, Sidebar, TaskInput, TaskList, ContentHeader } from '.';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask, useReorderTasks, useCreateSubtask, useUpdateSubtask, useDeleteSubtask } from '../hooks/useTasks';
import { useLists, useCreateList, useDeleteList, useUpdateList } from '../hooks/useLists';
import { useWebSocket } from '../hooks/useWebSocket';
import type { FilterType } from '../types';

export const TaskMaster2010: React.FC = () => {
  const [filter, setFilter] = useState<FilterType>('all');
  
  // Connect to WebSocket for real-time updates
  useWebSocket();
  
  const { data: tasks, isLoading: isLoadingTasks, error: tasksError } = useTasks();
  const { data: lists, isLoading: isLoadingLists } = useLists();
  
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const reorderTasks = useReorderTasks();
  
  const createSubtask = useCreateSubtask();
  const updateSubtask = useUpdateSubtask();
  const deleteSubtask = useDeleteSubtask();

  const createList = useCreateList();
  const updateList = useUpdateList();
  const deleteList = useDeleteList();

  /* 
   * Simple arrayMove helper to avoid importing from dnd-kit which might not be exported in the way we expect 
   * or to avoid adding dependency if possible (though it is in package.json).
   */
  const handleReorder = (oldIndex: number, newIndex: number) => {
      if (filter !== 'all') return; // Disable reordering when filtered

      const newOrder = [...(tasks || [])];
      const [moved] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, moved);

      const ids = newOrder.map(t => t.id);
      reorderTasks.mutate(ids);
  };

  const allTasks = tasks || [];
  const allLists = lists || [];

  const getFilteredTasks = (currentFilter: FilterType) => {
    if (currentFilter.startsWith('list-')) {
        const listId = parseInt(currentFilter.replace('list-', ''), 10);
        return allTasks.filter(t => t.listId === listId);
    }

    switch (currentFilter) {
      case 'active':
        return allTasks.filter(t => !t.completed);
      case 'completed':
        return allTasks.filter(t => t.completed);
      case 'important':
        return allTasks.filter(t => t.important);
      case 'all':
        return allTasks;
      default:
        // Tag filter
        return allTasks.filter(t => t.tags?.includes(currentFilter));
    }
  };

  const getCounts = () => ({
    all: allTasks.length,
    active: allTasks.filter(t => !t.completed).length,
    completed: allTasks.filter(t => t.completed).length,
    important: allTasks.filter(t => t.important).length,
  });

  const getUniqueTags = () => {
    const tags = new Set<string>();
    allTasks.forEach(task => {
      task.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  };

  const getTagCount = (tag: string) => {
    return allTasks.filter(t => t.tags?.includes(tag)).length;
  };

  const getListCount = (listId: number) => {
      return allTasks.filter(t => t.listId === listId).length;
  };

  const filteredTasks = getFilteredTasks(filter);
  const counts = getCounts();
  const tags = getUniqueTags();

  if (isLoadingTasks || isLoadingLists) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (tasksError) return <div className="flex h-screen items-center justify-center text-red-500">Error loading tasks</div>;

  return (
    <div className="h-screen bg-[#e0e0e0] font-sans text-slate-800 flex flex-col overflow-hidden">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          filter={filter}
          onFilterChange={setFilter}
          counts={counts}
          tags={tags}
          lists={allLists}
          getTagCount={getTagCount}
          getListCount={getListCount}
          onCreateList={(title) => createList.mutate(title)}
          onDeleteList={(id) => {
              deleteList.mutate(id);
              if (filter === `list-${id}`) setFilter('all');
          }}
          onUpdateList={(id, title) => updateList.mutate({ id, title })}
        />

        <main className="flex-1 flex flex-col bg-white relative paper-shadow min-w-0">
          <ContentHeader 
            filter={filter} 
            lists={allLists}
            onClearCompleted={() => {
                // Bulk delete not implemented in backend API yet, maybe loop?
                // For now, let's skip or implement loop
                const completed = allTasks.filter(t => t.completed);
                completed.forEach(t => deleteTask.mutate(t.id));
            }} 
          />

          <TaskInput 
            filter={filter} 
            onAddTask={(text, currentFilter) => {
              const tags = (text.match(/#[a-zA-Z0-9_-]+/g) || []).map(tag => tag.slice(1));
              
              let listId: number | undefined;
              if (currentFilter.startsWith('list-')) {
                  listId = parseInt(currentFilter.replace('list-', ''), 10);
              }

              createTask.mutate({ text, filter: currentFilter, tags, listId });
            }} 
          />

          <div className="flex-1 overflow-y-auto bg-texture relative">
            <div className="mx-auto pl-6 pr-6 py-6">
              <TaskList
                tasks={filteredTasks}
                onReorder={handleReorder}
                onToggleExpanded={(id) => {
                   const task = allTasks.find(t => t.id === id);
                   if (task) updateTask.mutate({ id, updates: { isExpanded: !task.isExpanded } });
                }}
                onToggleComplete={(id) => {
                    const task = allTasks.find(t => t.id === id);
                    if (task) updateTask.mutate({ id, updates: { completed: !task.completed } });
                }}
                onToggleImportant={(id) => {
                    const task = allTasks.find(t => t.id === id);
                    if (task) updateTask.mutate({ id, updates: { important: !task.important } });
                }}
                onDelete={(id) => deleteTask.mutate(id)}
                onUpdateTask={(id, updates) => updateTask.mutate({ id, updates })}
                
                onToggleSubtask={(taskId, subtaskId) => {
                     const task = allTasks.find(t => t.id === taskId);
                     const subtask = task?.subtasks?.find(s => s.id === subtaskId);
                     if (subtask) updateSubtask.mutate({ id: subtaskId, updates: { completed: !subtask.completed }});
                }}
                onDeleteSubtask={(_taskId, subtaskId) => deleteSubtask.mutate(subtaskId)}
                onUpdateSubtask={(subtaskId, text) => updateSubtask.mutate({ id: subtaskId, updates: { text } })}
                onAddSubtask={(taskId, text) => createSubtask.mutate({ taskId, text })}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};
