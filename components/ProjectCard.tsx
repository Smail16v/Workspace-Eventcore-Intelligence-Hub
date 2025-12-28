import React from 'react';
import { 
  Building, 
  Shield, 
  Pencil, 
  ChevronRight, 
  FileSpreadsheet, 
  CheckCircle2, 
  ArrowRight, 
  Users,
  Clock,
  CalendarRange,
  Activity,
  FileText,
  Globe,
  Smartphone,
  PieChart,
  BarChart3,
  Sparkles
} from 'lucide-react';
import { Project, ViewMode } from '../types';

interface ProjectCardProps {
  project: Project;
  viewMode: ViewMode;
  onSelect: () => void;
  onEdit: (e: React.MouseEvent) => void;
  readOnly?: boolean;
  userLastVisit?: number;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ project, viewMode, onSelect, onEdit, readOnly, userLastVisit }) => {
  const { metrics } = project;
  
  // Logic: Check if this specific project was refreshed in the current session
  const isRecentSync = project.lastSyncedAt && (!userLastVisit || project.lastSyncedAt > userLastVisit);
  const isNew = project.createdAt && (!userLastVisit || project.createdAt > userLastVisit);
  
  // Combined flag for display if either new or synced, prioritizing 'New' status if both match
  const showBadge = isRecentSync || isNew;

  const syncTime = project.lastSyncedAt 
    ? new Date(project.lastSyncedAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) 
    : (project.updatedAt ? new Date(project.updatedAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '');

  if (viewMode === 'list') {
    return (
      <div onClick={onSelect} className="group flex items-center gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden">
        {showBadge && (
            <div className="absolute top-0 left-0 w-1 h-full bg-[#FFD000] animate-pulse"></div>
        )}
        
        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl border dark:border-slate-700 flex items-center justify-center p-2 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors shrink-0 relative">
           <img src={project.logoUrl || "https://picsum.photos/150/150"} alt="" className="max-h-full max-w-full object-contain" />
           {showBadge && (
              <div className="absolute -top-1 -right-1 bg-[#FFD000] text-slate-900 p-0.5 rounded-full border-2 border-white dark:border-slate-900">
                  <Sparkles className="w-2.5 h-2.5 fill-black" />
              </div>
           )}
        </div>
        
        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
           {/* Info Section */}
           <div className="md:col-span-4 min-w-0">
             <div className="flex items-center gap-2">
                 <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">{project.name}</h4>
                 {showBadge && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-[#FFD000] text-black text-[10px] font-black uppercase rounded-lg shadow-sm ml-2">
                        <Sparkles className="w-3 h-3 fill-black" />
                        <span>{isNew ? 'New' : 'Updated'}</span>
                    </div>
                 )}
             </div>
             <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
               <span className="flex items-center gap-1 truncate"><Building className="w-3 h-3" /> {project.venue}</span>
               <span className="flex items-center gap-1 truncate"><Shield className="w-3 h-3" /> {project.promoter}</span>
             </div>
           </div>

           {/* Metrics Section (Desktop) */}
           <div className="hidden md:flex md:col-span-6 items-center gap-6 justify-start text-[10px] text-slate-500 dark:text-slate-400 font-medium">
              {metrics ? (
                <>
                  <div className="flex flex-col gap-1 min-w-[80px]">
                      <span className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300"><Users className="w-3 h-3 text-blue-500" /> {metrics.totalRespondents}</span>
                      <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" /> {metrics.avgDuration}</span>
                  </div>
                  <div className="flex flex-col gap-1 min-w-[80px]">
                      <span className="flex items-center gap-1.5"><Activity className="w-3 h-3" /> {metrics.engagement}</span>
                      <span className="flex items-center gap-1.5"><FileText className="w-3 h-3" /> {metrics.surveyLength}</span>
                  </div>
                  <div className="flex flex-col gap-1 min-w-[100px]">
                      <span className="flex items-center gap-1.5"><Globe className="w-3 h-3" /> {metrics.onlinePercent}% Online</span>
                      <span className="flex items-center gap-1.5"><Smartphone className="w-3 h-3" /> {metrics.onsitePercent}% On-site</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 opacity-50">
                    <BarChart3 className="w-4 h-4" /> <span>No metrics available</span>
                </div>
              )}
           </div>

           {/* Date Section */}
           <div className="hidden md:block md:col-span-2 text-right">
             <p className="text-xs font-bold text-blue-600 dark:text-blue-400">{project.dates}</p>
             <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">{project.year}</p>
           </div>
        </div>

        <div className="flex items-center gap-2 pl-2 border-l border-slate-100 dark:border-slate-800">
            {!readOnly && (
                <button onClick={onEdit} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors" title="Edit Hub Settings"><Pencil className="w-4 h-4" /></button>
            )}
            <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    );
  }

  // GRID VIEW
  return (
    <div onClick={onSelect} className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[28px] overflow-hidden hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-500 dark:hover:border-blue-500 transition-all cursor-pointer flex flex-col h-full relative">
      
      {/* High-Attention Badge in #FFD000 */}
      {showBadge && (
         <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1 bg-[#FFD000] text-black text-[10px] font-black uppercase rounded-lg shadow-xl border border-white/20 animate-pulse">
            <Sparkles className="w-3 h-3 fill-black" />
            <span>{isNew ? 'New' : `Updated ${syncTime}`}</span>
         </div>
      )}

      {/* Card Header Image */}
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

      <div className="p-6 flex flex-col flex-1 gap-4">
         {/* Top Metadata: Date & Year */}
         <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-100 dark:border-blue-800/50 uppercase tracking-wider">
               {project.dates}
            </span>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 px-2 py-1 rounded-lg">{project.year}</span>
         </div>
         
         <h3 className="font-bold text-xl text-slate-900 dark:text-white leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1" title={project.name}>{project.name}</h3>
         
         {metrics ? (
           <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 grid grid-cols-2 gap-y-3 gap-x-2 border border-slate-100 dark:border-slate-800/50">
              {/* Row 1: Total Respondents & Date Range */}
              <div className="col-span-2 flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/50">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                     <Users className="w-3.5 h-3.5 text-blue-500" /> {metrics.totalRespondents}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400" title="Data Date Range">
                     <CalendarRange className="w-3 h-3" /> {metrics.dateRange.split('-')[0].trim()}
                  </div>
              </div>

              {/* Row 2: Grid Stats */}
              <div className="flex items-center gap-2 text-[10px] font-medium text-slate-600 dark:text-slate-400" title="Average Duration">
                 <Clock className="w-3 h-3 text-slate-400" /> {metrics.avgDuration}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-medium text-slate-600 dark:text-slate-400" title="Progress">
                 <PieChart className="w-3 h-3 text-slate-400" /> {metrics.progressPercent}% Comp.
              </div>
              <div className="flex items-center gap-2 text-[10px] font-medium text-slate-600 dark:text-slate-400" title="Engagement">
                 <Activity className="w-3 h-3 text-slate-400" /> {metrics.engagement}
              </div>
              <div className="flex items-center gap-2 text-[10px] font-medium text-slate-600 dark:text-slate-400" title="Survey Length">
                 <FileText className="w-3 h-3 text-slate-400" /> {metrics.surveyLength}
              </div>

              {/* Row 3: Online/Onsite Split Bar */}
              <div className="col-span-2 flex items-center gap-1 pt-2 border-t border-slate-200 dark:border-slate-700/50 mt-1">
                 <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                    <div className="bg-blue-500 h-full" style={{ width: `${metrics.onlinePercent}%` }}></div>
                    <div className="bg-emerald-500 h-full" style={{ width: `${metrics.onsitePercent}%` }}></div>
                 </div>
              </div>
              <div className="col-span-2 flex justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
                 <span className="flex items-center gap-1"><Globe className="w-2.5 h-2.5" /> {metrics.onlinePercent}% Online</span>
                 <span className="flex items-center gap-1"><Smartphone className="w-2.5 h-2.5" /> {metrics.onsitePercent}% On-site</span>
              </div>
           </div>
         ) : (
           /* Fallback if no metrics computed yet */
           <div className="space-y-3 py-2">
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
                 <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Building className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /></div>
                 <span className="truncate">{project.venue}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
                 <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><Shield className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" /></div>
                 <span className="truncate">{project.promoter}</span>
              </div>
              <div className="text-center py-2 text-[10px] text-slate-400 italic">
                 Initialize hub to see metrics
              </div>
           </div>
         )}

         {/* Footer Icons */}
         <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex -space-x-2">
               <div className={`w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center transition-colors ${metrics ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`} title="Data Records">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
               </div>
               <div className={`w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center transition-colors ${metrics ? 'bg-blue-600 text-white' : 'bg-slate-300 text-white dark:bg-slate-700'}`} title="Schema Mapped">
                  <CheckCircle2 className="w-3.5 h-3.5" />
               </div>
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