
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
    trams = 1,
    toolChanges = 1,
    useCraneTurn = false,
    turnQuantity = 1,
    useCraneRotate = false,
    rotateQuantity = 1,
    requiresToolChange = false
  } = batch;

  // Tiempos base de máquina
  const strike = machine.strikeTime || 0.005;
  const toolUnit = machine.toolChangeTime || 5;
  const setupUnit = machine.setupTime || 10;
  const measureUnit = machine.measurementTime || 0.5;
  
  // Lógica de maniobras
  const manualTurn = machine.manualTurnTime || 0.05;
  const manualRotate = machine.manualRotateTime || 0.05;

  const totalTurnTime = useCraneTurn 
    ? (machine.craneTurnTime * turnQuantity) 
    : manualTurn;

  const totalRotateTime = useCraneRotate 
    ? (machine.craneRotateTime * rotateQuantity) 
    : manualRotate;
  
  // 1. Puesta a Punto e infraestructura (Solo si requiere cambio de herramental)
  const totalSetup = requiresToolChange ? (setupUnit * toolChanges) : 0;
  const techTime = requiresToolChange 
    ? ((toolChanges * toolUnit) + (trams * (machine.tramTime || 3))) 
    : 0;
  
  // 2. Operación neta (Golpes + Maniobras sumadas por pieza)
  const operationPerPiece = (strikesPerPiece * strike) + totalTurnTime + totalRotateTime;
  const totalOp = operationPerPiece * pieces;

  // 3. Medición periódica (cada 10 piezas)
  const numChecks = pieces > 0 ? Math.floor((pieces - 1) / 10) + 1 : 0;
  const checkTime = measureUnit * (strikesPerPiece + 1);
  const totalMeasure = checkTime * numChecks;
  
  const rawTotal = totalSetup + techTime + totalOp + totalMeasure;
  return rawTotal / ((machine.efficiency || 100) / 100);
};
