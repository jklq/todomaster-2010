import { useState, useRef, useEffect } from 'react';
import { Plus, Trash2, Check, Star, ChevronDown, ChevronRight, CornerDownRight, GripVertical, Pencil, X, Tag } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../types';

interface TaskItemProps {
  task: Task;
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

export function TaskItem({
  task,
  onToggleExpanded,
  onToggleComplete,
  onToggleImportant,
  onDelete,
  onUpdateTask,
  onToggleSubtask,
  onDeleteSubtask,
  onUpdateSubtask,
  onAddSubtask,
}: TaskItemProps) {
  const [subtaskInput, setSubtaskInput] = useState('');
  const [isEditingTask, setIsEditingTask] = useState(false);
  const [editTaskText, setEditTaskText] = useState(task.text);
  const [editingSubtaskId, setEditingSubtaskId] = useState<number | null>(null);
  const [editSubtaskText, setEditSubtaskText] = useState('');
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState('');
  
  const taskInputRef = useRef<HTMLInputElement>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
    zIndex: isDragging ? 1000 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  useEffect(() => {
    if (isEditingTask && taskInputRef.current) {
      taskInputRef.current.focus();
      taskInputRef.current.select();
    }
  }, [isEditingTask]);

  useEffect(() => {
    if (editingSubtaskId && subtaskInputRef.current) {
      subtaskInputRef.current.focus();
      subtaskInputRef.current.select();
    }
  }, [editingSubtaskId]);

  useEffect(() => {
    if (isEditingTags && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [isEditingTags]);

  const handleSubtaskSubmit = () => {
    if (subtaskInput.trim()) {
      onAddSubtask(task.id, subtaskInput);
      setSubtaskInput('');
    }
  };

  const handleTaskEditStart = () => {
    setEditTaskText(task.text);
    setIsEditingTask(true);
  };

  const handleTaskEditSave = () => {
    const trimmed = editTaskText.trim();
    if (trimmed && trimmed !== task.text) {
      onUpdateTask(task.id, { text: trimmed });
    }
    setIsEditingTask(false);
  };

  const handleTaskEditCancel = () => {
    setEditTaskText(task.text);
    setIsEditingTask(false);
  };

  const handleSubtaskEditStart = (subtaskId: number, text: string) => {
    setEditingSubtaskId(subtaskId);
    setEditSubtaskText(text);
  };

  const handleSubtaskEditSave = () => {
    if (editingSubtaskId !== null) {
      const trimmed = editSubtaskText.trim();
      const subtask = task.subtasks?.find(s => s.id === editingSubtaskId);
      if (trimmed && subtask && trimmed !== subtask.text) {
        onUpdateSubtask(editingSubtaskId, trimmed);
      }
      setEditingSubtaskId(null);
      setEditSubtaskText('');
    }
  };

  const handleSubtaskEditCancel = () => {
    setEditingSubtaskId(null);
    setEditSubtaskText('');
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !task.tags?.includes(trimmed)) {
      const newTags = [...(task.tags || []), trimmed];
      onUpdateTask(task.id, { tags: newTags });
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const newTags = (task.tags || []).filter(t => t !== tagToRemove);
    onUpdateTask(task.id, { tags: newTags });
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`relative group flex flex-col p-2 rounded border ${
        isDragging ? '' : 'transition-all duration-150'
      } ${
        task.completed 
          ? 'bg-gray-50 border-transparent opacity-75' 
          : 'bg-white border-gray-200 shadow-sm hover:border-blue-300 hover:shadow-md'
      }`}
    >
      <div className="relative flex items-center gap-2 w-full min-w-0 pl-6">
        {/* Drag Handle */}
        <div {...attributes} {...listeners} className="absolute left-0 top-1/2 -translate-y-1/2 cursor-grab text-gray-300 hover:text-gray-500 flex-shrink-0 p-1">
          <GripVertical size={16} />
        </div>

        {/* Checkbox */}
        <button
          onClick={() => onToggleComplete(task.id)}
          className={`w-5 h-5 rounded border shadow-inner flex items-center justify-center transition-all flex-shrink-0 ${
            task.completed
              ? 'bg-blue-500 border-blue-600 text-white shadow-none'
              : 'bg-gradient-to-b from-[#f0f0f0] to-[#fff] border-gray-400 text-transparent hover:border-blue-400'
          }`}
        >
          <Check size={14} strokeWidth={4} />
        </button>
        
        {/* Task Text - Editable or Display */}
        {isEditingTask ? (
          <div className="flex-1 flex items-center gap-2">
            <input
              ref={taskInputRef}
              type="text"
              value={editTaskText}
              onChange={(e) => setEditTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTaskEditSave();
                if (e.key === 'Escape') handleTaskEditCancel();
              }}
              onBlur={handleTaskEditSave}
              className="flex-1 px-2 py-1 border border-blue-400 rounded text-base focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            />
            <button
              onClick={handleTaskEditSave}
              className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
              title="Save"
            >
              <Check size={14} />
            </button>
            <button
              onClick={handleTaskEditCancel}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              title="Cancel"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <span 
            className={`text-base truncate cursor-pointer select-none transition-all flex-1 ${
              task.completed ? 'text-gray-400 line-through decoration-gray-300' : 'text-gray-800 font-medium'
            }`}
            onClick={() => onToggleExpanded(task.id)}
            onDoubleClick={handleTaskEditStart}
            title="Double-click to edit"
          >
            {task.text}
          </span>
        )}

        {/* Subtask Progress */}
        {task.subtasks && task.subtasks.length > 0 && !isEditingTask && (
          <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-full">
            {task.subtasks.filter(st => st.completed).length}/{task.subtasks.length}
          </span>
        )}
        
        {/* Tags */}
        {!isEditingTask && !isEditingTags && task.tags && task.tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 text-[10px] uppercase font-bold text-gray-500 bg-yellow-100 border border-yellow-200 px-1.5 py-0.5 rounded shadow-sm group/tag">
            {tag}
            <button 
              onClick={() => handleRemoveTag(tag)}
              className="text-gray-400 hover:text-red-500 opacity-0 group-hover/tag:opacity-100 transition-opacity"
              title="Remove tag"
            >
              <X size={10} />
            </button>
          </span>
        ))}

