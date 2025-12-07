import { useRef, useState, type FormEvent } from 'react';
import type { FilterType } from '../types';

interface TaskInputProps {
  filter: FilterType;
  onAddTask: (text: string, filter: FilterType) => void;
}

export function TaskInput({ filter, onAddTask }: TaskInputProps) {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onAddTask(inputValue, filter);
    setInputValue('');
  };

  const filterLabel = filter === 'all' ? 'Inbox' : filter;

  return (
    <div className="bg-[#fffef0] border-b border-[#e6e6cd] p-4 pl-6 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] z-10">
      <form onSubmit={handleSubmit} className="flex gap-2 max-w-3xl">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={`Add a task to "${filterLabel}"... (use #tag for tags)`}
          className="flex-1 px-4 py-2 text-lg bg-white border border-gray-300 rounded shadow-inner focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 text-gray-700 placeholder-gray-400 transition-all"
        />
        <button type="submit" className="btn-primary-gradient text-white font-bold px-6 rounded border border-blue-700 shadow-sm text-shadow-sm active:scale-95 transition-transform">
          Add
        </button>
      </form>
    </div>
  );
}
