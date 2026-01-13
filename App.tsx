
import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_MACHINES } from './constants';
import { MachineConfig, Batch, Tool, Thickness, TimeRecord } from './types';
import { calculateBatchTime, formatTime, parseTimeToMinutes, getMachineTimelineSlices, BatchSlice } from './utils/helpers';
import { optimizeProductionSchedule } from './services/geminiService';
import { 
  initSupabase, fetchMachines, fetchBatches, fetchTools, fetchThicknesses,
  saveTool, deleteTool, saveThickness, deleteThickness, syncAppData, deleteBatchFromCloud,
  subscribeToChanges, saveTimeRecord, fetchTimeRecords, saveBatch, saveMachine
} from './services/supabaseService';

const LOGO_URL = "https://jcdbepgjoqxtnuarcwku.supabase.co/storage/v1/object/public/IMAGENES/metallo-removebg-preview.png";

type TabType = 'schedule' | 'machines' | 'tools' | 'thickness' | 'records';

// --- COMPONENTES AUXILIARES ---

const MachineProductionCard: React.FC<{ 
  machine: MachineConfig; 
  allBatches: Batch[]; 
  selectedDate: string;
  onEditBatch: (b: Batch) => void; 
  onDeleteBatch: (id: string) => void; 
}> = ({ machine, allBatches, selectedDate, onEditBatch, onDeleteBatch }) => {
  
  // Obtenemos todos los slices (fragmentos diarios) para esta máquina
  const allSlices = getMachineTimelineSlices(machine, allBatches);
  
  // Filtramos solo los slices que ocurren en la fecha seleccionada
  const daySlices = allSlices.filter(s => s.date === selectedDate);

  const totalMinutesInDay = daySlices.reduce((acc, s) => acc + s.timeInDay, 0);
  const capacityMinutes = (machine.productiveHours || 16) * 60;
  const occupancy = Math.min(100, (totalMinutesInDay / capacityMinutes) * 100);

  return (
    <div className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[420px] md:h-[520px] hover:shadow-xl hover:border-blue-800/30 transition-all group">
      <div className="p-5 md:p-7 border-b border-slate-100 bg-slate-50/50">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg md:text-xl font-black text-blue-950 uppercase tracking-tighter">{machine.id}</h3>
          <span className={`text-[8px] md:text-[9px] font-black px-2.5 py-1 rounded-full uppercase ${occupancy > 95 ? 'bg-red-500 text-white' : occupancy > 75 ? 'bg-orange-500 text-white' : 'bg-blue-800 text-white'}`}>
            {occupancy.toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div className="bg-blue-800 h-full transition-all duration-1000" style={{ width: `${occupancy}%` }} />
        </div>
        <div className="flex justify-between mt-3 text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">
          <span>{formatTime(totalMinutesInDay)} OCUPADO</span>
          <span>{machine.productiveHours}HS MÁX</span>
        </div>
      </div>

      <div className="flex-1 p-4 md:p-5 space-y-3.5 overflow-y-auto scrollbar-hide">
        {daySlices.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-40">
             <span className="text-3xl mb-2">🏖️</span>
             <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Día sin carga</div>
          </div>
        ) : (
          daySlices.map((slice, idx) => (
            <div key={`${slice.batch.id}-${idx}`} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-blue-800/20 hover:shadow-md transition-all relative group/item">
              
              <div className="flex justify-between mb-1.5">
                <div className="flex items-center gap-2 truncate pr-2">
                  {slice.batch.isSimulation && (
                    <span className="text-[7px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">Sim</span>
                  )}
                  <span className="text-[11px] font-black text-blue-950 uppercase truncate">{slice.batch.name}</span>
                </div>
                <span className="text-[9px] font-black text-blue-800 whitespace-nowrap">{formatTime(slice.timeInDay)}</span>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex gap-2 text-[8px] font-bold text-slate-400 uppercase tracking-wide">
                  <span>{slice.batch.pieces} Pzs</span>
                  {!slice.batch.isSimulation && (
                    <>
                      <span>•</span>
                      <span>{slice.batch.thickness}mm</span>
                    </>
                  )}
                </div>
                
                {/* INDICADORES DE CONTINUACIÓN */}
                <div className="flex gap-1">
                  {slice.isContinuation && (
                    <span className="text-[7px] font-black bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">Viene de ayer</span>
                  )}
                  {slice.hasMore && (
                    <span className="text-[7px] font-black bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">Sigue mañana</span>
                  )}
                </div>
              </div>

              <div className="mt-3 flex gap-2 opacity-100 md:opacity-0 group-hover/item:opacity-100 transition-all">
                <button onClick={() => onEditBatch(slice.batch)} className="text-[8px] md:text-[9px] font-black text-blue-800 uppercase bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-100/50">Editar Lote</button>
                <button onClick={() => { if(confirm('¿Eliminar lote completo?')) onDeleteBatch(slice.batch.id); }} className="text-[8px] md:text-[9px] font-black text-red-500 uppercase bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-100/50">Borrar</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---

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

  // --- LÓGICA DE CRONÓMETRO ---
  const [swTime, setSwTime] = useState(0); 
  const [swIsRunning, setSwIsRunning] = useState(false);
  const [swMachine, setSwMachine] = useState('PL-01');
  const [swParam, setSwParam] = useState<keyof MachineConfig | 'totalTime'>('strikeTime');
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
        const now = Date.now();
        const deltaSecs = (now - swStartTimeRef.current) / 1000;
        swAccumulatedSecsRef.current += deltaSecs;
        swStartTimeRef.current = null;
      }
      if (swIntervalRef.current) clearInterval(swIntervalRef.current);
    }
    return () => { if (swIntervalRef.current) clearInterval(swIntervalRef.current); };
  }, [swIsRunning]);

  const resetStopwatch = () => {
    setSwIsRunning(false);
    setSwTime(0);
    swAccumulatedSecsRef.current = 0;
    swStartTimeRef.current = null;
    if (swIntervalRef.current) clearInterval(swIntervalRef.current);
  };

  useEffect(() => {
    const SUPABASE_URL = "https://jcdbepgjoqxtnuarcwku.supabase.co"; 
    const SUPABASE_KEY = "sb_publishable_w5tryB0lyl0hCNP3B9AAUg_udm3kUu0"; 
    initSupabase(SUPABASE_URL, SUPABASE_KEY);
    loadData();

    const channels = [
      subscribeToChanges('batches', () => loadData()),
      subscribeToChanges('time_study', () => loadData()),
      subscribeToChanges('machines', () => loadData()),
      subscribeToChanges('tools', () => loadData()),
      subscribeToChanges('thicknesses', () => loadData())
    ];

    return () => { 
      channels.forEach(ch => ch?.unsubscribe());
    };
  }, []);

  const loadData = async () => {
    try {
      const [m, b, t, th, r] = await Promise.all([
        fetchMachines(), fetchBatches(), fetchTools(), fetchThicknesses(), fetchTimeRecords()
      ]);
      const sortedMachines = (m.length ? m : INITIAL_MACHINES).sort((a, b) => 
        a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' })
      );
      setMachines(sortedMachines);
      setBatches(b);
      setTools(t);
      setThicknesses(th);
      setRecords(r);
    } catch (e) {
      console.error("Error cargando datos:", e);
    }
  };

  const handleSaveBatchAction = async (batch: Batch) => {
    const machine = machines.find(m => m.id === batch.machineId);
    if (!machine) return;
    setStatus("Guardando...");
    const time = calculateBatchTime(batch, machine);
    const updatedBatch = { ...batch, totalTime: time };
    await saveBatch(updatedBatch);
    setStatus("Lote Guardado");
    setTimeout(() => setStatus(""), 2000);
    loadData();
  };

  const handleSaveMachineAction = async (machine: MachineConfig) => {
    setStatus("Guardando Configuración...");
    await saveMachine(machine);
    setStatus("Máquina Actualizada");
    setTimeout(() => setStatus(""), 2000);
    loadData();
  };

  const handleCaptureTime = async () => {
    const finalTimeInSeconds = swIsRunning && swStartTimeRef.current 
      ? swAccumulatedSecsRef.current + (Date.now() - swStartTimeRef.current) / 1000
      : swAccumulatedSecsRef.current;
    const value = finalTimeInSeconds / 60; 
    const record: TimeRecord = {
      id: `r-${Date.now()}`,
      machineId: swMachine,
      parameter: swParam,
      value: value,
      timestamp: new Date().toISOString()
    };
    await saveTimeRecord(record);
    resetStopwatch();
    setStatus("Tiempo Capturado");
    setTimeout(() => setStatus(""), 2000);
    loadData();
  };

  const NAV_ITEMS = [
    { id: 'schedule', label: 'Producción', icon: '📋' },
    { id: 'machines', label: 'Máquinas', icon: '⚙️' },
    { id: 'tools', label: 'Herramental', icon: '🔧' },
    { id: 'thickness', label: 'Espesores', icon: '📏' },
    { id: 'records', label: 'Registros', icon: '📊' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Inter'] relative overflow-hidden">
      
      {/* HEADER */}
      <header className={`bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 px-6 md:px-12 py-5 transition-all duration-500 ${isSidebarOpen ? 'md:pl-80' : 'md:pl-24'}`}>
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-10 h-10 flex flex-col justify-center gap-1.5 group"
            >
              <div className="w-7 h-1 bg-blue-950 rounded-full group-hover:bg-blue-800 transition-all"></div>
              <div className="w-5 h-1 bg-blue-950 rounded-full group-hover:bg-blue-800 transition-all"></div>
              <div className="w-7 h-1 bg-blue-950 rounded-full group-hover:bg-blue-800 transition-all"></div>
            </button>
            <div>
              <h2 className="text-base font-black text-blue-950 uppercase tracking-tight">
                {NAV_ITEMS.find(n => n.id === activeTab)?.label}
              </h2>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none">{status || 'Monitor de Planta Activo'}</span>
            </div>
          </div>
          <img src={LOGO_URL} alt="METALLO" className="h-8 md:h-10 opacity-80" />
        </div>
      </header>

      {/* SIDEBAR */}
      <aside 
        onMouseEnter={() => setIsSidebarOpen(true)}
        onMouseLeave={() => setIsSidebarOpen(false)}
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-blue-950 text-white shadow-2xl transition-all duration-500 ease-in-out transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-[calc(100%-16px)]'} flex flex-col`}
      >
        <div className="p-8 border-b border-blue-900 flex items-center gap-4">
          <img src={LOGO_URL} alt="METALLO" className="h-10 w-auto brightness-200" />
          <h1 className={`text-sm font-black tracking-tighter uppercase leading-none transition-opacity ${!isSidebarOpen && 'opacity-0'}`}>METALLO</h1>
        </div>

        <nav className="flex-1 py-8 px-4 space-y-2">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id as TabType); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all group ${activeTab === item.id ? 'bg-blue-800 text-white' : 'text-blue-300 hover:bg-blue-900/50'}`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className={`text-[10px] font-black uppercase tracking-widest transition-all ${!isSidebarOpen && 'opacity-0 translate-x-4'}`}>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* STOPWATCH FLOTANTE */}
      <div className={`fixed bottom-8 right-8 z-[60] bg-blue-950 text-white rounded-[32px] shadow-2xl transition-all duration-500 flex flex-col overflow-hidden ${isSwExpanded ? 'w-80 p-8' : 'w-20 h-20 items-center justify-center cursor-pointer hover:bg-blue-800'}`} onClick={() => !isSwExpanded && setIsSwExpanded(true)}>
        {!isSwExpanded ? (
          <span className="text-2xl">⏱️</span>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">Captura de Tiempos</span>
              <button onClick={(e) => { e.stopPropagation(); setIsSwExpanded(false); }} className="text-blue-300 hover:text-white">&times;</button>
            </div>
            
            <div className="text-5xl font-black text-center tabular-nums py-2 text-white">{formatTime(swTime/60)}</div>
            
            <div className="space-y-3">
              <select className="w-full bg-blue-900/50 p-3 rounded-xl text-[10px] font-bold uppercase border border-blue-800" value={swMachine} onChange={e => setSwMachine(e.target.value)}>
                {machines.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
              </select>
              <select className="w-full bg-blue-900/50 p-3 rounded-xl text-[10px] font-bold uppercase border border-blue-800" value={swParam} onChange={e => setSwParam(e.target.value as any)}>
                <option value="totalTime">Tiempo de Lote</option>
                <option value="strikeTime">Tiempo de Golpe</option>
                <option value="toolChangeTime">Cambio Herramental</option>
                <option value="setupTime">Setup Inicial</option>
                <option value="measurementTime">Medición / Pz</option>
                <option value="tramTime">Tiempo de Tramo</option>
                <option value="craneTurnTime">Grúa Volteo</option>
                <option value="craneRotateTime">Grúa Giro</option>
                <option value="manualTurnTime">Volteo Manual</option>
                <option value="manualRotateTime">Giro Manual</option>
              </select>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setSwIsRunning(!swIsRunning)}
                  className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${swIsRunning ? 'bg-red-500' : 'bg-blue-800 hover:bg-blue-700'}`}
                >
                  {swIsRunning ? 'Pausar' : 'Iniciar'}
                </button>
                <button 
                  onClick={resetStopwatch}
                  className="bg-blue-900/50 border border-blue-800 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-800 transition-colors"
                >
                  Reiniciar
                </button>
              </div>
              <button 
                onClick={handleCaptureTime}
                className="bg-green-600 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-green-500 transition-colors"
              >
                Capturar
              </button>
            </div>
          </div>
        )}
      </div>

      <main className={`flex-1 p-6 md:p-12 transition-all duration-500 ${isSidebarOpen ? 'md:ml-72' : 'md:ml-12'}`}>
        <div className="max-w-[1600px] mx-auto w-full">
          {activeTab === 'schedule' && (
            <div className="space-y-10">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                 <div>
                    <h2 className="text-2xl md:text-3xl font-black text-blue-950 uppercase tracking-tighter">Panel de Producción</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Capacidad diaria optimizada por segmentación automática</p>
                 </div>
                 <div className="flex flex-wrap items-center w-full md:w-auto gap-4">
                   
                   {/* CALENDARIO DE FILTRO AL LADO DEL BOTÓN */}
                   <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm group">
                      <span className="text-[9px] font-black text-blue-900 uppercase ml-2">Día de Vista:</span>
                      <input 
                        type="date" 
                        className="bg-slate-50 border-none p-1.5 rounded-lg text-[11px] font-black text-blue-950 uppercase outline-none focus:bg-blue-50 transition-colors"
                        value={selectedDate}
                        onChange={e => setSelectedDate(e.target.value)}
                      />
                   </div>

                   <button 
                     onClick={() => setIsEditing({ 
                       type: 'batch', 
                       data: { 
                         id: `b-${Date.now()}`, 
                         name: '', 
                         machineId: machines[0]?.id || 'PL-01', 
                         pieces: 10, 
                         strikesPerPiece: 4, 
                         thickness: 1.5, 
                         length: 500, 
                         width: 200, 
                         deliveryDate: new Date().toISOString().split('T')[0], 
                         toolIds: [], 
                         useCraneTurn: false, 
                         turnQuantity: 0, 
                         useCraneRotate: false, 
                         rotateQuantity: 0, 
                         requiresToolChange: false, 
                         trams: 1,
                         toolChanges: 1,
                         totalTime: 0, 
                         scheduledDate: selectedDate, // Por defecto a la fecha seleccionada
                         notes: '', 
                         priority: 'medium',
                         isSimulation: true
                       } 
                     })} 
                     className="bg-blue-800 text-white px-7 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all hover:bg-blue-900"
                   >
                     + Nuevo Lote
                   </button>
                   
                   <button onClick={async () => {
                     setStatus("IA Analizando...");
                     const result = await optimizeProductionSchedule(batches, machines, tools, thicknesses);
                     if (result) {
                       const updated = batches.map(b => {
                         const suggestion = result.plan?.find((p: any) => p.batch_id === b.id);
                         if (suggestion) return { ...b, machineId: suggestion.machine_id, scheduledDate: suggestion.scheduled_date };
                         return b;
                       });
                       await syncAppData(machines, updated);
                       setStatus("Programación IA Lista");
                       loadData();
                     } else setStatus("IA: Error");
                     setTimeout(() => setStatus(""), 4000);
                   }} className="bg-blue-950 text-white px-7 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all hover:bg-blue-900">IA Optimizar</button>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                {machines.map(m => (
                  <MachineProductionCard 
                    key={m.id} 
                    machine={m} 
                    allBatches={batches} 
                    selectedDate={selectedDate}
                    onEditBatch={(b: Batch) => setIsEditing({ type: 'batch', data: b })} 
                    onDeleteBatch={(id: string) => deleteBatchFromCloud(id).then(loadData)} 
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'machines' && (
            <div className="space-y-10">
              <h2 className="text-2xl md:text-3xl font-black text-blue-950 uppercase tracking-tighter">Gestión de Máquinas</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {machines.map(m => (
                  <div key={m.id} className="bg-white p-10 rounded-[48px] border border-slate-200 shadow-sm hover:shadow-2xl transition-all group">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h3 className="text-3xl font-black text-blue-950 uppercase tracking-tighter">{m.id}</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{m.name}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Carga Total</span>
                        <span className="text-sm font-black text-blue-950">{batches.filter(b => b.machineId === m.id).length} Lotes</span>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-[8px] font-black text-slate-400 uppercase block mb-1">Eficiencia</span>
                        <span className="text-sm font-black text-blue-800">{m.efficiency}%</span>
                      </div>
                    </div>
                    <button onClick={() => setIsEditing({ type: 'machine', data: m })} className="w-full py-5 bg-blue-950 text-white rounded-[24px] text-[11px] font-black uppercase tracking-[0.2em] shadow-lg group-hover:bg-blue-800 transition-all active:scale-95">Parámetros Técnicos</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* MODAL SYSTEM */}
      {isEditing && (
        <div className="fixed inset-0 z-[100] bg-blue-950/90 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-6">
          <div className={`bg-white w-full ${isEditing.type === 'machine' || isEditing.type === 'batch' ? 'max-w-6xl' : 'max-w-4xl'} rounded-t-[48px] md:rounded-[56px] shadow-2xl flex flex-col max-h-[96vh] overflow-hidden animate-in slide-in-from-bottom-full duration-500`}>
            
            <div className="px-10 py-10 border-b flex justify-between items-center bg-blue-950 text-white">
               <h3 className="text-2xl font-black uppercase tracking-tight">
                 {isEditing.type === 'batch' ? 'Configurar Lote' : 
                  isEditing.type === 'machine' ? `Ajustes: ${isEditing.data.id}` :
                  isEditing.type === 'tool' ? 'Herramienta' : 'Espesor'}
               </h3>
               <button onClick={() => setIsEditing(null)} className="w-14 h-14 flex items-center justify-center rounded-full bg-blue-900 text-3xl hover:bg-red-500 transition-all shadow-lg shadow-black/20">&times;</button>
            </div>
            
            <div className="p-10 md:p-14 overflow-y-auto space-y-12 scrollbar-hide">
               {isEditing.type === 'batch' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    {/* COLUMNA IZQUIERDA: PRODUCTO Y HERRAMENTAL */}
                    <div className="space-y-8">
                       <div className="group">
                         <label className="text-[11px] font-black uppercase text-slate-400 mb-2.5 block tracking-widest">Identificador de Pieza</label>
                         <input className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-[28px] font-bold text-xl outline-none focus:border-blue-800 transition-all text-blue-950" value={isEditing.data.name} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, name: e.target.value}})} placeholder="Ej: Soporte Frontal X1" />
                       </div>

                       {/* SELECTOR DE FECHA PARA PROGRAMACIÓN */}
                       <div className="group">
                         <label className="text-[11px] font-black uppercase text-slate-400 mb-2.5 block tracking-widest">Fecha Programada para Producción</label>
                         <input type="date" className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-[28px] font-bold text-xl outline-none focus:border-blue-800 transition-all text-blue-950" value={isEditing.data.scheduledDate} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, scheduledDate: e.target.value}})} />
                       </div>
                       
                       <div className="grid grid-cols-2 gap-6">
                         <div>
                           <label className="text-[11px] font-black uppercase text-slate-400 mb-2.5 block tracking-widest">Piezas</label>
                           <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-[28px] font-bold text-xl outline-none text-blue-950" value={isEditing.data.pieces} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, pieces: Number(e.target.value)}})} />
                         </div>
                         <div>
                           <label className="text-[11px] font-black uppercase text-slate-400 mb-2.5 block tracking-widest">Golpes/Pz</label>
                           <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-[28px] font-bold text-xl outline-none text-blue-950" value={isEditing.data.strikesPerPiece} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, strikesPerPiece: Number(e.target.value)}})} />
                         </div>
                       </div>

                       <div className="p-8 bg-blue-50/50 rounded-[32px] border-2 border-blue-100 space-y-6 transition-all">
                          <div className="flex items-center justify-between">
                             <div>
                                <h4 className="text-[11px] font-black text-blue-900 uppercase">Cambio de Herramental</h4>
                                <p className="text-[8px] font-bold text-blue-700/60 uppercase">Adiciona tiempo de setup y tramos</p>
                             </div>
                             <input type="checkbox" className="w-8 h-8 rounded-xl accent-blue-800" checked={isEditing.data.requiresToolChange} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, requiresToolChange: e.target.checked}})} />
                          </div>
                          
                          {isEditing.data.requiresToolChange && (
                             <div className="grid grid-cols-2 gap-6 pt-4 border-t border-blue-100 animate-in fade-in slide-in-from-top-4">
                                <div>
                                   <label className="text-[10px] font-black text-blue-400 uppercase block mb-2">Cantidad Cambios</label>
                                   <input type="number" className="w-full p-4 bg-white border border-blue-200 rounded-2xl font-bold" value={isEditing.data.toolChanges} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, toolChanges: Number(e.target.value)}})} />
                                </div>
                                <div>
                                   <label className="text-[10px] font-black text-blue-400 uppercase block mb-2">Tramos / Cambio</label>
                                   <input type="number" className="w-full p-4 bg-white border border-blue-200 rounded-2xl font-bold" value={isEditing.data.trams} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, trams: Number(e.target.value)}})} />
                                </div>
                             </div>
                          )}
                       </div>

                       {!isEditing.data.isSimulation && (
                         <div className="grid grid-cols-2 gap-6 animate-in fade-in">
                            <div>
                              <label className="text-[11px] font-black uppercase text-slate-400 mb-2.5 block tracking-widest">Espesor (mm)</label>
                              <input type="number" step="0.1" className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-[28px] font-bold text-xl outline-none text-blue-950" value={isEditing.data.thickness} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, thickness: Number(e.target.value)}})} />
                            </div>
                            <div>
                              <label className="text-[11px] font-black uppercase text-slate-400 mb-2.5 block tracking-widest">Largo (mm)</label>
                              <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-[28px] font-bold text-xl outline-none text-blue-950" value={isEditing.data.length} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, length: Number(e.target.value)}})} />
                            </div>
                         </div>
                       )}
                    </div>

                    {/* COLUMNA DERECHA: LOGÍSTICA REDISEÑADA */}
                    <div className="bg-slate-50 p-10 rounded-[48px] border border-slate-200 space-y-8">
                       <h4 className="text-[11px] font-black text-blue-950 uppercase tracking-widest">Configuración Logística</h4>
                       
                       <div className="space-y-6">
                         {/* BLOQUE VOLTEO */}
                         <div className={`p-6 bg-white rounded-[32px] border-2 transition-all ${isEditing.data.turnQuantity > 0 ? 'border-blue-800' : 'border-slate-100'}`}>
                            <div className="flex items-center justify-between">
                               <div className="flex items-center gap-4">
                                  <input type="checkbox" className="w-6 h-6 rounded accent-blue-800" checked={isEditing.data.turnQuantity > 0} onChange={e => {
                                    setIsEditing({...isEditing, data: {...isEditing.data, turnQuantity: e.target.checked ? 1 : 0}});
                                  }} />
                                  <span className="text-[11px] font-black text-slate-700 uppercase">Volteo</span>
                               </div>
                            </div>
                            
                            {isEditing.data.turnQuantity > 0 && (
                               <div className="animate-in fade-in slide-in-from-top-2 space-y-4 pt-6 mt-4 border-t border-slate-50">
                                  <div className="flex items-center gap-4">
                                     <span className="text-[9px] font-bold text-slate-400 uppercase">Cantidad:</span>
                                     <input type="number" className="flex-1 p-3 bg-slate-50 border rounded-xl font-bold text-blue-950 focus:border-blue-800 outline-none" value={isEditing.data.turnQuantity} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, turnQuantity: Math.max(1, Number(e.target.value))}})} />
                                  </div>
                                  <div className="flex items-center gap-4 pt-2">
                                     <input type="checkbox" className="w-5 h-5 rounded accent-blue-800" checked={isEditing.data.useCraneTurn} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, useCraneTurn: e.target.checked}})} />
                                     <span className="text-[9px] font-black text-blue-800 uppercase tracking-widest">Puente de Grúa</span>
                                  </div>
                               </div>
                            )}
                         </div>

                         {/* BLOQUE GIRO */}
                         <div className={`p-6 bg-white rounded-[32px] border-2 transition-all ${isEditing.data.rotateQuantity > 0 ? 'border-blue-800' : 'border-slate-100'}`}>
                            <div className="flex items-center justify-between">
                               <div className="flex items-center gap-4">
                                  <input type="checkbox" className="w-6 h-6 rounded accent-blue-800" checked={isEditing.data.rotateQuantity > 0} onChange={e => {
                                    setIsEditing({...isEditing, data: {...isEditing.data, rotateQuantity: e.target.checked ? 1 : 0}});
                                  }} />
                                  <span className="text-[11px] font-black text-slate-700 uppercase">Giro</span>
                               </div>
                            </div>
                            
                            {isEditing.data.rotateQuantity > 0 && (
                               <div className="animate-in fade-in slide-in-from-top-2 space-y-4 pt-6 mt-4 border-t border-slate-50">
                                  <div className="flex items-center gap-4">
                                     <span className="text-[9px] font-bold text-slate-400 uppercase">Cantidad:</span>
                                     <input type="number" className="flex-1 p-3 bg-slate-50 border rounded-xl font-bold text-blue-950 focus:border-blue-800 outline-none" value={isEditing.data.rotateQuantity} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, rotateQuantity: Math.max(1, Number(e.target.value))}})} />
                                  </div>
                                  <div className="flex items-center gap-4 pt-2">
                                     <input type="checkbox" className="w-5 h-5 rounded accent-blue-800" checked={isEditing.data.useCraneRotate} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, useCraneRotate: e.target.checked}})} />
                                     <span className="text-[9px] font-black text-blue-800 uppercase tracking-widest">Puente de Grúa</span>
                                  </div>
                               </div>
                            )}
                         </div>
                       </div>

                       <div className="pt-8 border-t border-slate-200">
                         <label className="text-[11px] font-black text-slate-400 uppercase block mb-3">Máquina Asignada</label>
                         <select className="w-full p-5 rounded-2xl bg-white border border-slate-200 font-bold text-blue-950" value={isEditing.data.machineId} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, machineId: e.target.value}})}>
                           {machines.map(m => <option key={m.id} value={m.id}>{m.id} - {m.name}</option>)}
                         </select>
                       </div>
                    </div>
                 </div>
               )}
            </div>

            <div className="px-12 py-12 bg-slate-50 border-t border-slate-200 flex flex-col md:flex-row gap-6">
               <button onClick={() => setIsEditing(null)} className="order-2 md:order-1 flex-1 py-6 text-[11px] font-black uppercase text-slate-400 tracking-[0.3em]">Cerrar</button>
               <button 
                 onClick={async () => {
                   if (isEditing.type === 'batch') await handleSaveBatchAction(isEditing.data);
                   else if (isEditing.type === 'machine') await handleSaveMachineAction(isEditing.data);
                   else if (isEditing.type === 'tool') await saveTool(isEditing.data);
                   else if (isEditing.type === 'thickness') await saveThickness(isEditing.data);
                   setIsEditing(null);
                   loadData();
                 }} 
                 className="order-1 md:order-2 flex-[2] bg-blue-800 text-white py-6 rounded-[32px] font-black text-[13px] uppercase tracking-[0.3em] shadow-2xl shadow-blue-900/40 hover:bg-blue-900 transition-all"
               >
                 Guardar Cambios
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
