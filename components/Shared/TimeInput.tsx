
import React, { useState, useEffect } from 'react';
import { formatTime, parseTimeToMinutes } from '../../utils/helpers';

export const TimeInput: React.FC<{ 
  label: string; 
  value: number; 
  onChange: (val: number) => void;
}> = ({ label, value, onChange }) => {
  const [displayValue, setDisplayValue] = useState(formatTime(value));

  useEffect(() => {
    setDisplayValue(formatTime(value));
  }, [value]);

  const handleBlur = () => {
    const minutes = parseTimeToMinutes(displayValue);
    onChange(minutes);
    setDisplayValue(formatTime(minutes));
  };

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase text-slate-400 block tracking-tight">{label}</label>
      <input 
        type="text"
        className="w-full bg-slate-50/50 border border-slate-100 p-4 md:p-5 rounded-2xl font-black text-blue-950 outline-none focus:border-blue-800 focus:bg-white transition-all text-center"
        value={displayValue}
        onChange={(e) => setDisplayValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="00:00:00"
      />
    </div>
  );
};
