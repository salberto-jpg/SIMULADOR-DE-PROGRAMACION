
import { createClient } from '@supabase/supabase-js';
import { MachineConfig, Batch, TimeRecord, Tool, Thickness } from '../types';

let supabase: any = null;
let isCloudAvailable = false;
let lastError: string | null = null;

export const initSupabase = (url: string, key: string) => {
  if (url && url.startsWith('https://') && key && key.length > 20) {
    try {
      supabase = createClient(url, key);
      isCloudAvailable = true;
      return true;
    } catch (e) {
      lastError = "Fallo crítico inicialización";
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
  if (error) return [];
  return data.map((t: any) => ({
    id: t.id, name: t.name, type: t.type, vWidth: t.v_width, angle: t.angle,
    maxTons: t.max_tons, length: t.length, compatibleMachineIds: t.compatible_machine_ids || []
  }));
};

export const saveTool = async (tool: Tool) => {
  const client = getClient();
  if (!client) return;
  const payload = {
    id: tool.id, name: tool.name, type: tool.type, v_width: tool.vWidth, angle: tool.angle,
    max_tons: tool.maxTons, length: tool.length, compatible_machine_ids: tool.compatibleMachineIds
  };
  await client.from('tools').upsert(payload);
};

export const deleteTool = async (id: string) => {
  const client = getClient();
  if (!client) return;
  await client.from('tools').delete().eq('id', id);
};

export const fetchThicknesses = async (): Promise<Thickness[]> => {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client.from('thicknesses').select('*');
  if (error) return [];
  return data.map((t: any) => ({
    id: t.id, value: t.value, material: t.material, recommendedToolIds: t.recommended_tool_ids || []
  }));
};

export const saveThickness = async (th: Thickness) => {
  const client = getClient();
  if (!client) return;
  const payload = {
    id: th.id, value: th.value, material: th.material, recommended_tool_ids: th.recommendedToolIds
  };
  await client.from('thicknesses').upsert(payload);
};

export const deleteThickness = async (id: string) => {
  const client = getClient();
  if (!client) return;
  await client.from('thicknesses').delete().eq('id', id);
};

export const fetchMachines = async (): Promise<MachineConfig[]> => {
  const client = getClient();
  if (!client) return [];
  const { data } = await client.from('machines').select('*');
  return (data || []).map((m: any) => ({
    id: m.id, name: m.name, description: m.description,
    strikeTime: m.strike_time, toolChangeTime: m.tool_change_time,
    setupTime: m.setup_time, measurementTime: m.measurement_time,
    tramTime: m.tram_time, craneTurnTime: m.crane_turn_time,
    craneRotateTime: m.crane_rotate_time, manualTurnTime: m.manual_turn_time,
    manualRotateTime: m.manual_rotate_time, efficiency: m.efficiency,
    productiveHours: m.productive_hours, maxLength: m.max_length || 3000,
    maxTons: m.max_tons || 100, compatibleToolIds: m.compatible_tool_ids || []
  }));
};

export const fetchBatches = async (): Promise<Batch[]> => {
  const client = getClient();
  if (!client) return [];
  const { data } = await client.from('batches').select('*');
  return (data || []).map((b: any) => ({
    ...b,
    machineId: b.machine_id, strikesPerPiece: b.strikes_per_piece,
    toolChanges: b.tool_changes, scheduledDate: b.scheduled_date,
    totalTime: b.total_time, deliveryDate: b.delivery_date || b.scheduled_date,
    useCraneTurn: b.use_crane_turn, turnQuantity: b.turn_quantity || 1,
    useCraneRotate: b.use_crane_rotate, rotateQuantity: b.rotate_quantity || 1,
    toolIds: b.tool_ids || [], priority: b.priority || 'medium',
    width: b.width || 100, requiresToolChange: b.requires_tool_change
  }));
};

export const syncAppData = async (machines: MachineConfig[], batches: Batch[]) => {
  const client = getClient();
  if (!client) return;
  
  if (machines.length) {
    const mPayload = machines.map(m => ({
      id: m.id, name: m.name, description: m.description, strike_time: m.strikeTime,
      tool_change_time: m.toolChangeTime, setup_time: m.setupTime, measurement_time: m.measurementTime,
      tram_time: m.tramTime, crane_turn_time: m.craneTurnTime, crane_rotate_time: m.craneRotateTime,
      manual_turn_time: m.manualTurnTime, manual_rotate_time: m.manualRotateTime,
      efficiency: m.efficiency, productive_hours: m.productiveHours,
      max_length: m.maxLength, max_tons: m.maxTons, compatible_tool_ids: m.compatibleToolIds
    }));
    await client.from('machines').upsert(mPayload);
  }

  if (batches.length) {
    const bPayload = batches.map(b => ({
      id: b.id, name: b.name, machine_id: b.machineId, pieces: b.pieces,
      strikes_per_piece: b.strikesPerPiece, trams: b.trams, tool_changes: b.toolChanges,
      thickness: b.thickness, length: b.length, width: b.width, delivery_date: b.deliveryDate,
      total_time: b.totalTime, scheduled_date: b.scheduledDate, notes: b.notes,
      priority: b.priority, use_crane_turn: b.useCraneTurn, turn_quantity: b.turnQuantity,
      use_crane_rotate: b.useCraneRotate, rotate_quantity: b.rotateQuantity,
      tool_ids: b.toolIds, requires_tool_change: b.requiresToolChange
    }));
    await client.from('batches').upsert(bPayload);
  }
};

export const deleteBatchFromCloud = async (id: string) => {
  const client = getClient();
  if (client) await client.from('batches').delete().eq('id', id);
};

export const saveTimeRecord = async (record: TimeRecord) => {
  const client = getClient();
  if (!client) return;
  await client.from('time_records').insert([{
    id: record.id, machine_id: record.machineId, parameter: record.parameter,
    value: record.value, timestamp: record.timestamp
  }]);
};
