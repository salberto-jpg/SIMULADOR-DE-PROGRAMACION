
import React, { useMemo } from 'react';
import { TimeRecord } from '../../types';
import { formatTime } from '../../utils/helpers';
import { Icons } from '../Icons';

const PARAM_LABELS: Record<string, string> = {
  strikeTime: "Tiempo de Golpe",
  toolChangeTime: "Cambio Herramental",
  setupTime: "Setup Inicial",
  measurementTime: "Medición por Pieza",
  tramTime: "Tramo Adicional",
  craneTurnTime: "Volteo con Grúa",
  craneRotateTime: "Giro con Grúa",
  manualTurnTime: "Volteo Manual",
  manualRotateTime: "Giro Manual",
  totalTime: "Tiempo Total de Lote",
  rotolaser_giro_corte: "Giro CORTE",
  rotolaser_giro_radio_chico: "Giro RADIO CHICO",
  rotolaser_pincazo: "Pincazo",
  rotolaser_movimiento_vacio: "Movimiento vacío",
  rotolaser_busqueda_borde: "BÚSQUEDA DE BORDE"
};

export const RecordsTab: React.FC<{ records: TimeRecord[] }> = ({ records }) => {
  const machineAverages = useMemo(() => {
    const summary: Record<string, Record<string, { sum: number, count: number }>> = {};
    records.forEach(r => {
      if (!summary[r.machineId]) summary[r.machineId] = {};
      const paramStr = String(r.parameter);
      // Extraer el nombre base del parámetro si tiene longitud entre paréntesis
      const baseParam = paramStr.split(' (')[0];
      
      if (!summary[r.machineId][baseParam]) {
        summary[r.machineId][baseParam] = { sum: 0, count: 0 };
      }
      summary[r.machineId][baseParam].sum += r.value;
      summary[r.machineId][baseParam].count += 1;
    });
    return summary;
  }, [records]);

  return (
    <div className="space-y-8 md:space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-xl md:text-3xl font-black text-blue-950 uppercase tracking-tighter">Panel de Rendimiento Histórico</h2>
          <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Análisis de tiempos promediados por centro de trabajo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {Object.entries(machineAverages).map(([mId, params]) => (
          <div key={mId} className="bg-white rounded-[32px] md:rounded-[48px] border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-2xl transition-all animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="p-6 md:p-8 bg-blue-950 text-white">
               <div className="flex justify-between items-center mb-1">
                  <h3 className="text-2xl md:text-3xl font-black uppercase tracking-tighter">{mId}</h3>
                  <span className="text-[8px] md:text-[9px] font-black bg-blue-800 px-3 py-1 rounded-full uppercase">Reporte</span>
               </div>
               <p className="text-[8px] md:text-[9px] font-bold text-blue-300 uppercase tracking-widest">RESUMEN DE PROMEDIOS</p>
            </div>
            
            <div className="p-6 md:p-8 flex-1 space-y-5 md:space-y-6">
               {Object.entries(params).map(([paramKey, stats], pIdx) => (
                 <div key={pIdx} className="group/param flex flex-col border-b border-slate-50 pb-3 md:pb-4 last:border-0 last:pb-0">
                    <div className="flex justify-between items-center mb-1">
                       <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider">
                         {PARAM_LABELS[paramKey] || paramKey}
                       </span>
                       <span className="text-[7px] md:text-[8px] font-black text-blue-800 bg-blue-50 px-2 py-0.5 rounded uppercase">
                          {stats.count} {stats.count === 1 ? 'Captura' : 'Capturas'}
                       </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                       <div className="flex flex-col">
                         <span className="text-[7px] md:text-[8px] font-bold text-slate-400 uppercase leading-none mb-1">PROMEDIO:</span>
                         <span className="text-xl md:text-2xl font-black text-blue-950 tabular-nums">
                           {formatTime(stats.sum / stats.count)}
                         </span>
                       </div>
                       <span className="text-[8px] md:text-[9px] font-bold text-slate-300 uppercase">HH:MM:SS</span>
                    </div>
                 </div>
               ))}
               {Object.keys(params).length === 0 && (
                 <div className="py-8 md:py-10 text-center text-slate-300 italic text-[9px] md:text-[10px] uppercase tracking-widest">Sin registros registrados</div>
               )}
            </div>
          </div>
        ))}
      </div>

      {records.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 md:py-40 opacity-20 text-slate-300">
           <div className="mb-6"><Icons.Records /></div>
           <p className="text-[11px] md:text-sm font-black uppercase tracking-[0.3em] text-blue-950 text-center px-6">Capture tiempos con el cronómetro para ver estadísticas</p>
        </div>
      )}

      {records.length > 0 && (
        <div className="pt-8 md:pt-10 border-t border-slate-200 overflow-hidden">
           <h4 className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Últimas 15 capturas individuales</h4>
           <div className="bg-white rounded-[24px] md:rounded-[32px] border border-slate-200 overflow-hidden shadow-sm overflow-x-auto">
              <div className="min-w-[600px] md:min-w-0 max-h-[400px] overflow-y-auto scrollbar-hide">
                 <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 sticky top-0 z-10">
                       <tr className="border-b border-slate-100">
                          <th className="px-6 md:px-8 py-3 md:py-4 text-[8px] md:text-[9px] font-black uppercase text-slate-400">Fecha / Hora</th>
                          <th className="px-6 md:px-8 py-3 md:py-4 text-[8px] md:text-[9px] font-black uppercase text-slate-400">Máquina</th>
                          <th className="px-6 md:px-8 py-3 md:py-4 text-[8px] md:text-[9px] font-black uppercase text-slate-400">Parámetro</th>
                          <th className="px-6 md:px-8 py-3 md:py-4 text-[8px] md:text-[9px] font-black uppercase text-slate-400 text-right">Tiempo</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {records.slice(0, 15).map(r => (
                         <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 md:px-8 py-2 md:py-3 text-[9px] md:text-[10px] font-bold text-slate-400">{new Date(r.timestamp).toLocaleString()}</td>
                            <td className="px-6 md:px-8 py-2 md:py-3 text-[9px] md:text-[10px] font-black text-blue-900 uppercase">{r.machineId}</td>
                            <td className="px-6 md:px-8 py-2 md:py-3 text-[9px] md:text-[10px] font-bold text-slate-500 uppercase">
                              {/* Mostrar etiqueta base + longitud si existe */}
                              {PARAM_LABELS[r.parameter.split(' (')[0]] || r.parameter}
                              {r.parameter.includes(' (L: ') && (
                                <span className="text-[8px] font-black text-blue-400 ml-1">
                                  {r.parameter.match(/\(L: .*?\)/)?.[0]}
                                </span>
                              )}
                            </td>
                            <td className="px-6 md:px-8 py-2 md:py-3 text-[10px] md:text-[11px] font-black text-blue-950 text-right tabular-nums">{formatTime(r.value)}</td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
