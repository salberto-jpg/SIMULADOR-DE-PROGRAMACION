
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { INITIAL_MACHINES, STORAGE_KEYS } from './constants';
import { MachineConfig, Batch, DailySchedule, TimeRecord } from './types';
import { 
  calculateBatchTime, 
  formatTime 
} from './utils/helpers';
import { 
  initSupabase, 
  fetchMachines, 
  fetchBatches, 
  syncAppData, 
  logMachineConfig, 
  saveTimeStudy,
  checkCloudStatus,
  fetchTimeRecords,
  deleteBatchFromCloud,
  deleteTimeRecordFromCloud
} from './services/supabaseService';

const SUPABASE_URL = "https://jcdbepgjoqxtnuarcwku.supabase.co"; 
const SUPABASE_KEY = "sb_publishable_w5tryB0lyl0hCNP3B9AAUg_udm3kUu0"; 
const LOGO_URL = "https://jcdbepgjoqxtnuarcwku.supabase.co/storage/v1/object/public/IMAGENES/metallo-removebg-preview.png";

const PARAM_LABELS: Record<string, string> = {
  strikeTime: "Golpe",
  toolChangeTime: "Cambio Herram.",
  tramTime: "Tiempo Tramo",
  craneTurnTime: "Volteo (Grúa)",
  craneRotateTime: "Giro (Grúa)",
  manualTurnTime: "Volteo",
  manualRotateTime: "Giro"
};

