import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_MACHINES } from './constants';
import { MachineConfig, Batch, Tool, Thickness, TimeRecord } from './types';
import { calculateBatchTime, formatTime } from './utils/helpers';
import { optimizeProductionSchedule } from './services/geminiService';
import { 
  initSupabase, fetchMachines, fetchBatches, fetchTools, fetchThicknesses,
  saveTool, deleteTool, saveThickness, deleteThickness, syncAppData, deleteBatchFromCloud,
  subscribeToChanges, saveTimeRecord
} from './services/supabaseService';

const LOGO_URL = "https://jcdbepgjoqxtnuarcwku.supabase.co/storage/v1/object/public/IMAGENES/metallo-removebg-preview.png";

type TabType = 'schedule' | 'machines' | 'tools' | 'thickness' | 'import';

// --- COMPONENTES AUXILIARES (DEFINIDOS ANTES PARA EVITAR ERRORES DE REFERENCIA) ---

function Stopwatch({ machines, onRecordSave }: { machines: MachineConfig[], onRecordSave: (msg: string) => void }) {
  const [activeMachine, setActiveMachine] = useState<string>('');
  const [activeParam, setActiveParam] = useState<keyof MachineConfig>('strikeTime');
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<any>(null);

  const start = () => { if (!isRunning) { setIsRunning(true); timerRef.current = setInterval(() => setTime(t => t + 1), 1000); } };
  const stop = () => { setIsRunning(false); if (timerRef.current) clearInterval(timerRef.current); };
  const reset = () => { stop(); setTime(0); };

  const handleSave = async () => {
    if (!activeMachine || time === 0) return;
    const record: TimeRecord = { id: `tr-${Date.now()}`, machineId: activeMachine, parameter: activeParam, value: time / 60, timestamp: new Date().toISOString() };
    await saveTimeRecord(record);
    onRecordSave(`Estudio guardado: ${activeMachine}`);
    reset();
  };

  return (
    <div className="flex items-center gap-4 bg-slate-900 px-4 py-2 rounded-2xl border border-slate-700 shadow-xl">
      <div className="flex flex-col">
        <select className="bg-transparent text-white text-[9px] font-black uppercase outline-none" value={activeMachine} onChange={(e) => setActiveMachine(e.target.value)}>
          <option value="" className="bg-slate-900 text-white">Máquina</option>
          {machines.map(m => <option key={m.id} value={m.id} className="bg-slate-900 text-white">{m.id}</option>)}
        </select>
        <select className="bg-transparent text-slate-400 text-[8px] font-black uppercase outline-none" value={activeParam} onChange={(e) => setActiveParam(e.target.value as any)}>
          <option value="strikeTime" className="bg-slate-900 text-white">Golpe</option>
          <option value="setupTime" className="bg-slate-900 text-white">Setup</option>
          <option value="toolChangeTime" className="bg-slate-900 text-white">Cruce Herr.</option>
        </select>
      </div>
      <div className="text-blue-400 font-mono text-xl font-black w-20 text-center tracking-tighter">
        {Math.floor(time / 60)}:{(time % 60).toString().padStart(2, '0')}
      </div>
      <div className="flex gap-2">
        {!isRunning ? (
          <button onClick={start} className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/40 transition-all">▶</button>
        ) : (
          <button onClick={stop} className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center hover:bg-red-500/40 transition-all">■</button>
        )}
        <button onClick={handleSave} className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center hover:bg-blue-500/40 transition-all">💾</button>
      </div>
    </div>
  );
}

