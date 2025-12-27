import React from 'react';
import { ChevronRight, Settings, Loader2 } from 'lucide-react';
import { Project } from '../types';

interface ProjectDashboardProps {
  project: Project;
  onBack: () => void;
  readOnly?: boolean;
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ project, onBack, readOnly }) => {
  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 flex flex-col animate-in fade-in duration-500 transition-colors">
       <div className="h-16 bg-white dark:bg-slate-900 border-b dark:border-slate-800 flex items-center px-6 justify-between shadow-sm transition-colors">
          <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:gap-3 transition-all">
             <ChevronRight className="w-4 h-4 rotate-180" /> Back to Workspace
          </button>
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg border dark:border-slate-700 p-1 bg-white dark:bg-slate-800">
                <img src={project.logoUrl || "https://picsum.photos/100/100"} className="max-h-full max-w-full object-contain mx-auto" alt="Logo" />
             </div>
             <span className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-white">{project.name} Hub</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="h-8 w-px bg-slate-100 dark:bg-slate-800"></div>
             {!readOnly && (
                <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500 transition-colors"><Settings className="w-5 h-5" /></button>
             )}
          </div>
       </div>
       <div className="flex-1 flex flex-col items-center justify-center p-10">
          <div className="max-w-xl w-full text-center">
             <div className="w-28 h-28 bg-white dark:bg-slate-900 rounded-[40px] shadow-2xl flex items-center justify-center mx-auto mb-10 p-6 border-4 border-blue-50 dark:border-blue-900/30">
                <img src={project.logoUrl || "https://picsum.photos/200/200"} className="max-h-full max-w-full object-contain" alt="Logo Large" />
             </div>
             <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">{project.name}</h2>
             <div className="flex items-center justify-center gap-4 mb-12">
                <span className="px-3 py-1 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-lg text-xs font-bold text-slate-500 dark:text-slate-400">{project.dates}</span>
                <span className="px-3 py-1 bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-lg text-xs font-bold text-slate-500 dark:text-slate-400">{project.promoter}</span>
             </div>
             
             <div className="p-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[48px] shadow-xl relative overflow-hidden transition-colors">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-blue-400"></div>
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-6" />
                <h4 className="font-bold text-xl text-slate-900 dark:text-white mb-2">Analyzing Project Data</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">Wiring <b>Q_{project.name}.csv</b> and <b>RawData_{project.name}.csv</b> to the Intelligence Front-end.</p>
             </div>
          </div>
       </div>
    </div>
  );
};

export default ProjectDashboard;