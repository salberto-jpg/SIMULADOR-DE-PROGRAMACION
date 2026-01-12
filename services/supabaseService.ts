
import { createClient } from '@supabase/supabase-js';
import { MachineConfig, Batch, TimeRecord, Tool, Thickness } from '../types';

let supabase: any = null;
let isCloudAvailable = false;

export const initSupabase = (url: string, key: string) => {
  if (url && url.startsWith('https://') && key && key.length > 20) {
    try {
      supabase = createClient(url, key);
      isCloudAvailable = true;
      console.log("Supabase inicializado correctamente.");
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
  return client.channel(`public-${table}`).on('postgres_changes', { event: '*', schema: 'public', table: table }, callback).subscribe();
};

export const fetchTools = async (): Promise<Tool[]> => {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client.from('tools').select('*');
  if (error) { console.error("Error fetchTools:", error.message); return []; }
  return data.map((t: any) => ({
    id: t.id, name: t.name, type: t.type, vWidth: t.v_width, angle: t.angle,
    maxTons: t.max_tons, length: t.length, compatibleMachineIds: t.compatible_machine_ids || []
  }));
};

export const saveTool = async (tool: Tool) => {
  const client = getClient();
  if (!client) return;
  const { error } = await client.from('tools').upsert({
    id: tool.id, name: tool.name, type: tool.type, v_width: tool.vWidth, angle: tool.angle,
    max_tons: tool.maxTons, length: tool.length, compatible_machine_ids: tool.compatibleMachineIds
  });
  if (error) console.error("Error saveTool:", error.message);
};

export const deleteTool = async (id: string) => {
  const client = getClient();
  if (!client) return;
  const { error } = await client.from('tools').delete().eq('id', id);
  if (error) console.error("Error deleteTool:", error.message);
};

export const fetchThicknesses = async (): Promise<Thickness[]> => {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client.from('thicknesses').select('*');
  if (error) { console.error("Error fetchThicknesses:", error.message); return []; }
  return data.map((t: any) => ({
    id: t.id, value: t.value, material: t.material, recommendedToolIds: t.recommended_tool_ids || []
  }));
};

export const saveThickness = async (th: Thickness) => {
  const client = getClient();
  if (!client) return;
  const { error } = await client.from('thicknesses').upsert({
    id: th.id, value: th.value, material: th.material, recommended_tool_ids: th.recommendedToolIds
  });
  if (error) console.error("Error saveThickness:", error.message);
};

export const deleteThickness = async (id: string) => {
  const client = getClient();
  if (!client) return;
  const { error } = await client.from('thicknesses').delete().eq('id', id);
  if (error) console.error("Error deleteThickness:", error.message);
};

export const fetchMachines = async (): Promise<MachineConfig[]> => {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client.from('machines').select('*');
  if (error) { console.error("Error fetchMachines:", error.message); return []; }
  return (data || []).map((m: any) => ({
    id: m.id, name: m.name || '', description: m.description || '',
    strikeTime: m.strike_time || 0.005, toolChangeTime: m.tool_change_time || 5,
    setupTime: m.setup_time || 10, measurementTime: m.measurement_time || 0.5,
    tramTime: m.tram_time || 3, craneTurnTime: m.crane_turn_time || 1,
    craneRotateTime: m.crane_rotate_time || 1, manualTurnTime: m.manual_turn_time || 0.05,
    manualRotateTime: m.manual_rotate_time || 0.05, efficiency: m.efficiency || 100,
    productiveHours: m.productive_hours || 16, maxLength: m.max_length || 3000,
    maxTons: m.max_tons || 100, compatibleToolIds: m.compatible_tool_ids || []
  }));
};

export const fetchBatches = async (): Promise<Batch[]> => {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client.from('batches').select('*');
  if (error) { console.error("Error fetchBatches:", error.message); return []; }
  return (data || []).map((b: any) => ({
    ...b,
    machineId: b.machine_id, strikesPerPiece: b.strikes_per_piece,
    toolChanges: b.tool_changes, scheduledDate: b.scheduled_date,
    totalTime: b.total_time, deliveryDate: b.delivery_date || b.scheduled_date,
    useCraneTurn: b.use_crane_turn, turnQuantity: b.turn_quantity || 1,
    useCraneRotate: b.use_crane_rotate, rotate_quantity: b.rotate_quantity || 1,
    toolIds: b.tool_ids || [], priority: b.priority || 'medium',
    width: b.width || 100, requiresToolChange: b.requires_tool_change
  }));
};

export const fetchTimeRecords = async (): Promise<TimeRecord[]> => {
  const client = getClient();
  if (!client) return [];
  // Se cambia 'time_records' por 'time_study' según la base de datos real
  const { data, error } = await client.from('time_study').select('*').order('timestamp', { ascending: false });
  if (error) { console.error("Error fetchTimeRecords:", error.message); return []; }
  return data.map((r: any) => ({
    id: r.id, 
    machineId: r.machine_id, 
    parameter: r.type, // 'type' en la DB mapea a 'parameter' en la app
    value: r.observed_time, // 'observed_time' en la DB mapea a 'value' en la app
    timestamp: r.timestamp
  }));
};

export const syncAppData = async (machines: MachineConfig[], batches: Batch[]) => {
  const client = getClient();
  if (!client) return;
  
  if (machines.length) {
    const mPayload = machines.map(m => ({
      id: m.id, 
      name: m.name || '', 
      description: m.description || '', 
      strike_time: m.strikeTime || 0,
      tool_change_time: m.toolChangeTime || 0, 
      setup_time: m.setupTime || 0, 
      measurement_time: m.measurementTime || 0,
      tram_time: m.tramTime || 0, 
      crane_turn_time: m.craneTurnTime || 0, 
      crane_rotate_time: m.crane_rotate_time || 0,
      manual_turn_time: m.manualTurnTime || 0, 
      manual_rotate_time: m.manualRotateTime || 0,
      efficiency: m.efficiency || 100, 
      productive_hours: m.productiveHours || 16,
      max_length: m.maxLength || 3000, 
      max_tons: m.maxTons || 100, 
      compatible_tool_ids: m.compatibleToolIds || []
    }));
    const { error } = await client.from('machines').upsert(mPayload);
    if (error) console.error("Error syncing machines:", error.message, error.details);
  }

  if (batches.length) {
    const bPayload = batches.map(b => ({
      id: b.id, name: b.name, machine_id: b.machineId, pieces: b.pieces,
      strikes_per_piece: b.strikesPerPiece, trams: b.trams, tool_changes: b.toolChanges,
      thickness: b.thickness, length: b.length, width: b.width, delivery_date: b.deliveryDate,
      // Fix: Changed incorrect property access b.total_time to b.totalTime to match Batch interface.
      total_time: b.totalTime, scheduled_date: b.scheduledDate, notes: b.notes,
      priority: b.priority, use_crane_turn: b.useCraneTurn, turn_quantity: b.turnQuantity,
      use_crane_rotate: b.useCraneRotate, rotate_quantity: b.rotateQuantity,
      tool_ids: b.toolIds, requires_tool_change: b.requiresToolChange
    }));
    const { error } = await client.from('batches').upsert(bPayload);
    if (error) console.error("Error syncing batches:", error.message, error.details);
  }
};

export const deleteBatchFromCloud = async (id: string) => {
  const client = getClient();
  if (client) {
    const { error } = await client.from('batches').delete().eq('id', id);
    if (error) console.error("Error deleteBatch:", error.message);
  }
};

export const saveTimeRecord = async (record: TimeRecord) => {
  const client = getClient();
  if (!client) return;
  // Se adapta a la estructura de la tabla 'time_study'
  const { error } = await client.from('time_study').insert([{
    machine_id: record.machineId,
    type: record.parameter,
    observed_time: record.value,
    timestamp: record.timestamp,
    operator_notes: "Stopwatch Capture"
  }]);
  if (error) console.error("Error saveTimeRecord:", error.message);
};
