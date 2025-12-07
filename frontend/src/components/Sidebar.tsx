import React, { useState, useEffect, useRef } from 'react';
import { Plus, List as ListIcon, CheckSquare, Check, Star, Settings, AlertCircle, Folder, PenLine, Trash2 } from 'lucide-react';
import type { FilterType, List } from '../types';

interface SidebarItemProps {
  id: FilterType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  count?: number;
  isActive: boolean;
  onClick: () => void;
  onDelete?: () => void;
  onEdit?: (newTitle: string) => void;
}

function SidebarItem({ label, icon: Icon, count, isActive, onClick, onDelete, onEdit }: SidebarItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (editValue.trim() && onEdit) {
      onEdit(editValue.trim());
      setIsEditing(false);
    } else {
      setEditValue(label);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditValue(label);
      setIsEditing(false);
    } else if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  if (isEditing) {
    return (
      <div className="px-2 py-1 bg-blue-50">
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleSubmit()}
          onKeyDown={handleKeyDown}
          className="w-full text-sm py-1 px-2 border border-blue-400 rounded shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
        />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      onDoubleClick={() => onEdit && setIsEditing(true)}
      className={`w-full flex items-center justify-between px-4 py-2 text-sm font-medium border-b border-gray-200 transition-all cursor-pointer group select-none ${
        isActive 
          ? 'bg-gradient-to-b from-blue-50 to-blue-100 text-blue-800 shadow-[inset_3px_0_0_0_#3b82f6]' 
          : 'text-gray-600 hover:bg-gradient-to-b hover:from-white hover:to-gray-100 hover:text-gray-800'
      }`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <Icon size={16} className={`shrink-0 ${isActive ? 'text-blue-600 drop-shadow-sm' : 'text-gray-400'}`} />
        <span className={`truncate ${isActive ? 'font-bold text-shadow-sm' : ''}`}>{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {count !== undefined && count > 0 && (
          <span className={`text-xs px-2 rounded-full border leading-none h-5 flex items-center justify-center shadow-sm ${
            isActive 
              ? 'bg-blue-200 border-blue-300 text-blue-800' 
              : 'bg-gray-100 border-gray-200 text-gray-500'
          }`}>
            {count}
          </span>
        )}
        {(onEdit || onDelete) && (
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
             {onEdit && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                    }}
                    className="p-1 hover:bg-blue-100 rounded text-gray-400 hover:text-blue-600 transition-colors"
                    title="Rename list"
                >
                    <PenLine size={12} />
                </button>
             )}
             {onDelete && (
                <button 
                  className="p-1 hover:bg-red-100 rounded text-gray-400 hover:text-red-600 transition-colors"
                  onClick={(e) => {
                      e.stopPropagation();
                      if(window.confirm(`Are you sure you want to delete "${label}"?`)) onDelete();
                  }}
                  title="Delete list"
                >
                    <Trash2 size={12} />
                </button>
             )}
          </div>
        )}
      </div>
    </div>
  );
}

interface SidebarProps {
  filter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  counts: {
    all: number;
    active: number;
    completed: number;
    important: number;
  };
  tags: string[];
  lists: List[];
  getTagCount: (tag: string) => number;
  getListCount: (listId: number) => number;
  onCreateList: (title: string) => void;
  onDeleteList: (id: number) => void;
  onUpdateList: (id: number, title: string) => void;
}