// Fix: Used React.FC to properly type MachineProductionCard and ensure 'key' prop is accepted correctly by the TS compiler
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
    <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px] hover:shadow-lg transition-all group">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{machine.id}</h3>
          <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase ${occupancy > 90 ? 'bg-red-500 text-white' : occupancy > 70 ? 'bg-orange-500 text-white' : 'bg-blue-600 text-white'}`}>
            {occupancy.toFixed(0)}%
          </span>
        </div>
        <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div className="bg-blue-600 h-full transition-all duration-1000" style={{ width: `${occupancy}%` }} />
        </div>
        <div className="flex justify-between mt-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
          <span>{formatTime(totalMinutes)}</span>
          <span>{machine.productiveHours}HS Capacidad</span>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-3 overflow-y-auto scrollbar-hide">
        {machineBatches.length === 0 ? (
          <div className="h-full flex items-center justify-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">Sin carga programada</div>
        ) : (
          machineBatches.map(batch => (
            <div key={batch.id} className="p-4 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white hover:border-blue-200 hover:shadow-md transition-all relative group/item">
              <div className="flex justify-between mb-1">
                <span className="text-[10px] font-black text-slate-900 uppercase truncate max-w-[140px]">{batch.name}</span>
                <span className="text-[9px] font-black text-blue-600">{formatTime(batch.totalTime)}</span>
              </div>
              <div className="flex gap-2 text-[8px] font-bold text-slate-400 uppercase">
                <span>{batch.pieces} Pzs • {batch.thickness}mm</span>
              </div>
              <div className="mt-3 flex gap-2 opacity-0 group-hover/item:opacity-100 transition-all">
                <button onClick={() => onEditBatch(batch)} className="text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-1 rounded-lg">Editar</button>
                <button onClick={() => { if(confirm('¿Eliminar lote?')) onDeleteBatch(batch.id); }} className="text-[9px] font-black text-red-500 uppercase bg-red-50 px-2 py-1 rounded-lg">Borrar</button>
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
  const [machines, setMachines] = useState<MachineConfig[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [thicknesses, setThicknesses] = useState<Thickness[]>([]);
  const [status, setStatus] = useState("");
  const [isEditing, setIsEditing] = useState<{ type: string, data: any } | null>(null);
  const [iaWarnings, setIaWarnings] = useState<{batch_id: string, reason: string}[] | null>(null);

  useEffect(() => {
    const SUPABASE_URL = "https://jcdbepgjoqxtnuarcwku.supabase.co"; 
    const SUPABASE_KEY = "sb_publishable_w5tryB0lyl0hCNP3B9AAUg_udm3kUu0"; 
    initSupabase(SUPABASE_URL, SUPABASE_KEY);
    loadData();

    const subBatches = subscribeToChanges('batches', () => loadData());
    const subTools = subscribeToChanges('tools', () => loadData());
    const subMachines = subscribeToChanges('machines', () => loadData());
    const subThickness = subscribeToChanges('thicknesses', () => loadData());

    return () => {
      subBatches?.unsubscribe();
      subTools?.unsubscribe();
      subMachines?.unsubscribe();
      subThickness?.unsubscribe();
    };
  }, []);

  const loadData = async () => {
    try {
      const [m, b, t, th] = await Promise.all([
        fetchMachines(), fetchBatches(), fetchTools(), fetchThicknesses()
      ]);
      setMachines(m.length ? m : INITIAL_MACHINES);
      setBatches(b);
      setTools(t);
      setThicknesses(th);
    } catch (e) {
      console.error("Error cargando datos:", e);
    }
  };

  const handleSync = async () => {
    setStatus("Sincronizando...");
    await syncAppData(machines, batches);
    setStatus("Sincronizado");
    setTimeout(() => setStatus(""), 2000);
    loadData();
  };

  const runIA = async () => {
    setStatus("IA Analizando...");
    const result = await optimizeProductionSchedule(batches, machines, tools, thicknesses);
    if (result) {
      if (result.unschedulable) setIaWarnings(result.unschedulable);
      const updated = batches.map(b => {
        const suggestion = result.plan?.find((p: any) => p.batch_id === b.id);
        if (suggestion) return { ...b, machineId: suggestion.machine_id, scheduledDate: suggestion.scheduled_date };
        return b;
      });
      setBatches(updated);
      await syncAppData(machines, updated);
      setStatus("Optimizado con IA");
      loadData();
    }
  };

  const handleSaveBatch = async (batch: Batch) => {
    const machine = machines.find(m => m.id === batch.machineId);
    if (!machine) return;
    const time = calculateBatchTime(batch, machine);
    const updatedBatch = { ...batch, totalTime: time };
    await syncAppData(machines, [...batches.filter(b => b.id !== updatedBatch.id), updatedBatch]);
    loadData();
  };

  const handleSaveMachine = async (machine: MachineConfig) => {
    const updatedMachines = [...machines.filter(m => m.id !== machine.id), machine];
    await syncAppData(updatedMachines, batches);
    loadData();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Inter']">
      <header className="bg-white px-8 py-4 sticky top-0 z-40 shadow-sm border-b border-slate-200">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <img src={LOGO_URL} alt="METALLO" className="h-10 w-auto" />
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tighter leading-none uppercase">SIMULADOR DE PROGRAMACIÓN</h1>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Plataforma en Tiempo Real</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Stopwatch machines={machines} onRecordSave={(msg) => { setStatus(msg); setTimeout(() => setStatus(""), 3000); }} />
            <div className="flex gap-2">
              <div className="px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black text-blue-600 uppercase tracking-widest border border-slate-100">{status || 'Sistema Activo'}</div>
              <button onClick={handleSync} className="bg-blue-600 text-white px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200">Sincronizar</button>
            </div>
          </div>
        </div>
        <nav className="flex gap-2">
          {(['schedule', 'machines', 'tools', 'thickness', 'import'] as TabType[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-3 rounded-t-xl font-black text-[9px] uppercase tracking-[0.2em] transition-all border-b-2 ${activeTab === tab ? 'bg-slate-900 text-white border-blue-600' : 'bg-white text-slate-400 border-transparent hover:bg-slate-50'}`}>
              {tab === 'schedule' ? 'Programación' : tab === 'machines' ? 'Máquinas' : tab === 'tools' ? 'Herramental' : tab === 'thickness' ? 'Espesores' : 'Importar'}
            </button>
          ))}
        </nav>
      </header>

      <main className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'schedule' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
               <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Carga de Planta</h2>
               <div className="flex gap-4">
                 <button onClick={() => setIsEditing({ type: 'batch', data: { id: `b-${Date.now()}`, name: '', machineId: machines[0]?.id || 'PL-01', pieces: 10, strikesPerPiece: 4, thickness: 1.5, length: 500, width: 200, deliveryDate: new Date().toISOString().split('T')[0], toolIds: [], useCraneTurn: false, turnQuantity: 1, useCraneRotate: false, rotateQuantity: 1, requiresToolChange: true, totalTime: 0, scheduledDate: new Date().toISOString().split('T')[0], notes: '', priority: 'medium', trams: 1, toolChanges: 1 } })} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all">+ Cargar Lote</button>
                 <button onClick={runIA} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 active:scale-95 transition-all">Optimizar con IA</button>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
              {machines.map((m: MachineConfig) => (
                <MachineProductionCard key={m.id} machine={m} batches={batches} onEditBatch={(b: Batch) => setIsEditing({ type: 'batch', data: b })} onDeleteBatch={(id: string) => { deleteBatchFromCloud(id).then(loadData); }} />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'machines' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Máquinas Individuales</h2>
              <button onClick={() => setIsEditing({ type: 'machine', data: { id: `PL-${Date.now()}`, name: '', description: '', strikeTime: 0.005, toolChangeTime: 5, setupTime: 10, measurementTime: 0.5, tramTime: 3, craneTurnTime: 1, craneRotateTime: 1, manualTurnTime: 0.05, manualRotateTime: 0.05, efficiency: 100, productiveHours: 16, maxLength: 3000, maxTons: 100, compatibleToolIds: [] }})} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg">+ Nueva Máquina</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {machines.map(m => (
                <div key={m.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex flex-col justify-between hover:border-blue-300 transition-all">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{m.id}</h3>
                    <p className="text-[10px] font-bold text-slate-400 mb-4">{m.name}</p>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[9px] font-black uppercase"><span className="text-slate-400">Tons Max:</span> <span className="text-slate-900">{m.maxTons}T</span></div>
                      <div className="flex justify-between text-[9px] font-black uppercase"><span className="text-slate-400">Eficiencia:</span> <span className="text-blue-600 font-bold">{m.efficiency}%</span></div>
                      <div className="flex justify-between text-[9px] font-black uppercase"><span className="text-slate-400">Jornada:</span> <span className="text-slate-900">{m.productiveHours}hs</span></div>
                    </div>
                  </div>
                  <button onClick={() => setIsEditing({ type: 'machine', data: m })} className="mt-6 w-full py-3 bg-slate-50 text-slate-900 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">Editar Parámetros Técnicos</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Herramental</h2>
              <button onClick={() => setIsEditing({ type: 'tool', data: { id: `T-${Date.now()}`, name: '', type: 'punch', angle: 88, maxTons: 100, length: 835, compatibleMachineIds: [] }})} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest">+ Nueva Herramienta</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {tools.map(t => (
                <div key={t.id} className="bg-white p-5 rounded-[24px] border border-slate-200 shadow-sm flex justify-between items-center group hover:border-blue-300 transition-all">
                  <div>
                    <span className={`text-[7px] px-2 py-0.5 rounded-full font-black uppercase ${t.type === 'punch' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>{t.type === 'punch' ? 'Punzon' : 'Matriz'}</span>
                    <h4 className="text-[11px] font-black text-slate-800 uppercase mt-1">{t.name}</h4>
                    <p className="text-[8px] font-bold text-slate-400">{t.angle}° • {t.length}mm • {t.maxTons}T</p>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => setIsEditing({ type: 'tool', data: t })} className="text-slate-300 hover:text-blue-600">✎</button>
                    <button onClick={async () => { if(confirm('¿Eliminar herramienta?')) { await deleteTool(t.id); loadData(); }}} className="text-slate-300 hover:text-red-500 text-xl leading-none">&times;</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'thickness' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Espesores y Materiales</h2>
              <button onClick={() => setIsEditing({ type: 'thickness', data: { id: `TH-${Date.now()}`, value: 1.5, material: 'SAE 1010', recommendedToolIds: [] }})} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest">+ Nuevo Espesor</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {thicknesses.map(th => (
                <div key={th.id} className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:border-blue-300 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{th.value} mm</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{th.material}</p>
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => setIsEditing({ type: 'thickness', data: th })} className="text-slate-300 hover:text-blue-600">✎</button>
                      <button onClick={async () => { if(confirm('¿Eliminar espesor?')) { await deleteThickness(th.id); loadData(); }}} className="text-slate-300 hover:text-red-500 text-xl leading-none">&times;</button>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <span className="text-[8px] font-black text-slate-400 uppercase block mb-2">Herramental Recomendado:</span>
                    <div className="flex flex-wrap gap-2">
                      {th.recommendedToolIds && th.recommendedToolIds.length > 0 ? th.recommendedToolIds.map(tid => {
                        const tool = tools.find(t => t.id === tid);
                        return <span key={tid} className="bg-white text-[9px] font-bold px-3 py-1 rounded-xl border border-slate-200 uppercase text-slate-700 shadow-sm">{tool?.name || tid}</span>;
                      }) : <span className="text-[9px] text-slate-300 italic">No asignadas</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-5xl rounded-[40px] shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b flex justify-between items-center bg-slate-900 text-white">
               <h3 className="text-xl font-black uppercase tracking-tight">Gestionar {isEditing.type.toUpperCase()}</h3>
               <button onClick={() => setIsEditing(null)} className="text-3xl font-light hover:rotate-90 transition-all">&times;</button>
            </div>
            <div className="p-8 space-y-8 max-h-[75vh] overflow-y-auto">
               
               {isEditing.type === 'machine' && (
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <section className="space-y-4">
                      <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b pb-2">Capacidad y Eficiencia</h4>
                      <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Nombre Comercial</label><input className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.name} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, name: e.target.value}})} /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Long. Max (mm)</label><input type="number" className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.maxLength} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, maxLength: Number(e.target.value)}})} /></div>
                        <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Tons Max</label><input type="number" className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.maxTons} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, maxTons: Number(e.target.value)}})} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-[9px] font-black uppercase text-blue-600 mb-1 block">Eficiencia %</label><input type="number" className="w-full bg-blue-50 border-2 border-blue-100 p-3 rounded-xl font-bold text-blue-900" value={isEditing.data.efficiency} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, efficiency: Number(e.target.value)}})} /></div>
                        <div><label className="text-[9px] font-black uppercase text-blue-600 mb-1 block">Hs Jornada</label><input type="number" className="w-full bg-blue-50 border-2 border-blue-100 p-3 rounded-xl font-bold text-blue-900" value={isEditing.data.productiveHours} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, productiveHours: Number(e.target.value)}})} /></div>
                      </div>
                    </section>
                    <section className="space-y-4">
                      <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest border-b pb-2">Tiempos de Setup (min)</h4>
                      <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Puesta a Punto Base</label><input type="number" step="0.1" className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.setupTime} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, setupTime: Number(e.target.value)}})} /></div>
                      <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Cambio Herr. Unitario</label><input type="number" step="0.1" className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.toolChangeTime} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, toolChangeTime: Number(e.target.value)}})} /></div>
                      <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Cambio Tramo</label><input type="number" step="0.1" className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.tramTime} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, tramTime: Number(e.target.value)}})} /></div>
                      <div><label className="text-[9px] font-black uppercase text-orange-600 mb-1 block">Medición Técnica</label><input type="number" step="0.1" className="w-full bg-orange-50 border-2 border-orange-100 p-3 rounded-xl font-bold text-orange-900" value={isEditing.data.measurementTime} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, measurementTime: Number(e.target.value)}})} /></div>
                    </section>
                    <section className="space-y-4">
                      <h4 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest border-b pb-2">Operación y Maniobras</h4>
                      <div><label className="text-[9px] font-black uppercase text-emerald-600 mb-1 block">T. Golpe (min)</label><input type="number" step="0.001" className="w-full bg-emerald-50 border-2 border-emerald-100 p-3 rounded-xl font-bold text-emerald-900" value={isEditing.data.strikeTime} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, strikeTime: Number(e.target.value)}})} /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Grúa Volteo</label><input type="number" step="0.1" className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.craneTurnTime} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, craneTurnTime: Number(e.target.value)}})} /></div>
                        <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Grúa Giro</label><input type="number" step="0.1" className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.craneRotateTime} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, craneRotateTime: Number(e.target.value)}})} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Manual Volteo</label><input type="number" step="0.01" className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.manualTurnTime} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, manualTurnTime: Number(e.target.value)}})} /></div>
                        <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Manual Giro</label><input type="number" step="0.01" className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.manualRotateTime} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, manualRotateTime: Number(e.target.value)}})} /></div>
                      </div>
                    </section>
                 </div>
               )}

               {isEditing.type === 'batch' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <section className="space-y-4">
                      <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b pb-2">Información del Lote</h4>
                      <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Nombre/Código</label><input className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.name} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, name: e.target.value}})} /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Piezas</label><input type="number" className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.pieces} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, pieces: Number(e.target.value)}})} /></div>
                        <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Golpes/Pza</label><input type="number" className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.strikesPerPiece} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, strikesPerPiece: Number(e.target.value)}})} /></div>
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Plegadora Destino</label>
                        <select className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold uppercase" value={isEditing.data.machineId} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, machineId: e.target.value}})}>
                          {machines.map(m => <option key={m.id} value={m.id}>{m.id} - {m.name}</option>)}
                        </select>
                      </div>
                    </section>
                    <section className="space-y-4">
                      <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest border-b pb-2">Maniobras Especiales</h4>
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" className="w-5 h-5 rounded text-blue-600" checked={isEditing.data.requiresToolChange} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, requiresToolChange: e.target.checked}})} />
                          <span className="text-[10px] font-black uppercase">Cambio Herramental</span>
                        </label>
                      </div>
                      <div className="space-y-3">
                        <div className="p-4 bg-emerald-50/30 rounded-2xl border border-emerald-100 flex items-center justify-between">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" className="w-5 h-5 rounded text-emerald-600" checked={isEditing.data.useCraneTurn} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, useCraneTurn: e.target.checked}})} />
                            <span className="text-[10px] font-black uppercase text-emerald-800">Volteo Grúa</span>
                          </label>
                          {isEditing.data.useCraneTurn && <input type="number" className="w-16 bg-white border-2 border-emerald-100 p-2 rounded-xl font-bold text-center" value={isEditing.data.turnQuantity} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, turnQuantity: Number(e.target.value)}})} />}
                        </div>
                        <div className="p-4 bg-blue-50/30 rounded-2xl border border-blue-100 flex items-center justify-between">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" className="w-5 h-5 rounded text-blue-600" checked={isEditing.data.useCraneRotate} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, useCraneRotate: e.target.checked}})} />
                            <span className="text-[10px] font-black uppercase text-blue-800">Giro Grúa</span>
                          </label>
                          {isEditing.data.useCraneRotate && <input type="number" className="w-16 bg-white border-2 border-blue-100 p-2 rounded-xl font-bold text-center" value={isEditing.data.rotateQuantity} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, rotateQuantity: Number(e.target.value)}})} />}
                        </div>
                      </div>
                    </section>
                 </div>
               )}

               {isEditing.type === 'tool' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <section className="space-y-4">
                      <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b pb-2">Identificación</h4>
                      <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Nombre</label><input className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.name} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, name: e.target.value}})} /></div>
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Tipo</label>
                        <div className="flex gap-2">
                          <button onClick={() => setIsEditing({...isEditing, data: {...isEditing.data, type: 'punch'}})} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${isEditing.data.type === 'punch' ? 'bg-orange-600 text-white border-orange-600' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>Punzon</button>
                          <button onClick={() => setIsEditing({...isEditing, data: {...isEditing.data, type: 'die'}})} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase border-2 transition-all ${isEditing.data.type === 'die' ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>Matriz</button>
                        </div>
                      </div>
                    </section>
                    <section className="space-y-4">
                      <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest border-b pb-2">Specs Técnicas</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Ángulo (°)</label><input type="number" className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.angle} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, angle: Number(e.target.value)}})} /></div>
                        <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Largo (mm)</label><input type="number" className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.length} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, length: Number(e.target.value)}})} /></div>
                      </div>
                      <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Tons/m Máx</label><input type="number" className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.maxTons} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, maxTons: Number(e.target.value)}})} /></div>
                    </section>
                 </div>
               )}

               {isEditing.type === 'thickness' && (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <section className="space-y-4">
                      <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-b pb-2">Material</h4>
                      <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Espesor (mm)</label><input type="number" step="0.1" className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.value} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, value: Number(e.target.value)}})} /></div>
                      <div><label className="text-[9px] font-black uppercase text-slate-400 mb-1 block">Material</label><input className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold" value={isEditing.data.material} onChange={e => setIsEditing({...isEditing, data: {...isEditing.data, material: e.target.value}})} /></div>
                    </section>
                    <section className="space-y-4">
                      <h4 className="text-[10px] font-black text-orange-600 uppercase tracking-widest border-b pb-2">Cruce de Herramental</h4>
                      <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto pr-2 scrollbar-hide">
                        {tools.map(t => (
                          <label key={t.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${isEditing.data.recommendedToolIds?.includes(t.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-100 hover:bg-slate-100'}`}>
                            <input type="checkbox" className="hidden" checked={isEditing.data.recommendedToolIds?.includes(t.id)} onChange={e => {
                              const ids = isEditing.data.recommendedToolIds || [];
                              const newIds = e.target.checked ? [...ids, t.id] : ids.filter((id:string) => id !== t.id);
                              setIsEditing({...isEditing, data: {...isEditing.data, recommendedToolIds: newIds}});
                            }} />
                            <span className="text-[10px] font-black uppercase">{t.name} <span className="text-[8px] opacity-70 ml-2">({t.type === 'punch' ? 'Punzon' : 'Matriz'})</span></span>
                          </label>
                        ))}
                      </div>
                    </section>
                 </div>
               )}
            </div>
            <div className="p-8 border-t bg-slate-50 flex justify-end gap-3">
               <button onClick={() => setIsEditing(null)} className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 tracking-widest">Cancelar</button>
               <button onClick={async () => {
                 setStatus("Guardando...");
                 if (isEditing.type === 'batch') await handleSaveBatch(isEditing.data);
                 else if (isEditing.type === 'machine') await handleSaveMachine(isEditing.data);
                 else if (isEditing.type === 'tool') await saveTool(isEditing.data);
                 else if (isEditing.type === 'thickness') await saveThickness(isEditing.data);
                 
                 setIsEditing(null);
                 setStatus("Cambios Guardados");
                 loadData();
                 setTimeout(() => setStatus(""), 2000);
               }} className="bg-blue-600 text-white px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-blue-600/20 active:scale-95 transition-all">Confirmar Cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
