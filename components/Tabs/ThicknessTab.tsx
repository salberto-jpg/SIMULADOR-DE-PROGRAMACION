
import React from 'react';
import { Thickness } from '../../types';

export const ThicknessTab: React.FC<any> = ({ thicknesses, onEdit, onDelete, onLoad }) => {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <h2 className="text-2xl font-black text-blue-950 uppercase tracking-tighter">Espesores</h2>
        <button onClick={() => onEdit({ id: `th-${Date.now()}`, value: 1.5, material: 'Acero Carbono' })} className="bg-blue-800 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">+ Nuevo</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {thicknesses.map((th: Thickness) => (
          <div key={th.id} className="bg-white p-6 rounded-3xl border border-slate-200 flex justify-between items-center">
            <div>
              <h3 className="text-xl font-black text-blue-950">{th.value}mm</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase">{th.material}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onEdit(th)} className="w-8 h-8 bg-slate-50 flex items-center justify-center rounded-lg">⚙️</button>
              <button onClick={() => onDelete(th.id).then(onLoad)} className="w-8 h-8 bg-red-50 text-red-500 flex items-center justify-center rounded-lg">&times;</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
