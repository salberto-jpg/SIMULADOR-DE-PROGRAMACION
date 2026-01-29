
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { INITIAL_MACHINES } from './constants';
import { MachineConfig, Batch, Tool, Thickness, TimeRecord } from './types';
import { calculateBatchTime, formatTime, parseTimeToMinutes, getMachineTimelineSlices } from './utils/helpers';
import { optimizeProductionSchedule } from './services/geminiService';
import { 
  initSupabase, fetchMachines, fetchBatches, fetchTools, fetchThicknesses, fetchTimeRecords,
  saveTool, deleteTool, saveThickness, deleteThickness, syncAppData, deleteBatchFromCloud,
  subscribeToChanges, saveTimeRecord, saveBatch, saveMachine,
  mapDbBatchToApp, mapDbRecordToApp, mapDbToolToApp, mapDbThicknessToApp, mapDbMachineToApp
} from './services/supabaseService';

const LOGO_URL = "https://jcdbepgjoqxtnuarcwku.supabase.co/storage/v1/object/public/IMAGENES/metallo-removebg-preview.png";

type TabType = 'schedule' | 'machines' | 'tools' | 'thickness' | 'records';

// --- ICONOS ---
const Icons = {
  Schedule: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.375m1.875-3h1.875m-1.875 3h1.875M9 6.75h1.5m1.875 0h1.5m1.875 0H21m-9 3h7.5m-7.5 3h7.5m-7.5 3h7.5M3 6.75h1.5m1.875 0h1.5m1.875 0H9m-9 3h7.5m-7.5 3h7.5m-7.5 3h7.5M3 21a1.5 1.5 0 0 1-1.5-1.5V5.25A1.5 1.5 0 0 1 3 3.75h18a1.5 1.5 0 0 1 1.5 1.5v14.25a1.5 1.5 0 0 1-1.5 1.5H3Z" /></svg>,
  Machines: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0 0 15 0m-15 0a7.5 7.5 0 1 1 15 0m-15 0H3m16.5 0H21m-1.5 0H12m-8.457 3.077 1.41-.513m14.095-5.13 1.41-.513M5.106 17.785l1.15-.964m11.49-9.642 1.149-.964M7.501 19.795l.75-1.3m7.5-12.99.75-1.3m-6.06 15.633.13-1.494m0-12.427-.13-1.495m-3.477 14.39-.13-1.494m0-12.427.13-1.495m3.477 14.39a.75.75 0 0 1-1.385 0" /></svg>,
  Tools: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M11.423 20.242a3.375 3.375 0 0 1-4.773-4.773l3.174-3.174a.75.75 0 0 1 1.06 1.06l-3.174 3.174a1.875 1.875 0 1 0 2.651 2.651l3.174-3.174a.75.75 0 1 1 1.06 1.06l-3.174 3.174Zm3.899-8.04a3.375 3.375 0 0 1-4.773-4.773l3.174-3.174a.75.75 0 1 1 1.06 1.06l-3.174 3.174a1.875 1.875 0 1 0 2.651 2.651l3.174-3.174a.75.75 0 1 1 1.06 1.06l-3.174 3.174Z" /></svg>,
  Thickness: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v16.5m0-16.5h16.5m-16.5 0v16.5m16.5-16.5v16.5m0-16.5H3.75m16.5 16.5H3.75m0-16.5 16.5 16.5M3.75 20.25l16.5-16.5" /></svg>,
  Records: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>,
  Timer: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>,
  Sun: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M3 12h2.25m.386-6.364 1.591 1.591M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" /></svg>
};

const PARAM_LABELS: Record<string, string> = {
  strikeTime: "Tiempo de Golpe", toolChangeTime: "Cambio Herramental", setupTime: "Setup Inicial",
  measurementTime: "Medición por Pieza", tramTime: "Tramo Adicional", craneTurnTime: "Volteo con Grúa",
  craneRotateTime: "Giro con Grúa", manualTurnTime: "Volteo Manual", manualRotateTime: "Giro Manual",
  totalTime: "Tiempo Total de Lote", rotolaser_corte: "Giro CORTE", rotolaser_radio_chico: "Giro RADIO CHICO",
  rotolaser_pincazo: "Pincazo", rotolaser_vacio: "En vacío"
};

