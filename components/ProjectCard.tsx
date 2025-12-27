import React from 'react';
import { Building, Shield, Pencil, ChevronRight, FileSpreadsheet, CheckCircle2, ArrowRight, Users } from 'lucide-react';
import { Project, ViewMode } from '../types';

interface ProjectCardProps {
  project: Project;
  viewMode: ViewMode;
  onSelect: () => void;
  onEdit: (e: React.MouseEvent) => void;
  readOnly?: boolean;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, viewMode, onSelect, onEdit, readOnly }) => {
  if (viewMode === 'list') {
    return (
      <div onClick={onSelect} className="group flex items-center gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer">
        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl border dark:border-slate-700 flex items-center justify-center p-2 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
           <img src={project.logoUrl || "https://picsum.photos/150/150"} alt="" className="max-h-full max-w-full object-contain" />
        </div>
        <div className="flex-1">
           <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{project.name}</h4>
           <div className="flex items-center gap-3 mt-0.5">
             <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight flex items-center gap-1"><Building className="w-3 h-3 text-slate-300 dark:text-slate-600" /> {project.venue}</p>
             <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tight flex items-center gap-1"><Shield className="w-3 h-3 text-slate-300 dark:text-slate-600" /> {project.promoter}</p>
             {project.metrics?.totalRespondents && (
                 <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tight flex items-center gap-1"><Users className="w-3 h-3 text-slate-300 dark:text-slate-600" /> {project.metrics.totalRespondents}</p>
             )}
           </div>
        </div>
        <div className="text-right pr-4">
           <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{project.dates}</p>
           <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">{project.year}</p>
        </div>
        <div className="flex items-center gap-2">
            {!readOnly && (
                <button onClick={onEdit} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Edit Hub Settings"><Pencil className="w-4 h-4" /></button>
            )}
            <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    );
  }

  return (
    <div onClick={onSelect} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] overflow-hidden hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer flex flex-col h-full relative">
      <div className="h-40 bg-slate-50 dark:bg-slate-800 relative flex items-center justify-center p-8 group-hover:bg-blue-50/40 dark:group-hover:bg-blue-900/20 transition-colors border-b border-slate-100 dark:border-slate-800">
         <img 
           src={project.logoUrl || "https://picsum.photos/150/150"} 
           alt={project.name} 
           className="max-h-full max-w-full object-contain filter group-hover:scale-110 transition-transform duration-500" 
         />
         {!readOnly && (
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={onEdit} className="p-2.5 bg-white dark:bg-slate-700 rounded-xl shadow-lg text-slate-400 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-slate-600 transition-all transform hover:scale-110 active:scale-95 border border-slate-100 dark:border-slate-600" title="Edit Hub Settings">
                    <Pencil className="w-4 h-4" />
                </button>
            </div>
         )}
      </div>
      <div className="p-7 flex flex-col flex-1">
         <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-100 dark:border-blue-800/50 uppercase tracking-wider">
               {project.dates}
            </span>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-2 py-1 rounded-lg">{project.year}</span>
         </div>
         <h3 className="font-bold text-xl text-slate-900 dark:text-white leading-tight mb-4 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">{project.name}</h3>
         
         <div className="space-y-2 mt-auto">
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
               <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Building className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /></div>
               <span className="truncate">{project.venue}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
               <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Shield className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /></div>
               <span className="truncate">{project.promoter}</span>
            </div>
            {project.metrics?.totalRespondents && (
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
                   <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Users className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /></div>
                   <span className="truncate">Total respondents: {project.metrics.totalRespondents}</span>
                </div>
            )}
         </div>

         <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex -space-x-2">
               <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400" title="Data Records Associated"><FileSpreadsheet className="w-4 h-4" /></div>
               <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-blue-600 flex items-center justify-center text-white" title="Schema Mapped"><CheckCircle2 className="w-4 h-4" /></div>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
               Enter Hub <ArrowRight className="w-3.5 h-3.5" />
            </div>
         </div>
      </div>
    </div>
  );
};

export default ProjectCard;