export function Sidebar({ filter, onFilterChange, counts, tags, lists, getTagCount, getListCount, onCreateList, onDeleteList, onUpdateList }: SidebarProps) {
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCreatingList && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreatingList]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newListName.trim()) {
      onCreateList(newListName.trim());
      setNewListName('');
      setIsCreatingList(false);
    } else {
        setIsCreatingList(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsCreatingList(false);
      setNewListName('');
    }
  };

  return (
    <aside className="w-64 sidebar-gradient border-r border-gray-300 flex flex-col shadow-[inset_-3px_0_5px_rgba(0,0,0,0.03)] z-10 bg-[#f4f4f4]">
      <div className="p-3 border-b border-gray-200 bg-gradient-to-b from-white to-[#f0f0f0]">
        {isCreatingList ? (
           <form onSubmit={handleCreateSubmit} className="w-full">
            <input
              ref={inputRef}
              type="text"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (!newListName.trim()) setIsCreatingList(false);
              }}
              className="w-full border border-blue-400 rounded py-2 px-3 text-sm shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
              placeholder="Enter list name..."
            />
           </form>
        ) : (
          <button 
            onClick={() => setIsCreatingList(true)}
            className="w-full btn-primary-gradient text-white border border-blue-800 shadow-[0_1px_2px_rgba(0,0,0,0.1)] rounded py-2 px-3 font-bold text-sm flex items-center justify-center gap-2 text-shadow-sm transition-all hover:brightness-105 active:brightness-95 active:scale-[0.98] active:shadow-inner"
          >
            <Plus size={16} strokeWidth={3} className="drop-shadow-sm" />
            Create New List
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="py-2">
          <h3 className="px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Filters</h3>
          <nav className="flex flex-col select-none">
            <SidebarItem 
              id="all" 
              label="All Tasks" 
              icon={ListIcon} 
              count={counts.all}
              isActive={filter === 'all'}
              onClick={() => onFilterChange('all')}
            />
            <SidebarItem 
              id="active" 
              label="Active" 
              icon={CheckSquare} 
              count={counts.active}
              isActive={filter === 'active'}
              onClick={() => onFilterChange('active')}
            />
            <SidebarItem 
              id="completed" 
              label="Completed" 
              icon={Check} 
              count={counts.completed}
              isActive={filter === 'completed'}
              onClick={() => onFilterChange('completed')}
            />
            <SidebarItem 
              id="important" 
              label="Important" 
              icon={Star} 
              count={counts.important}
              isActive={filter === 'important'}
              onClick={() => onFilterChange('important')}
            />
          </nav>
        </div>

        <div className="py-2">
           <h3 className="px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 ">My Lists</h3>
           {lists.length === 0 && !isCreatingList && (
               <div className="px-4 py-2 text-sm text-gray-400 italic text-shadow-white">No lists yet...</div>
           )}
           <nav className="flex flex-col select-none">
              {lists.map(list => (
                  <SidebarItem
                    key={list.id}
                    id={`list-${list.id}`}
                    label={list.title}
                    icon={Folder}
                    count={getListCount(list.id)}
                    isActive={filter === `list-${list.id}`}
                    onClick={() => onFilterChange(`list-${list.id}`)}
                    onDelete={() => onDeleteList(list.id)}
                    onEdit={(newTitle) => onUpdateList(list.id, newTitle)}
                  />
              ))}
           </nav>
        </div>

        <div className="py-2">
          <h3 className="px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tags</h3>
          {tags.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-400 italic text-shadow-white">No tags yet...</div>
          ) : (
            tags.map(tag => (
              <button
                key={tag}
                onClick={() => onFilterChange(tag)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors border-b border-transparent ${
                  filter === tag
                    ? 'bg-gradient-to-b from-blue-50 to-blue-100 text-blue-800 font-bold shadow-[inset_3px_0_0_0_#3b82f6] border-gray-200'
                    : 'text-gray-600 hover:bg-gradient-to-b hover:from-white hover:to-gray-100'
                }`}
              >
                <div className={`w-2 h-2 rounded-full shadow-sm ring-1 ring-white ${
                  filter === tag ? 'bg-blue-500' : 'bg-gray-400'
                }`}></div>
                <span className="truncate">#{tag}</span>
                <span className="ml-auto text-xs text-gray-400 px-1.5 py-0.5 bg-gray-100 rounded-full border border-gray-200 shadow-sm">
                  {getTagCount(tag)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-gray-300 bg-gradient-to-t from-[#e0e0e0] to-[#f0f0f0] text-xs text-center text-gray-500 inset-text shadow-[0_1px_0_rgba(255,255,255,0.5)_inset]">
        <div className="flex justify-center gap-3 mb-1">
          <Settings size={14} className="cursor-pointer hover:text-gray-700 transition-colors drop-shadow-sm" />
          <AlertCircle size={14} className="cursor-pointer hover:text-gray-700 transition-colors drop-shadow-sm" />
        </div>
        TaskMaster 2010 v2.1.4
      </div>
    </aside>
  );
}