const TimeInput: React.FC<{ label: string; value: number; onChange: (val: number) => void; }> = ({ label, value, onChange }) => {
  const [displayValue, setDisplayValue] = useState(formatTime(value));
  useEffect(() => { setDisplayValue(formatTime(value)); }, [value]);
  const handleBlur = () => { const minutes = parseTimeToMinutes(displayValue); onChange(minutes); setDisplayValue(formatTime(minutes)); };
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-slate-400 block tracking-tight">{label}</label>
      <input type="text" className="w-full bg-slate-50/50 border border-slate-100 p-4 md:p-5 rounded-2xl font-black text-blue-950 outline-none focus:border-blue-800 focus:bg-white transition-all text-center" value={displayValue} onChange={(e) => setDisplayValue(e.target.value)} onBlur={handleBlur} placeholder="00:00:00" />
    </div>
  );
};

const MachineProductionCard: React.FC<{ machine: MachineConfig; allBatches: Batch[]; selectedDate: string; onEditBatch: (b: Batch) => void; onDeleteBatch: (id: string) => void; onZoomImage: (url: string) => void; }> = ({ machine, allBatches, selectedDate, onEditBatch, onDeleteBatch, onZoomImage }) => {
  const allSlices = getMachineTimelineSlices(machine, allBatches);
  const daySlices = allSlices.filter(s => s.date === selectedDate);
  const totalMinutesInDay = daySlices.reduce((acc, s) => acc + s.timeInDay, 0);
  const capacityMinutes = (machine.productiveHours || 16) * 60;
  const occupancy = Math.min(100, (totalMinutesInDay / capacityMinutes) * 100);

  return (
    <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[420px] md:h-[520px] hover:shadow-xl transition-all group">
      <div className="p-5 md:p-7 border-b border-slate-100 bg-slate-50/50">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg md:text-xl font-black text-blue-950 uppercase tracking-tighter">{machine.id}</h3>
          <span className={`text-[8px] font-black px-2.5 py-1 rounded-full uppercase ${occupancy > 95 ? 'bg-red-500 text-white' : 'bg-blue-800 text-white'}`}>{occupancy.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden"><div className="bg-blue-800 h-full transition-all duration-1000" style={{ width: `${occupancy}%` }} /></div>
        <div className="flex justify-between mt-3 text-[8px] font-black text-slate-400 uppercase tracking-widest"><span>{formatTime(totalMinutesInDay)} OCUPADO</span><span>{machine.productiveHours}HS MÁX</span></div>
      </div>
      <div className="flex-1 p-4 md:p-5 space-y-3.5 overflow-y-auto scrollbar-hide">
        {daySlices.length === 0 ? <div className="h-full flex flex-col items-center justify-center opacity-40"><div className="mb-2 text-slate-300"><Icons.Sun /></div><div className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Día sin carga</div></div> : daySlices.map((slice, idx) => (
            <div key={`${slice.batch.id}-${idx}`} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-blue-800/20 hover:shadow-md transition-all relative group/item">
              <div className="flex justify-between mb-1.5 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {slice.batch.isSimulation && <span className="text-[7px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter flex-shrink-0">Sim</span>}
                  <span className="text-[11px] font-black text-blue-950 uppercase truncate">{slice.batch.name}</span>
                </div>
                <span className="text-[9px] font-black text-blue-800 whitespace-nowrap">{formatTime(slice.timeInDay)}</span>
              </div>
              <div className="flex items-center gap-3">
                {slice.batch.imageUrl && <button onClick={() => onZoomImage(slice.batch.imageUrl!)} className="w-10 h-10 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0 hover:border-blue-800 transition-colors"><img src={slice.batch.imageUrl} alt="Pieza" className="w-full h-full object-cover" /></button>}
                <div className="flex-1 min-w-0 text-[8px] font-bold text-slate-400 uppercase tracking-wide">{slice.batch.pieces} Pzs • {slice.batch.thickness}mm</div>
              </div>
              <div className="mt-3 flex gap-2 opacity-100 md:opacity-0 group-hover/item:opacity-100 transition-all">
                <button onClick={() => onEditBatch(slice.batch)} className="text-[9px] font-black text-blue-800 uppercase bg-blue-50 px-3 py-1.5 rounded-lg">Editar</button>
                <button onClick={() => { if(confirm('¿Eliminar lote?')) onDeleteBatch(slice.batch.id); }} className="text-[9px] font-black text-red-500 uppercase bg-red-50 px-3 py-1.5 rounded-lg">Borrar</button>
              </div>
            </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [machines, setMachines] = useState<MachineConfig[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [thicknesses, setThicknesses] = useState<Thickness[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [status, setStatus] = useState("");
  const [isEditing, setIsEditing] = useState<{ type: string, data: any } | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [swTime, setSwTime] = useState(0); 
  const [swIsRunning, setSwIsRunning] = useState(false);
  const [swMachine, setSwMachine] = useState('PL-01');
  const [swParam, setSwParam] = useState<string>('strikeTime');
  const [swLength, setSwLength] = useState<string>(""); 
  const [isSwExpanded, setIsSwExpanded] = useState(false);
  
  const swIntervalRef = useRef<any>(null);
  const swStartTimeRef = useRef<number | null>(null); 
  const swAccumulatedSecsRef = useRef<number>(0); 

  useEffect(() => {
    if (swIsRunning) {
      swStartTimeRef.current = Date.now();
      swIntervalRef.current = setInterval(() => {
        const now = Date.now();
        const deltaSecs = (now - (swStartTimeRef.current || now)) / 1000;
        setSwTime(Math.floor(swAccumulatedSecsRef.current + deltaSecs));
      }, 500);
    } else {
      if (swStartTimeRef.current) {
        swAccumulatedSecsRef.current += (Date.now() - swStartTimeRef.current) / 1000;
        swStartTimeRef.current = null;
      }
      if (swIntervalRef.current) clearInterval(swIntervalRef.current);
    }
    return () => clearInterval(swIntervalRef.current);
  }, [swIsRunning]);

  useEffect(() => {
    const SUPABASE_URL = "https://jcdbepgjoqxtnuarcwku.supabase.co"; 
    const SUPABASE_KEY = "sb_publishable_w5tryB0lyl0hCNP3B9AAUg_udm3kUu0"; 
    initSupabase(SUPABASE_URL, SUPABASE_KEY);
    
    // Carga inicial rápida
    (async () => {
      const [m, b, t, th, r] = await Promise.all([fetchMachines(), fetchBatches(), fetchTools(), fetchThicknesses(), fetchTimeRecords()]);
      setMachines(m.sort((a,b) => a.id.localeCompare(b.id, undefined, {numeric: true})));
      setBatches(b);
      setTools(t);
      setThicknesses(th);
      setRecords(r);
    })();

    // Suscripciones en tiempo real sin debounce para actualización instantánea
    const subs = [
      subscribeToChanges('batches', (p) => {
        if (p.eventType === 'INSERT') setBatches(prev => [...prev, mapDbBatchToApp(p.new)]);
        if (p.eventType === 'UPDATE') setBatches(prev => prev.map(b => b.id === p.new.id ? mapDbBatchToApp(p.new) : b));
        if (p.eventType === 'DELETE') setBatches(prev => prev.filter(b => b.id === p.old.id));
      }),
      subscribeToChanges('time_study', (p) => {
        if (p.eventType === 'INSERT') setRecords(prev => [mapDbRecordToApp(p.new), ...prev].slice(0, 100));
        if (p.eventType === 'DELETE') setRecords(prev => prev.filter(r => r.id !== String(p.old.id)));
      }),
      subscribeToChanges('machines', (p) => {
        if (p.eventType === 'UPDATE') setMachines(prev => prev.map(m => m.id === p.new.id ? mapDbMachineToApp(p.new) : m));
      }),
      subscribeToChanges('tools', (p) => {
        if (p.eventType === 'INSERT') setTools(prev => [...prev, mapDbToolToApp(p.new)]);
        if (p.eventType === 'UPDATE') setTools(prev => prev.map(t => t.id === p.new.id ? mapDbToolToApp(p.new) : t));
        if (p.eventType === 'DELETE') setTools(prev => prev.filter(t => t.id === p.old.id));
      }),
      subscribeToChanges('thicknesses', (p) => {
        if (p.eventType === 'INSERT') setThicknesses(prev => [...prev, mapDbThicknessToApp(p.new)]);
        if (p.eventType === 'UPDATE') setThicknesses(prev => prev.map(t => t.id === p.new.id ? mapDbThicknessToApp(p.new) : t));
        if (p.eventType === 'DELETE') setThicknesses(prev => prev.filter(t => t.id === p.old.id));
      })
    ];

    return () => { subs.forEach(s => s?.unsubscribe()); };
  }, []);

  const handleCaptureTime = async () => {
    if (swMachine === "ROTOLASER" && swParam !== "rotolaser_pincazo" && !swLength) { alert("Ingrese longitud"); return; }
    const value = (swIsRunning && swStartTimeRef.current ? swAccumulatedSecsRef.current + (Date.now() - swStartTimeRef.current) / 1000 : swAccumulatedSecsRef.current) / 60;
    const record: TimeRecord = { id: String(Date.now()), machineId: swMachine, parameter: swParam, value, timestamp: new Date().toISOString(), length: swLength ? Number(swLength) : undefined };
    
    // UI Optimista
    setRecords(prev => [record, ...prev].slice(0, 100));
    setSwIsRunning(false); setSwTime(0); setSwLength(""); swAccumulatedSecsRef.current = 0; swStartTimeRef.current = null;
    
    setStatus("Capturando...");
    try { await saveTimeRecord(record); setStatus("Capturado"); } catch(e) { setStatus("Error"); }
    setTimeout(() => setStatus(""), 2000);
  };

  const machineAverages = useMemo(() => {
    const summary: Record<string, Record<string, { sum: number, count: number }>> = {};
    records.forEach(r => {
      if (!summary[r.machineId]) summary[r.machineId] = {};
      if (!summary[r.machineId][r.parameter]) summary[r.machineId][r.parameter] = { sum: 0, count: 0 };
      summary[r.machineId][r.parameter].sum += r.value;
      summary[r.machineId][r.parameter].count += 1;
    });
    return summary;
  }, [records]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Inter'] relative">
      <header className={`bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-4 md:px-12 py-4 transition-all duration-500 ${isSidebarOpen ? 'md:pl-80' : 'md:pl-24'}`}>
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="w-8 h-8 flex flex-col justify-center gap-1.5 group">
              <div className="w-6 h-1 bg-blue-950 rounded-full group-hover:bg-blue-800 transition-all"></div>
              <div className="w-4 h-1 bg-blue-950 rounded-full group-hover:bg-blue-800 transition-all"></div>
              <div className="w-6 h-1 bg-blue-950 rounded-full group-hover:bg-blue-800 transition-all"></div>
            </button>
            <div>
              <h2 className="text-sm md:text-base font-black text-blue-950 uppercase tracking-tight">{activeTab}</h2>
              <span className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase tracking-widest">{status || 'Instant Real-time Active'}</span>
            </div>
          </div>
          <img src={LOGO_URL} alt="METALLO" className="h-6 md:h-10 opacity-80" />
        </div>
      </header>

      <aside onMouseEnter={() => setIsSidebarOpen(true)} onMouseLeave={() => setIsSidebarOpen(false)} className={`fixed inset-y-0 left-0 z-50 w-72 bg-blue-950 text-white shadow-2xl transition-all duration-500 ease-in-out transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-[calc(100%-16px)]'} flex flex-col`}>
        <div className="p-8 border-b border-blue-900 flex items-center gap-4"><img src={LOGO_URL} alt="METALLO" className="h-10 w-auto brightness-200" /><h1 className={`text-sm font-black uppercase tracking-tighter ${!isSidebarOpen && 'opacity-0'}`}>METALLO</h1></div>
        <nav className="flex-1 py-8 px-4 space-y-2">
          {[{id:'schedule', label:'Producción', icon:<Icons.Schedule/>},{id:'machines', label:'Máquinas', icon:<Icons.Machines/>},{id:'tools', label:'Herramental', icon:<Icons.Tools/>},{id:'thickness', label:'Espesores', icon:<Icons.Thickness/>},{id:'records', label:'Registros', icon:<Icons.Records/>}].map(item => (
            <button key={item.id} onClick={() => { setActiveTab(item.id as TabType); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all ${activeTab === item.id ? 'bg-blue-800 text-white' : 'text-blue-300 hover:bg-blue-900/50'}`}>
              <span className="text-xl">{item.icon}</span><span className={`text-[10px] font-black uppercase tracking-widest ${!isSidebarOpen && 'opacity-0'}`}>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <div className={`fixed bottom-6 right-6 z-[60] bg-blue-950 text-white rounded-[32px] shadow-2xl transition-all duration-500 flex flex-col overflow-hidden ${isSwExpanded ? 'w-[calc(100vw-48px)] max-w-80 p-6 md:p-8' : 'w-16 h-16 md:w-20 md:h-20 items-center justify-center cursor-pointer hover:bg-blue-800'}`} onClick={() => !isSwExpanded && setIsSwExpanded(true)}>
        {!isSwExpanded ? <Icons.Timer /> : (
          <div className="space-y-4">
            <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase tracking-widest text-blue-300">Tiempo Real</span><button onClick={(e) => { e.stopPropagation(); setIsSwExpanded(false); }} className="text-blue-300 p-2">&times;</button></div>
            <div className="text-4xl md:text-5xl font-black text-center tabular-nums py-2">{formatTime(swTime/60)}</div>
            <div className="space-y-2.5">
              <select className="w-full bg-blue-900/50 p-3 rounded-xl text-[10px] font-bold uppercase border border-blue-800 outline-none" value={swMachine} onChange={e => { setSwMachine(e.target.value); if(e.target.value === "ROTOLASER") setSwParam("rotolaser_corte"); }}>
                {machines.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
                <option value="ROTOLASER">ROTOLASER</option>
              </select>
              <select className="w-full bg-blue-900/50 p-3 rounded-xl text-[10px] font-bold uppercase border border-blue-800 outline-none" value={swParam} onChange={e => setSwParam(e.target.value)}>
                {swMachine === "ROTOLASER" ? (<><option value="rotolaser_corte">Giro CORTE</option><option value="rotolaser_radio_chico">Giro RADIO CHICO</option><option value="rotolaser_pincazo">Pincazo</option><option value="rotolaser_vacio">En vacío</option></>) : (<><option value="totalTime">Lote</option><option value="strikeTime">Golpe</option><option value="toolChangeTime">Cambio Herr.</option><option value="setupTime">Setup</option><option value="measurementTime">Medición</option><option value="tramTime">Tramo</option></>)}
              </select>
              {swMachine === "ROTOLASER" && swParam !== "rotolaser_pincazo" && <input type="number" className="w-full bg-blue-900/50 p-3 rounded-xl text-[11px] font-bold border border-blue-800 outline-none text-white" value={swLength} onChange={e => setSwLength(e.target.value)} placeholder="0 mm" />}
            </div>
            <div className="grid grid-cols-1 gap-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <button onClick={() => setSwIsRunning(!swIsRunning)} className={`py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${swIsRunning ? 'bg-red-500' : 'bg-blue-800'}`}>{swIsRunning ? 'Pausar' : 'Iniciar'}</button>
                <button onClick={() => { setSwIsRunning(false); setSwTime(0); setSwLength(""); swAccumulatedSecsRef.current = 0; }} className="bg-blue-900/50 border border-blue-800 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest">Reiniciar</button>
              </div>
              <button onClick={handleCaptureTime} className="bg-green-600 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest">Capturar</button>
            </div>
          </div>
        )}
      </div>

      <main className={`flex-1 p-4 md:p-12 transition-all duration-500 ${isSidebarOpen ? 'md:ml-72' : 'md:ml-12'}`}>
        <div className="max-w-[1600px] mx-auto w-full">
          {activeTab === 'schedule' && (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
                 <h2 className="text-xl md:text-3xl font-black text-blue-950 uppercase tracking-tighter">Producción Instantánea</h2>
                 <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <input type="date" className="bg-white border p-3 rounded-2xl text-[10px] font-black text-blue-950 uppercase outline-none" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
                    <button onClick={() => setIsEditing({ type: 'batch', data: { id: `b-${Date.now()}`, name: '', machineId: machines[0]?.id || 'PL-01', pieces: 10, strikesPerPiece: 4, thickness: 1.5, length: 500, width: 200, deliveryDate: new Date().toISOString().split('T')[0], toolIds: [], useCraneTurn: false, turnQuantity: 0, useCraneRotate: false, rotateQuantity: 0, requiresToolChange: false, trams: 1, toolChanges: 1, totalTime: 0, scheduledDate: selectedDate, notes: '', priority: 'medium', isSimulation: true } })} className="bg-blue-800 text-white px-7 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest">+ Nuevo Lote</button>
                 </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-8">
                {machines.map(m => <MachineProductionCard key={m.id} machine={m} allBatches={batches} selectedDate={selectedDate} onEditBatch={b => setIsEditing({type:'batch', data:b})} onDeleteBatch={id => { setBatches(prev => prev.filter(b => b.id !== id)); deleteBatchFromCloud(id); }} onZoomImage={setZoomedImage} />)}
              </div>
            </div>
          )}
          {activeTab === 'records' && (
            <div className="space-y-8">
              <h2 className="text-xl md:text-3xl font-black text-blue-950 uppercase tracking-tighter">Reporte en Vivo</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Object.entries(machineAverages).map(([mId, params]) => (
                  <div key={mId} className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-xl transition-all">
                    <div className="p-6 bg-blue-950 text-white flex justify-between items-center"><h3 className="text-2xl font-black uppercase tracking-tighter">{mId}</h3><span className="text-[8px] font-black bg-blue-800 px-3 py-1 rounded-full uppercase">En Vivo</span></div>
                    <div className="p-6 flex-1 space-y-4">
                       {Object.entries(params).map(([paramKey, stats]) => (
                         <div key={paramKey} className="flex flex-col border-b border-slate-50 pb-3 last:border-0">
                            <div className="flex justify-between items-center mb-1"><span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">{PARAM_LABELS[paramKey] || paramKey}</span><span className="text-[7px] font-black text-blue-800 bg-blue-50 px-2 py-0.5 rounded">{stats.count}</span></div>
                            <div className="flex justify-between items-baseline"><span className="text-xl font-black text-blue-950 tabular-nums">{formatTime(stats.sum / stats.count)}</span><span className="text-[8px] font-bold text-slate-300 uppercase">HH:MM:SS</span></div>
                         </div>
                       ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Implementación similar para el resto de las pestañas */}
        </div>
      </main>

      {zoomedImage && <div className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 cursor-pointer" onClick={() => setZoomedImage(null)}><img src={zoomedImage} alt="Zoom" className="max-w-full max-h-[85vh] rounded-[24px] shadow-2xl animate-in zoom-in-95" /></div>}

      {isEditing && (
        <div className="fixed inset-0 z-[100] bg-blue-950/90 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6">
          <div className={`bg-white w-full ${isEditing.type === 'batch' ? 'max-w-4xl' : 'max-w-2xl'} rounded-t-[32px] md:rounded-[48px] shadow-2xl flex flex-col max-h-[96vh] md:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-full`}>
            <div className="px-6 py-6 md:px-10 border-b flex justify-between items-center bg-blue-950 text-white">
               <h3 className="text-lg md:text-2xl font-black uppercase tracking-tight">{isEditing.type === 'batch' ? 'Configurar Lote' : 'Ajustes'}</h3>
               <button onClick={() => setIsEditing(null)} className="w-10 h-10 bg-blue-900 flex items-center justify-center rounded-full text-2xl">&times;</button>
            </div>
            <div className="p-6 md:p-12 overflow-y-auto space-y-8 scrollbar-hide flex-1">
               {isEditing.type === 'batch' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                       <input className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-[20px] font-bold text-base outline-none focus:border-blue-800 transition-all" value={isEditing.data.name} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, name: e.target.value}})} placeholder="Nombre del lote" />
                       <div className="grid grid-cols-2 gap-4">
                         <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-[20px] font-bold text-base" value={isEditing.data.pieces} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, pieces: Number(e.target.value)}})} placeholder="Piezas" />
                         <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-[20px] font-bold text-base" value={isEditing.data.strikesPerPiece} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, strikesPerPiece: Number(e.target.value)}})} placeholder="Golpes" />
                       </div>
                    </div>
                    <div className="space-y-6">
                       <select className="w-full p-4 rounded-[16px] bg-slate-50 border border-slate-200 font-bold" value={isEditing.data.machineId} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, machineId: e.target.value}})}>
                         {machines.map(m => <option key={m.id} value={m.id}>{m.id} - {m.name}</option>)}
                       </select>
                    </div>
                 </div>
               )}
            </div>
            <div className="px-6 py-6 md:px-12 bg-slate-50 border-t flex flex-col md:flex-row gap-4">
               <button onClick={() => setIsEditing(null)} className="flex-1 py-4 text-[10px] font-black uppercase text-slate-400">Cerrar</button>
               <button onClick={async () => {
                   if (isEditing.type === 'batch') {
                     const m = machines.find(x => x.id === isEditing.data.machineId);
                     const updated = {...isEditing.data, totalTime: calculateBatchTime(isEditing.data, m!)};
                     setBatches(prev => prev.some(b => b.id === updated.id) ? prev.map(b => b.id === updated.id ? updated : b) : [...prev, updated]);
                     await saveBatch(updated);
                   }
                   setIsEditing(null);
                 }} className="flex-[2] bg-blue-800 text-white py-4 rounded-[16px] font-black text-[11px] uppercase tracking-[0.2em]">Guardar Instantáneamente</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