// MODAL DE TIEMPOS TOMADOS (HISTORIAL)
const HistoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  records: TimeRecord[];
  machines: MachineConfig[];
  onDeleteRecord: (id: string) => void;
}> = ({ isOpen, onClose, records, machines, onDeleteRecord }) => {
  const [selectedParam, setSelectedParam] = useState<string | null>(null);

  const groupedByParam = useMemo(() => {
    const groups: Record<string, { label: string, records: TimeRecord[] }> = {};
    Object.entries(PARAM_LABELS).forEach(([key, label]) => {
      groups[key] = { label, records: [] };
    });
    records.forEach(rec => {
      if (groups[rec.parameter]) {
        groups[rec.parameter].records.push(rec);
      }
    });
    return groups;
  }, [records]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-950/90 backdrop-blur-md">
      <div className="bg-white rounded-t-[40px] sm:rounded-[40px] shadow-2xl w-full max-w-4xl flex flex-col h-[90vh] sm:h-auto sm:max-h-[90vh] overflow-hidden border border-slate-200 animate-in slide-in-from-bottom duration-300">
        
        {/* Header Dinámico */}
        <div className="p-6 sm:p-8 border-b flex justify-between items-center bg-slate-900 text-white shrink-0">
          <div>
            <h3 className="text-xl sm:text-2xl font-black tracking-tight uppercase leading-none">Historial de Tiempos</h3>
            <p className="text-[9px] text-blue-400 font-bold uppercase tracking-[0.3em] mt-2">Relevamientos vs Teoría</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-slate-300 text-4xl font-light p-2">&times;</button>
        </div>
        
        <div className="flex-1 overflow-hidden flex flex-col sm:flex-row bg-slate-50">
          <div className="w-full sm:w-64 border-b sm:border-r border-slate-200 shrink-0 bg-white">
            <div className="flex sm:flex-col overflow-x-auto sm:overflow-y-auto p-4 sm:p-6 gap-3 scrollbar-hide">
              <h4 className="hidden sm:block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Tipo de Parámetro</h4>
              {(Object.entries(groupedByParam) as [string, { label: string, records: TimeRecord[] }][]).map(([key, group]) => (
                <button
                  key={key}
                  onClick={() => setSelectedParam(key)}
                  className={`whitespace-nowrap sm:whitespace-normal text-left px-5 py-4 sm:p-4 rounded-2xl transition-all border shrink-0 sm:shrink ${
                    selectedParam === key 
                    ? 'bg-blue-600 text-white border-blue-700 shadow-lg shadow-blue-600/20' 
                    : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'
                  }`}
                >
                  <div className="text-[11px] sm:text-xs font-black uppercase tracking-tight">{group.label}</div>
                  <div className={`text-[9px] font-bold mt-0.5 ${selectedParam === key ? 'text-blue-200' : 'text-slate-400'}`}>
                    {group.records.length} REG.
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 scrollbar-hide">
            {!selectedParam ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 py-20">
                <div className="w-16 h-16 mb-6 bg-slate-100 rounded-full flex items-center justify-center">
                  <svg className="w-8 h-8 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">Elige un parámetro para ver detalle</p>
              </div>
            ) : (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-400">
                <section className="mb-10">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 bg-blue-600 rounded-full"></div>
                    <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.15em]">Configuración Actual</h5>
                  </div>
                  <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    {machines.map(m => (
                      <div key={m.id} className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm text-center sm:text-left">
                        <div className="text-[8px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">{m.id}</div>
                        <div className="text-sm sm:text-xl font-mono font-black text-slate-800 mt-1 truncate">
                          {(m[selectedParam as keyof MachineConfig] as number)?.toFixed(4)}
                        </div>
                        <div className="text-[8px] text-slate-400 font-bold uppercase mt-1">minutos</div>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 bg-orange-500 rounded-full"></div>
                    <h5 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.15em]">Registros en Planta</h5>
                  </div>
                  {groupedByParam[selectedParam].records.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-slate-100 rounded-[32px] p-10 text-center text-slate-300 text-[10px] font-black uppercase tracking-widest">
                      Sin datos relevados aún
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {groupedByParam[selectedParam].records.map(rec => (
                        <div key={rec.id} className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm flex justify-between items-center hover:border-blue-100 transition-all">
                          <div className="flex items-center gap-4 sm:gap-6">
                            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center font-black text-slate-400 text-[9px] border border-slate-100">
                              {rec.machineId}
                            </div>
                            <div>
                              <div className="text-xl sm:text-2xl font-mono font-black text-slate-800 tabular-nums">
                                {rec.value.toFixed(4)} <span className="text-[9px] text-slate-400 uppercase font-bold ml-1">min</span>
                              </div>
                              <div className="text-[8px] sm:text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest flex items-center gap-1.5">
                                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                {rec.timestamp}
                              </div>
                            </div>
                          </div>
                          <button 
                            onClick={() => onDeleteRecord(rec.id)} 
                            className="text-slate-200 hover:text-red-500 p-2 sm:p-3 rounded-xl transition-all"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// MODAL DE PROGRAMACIÓN
const BatchModal: React.FC<{ 
  isOpen: boolean;
  onClose: () => void;
  machines: MachineConfig[], 
  onAddBatch: (batch: any) => void
}> = ({ isOpen, onClose, machines, onAddBatch }) => {
  const [formData, setFormData] = useState({
    name: '', machineId: machines[0]?.id || '', pieces: 100, strikesPerPiece: 5, 
    trams: 1, turnTime: 0.05, rotateTime: 0.05, useCraneTurn: false, 
    useCraneRotate: false, requiresToolChange: false, notes: '',
    scheduledDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    if (isOpen && machines.length > 0) {
      const selectedMachine = machines.find(m => m.id === formData.machineId) || machines[0];
      setFormData(prev => ({
        ...prev,
        machineId: selectedMachine.id,
        turnTime: selectedMachine.manualTurnTime || 0.05,
        rotateTime: selectedMachine.manualRotateTime || 0.05
      }));
    }
  }, [formData.machineId, machines, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center bg-blue-700 text-white">
          <h3 className="text-xl font-black uppercase tracking-tight">Nueva Programación</h3>
          <button onClick={onClose} className="text-white text-3xl font-light">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-white space-y-6">
          <form onSubmit={(e) => { e.preventDefault(); onAddBatch(formData); onClose(); }} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Trabajo / Pedido</label>
              <input type="text" className="w-full border-2 border-slate-100 rounded-xl p-3 focus:border-blue-600 outline-none font-bold text-lg" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required placeholder="Ej: Pedido #9921" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Máquina</label>
                <select className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold bg-slate-50" value={formData.machineId} onChange={e => setFormData({ ...formData, machineId: e.target.value })}>
                  {machines.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Fecha</label>
                <input type="date" className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold" value={formData.scheduledDate} onChange={e => setFormData({ ...formData, scheduledDate: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Piezas</label>
                <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold" value={formData.pieces} onChange={e => setFormData({ ...formData, pieces: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Golpes/Pza</label>
                <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold" value={formData.strikesPerPiece} onChange={e => setFormData({ ...formData, strikesPerPiece: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Tramos</label>
                <input type="number" className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold" value={formData.trams} onChange={e => setFormData({ ...formData, trams: parseInt(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Volteo (min)</label>
                <input type="number" step="0.01" className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold" value={formData.turnTime} onChange={e => setFormData({ ...formData, turnTime: parseFloat(e.target.value) || 0 })} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Giro (min)</label>
                <input type="number" step="0.01" className="w-full border-2 border-slate-100 p-4 rounded-2xl font-bold focus:border-blue-600 outline-none" value={formData.rotateTime} onChange={e => setFormData({ ...formData, rotateTime: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
               <label className="flex items-center gap-3 font-bold text-sm text-slate-600 cursor-pointer"><input type="checkbox" className="w-5 h-5 rounded" checked={formData.useCraneTurn} onChange={e => setFormData({...formData, useCraneTurn: e.target.checked})} /> Usar Puente Grúa (Volteo)</label>
               <label className="flex items-center gap-3 font-bold text-sm text-slate-600 cursor-pointer"><input type="checkbox" className="w-5 h-5 rounded" checked={formData.useCraneRotate} onChange={e => setFormData({...formData, useCraneRotate: e.target.checked})} /> Usar Puente Grúa (Giro)</label>
               <label className="flex items-center gap-3 font-bold text-sm text-slate-600 cursor-pointer"><input type="checkbox" className="w-5 h-5 rounded" checked={formData.requiresToolChange} onChange={e => setFormData({...formData, requiresToolChange: e.target.checked})} /> Requiere Cambio de Herramientas</label>
            </div>

            <button type="submit" className="w-full bg-blue-700 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-sm shadow-xl shadow-blue-100 active:scale-95 transition-all">Ejecutar Programación</button>
          </form>
        </div>
      </div>
    </div>
  );
};

// MODAL DEL CRONÓMETRO
const StopwatchModal: React.FC<{
  isOpen: boolean; onClose: () => void; machines: MachineConfig[];
  onSaveRecord: (rec: TimeRecord) => void;
}> = ({ isOpen, onClose, machines, onSaveRecord }) => {
  const [activeMachineId, setActiveMachineId] = useState(machines[0]?.id || '');
  const [activeParam, setActiveParam] = useState<keyof MachineConfig>('strikeTime');
  const [time, setTime] = useState(0); 
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRunning) {
      const start = Date.now() - time * 1000;
      timerRef.current = window.setInterval(() => setTime((Date.now() - start) / 1000), 10);
    } else { if (timerRef.current) clearInterval(timerRef.current); }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRunning, time]);

  if (!isOpen) return null;

  const handleCapture = () => {
    if (time <= 0) return;
    const val = time / 60;
    const newRecord: TimeRecord = { id: `rec-${Date.now()}`, machineId: activeMachineId, parameter: activeParam, value: val, timestamp: new Date().toLocaleString() };
    onSaveRecord(newRecord);
    saveTimeStudy(newRecord).catch(() => {});
    setTime(0);
    setIsRunning(false);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/90 backdrop-blur-lg p-4">
      <div className="bg-slate-900 rounded-[40px] shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-slate-800">
        <div className="p-10 text-center border-b border-slate-800">
           <h3 className="text-xs font-black uppercase tracking-[0.3em] mb-4 text-orange-500">Cronometraje Real</h3>
           <div className="text-7xl font-mono font-black text-white tabular-nums tracking-tighter">
             {time.toFixed(2)}<span className="text-2xl ml-1 text-slate-600 italic">s</span>
           </div>
        </div>
        <div className="p-8 space-y-6 flex-1 bg-slate-900">
           <div className="grid grid-cols-2 gap-3">
              <select className="bg-slate-800 border border-slate-700 text-white rounded-2xl p-3 font-bold text-xs" value={activeMachineId} onChange={e => setActiveMachineId(e.target.value)}>
                {machines.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
              </select>
              <select className="bg-slate-800 border border-slate-700 text-white rounded-2xl p-3 font-bold text-xs" value={activeParam} onChange={e => setActiveParam(e.target.value as keyof MachineConfig)}>
                {Object.entries(PARAM_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
           </div>
           <div className="grid grid-cols-3 gap-3">
              <button onClick={() => setIsRunning(!isRunning)} className={`aspect-square flex flex-col items-center justify-center rounded-3xl font-black transition-all active:scale-90 ${isRunning ? 'bg-slate-800 text-orange-500' : 'bg-orange-500 text-white'}`}>
                {isRunning ? <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg> : <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
                <span className="text-[10px] mt-1 uppercase tracking-tighter">{isRunning ? 'Pausa' : 'Inicio'}</span>
              </button>
              <button onClick={handleCapture} disabled={time <= 0} className="aspect-square flex flex-col items-center justify-center rounded-3xl bg-blue-600 text-white font-black shadow-lg shadow-blue-500/20 disabled:opacity-20 active:scale-90 transition-all">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                <span className="text-[10px] mt-1 uppercase tracking-tighter">Captura</span>
              </button>
              <button onClick={() => { setTime(0); setIsRunning(false); }} className="aspect-square flex flex-col items-center justify-center rounded-3xl bg-slate-800 text-slate-400 font-black border border-slate-700 active:scale-90 transition-all">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                <span className="text-[10px] mt-1 uppercase tracking-tighter">Reset</span>
              </button>
           </div>
        </div>
        <button onClick={onClose} className="p-6 bg-slate-800 text-slate-500 font-black uppercase tracking-[0.2em] text-[10px] border-t border-slate-700">Cerrar</button>
      </div>
    </div>
  );
};

// COLUMNA DE MÁQUINA
const MachineColumn: React.FC<{ machine: MachineConfig, batches: Batch[], onDeleteBatch: (id: string) => void }> = ({ machine, batches, onDeleteBatch }) => {
  const scheduleByDate = useMemo(() => {
    const dates: Record<string, DailySchedule> = {};
    const filtered = batches.filter(b => b.machineId === machine.id);
    filtered.forEach(b => {
      if (!dates[b.scheduledDate]) dates[b.scheduledDate] = { date: b.scheduledDate, batches: [], totalTime: 0, capacityPercentage: 0 };
      dates[b.scheduledDate].batches.push(b);
      dates[b.scheduledDate].totalTime += b.totalTime;
    });
    const capacityPerDay = (Number(machine.productiveHours) || 16) * 60; 
    Object.values(dates).forEach(d => d.capacityPercentage = Math.min(100, (d.totalTime / capacityPerDay) * 100));
    return Object.values(dates).sort((a, b) => b.date.localeCompare(a.date));
  }, [batches, machine]);

  return (
    <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col min-h-[400px]">
      <div className="p-6 flex justify-between items-center border-b border-slate-50 bg-slate-50/50">
        <div>
          <h3 className="text-2xl font-black tracking-tighter text-slate-900">{machine.id}</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{machine.name}</p>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">{machine.efficiency}% EFI</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-5 max-h-[550px] scrollbar-hide">
        {scheduleByDate.length === 0 ? (
          <div className="py-24 text-center text-slate-300 italic text-sm font-medium">Sin carga de trabajo</div>
        ) : (
          scheduleByDate.map(day => (
            <div key={day.date} className="bg-slate-50 rounded-3xl p-5 border border-slate-100">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest bg-white px-3 py-1.5 rounded-xl border border-slate-200">{day.date}</span>
                <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl ${day.capacityPercentage > 90 ? 'bg-red-500 text-white' : 'bg-blue-700 text-white'}`}>{day.capacityPercentage.toFixed(0)}%</span>
              </div>
              <div className="space-y-3">
                {day.batches.map(b => (
                  <div key={b.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center group shadow-sm active:scale-[0.98] transition-all">
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="text-xs font-black text-slate-900 truncate uppercase tracking-tight">{b.name}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{formatTime(b.totalTime)} • {b.pieces} pzs</div>
                    </div>
                    <button onClick={() => onDeleteBatch(b.id)} className="text-slate-300 hover:text-red-500 transition-colors p-2 text-2xl font-light">&times;</button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// MODAL DE AJUSTES: CON SELECTOR DE BOTONES PREMIUM
const SettingsModal: React.FC<{ 
  isOpen: boolean, 
  onClose: () => void, 
  machines: MachineConfig[], 
  onSave: (newMachines: MachineConfig[]) => void 
}> = ({ isOpen, onClose, machines, onSave }) => {
  const [localMachines, setLocalMachines] = useState<MachineConfig[]>([]);
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);

  useEffect(() => { 
    if (isOpen) {
      setLocalMachines(JSON.parse(JSON.stringify(machines))); 
      setEditingMachineId(null);
    }
  }, [isOpen, machines]);

  if (!isOpen) return null;

  const updateField = (id: string, field: keyof MachineConfig, value: any) => 
    setLocalMachines(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));

  const currentMachine = localMachines.find(m => m.id === editingMachineId);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-md p-0 sm:p-4">
      <div className="bg-white rounded-t-[40px] sm:rounded-[40px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-300">
        
        {/* Header Dinámico */}
        <div className="p-6 sm:p-8 border-b flex justify-between items-center bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-4">
            {editingMachineId && (
              <button 
                onClick={() => setEditingMachineId(null)}
                className="w-10 h-10 bg-slate-800 rounded-xl flex items-center justify-center hover:bg-slate-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            <div>
              <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight leading-none">
                {editingMachineId ? `Config: ${editingMachineId}` : 'Parámetros por Plegadora'}
              </h3>
              {!editingMachineId && <p className="text-[9px] text-blue-400 font-bold uppercase tracking-[0.2em] mt-2">Seleccione una máquina para editar</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-white text-4xl font-light p-2">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-slate-50 scrollbar-hide">
          {!editingMachineId ? (
            /* VISTA 1: Selector de Máquinas (Botones Grandes) */
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in zoom-in-95 duration-200">
              {localMachines.map(m => (
                <button
                  key={m.id}
                  onClick={() => setEditingMachineId(m.id)}
                  className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 transition-all text-left group active:scale-95"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                      {m.id}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 group-hover:text-blue-500 transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" /></svg>
                    </div>
                  </div>
                  <h4 className="font-black text-slate-900 text-lg uppercase leading-tight mb-1">{m.name}</h4>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest truncate">{m.description || 'Configuración general'}</p>
                </button>
              ))}
            </div>
          ) : (
            /* VISTA 2: Editor de Máquina Individual */
            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
              {currentMachine && (
                <div className="bg-white p-6 sm:p-10 rounded-[40px] border border-slate-200 shadow-sm space-y-10">
                  
                  {/* Sección 1: Identificación */}
                  <div>
                    <h5 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-6 border-b pb-2">Información Básica</h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Nombre Comercial</label>
                        <input type="text" className="w-full border-2 border-slate-100 p-4 rounded-2xl font-bold text-sm focus:border-blue-600 outline-none bg-slate-50/50" value={currentMachine.name} onChange={e => updateField(currentMachine.id, 'name', e.target.value)} />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Descripción Corta</label>
                        <input type="text" className="w-full border-2 border-slate-100 p-4 rounded-2xl font-medium text-sm focus:border-blue-600 outline-none bg-slate-50/50" value={currentMachine.description} onChange={e => updateField(currentMachine.id, 'description', e.target.value)} />
                      </div>
                    </div>
                  </div>

                  {/* Sección 2: Productividad */}
                  <div>
                    <h5 className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em] mb-6 border-b pb-2">Capacidad y Eficiencia</h5>
                    <div className="grid grid-cols-2 gap-4 sm:gap-6">
                      <div><label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Eficiencia %</label><input type="number" className="w-full border-2 border-slate-100 p-4 rounded-2xl font-bold focus:border-blue-600 outline-none" value={currentMachine.efficiency} onChange={e => updateField(currentMachine.id, 'efficiency', parseInt(e.target.value))} /></div>
                      <div><label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Horas/Día</label><input type="number" step="1" className="w-full border-2 border-slate-100 p-4 rounded-2xl font-bold focus:border-blue-600 outline-none" value={currentMachine.productiveHours} onChange={e => updateField(currentMachine.id, 'productiveHours', parseFloat(e.target.value))} /></div>
                    </div>
                  </div>

                  {/* Sección 3: Tiempos Base */}
                  <div>
                    <h5 className="text-[10px] font-black text-orange-600 uppercase tracking-[0.3em] mb-6 border-b pb-2">Ciclos de Trabajo (min)</h5>
                    <div className="grid grid-cols-2 gap-4 sm:gap-6">
                      <div><label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Veloc. Golpe</label><input type="number" step="0.001" className="w-full border-2 border-slate-100 p-4 rounded-2xl font-bold focus:border-blue-600 outline-none" value={currentMachine.strikeTime} onChange={e => updateField(currentMachine.id, 'strikeTime', parseFloat(e.target.value))} /></div>
                      <div><label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Cambio Herram.</label><input type="number" step="0.1" className="w-full border-2 border-slate-100 p-4 rounded-2xl font-bold focus:border-blue-600 outline-none" value={currentMachine.toolChangeTime} onChange={e => updateField(currentMachine.id, 'toolChangeTime', parseFloat(e.target.value))} /></div>
                    </div>
                  </div>

                  {/* Sección 4: Maniobras */}
                  <div>
                    <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 border-b pb-2">Maniobras Específicas</h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Volteo Manual</label><input type="number" step="0.01" className="w-full border-2 border-slate-100 p-4 rounded-2xl font-bold focus:border-blue-600 outline-none" value={currentMachine.manualTurnTime} onChange={e => updateField(currentMachine.id, 'manualTurnTime', parseFloat(e.target.value))} /></div>
                      <div><label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Giro Manual</label><input type="number" step="0.01" className="w-full border-2 border-slate-100 p-4 rounded-2xl font-bold focus:border-blue-600 outline-none" value={currentMachine.manualRotateTime} onChange={e => updateField(currentMachine.id, 'manualRotateTime', parseFloat(e.target.value))} /></div>
                      <div><label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Volteo Grúa</label><input type="number" step="0.01" className="w-full border-2 border-slate-100 p-4 rounded-2xl font-bold focus:border-blue-600 outline-none" value={currentMachine.craneTurnTime} onChange={e => updateField(currentMachine.id, 'craneTurnTime', parseFloat(e.target.value))} /></div>
                      <div><label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Giro Grúa</label><input type="number" step="0.01" className="w-full border-2 border-slate-100 p-4 rounded-2xl font-bold focus:border-blue-600 outline-none" value={currentMachine.craneRotateTime} onChange={e => updateField(currentMachine.id, 'craneRotateTime', parseFloat(e.target.value))} /></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 sm:p-8 border-t bg-white flex justify-between items-center shrink-0">
          <button 
            onClick={onClose} 
            className="px-6 py-4 font-black text-slate-400 uppercase text-[10px] tracking-widest hover:text-slate-600"
          >
            Cerrar Ventana
          </button>
          <button 
            onClick={() => { onSave(localMachines); onClose(); }} 
            className="px-10 py-5 bg-blue-700 text-white rounded-[24px] font-black uppercase text-[10px] tracking-widest shadow-2xl shadow-blue-700/30 active:scale-95 transition-all flex items-center gap-3"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            Aplicar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};

// APP PRINCIPAL
export default function App() {
  const [machines, setMachines] = useState<MachineConfig[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [isStopwatchOpen, setIsStopwatchOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const savedM = localStorage.getItem(STORAGE_KEYS.CONFIG);
    const savedB = localStorage.getItem(STORAGE_KEYS.BATCHES);
    const savedR = localStorage.getItem(STORAGE_KEYS.RECORDS);
    if (savedM) setMachines(JSON.parse(savedM)); else setMachines(INITIAL_MACHINES);
    if (savedB) setBatches(JSON.parse(savedB));
    if (savedR) setRecords(JSON.parse(savedR));

    if (initSupabase(SUPABASE_URL, SUPABASE_KEY)) {
      fetchMachines().then(m => { if(m.length) setMachines(m); });
      fetchBatches().then(b => { if(b.length) setBatches(b); });
      fetchTimeRecords().then(r => { if(r.length) setRecords(r); });
    }
  }, []);

  const handleSync = useCallback(async (m: MachineConfig[], b: Batch[]) => {
    const cloud = checkCloudStatus();
    if (!cloud.available) return;
    try { await syncAppData(m, b); setStatus("Sincronizado"); } 
    catch (e) { setStatus("Error Nube"); }
    setTimeout(() => setStatus(""), 3000);
  }, []);

  const handleAddBatch = (batchInput: any) => {
    const machine = machines.find(m => m.id === batchInput.machineId);
    if (!machine) return;
    const totalTime = calculateBatchTime(batchInput, machine);
    const newBatch = { ...batchInput, id: `b-${Date.now()}`, totalTime };
    const updated = [...batches, newBatch];
    setBatches(updated);
    localStorage.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(updated));
    handleSync(machines, updated);
  };

  const handleSaveRecord = (rec: TimeRecord) => {
    const updated = [rec, ...records];
    setRecords(updated);
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(updated));
  };

  const handleDeleteBatch = async (id: string) => {
    const updated = batches.filter(b => b.id !== id);
    setBatches(updated);
    localStorage.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(updated));
    
    // Eliminar de la nube de forma asíncrona
    await deleteBatchFromCloud(id);
    setStatus("Sincronizado");
    setTimeout(() => setStatus(""), 2000);
  };

  const handleDeleteRecord = async (id: string) => {
    const updated = records.filter(r => r.id !== id);
    setRecords(updated);
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(updated));

    // Eliminar de la nube de forma asíncrona
    await deleteTimeRecordFromCloud(id);
    setStatus("Sincronizado");
    setTimeout(() => setStatus(""), 2000);
  };

  if (machines.length === 0) return <div className="fixed inset-0 flex items-center justify-center bg-slate-950 text-white font-black animate-pulse uppercase tracking-[1em] text-xs">Metallo</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Inter'] pb-10">
      <header className="bg-white px-5 pt-6 pb-6 flex flex-col gap-6 sticky top-0 z-40 shadow-xl shadow-slate-200/40 border-b border-slate-100">
        <div className="flex justify-between items-center">
           <div className="flex items-center gap-4">
              <img src={LOGO_URL} alt="METALLO" className="h-16 w-auto object-contain" />
              <div className="flex flex-col">
                <span className="text-slate-900 font-black text-lg leading-none uppercase tracking-wider">Simulador de Programación</span>
                <span className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Control de Producción Metallo</span>
              </div>
           </div>
           <button onClick={() => setIsSettingsOpen(true)} className="w-12 h-12 flex items-center justify-center bg-slate-50 rounded-2xl text-slate-400 shadow-inner border border-slate-100 active:scale-90 transition-all">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
           </button>
        </div>
        
        <div className="flex gap-3 h-20">
           <button onClick={() => setIsStopwatchOpen(true)} className="aspect-square h-full bg-orange-500 rounded-3xl flex flex-col items-center justify-center text-white shadow-2xl shadow-orange-500/30 active:scale-95 transition-all border-b-4 border-orange-600">
             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
             <span className="text-[9px] font-black uppercase mt-1.5 tracking-tighter">Cronógrafo</span>
           </button>
           
           <button onClick={() => setIsHistoryOpen(true)} className="flex-1 h-full bg-slate-900 rounded-3xl flex flex-col items-center justify-center text-white shadow-2xl shadow-slate-900/30 active:scale-95 transition-all border-b-4 border-slate-950">
             <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
             <span className="text-[10px] font-black uppercase mt-1.5 tracking-widest text-blue-100">Tiempos Tomados</span>
           </button>
           
           <button onClick={() => setIsBatchOpen(true)} className="flex-1 h-full bg-blue-700 rounded-3xl flex flex-col items-center justify-center text-white shadow-2xl shadow-blue-700/30 active:scale-95 transition-all border-b-4 border-blue-800">
             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
             <span className="text-[10px] font-black uppercase mt-1.5 tracking-widest">Programar</span>
           </button>
        </div>
        {status && <div className="text-center text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] animate-pulse">{status}</div>}
      </header>

      <main className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8 max-w-[2400px] mx-auto w-full">
         {machines.map(m => (
           <MachineColumn key={m.id} machine={m} batches={batches} onDeleteBatch={handleDeleteBatch} />
         ))}
      </main>

      <BatchModal isOpen={isBatchOpen} onClose={() => setIsBatchOpen(false)} machines={machines} onAddBatch={handleAddBatch} />
      <StopwatchModal isOpen={isStopwatchOpen} onClose={() => setIsStopwatchOpen(false)} machines={machines} onSaveRecord={handleSaveRecord} />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} records={records} machines={machines} onDeleteRecord={handleDeleteRecord} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} machines={machines} onSave={m => { setMachines(m); handleSync(m, batches); }} />
    </div>
  );
}
