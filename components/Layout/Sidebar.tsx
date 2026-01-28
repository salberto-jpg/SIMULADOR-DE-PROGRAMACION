
import React from 'react';
import { Icons } from '../Icons';

const LOGO_URL = "https://jcdbepgjoqxtnuarcwku.supabase.co/storage/v1/object/public/IMAGENES/metallo-removebg-preview.png";

interface SidebarProps {
  isOpen: boolean;
  activeTab: string;
  onTabChange: (tab: any) => void;
  onToggle: (val: boolean) => void;
  navItems: Array<{ id: string; label: string; icon: React.ReactNode }>;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, activeTab, onTabChange, onToggle, navItems }) => {
  return (
    <aside 
      onMouseEnter={() => onToggle(true)}
      onMouseLeave={() => onToggle(false)}
      className={`fixed inset-y-0 left-0 z-50 w-72 bg-blue-950 text-white shadow-2xl transition-all duration-500 ease-in-out transform ${isOpen ? 'translate-x-0' : '-translate-x-[calc(100%-16px)]'} flex flex-col`}
    >
      <div className="p-8 border-b border-blue-900 flex items-center gap-4">
        <img src={LOGO_URL} alt="METALLO" className="h-10 w-auto brightness-200" />
        <h1 className={`text-sm font-black tracking-tighter uppercase leading-none transition-opacity ${!isOpen && 'opacity-0'}`}>METALLO</h1>
      </div>

      <nav className="flex-1 py-8 px-4 space-y-2">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => { onTabChange(item.id); onToggle(false); }}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all group ${activeTab === item.id ? 'bg-blue-800 text-white' : 'text-blue-300 hover:bg-blue-900/50'}`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className={`text-[10px] font-black uppercase tracking-widest transition-all ${!isOpen && 'opacity-0 translate-x-4'}`}>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
};
