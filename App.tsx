
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
  fetchTimeRecords
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

// MODAL DE TIEMPOS TOMADOS
const HistoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  records: TimeRecord[];
  onDeleteRecord: (id: string) => void;
}> = ({ isOpen, onClose, records, onDeleteRecord }) => {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);

  const groupedRecords = useMemo(() => {
    const groups: Record<string, { label: string, machineId: string, records: TimeRecord[] }> = {};
    records.forEach(rec => {
      const groupKey = `${rec.machineId}-${rec.parameter}`;
      if (!groups[groupKey]) {
        groups[groupKey] = {
          label: PARAM_LABELS[rec.parameter] || rec.parameter,
          machineId: rec.machineId,
          records: []
        };
      }
      groups[groupKey].records.push(rec);
    });
    return groups;
  }, [records]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center bg-slate-900 text-white">
          <div>
            <h3 className="text-xl font-black tracking-tight">Tiempos Tomados</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Historial de registros sincronizados</p>
          </div>
          <button onClick={onClose} className="text-white hover:text-slate-300 text-3xl font-light">&times;</button>
        </div>
        
        <div className="flex-1 overflow-hidden flex bg-slate-50">
          {/* Listado de Grupos */}
          <div className="w-1/3 border-r border-slate-200 overflow-y-auto p-4 space-y-2 bg-white">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Parámetros</h4>
            {Object.keys(groupedRecords).length === 0 ? (
              <div className="text-[10px] text-slate-300 italic">Sin datos</div>
            ) : (
              Object.entries(groupedRecords).map(([key, group]: [string, any]) => (
                <button
                  key={key}
                  onClick={() => setSelectedGroup(key)}
                  className={`w-full text-left p-3 rounded-xl transition-all border ${
                    selectedGroup === key 
                    ? 'bg-blue-600 text-white border-blue-700 shadow-md' 
                    : 'bg-slate-50 text-slate-600 border-transparent hover:bg-slate-100'
                  }`}
                >
                  <div className="text-[9px] font-black uppercase tracking-tighter opacity-70">{group.machineId}</div>
                  <div className="text-xs font-bold truncate">{group.label}</div>
                  <div className={`text-[8px] font-black mt-1 ${selectedGroup === key ? 'text-blue-200' : 'text-slate-400'}`}>
                    {group.records.length} CAPTURAS
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Listado de Capturas */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {!selectedGroup ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300">
                <svg className="w-12 h-12 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <p className="text-xs font-bold uppercase tracking-widest">Selecciona un parámetro</p>
              </div>
            ) : (
              groupedRecords[selectedGroup].records.map(rec => (
                <div key={rec.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex justify-between items-center group animate-in fade-in slide-in-from-right-4 duration-300">
                  <div>
                    <div className="text-2xl font-mono font-black text-slate-800 tabular-nums">
                      {rec.value.toFixed(4)} <span className="text-[10px] text-slate-400 uppercase ml-1">min</span>
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold uppercase mt-1 tracking-widest flex items-center gap-2">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {rec.timestamp}
                    </div>
                  </div>
                  <button onClick={() => onDeleteRecord(rec.id)} className="text-slate-200 hover:text-red-500 p-2 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// MODAL DE PROGRAMACIÓN DE LOTE
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddBatch(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
        <div className="p-6 border-b flex justify-between items-center bg-blue-700 text-white">
          <h3 className="text-xl font-black uppercase tracking-tight">Nueva Programación</h3>
          <button onClick={onClose} className="text-white text-3xl font-light">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-white space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5">
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
                <input type="number" step="0.01" className="w-full border-2 border-slate-100 rounded-xl p-3 font-bold" value={formData.rotateTime} onChange={e => setFormData({ ...formData, rotateTime: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
               <label className="flex items-center gap-3 font-bold text-sm text-slate-600 cursor-pointer"><input type="checkbox" className="w-5 h-5 rounded" checked={formData.useCraneTurn} onChange={e => setFormData({...formData, useCraneTurn: e.target.checked})} /> Usar Puente Grúa (Volteo)</label>
               <label className="flex items-center gap-3 font-bold text-sm text-slate-600 cursor-pointer"><input type="checkbox" className="w-5 h-5 rounded" checked={formData.useCraneRotate} onChange={e => setFormData({...formData, useCraneRotate: e.target.checked})} /> Usar Puente Grúa (Giro)</label>
               <label className="flex items-center gap-3 font-bold text-sm text-slate-600 cursor-pointer"><input type="checkbox" className="w-5 h-5 rounded" checked={formData.requiresToolChange} onChange={e => setFormData({...formData, requiresToolChange: e.target.checked})} /> Requiere Cambio de Herramientas</label>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Notas Adicionales</label>
              <textarea className="w-full border-2 border-slate-100 rounded-xl p-3 focus:border-blue-600 outline-none font-medium text-sm" rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Instrucciones específicas..."></textarea>
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
  onUpdateMachineValue: (machineId: string, param: keyof MachineConfig, value: number) => void;
  onSaveRecord: (rec: TimeRecord) => void;
}> = ({ isOpen, onClose, machines, onUpdateMachineValue, onSaveRecord }) => {
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
        <button onClick={onClose} className="p-6 bg-slate-800 text-slate-500 font-black uppercase tracking-[0.2em] text-[10px] border-t border-slate-700 active:bg-slate-700">Cerrar</button>
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
                <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl ${day.capacityPercentage > 90 ? 'bg-red-500 text-white' : 'bg-blue-700 text-white shadow-lg shadow-blue-700/20'}`}>{day.capacityPercentage.toFixed(0)}%</span>
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

// MODAL DE AJUSTES
const SettingsModal: React.FC<{ isOpen: boolean, onClose: () => void, machines: MachineConfig[], onSave: (newMachines: MachineConfig[]) => void }> = ({ isOpen, onClose, machines, onSave }) => {
  const [localMachines, setLocalMachines] = useState<MachineConfig[]>([]);
  useEffect(() => { if (isOpen) setLocalMachines(JSON.parse(JSON.stringify(machines))); }, [isOpen, machines]);
  if (!isOpen) return null;
  const updateField = (id: string, field: keyof MachineConfig, value: any) => setLocalMachines(prev => prev.map(m => m.id === id ? { ...m, [field]: value } : m));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="p-8 border-b flex justify-between items-center bg-slate-900 text-white">
          <h3 className="text-2xl font-black uppercase tracking-tight">Parámetros por Plegadora</h3>
          <button onClick={onClose} className="text-white text-4xl font-light">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50 space-y-6">
           {localMachines.map(m => (
             <div key={m.id} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                <div className="flex justify-between items-center border-b pb-4 mb-4">
                   <div className="flex-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Identificador</label>
                      <h4 className="font-black text-slate-900 text-xl uppercase tracking-tight">{m.id}</h4>
                   </div>
                   <div className="flex-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nombre Comercial</label>
                      <input type="text" className="w-full border-2 border-slate-100 p-2 rounded-xl font-bold text-sm" value={m.name} onChange={e => updateField(m.id, 'name', e.target.value)} />
                   </div>
                </div>

                <div className="mb-4">
                   <label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Descripción / Especialidad</label>
                   <input type="text" className="w-full border-2 border-slate-100 p-3 rounded-xl font-medium text-sm" value={m.description} onChange={e => updateField(m.id, 'description', e.target.value)} />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                   <div><label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Golpe (min)</label><input type="number" step="0.001" className="w-full border-2 border-slate-100 p-3 rounded-2xl font-bold" value={m.strikeTime} onChange={e => updateField(m.id, 'strikeTime', parseFloat(e.target.value))} /></div>
                   <div><label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Cambio Herram. (min)</label><input type="number" step="0.1" className="w-full border-2 border-slate-100 p-3 rounded-2xl font-bold" value={m.toolChangeTime} onChange={e => updateField(m.id, 'toolChangeTime', parseFloat(e.target.value))} /></div>
                   <div><label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Tiempo Tramo (min)</label><input type="number" step="0.1" className="w-full border-2 border-slate-100 p-3 rounded-2xl font-bold" value={m.tramTime} onChange={e => updateField(m.id, 'tramTime', parseFloat(e.target.value))} /></div>
                   <div><label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Eficiencia %</label><input type="number" className="w-full border-2 border-slate-100 p-3 rounded-2xl font-bold" value={m.efficiency} onChange={e => updateField(m.id, 'efficiency', parseInt(e.target.value))} /></div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-4 border-t border-slate-50">
                   <div><label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Volteo con puente de grúa (min)</label><input type="number" step="0.01" className="w-full border-2 border-slate-100 p-3 rounded-2xl font-bold" value={m.craneTurnTime} onChange={e => updateField(m.id, 'craneTurnTime', parseFloat(e.target.value))} /></div>
                   <div><label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Giro con puente de grúa (min)</label><input type="number" step="0.01" className="w-full border-2 border-slate-100 p-3 rounded-2xl font-bold" value={m.craneRotateTime} onChange={e => updateField(m.id, 'craneRotateTime', parseFloat(e.target.value))} /></div>
                   <div><label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Volteo (min)</label><input type="number" step="0.01" className="w-full border-2 border-slate-100 p-3 rounded-2xl font-bold" value={m.manualTurnTime} onChange={e => updateField(m.id, 'manualTurnTime', parseFloat(e.target.value))} /></div>
                   <div><label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Giro (min)</label><input type="number" step="0.01" className="w-full border-2 border-slate-100 p-3 rounded-2xl font-bold" value={m.manualRotateTime} onChange={e => updateField(m.id, 'manualRotateTime', parseFloat(e.target.value))} /></div>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-50">
                   <div><label className="text-[10px] font-black text-slate-500 uppercase mb-2 block">Horas Productivas/Día</label><input type="number" step="1" className="w-full border-2 border-slate-100 p-3 rounded-2xl font-bold" value={m.productiveHours} onChange={e => updateField(m.id, 'productiveHours', parseFloat(e.target.value))} /></div>
                </div>
             </div>
           ))}
        </div>
        <div className="p-8 border-t bg-white flex justify-end gap-4">
          <button onClick={onClose} className="px-8 py-4 font-black text-slate-400 uppercase text-xs tracking-widest">Cancelar</button>
          <button onClick={() => { onSave(localMachines); onClose(); }} className="px-10 py-4 bg-blue-700 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-700/30 active:scale-95 transition-all">Guardar Configuración</button>
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

  const handleDeleteBatch = (id: string) => {
    const updated = batches.filter(b => b.id !== id);
    setBatches(updated);
    localStorage.setItem(STORAGE_KEYS.BATCHES, JSON.stringify(updated));
    handleSync(machines, updated);
  };

  const handleDeleteRecord = (id: string) => {
    const updated = records.filter(r => r.id !== id);
    setRecords(updated);
    localStorage.setItem(STORAGE_KEYS.RECORDS, JSON.stringify(updated));
  };

  if (machines.length === 0) return <div className="fixed inset-0 flex items-center justify-center bg-slate-950 text-white font-black animate-pulse uppercase tracking-[1em] text-xs">Metallo</div>;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Inter'] pb-10">
      {/* CABECERA PREMIUM MÓVIL */}
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
        
        {/* BOTONES DE ACCIÓN PRINCIPALES */}
        <div className="flex gap-3 h-20">
           {/* BOTÓN CRONÓMETRO (CUADRADO) */}
           <button onClick={() => setIsStopwatchOpen(true)} className="aspect-square h-full bg-orange-500 rounded-3xl flex flex-col items-center justify-center text-white shadow-2xl shadow-orange-500/30 active:scale-95 transition-all border-b-4 border-orange-600">
             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
             <span className="text-[9px] font-black uppercase mt-1.5 tracking-tighter">Cronógrafo</span>
           </button>
           
           {/* BOTÓN TIEMPOS TOMADOS (RECTANGULAR AZUL OSCURO) */}
           <button onClick={() => setIsHistoryOpen(true)} className="flex-1 h-full bg-slate-900 rounded-3xl flex flex-col items-center justify-center text-white shadow-2xl shadow-slate-900/30 active:scale-95 transition-all border-b-4 border-slate-950">
             <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
             <span className="text-[10px] font-black uppercase mt-1.5 tracking-widest text-blue-100">Tiempos Tomados</span>
           </button>
           
           {/* BOTÓN PROGRAMAR (RECTANGULAR AZUL PROFESIONAL) */}
           <button onClick={() => setIsBatchOpen(true)} className="flex-1 h-full bg-blue-700 rounded-3xl flex flex-col items-center justify-center text-white shadow-2xl shadow-blue-700/30 active:scale-95 transition-all border-b-4 border-blue-800">
             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
             <span className="text-[10px] font-black uppercase mt-1.5 tracking-widest">Programar</span>
           </button>
        </div>
        {status && <div className="text-center text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] animate-pulse">{status}</div>}
      </header>

      {/* DASHBOARD DE MÁQUINAS */}
      <main className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8 max-w-[2400px] mx-auto w-full">
         {machines.map(m => (
           <MachineColumn key={m.id} machine={m} batches={batches} onDeleteBatch={handleDeleteBatch} />
         ))}
      </main>

      {/* MODALES */}
      <BatchModal isOpen={isBatchOpen} onClose={() => setIsBatchOpen(false)} machines={machines} onAddBatch={handleAddBatch} />
      <StopwatchModal isOpen={isStopwatchOpen} onClose={() => setIsStopwatchOpen(false)} machines={machines} onUpdateMachineValue={() => {}} onSaveRecord={handleSaveRecord} />
      <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} records={records} onDeleteRecord={handleDeleteRecord} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} machines={machines} onSave={m => { setMachines(m); handleSync(m, batches); }} />
    </div>
  );
}
