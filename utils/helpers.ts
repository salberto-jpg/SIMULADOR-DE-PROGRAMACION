
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
    turnTime = 0,
    rotateTime = 0,
    useCraneTurn = false,
    useCraneRotate = false,
    requiresToolChange = false
  } = batch;

  // Use machine default if batch value is zero or not provided
  const baseManualTurn = machine.manualTurnTime || 0.05;
  const baseManualRotate = machine.manualRotateTime || 0.05;

  const effectiveTurnTime = useCraneTurn ? machine.craneTurnTime : (turnTime || baseManualTurn);
  const effectiveRotateTime = useCraneRotate ? machine.craneRotateTime : (rotateTime || baseManualRotate);
  
  const setupTime = requiresToolChange ? machine.toolChangeTime : 0;
  const trammingTime = requiresToolChange ? (trams * machine.tramTime) : 0;
  
  // operationPerPiece = sum of individual steps in minutes
  const operationPerPiece = strikesPerPiece * (machine.strikeTime + effectiveTurnTime + effectiveRotateTime);
  
  const baseTotal = setupTime + trammingTime + (operationPerPiece * pieces);
  const finalTime = baseTotal / (machine.efficiency / 100);
  
  return finalTime;
};

export const findAvailableDate = (
  machine: MachineConfig, 
  requiredMinutes: number, 
  existingBatches: Batch[]
): string => {
  let checkDate = new Date();
  const dailyCapacity = machine.productiveHours * 60; // Capacity in minutes

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

export const downloadCSV = (data: any[], filename: string) => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(',')).join('\n');
  const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
