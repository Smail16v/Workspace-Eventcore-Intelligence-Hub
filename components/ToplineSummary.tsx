import React, { useState } from 'react';
import { Calendar, Clock, Database, CheckSquare, Hash, Filter, Pencil } from 'lucide-react';
import { FilterState } from '../types';

interface Props {
  surveyTitle: string;
  onTitleChange: (newTitle: string) => void;
  year: string;
  dateRange: string;
  respondentCount: number;
  totalCount: number;
  avgDuration: string;
  avgEngagement: string;
  questionCount: number;
  activeFilters: FilterState;
}

export const ToplineSummary: React.FC<Props> = ({
  surveyTitle,
  onTitleChange,
  year,
  dateRange,
  respondentCount,
  totalCount,
  avgDuration,
  avgEngagement,
  questionCount,
  activeFilters
}) => {
  const hasFilters = Object.keys(activeFilters).length > 0;
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="report-card bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 print:shadow-none print:border-none print:p-0 mb-8 break-after-avoid transition-colors">
      
      {/* Centered Attribution */}
      <div className="mb-4 text-center">
          <a href="https://eventcore.co/" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest hover:underline italic">
              Created by Eventcore Intelligence
          </a>
      </div>

      {/* Title Section */}
      <div className="flex justify-between items-start border-b border-slate-100 dark:border-slate-800 pb-6 mb-6">
        <div>
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2">
                Survey Topline Report
            </h1>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-slate-500 dark:text-slate-400">
                {isEditing ? (
                    <input 
                        type="text" 
                        value={surveyTitle}
                        onChange={(e) => onTitleChange(e.target.value)}
                        onBlur={() => setIsEditing(false)}
                        onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)}
                        autoFocus
                        className="text-lg font-bold text-brand-600 dark:text-brand-400 border-b-2 border-brand-500 outline-none bg-transparent min-w-[200px]"
                    />
                ) : (
                    <h2 
                        onClick={() => setIsEditing(true)}
                        className="text-lg font-medium text-brand-600 dark:text-brand-400 flex items-center gap-2 cursor-pointer group hover:text-brand-700 dark:hover:text-brand-300 transition-colors"
                        title="Click to edit title"
                    >
                        {surveyTitle} <span className="text-slate-400 pointer-events-none">{year}</span>
                        <Pencil className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </h2>
                )}
                <div className="hidden sm:block w-px h-4 bg-slate-300 dark:bg-slate-700"></div>
                <div className="flex items-center gap-2 text-sm font-medium">
                    <Calendar className="w-4 h-4" />
                    {dateRange}
                </div>
            </div>
        </div>
        <img src="https://eventcore.co/hubfs/Logo_eventcore_Primary_Horiz_RGB.svg" alt="Eventcore" className="h-12 w-auto hidden sm:block print:block dark:brightness-0 dark:invert" />
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
         <div className="space-y-1 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400 tracking-wider">
                <Database className="w-4 h-4" /> Respondents
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {respondentCount.toLocaleString()}
                <span className="text-sm text-slate-400 font-medium ml-1">/ {totalCount.toLocaleString()}</span>
            </div>
         </div>

         <div className="space-y-1 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400 tracking-wider">
                <Clock className="w-4 h-4" /> Avg Duration
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {avgDuration}
            </div>
         </div>

         <div className="space-y-1 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400 tracking-wider">
                <CheckSquare className="w-4 h-4" /> Engagement
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {avgEngagement}
                <span className="text-sm text-slate-400 font-medium ml-1">Qs</span>
            </div>
         </div>

         <div className="space-y-1 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-slate-400 tracking-wider">
                <Hash className="w-4 h-4" /> Survey Length
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {questionCount}
                <span className="text-sm text-slate-400 font-medium ml-1">Questions</span>
            </div>
         </div>
      </div>

      {/* Active Filters Section */}
      {hasFilters ? (
        <div className="bg-brand-50 dark:bg-brand-900/20 rounded-lg p-5 border border-brand-100 dark:border-brand-800">
            <div className="flex items-center gap-2 mb-3 text-sm font-bold text-brand-800 dark:text-brand-300 uppercase tracking-wide">
                <Filter className="w-4 h-4" /> Active Filters Applied
            </div>
            <div className="flex flex-wrap gap-2">
                {Object.entries(activeFilters).flatMap(([qId, vals]) => 
                    (vals as string[]).map(val => (
                        <span key={`${qId}-${val}`} className="bg-white dark:bg-slate-800 border border-brand-200 dark:border-brand-700 text-brand-700 dark:text-brand-300 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                            {qId}: {val}
                        </span>
                    ))
                )}
            </div>
        </div>
      ) : (
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-dashed border-slate-200 dark:border-slate-700 text-sm text-slate-400 italic flex items-center justify-center gap-2">
              <Filter className="w-4 h-4" /> No filters applied (Showing Total Population)
          </div>
      )}
    </div>
  );
};