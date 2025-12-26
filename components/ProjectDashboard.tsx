import React from 'react';
import { ChevronRight, Settings, Loader2 } from 'lucide-react';
import { Project } from '../types';

interface ProjectDashboardProps {
  project: Project;
  onBack: () => void;
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ project, onBack }) => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col animate-in fade-in duration-500">
       <div className="h-16 bg-white border-b flex items-center px-6 justify-between shadow-sm">
          <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-blue-600 hover:gap-3 transition-all">
             <ChevronRight className="w-4 h-4 rotate-180" /> Back to Workspace
          </button>
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg border p-1 bg-white">
                <img src={project.logoUrl || "https://picsum.photos/100/100"} className="max-h-full max-w-full object-contain mx-auto" alt="Logo" />
             </div>
             <span className="font-extrabold text-sm tracking-tight text-slate-900">{project.name} Hub</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="h-8 w-px bg-slate-100"></div>
             <button className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"><Settings className="w-5 h-5" /></button>
          </div>
       </div>
       <div className="flex-1 flex flex-col items-center justify-center p-10">
          <div className="max-w-xl w-full text-center">
             <div className="w-28 h-28 bg-white rounded-[40px] shadow-2xl flex items-center justify-center mx-auto mb-10 p-6 border-4 border-blue-50">
                <img src={project.logoUrl || "https://picsum.photos/200/200"} className="max-h-full max-w-full object-contain" alt="Logo Large" />
             </div>
             <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-4">{project.name}</h2>
             <div className="flex items-center justify-center gap-4 mb-12">
                <span className="px-3 py-1 bg-white border rounded-lg text-xs font-bold text-slate-500">{project.dates}</span>
                <span className="px-3 py-1 bg-white border rounded-lg text-xs font-bold text-slate-500">{project.promoter}</span>
             </div>
             
             <div className="p-12 bg-white border border-slate-200 rounded-[48px] shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-blue-400"></div>
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-6" />
                <h4 className="font-bold text-xl text-slate-900 mb-2">Analyzing Project Data</h4>
                <p className="text-sm text-slate-500 leading-relaxed">Wiring <b>Q_{project.name}.csv</b> and <b>RawData_{project.name}.csv</b> to the Intelligence Front-end.</p>
             </div>
          </div>
       </div>
    </div>
  );
};

export default ProjectDashboard;