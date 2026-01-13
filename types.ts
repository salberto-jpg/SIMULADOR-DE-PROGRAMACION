
export interface Thickness {
  id: string;
  value: number; // mm
  material: string;
  recommendedToolIds: string[];
  compatibleMachineIds: string[]; // Nueva relación
}

export interface Tool {
  id: string;
  name: string;
  type: 'punch' | 'die';
  vWidth?: number; // solo para matrices
  angle: number;
  maxTons: number;
  length: number;
  compatibleMachineIds: string[];
}

export interface MachineConfig {
  id: string;
  name: string;
  description: string;
  strikeTime: number;
  toolChangeTime: number;
  setupTime: number;
  measurementTime: number;
  tramTime: number;
  craneTurnTime: number;
  craneRotateTime: number;
  manualTurnTime: number;
  manualRotateTime: number;
  efficiency: number;
  productiveHours: number;
  maxLength: number; // mm
  maxTons: number;
  compatibleToolIds: string[];
}

export interface Batch {
  id: string;
  name: string;
  machineId: string;
  pieces: number;
  strikesPerPiece: number;
  trams: number;
  toolChanges: number;
  thickness: number;
  length: number;
  width: number;
  deliveryDate: string;
  toolIds: string[];
  
  useCraneTurn: boolean;
  turnQuantity: number;
  useCraneRotate: boolean;
  rotateQuantity: number;
  
  requiresToolChange: boolean;
  totalTime: number;
  scheduledDate: string;
  notes: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isSimulation?: boolean; 
  imageUrl?: string; // Foto de la pieza
}

export interface TimeRecord {
  id: string;
  machineId: string;
  parameter: keyof MachineConfig | 'totalTime';
  value: number;
  timestamp: string;
}
