
import React, { useState, useEffect } from 'react';
import { INITIAL_MACHINES } from './constants';
import { MachineConfig, Batch, Tool, Thickness, TimeRecord } from './types';
import { 
  initSupabase, fetchMachines, fetchBatches, fetchTools, fetchThicknesses,
  subscribeToChanges, saveTimeRecord, fetchTimeRecords, saveBatch, saveMachine,
  saveTool, saveThickness, deleteTool, deleteThickness, deleteBatchFromCloud
} from './services/supabaseService';

// Importación de componentes modulares
import { Header } from './components/Layout/Header';
import { Sidebar } from './components/Layout/Sidebar';
import { Icons } from './components/Icons';
import { Stopwatch } from './components/Stopwatch/Stopwatch';
import { ProductionTab } from './components/Tabs/ProductionTab';
import { MachinesTab } from './components/Tabs/MachinesTab';
import { ToolsTab } from './components/Tabs/ToolsTab';
import { ThicknessTab } from './components/Tabs/ThicknessTab';
import { RecordsTab } from './components/Tabs/RecordsTab';
import { EditModal } from './components/Modals/EditModal';

type TabType = 'schedule' | 'machines' | 'tools' | 'thickness' | 'records';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('schedule');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [machines, setMachines] = useState<MachineConfig[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [thicknesses, setThicknesses] = useState<Thickness[]>([]);
  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [status, setStatus] = useState("");
  const [isEditing, setIsEditing] = useState<{ type: string, data: any } | null>(null);

  useEffect(() => {
    const SUPABASE_URL = "https://jcdbepgjoqxtnuarcwku.supabase.co"; 
    const SUPABASE_KEY = "sb_publishable_w5tryB0lyl0hCNP3B9AAUg_udm3kUu0"; 
    initSupabase(SUPABASE_URL, SUPABASE_KEY);
    loadData();

    const channels = [
      subscribeToChanges('batches', () => loadData()),
      subscribeToChanges('time_study', () => loadData()),
      subscribeToChanges('machines', () => loadData()),
      subscribeToChanges('tools', () => loadData()),
      subscribeToChanges('thicknesses', () => loadData())
    ];

    return () => { channels.forEach(ch => ch?.unsubscribe()); };
  }, []);

  const loadData = async () => {
    try {
      setStatus("Sincronizando...");
      const [m, b, t, th, r] = await Promise.all([
        fetchMachines(), fetchBatches(), fetchTools(), fetchThicknesses(), fetchTimeRecords()
      ]);
      const sortedMachines = (m.length ? m : INITIAL_MACHINES).sort((a, b) => 
        a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' })
      );
      setMachines(sortedMachines);
      setBatches(b);
      setTools(t);
      setThicknesses(th);
      setRecords(r);
      setStatus("");
    } catch (e) {
      console.error("Error cargando datos:", e);
      setStatus("Error de conexión");
    }
  };

  const handleCaptureTime = async (machineId: string, parameter: string, value: number) => {
    const record: TimeRecord = {
      id: `r-${Date.now()}`,
      machineId,
      parameter,
      value,
      timestamp: new Date().toISOString()
    };
    await saveTimeRecord(record);
    setStatus("Tiempo Capturado");
    setTimeout(() => setStatus(""), 2000);
    loadData();
  };

  const navItems = [
    { id: 'schedule', label: 'Producción', icon: <Icons.Schedule /> },
    { id: 'machines', label: 'Máquinas', icon: <Icons.Machines /> },
    { id: 'tools', label: 'Herramental', icon: <Icons.Tools /> },
    { id: 'thickness', label: 'Espesores', icon: <Icons.Thickness /> },
    { id: 'records', label: 'Registros', icon: <Icons.Records /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Inter'] relative overflow-hidden">
      <Header 
        isOpen={isSidebarOpen} 
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)} 
        activeTabLabel={navItems.find(n => n.id === activeTab)?.label || ''}
        status={status}
      />

      <Sidebar 
        isOpen={isSidebarOpen}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onToggle={setIsSidebarOpen}
        navItems={navItems}
      />

      <Stopwatch machines={machines} onCapture={handleCaptureTime} />

      <main className={`flex-1 p-4 md:p-12 transition-all duration-500 ${isSidebarOpen ? 'md:ml-72' : 'md:ml-12'}`}>
        <div className="max-w-[1600px] mx-auto w-full">
          {activeTab === 'schedule' && (
            <ProductionTab 
              batches={batches} 
              machines={machines} 
              selectedDate={selectedDate} 
              onDateChange={setSelectedDate} 
              onEdit={(data) => setIsEditing({ type: 'batch', data })}
              onDelete={deleteBatchFromCloud}
              onLoad={loadData}
            />
          )}
          {activeTab === 'machines' && (
            <MachinesTab 
              machines={machines} 
              batches={batches} 
              onEdit={(data) => setIsEditing({ type: 'machine', data })}
            />
          )}
          {activeTab === 'tools' && (
            <ToolsTab 
              tools={tools} 
              onEdit={(data) => setIsEditing({ type: 'tool', data })}
              onDelete={deleteTool}
              onLoad={loadData}
            />
          )}
          {activeTab === 'thickness' && (
            <ThicknessTab 
              thicknesses={thicknesses} 
              onEdit={(data) => setIsEditing({ type: 'thickness', data })}
              onDelete={deleteThickness}
              onLoad={loadData}
            />
          )}
          {activeTab === 'records' && <RecordsTab records={records} />}
        </div>
      </main>

      {isEditing && (
        <EditModal 
          editing={isEditing} 
          machines={machines} 
          tools={tools}
          thicknesses={thicknesses}
          onClose={() => setIsEditing(null)} 
          onSave={async (data) => {
            if (isEditing.type === 'batch') await saveBatch(data);
            else if (isEditing.type === 'machine') await saveMachine(data);
            else if (isEditing.type === 'tool') await saveTool(data);
            else if (isEditing.type === 'thickness') await saveThickness(data);
            setIsEditing(null);
            loadData();
          }} 
        />
      )}
    </div>
  );
}
