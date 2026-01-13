
import { MachineConfig, Batch } from "../types";

export const formatTime = (totalMinutes: number): string => {
  if (isNaN(totalMinutes) || totalMinutes < 0) return "00:00:00";
  
  const totalSeconds = Math.round(totalMinutes * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

export const parseTimeToMinutes = (timeStr: string): number => {
  if (!timeStr) return 0;
  // Soporta formatos H:M:S, M:S o solo S
  const parts = timeStr.split(':').map(p => parseFloat(p) || 0);
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

  // Se utiliza validación explícita para permitir que el tiempo sea 0
  const strike = machine.strikeTime !== undefined ? machine.strikeTime : 0.005;
  const toolUnit = machine.toolChangeTime !== undefined ? machine.toolChangeTime : 5;
  const setupUnit = machine.setupTime !== undefined ? machine.setupTime : 10;
  const measureUnit = machine.measurementTime !== undefined ? machine.measurementTime : 0.5;
  const tramUnit = machine.tramTime !== undefined ? machine.tramTime : 3;
  
  const manualTurnUnit = machine.manualTurnTime !== undefined ? machine.manualTurnTime : 0.05;
  const manualRotateUnit = machine.manualRotateTime !== undefined ? machine.manualRotateTime : 0.05;
  const craneTurnUnit = machine.craneTurnTime !== undefined ? machine.craneTurnTime : 1;
  const craneRotateUnit = machine.craneRotateTime !== undefined ? machine.craneRotateTime : 1;

  const turnUnit = useCraneTurn ? craneTurnUnit : manualTurnUnit;
  const totalTurnTime = turnUnit * turnQuantity;

  const rotateUnit = useCraneRotate ? craneRotateUnit : manualRotateUnit;
  const totalRotateTime = rotateUnit * rotateQuantity;
  
  const totalSetup = requiresToolChange ? (setupUnit * toolChanges) : 0;
  const techTime = requiresToolChange 
    ? ((toolChanges * toolUnit) + (trams * tramUnit)) 
    : 0;
  
  const operationPerPiece = (strikesPerPiece * strike) + totalTurnTime + totalRotateTime;
  const totalOp = operationPerPiece * pieces;

  const numChecks = pieces > 0 ? Math.floor((pieces - 1) / 10) + 1 : 0;
  const checkTime = measureUnit * (strikesPerPiece + 1);
  const totalMeasure = checkTime * numChecks;
  
  const rawTotal = totalSetup + techTime + totalOp + totalMeasure;
  const efficiencyFactor = (machine.efficiency || 100) / 100;
  
  return rawTotal / (efficiencyFactor > 0 ? efficiencyFactor : 1);
};

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
  const dailyTimeUsed: Record<string, number> = {};

  machineBatches.forEach(batch => {
    let remainingTime = batch.totalTime;
    let currentDateStr = batch.scheduledDate;
    let isContinuation = false;

    while (remainingTime > 0) {
      if (!dailyTimeUsed[currentDateStr]) dailyTimeUsed[currentDateStr] = 0;
      const capacityLeft = dailyCapacity - dailyTimeUsed[currentDateStr];
      
      if (capacityLeft <= 0) {
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
