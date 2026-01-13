import { createClient } from '@supabase/supabase-js';
import { MachineConfig, Batch, TimeRecord, Tool, Thickness } from '../types';

let supabase: any = null;
let isCloudAvailable = false;

export const initSupabase = (url: string, key: string) => {
  if (url && url.startsWith('https://') && key && key.length > 20) {
    try {
      supabase = createClient(url, key);
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
    .channel(`public-${table}-changes`)
    .on('postgres_changes', { event: '*', schema: 'public', table: table }, callback)
    .subscribe();
};

const mapBatchToDB = (b: Batch) => {
  const isSim = !!b.isSimulation;
  const finalName = isSim ? `[SIM] ${b.name}` : b.name;

  const extendedData = {
    trams: b.trams,
    toolChanges: b.toolChanges,
    thickness: b.thickness,
    length: b.length,
    width: b.width,
    toolIds: b.toolIds,
    useCraneTurn: b.useCraneTurn,
    turnQuantity: b.turnQuantity,
    useCraneRotate: b.useCraneRotate,
    rotateQuantity: b.rotateQuantity,
    requiresToolChange: b.requiresToolChange,
    priority: b.priority,
    deliveryDate: b.deliveryDate,
    isSimulation: isSim,
    originalNotes: b.notes || ''
  };

  return {
    id: b.id, 
    name: finalName || 'Sin Nombre', 
    machine_id: b.machineId, 
    pieces: Number(b.pieces) || 0,
    strikes_per_piece: Number(b.strikesPerPiece) || 0, 
    total_time: Number(b.totalTime) || 0, 
    // Fix: Using scheduledDate from the Batch interface instead of scheduled_date
    scheduled_date: b.scheduledDate || new Date().toISOString().split('T')[0], 
    notes: JSON.stringify(extendedData)
  };
};

export const saveBatch = async (batch: Batch) => {
  const client = getClient();
  if (!client) throw new Error("Cloud no disponible");
  const payload = mapBatchToDB(batch);
  const { error } = await client.from('batches').upsert(payload);
  if (error) {
    console.error("Error saving batch:", error.message);
    throw new Error(error.message);
  }
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
  await client.from('tools').upsert({
    id: tool.id, name: tool.name, type: tool.type, v_width: tool.vWidth, angle: tool.angle,
    max_tons: tool.maxTons, length: tool.length, compatible_machine_ids: tool.compatibleMachineIds
  });
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
    id: t.id, 
    value: t.value, 
    material: t.material, 
    recommended_tool_ids: t.recommended_tool_ids || [],
    compatible_machine_ids: t.compatible_machine_ids || []
  }));
};

export const saveThickness = async (th: Thickness) => {
  const client = getClient();
  if (!client) return;
  await client.from('thicknesses').upsert({
    id: th.id, 
    value: th.value, 
    material: th.material, 
    recommended_tool_ids: th.recommendedToolIds,
    compatible_machine_ids: th.compatibleMachineIds
  });
};

export const deleteThickness = async (id: string) => {
  const client = getClient();
  if (!client) return;
  await client.from('thicknesses').delete().eq('id', id);
};

export const fetchMachines = async (): Promise<MachineConfig[]> => {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client.from('machines').select('*');
  if (error) return [];
  
  return (data || []).map((m: any) => {
    let techData = {
      description: m.description || '',
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
    };

    try {
      if (m.description && m.description.startsWith('{')) {
        const parsed = JSON.parse(m.description);
        techData = { ...techData, ...parsed };
      }
    } catch (e) {}

    return {
      id: m.id,
      name: m.name || '',
      ...techData
    };
  });
};

