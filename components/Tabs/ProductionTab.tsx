
import React from 'react';
import { Batch, MachineConfig } from '../../types';
import { getMachineTimelineSlices, formatTime } from '../../utils/helpers';
import { optimizeProductionSchedule } from '../../services/geminiService';
import { syncAppData } from '../../services/supabaseService';
import { Icons } from '../Icons';

interface ProductionTabProps {
  batches: Batch[];
  machines: MachineConfig[];
  selectedDate: string;
  onDateChange: (date: string) => void;
  onEdit: (data: any) => void;
  onDelete: (id: string) => Promise<void>;
  onLoad: () => void;
}

export const ProductionTab: React.FC<ProductionTabProps> = ({ 
  batches, machines, selectedDate, onDateChange, onEdit, onDelete, onLoad 
}) => {
  
  const handleOptimize = async () => {
    const result = await optimizeProductionSchedule(batches, machines, [], []);
    if (result && result.plan) {
      const updated = batches.map(b => {
        const sugg = result.plan.find((p: any) => p.batch_id === b.id);
        return sugg ? { ...b, machineId: sugg.machine_id, scheduledDate: sugg.scheduled_date } : b;
      });
      await syncAppData(machines, updated);
      onLoad();
    }
  };

  const handleAddNewBatch = () => {
    // Lógica para obtener el día laboral actual o siguiente
    let today = new Date();
    const day = today.getDay();
    if (day === 0) today.setDate(today.getDate() + 1); // Domingo a Lunes
    else if (day === 6) today.setDate(today.getDate() + 2); // Sábado a Lunes
    
    const defaultDate = today.toISOString().split('T')[0];

    onEdit({ 
      id: `b-${Date.now()}`, 
      name: '', 
      machineId: machines[0]?.id || 'PL-01', 
      pieces: 10, 
      strikesPerPiece: 4, 
      thickness: 1.5,
      // Los parámetros físicos se mantienen ocultos pero con valores base
      length: 500,
      width: 250,
      turnQuantity: 0,
      rotateQuantity: 0,
      useCraneTurn: false,
      useCraneRotate: false,
      trams: 0,
      toolChanges: 0,
      requiresToolChange: false,
      scheduledDate: defaultDate, 
      priority: 'medium', 
      isSimulation: true 
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-blue-950 uppercase tracking-tighter">Panel de Producción</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Capacidad diaria optimizada</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <input 
            type="date" 
            className="bg-white border border-slate-200 p-3 rounded-2xl text-[11px] font-black text-blue-950 uppercase"
            value={selectedDate}
            onChange={e => onDateChange(e.target.value)}
          />
          <button onClick={handleAddNewBatch} className="bg-blue-800 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl">
            + Nuevo Lote
          </button>
          <button onClick={handleOptimize} className="bg-blue-950 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest">
            IA Optimizar
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {machines.map(m => {
          const daySlices = getMachineTimelineSlices(m, batches).filter(s => s.date === selectedDate);
          const totalTime = daySlices.reduce((acc, s) => acc + s.timeInDay, 0);
          const occupancy = Math.min(100, (totalTime / ((m.productiveHours || 16) * 60)) * 100);

          return (
            <div key={m.id} className="bg-white rounded-[28px] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[450px]">
              <div className="p-5 border-b bg-slate-50/50">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-black text-blue-950">{m.id}</h3>
                  <span className="text-[10px] font-black bg-blue-800 text-white px-2 py-1 rounded-full">{occupancy.toFixed(0)}%</span>
                </div>
                <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden">
                  <div className="bg-blue-800 h-full transition-all" style={{ width: `${occupancy}%` }} />
                </div>
              </div>
              <div className="flex-1 p-4 space-y-3 overflow-y-auto scrollbar-hide">
                {daySlices.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-20">
                    <Icons.Sun />
                    <p className="text-[10px] font-black uppercase mt-2">Sin carga</p>
                  </div>
                ) : (
                  daySlices.map((slice, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl hover:border-blue-800/30 transition-all">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-black text-blue-950 uppercase truncate">{slice.batch.name}</span>
                        <span className="text-[9px] font-black text-blue-800">{formatTime(slice.timeInDay)}</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => onEdit(slice.batch)} className="text-[8px] font-black text-blue-800 uppercase bg-blue-50 px-2 py-1 rounded">Editar</button>
                        <button onClick={() => onDelete(slice.batch.id).then(onLoad)} className="text-[8px] font-black text-red-500 uppercase bg-red-50 px-2 py-1 rounded">Borrar</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
