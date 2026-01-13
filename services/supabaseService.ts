
import { createClient } from '@supabase/supabase-js';
import { MachineConfig, Batch, TimeRecord, Tool, Thickness } from '../types';
import { INITIAL_MACHINES } from '../constants';

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
    imageUrl: b.imageUrl, // Se incluye la imagen
    originalNotes: b.notes || ''
  };

  return {
    id: b.id, 
    name: finalName || 'Sin Nombre', 
    machine_id: b.machineId, 
    pieces: Number(b.pieces) || 0,
    strikes_per_piece: Number(b.strikesPerPiece) || 0, 
    total_time: Number(b.totalTime) || 0, 
    // Fix: Using scheduledDate from Batch interface instead of non-existent scheduled_date
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
    max__tons: tool.maxTons, length: tool.length, compatible_machine_ids: tool.compatibleMachineIds
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
    // Fix: Mapping database snake_case fields to camelCase interface properties
    recommendedToolIds: t.recommended_tool_ids || [],
    compatibleMachineIds: t.compatible_machine_ids || []
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
    const defaultConfig = INITIAL_MACHINES.find(im => im.id === m.id) || INITIAL_MACHINES[0];

    let techData: Partial<MachineConfig> = { ...defaultConfig };

    try {
      if (m.description && m.description.startsWith('{')) {
        const parsed = JSON.parse(m.description);
        techData = { ...techData, ...parsed };
      }
    } catch (e) {
      console.warn(`Error parsing description for machine ${m.id}, using defaults.`);
    }

    return {
      ...defaultConfig,
      ...techData,
      id: m.id,
      name: m.name || defaultConfig.name,
    } as MachineConfig;
  });
};

export const saveMachine = async (m: MachineConfig) => {
  const client = getClient();
  if (!client) throw new Error("Cloud no disponible");

  // Usamos el operador ?? para permitir el valor 0
  const techData = {
    description: m.description || '',
    strikeTime: m.strikeTime ?? 0.005,
    toolChangeTime: m.toolChangeTime ?? 5,
    setupTime: m.setupTime ?? 10,
    measurementTime: m.measurementTime ?? 0.5,
    tramTime: m.tramTime ?? 3,
    craneTurnTime: m.craneTurnTime ?? 1,
    craneRotateTime: m.craneRotateTime ?? 1,
    manualTurnTime: m.manualTurnTime ?? 0.05,
    manualRotateTime: m.manualRotateTime ?? 0.05,
    efficiency: m.efficiency ?? 100,
    productiveHours: m.productiveHours ?? 8,
    maxLength: m.maxLength ?? 3000,
    maxTons: m.maxTons ?? 100,
    compatibleToolIds: m.compatibleToolIds ?? []
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
      imageUrl: undefined, // Se inicializa
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
      imageUrl: extended.imageUrl, // Se recupera
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
