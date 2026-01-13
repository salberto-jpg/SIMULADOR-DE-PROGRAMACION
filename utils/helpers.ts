
import { MachineConfig, Batch } from "../types";

export const formatTime = (totalMinutes: number): string => {
  if (isNaN(totalMinutes) || totalMinutes < 0) return "00:00:00";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  const seconds = Math.round((totalMinutes * 60) % 60);
  
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
    turnQuantity = 0,
    useCraneRotate = false,
    rotateQuantity = 0,
    requiresToolChange = false
  } = batch;

  const strike = machine.strikeTime || 0.005;
  const toolUnit = machine.toolChangeTime || 5;
  const setupUnit = machine.setupTime || 10;
  const measureUnit = machine.measurementTime || 0.5;
  
  const manualTurnUnit = machine.manualTurnTime || 0.05;
  const manualRotateUnit = machine.manualRotateTime || 0.05;
  const craneTurnUnit = machine.craneTurnTime || 1;
  const craneRotateUnit = machine.craneRotateTime || 1;

  const turnUnit = useCraneTurn ? craneTurnUnit : manualTurnUnit;
  const totalTurnTime = turnUnit * turnQuantity;

  const rotateUnit = useCraneRotate ? craneRotateUnit : manualRotateUnit;
  const totalRotateTime = rotateUnit * rotateQuantity;
  
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

/**
 * Divide los lotes en "rebanadas" diarias según la capacidad productiva de la máquina.
 */
export interface BatchSlice {
  batch: Batch;
  date: string;
  timeInDay: number;
  isContinuation: boolean;
  hasMore: boolean;
}

export const getMachineTimelineSlices = (machine: MachineConfig, allBatches: Batch[]): BatchSlice[] => {
  const machineBatches = allBatches
    .filter(b => b.machineId === machine.id)
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

  const slices: BatchSlice[] = [];
  const dailyCapacity = (machine.productiveHours || 16) * 60;
  
  // Mapa para rastrear el tiempo usado por día
  const dailyTimeUsed: Record<string, number> = {};

  machineBatches.forEach(batch => {
    let remainingTime = batch.totalTime;
    let currentDateStr = batch.scheduledDate;
    let isContinuation = false;

    while (remainingTime > 0) {
      if (!dailyTimeUsed[currentDateStr]) dailyTimeUsed[currentDateStr] = 0;
      
      const capacityLeft = dailyCapacity - dailyTimeUsed[currentDateStr];
      
      if (capacityLeft <= 0) {
        // Si el día está lleno, pasar al siguiente día
        const nextDate = new Date(currentDateStr);
        nextDate.setDate(nextDate.getDate() + 1);
        currentDateStr = nextDate.toISOString().split('T')[0];
        continue;
      }

      const timeToUse = Math.min(remainingTime, capacityLeft);
      remainingTime -= timeToUse;
      dailyTimeUsed[currentDateStr] += timeToUse;

      slices.push({
        batch,
        date: currentDateStr,
        timeInDay: timeToUse,
        isContinuation,
        hasMore: remainingTime > 0
      });

      if (remainingTime > 0) {
        isContinuation = true;
        const nextDate = new Date(currentDateStr);
        nextDate.setDate(nextDate.getDate() + 1);
        currentDateStr = nextDate.toISOString().split('T')[0];
      }
    }
  });

  return slices;
};
