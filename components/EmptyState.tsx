import React from 'react';
import { Globe, Plus } from 'lucide-react';

interface EmptyStateProps {
  onAdd: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ onAdd }) => {
  return (
    <div className="py-24 flex flex-col items-center justify-center text-center bg-white rounded-[40px] border-2 border-dashed border-slate-200 shadow-sm animate-in fade-in zoom-in-95 duration-500">
       <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 border border-slate-100">
          <Globe className="w-12 h-12 text-slate-300" />
       </div>
       <h3 className="text-2xl font-bold text-slate-900 mb-2">Workspace Empty</h3>
       <p className="text-slate-500 max-w-sm mb-10 text-sm leading-relaxed">Initialize your first event by uploading required Q_ and RawData_ CSV files.</p>
       <button onClick={onAdd} className="flex items-center gap-3 px-8 py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95">
          <Plus className="w-5 h-5" /> Initialize New Hub
       </button>
    </div>
  );
};

export default EmptyState;