
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { INITIAL_MACHINES } from './constants';
import { MachineConfig, Batch, Tool, Thickness, TimeRecord } from './types';
import { calculateBatchTime, formatTime } from './utils/helpers';
import { optimizeProductionSchedule } from './services/geminiService';
import { 
  initSupabase, fetchMachines, fetchBatches, fetchTools, fetchThicknesses,
  saveTool, deleteTool, saveThickness, deleteThickness, syncAppData, deleteBatchFromCloud,
  subscribeToChanges, saveTimeRecord, fetchTimeRecords
} from './services/supabaseService';

const LOGO_URL = "https://jcdbepgjoqxtnuarcwku.supabase.co/storage/v1/object/public/IMAGENES/metallo-removebg-preview.png";

type TabType = 'schedule' | 'machines' | 'tools' | 'thickness' | 'records';

// --- COMPONENTES AUXILIARES ---

const MachineProductionCard: React.FC<{ 
  machine: MachineConfig; 
  batches: Batch[]; 
  onEditBatch: (b: Batch) => void; 
  onDeleteBatch: (id: string) => void; 
}> = ({ machine, batches, onEditBatch, onDeleteBatch }) => {
  const machineBatches = batches
    .filter(b => b.machineId === machine.id)
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

  const totalMinutes = machineBatches.reduce((acc, b) => acc + (b.totalTime || 0), 0);
  const capacityMinutes = (machine.productiveHours || 16) * 60;
  const occupancy = Math.min(100, (totalMinutes / capacityMinutes) * 100);

  return (
    <div className="bg-white rounded-[24px] md:rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[400px] md:h-[500px] hover:shadow-xl hover:border-blue-200 transition-all group">
      <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50">
        <div className="flex justify-between items-start mb-2 md:mb-3">
          <h3 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tighter">{machine.id}</h3>
          <span className={`text-[8px] md:text-[9px] font-black px-2 py-1 rounded-full uppercase ${occupancy > 90 ? 'bg-red-500 text-white' : occupancy > 70 ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'}`}>
            {occupancy.toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
          <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${occupancy}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">
          <span>{formatTime(totalMinutes)}</span>
          <span>{machine.productiveHours}HS Capacidad</span>
        </div>
      </div>

      <div className="flex-1 p-3 md:p-4 space-y-3 overflow-y-auto scrollbar-hide">
        {machineBatches.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Sin carga</div>
        ) : (
          machineBatches.map(batch => (
            <div key={batch.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl md:rounded-2xl hover:bg-white hover:border-blue-200 hover:shadow-md transition-all relative group/item">
              <div className="flex justify-between mb-1">
                <span className="text-[10px] font-black text-slate-900 uppercase truncate max-w-[120px]">{batch.name}</span>
                <span className="text-[9px] font-black text-blue-600">{formatTime(batch.totalTime)}</span>
              </div>
              <div className="flex gap-2 text-[8px] font-bold text-slate-400 uppercase">
                <span>{batch.pieces} Pzs • {batch.thickness}mm</span>
              </div>
              <div className="mt-2 flex gap-2 opacity-100 md:opacity-0 group-hover/item:opacity-100 transition-all">
                <button onClick={() => onEditBatch(batch)} className="text-[8px] md:text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-1 rounded-lg">Editar</button>
                <button onClick={() => { if(confirm('¿Eliminar lote?')) onDeleteBatch(batch.id); }} className="text-[8px] md:text-[9px] font-black text-red-500 uppercase bg-red-50 px-2 py-1 rounded-lg">Borrar</button>
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
  const [machines, setMachines] = useState<MachineConfig[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [thicknesses, setThicknesses] = useState<Thickness[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [status, setStatus] = useState("");
  const [isEditing, setIsEditing] = useState<{ type: string, data: any } | null>(null);

  // Cronómetro Global
  const [swTime, setSwTime] = useState(0);
  const [swIsRunning, setSwIsRunning] = useState(false);
  const [swMachine, setSwMachine] = useState('');
  const [swParam, setSwParam] = useState<keyof MachineConfig>('strikeTime');
  const swIntervalRef = useRef<any>(null);

  useEffect(() => {
    const SUPABASE_URL = "https://jcdbepgjoqxtnuarcwku.supabase.co"; 
    const SUPABASE_KEY = "sb_publishable_w5tryB0lyl0hCNP3B9AAUg_udm3kUu0"; 
    initSupabase(SUPABASE_URL, SUPABASE_KEY);
    loadData();

    subscribeToChanges('batches', () => loadData());
    // Se cambia 'time_records' por 'time_study' para suscripción en tiempo real
    subscribeToChanges('time_study', () => loadData());
    subscribeToChanges('machines', () => loadData());

    return () => { if (swIntervalRef.current) clearInterval(swIntervalRef.current); };
  }, []);

  useEffect(() => {
    if (swIsRunning) {
      swIntervalRef.current = setInterval(() => setSwTime(t => t + 1), 1000);
    } else {
      if (swIntervalRef.current) clearInterval(swIntervalRef.current);
    }
    return () => { if (swIntervalRef.current) clearInterval(swIntervalRef.current); };
  }, [swIsRunning]);

  const loadData = async () => {
    try {
      const [m, b, t, th, r] = await Promise.all([
        fetchMachines(), fetchBatches(), fetchTools(), fetchThicknesses(), fetchTimeRecords()
      ]);
      setMachines(m.length ? m : INITIAL_MACHINES);
      setBatches(b);
      setTools(t);
      setThicknesses(th);
      setRecords(r);
    } catch (e) {
      console.error("Error cargando datos:", e);
    }
  };

  const groupedRecords = useMemo(() => {
    const groups: Record<string, Record<string, { records: TimeRecord[], average: number }>> = {};
    records.forEach(r => {
      if (!groups[r.machineId]) groups[r.machineId] = {};
      if (!groups[r.machineId][r.parameter]) {
        groups[r.machineId][r.parameter] = { records: [], average: 0 };
      }
      groups[r.machineId][r.parameter].records.push(r);
    });
    Object.keys(groups).forEach(mId => {
      Object.keys(groups[mId]).forEach(pId => {
        const items = groups[mId][pId].records;
        const sum = items.reduce((acc, curr) => acc + curr.value, 0);
        groups[mId][pId].average = sum / items.length;
      });
    });
    return groups;
  }, [records]);

  const handleSaveTimeRecord = async () => {
    if (!swMachine || swTime === 0) {
      alert("Selecciona una máquina antes de guardar");
      return;
    }
    setStatus("Guardando estudio...");
    const record: TimeRecord = { 
      id: `tr-${Date.now()}`, 
      machineId: swMachine, 
      parameter: swParam, 
      value: swTime / 60, 
      timestamp: new Date().toISOString() 
    };
    await saveTimeRecord(record);
    setSwIsRunning(false);
    setSwTime(0);
    setStatus("Estudio sincronizado");
    setTimeout(() => setStatus(""), 3000);
    loadData();
  };

  const handleSync = async () => {
    setStatus("Sincronizando...");
    await syncAppData(machines, batches);
    loadData();
    setStatus("OK");
    setTimeout(() => setStatus(""), 2000);
  };

  const runIA = async () => {
    setStatus("IA Analizando...");
    const result = await optimizeProductionSchedule(batches, machines, tools, thicknesses);
    if (result) {
      const updated = batches.map(b => {
        const suggestion = result.plan?.find((p: any) => p.batch_id === b.id);
        if (suggestion) return { ...b, machineId: suggestion.machine_id, scheduledDate: suggestion.scheduled_date };
        return b;
      });
      setBatches(updated);
      await syncAppData(machines, updated);
      setStatus("IA: Programación Lista");
      loadData();
    } else {
      setStatus("IA: Error");
    }
    setTimeout(() => setStatus(""), 5000);
  };

  const handleSaveBatch = async (batch: Batch) => {
    const machine = machines.find(m => m.id === batch.machineId);
    if (!machine) return;
    const time = calculateBatchTime(batch, machine);
    const updatedBatch = { ...batch, totalTime: time };
    await syncAppData(machines, [...batches.filter(b => b.id !== updatedBatch.id), updatedBatch]);
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
      
      {/* TRIGGER SUPERIOR (HOVER EMERGENCE) */}
      <div 
        onMouseEnter={() => setIsSidebarOpen(true)}
        className="fixed top-0 left-0 right-0 h-4 z-50 cursor-pointer group flex items-center justify-center"
      >
        <div className="w-24 h-1.5 bg-slate-200 group-hover:bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300"></div>
      </div>

      {/* MENÚ LATERAL (SIDEBAR) */}
      <aside 
        onMouseLeave={() => setIsSidebarOpen(false)}
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white shadow-2xl transition-all duration-500 ease-in-out transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-[calc(100%-12px)]'} flex flex-col`}
      >
        <div className="p-8 border-b border-slate-800 flex items-center gap-4">
          <img src={LOGO_URL} alt="METALLO" className="h-10 w-auto brightness-200" />
          <div className={`${!isSidebarOpen && 'opacity-0'} transition-opacity duration-300`}>
             <h1 className="text-sm font-black tracking-tighter uppercase leading-none">METALLO</h1>
             <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Planta CNC</span>
          </div>
        </div>

        <nav className="flex-1 py-8 px-4 space-y-2">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id as TabType); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all group ${activeTab === item.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className={`text-[10px] font-black uppercase tracking-widest transition-all ${!isSidebarOpen && 'opacity-0 translate-x-4'}`}>{item.label}</span>
              {activeTab === item.id && isSidebarOpen && <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full"></div>}
            </button>
          ))}
        </nav>

        <div className="p-8 border-t border-slate-800">
           <div className={`flex flex-col gap-2 ${!isSidebarOpen && 'opacity-0'} transition-opacity duration-300`}>
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Sistema</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="text-[10px] font-bold text-slate-300 uppercase">Cloud Online</span>
              </div>
           </div>
        </div>

        {/* HANDLE DE EXPANSIÓN */}
        <div className="absolute top-1/2 -right-3 w-6 h-24 bg-slate-900 rounded-r-full flex items-center justify-center cursor-pointer shadow-xl border-y border-r border-slate-800">
           <div className="w-1 h-8 bg-slate-700 rounded-full"></div>
        </div>
      </aside>

      {/* HEADER DE ESTATUS */}
      <header className={`bg-white border-b border-slate-200 sticky top-0 z-40 px-4 md:px-8 py-4 transition-all duration-500 ${isSidebarOpen ? 'pl-80' : 'pl-16'}`}>
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="w-10 h-10 flex flex-col justify-center gap-1.5 group"
            >
              <div className="w-6 h-1 bg-slate-900 rounded-full group-hover:bg-blue-600 transition-colors"></div>
              <div className="w-4 h-1 bg-slate-900 rounded-full group-hover:bg-blue-600 transition-colors"></div>
              <div className="w-6 h-1 bg-slate-900 rounded-full group-hover:bg-blue-600 transition-colors"></div>
            </button>
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-tighter">
                {NAV_ITEMS.find(n => n.id === activeTab)?.label}
              </h2>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">{status || 'Operativo'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <button onClick={handleSync} className="hidden md:flex bg-slate-50 text-slate-900 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase border border-slate-200 hover:bg-slate-100 active:scale-95 transition-all">Sincronizar Datos</button>
             <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 text-xs">AD</div>
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className={`flex-1 p-4 md:p-8 max-w-[1600px] mx-auto w-full transition-all duration-500 ${isSidebarOpen ? 'md:ml-72' : 'md:ml-12'}`}>
        {activeTab === 'schedule' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
               <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter">Carga de Producción</h2>
               <div className="flex w-full md:w-auto gap-2">
                 <button onClick={() => setIsEditing({ type: 'batch', data: { id: `b-${Date.now()}`, name: '', machineId: machines[0]?.id || 'PL-01', pieces: 10, strikesPerPiece: 4, thickness: 1.5, length: 500, width: 200, deliveryDate: new Date().toISOString().split('T')[0], toolIds: [], useCraneTurn: false, turnQuantity: 1, useCraneRotate: false, rotateQuantity: 1, requiresToolChange: true, totalTime: 0, scheduledDate: new Date().toISOString().split('T')[0], notes: '', priority: 'medium', trams: 1, toolChanges: 1 } })} className="flex-1 md:flex-none bg-blue-600 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-500/20 active:scale-95 transition-all">+ Lote</button>
                 <button onClick={runIA} className="flex-1 md:flex-none bg-slate-900 text-white px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all">Optimizar IA</button>
               </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
              {machines.map(m => (
                <MachineProductionCard key={m.id} machine={m} batches={batches} onEditBatch={(b: Batch) => setIsEditing({ type: 'batch', data: b })} onDeleteBatch={(id: string) => deleteBatchFromCloud(id).then(loadData)} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'records' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter leading-none">Historial de Tiempos Reales</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Sincronizado con tabla 'time_study'</p>
              </div>
              <button onClick={loadData} className="p-3 bg-white border border-slate-200 rounded-full shadow-sm hover:rotate-180 transition-all duration-500">🔄</button>
            </div>

            <div className="space-y-8">
              {Object.keys(groupedRecords).length > 0 ? Object.entries(groupedRecords).map(([machineId, params]) => (
                <div key={machineId} className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                  <div className="bg-slate-900 p-6 flex justify-between items-center">
                    <h3 className="text-white font-black text-lg uppercase tracking-widest">{machineId}</h3>
                    <div className="flex gap-4">
                       <span className="text-[9px] font-black text-slate-400 uppercase">{Object.keys(params).length} PROCESOS MEDIDOS</span>
                    </div>
                  </div>
                  
                  <div className="p-4 md:p-8 space-y-12">
                    {Object.entries(params).map(([paramName, data]) => (
                      <div key={paramName} className="space-y-6">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-1.5 h-8 bg-blue-600 rounded-full"></div>
                            <h4 className="font-black text-slate-800 uppercase tracking-tight text-sm">
                              {paramName === 'strikeTime' ? 'Ciclo de Golpe' : 
                               paramName === 'setupTime' ? 'Preparación / Setup' : 
                               paramName === 'measurementTime' ? 'Medición' :
                               paramName === 'craneTurnTime' ? 'Volteo con Grúa' :
                               paramName === 'craneRotateTime' ? 'Giro con Grúa' : paramName}
                            </h4>
                          </div>
                          <div className="bg-blue-50 px-6 py-2 rounded-2xl border border-blue-100 flex items-center gap-3">
                            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">Promedio Real:</span>
                            <span className="text-lg font-black text-blue-700 font-mono">{data.average.toFixed(4)} <span className="text-[10px]">MIN</span></span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                          {data.records.map(record => (
                            <div key={record.id} className="p-4 bg-slate-50 rounded-[20px] border border-slate-100 hover:bg-white hover:border-blue-300 hover:shadow-md transition-all group">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[12px] font-black text-slate-900 font-mono tracking-tighter">
                                  {record.value.toFixed(4)} MIN
                                </span>
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase ${record.value > data.average ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                  {record.value > data.average ? '↑ Desv' : '↓ Efic'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-4">
                                <span>{new Date(record.timestamp).toLocaleDateString()}</span>
                                <span>{new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )) : (
                <div className="py-32 text-center bg-white rounded-[32px] border-2 border-dashed border-slate-200">
                   <div className="text-4xl mb-4 opacity-20">📊</div>
                   <p className="text-[10px] font-black text-slate-300 uppercase italic tracking-widest">No hay mediciones en la base de datos (Tabla 'time_study')</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* OTROS TABS (VISTAS SIMPLIFICADAS) */}
        {activeTab === 'machines' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter">Parámetros de Planta</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {machines.map(m => (
                <div key={m.id} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm hover:shadow-xl transition-all">
                  <div className="flex justify-between items-start mb-6">
                    <h3 className="text-2xl font-black text-slate-900 uppercase">{m.id}</h3>
                    <span className="bg-emerald-100 text-emerald-600 text-[10px] font-black px-3 py-1 rounded-full uppercase">Activa</span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-400 mb-8 uppercase tracking-widest">{m.name}</p>
                  <button onClick={() => setIsEditing({ type: 'machine', data: m })} className="w-full py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Configurar Variables</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center">
                <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter">Inventario de Herramental</h2>
                <button onClick={() => setIsEditing({ type: 'tool', data: { id: `T-${Date.now()}`, name: '', type: 'punch', angle: 88, maxTons: 100, length: 835, compatibleMachineIds: [] }})} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">+ Nuevo</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {tools.map(t => (
                  <div key={t.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col hover:border-blue-300 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <span className={`text-[8px] px-2.5 py-1 rounded-full font-black uppercase ${t.type === 'punch' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>{t.type === 'punch' ? 'Punzon' : 'Matriz'}</span>
                      <div className="flex gap-2">
                        <button onClick={() => setIsEditing({ type: 'tool', data: t })} className="text-slate-300 hover:text-blue-600">✎</button>
                        <button onClick={async () => { if(confirm('¿Eliminar?')) { await deleteTool(t.id); loadData(); }}} className="text-slate-300 hover:text-red-500 text-xl leading-none">&times;</button>
                      </div>
                    </div>
                    <h4 className="text-[13px] font-black text-slate-900 uppercase tracking-tight">{t.name}</h4>
                    <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">{t.angle}° • {t.length}mm • {t.maxTons}T</p>
                  </div>
                ))}
              </div>
           </div>
        )}

        {activeTab === 'thickness' && (
           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center">
                <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tighter">Catálogo de Espesores</h2>
                <button onClick={() => setIsEditing({ type: 'thickness', data: { id: `TH-${Date.now()}`, value: 1.5, material: 'SAE 1010', recommendedToolIds: [] }})} className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg active:scale-95 transition-all">+ Nuevo</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {thicknesses.map(th => (
                  <div key={th.id} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm hover:border-blue-300 transition-all group">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{th.value} mm</h3>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{th.material}</p>
                      </div>
                      <div className="flex gap-3">
                        <button onClick={() => setIsEditing({ type: 'thickness', data: th })} className="text-slate-300 hover:text-blue-600">✎</button>
                        <button onClick={async () => { if(confirm('¿Eliminar?')) { await deleteThickness(th.id); loadData(); }}} className="text-slate-300 hover:text-red-500 text-2xl leading-none">&times;</button>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-6 rounded-[24px] border border-slate-100">
                      <span className="text-[9px] font-black text-slate-500 uppercase block mb-3 tracking-widest">Matriz Sugerida:</span>
                      <div className="flex flex-wrap gap-2">
                        {th.recommendedToolIds && th.recommendedToolIds.length > 0 ? th.recommendedToolIds.map(tid => {
                          const tool = tools.find(t => t.id === tid);
                          return <span key={tid} className="bg-white text-[10px] font-bold px-4 py-1.5 rounded-xl border border-slate-200 uppercase text-slate-700 shadow-sm">{tool?.name || tid}</span>;
                        }) : <span className="text-[10px] text-slate-300 italic">Sin asignar</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        )}
      </main>

      {/* WIDGET CRONÓMETRO FLOTANTE (PERSISTENTE) */}
      {(swIsRunning || swTime > 0) && (
        <div className="fixed bottom-8 right-8 z-50 animate-in fade-in slide-in-from-bottom-10 duration-700">
          <div className="bg-slate-950 text-white p-6 rounded-[40px] shadow-2xl border border-slate-800 backdrop-blur-2xl flex items-center gap-6">
             <div className="relative h-14 w-14 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/20">
               {swIsRunning && <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-20"></div>}
               <span className="text-2xl">⏱</span>
             </div>
             <div className="pr-6 border-r border-slate-800">
                <select className="bg-transparent text-[9px] font-black text-slate-500 uppercase outline-none block mb-1" value={swMachine} onChange={e => setSwMachine(e.target.value)}>
                  <option value="" className="bg-slate-900">SELECCIONAR MÁQUINA</option>
                  {machines.map(m => <option key={m.id} value={m.id} className="bg-slate-900">{m.id}</option>)}
                </select>
                <div className="text-3xl font-mono font-black text-blue-400 tracking-tighter leading-none">
                  {Math.floor(swTime/60)}:{(swTime%60).toString().padStart(2,'0')}
                  <span className="text-xs text-slate-600 ml-1">MIN</span>
                </div>
             </div>
             <div className="flex gap-3">
                <button onClick={() => setSwIsRunning(!swIsRunning)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${swIsRunning ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                  {swIsRunning ? '■' : '▶'}
                </button>
                <button onClick={handleSaveTimeRecord} className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg hover:shadow-blue-500/40 active:scale-90 transition-all">
                  💾
                </button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN (ADAPTADO A NUEVO ESTILO) */}
      {isEditing && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full max-w-5xl rounded-t-[40px] md:rounded-[48px] shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom-full md:slide-in-from-bottom-0 md:zoom-in-95 duration-500">
            <div className="p-8 border-b flex justify-between items-center bg-slate-900 text-white">
               <div>
                  <h3 className="text-xl font-black uppercase tracking-tight">Gestión de {isEditing.type === 'batch' ? 'Lote de Producción' : isEditing.type}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Completa los parámetros técnicos requeridos</p>
               </div>
               <button onClick={() => setIsEditing(null)} className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-800 text-2xl hover:bg-red-500 transition-colors">&times;</button>
            </div>
            
            <div className="p-8 md:p-12 overflow-y-auto space-y-10">
               {isEditing.type === 'batch' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                       <div className="group">
                         <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Identificación del Lote</label>
                         <input className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl font-bold text-lg group-focus-within:border-blue-400 transition-all outline-none" value={isEditing.data.name} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, name: e.target.value}})} placeholder="Nombre del componente..." />
                       </div>
                       <div className="grid grid-cols-2 gap-6">
                         <div>
                           <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Piezas Totales</label>
                           <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl font-bold text-lg outline-none" value={isEditing.data.pieces} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, pieces: Number(e.target.value)}})} />
                         </div>
                         <div>
                           <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Golpes por Pz</label>
                           <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl font-bold text-lg outline-none" value={isEditing.data.strikesPerPiece} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, strikesPerPiece: Number(e.target.value)}})} />
                         </div>
                       </div>
                       <div>
                         <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Máquina Asignada</label>
                         <select className="w-full bg-slate-50 border-2 border-slate-100 p-5 rounded-3xl font-bold text-lg uppercase appearance-none outline-none" value={isEditing.data.machineId} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, machineId: e.target.value}})}>
                           {machines.map(m => <option key={m.id} value={m.id}>{m.id} - {m.name}</option>)}
                         </select>
                       </div>
                    </div>
                    <div className="bg-slate-50 p-8 rounded-[40px] border border-slate-200 space-y-6">
                       <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest mb-2 flex items-center gap-3">
                         <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
                         Maniobras y Logística
                       </h4>
                       <div className="space-y-4">
                         <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                            <span className="text-[11px] font-black uppercase text-slate-700">¿Requiere Cambio Herramental?</span>
                            <input type="checkbox" className="w-6 h-6 rounded-lg text-blue-600 focus:ring-blue-500" checked={isEditing.data.requiresToolChange} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, requiresToolChange: e.target.checked}})} />
                         </div>
                         <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                            <span className="text-[11px] font-black uppercase text-slate-700">¿Usar Grúa para Volteo?</span>
                            <input type="checkbox" className="w-6 h-6 rounded-lg text-blue-600 focus:ring-blue-500" checked={isEditing.data.useCraneTurn} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, useCraneTurn: e.target.checked}})} />
                         </div>
                         <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
                            <span className="text-[11px] font-black uppercase text-slate-700">¿Usar Grúa para Giro?</span>
                            <input type="checkbox" className="w-6 h-6 rounded-lg text-blue-600 focus:ring-blue-500" checked={isEditing.data.useCraneRotate} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, useCraneRotate: e.target.checked}})} />
                         </div>
                       </div>
                    </div>
                 </div>
               )}

               {isEditing.type === 'machine' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-8">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Indicador de Eficiencia (%)</label>
                        <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-3xl font-black text-2xl outline-none focus:border-blue-400 transition-all" value={isEditing.data.efficiency} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, efficiency: Number(e.target.value)}})} />
                        <p className="text-[9px] text-slate-400 mt-2 uppercase font-bold italic">Ajusta según rendimiento histórico real</p>
                      </div>
                    </div>
                    <div className="space-y-8">
                      <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block tracking-widest">Disponibilidad (Horas/Día)</label>
                        <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 p-6 rounded-3xl font-black text-2xl outline-none focus:border-blue-400 transition-all" value={isEditing.data.productiveHours} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, productiveHours: Number(e.target.value)}})} />
                        <p className="text-[9px] text-slate-400 mt-2 uppercase font-bold italic">Capacidad máxima operativa neta</p>
                      </div>
                    </div>
                 </div>
               )}
            </div>

            <div className="p-10 bg-slate-50 border-t flex flex-col md:flex-row gap-4">
               <button onClick={() => setIsEditing(null)} className="order-2 md:order-1 flex-1 py-5 text-[11px] font-black uppercase text-slate-400 tracking-widest hover:text-slate-600 transition-colors">Cancelar Operación</button>
               <button 
                 onClick={async () => {
                   if (isEditing.type === 'batch') await handleSaveBatch(isEditing.data);
                   else if (isEditing.type === 'machine') await syncAppData([...machines.filter(m => m.id !== isEditing.data.id), isEditing.data], batches);
                   setIsEditing(null);
                   loadData();
                 }} 
                 className="order-1 md:order-2 flex-[2] bg-blue-600 text-white py-5 rounded-[24px] font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl shadow-blue-500/40 hover:bg-blue-700 active:scale-[0.98] transition-all"
               >
                 Confirmar y Sincronizar
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
