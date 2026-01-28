
import React from 'react';

const LOGO_URL = "https://jcdbepgjoqxtnuarcwku.supabase.co/storage/v1/object/public/IMAGENES/metallo-removebg-preview.png";

interface HeaderProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTabLabel: string;
  status: string;
}

export const Header: React.FC<HeaderProps> = ({ isOpen, onToggle, activeTabLabel, status }) => {
  return (
    <header className={`bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-4 md:px-12 py-4 md:py-5 transition-all duration-500 ${isOpen ? 'md:pl-80' : 'md:pl-24'}`}>
      <div className="max-w-[1600px] mx-auto flex justify-between items-center">
        <div className="flex items-center gap-4 md:gap-6">
          <button 
            onClick={onToggle}
            className="w-8 h-8 md:w-10 md:h-10 flex flex-col justify-center gap-1.5 group"
          >
            <div className="w-6 md:w-7 h-0.5 md:h-1 bg-blue-950 rounded-full group-hover:bg-blue-800 transition-all"></div>
            <div className="w-4 md:w-5 h-0.5 md:h-1 bg-blue-950 rounded-full group-hover:bg-blue-800 transition-all"></div>
            <div className="w-6 md:w-7 h-0.5 md:h-1 bg-blue-950 rounded-full group-hover:bg-blue-800 transition-all"></div>
          </button>
          <div>
            <h2 className="text-sm md:text-base font-black text-blue-950 uppercase tracking-tight">
              {activeTabLabel}
            </h2>
            <span className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">{status || 'Monitor de Planta Activo'}</span>
          </div>
        </div>
        <img src={LOGO_URL} alt="METALLO" className="h-6 md:h-10 opacity-80" />
      </div>
    </header>
  );
};