        {/* Expand/Collapse Button */}
        {!isEditingTask && (
          <button
            onClick={() => onToggleExpanded(task.id)}
            className={`w-5 h-5 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 transition-colors ${
              (task.subtasks && task.subtasks.length > 0) ? 'visible' : 'invisible group-hover:visible'
            }`}
          >
            {task.isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}

        {/* Action Buttons */}
        {!isEditingTask && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleTaskEditStart}
              className="p-1.5 rounded text-gray-300 hover:text-blue-500 hover:bg-blue-50 transition-colors"
              title="Edit task"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => setIsEditingTags(!isEditingTags)}
              className={`p-1.5 rounded transition-colors ${
                isEditingTags ? 'text-blue-500 bg-blue-50' : 'text-gray-300 hover:text-blue-500 hover:bg-blue-50'
              }`}
              title="Edit tags"
            >
              <Tag size={14} />
            </button>
            <button
              onClick={() => onToggleImportant(task.id)}
              className={`p-1.5 rounded hover:bg-gray-100 transition-colors ${
                task.important ? 'text-yellow-500 opacity-100' : 'text-gray-300 hover:text-yellow-400'
              }`}
            >
              <Star size={16} fill={task.important ? "currentColor" : "none"} />
            </button>
            <button
              onClick={() => onDelete(task.id)}
              className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}

        {/* Persistent Star */}
        {task.important && !isEditingTask && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-yellow-500 group-hover:hidden pointer-events-none">
            <Star size={16} fill="currentColor" />
          </div>
        )}
      </div>

      {/* Tag Editing Section */}
      {isEditingTags && (
        <div className="mt-2 pl-12 pr-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Tags:</span>
          {task.tags?.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 text-xs bg-yellow-100 border border-yellow-300 px-2 py-0.5 rounded">
              {tag}
              <button onClick={() => handleRemoveTag(tag)} className="text-gray-400 hover:text-red-500">
                <X size={12} />
              </button>
            </span>
          ))}
          <div className="flex items-center gap-1">
            <input
              ref={tagInputRef}
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); }
                if (e.key === 'Escape') setIsEditingTags(false);
              }}
              placeholder="Add tag..."
              className="w-24 text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:border-blue-400"
            />
            <button
              onClick={handleAddTag}
              disabled={!tagInput.trim()}
              className="p-1 text-blue-500 hover:text-blue-700 disabled:opacity-50"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Subtasks Section */}
      {task.isExpanded && (
        <div className="mt-3 pl-12 pr-4">
          <ul className="space-y-2 mb-3">
            {task.subtasks?.map(subtask => (
              <li key={subtask.id} className="flex items-center gap-3 group/sub">
                <button
                  onClick={() => onToggleSubtask(task.id, subtask.id)}
                  className={`w-4 h-4 rounded border shadow-inner flex items-center justify-center transition-all flex-shrink-0 ${
                    subtask.completed
                      ? 'bg-gray-400 border-gray-500 text-white shadow-none'
                      : 'bg-white border-gray-300 text-transparent hover:border-blue-400'
                  }`}
                >
                  <Check size={10} strokeWidth={4} />
                </button>
                
                {editingSubtaskId === subtask.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      ref={subtaskInputRef}
                      type="text"
                      value={editSubtaskText}
                      onChange={(e) => setEditSubtaskText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSubtaskEditSave();
                        if (e.key === 'Escape') handleSubtaskEditCancel();
                      }}
                      onBlur={handleSubtaskEditSave}
                      className="flex-1 px-2 py-0.5 border border-blue-400 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
                    />
                    <button onClick={handleSubtaskEditSave} className="text-green-600 hover:text-green-700">
                      <Check size={12} />
                    </button>
                    <button onClick={handleSubtaskEditCancel} className="text-gray-400 hover:text-gray-600">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <>
                    <span 
                      className={`text-sm flex-1 cursor-pointer ${subtask.completed ? 'text-gray-400 line-through' : 'text-gray-600'}`}
                      onDoubleClick={() => handleSubtaskEditStart(subtask.id, subtask.text)}
                      title="Double-click to edit"
                    >
                      {subtask.text}
                    </span>
                    <button
                      onClick={() => handleSubtaskEditStart(subtask.id, subtask.text)}
                      className="opacity-0 group-hover/sub:opacity-100 text-gray-300 hover:text-blue-500 transition-opacity"
                      title="Edit subtask"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => onDeleteSubtask(task.id, subtask.id)}
                      className="opacity-0 group-hover/sub:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          
          {/* Add Subtask Input */}
          <div className="flex items-center gap-2">
            <CornerDownRight size={14} className="text-gray-400" />
            <input
              type="text"
              value={subtaskInput}
              onChange={(e) => setSubtaskInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubtaskSubmit()}
              placeholder="Add a subtask..."
              className="flex-1 bg-transparent border-b border-gray-200 text-sm py-1 focus:outline-none focus:border-blue-400 placeholder-gray-400"
            />
            <button 
              onClick={handleSubtaskSubmit}
              className="text-blue-500 hover:text-blue-700 disabled:opacity-50"
              disabled={!subtaskInput}
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
