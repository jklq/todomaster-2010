import { useState, useRef, useEffect } from 'react';
import { Check, Search, User, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Settings } from './Settings';

export function Header() {
  const { user, logout } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  const handleLogout = () => {
    logout();
    setIsDropdownOpen(false);
  };

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
    setIsDropdownOpen(false);
  };

  return (
    <>
      <header className="header-gradient h-12 flex items-center justify-between px-4 border-b border-black shadow-md z-20 shrink-0 relative">
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-br from-blue-400 to-blue-600 rounded p-1 shadow-inner border border-blue-800">
            <Check size={16} strokeWidth={3} className="text-white drop-shadow-md" />
          </div>
          <span className="text-white font-bold tracking-wide text-lg inset-text-dark">TaskMaster</span>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search..." 
              className="bg-[#222] border border-[#111] rounded-full pl-8 pr-3 py-1 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:bg-[#333] transition-colors w-48 shadow-[inset_0_1px_3px_rgba(0,0,0,0.5)]"
            />
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          </div>
          
          <div className="h-6 w-px bg-gray-600 border-r border-gray-800"></div>
          
          <div className="relative" ref={dropdownRef}>
            <div 
              className={`flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer transition-colors ${isDropdownOpen ? 'text-white' : ''}`}
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            >
              <div className="w-6 h-6 bg-gray-500 rounded border border-gray-600 flex items-center justify-center shadow-inner relative overflow-hidden">
                 {/* 2010s style default avatar gradient if no image */}
                 <div className="absolute inset-0 bg-gradient-to-b from-gray-400 to-gray-600 opacity-50"></div>
                 <User size={14} className="text-gray-100 relative z-10" />
              </div>
              <span className="text-xs font-bold inset-text-dark select-none">
                {user?.displayName || user?.email || 'My Account'}
              </span>
              {/* Tiny arrow indicator commonly used in 2010s UIs */}
              <span className="text-[10px] opacity-70">▼</span>
            </div>

            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded shadow-xl border border-gray-400 z-50 animate-dropdown">
                {/* Dropdown "beak" or "triangle" - very 2010s */}
                <div className="absolute -top-1 right-8 w-2 h-2 bg-white transform rotate-45 border-t border-l border-gray-400 z-50"></div>
                
                <div className="bg-gray-100 px-4 py-3 border-b border-gray-300 rounded-t">
                  <p className="text-xs text-gray-500 uppercase tracking-wider font-bold">Signed in as</p>
                  <p className="text-sm font-medium text-gray-800 truncate" title={user?.email}>{user?.email}</p>
                </div>
                
                <div className="py-1">
                  <button 
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 border-l-4 border-transparent hover:border-blue-500 transition-all"
                    onClick={handleOpenSettings}
                  >
                    <SettingsIcon size={14} />
                    Settings
                  </button>
                  <div className="border-t border-gray-200 my-1"></div>
                  <button 
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-l-4 border-transparent hover:border-red-500 transition-all"
                    onClick={handleLogout}
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <Settings onClose={() => setIsSettingsOpen(false)} />
      )}
    </>
  );
}
