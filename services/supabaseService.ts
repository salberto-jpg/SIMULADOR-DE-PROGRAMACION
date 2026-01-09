
import { createClient } from '@supabase/supabase-js';
import { MachineConfig, Batch, TimeRecord } from '../types';

let supabase: any = null;
let isCloudAvailable = false;
let lastError: string | null = null;

export const initSupabase = (url: string, key: string) => {
  supabase = null;
  isCloudAvailable = false;
  lastError = null;

  if (url && url.startsWith('https://') && key && key.length > 20) {
    try {
      supabase = createClient(url, key);
      isCloudAvailable = true;
      console.log("[METALLO NUBE]: Cliente inicializado.");
      return true;
    } catch (e) {
      lastError = "Fallo crítico inicialización";
      console.error("[METALLO NUBE ERROR]:", e);
    }
  }
  return false;
};

const getClient = () => {
  if (!isCloudAvailable) return null;
  return supabase;
};

const handleError = (error: any, context: string) => {
  if (!error) return;
  const msg = error.message || error.details || (typeof error === 'object' ? JSON.stringify(error) : String(error));
  const code = error.code || "ERR";
  lastError = `[${code}] en ${context}: ${msg}`;
  console.error(`[METALLO NUBE ERROR] ${lastError}`);
  if (msg.includes('Failed to fetch') || code === 'PGRST301' || msg.includes('endpoint')) {
    isCloudAvailable = false;
  }
};

export const checkCloudStatus = () => ({
  available: isCloudAvailable,
  error: lastError
});

export const fetchMachines = async (): Promise<MachineConfig[]> => {
  const client = getClient();
  if (!client) return [];
  try {
    const { data, error } = await client.from('machines').select('*');
    if (error) {
      handleError(error, "fetchMachines");
      return [];
    }
    return (data || []).map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      description: m.description || '',
      imageUrl: m.image_url || m.imageUrl || '',
      strikeTime: Number(m.strike_time || 0),
      toolChangeTime: Number(m.tool_change_time || 0),
      setupTime: Number(m.setup_time || 0),
      measurementTime: Number(m.measurement_time || 0),
      tramTime: Number(m.tram_time || 0),
      craneTurnTime: Number(m.crane_turn_time || 0),
      craneRotateTime: Number(m.crane_rotate_time || 0),
      manualTurnTime: Number(m.manual_turn_time || 0.05),
      manualRotateTime: Number(m.manual_rotate_time || 0.05),
      efficiency: Number(m.efficiency || 0),
      productiveHours: Number(m.productive_hours || 0)
    }));
  } catch (e: any) {
    handleError(e, "Excepción fetchMachines");
    return [];
  }
};

export const fetchBatches = async (): Promise<Batch[]> => {
  const client = getClient();
  if (!client) return [];
  try {
    const { data, error } = await client.from('batches').select('*');
    if (error) {
      handleError(error, "fetchBatches");
      return [];
    }
    return (data || []).map((b: any) => ({
      id: b.id,
      name: b.name || b.id,
      machineId: b.machine_id,
      pieces: Number(b.pieces || 0),
      strikesPerPiece: Number(b.strikes_per_piece || 0),
      trams: Number(b.trams || 0),
      toolChanges: Number(b.tool_changes || 1),
      strikeTime: b.strike_time ? Number(b.strike_time) : undefined,
      toolChangeTime: b.tool_change_time ? Number(b.tool_change_time) : undefined,
      tramTime: b.tram_time ? Number(b.tram_time) : undefined,
      turnTime: b.turn_time ? Number(b.turn_time) : undefined,
      rotateTime: b.rotate_time ? Number(b.rotate_time) : undefined,
      craneTurnTime: b.crane_turn_time ? Number(b.crane_turn_time) : undefined,
      craneRotateTime: b.crane_rotate_time ? Number(b.crane_rotate_time) : undefined,
      setupTime: b.setup_time ? Number(b.setup_time) : undefined,
      measurementTime: b.measurement_time ? Number(b.measurement_time) : undefined,
      useCraneTurn: b.use_crane_turn || false,
      useCraneRotate: b.use_crane_rotate || false,
      requiresToolChange: b.requires_tool_change || false,
      totalTime: Number(b.total_time || 0),
      scheduledDate: b.scheduled_date || new Date().toISOString().split('T')[0],
      notes: b.notes || ''
    }));
  } catch (e: any) {
    handleError(e, "Excepción fetchBatches");
    return [];
  }
};

