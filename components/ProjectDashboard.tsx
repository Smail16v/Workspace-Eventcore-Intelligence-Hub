
import React, { useState, useEffect, useMemo } from 'react';
import { 
  ChevronRight, 
  Settings, 
  Loader2, 
  Trophy, 
  BarChart2, 
  Table as TableIcon, 
  Search, 
  Database, 
  AlertTriangle, 
  RefreshCcw, 
  Download, 
  Printer, 
  EyeOff, 
  FileText, 
  LayoutGrid, 
  List as ListIcon 
} from 'lucide-react';
import { Project, QuestionDef, SurveyResponse, FilterState, DashboardViewMode } from '../types';
import { parseSchemaCsv, parseResponsesCsv, normalizeData, filterData, formatDisplayId } from '../services/parser';
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
  
  // Hub 2 UI States
  const [view, setView] = useState<DashboardViewMode>('topline');
  const [searchQuery, setSearchQuery] = useState('');
  const [cardViewMode, setCardViewMode] = useState<'chart' | 'table'>('table');
  const [surveyTitle, setSurveyTitle] = useState(project.name);

  // 1. Fetch and Parse Data on Mount
  useEffect(() => {
    let isMounted = true;
    const MAX_RETRIES = 2;

    async function fetchWithRetry(url: string, label: string) {
        const safeUrl = url + (url.includes('?') ? '&' : '?') + 't=' + new Date().getTime();

        for (let i = 0; i <= MAX_RETRIES; i++) {
            try {
                const res = await fetch(safeUrl, { 
                    mode: 'cors', 
                    cache: 'no-store',
                    credentials: 'omit' 
                });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return await res.text();
            } catch (e: any) {
                if (i === MAX_RETRIES) throw new Error(`Failed to fetch ${label}: ${e.message}`);
                await new Promise(r => setTimeout(r, 1000 * (i + 1))); 
            }
        }
        return '';
    }

    async function loadData() {
      if (!project.schemaUrl || !project.responsesUrl) {
          if (isMounted) {
            setError("Project is missing data files. Please re-initialize via Edit.");
            setLoading(false);
          }
          return;
      }
      
      try {
        if (isMounted) {
            setLoading(true);
            setError(null);
        }

        const [schemaText, responsesText] = await Promise.all([
          fetchWithRetry(project.schemaUrl, 'Schema'),
          fetchWithRetry(project.responsesUrl, 'Responses')
        ]);

        const qs = await parseSchemaCsv(schemaText);
        const rawRs = await parseResponsesCsv(responsesText);
        
        if (isMounted) {
            setQuestions(qs);
            setNormalizedData(normalizeData(rawRs, qs));
        }
      } catch (e: any) {
        console.error("Failed to load project data", e);
        if (isMounted) {
            setError(e.message || "Failed to load project data");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();

    return () => { isMounted = false; };
  }, [project.id, project.schemaUrl, project.responsesUrl]);

  // 2. Derive Filtered Data
  const filteredData = useMemo(() => 
    filterData(normalizedData, questions, filters), 
  [normalizedData, questions, filters]);

  // 3. Compute Live Metrics
  const computedMetrics = useMemo(() => {
    if (filteredData.length === 0) return null;

    let totalSeconds = 0;
    let durationCount = 0;
    filteredData.forEach(r => {
        const dStr = r['Duration (in seconds)'] || r['Duration'];
        const d = parseFloat(dStr);
        if (!isNaN(d)) { totalSeconds += d; durationCount++; }
    });
    const avgSec = durationCount ? totalSeconds / durationCount : 0;
    const durationStr = `${Math.floor(avgSec / 60)}m ${Math.round(avgSec % 60)}s`;

    let totalAns = 0;
    filteredData.forEach(r => {
        const uniqueQs = new Set(
            Object.keys(r).filter(k => (k.startsWith('Q') || k.includes('_')) && r[k] && r[k] !== "")
        );
        totalAns += uniqueQs.size;
    });
    
    const engagementStr = (totalAns / filteredData.length).toFixed(1) + 'Qs';

    return {
        avgDuration: durationStr,
        avgEngagement: engagementStr
    };
  }, [filteredData]);

  // Hub 2 Logic: PII-Scrubbed Raw Data
  const rawTableData = useMemo(() => {
    if (filteredData.length === 0) return { headers: [], rows: [] };
    const metadataHeaders = ['StartDate', 'Duration (in seconds)', 'Finished'];
    // Strict PII Filter: Exclude columns with "name", "email", "phone", "contact", "zip", "postal", "address"
    const safeQuestions = questions.filter(q => !/name|email|phone|contact|zip|postal|address/i.test(q.text + q.id));
    const headers = [...metadataHeaders, ...safeQuestions.map(q => q.id)];
    
    const rows = filteredData.slice(0, 50).map(resp => {
        const row: any = {};
        headers.forEach(h => row[h] = resp[h] || '-');
        return row;
    });
    return { headers, rows };
  }, [filteredData, questions]);

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
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[32px] shadow-xl max-w-lg text-center border border-slate-200 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-100 dark:border-red-800">
                    <AlertTriangle className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Data Load Failed</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">{error}</p>
                <div className="flex flex-wrap gap-4 justify-center">
                    <button onClick={onBack} className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">Go Back</button>
                    <button onClick={() => window.location.reload()} className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-colors flex items-center gap-2"><RefreshCcw className="w-4 h-4" /> Retry</button>
                </div>
            </div>
        </div>
      );
  }

  return (
    <div className="flex h-screen bg-[#E5E5E6] dark:bg-[#131314] overflow-hidden transition-colors">
      
      {/* HUB 2 SIDEBAR NAVIGATION */}
      <aside className="no-print w-72 bg-white dark:bg-[#1e1f20] border-r border-slate-200 dark:border-[#3c4043] flex flex-col hidden lg:flex shrink-0">
        <div className="p-6 border-b border-slate-100 dark:border-[#3c4043]">
          <div className="h-12 flex items-center justify-center mb-6 bg-slate-50 dark:bg-[#131314] rounded-xl p-2 border border-slate-100 dark:border-[#3c4043]">
             <img src={project.logoUrl || "https://picsum.photos/150/150"} className="max-h-full max-w-full object-contain" />
          </div>
          <p className="text-[10px] font-bold text-slate-400 dark:text-[#8e918f] uppercase tracking-widest mb-4">Question Index</p>
          <div className="relative">
              <Search className="w-3 h-3 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Find Question..." 
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#131314] rounded-lg text-[10px] outline-none border border-slate-100 dark:border-[#3c4043] text-slate-700 dark:text-white"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-1">
          {displayedQuestions.map(q => (
            <button 
              key={q.id} 
              onClick={() => document.getElementById(`q-${q.id}`)?.scrollIntoView({ behavior: 'smooth' })}
              className="w-full text-left p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-[#3c4043] text-[11px] transition-all group border border-transparent hover:border-slate-100 dark:hover:border-[#3c4043]"
            >
              <span className="font-bold text-blue-600 dark:text-blue-400 mr-2">{formatDisplayId(q.id)}</span>
              <span className="text-slate-500 dark:text-[#c4c7c5] truncate block group-hover:text-slate-900 dark:group-hover:text-white mt-0.5 leading-tight">{q.text}</span>
            </button>
          ))}
          {displayedQuestions.length === 0 && <p className="text-center text-[10px] text-slate-400 mt-4">No matches found</p>}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* HUB 2 TABBED HEADER */}
        <header className="no-print h-16 bg-white dark:bg-[#1e1f20] border-b border-slate-200 dark:border-[#3c4043] flex items-center px-6 justify-between shrink-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="flex items-center gap-1.5 text-sm font-bold text-blue-600 dark:text-blue-400 hover:opacity-80 transition-opacity">
              <ChevronRight className="w-4 h-4 rotate-180" /> Back
            </button>
            <div className="h-6 w-px bg-slate-200 dark:bg-[#3c4043] mx-1 hidden sm:block"></div>
            <div className="flex bg-slate-100 dark:bg-[#131314] p-1 rounded-xl border border-slate-200 dark:border-[#3c4043]">
              {(['topline', 'raw', 'schema'] as const).map(m => (
                <button 
                  key={m} 
                  onClick={() => setView(m)} 
                  className={`px-5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${view === m ? 'bg-white dark:bg-[#3c4043] shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                >
                  {m === 'topline' ? 'Summary' : (m === 'raw' ? 'Records' : 'Schema')}
                </button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             {view === 'topline' && (
                <div className="flex bg-slate-100 dark:bg-[#131314] p-1 rounded-xl border border-slate-200 dark:border-[#3c4043]">
                  <button onClick={() => setCardViewMode('chart')} className={`p-1.5 rounded-lg transition-all ${cardViewMode === 'chart' ? 'bg-white dark:bg-[#3c4043] shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`} title="Default to Chart"><BarChart2 className="w-4 h-4" /></button>
                  <button onClick={() => setCardViewMode('table')} className={`p-1.5 rounded-lg transition-all ${cardViewMode === 'table' ? 'bg-white dark:bg-[#3c4043] shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`} title="Default to Table"><TableIcon className="w-4 h-4" /></button>
                </div>
             )}
             <button onClick={() => window.print()} className="p-2.5 bg-slate-50 dark:bg-[#3c4043] rounded-xl text-slate-500 dark:text-[#c4c7c5] hover:text-blue-600 dark:hover:text-blue-400 transition-all shadow-sm border dark:border-[#3c4043]" title="Print Report">
                <Printer className="w-4 h-4" />
             </button>
          </div>
        </header>

        {/* VIEW RENDERER */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-8 custom-scrollbar">
          
          {view === 'topline' ? (
            <div className="max-w-5xl mx-auto w-full space-y-8 pb-20">
              <ToplineSummary 
                surveyTitle={surveyTitle}
                onTitleChange={setSurveyTitle}
                year={project.year}
                dateRange={project.metrics?.dateRange || project.dates}
                respondentCount={filteredData.length}
                totalCount={normalizedData.length}
                avgDuration={computedMetrics?.avgDuration || project.metrics?.avgDuration || '0m 0s'}
                avgEngagement={computedMetrics?.avgEngagement || project.metrics?.engagement || '0Qs'}
                questionCount={questions.length}
                activeFilters={filters}
              />
              
              {questions.map(q => (
                <div key={q.id} id={`q-${q.id}`} className="scroll-mt-20">
                  <QuestionCard 
                    question={q} 
                    data={filteredData} 
                    activeFilters={filters[q.id] || []} 
                    onToggleFilter={(val) => handleToggleFilter(q.id, val)} 
                    allQuestions={questions} 
                    defaultViewMode={cardViewMode} 
                  />
                </div>
              ))}
            </div>
          ) : view === 'raw' ? (
            <div className="max-w-7xl mx-auto w-full">
              <div className="bg-white dark:bg-[#1e1f20] rounded-[32px] border border-slate-200 dark:border-[#3c4043] overflow-hidden shadow-xl animate-in zoom-in-95 duration-300">
                 <div className="p-8 border-b border-slate-100 dark:border-[#3c4043] flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/20">
                    <div>
                        <h3 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                           <EyeOff className="w-5 h-5 text-blue-600" /> PII-Scrubbed Raw Data
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Showing first 50 rows. Personal identifiers have been removed for privacy compliance.</p>
                    </div>
                    <div className="text-right">
                       <span className="text-[10px] font-bold text-slate-400 dark:text-[#8e918f] uppercase tracking-widest bg-white dark:bg-[#131314] border dark:border-[#3c4043] px-3 py-1.5 rounded-full shadow-sm">
                           Filtered Sample: {rawTableData.rows.length}
                       </span>
                    </div>
                 </div>
                 <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-xs text-left border-collapse">
                       <thead className="bg-slate-50 dark:bg-[#131314] text-slate-500 dark:text-[#8e918f] uppercase font-bold sticky top-0 z-10 shadow-sm">
                          <tr>
                             {rawTableData.headers.map(h => (
                                <th key={h} className="px-6 py-4 whitespace-nowrap border-b dark:border-[#3c4043]">{h}</th>
                             ))}
                          </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-50 dark:divide-[#3c4043]">
                          {rawTableData.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-blue-900/10 transition-colors">
                              {rawTableData.headers.map(h => (
                                <td key={h} className="px-6 py-4 dark:text-slate-300 border-b dark:border-[#3c4043]">{row[h]}</td>
                              ))}
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
            </div>
          ) : (
             <div className="max-w-5xl mx-auto w-full">
                <div className="bg-white dark:bg-[#1e1f20] rounded-[32px] border border-slate-200 dark:border-[#3c4043] p-10 shadow-xl animate-in zoom-in-95 duration-300">
                    <div className="mb-8 border-b border-slate-100 dark:border-[#3c4043] pb-6">
                        <h3 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                           <FileText className="w-6 h-6 text-blue-600" /> Survey Schema Mapping
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Definition of all survey variables and question structures.</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                           <thead>
                             <tr className="text-slate-400 dark:text-[#8e918f] uppercase font-bold text-xs border-b-2 dark:border-[#3c4043]">
                               <th className="py-4 px-2 w-24">ID</th>
                               <th className="py-4 px-2 w-32">Type</th>
                               <th className="py-4 px-2">Question Text</th>
                               <th className="py-4 px-2 w-32 text-right">Block</th>
                             </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 dark:divide-[#3c4043]">
                              {questions.map(q => (
                                <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                  <td className="py-4 px-2 font-bold text-blue-600 dark:text-blue-400">{q.id}</td>
                                  <td className="py-4 px-2">
                                     <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-[#c4c7c5] px-2 py-0.5 rounded">{q.type}</span>
                                  </td>
                                  <td className="py-4 px-2 text-slate-700 dark:text-slate-300 font-medium leading-relaxed pr-6">{q.text}</td>
                                  <td className="py-4 px-2 text-right text-slate-400 dark:text-[#8e918f] text-[10px] font-bold uppercase tracking-tight">{q.block || 'General'}</td>
                                </tr>
                              ))}
                           </tbody>
                        </table>
                    </div>
                </div>
             </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProjectDashboard;
