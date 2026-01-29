
import { createClient } from '@supabase/supabase-js';
import { MachineConfig, Batch, TimeRecord, Tool, Thickness } from '../types';
import { INITIAL_MACHINES } from '../constants';

let supabase: any = null;
let isCloudAvailable = false;

export const initSupabase = (url: string, key: string) => {
  if (url && url.startsWith('https://') && key && key.length > 20) {
    try {
      if (!supabase) {
        supabase = createClient(url, key, {
          auth: { persistSession: false },
          realtime: {
            params: {
              eventsPerSecond: 20
            }
          }
        });
      }
      isCloudAvailable = true;
      return true;
    } catch (e) {
      console.error("Error inicializando Supabase:", e);
    }
  }
  return false;
};

const getClient = () => isCloudAvailable ? supabase : null;

export const subscribeToChanges = (table: string, callback: (payload: any) => void) => {
  const client = getClient();
  if (!client) return null;
  return client
    .channel(`realtime-${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: table }, (payload: any) => {
      callback(payload);
    })
    .subscribe();
};

// --- MAPEADORES DE BD A APP ---

export const mapDbBatchToApp = (b: any): Batch => {
  let extended: any = { isSimulation: b.name?.startsWith('[SIM]') };
  try {
    if (b.notes) {
      const parsed = typeof b.notes === 'string' ? JSON.parse(b.notes) : b.notes;
      extended = { ...extended, ...parsed };
    }
  } catch (e) {}
  const cleanName = extended.isSimulation ? b.name.replace('[SIM] ', '') : b.name;
  return {
    id: b.id,
    name: cleanName || 'Sin Nombre',
    machineId: b.machine_id,
    pieces: Number(b.pieces) || 0,
    strikesPerPiece: Number(b.strikes_per_piece) || 0,
    totalTime: Number(b.total_time) || 0,
    scheduledDate: b.scheduled_date,
    ...extended
  };
};

export const mapDbRecordToApp = (r: any): TimeRecord => ({
  id: String(r.id),
  machineId: r.machine_id,
  parameter: r.type,
  value: Number(r.observed_time) || 0,
  timestamp: r.timestamp,
  length: r.length ? Number(r.length) : undefined
});

export const mapDbToolToApp = (t: any): Tool => ({
  id: t.id,
  name: t.name || 'Sin Nombre',
  type: t.type || 'punch',
  vWidth: t.v_width || 0,
  angle: Number(t.angle) || 0,
  maxTons: Number(t.max_tons) || 0,
  length: Number(t.length) || 0,
  compatibleMachineIds: t.compatible_machine_ids || []
});

export const mapDbThicknessToApp = (t: any): Thickness => ({
  id: t.id,
  value: Number(t.value) || 0,
  material: t.material || '',
  recommendedToolIds: t.recommended_tool_ids || [],
  compatibleMachineIds: t.compatible_machine_ids || []
});

export const mapDbMachineToApp = (m: any): MachineConfig => {
  const defaultConfig = INITIAL_MACHINES.find(im => im.id === m.id) || INITIAL_MACHINES[0];
  let techData: any = {};
  try {
    if (m.description && m.description.startsWith('{')) {
      techData = JSON.parse(m.description);
    }
  } catch (e) {}
  return { ...defaultConfig, ...techData, id: m.id, name: m.name || defaultConfig.name } as MachineConfig;
};

// --- OPERACIONES DE PERSISTENCIA ---

export const saveBatch = async (batch: Batch) => {
  const client = getClient();
  if (!client) throw new Error("Cloud no disponible");
  const isSim = !!batch.isSimulation;
  const payload = {
    id: batch.id, 
    name: isSim ? `[SIM] ${batch.name}` : batch.name, 
    machine_id: batch.machineId, 
    pieces: batch.pieces,
    strikes_per_piece: batch.strikesPerPiece, 
    total_time: batch.totalTime, 
    scheduled_date: batch.scheduledDate, 
    notes: { ...batch, isSimulation: isSim }
  };
  await client.from('batches').upsert(payload);
};

export const saveMachine = async (m: MachineConfig) => {
  const client = getClient();
  if (!client) throw new Error("Cloud no disponible");
  const techData = {
    strikeTime: m.strikeTime, toolChangeTime: m.toolChangeTime,
    setupTime: m.setupTime, measurementTime: m.measurementTime,
    tramTime: m.tramTime, craneTurnTime: m.craneTurnTime,
    craneRotateTime: m.craneRotateTime, manualTurnTime: m.manualTurnTime,
    manualRotateTime: m.manualRotateTime, efficiency: m.efficiency,
    productiveHours: m.productiveHours, maxLength: m.maxLength,
    maxTons: m.maxTons, compatibleToolIds: m.compatibleToolIds
  };
  await client.from('machines').upsert({ id: m.id, name: m.name, description: JSON.stringify(techData) });
};

export const saveTimeRecord = async (record: TimeRecord) => {
  const client = getClient();
  if (!client) return;
  await client.from('time_study').insert([{
    machine_id: record.machineId,
    type: record.parameter,
    observed_time: record.value,
    timestamp: record.timestamp,
    operator_notes: "Real-time Capture",
    length: record.length 
  }]);
};

export const deleteBatchFromCloud = async (id: string) => {
  const client = getClient();
  if (client) await client.from('batches').delete().eq('id', id);
};

export const saveTool = async (tool: Tool) => {
  const client = getClient();
  if (!client) return;
  await client.from('tools').upsert({
    id: tool.id, name: tool.name, type: tool.type, v_width: tool.vWidth, 
    angle: tool.angle, max_tons: tool.maxTons, length: tool.length,
    compatible_machine_ids: tool.compatibleMachineIds
  });
};

export const deleteTool = async (id: string) => {
  const client = getClient();
  if (client) await client.from('tools').delete().eq('id', id);
};

export const saveThickness = async (th: Thickness) => {
  const client = getClient();
  if (!client) return;
  await client.from('thicknesses').upsert({ 
    id: th.id, value: th.value, material: th.material, 
    recommended_tool_ids: th.recommendedToolIds, compatible_machine_ids: th.compatibleMachineIds 
  });
};

export const deleteThickness = async (id: string) => {
  const client = getClient();
  if (client) await client.from('thicknesses').delete().eq('id', id);
};

// --- FETCHERS INICIALES ---

export const fetchBatches = async () => (await getClient()?.from('batches').select('*'))?.data?.map(mapDbBatchToApp) || [];
export const fetchMachines = async () => (await getClient()?.from('machines').select('*'))?.data?.map(mapDbMachineToApp) || [];
export const fetchTools = async () => (await getClient()?.from('tools').select('*'))?.data?.map(mapDbToolToApp) || [];
export const fetchThicknesses = async () => (await getClient()?.from('thicknesses').select('*'))?.data?.map(mapDbThicknessToApp) || [];
export const fetchTimeRecords = async () => (await getClient()?.from('time_study').select('*').order('timestamp', { ascending: false }).limit(100))?.data?.map(mapDbRecordToApp) || [];

export const syncAppData = async (machines: MachineConfig[], batches: Batch[]) => {
  await Promise.all([
    ...machines.map(m => saveMachine(m)),
    ...batches.map(b => saveBatch(b))
  ]);
};
