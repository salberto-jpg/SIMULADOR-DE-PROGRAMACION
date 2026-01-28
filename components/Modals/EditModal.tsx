
import React, { useState } from 'react';
import { TimeInput } from '../Shared/TimeInput';

interface EditModalProps {
  editing: { type: string, data: any };
  machines: any[];
  tools: any[];
  thicknesses: any[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

export const EditModal: React.FC<EditModalProps> = ({ editing, machines, onClose, onSave }) => {
  const [data, setData] = useState(editing.data);

  const updateData = (key: string, value: any) => {
    setData((prev: any) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-[100] bg-blue-950/90 backdrop-blur-md flex items-center justify-center p-6">
      <div className="bg-white w-full max-w-3xl rounded-[48px] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        <div className="p-8 bg-blue-950 text-white flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">Configuración de {editing.type === 'machine' ? 'Máquina' : 'Lote'}</h3>
            <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mt-1">
              {editing.type === 'machine' ? `ID: ${data.id}` : 'Editor de producción'}
            </p>
          </div>
          <button onClick={onClose} className="text-3xl hover:text-red-400 transition-colors">&times;</button>
        </div>
        
        <div className="p-8 md:p-10 overflow-y-auto space-y-10 scrollbar-hide">
          {editing.type === 'machine' && (
            <div className="space-y-10">
              {/* Sección 1: Identificación Básica */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-blue-900 uppercase tracking-[0.2em] border-b pb-2">Identificación</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">ID de Máquina</label>
                    <input className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold transition-all outline-none" value={data.id} onChange={e => updateData('id', e.target.value.toUpperCase())} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Nombre Descriptivo</label>
                    <input className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold transition-all outline-none" value={data.name} onChange={e => updateData('name', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Sección 2: Tiempos de Ciclo (Usa TimeInput para HH:MM:SS) */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-blue-900 uppercase tracking-[0.2em] border-b pb-2">Tiempos de Ciclo</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <TimeInput label="Tiempo de Golpe" value={data.strikeTime} onChange={v => updateData('strikeTime', v)} />
                  <TimeInput label="Cambio Herramental" value={data.toolChangeTime} onChange={v => updateData('toolChangeTime', v)} />
                  <TimeInput label="Setup Inicial" value={data.setupTime} onChange={v => updateData('setupTime', v)} />
                  <TimeInput label="Medición / Pieza" value={data.measurementTime} onChange={v => updateData('measurementTime', v)} />
                  <TimeInput label="Tiempo de Tramo" value={data.tramTime} onChange={v => updateData('tramTime', v)} />
                </div>
              </div>

              {/* Sección 3: Logística y Grúa */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-blue-900 uppercase tracking-[0.2em] border-b pb-2">Logística y Maniobras</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <TimeInput label="Giro Manual" value={data.manualRotateTime} onChange={v => updateData('manualRotateTime', v)} />
                  <TimeInput label="Volteo Manual" value={data.manualTurnTime} onChange={v => updateData('manualTurnTime', v)} />
                  <TimeInput label="Giro Grúa" value={data.craneRotateTime} onChange={v => updateData('craneRotateTime', v)} />
                  <TimeInput label="Volteo Grúa" value={data.craneTurnTime} onChange={v => updateData('craneTurnTime', v)} />
                </div>
              </div>

              {/* Sección 4: Capacidades y Eficiencia */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-blue-900 uppercase tracking-[0.2em] border-b pb-2">Capacidades y Rendimiento</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Eficiencia (%)</label>
                    <input type="number" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none" value={data.efficiency} onChange={e => updateData('efficiency', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Horas/Día</label>
                    <input type="number" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none" value={data.productiveHours} onChange={e => updateData('productiveHours', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Largo Máx (mm)</label>
                    <input type="number" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none" value={data.maxLength} onChange={e => updateData('maxLength', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Ton Máx</label>
                    <input type="number" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none" value={data.maxTons} onChange={e => updateData('maxTons', Number(e.target.value))} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {editing.type === 'batch' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-slate-400">Nombre del Lote</label>
                <input className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-black text-lg outline-none" value={data.name} onChange={e => updateData('name', e.target.value)} placeholder="Ej: PANEL FRONTAL X-1" />
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Cantidad Piezas</label>
                  <input type="number" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none" value={data.pieces} onChange={e => updateData('pieces', Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Golpes / Pieza</label>
                  <input type="number" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none" value={data.strikesPerPiece} onChange={e => updateData('strikesPerPiece', Number(e.target.value))} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Máquina Asignada</label>
                  <select className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none appearance-none" value={data.machineId} onChange={e => updateData('machineId', e.target.value)}>
                    {machines.map(m => <option key={m.id} value={m.id}>{m.id} - {m.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Fecha de Programación</label>
                  <input type="date" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none" value={data.scheduledDate} onChange={e => updateData('scheduledDate', e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Prioridad</label>
                  <select className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none appearance-none" value={data.priority} onChange={e => updateData('priority', e.target.value)}>
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-8 bg-slate-50 border-t flex flex-col md:flex-row gap-4">
          <button onClick={onClose} className="flex-1 py-4 font-black uppercase text-slate-400 text-[11px] tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
          <button 
            onClick={() => onSave(data)} 
            className="flex-[2] bg-blue-800 text-white py-4 rounded-3xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl hover:bg-blue-700 transition-all transform active:scale-95"
          >
            Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
};
