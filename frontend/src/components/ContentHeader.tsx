import { MoreHorizontal } from 'lucide-react';
import type { FilterType, List } from '../types';

interface ContentHeaderProps {
  filter: FilterType;
  lists?: List[]; // Make optional to support legacy usage if needed, though we'll update parent
  onClearCompleted: () => void;
}

export function ContentHeader({ filter, lists = [], onClearCompleted }: ContentHeaderProps) {
  let title = filter;
  if (filter === 'all') {
    title = 'Inbox';
  } else if (filter.startsWith('list-')) {
    const listId = parseInt(filter.replace('list-', ''), 10);
    const list = lists.find(l => l.id === listId);
    title = list ? list.title : 'Details'; // Fallback if list not found (e.g. deleted)
  }

  const formattedDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="bg-gradient-to-b from-[#fdfdfd] to-[#f4f4f4] border-b border-gray-300 p-5 flex items-end justify-between">
      <div>
        <h2 className="text-3xl font-bold text-gray-700 inset-text capitalize tracking-tight leading-none">
          {title}
        </h2>
        <p className="text-gray-500 text-sm mt-1 inset-text">
          {formattedDate}
        </p>
      </div>
      
      <div className="flex gap-2">
        <button 
          onClick={onClearCompleted} 
          className="px-3 py-1.5 bg-white border border-gray-300 rounded shadow-sm text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50 active:bg-gray-100 transition-all font-medium"
        >
          Clear Done
        </button>
        <button className="p-1.5 bg-white border border-gray-300 rounded shadow-sm text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-all">
          <MoreHorizontal size={18} />
        </button>
      </div>
    </div>
  );
}
