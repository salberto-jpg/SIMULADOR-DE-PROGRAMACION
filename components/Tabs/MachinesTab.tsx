
import React from 'react';
import { MachineConfig, Batch } from '../../types';

interface MachinesTabProps {
  machines: MachineConfig[];
  batches: Batch[];
  onEdit: (data: any) => void;
}

export const MachinesTab: React.FC<MachinesTabProps> = ({ machines, batches, onEdit }) => {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <h2 className="text-2xl md:text-3xl font-black text-blue-950 uppercase tracking-tighter">Máquinas</h2>
        <button onClick={() => onEdit({ id: `M-${Date.now()}`, name: '', efficiency: 100, productiveHours: 8 })} className="bg-blue-800 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-xl">+ Nueva Máquina</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {machines.map(m => (
          <div key={m.id} className="bg-white p-8 rounded-[40px] border border-slate-200 hover:shadow-xl transition-all">
            <h3 className="text-2xl font-black text-blue-950 uppercase mb-2">{m.id}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-6">{m.name}</p>
            <div className="grid grid-cols-2 gap-4 mb-6">
               <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-[8px] font-black text-slate-400 uppercase block">Carga</span>
                  <span className="text-sm font-black text-blue-900">{batches.filter(b => b.machineId === m.id).length} Lotes</span>
               </div>
               <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-[8px] font-black text-slate-400 uppercase block">Eficiencia</span>
                  <span className="text-sm font-black text-blue-900">{m.efficiency}%</span>
               </div>
            </div>
            <button onClick={() => onEdit(m)} className="w-full py-4 bg-blue-950 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest">Configurar</button>
          </div>
        ))}
      </div>
    </div>
  );
};
