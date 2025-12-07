import { Check } from 'lucide-react';
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { TaskItem } from './TaskItem';
import type { Task } from '../types';

interface TaskListProps {
  tasks: Task[];
  onReorder: (oldIndex: number, newIndex: number) => void;
  onToggleExpanded: (id: number) => void;
  onToggleComplete: (id: number) => void;
  onToggleImportant: (id: number) => void;
  onDelete: (id: number) => void;
  onUpdateTask: (id: number, updates: Partial<Task>) => void;
  onToggleSubtask: (taskId: number, subtaskId: number) => void;
  onDeleteSubtask: (taskId: number, subtaskId: number) => void;
  onUpdateSubtask: (subtaskId: number, text: string) => void;
  onAddSubtask: (taskId: number, text: string) => void;
}

export function TaskList({
  tasks,
  onReorder,
  onToggleExpanded,
  onToggleComplete,
  onToggleImportant,
  onDelete,
  onUpdateTask,
  onToggleSubtask,
  onDeleteSubtask,
  onUpdateSubtask,
  onAddSubtask,
}: TaskListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tasks.findIndex((item) => item.id === active.id);
      const newIndex = tasks.findIndex((item) => item.id === over.id);
      onReorder(oldIndex, newIndex);
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center mt-20 text-gray-400">
        <div className="w-16 h-16 border-4 border-gray-200 rounded-full flex items-center justify-center mb-4 text-gray-300">
          <Check size={32} />
        </div>
        <p className="text-lg font-medium inset-text">No tasks here.</p>
        <p className="text-sm">Enjoy your day!</p>
      </div>
    );
  }

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext 
        items={tasks.map(t => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="space-y-1">
          {tasks.map((task) => (
            <TaskItem
              key={task.id}
              task={task}
              onToggleExpanded={onToggleExpanded}
              onToggleComplete={onToggleComplete}
              onToggleImportant={onToggleImportant}
              onDelete={onDelete}
              onUpdateTask={onUpdateTask}
              onToggleSubtask={onToggleSubtask}
              onDeleteSubtask={onDeleteSubtask}
              onUpdateSubtask={onUpdateSubtask}
              onAddSubtask={onAddSubtask}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
