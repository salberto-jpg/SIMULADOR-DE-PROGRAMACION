
import { MachineConfig, Batch } from "../types";

export const formatTime = (totalMinutes: number): string => {
  if (isNaN(totalMinutes) || totalMinutes < 0) return "00:00:00";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  const seconds = Math.round((totalMinutes * 60) % 60);
  
  // Ajuste por si el redondeo de segundos llega a 60
  if (seconds === 60) {
      return formatTime(totalMinutes + 1/60 - seconds/3600);
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(p => parseInt(p, 10) || 0);
  let h = 0, m = 0, s = 0;
  
  if (parts.length === 3) {
    [h, m, s] = parts;
  } else if (parts.length === 2) {
    [m, s] = parts;
  } else if (parts.length === 1) {
    [s] = parts;
  }
  
  return (h * 60) + m + (s / 60);
};

export const calculateBatchTime = (batch: Partial<Batch>, machine: MachineConfig): number => {
  const {
    pieces = 0,
    strikesPerPiece = 0,
    trams = 1,
    toolChanges = 1,
    useCraneTurn = false,
    turnQuantity = 1,
    useCraneRotate = false,
    rotateQuantity = 1,
    requiresToolChange = false
  } = batch;

  const strike = machine.strikeTime || 0.005;
  const toolUnit = machine.toolChangeTime || 5;
  const setupUnit = machine.setupTime || 10;
  const measureUnit = machine.measurementTime || 0.5;
  
  const manualTurn = machine.manualTurnTime || 0.05;
  const manualRotate = machine.manualRotateTime || 0.05;

  const totalTurnTime = useCraneTurn 
    ? (machine.craneTurnTime * turnQuantity) 
    : manualTurn;

  const totalRotateTime = useCraneRotate 
    ? (machine.craneRotateTime * rotateQuantity) 
    : manualRotate;
  
  const totalSetup = requiresToolChange ? (setupUnit * toolChanges) : 0;
  const techTime = requiresToolChange 
    ? ((toolChanges * toolUnit) + (trams * (machine.tramTime || 3))) 
    : 0;
  
  const operationPerPiece = (strikesPerPiece * strike) + totalTurnTime + totalRotateTime;
  const totalOp = operationPerPiece * pieces;

  const numChecks = pieces > 0 ? Math.floor((pieces - 1) / 10) + 1 : 0;
  const checkTime = measureUnit * (strikesPerPiece + 1);
  const totalMeasure = checkTime * numChecks;
  
  const rawTotal = totalSetup + techTime + totalOp + totalMeasure;
  return rawTotal / ((machine.efficiency || 100) / 100);
};
