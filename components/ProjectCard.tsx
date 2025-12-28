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
  Sparkles,
  Trophy
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
  const { metrics, prizeInfo } = project;
  
  // Logic: Check if this specific project was refreshed in the current session
  const isRecentSync = project.lastSyncedAt && (!userLastVisit || project.lastSyncedAt > userLastVisit);
  const isNew = project.createdAt && (!userLastVisit || project.createdAt > userLastVisit);
  
  // Combined flag for display in List View
  const showBadgeList = isRecentSync || isNew;
  const badgeTextList = isNew ? 'New' : 'Updated';

  const updateTime = project.lastSyncedAt 
    ? new Date(project.lastSyncedAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) 
    : (project.updatedAt ? new Date(project.updatedAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : '');

  if (viewMode === 'list') {
    return (
      <div onClick={onSelect} className="group flex items-center gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden">
        {showBadgeList && (
            <div className="absolute top-0 left-0 w-1 h-full bg-[#FFD000] animate-pulse"></div>
        )}
        
        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl border dark:border-slate-700 flex items-center justify-center p-2 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors shrink-0 relative">
           <img src={project.logoUrl || "https://picsum.photos/150/150"} alt="" className="max-h-full max-w-full object-contain" />
           {showBadgeList && (
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
                 {showBadgeList && (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-[#FFD000] text-black text-[10px] font-black uppercase rounded-lg shadow-sm ml-2">
                        <Sparkles className="w-3 h-3 fill-black" />
                        <span>{badgeTextList}</span>
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
                      <span className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-blue-500" /> {metrics.avgDuration}</span>
                  </div>
                  <div className="flex flex-col gap-1 min-w-[80px]">
                      <span className="flex items-center gap-1.5"><Activity className="w-3 h-3 text-blue-500" /> {metrics.engagement}</span>
                      <span className="flex items-center gap-1.5"><FileText className="w-3 h-3 text-blue-500" /> {metrics.surveyLength}</span>
                  </div>
                  <div className="flex flex-col gap-1 min-w-[100px]">
                      <span className="flex items-center gap-1.5"><Globe className="w-3 h-3 text-blue-500" /> {metrics.onlinePercent}% Online</span>
                      <span className="flex items-center gap-1.5"><Smartphone className="w-3 h-3 text-blue-500" /> {metrics.onsitePercent}% On-site</span>
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
      
      {/* Status Tags */}
      {isNew ? (
         <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5 px-3 py-1 bg-[#FFD000] text-black text-[10px] font-black uppercase rounded-lg shadow-xl border border-white/20 animate-pulse">
            <Sparkles className="w-3 h-3 fill-black" />
            <span>New Project</span>
         </div>
      ) : isRecentSync ? (
         <div className="absolute top-4 left-4 z-20 flex items-center gap-1.5">
            <div className="bg-[#FFD000] p-1 rounded-md shadow-sm">
               <Sparkles className="w-3 h-3 fill-black" />
            </div>
            <span className="text-[10px] italic text-slate-400 dark:text-slate-500 font-medium">Updated {updateTime}</span>
         </div>
      ) : null}

      {/* Improved Logo Header: Ensures Logo fits entirely */}
      <div className="h-44 bg-slate-50 dark:bg-slate-800 relative flex items-center justify-center p-6 transition-colors border-b border-slate-100 dark:border-slate-800">
         <img 
           src={project.logoUrl || "https://picsum.photos/150/150"} 
           alt={project.name} 
           className="max-h-full max-w-full object-contain filter drop-shadow-sm group-hover:scale-105 transition-transform duration-500" 
         />
         {!readOnly && (
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={onEdit} className="p-2.5 bg-white dark:bg-slate-700 rounded-xl shadow-lg text-slate-400 hover:text-blue-600 transition-all border border-slate-100 dark:border-slate-600">
                    <Pencil className="w-4 h-4" />
                </button>
            </div>
         )}
      </div>

      <div className="p-6 flex flex-col flex-1 gap-4">
         {/* Title */}
         <h3 className="font-bold text-xl text-slate-900 dark:text-white leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1" title={project.name}>{project.name}</h3>
         
         {metrics ? (
           <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4 flex flex-col gap-4 border border-slate-100 dark:border-slate-800/50">
              
              {/* Row 1: Respondents, Date Range, and Days */}
              <div className="flex flex-col gap-2 pb-3 border-b border-slate-200 dark:border-slate-700/50">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                     <Users className="w-4 h-4 text-blue-500" /> {metrics.totalRespondents}
                  </div>
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        <CalendarRange className="w-3.5 h-3.5 text-blue-500" /> {metrics.dateRange}
                     </div>
                     <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{metrics.totalDays || '0 days'}</span>
                  </div>
              </div>

              {/* Row 2: Secondary Stats */}
              <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col items-center gap-1">
                     <Clock className="w-3.5 h-3.5 text-blue-500" />
                     <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{metrics.avgDuration}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 border-x border-slate-200 dark:border-slate-700/50">
                     <Activity className="w-3.5 h-3.5 text-blue-500" />
                     <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{metrics.engagement}</span>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                     <FileText className="w-3.5 h-3.5 text-blue-500" />
                     <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">{metrics.surveyLength}</span>
                  </div>
              </div>

              {/* Row 3: Online/On-site Split */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50">
                 <div className="flex justify-between text-[9px] font-bold uppercase text-slate-400 mb-1.5">
                    <span className="flex items-center gap-1"><Globe className="w-2.5 h-2.5 text-blue-500" /> {metrics.onlinePercent}% Online</span>
                    <span className="flex items-center gap-1"><Smartphone className="w-2.5 h-2.5 text-blue-500" /> {metrics.onsitePercent}% On-site</span>
                 </div>
                 <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex">
                    <div className="bg-blue-500 h-full" style={{ width: `${metrics.onlinePercent}%` }}></div>
                    <div className="bg-emerald-500 h-full" style={{ width: `${metrics.onsitePercent}%` }}></div>
                 </div>
              </div>

              {/* Row 4: Prize (No background, blue icon) */}
              {prizeInfo && prizeInfo !== "No prize" && prizeInfo !== "No prize details found." && (
                <div className="flex items-start gap-2 pt-2 border-t border-slate-200 dark:border-slate-700/50">
                  <Trophy className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] font-normal text-slate-600 dark:text-slate-400 leading-tight">
                     {prizeInfo}
                  </p>
                </div>
              )}
           </div>
         ) : (
           /* Fallback if no metrics computed yet */
           <div className="text-center py-2 text-[10px] text-slate-400 italic">
              Initialize hub to see metrics
           </div>
         )}

         {/* SOURCE FOOTER WITH LOGO */}
         <div className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
               {metrics?.source === 'Qualtrics Source' ? (
                 <img src="https://firebasestorage.googleapis.com/v0/b/eventcore-intelligence-hub.firebasestorage.app/o/Qualtrics%20Logo.png?alt=media&token=55316618-b3b9-4806-8d46-6d7f4a970837" 
                      alt="Qualtrics" className="h-4 w-auto opacity-70 grayscale group-hover:grayscale-0 transition-all" />
               ) : (
                 <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">{metrics?.source || 'Digivey Source'}</span>
               )}
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