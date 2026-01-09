
import { MachineConfig } from './types';

export const INITIAL_MACHINES: MachineConfig[] = [
  {
    id: "PL-01",
    name: "Plegadora 60T x 2.5m",
    description: "Ideal: Piezas pequeñas/medianas",
    imageUrl: "https://images.unsplash.com/photo-1537462715879-360eeb61a0ad?auto=format&fit=crop&q=80&w=400",
    strikeTime: 0.005, // 0.3s
    toolChangeTime: 5,
    tramTime: 3,
    craneTurnTime: 1,
    craneRotateTime: 1,
    manualTurnTime: 0.05,
    manualRotateTime: 0.05,
    efficiency: 100,
    productiveHours: 16
  },
  {
    id: "PL-02",
    name: "Plegadora 150T x 3m",
    description: "Ideal: Máquina versátil",
    imageUrl: "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&q=80&w=400",
    strikeTime: 0.006,
    toolChangeTime: 6,
    tramTime: 3.5,
    craneTurnTime: 1.2,
    craneRotateTime: 1.2,
    manualTurnTime: 0.08,
    manualRotateTime: 0.08,
    efficiency: 100,
    productiveHours: 16
  },
  {
    id: "PL-03",
    name: "Plegadora 220T x 4m",
    description: "Ideal: Piezas grandes/gruesas",
    imageUrl: "https://images.unsplash.com/photo-1565439397619-3836d1f9260d?auto=format&fit=crop&q=80&w=400",
    strikeTime: 0.008,
    toolChangeTime: 7.5,
    tramTime: 4,
    craneTurnTime: 1.5,
    craneRotateTime: 1.5,
    manualTurnTime: 0.12,
    manualRotateTime: 0.12,
    efficiency: 100,
    productiveHours: 16
  }
];

export const STORAGE_KEYS = {
  CONFIG: 'metallo_config_v3',
  BATCHES: 'metallo_batches_v3',
  RECORDS: 'metallo_time_records_v3',
  CLOUD_URL: 'metallo_supabase_url',
  CLOUD_KEY: 'metallo_supabase_key'
};
