
import React, { useState, useRef } from 'react';
import { TimeInput } from '../Shared/TimeInput';
import { Icons } from '../Icons';

interface EditModalProps {
  editing: { type: string, data: any };
  machines: any[];
  tools: any[];
  thicknesses: any[];
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
}

export const EditModal: React.FC<EditModalProps> = ({ editing, machines, onClose, onSave }) => {
  const [data, setData] = useState({
    pieces: 0,
    strikesPerPiece: 0,
    thickness: 1.5,
    trams: 0,
    toolChanges: 0,
    requiresToolChange: false,
    scheduledDate: new Date().toISOString().split('T')[0],
    ...editing.data
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateData = (key: string, value: any) => {
    setData((prev: any) => ({ ...prev, [key]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateData('imageUrl', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-blue-950/80 backdrop-blur-sm flex items-center justify-center p-4 md:p-6">
      <div className="bg-white w-full max-w-4xl rounded-[48px] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-8 bg-blue-950 text-white flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight">
              {editing.type === 'machine' ? 'Configuración de Máquina' : 'Configuración de Lote'}
            </h3>
            <p className="text-[10px] font-bold text-blue-300 uppercase tracking-widest mt-1">
              {editing.type === 'machine' ? `ID: ${data.id}` : 'Editor de producción'}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-2xl">&times;</button>
        </div>
        
        <div className="p-8 md:p-10 overflow-y-auto space-y-10 scrollbar-hide">
          {editing.type === 'machine' ? (
            <div className="space-y-10">
              {/* Sección Identificación */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-blue-900 uppercase tracking-[0.2em] border-b pb-2">Identificación</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">ID de Máquina</label>
                    <input className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none" value={data.id} onChange={e => updateData('id', e.target.value.toUpperCase())} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Nombre Descriptivo</label>
                    <input className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none" value={data.name} onChange={e => updateData('name', e.target.value)} />
                  </div>
                </div>
              </div>

              {/* Tiempos de Ciclo */}
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

              {/* Capacidades */}
              <div className="space-y-4">
                <h4 className="text-[11px] font-black text-blue-900 uppercase tracking-[0.2em] border-b pb-2">Capacidades y Rendimiento</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Eficiencia (%)</label>
                    <input type="number" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none" value={data.efficiency} onChange={e => updateData('efficiency', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Largo Máx (mm)</label>
                    <input type="number" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none" value={data.maxLength} onChange={e => updateData('maxLength', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Ton Máx</label>
                    <input type="number" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none" value={data.maxTons} onChange={e => updateData('maxTons', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Horas/Día</label>
                    <input type="number" className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none" value={data.productiveHours} onChange={e => updateData('productiveHours', Number(e.target.value))} />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* CARGA MANUAL DE LOTE SIMPLIFICADA */
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black uppercase text-slate-400 ml-2 tracking-widest">Nombre del Lote</label>
                    <input 
                      className="w-full p-6 bg-slate-50 border-2 border-transparent focus:border-blue-800 focus:bg-white rounded-3xl font-black text-xl text-blue-950 outline-none transition-all placeholder:text-slate-300 shadow-sm" 
                      value={data.name} 
                      onChange={e => updateData('name', e.target.value)} 
                      placeholder="Ej: PANEL FRONTAL X-1" 
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Cantidad Piezas</label>
                      <input type="number" className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none shadow-sm" value={data.pieces} onChange={e => updateData('pieces', Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Golpes / Pieza</label>
                      <input type="number" className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none shadow-sm" value={data.strikesPerPiece} onChange={e => updateData('strikesPerPiece', Number(e.target.value))} />
                    </div>
                    <div className="space-y-2 col-span-2 md:col-span-1">
                      <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Máquina Asignada</label>
                      <select className="w-full p-5 bg-slate-50 border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none shadow-sm appearance-none cursor-pointer" value={data.machineId} onChange={e => updateData('machineId', e.target.value)}>
                        {machines.map(m => <option key={m.id} value={m.id}>{m.id} - {m.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
                
                <div className="lg:col-span-4 space-y-2">
                  <label className="text-[11px] font-black uppercase text-slate-400 ml-2 tracking-widest block">Referencia Visual</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full aspect-square bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-blue-800/30 transition-all overflow-hidden relative group shadow-sm"
                  >
                    {data.imageUrl ? (
                      <>
                        <img src={data.imageUrl} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-blue-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <span className="text-white font-black text-[10px] uppercase">Cambiar Foto</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-6">
                        <span className="text-4xl mb-2 block">📸</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Añadir Imagen</span>
                      </div>
                    )}
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                  </div>
                </div>
              </div>

              {/* Especificaciones y Parámetros */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="p-6 bg-slate-50/50 rounded-[32px] border border-slate-100">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-2 block mb-3">Espesor del Material (mm)</label>
                    <input type="number" step="0.1" className="w-full p-5 bg-white border-2 border-transparent focus:border-blue-800 rounded-2xl font-bold outline-none shadow-sm" value={data.thickness} onChange={e => updateData('thickness', Number(e.target.value))} />
                  </div>
                </div>

                <div className="p-8 bg-slate-50/50 rounded-[32px] border border-slate-100 flex flex-col justify-center space-y-4">
                  <label className="flex items-center gap-4 cursor-pointer group">
                    <div className="relative">
                      <input type="checkbox" className="sr-only peer" checked={data.requiresToolChange} onChange={e => updateData('requiresToolChange', e.target.checked)} />
                      <div className="w-10 h-10 bg-white border-2 border-slate-200 rounded-xl peer-checked:bg-blue-800 peer-checked:border-blue-800 transition-all flex items-center justify-center shadow-sm">
                        <span className={`text-white text-xl transition-opacity ${data.requiresToolChange ? 'opacity-100' : 'opacity-0'}`}>✓</span>
                      </div>
                    </div>
                    <span className="text-[12px] font-black uppercase text-blue-900 tracking-wider group-hover:text-blue-700 transition-colors">¿Requiere cambio de herramental?</span>
                  </label>

                  {/* Parámetros de Proceso CONDICIONALES */}
                  {data.requiresToolChange && (
                    <div className="grid grid-cols-2 gap-4 pt-4 animate-in slide-in-from-top-2 duration-300">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Tramos Extra</label>
                        <input type="number" className="w-full p-4 bg-white border-2 border-transparent focus:border-blue-800 rounded-xl font-bold outline-none shadow-sm" value={data.trams} onChange={e => updateData('trams', Number(e.target.value))} />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Cant. Cambios Herr.</label>
                        <input type="number" className="w-full p-4 bg-white border-2 border-transparent focus:border-blue-800 rounded-xl font-bold outline-none shadow-sm" value={data.toolChanges} onChange={e => updateData('toolChanges', Number(e.target.value))} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-8 bg-slate-50 border-t flex flex-col md:flex-row gap-4">
          <button onClick={onClose} className="flex-1 py-4 font-black uppercase text-slate-400 text-[11px] tracking-widest hover:text-slate-600 transition-colors">Cancelar</button>
          <button 
            onClick={() => onSave(data)} 
            className="flex-[2] bg-blue-800 text-white py-4 rounded-[28px] font-black uppercase text-[11px] tracking-[0.2em] shadow-xl hover:bg-blue-700 transition-all transform active:scale-95"
          >
            Guardar Configuración
          </button>
        </div>
      </div>
    </div>
  );
};