export const fetchTimeRecords = async (): Promise<TimeRecord[]> => {
  const client = getClient();
  if (!client) return [];
  try {
    const { data, error } = await client.from('time_study').select('*').order('timestamp', { ascending: false });
    if (error) {
      handleError(error, "fetchTimeRecords");
      return [];
    }
    return (data || []).map((r: any) => ({
      id: r.id?.toString() || `r-${Math.random()}`,
      machineId: r.machine_id,
      parameter: r.type as keyof MachineConfig,
      value: Number(r.observed_time),
      timestamp: new Date(r.timestamp).toLocaleString()
    }));
  } catch (e) {
    handleError(e, "Excepción fetchTimeRecords");
    return [];
  }
};

export const syncAppData = async (machines: MachineConfig[], batches: Batch[]) => {
  const client = getClient();
  if (!client) throw new Error("Cloud no disponible");
  try {
    const machinePayload = machines.map(m => ({
      id: m.id,
      name: m.name,
      description: m.description,
      strike_time: m.strikeTime,
      tool_change_time: m.toolChangeTime,
      setup_time: m.setupTime,
      measurement_time: m.measurementTime,
      tram_time: m.tramTime,
      crane_turn_time: m.craneTurnTime,
      crane_rotate_time: m.craneRotateTime,
      efficiency: m.efficiency,
      productive_hours: m.productiveHours
    }));
    const { error: mError } = await client.from('machines').upsert(machinePayload, { onConflict: 'id' });
    if (mError) throw mError;

    if (batches.length > 0) {
      const batchPayload = batches.map(b => ({
        id: b.id,
        name: b.name,
        machine_id: b.machineId,
        pieces: b.pieces,
        strikes_per_piece: b.strikesPerPiece,
        trams: b.trams,
        tool_changes: b.toolChanges,
        strike_time: b.strikeTime,
        tool_change_time: b.toolChangeTime,
        tram_time: b.tramTime,
        turn_time: b.turnTime,
        rotate_time: b.rotateTime,
        crane_turn_time: b.craneTurnTime,
        crane_rotate_time: b.craneRotateTime,
        setup_time: b.setupTime,
        measurement_time: b.measurementTime,
        use_crane_turn: b.useCraneTurn,
        use_crane_rotate: b.useCraneRotate,
        total_time: b.totalTime,
        scheduled_date: b.scheduledDate,
        notes: b.notes
      }));
      const { error: bError } = await client.from('batches').upsert(batchPayload, { onConflict: 'id' });
      if (bError) throw bError;
    }
    lastError = null;
    return true;
  } catch (e: any) {
    handleError(e, "Sync General");
    throw e;
  }
};

export const saveTimeStudy = async (record: TimeRecord) => {
  const client = getClient();
  if (!client) return false;
  try {
    const { error } = await client.from('time_study').insert([{
      machine_id: record.machineId,
      observed_time: record.value,
      type: record.parameter,
      operator_notes: 'Stopwatch Capture',
      timestamp: new Date().toISOString()
    }]);
    if (error) handleError(error, "Guardar Estudio Tiempo");
    return !error;
  } catch (e) {
    return false;
  }
};

export const deleteBatchFromCloud = async (id: string) => {
  const client = getClient();
  if (!client) return;
  try {
    const { error } = await client.from('batches').delete().eq('id', id);
    if (error) handleError(error, "Eliminar Lote Nube");
  } catch (e) {
    handleError(e, "Excepción eliminar lote");
  }
};

export const deleteTimeRecordFromCloud = async (id: string) => {
  const client = getClient();
  if (!client) return;
  try {
    const { error } = await client.from('time_study').delete().eq('id', id);
    if (error) handleError(error, "Eliminar Registro Tiempo Nube");
  } catch (e) {
    handleError(e, "Excepción eliminar registro tiempo");
  }
};
