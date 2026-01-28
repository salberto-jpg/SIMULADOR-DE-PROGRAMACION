
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

export const saveBatch = async (batch: Batch) => {
  const client = getClient();
  if (!client) throw new Error("Cloud no disponible");
  
  const isSim = !!batch.isSimulation;
  const finalName = isSim ? `[SIM] ${batch.name}` : batch.name;

  const payload = {
    id: batch.id, 
    name: finalName || 'Sin Nombre', 
    machine_id: batch.machineId, 
    pieces: Number(batch.pieces) || 0,
    strikes_per_piece: Number(batch.strikesPerPiece) || 0, 
    total_time: Number(batch.totalTime) || 0, 
    scheduled_date: batch.scheduledDate || new Date().toISOString().split('T')[0], 
    notes: JSON.stringify({
      ...batch,
      isSimulation: isSim
    })
  };

  const { error } = await client.from('batches').upsert(payload);
  if (error) throw error;
};

export const fetchTools = async (): Promise<Tool[]> => {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client.from('tools').select('*');
  if (error) return [];
  return (data || []).map((t: any) => ({
    id: t.id, 
    name: t.name, 
    type: t.type, 
    vWidth: t.v_width || 0, 
    angle: t.angle || 0,
    maxTons: t.max_tons || 0, 
    length: t.length || 0, 
    compatibleMachineIds: t.compatible_machine_ids || []
  }));
};

export const saveTool = async (tool: Tool) => {
  const client = getClient();
  if (!client) throw new Error("Cloud no disponible");
  
  const payload = {
    id: tool.id, 
    name: tool.name || 'Sin Nombre', 
    type: tool.type || 'punch', 
    v_width: Number(tool.vWidth) || 0, 
    angle: Number(tool.angle) || 0,
    max_tons: Number(tool.maxTons) || 0,
    length: Number(tool.length) || 0,
    compatible_machine_ids: tool.compatibleMachineIds || []
  };

  const { error } = await client.from('tools').upsert(payload);
  if (error) throw error;
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
  return (data || []).map((t: any) => ({
    id: t.id, 
    value: t.value || 0, 
    material: t.material || '', 
    recommendedToolIds: t.recommended_tool_ids || [],
    compatibleMachineIds: t.compatible_machine_ids || []
  }));
};

export const saveThickness = async (th: Thickness) => {
  const client = getClient();
  if (!client) throw new Error("Cloud no disponible");

  const payload = {
    id: th.id, 
    value: Number(th.value) || 0, 
    material: th.material || 'Acero', 
    recommended_tool_ids: th.recommendedToolIds || [],
    compatible_machine_ids: th.compatibleMachineIds || []
  };

  const { error } = await client.from('thicknesses').upsert(payload);
  if (error) throw error;
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
    let techData: any = {};
    try {
      if (m.description && m.description.startsWith('{')) {
        techData = JSON.parse(m.description);
      }
    } catch (e) {}

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

  const techData = {
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

  if (error) throw error;
};

export const fetchBatches = async (): Promise<Batch[]> => {
  const client = getClient();
  if (!client) return [];
  const { data, error } = await client.from('batches').select('*');
  if (error) return [];
  return (data || []).map((b: any) => {
    let extended: any = { isSimulation: b.name.startsWith('[SIM]') };
    try {
      if (b.notes && b.notes.startsWith('{')) {
        extended = { ...extended, ...JSON.parse(b.notes) };
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
      ...extended
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
    timestamp: r.timestamp,
    length: r.length // Se asume que la columna existe o se guardó anteriormente
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
    operator_notes: "Stopwatch Capture",
    length: record.length // Se añade el campo longitud al insertar
  }]);
};
