
import React from 'react';
import { Tool } from '../../types';

export const ToolsTab: React.FC<any> = ({ tools, onEdit, onDelete, onLoad }) => {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <h2 className="text-2xl font-black text-blue-950 uppercase tracking-tighter">Herramental</h2>
        <button onClick={() => onEdit({ id: `t-${Date.now()}`, name: '', type: 'punch', angle: 88, maxTons: 100, length: 835 })} className="bg-blue-800 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">+ Nuevo</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {tools.map((t: Tool) => (
          <div key={t.id} className="bg-white p-5 rounded-3xl border border-slate-200 hover:shadow-xl transition-all">
            <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase block w-fit mb-3 ${t.type === 'punch' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>{t.type === 'punch' ? 'Punzón' : 'Matriz'}</span>
            <h3 className="text-sm font-black text-blue-950 truncate">{t.name}</h3>
            <p className="text-[9px] font-bold text-slate-400 mt-1">{t.angle}° • {t.length}mm</p>
            <div className="flex gap-2 mt-4">
              <button onClick={() => onEdit(t)} className="flex-1 bg-slate-50 py-2 rounded-lg text-[9px] font-black uppercase text-blue-800">Editar</button>
              <button onClick={() => onDelete(t.id).then(onLoad)} className="p-2 bg-red-50 text-red-500 rounded-lg">&times;</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
