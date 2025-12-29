
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Settings, Loader2, Trophy, BarChart2, Table as TableIcon, Search, Database, AlertTriangle, RefreshCcw } from 'lucide-react';
import { Project, QuestionDef, SurveyResponse, FilterState } from '../types';
import { parseSchemaCsv, parseResponsesCsv, normalizeData, filterData } from '../services/parser';
import { QuestionCard } from './QuestionCard';
import { ToplineSummary } from './ToplineSummary';

interface ProjectDashboardProps {
  project: Project;
  onBack: () => void;
  readOnly?: boolean;
}

const ProjectDashboard: React.FC<ProjectDashboardProps> = ({ project, onBack, readOnly }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionDef[]>([]);
  const [normalizedData, setNormalizedData] = useState<SurveyResponse[]>([]);
  const [filters, setFilters] = useState<FilterState>({});
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [surveyTitle, setSurveyTitle] = useState(project.name);

  // 1. Fetch and Parse Data on Mount
  useEffect(() => {
    async function loadData() {
      if (!project.schemaUrl || !project.responsesUrl) {
          setError("Project is missing data files. Please re-initialize via Edit.");
          setLoading(false);
          return;
      }
      
      try {
        setLoading(true);
        setError(null);

        // Fetch files from Firebase Storage URLs
        // Note: 'fetch' requires CORS configuration on the Firebase Storage bucket.
        const [schemaRes, responsesRes] = await Promise.all([
          fetch(project.schemaUrl),
          fetch(project.responsesUrl)
        ]);

        if (!schemaRes.ok) throw new Error(`Failed to fetch schema (Status: ${schemaRes.status})`);
        if (!responsesRes.ok) throw new Error(`Failed to fetch responses (Status: ${responsesRes.status})`);

        const [schemaText, responsesText] = await Promise.all([
          schemaRes.text(),
          responsesRes.text()
        ]);

        // Parse using Hub 2 services
        const qs = await parseSchemaCsv(schemaText);
        const rawRs = await parseResponsesCsv(responsesText);
        
        if (qs.length === 0) {
            console.warn("Schema parsed but 0 questions found.");
        }

        setQuestions(qs);
        setNormalizedData(normalizeData(rawRs, qs));
      } catch (e: any) {
        console.error("Failed to load project data", e);
        if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
            setError("Network Error: Could not fetch data. This is likely a CORS issue on the Storage Bucket.");
        } else {
            setError(e.message || "Failed to load project data");
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [project]);

  // 2. Derive Filtered Data
  const filteredData = useMemo(() => 
    filterData(normalizedData, questions, filters), 
  [normalizedData, questions, filters]);

  const displayedQuestions = useMemo(() => {
    if (!searchQuery) return questions;
    return questions.filter(q => 
        q.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
        q.text.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [questions, searchQuery]);

  const handleToggleFilter = (qId: string, value: string) => {
    setFilters(prev => {
        const current = prev[qId] || [];
        const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
        const updated = { ...prev, [qId]: next };
        if (next.length === 0) delete updated[qId];
        return updated;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E5E5E6] dark:bg-[#131314] flex flex-col items-center justify-center">
         <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
         <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Wiring Analytics Engine...</p>
      </div>
    );
  }

  if (error) {
      return (
        <div className="min-h-screen bg-[#E5E5E6] dark:bg-[#131314] flex flex-col items-center justify-center p-6">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] shadow-xl max-w-md text-center border border-slate-200 dark:border-slate-800 animate-in zoom-in-95">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100 dark:border-red-800">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Data Load Failed</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                    {error}
                </p>
                <div className="flex gap-4 justify-center">
                    <button onClick={onBack} className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                        Go Back
                    </button>
                    <button onClick={() => window.location.reload()} className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-colors flex items-center gap-2">
                        <RefreshCcw className="w-4 h-4" /> Retry
                    </button>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-[#E5E5E6] dark:bg-[#131314] flex flex-col transition-colors">
       {/* Dashboard Header */}
       <header className="h-16 bg-white dark:bg-[#1e1f20] border-b dark:border-[#3c4043] flex items-center px-6 justify-between sticky top-0 z-30 shadow-sm">
          <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 hover:opacity-80 transition-opacity">
             <ChevronRight className="w-4 h-4 rotate-180" /> Back
          </button>
          
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-2 bg-slate-100 dark:bg-[#131314] p-1 rounded-xl border dark:border-[#3c4043]">
                <button onClick={() => setViewMode('chart')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'chart' ? 'bg-white dark:bg-[#1e1f20] shadow text-blue-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}><BarChart2 className="w-4 h-4" /></button>
                <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white dark:bg-[#1e1f20] shadow text-blue-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}><TableIcon className="w-4 h-4" /></button>
             </div>
             <div className="relative hidden md:block">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                    type="text" placeholder="Search questions..." 
                    className="pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-[#131314] rounded-full text-xs outline-none border dark:border-[#3c4043] text-slate-900 dark:text-white w-48 focus:w-64 transition-all focus:ring-2 focus:ring-blue-500/20"
                    value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                />
             </div>
          </div>
       </header>

       <div className="flex-1 overflow-y-auto p-6 md:p-10 max-w-5xl mx-auto w-full space-y-8 pb-20">
          {/* Analytics Components from Hub 2 */}
          <ToplineSummary 
            surveyTitle={surveyTitle}
            onTitleChange={setSurveyTitle}
            year={project.year}
            dateRange={project.metrics?.dateRange || project.dates}
            respondentCount={filteredData.length}
            totalCount={normalizedData.length}
            avgDuration={project.metrics?.avgDuration || '0m 0s'}
            avgEngagement={project.metrics?.engagement || '0Qs'}
            questionCount={questions.length}
            activeFilters={filters}
          />

          {displayedQuestions.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-slate-600">
                  <p className="text-sm font-bold">No questions found matching your search.</p>
              </div>
          ) : (
              displayedQuestions.map(q => (
                <QuestionCard 
                  key={q.id}
                  question={q}
                  data={filteredData}
                  activeFilters={filters[q.id] || []}
                  onToggleFilter={(val) => handleToggleFilter(q.id, val)}
                  allQuestions={questions}
                  defaultViewMode={viewMode}
                />
              ))
          )}
       </div>
    </div>
  );
};

export default ProjectDashboard;
