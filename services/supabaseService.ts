
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
      strikeTime: Number(m.strike_time || m.strikeTime || 0),
      toolChangeTime: Number(m.tool_change_time || m.toolChangeTime || 0),
      tramTime: Number(m.tram_time || m.tramTime || 0),
      craneTurnTime: Number(m.crane_turn_time || m.craneTurnTime || 0),
      craneRotateTime: Number(m.crane_rotate_time || m.craneRotateTime || 0),
      manualTurnTime: Number(m.manual_turn_time || m.manualTurnTime || 0.05),
      manualRotateTime: Number(m.manual_rotate_time || m.manualRotateTime || 0.05),
      efficiency: Number(m.efficiency || 0),
      productiveHours: Number(m.productive_hours || m.productiveHours || 0)
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
      machineId: b.machine_id || b.machineId,
      pieces: Number(b.pieces || 0),
      strikesPerPiece: Number(b.strikes_per_piece || b.strikesPerPiece || 0),
      trams: Number(b.trams || 0),
      turnTime: Number(b.turn_time || b.turnTime || 0),
      rotateTime: Number(b.rotate_time || b.rotateTime || 0),
      useCraneTurn: b.use_crane_turn || b.useCraneTurn || false,
      useCraneRotate: b.use_crane_rotate || b.useCraneRotate || false,
      requiresToolChange: b.requires_tool_change || b.requiresToolChange || false,
      totalTime: Number(b.total_time || b.totalTime || 0),
      scheduledDate: b.scheduled_date || b.scheduledDate || new Date().toISOString().split('T')[0],
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
      tram_time: m.tramTime,
      crane_turn_time: m.craneTurnTime,
      crane_rotate_time: m.craneRotateTime,
      efficiency: m.efficiency,
      productive_hours: m.productiveHours
    }));
    
    const { error: mError } = await client.from('machines').upsert(machinePayload, { onConflict: 'id' });
    if (mError) {
      handleError(mError, "Sync Máquinas");
      throw mError;
    }

    if (batches.length > 0) {
      const batchPayload = batches.map(b => ({
        id: b.id,
        name: b.name,
        machine_id: b.machineId,
        pieces: b.pieces,
        strikes_per_piece: b.strikesPerPiece,
        trams: b.trams,
        turn_time: b.turnTime,
        rotate_time: b.rotateTime,
        use_crane_turn: b.useCraneTurn,
        use_crane_rotate: b.useCraneRotate,
        requires_tool_change: b.requiresToolChange,
        total_time: b.totalTime,
        scheduled_date: b.scheduledDate,
        notes: b.notes
      }));
      
      const { error: bError } = await client.from('batches').upsert(batchPayload, { onConflict: 'id' });
      if (bError) {
        handleError(bError, "Sync Lotes");
        throw bError;
      }
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

/**
 * Elimina un lote de la base de datos de Supabase.
 */
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

/**
 * Elimina un registro de estudio de tiempo de la base de datos de Supabase.
 */
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

export const logMachineConfig = async (machine: MachineConfig) => {
  const client = getClient();
  if (!client) return false;
  try {
    const { error } = await client.from('config_log').insert([{
      machine_id: machine.id,
      strike_time: machine.strikeTime,
      tool_change_time: machine.toolChangeTime,
      tram_time: machine.tramTime,
      crane_turn_time: machine.craneTurnTime,
      crane_rotate_time: machine.craneRotateTime,
      efficiency: machine.efficiency,
      productive_hours: machine.productiveHours,
      timestamp: new Date().toISOString()
    }]);
    if (error) handleError(error, "Log Configuración");
    return !error;
  } catch (e) {
    return false;
  }
}
