
export interface MachineConfig {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  strikeTime: number; // minutes
  toolChangeTime: number; // minutes
  setupTime: number; // minutes (Puesta a punto)
  measurementTime: number; // minutes (Tiempo de medición por ángulo)
  tramTime: number; // minutes per tram
  craneTurnTime: number; // minutes (bridge crane)
  craneRotateTime: number; // minutes (bridge crane)
  manualTurnTime: number; // minutes (manual handling)
  manualRotateTime: number; // minutes (manual handling)
  efficiency: number; // percentage
  productiveHours: number; // hours per day
}

export interface Batch {
  id: string;
  name: string;
  machineId: string;
  pieces: number;
  strikesPerPiece: number;
  trams: number;
  toolChanges: number; 
  // Overrides para el lote específico
  strikeTime?: number;
  toolChangeTime?: number;
  tramTime?: number;
  setupTime?: number;
  measurementTime?: number;
  turnTime?: number; // Manual turn override
  rotateTime?: number; // Manual rotate override
  craneTurnTime?: number; // Crane turn override
  craneRotateTime?: number; // Crane rotate override
  
  useCraneTurn: boolean;
  useCraneRotate: boolean;
  requiresToolChange: boolean;
  totalTime: number;
  scheduledDate: string;
  notes: string;
}

export interface DailySchedule {
  date: string;
  batches: Batch[];
  totalTime: number;
  capacityPercentage: number;
}

export interface TimeRecord {
  id: string;
  machineId: string;
  parameter: keyof MachineConfig;
  value: number;
  timestamp: string;
}