export const saveMachine = async (m: MachineConfig) => {
  const client = getClient();
  if (!client) throw new Error("Cloud no disponible");

  const techData = {
    description: m.description || '',
    strikeTime: Number(m.strikeTime) || 0.005,
    toolChangeTime: Number(m.toolChangeTime) || 5,
    setupTime: Number(m.setupTime) || 10,
    measurementTime: Number(m.measurementTime) || 0.5,
    tramTime: Number(m.tramTime) || 3,
    craneTurnTime: Number(m.craneTurnTime) || 1,
    craneRotateTime: Number(m.craneRotateTime) || 1,
    manualTurnTime: Number(m.manualTurnTime) || 0.05,
    manualRotateTime: Number(m.manualRotateTime) || 0.05,
    efficiency: Number(m.efficiency) || 100,
    productiveHours: Number(m.productiveHours) || 8,
    maxLength: Number(m.maxLength) || 3000,
    maxTons: Number(m.maxTons) || 100,
    compatibleToolIds: m.compatibleToolIds || []
  };

  const { error } = await client.from('machines').upsert({
    id: m.id, 
    name: m.name || '', 
    description: JSON.stringify(techData)
  });

  if (error) {
    console.error("Error saving machine:", error.message);
    throw new Error(error.message);
  }
};

export const fetchBatches = async (): Promise<Batch[]> => {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client.from('batches').select('*');
  if (error) return [];
  return (data || []).map((b: any) => {
    let extended = {
      trams: 1,
      toolChanges: 1,
      thickness: 0,
      length: 0,
      width: 0,
      toolIds: [],
      useCraneTurn: false,
      turnQuantity: 1,
      useCraneRotate: false,
      rotateQuantity: 1,
      requiresToolChange: false,
      priority: 'medium',
      deliveryDate: b.scheduled_date,
      isSimulation: b.name.startsWith('[SIM]'),
      originalNotes: b.notes || ''
    };

    try {
      if (b.notes && b.notes.startsWith('{')) {
        const parsed = JSON.parse(b.notes);
        extended = { ...extended, ...parsed };
      }
    } catch (e) {}

    const cleanName = extended.isSimulation ? b.name.replace('[SIM] ', '') : b.name;
    
    return {
      id: b.id,
      name: cleanName,
      machineId: b.machine_id,
      pieces: b.pieces,
      strikesPerPiece: b.strikes_per_piece,
      totalTime: b.total_time,
      scheduledDate: b.scheduled_date,
      isSimulation: extended.isSimulation,
      trams: extended.trams,
      toolChanges: extended.toolChanges,
      thickness: extended.thickness,
      length: extended.length,
      width: extended.width,
      toolIds: extended.toolIds,
      useCraneTurn: extended.useCraneTurn,
      turnQuantity: extended.turnQuantity,
      useCraneRotate: extended.useCraneRotate,
      rotateQuantity: extended.rotateQuantity,
      requiresToolChange: extended.requiresToolChange,
      priority: extended.priority as any,
      deliveryDate: extended.deliveryDate,
      notes: extended.originalNotes
    };
  });
};

export const fetchTimeRecords = async (): Promise<TimeRecord[]> => {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client.from('time_study').select('*').order('timestamp', { ascending: false });
  if (error) return [];
  return data.map((r: any) => ({
    id: r.id, 
    machineId: r.machine_id, 
    parameter: r.type, 
    value: r.observed_time, 
    timestamp: r.timestamp
  }));
};

export const syncAppData = async (machines: MachineConfig[], batches: Batch[]) => {
  const client = getClient();
  if (!client) return;
  for (const m of machines) await saveMachine(m);
  for (const b of batches) await saveBatch(b);
};

export const deleteBatchFromCloud = async (id: string) => {
  const client = getClient();
  if (client) await client.from('batches').delete().eq('id', id);
};

export const saveTimeRecord = async (record: TimeRecord) => {
  const client = getClient();
  if (!client) return;
  await client.from('time_study').insert([{
    machine_id: record.machineId,
    type: record.parameter,
    observed_time: record.value,
    timestamp: record.timestamp,
    operator_notes: "Stopwatch Capture"
  }]);
};