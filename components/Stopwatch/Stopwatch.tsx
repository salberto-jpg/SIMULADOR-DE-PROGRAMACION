
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Icons } from '../Icons';
import { formatTime } from '../../utils/helpers';
import { MachineConfig } from '../../types';

interface StopwatchProps {
  machines: MachineConfig[];
  onCapture: (machineId: string, param: string, value: number) => void;
}

export const Stopwatch: React.FC<StopwatchProps> = ({ machines, onCapture }) => {
  const [swTime, setSwTime] = useState(0); 
  const [swIsRunning, setSwIsRunning] = useState(false);
  const [swMachine, setSwMachine] = useState(machines[0]?.id || 'PL-01');
  const [swParam, setSwParam] = useState<string>('strikeTime');
  const [swLength, setSwLength] = useState<string>(''); // Nueva longitud medida
  const [isSwExpanded, setIsSwExpanded] = useState(false);
  
  const swIntervalRef = useRef<any>(null);
  const swStartTimeRef = useRef<number | null>(null); 
  const swAccumulatedSecsRef = useRef<number>(0); 

  const isRotolaserSelected = useMemo(() => {
    return swMachine.toUpperCase().includes('ROTOLASER');
  }, [swMachine]);

  // Parámetros que requieren longitud en Rotolaser
  const paramsRequiringLength = ['rotolaser_giro_corte', 'rotolaser_giro_radio_chico', 'rotolaser_movimiento_vacio'];
  const needsLength = isRotolaserSelected && paramsRequiringLength.includes(swParam);

  useEffect(() => {
    if (isRotolaserSelected) {
      setSwParam('rotolaser_giro_corte');
    } else {
      setSwParam('strikeTime');
    }
  }, [isRotolaserSelected]);

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
    setSwLength('');
    swAccumulatedSecsRef.current = 0;
    swStartTimeRef.current = null;
    if (swIntervalRef.current) clearInterval(swIntervalRef.current);
  };

  const handleCapture = () => {
    const finalTimeInSeconds = swIsRunning && swStartTimeRef.current 
      ? swAccumulatedSecsRef.current + (Date.now() - swStartTimeRef.current) / 1000
      : swAccumulatedSecsRef.current;
    
    const valueInMinutes = finalTimeInSeconds / 60; 
    
    // Si requiere longitud, la adjuntamos al nombre del parámetro para el registro
    let finalParam = swParam;
    if (needsLength && swLength) {
      finalParam = `${swParam} (L: ${swLength}mm)`;
    }

    onCapture(swMachine, finalParam, valueInMinutes);
    resetStopwatch();
  };

  return (
    <div className={`fixed bottom-6 right-6 z-[60] bg-blue-950 text-white rounded-[32px] shadow-2xl transition-all duration-500 flex flex-col overflow-hidden ${isSwExpanded ? 'w-[calc(100vw-48px)] max-w-80 p-6 md:p-8' : 'w-16 h-16 md:w-20 md:h-20 items-center justify-center cursor-pointer hover:bg-blue-800'}`} onClick={() => !isSwExpanded && setIsSwExpanded(true)}>
        {!isSwExpanded ? (
          <Icons.Timer />
        ) : (
          <div className="space-y-4 md:space-y-6">
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">Captura de Tiempos</span>
              <button onClick={(e) => { e.stopPropagation(); setIsSwExpanded(false); }} className="text-blue-300 hover:text-white p-2">&times;</button>
            </div>
            
            <div className="text-4xl md:text-5xl font-black text-center tabular-nums py-2 text-white">{formatTime(swTime/60)}</div>
            
            <div className="space-y-2.5 md:space-y-3">
              <select className="w-full bg-blue-900/50 p-3 rounded-xl text-[10px] font-bold uppercase border border-blue-800" value={swMachine} onChange={e => setSwMachine(e.target.value)}>
                {machines.map(m => <option key={m.id} value={m.id}>{m.id}</option>)}
              </select>
              <select className="w-full bg-blue-900/50 p-3 rounded-xl text-[10px] font-bold uppercase border border-blue-800" value={swParam} onChange={e => setSwParam(e.target.value)}>
                {isRotolaserSelected ? (
                  <>
                    <option value="rotolaser_giro_corte">Velocidad de giro CORTE</option>
                    <option value="rotolaser_giro_radio_chico">Velocidad de giro RADIO CHICO</option>
                    <option value="rotolaser_pincazo">Pincazo</option>
                    <option value="rotolaser_movimiento_vacio">Movimiento en vacío</option>
                    <option value="rotolaser_busqueda_borde">BÚSQUEDA DE BORDE</option>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </select>

              {/* Campo de longitud si es necesario y el cronómetro está detenido o pausado */}
              {needsLength && !swIsRunning && swTime > 0 && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-[9px] font-black uppercase text-blue-300 mb-1 block">Longitud medida (mm)</label>
                  <input 
                    type="number" 
                    placeholder="Eje: 500" 
                    className="w-full bg-white text-blue-950 p-3 rounded-xl text-[11px] font-bold outline-none focus:ring-2 ring-blue-500 transition-all"
                    value={swLength}
                    onChange={e => setSwLength(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2.5 md:gap-3">
              <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                <button onClick={() => setSwIsRunning(!swIsRunning)} className={`py-3.5 md:py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${swIsRunning ? 'bg-red-500' : 'bg-blue-800 hover:bg-blue-700'}`}>
                  {swIsRunning ? 'Pausar' : 'Iniciar'}
                </button>
                <button onClick={resetStopwatch} className="bg-blue-900/50 border border-blue-800 py-3.5 md:py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-800 transition-colors">
                  Reiniciar
                </button>
              </div>
              <button 
                onClick={handleCapture} 
                disabled={swTime === 0 || (needsLength && !swIsRunning && !swLength)}
                className={`py-3.5 md:py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-colors ${ (swTime === 0 || (needsLength && !swIsRunning && !swLength)) ? 'bg-slate-700 text-slate-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500' }`}
              >
                Capturar
              </button>
            </div>
          </div>
        )}
      </div>
  );
};
