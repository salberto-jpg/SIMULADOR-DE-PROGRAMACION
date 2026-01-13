
import { MachineConfig } from './types';

export const INITIAL_MACHINES: MachineConfig[] = [
  {
    id: "PL-01",
    name: "Plegadora 60T x 2.5m",
    description: "Ideal: Piezas pequeñas/medianas",
    strikeTime: 0.005,
    toolChangeTime: 5,
    setupTime: 10,
    measurementTime: 0.5,
    tramTime: 3,
    craneTurnTime: 1,
    craneRotateTime: 1,
    manualTurnTime: 0.05,
    manualRotateTime: 0.05,
    efficiency: 100,
    productiveHours: 16,
    maxLength: 2500,
    maxTons: 60,
    compatibleToolIds: []
  },
  {
    id: "PL-02",
    name: "Plegadora 150T x 3m",
    description: "Ideal: Máquina versátil",
    strikeTime: 0.006,
    toolChangeTime: 6,
    setupTime: 12,
    measurementTime: 0.7,
    tramTime: 3.5,
    craneTurnTime: 1.2,
    craneRotateTime: 1.2,
    manualTurnTime: 0.08,
    manualRotateTime: 0.08,
    efficiency: 100,
    productiveHours: 16,
    maxLength: 3000,
    maxTons: 150,
    compatibleToolIds: []
  },
  {
    id: "PL-03",
    name: "Plegadora 220T x 4m",
    description: "Ideal: Piezas grandes/gruesas",
    strikeTime: 0.008,
    toolChangeTime: 7.5,
    setupTime: 15,
    measurementTime: 1.0,
    tramTime: 4,
    craneTurnTime: 1.5,
    craneRotateTime: 1.5,
    manualTurnTime: 0.12,
    manualRotateTime: 0.12,
    efficiency: 100,
    productiveHours: 16,
    maxLength: 4000,
    maxTons: 220,
    compatibleToolIds: []
  }
];

export const STORAGE_KEYS = {
  CONFIG: 'metallo_config_v4',
  BATCHES: 'metallo_batches_v4',
  RECORDS: 'metallo_time_records_v4',
  CLOUD_URL: 'metallo_supabase_url',
  CLOUD_KEY: 'metallo_supabase_key'
};
