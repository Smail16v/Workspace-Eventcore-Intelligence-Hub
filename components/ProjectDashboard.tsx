import React, { useState, useEffect, useMemo } from 'react';
import { ChevronRight, Printer, EyeOff, Table as TableIcon, BarChart2, Loader2, Database, Search, AlertTriangle, RefreshCcw, Download, FileText } from 'lucide-react';
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
  
  // RESTORED UI STATES FROM HUB 2
  const [view, setView] = useState<DashboardViewMode>('topline');
  const [cardViewMode, setCardViewMode] = useState<'chart' | 'table'>('table');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      if (!project.schemaUrl || !project.responsesUrl) {
          if (isMounted) { setError("Missing files. Re-initialize via Edit."); setLoading(false); }
          return;
      }
      try {
        if (isMounted) { setLoading(true); setError(null); }
        const [schemaRes, responsesRes] = await Promise.all([
          fetch(project.schemaUrl, { mode: 'cors' }),
          fetch(project.responsesUrl, { mode: 'cors' })
        ]);
        if (!schemaRes.ok || !responsesRes.ok) throw new Error("Fetch failed");
        const [schemaText, responsesText] = await Promise.all([schemaRes.text(), responsesRes.text()]);
        const qs = await parseSchemaCsv(schemaText);
        const rawRs = await parseResponsesCsv(responsesText);
        if (isMounted) {
            setQuestions(qs);
            setNormalizedData(normalizeData(rawRs, qs));
        }
      } catch (e: any) {
        if (isMounted) setError(e.message || "Failed to load project data");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => { isMounted = false; };
  }, [project.id, project.schemaUrl, project.responsesUrl]);

  const filteredData = useMemo(() => filterData(normalizedData, questions, filters), [normalizedData, questions, filters]);

  const displayedQuestions = useMemo(() => {
    if (!searchQuery) return questions;
    const term = searchQuery.toLowerCase();
    return questions.filter(q => q.id.toLowerCase().includes(term) || q.text.toLowerCase().includes(term));
  }, [questions, searchQuery]);

  // RESTORED: PII-Scrubbed Data Processor
  const rawTableData = useMemo(() => {
    if (filteredData.length === 0) return { headers: [], rows: [] };
    const metadataHeaders = ['ResponseId', 'StartDate', 'Duration (in seconds)', 'Finished'];
    const safeQuestions = questions.filter(q => !/name|email|phone|contact|address/i.test(q.text + q.id));
    const headers = [...metadataHeaders, ...safeQuestions.map(q => q.id)];
    const rows = filteredData.slice(0, 50).map(resp => {
        const row: any = {};
        headers.forEach(h => row[h] = resp[h] || '-');
        return row;
    });
    return { headers, rows };
  }, [filteredData, questions]);

  const handleToggleFilter = (qId: string, value: string) => {
    setFilters(prev => {
        const current = prev[qId] || [];
        const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
        const updated = { ...prev, [qId]: next };
        if (next.length === 0) delete updated[qId];
        return updated;
    });
  };

  if (loading) return (
    <div className="h-screen bg-[#131314] flex flex-col items-center justify-center text-blue-500 gap-4">
      <Loader2 className="w-10 h-10 animate-spin" />
      <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Wiring Analytics...</p>
    </div>
  );

  if (error) return <div className="min-h-screen bg-[#131314] flex items-center justify-center text-red-500 p-6">Error: {error}</div>;

  return (
    <div className="flex h-screen bg-[#E5E5E6] dark:bg-[#131314] overflow-hidden">
      {/* RESTORED: SIDEBAR NAVIGATOR */}
      <aside className="w-64 bg-white dark:bg-[#1e1f20] border-r dark:border-[#3c4043] flex flex-col hidden lg:flex">
        <div className="p-6 border-b dark:border-[#3c4043]">
          <img src={project.logoUrl} className="h-10 mb-4 object-contain" />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dashboard Navigator</p>
        </div>
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {questions.map(q => (
            <button key={q.id} onClick={() => document.getElementById(`q-${q.id}`)?.scrollIntoView({ behavior: 'smooth' })} className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-[#3c4043] text-[11px] transition-all group mb-1">
              <span className="font-bold text-blue-600 dark:text-blue-400 mr-2">{formatDisplayId(q.id)}</span>
              <span className="text-slate-500 dark:text-slate-400 truncate block group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{q.text}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* RESTORED: TABBED HEADER */}
        <header className="h-16 bg-white dark:bg-[#1e1f20] border-b dark:border-[#3c4043] flex items-center px-6 justify-between shrink-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="text-xs font-bold text-blue-600 uppercase tracking-wider">← Back</button>
            <div className="h-6 w-px bg-slate-200 dark:bg-[#3c4043]" />
            <div className="flex bg-slate-100 dark:bg-[#131314] p-1 rounded-xl">
              {(['topline', 'raw', 'schema'] as const).map(tab => (
                <button key={tab} onClick={() => setView(tab)} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${view === tab ? 'bg-white dark:bg-[#3c4043] text-blue-600 shadow-sm' : 'text-slate-500'}`}>{tab}</button>
              ))}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             {view === 'topline' && (
                <div className="flex bg-slate-100 dark:bg-[#131314] p-1 rounded-xl">
                  <button onClick={() => setCardViewMode('chart')} className={`p-1.5 rounded-lg ${cardViewMode === 'chart' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}><BarChart2 className="w-4 h-4" /></button>
                  <button onClick={() => setCardViewMode('table')} className={`p-1.5 rounded-lg ${cardViewMode === 'table' ? 'bg-white shadow text-blue-600' : 'text-slate-400'}`}><TableIcon className="w-4 h-4" /></button>
                </div>
             )}
             <button onClick={() => window.print()} className="p-2 text-slate-400 hover:text-blue-600"><Printer className="w-4 h-4" /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-10 space-y-8 custom-scrollbar">
          {view === 'topline' ? (
            <>
              <ToplineSummary surveyTitle={project.name} year={project.year} respondentCount={filteredData.length} totalCount={normalizedData.length} activeFilters={filters} />
              {displayedQuestions.map(q => (
                <div key={q.id} id={`q-${q.id}`}>
                  <QuestionCard question={q} data={filteredData} activeFilters={filters[q.id] || []} onToggleFilter={(val) => handleToggleFilter(q.id, val)} allQuestions={questions} defaultViewMode={cardViewMode} />
                </div>
              ))}
            </>
          ) : view === 'raw' ? (
            <div className="bg-white dark:bg-[#1e1f20] rounded-[32px] border dark:border-[#3c4043] overflow-hidden shadow-xl">
               <div className="p-6 border-b dark:border-[#3c4043] flex justify-between items-center bg-slate-50 dark:bg-[#1e1f20]">
                  <h3 className="font-bold flex items-center gap-2 text-sm dark:text-white"><EyeOff className="w-4 h-4 text-brand-600" /> PII-Scrubbed Data</h3>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">First 50 Valid Records</span>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left border-collapse">
                     <thead className="bg-slate-50 dark:bg-[#131314] text-slate-500 uppercase font-bold border-b dark:border-[#3c4043]">
                        <tr>{rawTableData.headers.map(h => <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>)}</tr>
                     </thead>
                     <tbody className="divide-y dark:divide-[#3c4043]">
                        {rawTableData.rows.map((row, i) => (
                          <tr key={i} className="hover:bg-slate-50 dark:hover:bg-[#131314] transition-colors">
                            {rawTableData.headers.map(h => <td key={h} className="px-4 py-3 dark:text-slate-300 font-mono text-[10px]">{row[h]}</td>)}
                          </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </div>
          ) : (
             <div className="bg-white dark:bg-[#1e1f20] rounded-[32px] border dark:border-[#3c4043] p-8 shadow-xl">
                <table className="w-full text-xs text-left">
                   <thead className="border-b dark:border-[#3c4043]"><tr className="text-slate-400 uppercase font-bold"><th>ID</th><th>Type</th><th>Technical Text</th></tr></thead>
                   <tbody className="divide-y dark:divide-[#3c4043]">
                      {questions.map(q => <tr key={q.id} className="dark:text-slate-300"><td className="py-4 font-bold text-blue-600">{q.id}</td><td>{q.type}</td><td className="py-4">{q.text}</td></tr>)}
                   </tbody>
                </table>
             </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProjectDashboard;