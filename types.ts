
export interface MachineConfig {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  strikeTime: number; // minutes
  toolChangeTime: number; // minutes
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
  turnTime: number; // minutes (override)
  rotateTime: number; // minutes (override)
  useCraneTurn: boolean;
  useCraneRotate: boolean;
  requiresToolChange: boolean;
  totalTime: number; // calculated minutes
  scheduledDate: string; // YYYY-MM-DD
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
  value: number; // in minutes (converted from stopwatch seconds)
  timestamp: string;
}

export interface AppState {
  machines: MachineConfig[];
  batches: Batch[];
}
