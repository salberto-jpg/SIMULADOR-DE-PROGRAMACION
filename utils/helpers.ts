
import { MachineConfig, Batch } from "../types";

export const formatTime = (totalMinutes: number): string => {
  if (isNaN(totalMinutes) || totalMinutes < 0) return "00:00:00";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  const seconds = Math.floor((totalMinutes * 60) % 60);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const calculateBatchTime = (batch: Partial<Batch>, machine: MachineConfig): number => {
  const {
    pieces = 0,
    strikesPerPiece = 0,
    trams = 0,
    toolChanges = 0,
    // Overrides o fallback a máquina
    strikeTime: bStrike,
    toolChangeTime: bToolChange,
    tramTime: bTram,
    setupTime: bSetup,
    measurementTime: bMeasure,
    turnTime: bTurn, // manual turn
    rotateTime: bRotate, // manual rotate
    craneTurnTime: bCraneTurn,
    craneRotateTime: bCraneRotate,
    useCraneTurn = false,
    useCraneRotate = false
  } = batch;

  // Resolución de tiempos base
  const strike = bStrike || machine.strikeTime || 0;
  const toolChangeUnit = bToolChange || machine.toolChangeTime || 0;
  const tramUnit = bTram || machine.tramTime || 0;
  const setupUnit = bSetup || machine.setupTime || 0;
  const measureUnit = bMeasure || machine.measurementTime || 0;
  
  // Resolución de maniobras (Manual vs Grúa)
  const effectiveTurn = useCraneTurn 
    ? (bCraneTurn || machine.craneTurnTime || 0)
    : (bTurn || machine.manualTurnTime || 0);

  const effectiveRotate = useCraneRotate 
    ? (bCraneRotate || machine.craneRotateTime || 0)
    : (bRotate || machine.manualRotateTime || 0);
  
  // 1. Puesta a Punto (Setup): Tiempo base * Cantidad de cambios de herramental
  const totalSetupTime = setupUnit * toolChanges;

  // 2. Tiempos Técnicos: (Herramentales * Tiempo de cambio) + (Tramos * Tiempo de tramo)
  const technicalChangeTime = (toolChanges * toolChangeUnit) + (trams * tramUnit);
  
  // 3. Operación neta por pieza (Golpes + Maniobras por golpe)
  const operationPerPiece = strikesPerPiece * (strike + effectiveTurn + effectiveRotate);
  const totalOperationTime = operationPerPiece * pieces;

  // 4. Medición: Frecuencia 1 y cada 10 piezas
  const numChecks = pieces > 0 ? Math.floor((pieces - 1) / 10) + 1 : 0;
  const timePerCheck = measureUnit * (strikesPerPiece + 1);
  const totalMeasurementTime = timePerCheck * numChecks;
  
  const baseTotal = totalSetupTime + technicalChangeTime + totalOperationTime + totalMeasurementTime;
  const finalTime = baseTotal / ((machine.efficiency || 100) / 100);
  
  return finalTime;
};

export const findAvailableDate = (
  machine: MachineConfig, 
  requiredMinutes: number, 
  existingBatches: Batch[]
): string => {
  let checkDate = new Date();
  const dailyCapacity = (machine.productiveHours || 16) * 60;
  for (let i = 0; i < 365; i++) {
    if (checkDate.getDay() === 0 || checkDate.getDay() === 6) {
      checkDate.setDate(checkDate.getDate() + 1);
      continue;
    }
    const dateStr = checkDate.toISOString().split('T')[0];
    const dayBatches = existingBatches.filter(b => b.machineId === machine.id && b.scheduledDate === dateStr);
    const dayUsedTime = dayBatches.reduce((sum, b) => sum + b.totalTime, 0);
    if (dayUsedTime + requiredMinutes <= dailyCapacity) {
      return dateStr;
    }
    checkDate.setDate(checkDate.getDate() + 1);
  }
  return new Date().toISOString().split('T')[0];
};
